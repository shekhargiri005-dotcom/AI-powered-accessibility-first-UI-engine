import { NextRequest, NextResponse } from 'next/server';
import { generateComponent } from '@/lib/ai/componentGenerator';
import type { GenerationMode } from '@/lib/ai/componentGenerator';
import { validateAccessibility, autoRepairA11y } from '@/lib/validation/a11yValidator';
import { generateTests } from '@/lib/testGenerator';
import { saveGeneration, getProjectById } from '@/lib/ai/memory';
import { UIIntentSchema } from '@/lib/validation/schemas';

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
    const { mode, model, maxTokens, isMultiSlide } = body as { mode?: string; model?: string; maxTokens?: number; isMultiSlide?: boolean };
    const generationMode: GenerationMode = mode === 'app' ? 'app' : mode === 'webgl' ? 'webgl' : 'component';

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY is not configured. Add it to your .env.local file.' },
        { status: 500 }
      );
    }

    // Step 0: Handle Refinement Context
    let refinementContext: { code: string; manifest?: any } | undefined;
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

    // Step 2: Run accessibility validation
    const initialA11yReport = validateAccessibility(generationResult.code);

    // Step 3: Auto-repair common a11y issues
    let finalCode = generationResult.code;
    let appliedFixes: string[] = [];

    if (!initialA11yReport.passed) {
      const repaired = autoRepairA11y(generationResult.code);
      finalCode = repaired.code;
      appliedFixes = repaired.appliedFixes;
    }

    // Step 4: Re-validate after auto-repair
    const finalA11yReport = appliedFixes.length > 0
      ? validateAccessibility(finalCode)
      : initialA11yReport;

    // Step 4.5: Save to memory (projects and successful generations)
    if (generationMode === 'app' || (generationMode === 'component' && finalA11yReport.passed && finalA11yReport.score >= 80)) {
      setTimeout(() => {
        saveGeneration(
          intent, 
          finalCode, 
          finalA11yReport.score, 
          undefined, // TODO: support multi-file manifestation in generate routing
          intent.previousProjectId
        );
      }, 0);
    }

    // Step 5: Generate tests
    const tests = generateTests(intent, finalCode);

    return NextResponse.json({
      success: true,
      code: finalCode,
      a11yReport: {
        ...finalA11yReport,
        appliedFixes,
      },
      tests,
      mode: generationMode,
    });
  } catch (error) {
    console.error('[/api/generate] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
