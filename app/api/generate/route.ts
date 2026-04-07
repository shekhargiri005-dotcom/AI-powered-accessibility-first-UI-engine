import { NextRequest, NextResponse } from 'next/server';
import { createTextStreamResponse } from 'ai';
import crypto from 'crypto';
import { generateComponent } from '@/lib/ai/componentGenerator';
import type { GenerationMode } from '@/lib/ai/componentGenerator';
import { validateAccessibility, autoRepairA11y } from '@/lib/validation/a11yValidator';
import { generateTests } from '@/lib/testGenerator';
import { reviewGeneratedCode, repairGeneratedCode } from '@/lib/ai/uiReviewer';
import { saveGeneration, getProjectById } from '@/lib/ai/memory';
import { UIIntentSchema } from '@/lib/validation/schemas';
import { validateBrowserSafeCode, sanitizeGeneratedCode } from '@/lib/validation/security';
import { validatePromptInput, validateGenerationMode } from '@/lib/intelligence/inputValidator';
import { resolveAndPatch } from '@/lib/intelligence/dependencyResolver';
import { logger } from '@/lib/logger';
import { getWorkspaceAdapter } from '@/lib/ai/adapters/index';
import { auth } from '@/lib/auth';

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

    const { mode, model, maxTokens, isMultiSlide, prompt, stream: streamFlag, provider, apiKey, baseUrl } = body as {
      mode?: string; model?: string; maxTokens?: number; provider?: string;
      isMultiSlide?: boolean; prompt?: string; stream?: boolean; apiKey?: string; baseUrl?: string;
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
    const generationMode: GenerationMode = mode === 'app' ? 'app' : mode === 'webgl' ? 'webgl' : 'component';

    // Detect local/Ollama models — skip expensive review/repair LLM calls for them
    const isLocalModel = (
      !provider ||
      provider === 'ollama' ||
      provider === 'lmstudio' ||
      baseUrl?.includes('localhost') ||
      baseUrl?.includes('127.0.0.1') ||
      (!process.env.REVIEW_MODEL && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GOOGLE_API_KEY)
    );


    // Step 0: Handle Refinement Context
    let refinementContext: { code: string; manifest?: unknown } | undefined;
    if (intent.isRefinement && intent.previousProjectId) {
      const parentProject = getProjectById(intent.previousProjectId);
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
    );
    if (!generationResult.success || !generationResult.code) {
      reqLogger.error(
        'Generation Result Error', 
        new Error(generationResult.error || 'Unknown generation error')
      );
      return NextResponse.json(
        { success: false, error: generationResult.error },
        { status: 422 }
      );
    }

    const code = generationResult.code;

    // Step 1.5: UI Expert Critique & Repair Agent
    // Skipped for local/Ollama models — review would queue a 2nd+ slow local inference call.
    // Only runs when a fast cloud model (REVIEW_MODEL env var or a configured cloud key) is available.
    let finalSourceCode = code;
    let critiqueData: unknown;
    if (!isLocalModel) {
      try {
        const reviewResult = await reviewGeneratedCode(finalSourceCode, JSON.stringify({ ...intent, mode, model }));
        critiqueData = reviewResult;

        if (!reviewResult.passed && reviewResult.repairInstructions) {
          reqLogger.info('Critique failed, triggering UI Repair Agent', { score: reviewResult.score });
          const repairedCode = await repairGeneratedCode(finalSourceCode, reviewResult.repairInstructions);
          if (repairedCode && repairedCode.length > 200) {
            reqLogger.info('Repair success. UI improved by agent.');
            finalSourceCode = repairedCode;
          }
        } else {
          reqLogger.info('Critique passed', { score: reviewResult.score });
        }
      } catch (e) {
        reqLogger.warn('UI Reviewer failed, proceeding with original code', { error: e });
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
          const repaired = autoRepairA11y(code);
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
        );
      }, 0);
    }

    // Step 6b: Dependency resolution for multi-file outputs (applies to original generated files)
    let resolverPatchLog: string[] = [];
    const rawGeneratedCode = generationResult.code;
    let resolvedCode: string | Record<string, string>;
    if (rawGeneratedCode && typeof rawGeneratedCode === 'object') {
      const { files: patchedFiles, patchLog } = resolveAndPatch(rawGeneratedCode as Record<string, string>);
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
