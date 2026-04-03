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

    const { prompt, hasActiveProject, model } = body as { prompt: string; hasActiveProject?: boolean; model?: string };

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'prompt must be a non-empty string' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      reqLogger.warn('OPENAI_API_KEY not configured. Falling back to local classifier if available.');
    }

    reqLogger.debug('Classifying prompt intent', { hasActiveProject, model });
    const result = await classifyIntent(prompt, hasActiveProject ?? false, model);

    if (!result.success) {
      reqLogger.warn('Classification failed', { error: result.error });
      return NextResponse.json({ success: false, error: result.error }, { status: 422 });
    }

    reqLogger.info('Classification successful', { classificationItem: result.classification });
    reqLogger.end('Request completed successfully');
    return NextResponse.json({ success: true, classification: result.classification });
  } catch (error) {
    reqLogger.error('Error during intent classification', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
