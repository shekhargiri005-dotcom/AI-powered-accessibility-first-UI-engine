import { NextRequest, NextResponse } from 'next/server';
import { generateThinkingPlan } from '@/lib/ai/thinkingEngine';
import type { IntentType } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const reqLogger = logger.createRequestLogger('/api/think');
  reqLogger.info('Received thinking plan request');

  try {
    let body: unknown;
    try { body = await request.json(); } catch {
      reqLogger.warn('Invalid JSON in request body');
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || !('prompt' in body) || !('intentType' in body)) {
      return NextResponse.json({ success: false, error: 'Missing fields: prompt, intentType' }, { status: 400 });
    }

    const { prompt, intentType, projectContext } = body as {
      prompt: string;
      intentType: IntentType;
      projectContext?: { componentName?: string; files?: string[] };
    };

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'prompt must be a non-empty string' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ success: false, error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    reqLogger.debug('Generating thinking plan', { intentType });
    const result = await generateThinkingPlan(prompt, intentType, projectContext);

    if (!result.success) {
      reqLogger.warn('Thinking plan generation failed', { error: result.error });
      return NextResponse.json({ success: false, error: result.error }, { status: 422 });
    }

    reqLogger.info('Thinking plan generated successfully');
    reqLogger.end('Request completed successfully');
    return NextResponse.json({ success: true, plan: result.plan });
  } catch (error) {
    reqLogger.error('Error during thinking plan generation', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
