import { NextRequest, NextResponse } from 'next/server';
import { generateComponent } from '@/lib/ai/componentGenerator';
import { validateAccessibility, autoRepairA11y } from '@/lib/validation/a11yValidator';
import { generateTests } from '@/lib/testGenerator';
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

    // Check for OpenAI API key
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY is not configured. Add it to your .env.local file.' },
        { status: 500 }
      );
    }

    // Step 1: Generate component code
    const generationResult = await generateComponent(intent);
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
    });
  } catch (error) {
    console.error('[/api/generate] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
