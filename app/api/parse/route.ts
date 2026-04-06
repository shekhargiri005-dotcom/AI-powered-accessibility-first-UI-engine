import { NextRequest, NextResponse } from 'next/server';
import { parseIntent } from '@/lib/ai/intentParser';
import type { GenerationMode } from '@/lib/ai/componentGenerator';
import { validatePromptInput } from '@/lib/intelligence/inputValidator';
import { logger } from '@/lib/logger';

export const maxDuration = 60;

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

    const { prompt, mode, contextId, model, provider, apiKey, baseUrl } = body as {
      prompt: string;
      mode: GenerationMode;
      contextId?: string;
      // User-configured model — forwarded so we honour their Ollama/cloud selection
      // rather than allowing the env-resolved adapter to silently pick up a
      // quota-exhausted OPENAI_API_KEY (or any other unintended key).
      model?: string;
      provider?: string;
      apiKey?: string;
      baseUrl?: string;
    };

    // ─── Input Validation ─────────────────────────────────────────────────────
    const inputCheck = validatePromptInput(prompt);
    if (!inputCheck.valid) {
      reqLogger.warn('Input validation failed', { reason: inputCheck.reason });
      return NextResponse.json(
        { success: false, error: inputCheck.reason, suggestions: inputCheck.suggestions },
        { status: 400 }
      );
    }
    // Use the sanitized version — raw prompt was previously being passed instead (bug)
    const sanitizedPrompt = inputCheck.sanitized ?? String(prompt).trim();

    const generationMode: GenerationMode =
      mode === 'app' ? 'app' : mode === 'webgl' ? 'webgl' : 'component';

    // Build caller model config only if the user actually supplied a model.
    // Passing undefined lets parseIntent fall through to resolveDefaultAdapter.
    const modelConfig = model
      ? {
          model,
          provider,
          apiKey: apiKey && apiKey !== '••••' ? apiKey : undefined,
          baseUrl,
        }
      : undefined;

    reqLogger.debug('Parsing intent', { mode: generationMode, model: model ?? 'env-resolved' });
    const result = await parseIntent(
      sanitizedPrompt,
      generationMode,
      typeof contextId === 'string' ? contextId : undefined,
      modelConfig,
    );

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
