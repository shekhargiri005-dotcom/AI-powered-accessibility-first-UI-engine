import { NextRequest, NextResponse } from 'next/server';
import { generateThinkingPlan, buildFallbackPlan } from '@/lib/ai/thinkingEngine';
import type { IntentType, ThinkingPlan } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import type { ProviderName } from '@/lib/ai/types';

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

    // SECURITY: Only accept provider and model from client - NEVER apiKey or baseUrl
    const { prompt, intentType, projectContext, model, provider } = body as {
      prompt: string;
      intentType: IntentType;
      projectContext?: { componentName?: string; files?: string[] };
      model?: string;
      provider?: string;
    };

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'prompt must be a non-empty string' }, { status: 400 });
    }

    // Get workspace context from session and headers
    const session = await auth();
    const userId = session?.user?.id;
    const workspaceId = request.headers.get('x-workspace-id') || 'default';

    // Build caller model config only if the user actually supplied a model
    const providerId = provider ? (provider as ProviderName) : undefined;
    const modelId = model || undefined;

    // FREE-TIER FAST PATH: Skip LLM think for free-tier providers.
    // The thinking plan is a "nice to have" enrichment — deterministic fallback
    // works well enough and saves the API call for actual code generation.
    const isFreeTierProvider = provider === 'google' || provider === 'groq';
    if (isFreeTierProvider) {
      const fallback = buildFallbackPlan(prompt, intentType);
      reqLogger.info('Free-tier provider detected — using local thinking plan (no API call)', { provider });
      return NextResponse.json({ success: true, plan: fallback, _fallback: true });
    }

    reqLogger.info('Generating thinking plan', { 
      intentType, 
      model: modelId ?? 'not-provided', 
      provider: providerId ?? 'not-provided',
      workspaceId,
      rawProvider: provider,
      rawModel: model
    });
    
    const result = await generateThinkingPlan(
      prompt, 
      intentType, 
      projectContext, 
      providerId,
      modelId,
      workspaceId,
      userId,
    );

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
