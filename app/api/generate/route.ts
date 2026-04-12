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
import { runVisionRuntimeReview } from '@/lib/ai/visionReviewer';
import { upsertComponentEmbedding } from '@/lib/ai/vectorStore';

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

    const { mode, model, maxTokens, isMultiSlide, prompt, stream: streamFlag, provider, apiKey, baseUrl, thinkingPlan } = body as {
      mode?: string; model?: string; maxTokens?: number; provider?: string;
      isMultiSlide?: boolean; prompt?: string; stream?: boolean; apiKey?: string; baseUrl?: string;
      thinkingPlan?: unknown;
    };

    // Sanitise masked key — page.tsx stores '••••' when loaded from localStorage
    const effectiveApiKey = apiKey && apiKey !== '••••' ? apiKey : undefined;

    // ── SSE streaming path ───────────────────────────────────────────────────
    if (streamFlag) {
      const session    = await auth();
      const userId     = session?.user?.id;
      const workspaceId = request.headers.get('x-workspace-id') || (body as Record<string, unknown>).workspaceId as string || 'default';

      if (!model) {
        return NextResponse.json({ success: false, error: 'model is required for streaming' }, { status: 400 });
      }

      const adapter = await getWorkspaceAdapter(
        { model, provider, apiKey: effectiveApiKey, baseUrl },
        workspaceId, userId,
      );

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

    // Detect local/Ollama models — skip expensive review/repair LLM calls for them.
    // Also skip for fast-compat providers (Groq/Together) which route lightweight models
    // through the OpenAI-compat adapter but cannot run a second vision-review call cost-effectively.
    const isGroqOrCompat = (
      baseUrl?.includes('groq.com') ||
      baseUrl?.includes('together.xyz') ||
      provider === 'groq'
    );
    const isLocalModel = (
      provider === 'ollama' ||
      provider === 'lmstudio' ||
      isGroqOrCompat ||
      baseUrl?.includes('localhost') ||
      baseUrl?.includes('127.0.0.1') ||
      // Final fallback: no cloud keys configured anywhere — assume local environment
      (
        !provider &&
        !process.env.OPENAI_API_KEY &&
        !process.env.ANTHROPIC_API_KEY &&
        !process.env.GOOGLE_API_KEY &&
        !process.env.DEEPSEEK_API_KEY &&
        !process.env.GROQ_API_KEY &&
        !process.env.TOGETHER_API_KEY
      )
    );


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
      effectiveApiKey,
      baseUrl,
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

    let finalSourceCode = code;

    // Step 1.5: Deterministic syntax validation before expensive review calls
    let reviewData: Record<string, unknown> | undefined;
    const deterministicCheck = validateGeneratedCode(finalSourceCode);
    if (!deterministicCheck.valid) {
      const reason = deterministicCheck.errors.map((e) => e.message).join(' | ');
      const repaired = await repairGeneratedCode(
        finalSourceCode,
        `Fix deterministic validation errors: ${reason}`,
        provider ? { provider, apiKey: effectiveApiKey, baseUrl } : undefined,
      );
      if (repaired && repaired.length > 100) {
        finalSourceCode = repaired;
        reviewData = { source: 'deterministic', passed: false, reason };
      }
    }

    // Step 1.6: UI Expert Critique & Repair Agent
    // Skipped for local/Ollama models — review would queue a 2nd+ slow local inference call.
    // Only runs when a fast cloud model (REVIEW_MODEL env var or a configured cloud key) is available.
    //
    // adapterOverride ensures the engine uses the SAME provider the user selected in the UI
    // instead of re-resolving independently from env vars (which may point to an over-quota key).
    const adapterOverride: ReviewerAdapterOverride | undefined = provider
      ? { provider, apiKey: effectiveApiKey, baseUrl, model }
      : undefined;

    let critiqueData: unknown;
    let repairedByReviewer = false;
    if (!isLocalModel) {
      // Wrap the entire review+repair phase in a 60s aggregate timeout.
      // Each repair call can take 30-60s — without this the chain can exceed
      // Vercel's 300s maxDuration when multiple repairs trigger in sequence.
      const reviewPhaseTimeout = new Promise<void>((resolve) => setTimeout(resolve, 60_000));
      const reviewPhase = (async () => {
        try {
          // BUG-02 FIX: Hard 10s escape hatch so Browserless cold-starts never block the pipeline.
          // Cast the timeout branch to VisionRuntimeReviewResult to avoid a union type mismatch.
          const visionTimeout = new Promise<import('@/lib/ai/visionReviewer').VisionRuntimeReviewResult>((resolve) =>
            setTimeout(() => resolve({ runtimeOk: true }), 10_000)
          );
          const visionResult = await Promise.race([runVisionRuntimeReview(finalSourceCode), visionTimeout]);
          if (!visionResult.runtimeOk && visionResult.runtimeError) {
            const repaired = await repairGeneratedCode(
              finalSourceCode,
              `Runtime crash detected in headless render. Fix this error:\n${visionResult.runtimeError}`,
              adapterOverride,
            );
            if (repaired && repaired.length > 100) {
              finalSourceCode = repaired;
              repairedByReviewer = true;
              reviewData = { source: 'runtime', passed: false, reason: visionResult.runtimeError };
            }
          } else if (visionResult.visualPassed === false && visionResult.suggestedCode) {
            finalSourceCode = visionResult.suggestedCode;
            repairedByReviewer = true;
            reviewData = { source: 'vision', passed: false, reason: visionResult.visualCritique ?? 'Vision critique failed.' };
          }

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
          // BUG-01 FIX: Reviewer/repair failure must never kill valid generated code.
          const reviewErrMsg = e instanceof Error ? e.message : String(e);
          reqLogger.warn('UI Reviewer failed — continuing with original generated code', { error: reviewErrMsg });
          if (!reviewData) reviewData = { source: 'reviewer-skipped', passed: true, reason: 'Reviewer unavailable: ' + reviewErrMsg.slice(0, 200) };
        }
      })();

      // Race: review phase vs 60s aggregate wall-clock timeout
      await Promise.race([reviewPhase, reviewPhaseTimeout]);
      if (!reviewData) {
        reqLogger.warn('Review phase timed out after 60s — continuing with generated code as-is');
        reviewData = { source: 'reviewer-skipped', passed: true, reason: 'Review phase exceeded 60s budget' };
      }
    } else {
      reqLogger.info('Skipping review/repair — local model detected, no fast cloud reviewer available');
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
      generatorMeta: {
        blueprint:          generationResult.blueprint,
        validationWarnings: generationResult.validationWarnings,
        repairsApplied:     [...(generationResult.repairsApplied ?? []), ...resolverPatchLog],
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
