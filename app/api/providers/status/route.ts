/**
 * @file app/api/providers/status/route.ts
 *
 * GET /api/providers/status → returns which providers have API keys configured
 * in environment variables (Vercel env vars)
 *
 * This allows the UI to show only the adapters the user have configured.
 */

import { NextResponse } from 'next/server';
import { unstable_noStore } from 'next/cache';

// Optimized settings for each provider
export interface ProviderSettings {
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

// Optimized settings for maximum creativity and aesthetic UI generation
// Higher temperatures (0.7-0.9) for creative, visually stunning components
// Max tokens: Set for full apps with depth UI (8k-16k)
export const PROVIDER_SETTINGS: Record<string, ProviderSettings> = {
  openai: {
    // GPT-4o: High temp for creative designs, 16k for full apps
    temperature: 0.85,
    maxTokens: 16384,
    topP: 0.95,
    frequencyPenalty: 0.2,
    presencePenalty: 0.2,
  },
  google: {
    // Gemini 2.0 Flash: High creativity, 16k output capacity
    temperature: 0.85,
    maxTokens: 16384,
    topP: 0.95,
  },
  groq: {
    // Groq: Balanced creativity with speed, 8k for large components
    temperature: 0.75,
    maxTokens: 8192,
    topP: 0.92,
  },
  ollama: {
    // Ollama: Self-hosted, balanced creativity, 8k context
    temperature: 0.7,
    maxTokens: 8192,
    topP: 0.92,
  },
};

// Define provider configurations with their colors matching ProviderSelector
export const PROVIDER_CONFIG = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini, o3-mini',
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
    bgColor: 'bg-emerald-500',
    envVar: 'OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1-mini'],
    recommended: true,
    settings: PROVIDER_SETTINGS.openai,
    healthEndpoint: 'https://api.openai.com/v1/models',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini 2.0 Flash, Gemini 1.5 Pro',
    color: 'text-blue-400',
    gradient: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    bgColor: 'bg-blue-500',
    envVar: 'GOOGLE_API_KEY',
    envVarAlt: 'GEMINI_API_KEY',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    settings: PROVIDER_SETTINGS.google,
    healthEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Llama 3.3, Mixtral - Ultra-fast inference',
    color: 'text-orange-400',
    gradient: 'from-orange-500/20 to-red-500/20 border-orange-500/30',
    bgColor: 'bg-orange-500',
    envVar: 'GROQ_API_KEY',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    settings: PROVIDER_SETTINGS.groq,
    healthEndpoint: 'https://api.groq.com/openai/v1/models',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Llama 3, Qwen, DeepSeek - Cloud inference via ollama.com',
    color: 'text-purple-400',
    gradient: 'from-purple-500/20 to-fuchsia-500/20 border-purple-500/30',
    bgColor: 'bg-purple-500',
    envVar: 'OLLAMA_API_KEY',
    models: ['qwen3-coder-next', 'gemma4', 'devstral-small-2', 'deepseek-v3.2', 'qwen3.5:9b'],
    settings: PROVIDER_SETTINGS.ollama,
    healthEndpoint: 'https://ollama.com/v1/models',
  },
];

export interface ProviderStatus {
  id: string;
  name: string;
  description: string;
  color: string;
  gradient: string;
  bgColor: string;
  configured: boolean;
  connected: boolean | null;  // null = not checked yet
  models: string[];
  recommended?: boolean;
  settings?: ProviderSettings;
  envVar?: string;
}

// ─── Connectivity Check ───────────────────────────────────────────────────────

/**
 * Pings a provider's /models endpoint with the API key to verify connectivity.
 * Returns true if the provider responds with 200, false otherwise.
 * Timeout: 5 seconds per provider.
 */
async function checkProviderConnectivity(
  healthEndpoint: string,
  apiKey: string,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch(healthEndpoint, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── GET — return provider status (which ones have env vars configured) ───────

export async function GET() {
  // Prevent caching - check env vars at runtime
  unstable_noStore();
  
  try {
    // Check which providers are available and their connectivity
    const providerChecks = PROVIDER_CONFIG.map(async (provider) => {
      // Check if provider is configured via specific env var
      const primaryKey = provider.envVar ? process.env[provider.envVar] : undefined;
      const altKey = 'envVarAlt' in provider && provider.envVarAlt 
        ? process.env[provider.envVarAlt] 
        : undefined;
      
      const configured = !!(primaryKey || altKey);
      const apiKey = primaryKey || altKey;
      
      // Check connectivity if configured
      let connected: boolean | null = null;
      if (configured) {
        if (apiKey && provider.healthEndpoint) {
          connected = await checkProviderConnectivity(provider.healthEndpoint, apiKey);
        }
      }

      console.log(`[providers/status] ${provider.id}: configured=${configured}, connected=${connected}`);

      return {
        id: provider.id,
        name: provider.name,
        description: provider.description,
        color: provider.color,
        gradient: provider.gradient,
        bgColor: provider.bgColor,
        configured,
        connected,
        models: provider.models,
        recommended: provider.recommended,
        settings: provider.settings,
        envVar: provider.envVar,
      };
    });

    const providers = await Promise.all(providerChecks);
    const configuredCount = providers.filter(p => p.configured).length;
    const connectedCount = providers.filter(p => p.connected === true).length;
    console.log(`[providers/status] Configured: ${configuredCount}/${providers.length}, Connected: ${connectedCount}/${configuredCount}`);

    return NextResponse.json({
      success: true,
      providers,
      configuredCount,
      connectedCount,
      // Debug info (only in development)
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          availableEnvVars: Object.keys(process.env).filter(k => k.includes('API_KEY')),
          nodeEnv: process.env.NODE_ENV,
        }
      }),
    });
  } catch (err) {
    console.error('[providers/status GET]', err);
    return NextResponse.json(
      { success: false, error: 'Failed to check provider status' },
      { status: 500 }
    );
  }
}
