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
      // The thinking panel is non-blocking — a 422 was blocking the user's entire generation
      // flow for 60 seconds then failing visibly. Instead, synthesise a deterministic fallback
      // plan so the UI always proceeds. _fallback: true lets the client show a subtle notice.
      reqLogger.warn('Thinking plan generation failed — synthesising fallback', { error: result.error });
      const fallbackPlan: ThinkingPlan = buildFallbackPlan(prompt, intentType);
      return NextResponse.json(
        { success: true, plan: fallbackPlan, _fallback: true, _fallbackReason: result.error },
        { status: 200 },
      );
    }

    reqLogger.info('Thinking plan generated successfully');
    reqLogger.end('Request completed successfully');
    return NextResponse.json({ success: true, plan: result.plan, _fallback: false });
  } catch (error) {
    reqLogger.error('Error during thinking plan generation', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
