import { NextRequest, NextResponse } from 'next/server';
import { parseIntent } from '@/lib/ai/intentParser';
import type { GenerationMode } from '@/lib/ai/componentGenerator';
import { validatePromptInput } from '@/lib/intelligence/inputValidator';
import { logger } from '@/lib/logger';

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

    const { prompt, mode, depthUi, contextId, model, provider, apiKey, baseUrl } = body as {
      prompt: string;
      mode: GenerationMode;
      depthUi?: boolean;
      contextId?: string;
      // User-configured model — forwarded so we honour their Ollama/cloud selection
      // rather than allowing the env-resolved adapter to silently pick up a
      // quota-exhausted OPENAI_API_KEY (or any other unintended key).
      model?: string;
      provider?: string;
      apiKey?: string;
      baseUrl?: string;
    };

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
    const modelConfig = model
      ? {
          model,
          provider,
          apiKey: apiKey && apiKey !== '••••' ? apiKey : undefined,
          baseUrl,
        }
      : undefined;

    reqLogger.debug('Parsing intent', { mode: generationMode, model: model ?? 'env-resolved' });
    const result = await parseIntent(
      sanitizedPrompt,
      generationMode,
      typeof contextId === 'string' ? contextId : undefined,
      modelConfig,
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
