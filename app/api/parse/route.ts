import { NextRequest, NextResponse } from 'next/server';
import { parseIntent } from '@/lib/ai/intentParser';
import type { GenerationMode } from '@/lib/ai/componentGenerator';
import { validatePromptInput } from '@/lib/intelligence/inputValidator';
import { logger } from '@/lib/logger';

const MAX_INPUT_LENGTH = 20000;

export async function POST(request: NextRequest) {
  const reqLogger = logger.createRequestLogger('/api/parse');
  reqLogger.info('Received intent parse request');

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
      reqLogger.warn('Input validation failed', { reason: inputCheck.reason });
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

    reqLogger.debug('Parsing intent', { mode: generationMode });
    const result = await parseIntent(prompt, generationMode, typeof contextId === 'string' ? contextId : undefined);

    if (!result.success) {
      reqLogger.warn('Intent parsing failed', { error: result.error });
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 422 }
      );
    }

    reqLogger.info('Intent parsed successfully', { intentName: result.intent?.componentName });
    reqLogger.end('Request completed successfully');

    return NextResponse.json({
      success: true,
      intent: result.intent,
    });
  } catch (error) {
    reqLogger.error('Unexpected error during intent parsing', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
