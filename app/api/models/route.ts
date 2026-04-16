import { NextResponse, NextRequest } from 'next/server';
import { getWorkspaceApiKey } from '@/lib/security/workspaceKeyService';

export const maxDuration = 15; // model listing should be fast

// ─── Model shape returned to the client ──────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  isFeatured?: boolean;  // pin recommended models to the top
}

// ─── Per-provider model fetchers ─────────────────────────────────────────────

async function fetchOpenAIModels(apiKey: string, baseUrl = 'https://api.openai.com/v1'): Promise<ModelInfo[]> {
  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`OpenAI /v1/models → HTTP ${res.status}`);
  const data = await res.json();
  const models: { id: string; created?: number }[] = data.data ?? [];
  // Keep only chat models; sort newest first
  const chatIds = models
    .filter((m) =>
      /^(gpt-4|gpt-3\.5|o1|o3|chatgpt|gpt-4o)/.test(m.id) &&
      !m.id.includes('instruct') && !m.id.includes('vision') && !m.id.includes('similarity'),
    )
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0));

  const FEATURED = ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1', 'gpt-4-turbo'];
  return chatIds.map((m) => ({
    id: m.id,
    name: m.id,
    isFeatured: FEATURED.some((f) => m.id === f),
  }));
}

async function fetchAnthropicModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Anthropic /v1/models → HTTP ${res.status}`);
  const data = await res.json();
  const models: { id: string; display_name?: string }[] = data.data ?? [];
  const FEATURED = ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'];
  return models.map((m) => ({
    id: m.id,
    name: m.display_name ?? m.id,
    isFeatured: FEATURED.includes(m.id),
  }));
}

async function fetchGoogleModels(apiKey: string): Promise<ModelInfo[]> {
  const cleanKey = apiKey?.trim() ?? '';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google /v1beta/models → HTTP ${res.status} ${errText}`);
  }
  const data = await res.json();
  const models: { name: string; displayName?: string; inputTokenLimit?: number }[] = data.models ?? [];
  const FEATURED = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
  return models
    .filter((m) => m.name.includes('gemini'))
    .map((m) => {
      const id = m.name.replace('models/', '');
      return {
        id,
        name: m.displayName ?? id,
        contextWindow: m.inputTokenLimit,
        isFeatured: FEATURED.some((f) => id.startsWith(f)),
      };
    });
}

async function fetchGroqModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 401) throw new Error('AUTH_INVALID:Groq API key is invalid or expired. Add a valid GROQ_API_KEY in Vercel → Settings → Environment Variables.');
  if (!res.ok) throw new Error(`Groq /v1/models → HTTP ${res.status}`);
  const data = await res.json();
  const models: { id: string; context_window?: number }[] = data.data ?? [];
  const FEATURED = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'];
  return models.map((m) => ({
    id: m.id,
    name: m.id,
    contextWindow: m.context_window,
    isFeatured: FEATURED.includes(m.id),
  }));
}

async function fetchOllamaModels(baseUrl = 'http://localhost:11434'): Promise<ModelInfo[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models: { name: string; details?: { parameter_size?: string } }[] = data.models ?? [];
    return models.map((m) => ({
      id: m.name,
      name: `${m.name}${m.details?.parameter_size ? ` (${m.details.parameter_size})` : ''}`,
    }));
  } catch {
    // Fallback if Vercel can't reach localhost or Ollama is offline
    return [
      { id: 'llama3.3:latest', name: 'llama3.3:latest', isFeatured: true },
      { id: 'qwen2.5-coder:14b', name: 'qwen2.5-coder:14b', isFeatured: true },
      { id: 'llama3:latest', name: 'llama3:latest' },
      { id: 'mistral:latest', name: 'mistral:latest' },
      { id: 'phi3:mini', name: 'phi3:mini' },
    ];
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = (searchParams.get('provider') ?? '').toLowerCase();
  const apiKey   = searchParams.get('apiKey') ?? '';
  const baseUrl  = searchParams.get('baseUrl') ?? '';

  if (!provider) {
    return NextResponse.json({ success: false, error: 'provider query param required' }, { status: 400 });
  }

  /**
   * Resolve the API key: client-supplied → DB-stored → env var.
   * Returns null if none found.
   */
  async function resolveKey(clientKey: string, providerEnvKeys: (string | undefined)[]): Promise<string | null> {
    const clean = clientKey && clientKey !== '••••' && clientKey !== 'ENV_FALLBACK' ? clientKey.trim() : '';
    if (clean) return clean;
    // DB lookup (reads encrypted key saved via /api/engine-config)
    const dbKey = await getWorkspaceApiKey(provider).catch(() => null);
    if (dbKey) return dbKey;
    // Env var fallbacks
    for (const k of providerEnvKeys) { if (k) return k; }
    return null;
  }

  const STATIC_FALLBACKS: Record<string, ModelInfo[]> = {
    openai: [
      { id: 'gpt-4o', name: 'gpt-4o (Cloud Optimized)', isFeatured: true },
      { id: 'gpt-4o-mini', name: 'gpt-4o-mini (Faster)', isFeatured: true },
      { id: 'o3-mini', name: 'o3-mini (Advanced Reasoning)', isFeatured: true },
      { id: 'o1', name: 'o1 (Complex Problem Solving)', isFeatured: true },
      { id: 'gpt-4-turbo', name: 'gpt-4-turbo' },
    ],
    anthropic: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', isFeatured: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', isFeatured: true },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    ],
    google: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', isFeatured: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', isFeatured: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    ],
    groq: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', isFeatured: true },
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    ],
  };

  try {
    let models: ModelInfo[] = [];

    switch (provider) {
      case 'openai': {
        const finalKey = await resolveKey(apiKey, [process.env.OPENAI_API_KEY]);
        if (!finalKey) {
           return NextResponse.json({ success: true, models: STATIC_FALLBACKS.openai });
        }
        try {
          models = await fetchOpenAIModels(finalKey, baseUrl || undefined);
        } catch {
          models = STATIC_FALLBACKS.openai;
        }
        break;
      }

      case 'anthropic': {
        const finalKey = await resolveKey(apiKey, [process.env.ANTHROPIC_API_KEY]);
        if (!finalKey) {
          return NextResponse.json({ success: true, models: STATIC_FALLBACKS.anthropic });
        }
        try {
          models = await fetchAnthropicModels(finalKey);
        } catch {
          models = STATIC_FALLBACKS.anthropic;
        }
        break;
      }

      case 'google': {
        const finalKey = await resolveKey(apiKey, [process.env.GOOGLE_API_KEY, process.env.GEMINI_API_KEY]);
        if (!finalKey) {
          return NextResponse.json({ success: true, models: STATIC_FALLBACKS.google });
        }
        try {
          models = await fetchGoogleModels(finalKey);
        } catch {
          models = STATIC_FALLBACKS.google;
        }
        break;
      }

      case 'groq': {
        const finalKey = await resolveKey(apiKey, [process.env.GROQ_API_KEY]);
        if (!finalKey) {
          return NextResponse.json({ success: true, models: STATIC_FALLBACKS.groq });
        }
        try {
          models = await fetchGroqModels(finalKey);
        } catch {
          models = STATIC_FALLBACKS.groq;
        }
        break;
      }

      case 'ollama':
      case 'lmstudio': {
        const ollamaBase = baseUrl || (provider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434');
        models = await fetchOllamaModels(ollamaBase);
        break;
      }

      // Generic OpenAI-compat: try /v1/models with the provided baseUrl
      default: {
        if (!baseUrl) return NextResponse.json({ success: false, error: 'baseUrl required for custom providers' }, { status: 400 });
        const finalKey = await resolveKey(apiKey, [process.env.OPENAI_API_KEY, 'dummy']);

        models = await fetchOpenAIModels(finalKey ?? 'dummy', baseUrl);
        break;
      }
    }

    // Sort: featured first, then alphabetical
    models.sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return a.id.localeCompare(b.id);
    });

    return NextResponse.json({ success: true, models, count: models.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[/api/models] provider=${provider} error:`, msg);
    // Surface auth failures with a distinct 401 so the client can show the right error state
    const isAuthError = msg.startsWith('AUTH_INVALID:');
    const cleanMsg = isAuthError ? msg.replace('AUTH_INVALID:', '') : `Failed to fetch models: ${msg}`;
    return NextResponse.json(
      { success: false, error: cleanMsg, authError: isAuthError },
      { status: isAuthError ? 401 : 400 },
    );
  }
}
