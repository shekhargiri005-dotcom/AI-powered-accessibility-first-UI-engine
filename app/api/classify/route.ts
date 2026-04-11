import { NextRequest, NextResponse } from 'next/server';
import { classifyIntent } from '@/lib/ai/intentClassifier';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const reqLogger = logger.createRequestLogger('/api/classify');
  reqLogger.info('Received intent classification request');

  try {
    let body: unknown;
    try { body = await request.json(); } catch {
      reqLogger.warn('Invalid JSON in request body');
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || !('prompt' in body)) {
      return NextResponse.json({ success: false, error: 'Missing field: prompt' }, { status: 400 });
    }

    const { prompt, hasActiveProject, model, provider, apiKey, baseUrl } = body as {
      prompt: string;
      hasActiveProject?: boolean;
      model?: string;
      provider?: string;
      apiKey?: string;
      baseUrl?: string;
    };

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'prompt must be a non-empty string' }, { status: 400 });
    }

    // Build model config — if user passed all three, use them. Otherwise fall back to env.
    const modelConfig = model
      ? { model, provider, apiKey: apiKey && apiKey !== '••••' ? apiKey : undefined, baseUrl }
      : undefined;

    reqLogger.debug('Classifying prompt intent', { hasActiveProject, model, provider });
    const result = await classifyIntent(prompt, hasActiveProject ?? false, modelConfig);

    if (!result.success) {
      reqLogger.warn('Classification failed', { error: result.error });
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    reqLogger.info('Classification successful', { classificationItem: result.classification });
    reqLogger.end('Request completed successfully');
    return NextResponse.json({ success: true, classification: result.classification });
  } catch (error) {
    reqLogger.error('Error during intent classification', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
