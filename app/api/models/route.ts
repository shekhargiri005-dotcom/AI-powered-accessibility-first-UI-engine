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

async function fetchOpenRouterModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`OpenRouter /api/v1/models → HTTP ${res.status}`);
  const data = await res.json();
  const models: { id: string; name?: string; context_length?: number }[] = data.data ?? [];
  const FEATURED = [
    'openai/gpt-4o', 'openai/gpt-4o-mini',
    'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash-001',
    'meta-llama/llama-3.3-70b-instruct',
  ];
  return models.map((m) => ({
    id: m.id,
    name: m.name ?? m.id,
    contextWindow: m.context_length,
    isFeatured: FEATURED.includes(m.id),
  }));
}

async function fetchTogetherModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://api.together.xyz/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Together /v1/models → HTTP ${res.status}`);
  const data = await res.json();
  // Together returns an array directly (no .data wrapper)
  const models: { id: string; display_name?: string; context_length?: number; type?: string }[] =
    Array.isArray(data) ? data : (data.data ?? []);
  const FEATURED = [
    'meta-llama/Llama-3-70b-chat-hf',
    'meta-llama/Llama-3-8b-chat-hf',
    'mistralai/Mixtral-8x22B-Instruct-v0.1',
  ];
  return models
    .filter((m) => !m.type || m.type === 'chat')
    .map((m) => ({
      id: m.id,
      name: m.display_name ?? m.id,
      contextWindow: m.context_length,
      isFeatured: FEATURED.includes(m.id),
    }));
}

async function fetchDeepSeekModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://api.deepseek.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`DeepSeek /v1/models → HTTP ${res.status}`);
  const data = await res.json();
  const models: { id: string }[] = data.data ?? [];
  const FEATURED = ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'];
  return models.map((m) => ({
    id: m.id,
    name: m.id,
    isFeatured: FEATURED.includes(m.id),
  }));
}

async function fetchMistralModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://api.mistral.ai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Mistral /v1/models → HTTP ${res.status}`);
  const data = await res.json();
  const models: { id: string; name?: string }[] = data.data ?? [];
  const FEATURED = ['mistral-large-latest', 'mistral-medium-latest', 'codestral-latest'];
  return models.map((m) => ({
    id: m.id,
    name: m.name ?? m.id,
    isFeatured: FEATURED.includes(m.id),
  }));
}

async function fetchOllamaModels(baseUrl = 'http://localhost:11434'): Promise<ModelInfo[]> {
  const res = await fetch(`${baseUrl}/api/tags`, {
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Ollama /api/tags → HTTP ${res.status}`);
  const data = await res.json();
  const models: { name: string; details?: { parameter_size?: string } }[] = data.models ?? [];
  return models.map((m) => ({
    id: m.name,
    name: `${m.name}${m.details?.parameter_size ? ` (${m.details.parameter_size})` : ''}`,
  }));
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
    const clean = clientKey && clientKey !== '••••' ? clientKey.trim() : '';
    if (clean) return clean;
    // DB lookup (reads encrypted key saved via /api/engine-config)
    const dbKey = await getWorkspaceApiKey(provider).catch(() => null);
    if (dbKey) return dbKey;
    // Env var fallbacks
    for (const k of providerEnvKeys) { if (k) return k; }
    return null;
  }

  try {
    let models: ModelInfo[] = [];

    switch (provider) {
      case 'openai': {
        const finalKey = await resolveKey(apiKey, [process.env.OPENAI_API_KEY]);
        if (!finalKey) return NextResponse.json({ success: false, error: 'No OpenAI key found. Save one via the AI Engine Config panel.' }, { status: 400 });
        models = await fetchOpenAIModels(finalKey, baseUrl || undefined);
        break;
      }

      case 'anthropic': {
        const finalKey = await resolveKey(apiKey, [process.env.ANTHROPIC_API_KEY]);
        if (!finalKey) return NextResponse.json({ success: false, error: 'No Anthropic key found. Save one via the AI Engine Config panel.' }, { status: 400 });
        models = await fetchAnthropicModels(finalKey);
        break;
      }

      case 'google': {
        const finalKey = await resolveKey(apiKey, [process.env.GOOGLE_API_KEY, process.env.GEMINI_API_KEY]);
        if (!finalKey) return NextResponse.json({ success: false, error: 'No Google key found. Save one via the AI Engine Config panel.' }, { status: 400 });
        models = await fetchGoogleModels(finalKey);
        break;
      }

      case 'groq': {
        const finalKey = await resolveKey(apiKey, [process.env.GROQ_API_KEY]);
        if (!finalKey) return NextResponse.json({ success: false, error: 'No Groq key found. Save one via the AI Engine Config panel.' }, { status: 400 });
        models = await fetchGroqModels(finalKey);
        break;
      }

      case 'openrouter': {
        const finalKey = await resolveKey(apiKey, [process.env.OPENROUTER_API_KEY]);
        if (!finalKey) return NextResponse.json({ success: false, error: 'No OpenRouter key found. Save one via the AI Engine Config panel.' }, { status: 400 });
        models = await fetchOpenRouterModels(finalKey);
        break;
      }

      case 'together': {
        const finalKey = await resolveKey(apiKey, [process.env.TOGETHER_API_KEY]);
        if (!finalKey) return NextResponse.json({ success: false, error: 'No Together AI key found. Save one via the AI Engine Config panel.' }, { status: 400 });
        models = await fetchTogetherModels(finalKey);
        break;
      }

      case 'deepseek': {
        const finalKey = await resolveKey(apiKey, [process.env.DEEPSEEK_API_KEY]);
        if (!finalKey) return NextResponse.json({ success: false, error: 'No DeepSeek key found. Save one via the AI Engine Config panel.' }, { status: 400 });
        models = await fetchDeepSeekModels(finalKey);
        break;
      }

      case 'mistral': {
        const finalKey = await resolveKey(apiKey, [process.env.MISTRAL_API_KEY, process.env.TOGETHER_API_KEY]);
        if (!finalKey) return NextResponse.json({ success: false, error: 'No Mistral key found. Save one via the AI Engine Config panel.' }, { status: 400 });
        models = await fetchMistralModels(finalKey);
        break;
      }

      case 'meta': {
        const finalKey = await resolveKey(apiKey, [process.env.TOGETHER_API_KEY, process.env.GROQ_API_KEY]);
        if (!finalKey) return NextResponse.json({ success: false, error: 'No Meta/Llama key found. Save one via the AI Engine Config panel.' }, { status: 400 });
        models = await fetchOpenAIModels(finalKey, baseUrl || 'https://api.together.xyz/v1');
        break;
      }

      case 'qwen': {
        const finalKey = await resolveKey(apiKey, [process.env.DASHSCOPE_API_KEY, process.env.TOGETHER_API_KEY]);
        if (!finalKey) return NextResponse.json({ success: false, error: 'No Qwen key found. Save one via the AI Engine Config panel.' }, { status: 400 });
        models = await fetchOpenAIModels(finalKey, baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1');
        break;
      }

      case 'gemma': {
        const finalKey = await resolveKey(apiKey, [process.env.TOGETHER_API_KEY, process.env.GROQ_API_KEY]);
        if (!finalKey) return NextResponse.json({ success: false, error: 'No Gemma key found. Save one via the AI Engine Config panel.' }, { status: 400 });
        models = await fetchOpenAIModels(finalKey, baseUrl || 'https://api.together.xyz/v1');
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

        models = await fetchOpenAIModels(finalKey, baseUrl);
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
