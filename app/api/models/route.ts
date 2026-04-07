import { NextResponse, NextRequest } from 'next/server';

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
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error(`Google /v1beta/models → HTTP ${res.status}`);
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

/** Curated list of popular HuggingFace Inference API models (Hub search is too broad to page through live) */
function getHuggingFaceModels(): ModelInfo[] {
  return [
    { id: 'meta-llama/Meta-Llama-3-8B-Instruct',    name: 'Llama 3 8B Instruct',            contextWindow: 8192,   isFeatured: true  },
    { id: 'meta-llama/Meta-Llama-3-70B-Instruct',   name: 'Llama 3 70B Instruct',           contextWindow: 8192,   isFeatured: true  },
    { id: 'meta-llama/Llama-3.1-8B-Instruct',       name: 'Llama 3.1 8B Instruct',          contextWindow: 131072, isFeatured: true  },
    { id: 'meta-llama/Llama-3.1-70B-Instruct',      name: 'Llama 3.1 70B Instruct',         contextWindow: 131072, isFeatured: true  },
    { id: 'meta-llama/Llama-3.2-3B-Instruct',       name: 'Llama 3.2 3B Instruct',          contextWindow: 131072                     },
    { id: 'meta-llama/Llama-3.3-70B-Instruct',      name: 'Llama 3.3 70B Instruct',         contextWindow: 131072, isFeatured: true  },
    { id: 'mistralai/Mistral-7B-Instruct-v0.3',     name: 'Mistral 7B Instruct v0.3',       contextWindow: 32768                     },
    { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',   name: 'Mixtral 8x7B Instruct',          contextWindow: 32768, isFeatured: true  },
    { id: 'Qwen/Qwen2.5-72B-Instruct',              name: 'Qwen 2.5 72B Instruct',          contextWindow: 131072, isFeatured: true  },
    { id: 'Qwen/Qwen2.5-Coder-32B-Instruct',        name: 'Qwen 2.5 Coder 32B',             contextWindow: 131072, isFeatured: true  },
    { id: 'microsoft/Phi-3.5-mini-instruct',         name: 'Phi 3.5 Mini Instruct',          contextWindow: 131072                    },
    { id: 'microsoft/Phi-3-medium-4k-instruct',      name: 'Phi 3 Medium 4k',                contextWindow: 4096                      },
    { id: 'google/gemma-2-9b-it',                    name: 'Gemma 2 9B IT',                  contextWindow: 8192                      },
    { id: 'google/gemma-2-27b-it',                   name: 'Gemma 2 27B IT',                 contextWindow: 8192                      },
    { id: 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B', name: 'DeepSeek R1 Distill Llama 70B', contextWindow: 131072, isFeatured: true },
    { id: 'deepseek-ai/DeepSeek-V2.5',              name: 'DeepSeek V2.5',                  contextWindow: 131072                    },
    { id: 'NousResearch/Hermes-3-Llama-3.1-8B',     name: 'Hermes 3 Llama 3.1 8B',          contextWindow: 131072                    },
    { id: 'HuggingFaceH4/zephyr-7b-beta',           name: 'Zephyr 7B Beta',                 contextWindow: 32768                     },
  ];
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

  try {
    let models: ModelInfo[] = [];

    switch (provider) {
      case 'openai':
        if (!apiKey) return NextResponse.json({ success: false, error: 'apiKey required for OpenAI' }, { status: 400 });
        models = await fetchOpenAIModels(apiKey, baseUrl || undefined);
        break;

      case 'anthropic':
        if (!apiKey) return NextResponse.json({ success: false, error: 'apiKey required for Anthropic' }, { status: 400 });
        models = await fetchAnthropicModels(apiKey);
        break;

      case 'google':
        if (!apiKey) return NextResponse.json({ success: false, error: 'apiKey required for Google' }, { status: 400 });
        models = await fetchGoogleModels(apiKey);
        break;

      case 'groq':
        if (!apiKey) return NextResponse.json({ success: false, error: 'apiKey required for Groq' }, { status: 400 });
        models = await fetchGroqModels(apiKey);
        break;

      case 'openrouter':
        if (!apiKey) return NextResponse.json({ success: false, error: 'apiKey required for OpenRouter' }, { status: 400 });
        models = await fetchOpenRouterModels(apiKey);
        break;

      case 'together':
        if (!apiKey) return NextResponse.json({ success: false, error: 'apiKey required for Together AI' }, { status: 400 });
        models = await fetchTogetherModels(apiKey);
        break;

      case 'deepseek':
        if (!apiKey) return NextResponse.json({ success: false, error: 'apiKey required for DeepSeek' }, { status: 400 });
        models = await fetchDeepSeekModels(apiKey);
        break;

      case 'mistral':
        if (!apiKey) return NextResponse.json({ success: false, error: 'apiKey required for Mistral' }, { status: 400 });
        models = await fetchMistralModels(apiKey);
        break;

      case 'huggingface':
        // HuggingFace returns a curated list — no live API call needed for model listing
        models = getHuggingFaceModels();
        break;

      case 'ollama':
      case 'lmstudio': {
        const ollamaBase = baseUrl || (provider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434');
        models = await fetchOllamaModels(ollamaBase);
        break;
      }

      // Generic OpenAI-compat: try /v1/models with the provided baseUrl
      default:
        if (!baseUrl) return NextResponse.json({ success: false, error: 'baseUrl required for custom providers' }, { status: 400 });
        models = await fetchOpenAIModels(apiKey, baseUrl);
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
    return NextResponse.json(
      { success: false, error: `Failed to fetch models: ${msg}` },
      { status: 502 },
    );
  }
}
