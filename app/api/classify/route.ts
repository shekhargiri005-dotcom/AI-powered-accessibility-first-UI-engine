import { NextRequest, NextResponse } from 'next/server';
import { classifyIntent, buildLocalClassification } from '@/lib/ai/intentClassifier';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import type { ProviderName } from '@/lib/ai/types';

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

    // SECURITY: Only accept provider and model from client - NEVER apiKey or baseUrl
    const { prompt, hasActiveProject, model, provider } = body as {
      prompt: string;
      hasActiveProject?: boolean;
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

    const providerId = provider ? (provider as ProviderName) : undefined;
    const modelId = model || undefined;

    // FREE-TIER FAST PATH: Skip LLM classify for free-tier providers.
    // Google/Groq free tiers have ~15-30 RPM — classify is a "nice to have"
    // that can be done locally, saving the API call for the actual generation.
    const isFreeTierProvider = provider === 'google' || provider === 'groq';
    if (isFreeTierProvider) {
      const localResult = buildLocalClassification(prompt, hasActiveProject ?? false);
      reqLogger.info('Free-tier provider detected — using local classification (no API call)', { provider });
      return NextResponse.json({ success: true, classification: localResult, _fallback: true });
    }

    reqLogger.info('Classifying prompt intent', { 
      hasActiveProject, 
      model: modelId ?? 'not-provided', 
      provider: providerId ?? 'not-provided',
      workspaceId,
      rawProvider: provider,
      rawModel: model
    });
    
    const result = await classifyIntent(
      prompt, 
      hasActiveProject ?? false, 
      providerId,
      modelId,
      workspaceId,
      userId
    );

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
