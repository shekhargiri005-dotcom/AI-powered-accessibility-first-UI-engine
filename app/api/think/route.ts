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

    const { prompt, intentType, projectContext, model } = body as {
      prompt: string;
      intentType: IntentType;
      projectContext?: { componentName?: string; files?: string[] };
      model?: string;
    };

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'prompt must be a non-empty string' }, { status: 400 });
    }

    // In a privacy-first local setup, we allow the thinking engine to fail over 
    // or use a local provider if the key is missing.
    if (!process.env.OPENAI_API_KEY) {
      reqLogger.warn('OPENAI_API_KEY not configured. Local thinking might be restricted.');
    }

    reqLogger.debug('Generating thinking plan', { intentType, model });
    const result = await generateThinkingPlan(prompt, intentType, projectContext, model);

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
