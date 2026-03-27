import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
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

    const { mode, model, maxTokens, isMultiSlide, prompt } = body as {
      mode?: string; model?: string; maxTokens?: number;
      isMultiSlide?: boolean; prompt?: string;
    };

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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY is not configured. Add it to your .env.local file.' },
        { status: 500 }
      );
    }

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

    // Step 1: Generate component/app code
    const generationResult = await generateComponent(
      intent, 
      generationMode, 
      model, 
      maxTokens, 
      isMultiSlide,
      refinementContext
    );
    if (!generationResult.success || !generationResult.code) {
      return NextResponse.json(
        { success: false, error: generationResult.error },
        { status: 422 }
      );
    }

    const code = generationResult.code;

    // Step 1.5: UI Expert Critique & Repair Agent
    let finalSourceCode = code;
    let critiqueData: unknown;
    try {
      const reviewResult = await reviewGeneratedCode(finalSourceCode, JSON.stringify({ ...intent, mode, model }));
      
      critiqueData = reviewResult;
      
      if (!reviewResult.passed && reviewResult.repairInstructions) {
        console.log(`[Critique Failed] Score: ${reviewResult.score}. Triggering UI Repair Agent...`);
        const repairedCode = await repairGeneratedCode(finalSourceCode, reviewResult.repairInstructions);
        
        // Ensure repair didn't return garbage
        if (repairedCode && repairedCode.length > 200) {
          console.log('[Repair Success] UI improved by agent.');
          finalSourceCode = repairedCode;
        }
      } else {
        console.log(`[Critique Passed] Score: ${reviewResult.score}. Good to go.`);
      }
    } catch (e) {
      console.warn('UI Reviewer failed, proceeding with original code:', e);
    }

    // Step 1.6: Sanitize — flatten multi-line template literals that break Sandpack's Babel parser
    finalSourceCode = sanitizeGeneratedCode(finalSourceCode);

    // Step 1.75: Browser Safety Validation — block code with Node/TTY imports
    const safetyCheck = validateBrowserSafeCode(finalSourceCode);
    if (!safetyCheck.isValid) {
      const issueList = safetyCheck.issues.join(' | ');
      console.error('[/api/generate] Code failed browser safety check:', issueList);
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

    // Step 6: Save to memory (async)
    if (generationMode === 'app' || (generationMode === 'component' && finalReport.passed && finalReport.score >= 80)) {
      setTimeout(() => {
        saveGeneration(
          intent, 
          finalCode, 
          finalReport.score, 
          undefined,
          intent.previousProjectId
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
        console.log('[/api/generate] Dependency resolver patched files:', patchLog);
      }
    } else {
      resolvedCode = finalCode;
    }

    return NextResponse.json({
      success: true,
      code: resolvedCode,
      a11yReport: {
        ...finalReport,
        appliedFixes,
      },
      critique: critiqueData,
      tests,
      mode: generationMode,
      generatorMeta: {
        blueprint: generationResult.blueprint,
        validationWarnings: generationResult.validationWarnings,
        repairsApplied: [...(generationResult.repairsApplied ?? []), ...resolverPatchLog],
      },
    });
  } catch (error) {
    console.error('[/api/generate] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
