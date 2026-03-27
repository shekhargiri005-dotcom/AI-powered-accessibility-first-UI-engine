import { NextRequest, NextResponse } from 'next/server';
import { parseIntent } from '@/lib/ai/intentParser';
import type { GenerationMode } from '@/lib/ai/componentGenerator';
import { validatePromptInput } from '@/lib/intelligence/inputValidator';

const MAX_INPUT_LENGTH = 20000;

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

    if (!body || typeof body !== 'object' || !('prompt' in body)) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: prompt' },
        { status: 400 }
      );
    }

    const { prompt, mode, contextId } = body as {
      prompt: string;
      mode: GenerationMode;
      contextId?: string;
    };

    // ─── Input Validation (UI Intelligence Layer) ─────────────────────────────
    const inputCheck = validatePromptInput(prompt);
    if (!inputCheck.valid) {
      return NextResponse.json(
        { success: false, error: inputCheck.reason, suggestions: inputCheck.suggestions },
        { status: 400 }
      );
    }
    // Use sanitized version from input validator
    const sanitizedPrompt = inputCheck.sanitized ?? String(prompt).trim();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY is not configured. Add it to your .env.local file.' },
        { status: 500 }
      );
    }

    const generationMode: GenerationMode = mode === 'app' ? 'app' : mode === 'webgl' ? 'webgl' : 'component';
    const result = await parseIntent(prompt, generationMode, typeof contextId === 'string' ? contextId : undefined);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      intent: result.intent,
    });
  } catch (error) {
    console.error('[/api/parse] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
