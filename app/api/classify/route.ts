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
      // 'No model configured' is an expected state before the user sets up AI Engine.
      // Log as debug, not warn, to avoid console noise on first load.
      reqLogger.debug('Classification could not run', { error: result.error });
      // Return a graceful 200 with a default classification so the UI isn't blocked.
      return NextResponse.json({
        success: true,
        classification: {
          intentType: 'ui_generation',
          confidence: 0.5,
          summary: 'Auto-classified — configure an AI provider to enable smart intent detection.',
          suggestedMode: 'component',
          needsClarification: false,
          shouldGenerateCode: true,
          purpose: 'unknown',
          visualType: 'unknown',
          complexity: 'medium',
          platform: 'responsive',
          layout: 'single-page',
          motionLevel: 'subtle',
          preferredStack: ['react', 'tailwind'],
        },
        _fallback: true,
      });
    }

    reqLogger.info('Classification successful', { classificationItem: result.classification });
    reqLogger.end('Request completed successfully');
    return NextResponse.json({ success: true, classification: result.classification });
  } catch (error) {
    reqLogger.error('Error during intent classification', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
