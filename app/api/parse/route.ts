import { NextRequest, NextResponse } from 'next/server';
import { parseIntent } from '@/lib/ai/intentParser';
import type { GenerationMode } from '@/lib/ai/componentGenerator';
import { validatePromptInput } from '@/lib/intelligence/inputValidator';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import type { ProviderName } from '@/lib/ai/types';

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

    // SECURITY: Only accept provider and model from client - NEVER apiKey or baseUrl
    const { prompt, mode, depthUi, contextId, model, provider } = body as {
      prompt: string;
      mode: GenerationMode;
      depthUi?: boolean;
      contextId?: string;
      model?: string;
      provider?: string;
    };

    // Get workspace context from session and headers
    const session = await auth();
    const userId = session?.user?.id;
    const workspaceId = request.headers.get('x-workspace-id') || 'default';

    // ─── Input Validation ──────────────────────────────────────────────────────
    // When contextId is set this is a refinement — e.g. "make it blue", "add a shadow".
    // These prompts are intentionally short and lack UI signal words, so we skip
    // the "does this look like a UI description?" heuristic and only run basic guards.
    const isRefinement = !!contextId;
    let sanitizedPrompt: string;

    if (isRefinement) {
      const trimmed = String(prompt).trim();
      if (!trimmed) {
        return NextResponse.json({ success: false, error: 'Refinement prompt cannot be empty.' }, { status: 400 });
      }
      if (trimmed.length < 2) {
        return NextResponse.json({ success: false, error: 'Refinement prompt is too short.' }, { status: 400 });
      }
      sanitizedPrompt = trimmed.substring(0, 20000).replace(/system:|assistant:|<\|.*?\|>/gi, '').trim();
    } else {
      const inputCheck = validatePromptInput(prompt);
      if (!inputCheck.valid) {
        reqLogger.warn('Input validation failed', { reason: inputCheck.reason });
        return NextResponse.json(
          { success: false, error: inputCheck.reason, suggestions: inputCheck.suggestions },
          { status: 400 }
        );
      }
      sanitizedPrompt = inputCheck.sanitized ?? String(prompt).trim();
    }

    const generationMode: GenerationMode =
      mode === 'app' ? 'app' : mode === 'depth_ui' ? 'depth_ui' : 'component';

    // Build caller model config only if the user actually supplied a model.
    // Passing undefined lets parseIntent fall through to resolveDefaultAdapter.
    const providerId = provider ? (provider as ProviderName) : undefined;
    const modelId = model || undefined;

    // FREE-TIER FAST PATH: For free-tier providers, build a local fallback intent
    // instead of calling the LLM. This saves the API call for actual generation.
    // The fallback intent is sufficient for most component generations.
    const isFreeTierProvider = provider === 'google' || provider === 'groq';
    if (isFreeTierProvider) {
      const componentName = sanitizedPrompt.trim().split(' ').slice(0, 3).map(
        (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join('').replace(/[^a-zA-Z0-9]/g, '') || 'GeneratedComponent';
      const fallbackIntent = {
        componentType: generationMode === 'app' ? 'app' : generationMode === 'depth_ui' ? 'depth_ui' : 'component',
        componentName,
        description: sanitizedPrompt.trim().substring(0, 200),
        fields: [],
        layout: { type: 'single-column', maxWidth: 'lg', alignment: 'center' },
        interactions: [],
        theme: { variant: 'default', size: 'md' },
        a11yRequired: ['keyboard navigation', 'aria-labels'],
        semanticElements: ['main', 'section'],
        isRefinement: !!contextId,
        ...(generationMode === 'app' ? {
          appType: 'web-app',
          screens: [{ name: 'Home', description: 'Main screen', isDefault: true }],
          colorScheme: { primary: '#6366f1', background: '#0f172a', surface: '#1e293b', text: '#f1f5f9' },
          features: [], navStyle: 'sidebar',
        } : {}),
      };
      const { UIIntentSchema, AppIntentSchema, DepthUIIntentSchema } = await import('@/lib/validation/schemas');
      const schema = generationMode === 'app' ? AppIntentSchema : generationMode === 'depth_ui' ? DepthUIIntentSchema : UIIntentSchema;
      const validation = schema.safeParse(fallbackIntent);
      if (validation.success) {
        reqLogger.info('Free-tier provider detected — using local intent (no API call)', { provider });
        return NextResponse.json({ success: true, intent: depthUi ? { ...validation.data, depthUi: true } : validation.data });
      }
      // If validation fails, fall through to LLM parse
    }

    reqLogger.debug('Parsing intent', { 
      mode: generationMode, 
      model: modelId ?? 'env-resolved',
      provider: providerId ?? 'env-resolved',
      workspaceId 
    });
    
    const result = await parseIntent(
      sanitizedPrompt,
      generationMode,
      typeof contextId === 'string' ? contextId : undefined,
      providerId,
      modelId,
      workspaceId,
      userId,
    );

    if (!result.success) {
      reqLogger.warn('Intent parsing failed', {
        error: result.error,
        // Log raw AI response (truncated) for debugging — Vercel filesystem is read-only
        // so we cannot write to disk. Use Vercel log drains to capture full responses.
        rawPreview: result.rawResponse ? result.rawResponse.slice(0, 500) : undefined,
      });
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 422 }
      );
    }

    reqLogger.info('Intent parsed successfully', { intentName: result.intent?.componentName });
    reqLogger.end('Request completed successfully');

    return NextResponse.json({
      success: true,
      intent: depthUi ? { ...(result.intent as object), depthUi: true } : result.intent,
    });
  } catch (error) {
    reqLogger.error('Unexpected error during intent parsing', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
