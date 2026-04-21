import { NextRequest, NextResponse } from 'next/server';
import { createTextStreamResponse } from 'ai';
import crypto from 'crypto';
import { generateComponent } from '@/lib/ai/componentGenerator';
import type { GenerationMode } from '@/lib/ai/componentGenerator';
import { validateAccessibility, autoRepairA11y } from '@/lib/validation/a11yValidator';
import { generateTests } from '@/lib/testGenerator';
import { reviewGeneratedCode, repairGeneratedCode } from '@/lib/ai/uiReviewer';
import type { ReviewerAdapterOverride } from '@/lib/ai/uiReviewer';
import { saveGeneration, getProjectByIdAsync } from '@/lib/ai/memory';
import { UIIntentSchema } from '@/lib/validation/schemas';
import { validateBrowserSafeCode, sanitizeGeneratedCode } from '@/lib/validation/security';
import { validatePromptInput, validateGenerationMode } from '@/lib/intelligence/inputValidator';
import { resolveAndPatch } from '@/lib/intelligence/dependencyResolver';
import { validateGeneratedCode } from '@/lib/intelligence/codeValidator';
import { logger } from '@/lib/logger';
import { getWorkspaceAdapter } from '@/lib/ai/adapters/index';
import { auth } from '@/lib/auth';
import { upsertComponentEmbedding } from '@/lib/ai/vectorStore';
import type { ProviderName } from '@/lib/ai/types';

// ─── NEW: Auto-repair for common AI syntax errors ────────────────────────────
import { autoRepairCode, needsRepair } from '@/lib/intelligence/codeAutoRepair';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const reqLogger = logger.createRequestLogger('/api/generate');
  reqLogger.info('Received UI generation request');

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      reqLogger.warn('Invalid JSON in request body');
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object' || !('intent' in body)) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: intent' },
        { status: 400 }
      );
    }

    // SECURITY: Only accept provider and model from client - NEVER apiKey or baseUrl
    const { mode, model, maxTokens, isMultiSlide, prompt, stream: streamFlag, provider, thinkingPlan } = body as {
      mode?: string; model?: string; maxTokens?: number; provider?: string;
      isMultiSlide?: boolean; prompt?: string; stream?: boolean;
      thinkingPlan?: unknown;
    };

    // ── SSE streaming path ───────────────────────────────────────────────────
    if (streamFlag) {
      const session    = await auth();
      const userId     = session?.user?.id;
      const workspaceId = request.headers.get('x-workspace-id') || (body as Record<string, unknown>).workspaceId as string || 'default';

      if (!model) {
        return NextResponse.json({ success: false, error: 'model is required for streaming' }, { status: 400 });
      }

      const providerId = (provider || 'openai') as ProviderName;
      const adapter = await getWorkspaceAdapter(providerId, model, workspaceId, userId);

      const systemPrompt = 'You are an expert React/Tailwind UI engineer. Generate a single, complete, accessible React component. Return only raw TSX code, no markdown fences.';
      const userPrompt   = prompt ?? 'Generate a simple hello world UI component.';

      const textStream = new ReadableStream<string>({
        async start(controller) {
          try {
            reqLogger.info('Starting streaming generation', { model, provider });
            for await (const chunk of adapter.stream({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              maxTokens: maxTokens ?? 5000,
            })) {
              if (chunk.delta) controller.enqueue(chunk.delta);
              if (chunk.done) break;
            }
            reqLogger.info('Streaming generation completed successfully');
          } catch (err) {
            reqLogger.error('Stream generation failed', err);
            controller.enqueue(`\n[Stream Error: ${err instanceof Error ? err.message : 'Unknown'}]`);
          } finally {
            controller.close();
          }
        },
      });

      return createTextStreamResponse({ textStream });
    }

    // Step 0a: Input validation (if prompt is provided alongside intent)
    if (prompt !== undefined) {
      const promptCheck = validatePromptInput(prompt);
      if (!promptCheck.valid) {
        return NextResponse.json(
          { success: false, error: promptCheck.reason, suggestions: promptCheck.suggestions },
          { status: 400 }
        );
      }
    }

    // Step 0b: Mode validation
    const modeCheck = validateGenerationMode(mode ?? 'component');
    if (!modeCheck.valid) {
      return NextResponse.json(
        { success: false, error: modeCheck.reason },
        { status: 400 }
      );
    }

    // Validate intent shape with Zod
    const intentValidation = UIIntentSchema.safeParse((body as { intent: unknown }).intent);
    if (!intentValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid intent structure: ${intentValidation.error.issues.map(i => i.message).join(', ')}`,
        },
        { status: 400 }
      );
    }

    const intent = intentValidation.data;
    const generationMode: GenerationMode = mode === 'app' ? 'app' : mode === 'depth_ui' ? 'depth_ui' : 'component';


    // Step 0: Handle Refinement Context
    let refinementContext: { code: string; manifest?: unknown } | undefined;
    if (intent.isRefinement && intent.previousProjectId) {
      const parentProject = await getProjectByIdAsync(intent.previousProjectId);
      if (parentProject) {
        // Find the specific file to refine if targetFiles is provided,
        // otherwise default to the first file or the full component string
        let targetCode: string;
        if (typeof parentProject.code === 'string') {
          targetCode = parentProject.code;
        } else {
          const targetFile = intent.targetFiles?.[0] || Object.keys(parentProject.code)[0];
          targetCode = parentProject.code[targetFile] || Object.values(parentProject.code)[0];
        }

        refinementContext = {
          code: targetCode,
          manifest: parentProject.manifest
        };
      }
    }

    // Step 0.5: Workspace Auth check for non-streaming
    const session = await auth();
    const userId = session?.user?.id;
    const workspaceId = request.headers.get('x-workspace-id') || (body as Record<string, unknown>).workspaceId as string || 'default';

    // Step 1: Generate component/app code
    const generationResult = await generateComponent(
      intent,
      generationMode,
      model ?? '',
      maxTokens,
      isMultiSlide,
      refinementContext,
      undefined,
      workspaceId,
      userId,
      provider,
      thinkingPlan,
    );
    if (!generationResult.success || !generationResult.code) {
      // Include model+provider in log so we can diagnose which provider caused the failure
      // without needing to parse the error string itself.
      reqLogger.error(
        'Generation Result Error',
        generationResult.error ?? 'Unknown generation error',
        { model: model ?? '[env-default]', provider: provider ?? '[env-default]' },
      );
      return NextResponse.json(
        { success: false, error: generationResult.error },
        { status: 422 }
      );
    }

    const code = generationResult.code;

    // Step 1.4: Auto-repair common AI syntax errors before validation
    // This catches style prop misuse, missing exports, wrong token paths, etc.
    let autoRepairResult = { code, fixes: [] as string[], hadErrors: false };
    if (needsRepair(code)) {
      autoRepairResult = autoRepairCode(code);
      if (autoRepairResult.hadErrors) {
        reqLogger.info('Auto-repaired AI code', { fixes: autoRepairResult.fixes });
      }
    }
    let finalSourceCode = autoRepairResult.code;

    // Step 1.5: Deterministic syntax validation before expensive review calls
    let reviewData: Record<string, unknown> | undefined;
    const deterministicCheck = validateGeneratedCode(finalSourceCode);
    if (!deterministicCheck.valid) {
      const reason = deterministicCheck.errors.map((e) => e.message).join(' | ');
      const repaired = await repairGeneratedCode(
        finalSourceCode,
        `Fix deterministic validation errors: ${reason}`,
        provider ? { provider, model, workspaceId, userId } : undefined,
      );
      if (repaired && repaired.length > 100) {
        finalSourceCode = repaired;
        reviewData = { source: 'deterministic', passed: false, reason };
      }
    }

    // Step 1.6: UI Expert Critique & Repair Agent
    // SKIPPED for free-tier / rate-limited providers to conserve API quota.
    // Only runs when a dedicated REVIEW_MODEL is configured or the provider
    // has sufficient quota (not Google free tier).
    const adapterOverride: ReviewerAdapterOverride | undefined = provider
      ? { provider, model, workspaceId, userId }
      : undefined;

    // Free-tier providers (google without paid key) have ~15 RPM.
    // Review + repair would consume 2 more API calls, guaranteeing 429.
    // Skip review entirely for these providers unless a dedicated REVIEW_MODEL is set.
    const isFreeTierProvider = !process.env.REVIEW_MODEL && (
      provider === 'google' || provider === 'groq'
    );

    let critiqueData: unknown;
    let repairedByReviewer = false;
    if (!isFreeTierProvider) {
      try {
        const reviewResult = await reviewGeneratedCode(
          finalSourceCode,
          JSON.stringify({ ...intent, mode, model }),
          adapterOverride,
        );
        critiqueData = reviewResult;

        if (!reviewResult.passed && reviewResult.repairInstructions) {
          reqLogger.info('Critique failed, triggering UI Repair Agent', { score: reviewResult.score });
          const repairedCode = await repairGeneratedCode(
            finalSourceCode,
            reviewResult.repairInstructions,
            adapterOverride,
          );
          if (repairedCode && repairedCode.length > 200) {
            reqLogger.info('Repair success. UI improved by agent.');
            finalSourceCode = repairedCode;
            repairedByReviewer = true;
            reviewData = { source: 'text-review', passed: false, reason: reviewResult.repairInstructions };
          }
        } else {
          reqLogger.info('Critique passed', { score: reviewResult.score });
          if (!reviewData) reviewData = { source: 'text-review', passed: true, reason: 'Passed reviewer checks.' };
        }
      } catch (e) {
        const reviewErrMsg = e instanceof Error ? e.message : String(e);
        reqLogger.warn('UI Reviewer failed — continuing with original generated code', { error: reviewErrMsg });
        if (!reviewData) reviewData = { source: 'reviewer-skipped', passed: true, reason: 'Reviewer unavailable: ' + reviewErrMsg.slice(0, 200) };
      }
    } else {
      reqLogger.info('Skipping review/repair — free-tier provider detected, conserving API quota for generation');
    }

    // Step 1.6: Sanitize — flatten multi-line template literals that break Sandpack's Babel parser
    finalSourceCode = sanitizeGeneratedCode(finalSourceCode);

    // Step 1.75: Browser Safety Validation — block code with Node/TTY imports
    const safetyCheck = validateBrowserSafeCode(finalSourceCode);
    if (!safetyCheck.isValid) {
      const issueList = safetyCheck.issues.join(' | ');
      reqLogger.error('Code failed browser safety check', { issues: safetyCheck.issues });
      return NextResponse.json(
        { success: false, error: `Generated code contains browser-unsafe patterns: ${issueList}`, safetyIssues: safetyCheck.issues },
        { status: 422 }
      );
    }

    // Step 2 & 5: Parallel Logic (A11y + Tests)
    const [a11yResult, tests] = await Promise.all([
      // A11y Flow
      (async () => {
        const initialReport = validateAccessibility(finalSourceCode);
        let finalCode = finalSourceCode;
        let appliedFixes: string[] = [];

        if (!initialReport.passed) {
          const repaired = autoRepairA11y(finalSourceCode);
          finalCode = repaired.code;
          appliedFixes = repaired.appliedFixes;
        }

        const finalReport = appliedFixes.length > 0
          ? validateAccessibility(finalCode)
          : initialReport;

        return { finalCode, finalReport, appliedFixes };
      })(),
      // Test Generation Flow (uses initial code for speed, repairs are usually minor)
      (async () => {
        return generateTests(intent, finalSourceCode);
      })()
    ]);

    const { finalCode, finalReport, appliedFixes } = a11yResult;

    // Step 6: Save to memory (async) — use a pre-generated ID so we can
    // return it in the response for feedback correlation.
    const genId = crypto.randomUUID();
    if (generationMode === 'app' || (generationMode === 'component' && finalReport.passed && finalReport.score >= 80)) {
      setTimeout(() => {
        saveGeneration(
          intent,
          finalCode,
          finalReport.score,
          undefined,
          intent.previousProjectId,
          genId,
          { thinkingPlan, reviewData },
        );
      }, 0);
    }

    if (repairedByReviewer && finalReport.passed && typeof finalCode === 'string') {
      const reason = typeof reviewData?.reason === 'string' ? reviewData.reason : 'Autonomous repair applied.';
      const repairGuidelines = `Crash/Critique: ${reason}\n\nFix: ${finalCode}`;
      void upsertComponentEmbedding({
        knowledgeId: `repair:${genId}`,
        name: `${intent.componentName} repair pattern`,
        keywords: [intent.componentType ?? 'component', intent.componentName, 'repair', 'runtime', 'critique'],
        guidelines: repairGuidelines,
        source: 'repair',
      });
    }

    // Step 6b: Dependency resolution for multi-file outputs.
    // BUG-09 FIX: Apply a11y-repaired finalCode into the file map before patching,
    // so A11y repairs are not silently discarded in app-mode multi-file outputs.
    let resolverPatchLog: string[] = [];
    const rawGeneratedCode = generationResult.code;
    let resolvedCode: string | Record<string, string>;
    if (rawGeneratedCode && typeof rawGeneratedCode === 'object') {
      // Merge a11y-repaired version of the primary entry file back into the map
      const codeMap = rawGeneratedCode as Record<string, string>;
      const primaryKey = Object.keys(codeMap)[0];
      if (primaryKey && typeof finalCode === 'string' && finalCode !== finalSourceCode) {
        codeMap[primaryKey] = finalCode;
      }
      const { files: patchedFiles, patchLog } = resolveAndPatch(codeMap);
      resolvedCode = patchedFiles;
      resolverPatchLog = patchLog;
      if (patchLog.length > 0) {
        reqLogger.info('Dependency resolver patched files', { patchLog });
      }
    } else {
      resolvedCode = finalCode;
    }

    reqLogger.end('UI Generation pipeline completed successfully', {
      mode: generationMode,
      a11yScore: finalReport.score,
      appliedFixesCount: appliedFixes.length
    });

    return NextResponse.json({
      success: true,
      code: resolvedCode,
      generationId: genId,
      a11yReport: {
        ...finalReport,
        appliedFixes,
      },
      critique: critiqueData,
      tests,
      mode: generationMode,
      autoRepairs: autoRepairResult.fixes, // NEW: Report auto-repairs to frontend
      generatorMeta: {
        blueprint:          generationResult.blueprint,
        validationWarnings: generationResult.validationWarnings,
        repairsApplied:     [...(generationResult.repairsApplied ?? []), ...resolverPatchLog],
        autoRepairApplied:  autoRepairResult.hadErrors,
        feedbackEnriched:   generationResult.feedbackEnriched ?? false,
      },
    });
  } catch (error) {
    reqLogger.error('Unexpected error during UI generation', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
