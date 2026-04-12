import { NextRequest, NextResponse } from 'next/server';
import { generateThinkingPlan, buildFallbackPlan } from '@/lib/ai/thinkingEngine';
import type { IntentType, ThinkingPlan } from '@/lib/validation/schemas';
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

    const { prompt, intentType, projectContext, model, provider, apiKey, baseUrl } = body as {
      prompt: string;
      intentType: IntentType;
      projectContext?: { componentName?: string; files?: string[] };
      model?: string;
      provider?: string;
      apiKey?: string;
      baseUrl?: string;
    };

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'prompt must be a non-empty string' }, { status: 400 });
    }

    const modelConfig = model
      ? { model, provider, apiKey: apiKey && apiKey !== '••••' ? apiKey : undefined, baseUrl }
      : undefined;

    reqLogger.debug('Generating thinking plan', { intentType, model, provider });
    const result = await generateThinkingPlan(prompt, intentType, projectContext, modelConfig);

    if (!result.success) {
      reqLogger.warn('Thinking plan generation failed — returning deterministic fallback plan', { error: result.error });
      // BUG-08 FIX: Never return a 400 — the UI can always show a fallback plan
      // and the user can still proceed to code generation.
      const fallback = buildFallbackPlan(prompt, intentType);
      reqLogger.end('Request completed with fallback plan');
      return NextResponse.json({ success: true, plan: fallback, _fallback: true });
    }

    reqLogger.info('Thinking plan generated successfully');
    reqLogger.end('Request completed successfully');
    return NextResponse.json({ success: true, plan: result.plan, _fallback: false });
  } catch (error) {
    reqLogger.error('Error during thinking plan generation', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
