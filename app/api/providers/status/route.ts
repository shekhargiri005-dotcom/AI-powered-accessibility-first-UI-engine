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

export const PROVIDER_SETTINGS: Record<string, ProviderSettings> = {
  openai: {
    temperature: 0.6,
    maxTokens: 4096,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  anthropic: {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.9,
  },
  google: {
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1,
  },
  groq: {
    temperature: 0.5,
    maxTokens: 4096,
    topP: 1,
  },
  ollama: {
    temperature: 0.8,
    maxTokens: 2048,
    topP: 0.9,
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
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'],
    recommended: true,
    settings: PROVIDER_SETTINGS.openai,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet, Claude 3 Opus',
    color: 'text-amber-400',
    gradient: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
    bgColor: 'bg-amber-500',
    envVar: 'ANTHROPIC_API_KEY',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-5-haiku-20241022'],
    settings: PROVIDER_SETTINGS.anthropic,
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
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Run models locally on your machine',
    color: 'text-gray-300',
    gradient: 'from-gray-500/20 to-gray-400/20 border-gray-500/30',
    bgColor: 'bg-gray-500',
    envVar: 'OLLAMA_API_KEY',
    models: ['llama3', 'mistral', 'codellama', 'custom'],
    settings: PROVIDER_SETTINGS.ollama,
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
  models: string[];
  recommended?: boolean;
  settings?: ProviderSettings;
}

// ─── GET — return provider status (which ones have env vars configured) ───────

export async function GET() {
  // Prevent caching - check env vars at runtime
  unstable_noStore();
  
  try {
    // Check for universal LLM_KEY that works for all providers
    const universalKey = process.env.LLM_KEY;
    const hasUniversalKey = !!universalKey;
    
    // Debug: Log all available env var keys (without values for security)
    const allEnvKeys = Object.keys(process.env).filter(key => 
      key.includes('API_KEY') || key === 'LLM_KEY'
    );
    console.log('[providers/status] Available env vars:', allEnvKeys);
    console.log('[providers/status] Universal LLM_KEY present:', hasUniversalKey);

    const providers: ProviderStatus[] = PROVIDER_CONFIG.map((provider) => {
      // Check if provider is configured via env var
      let configured = false;
      let debugInfo: Record<string, boolean> = {};
      
      // Check primary env var
      const primaryKey = provider.envVar ? process.env[provider.envVar] : undefined;
      // Check alternate env var (for Google which has GEMINI_API_KEY as fallback)
      const altKey = 'envVarAlt' in provider && provider.envVarAlt 
        ? process.env[provider.envVarAlt] 
        : undefined;
      
      // Provider is configured if: specific key exists OR universal LLM_KEY exists
      configured = !!(primaryKey || altKey || hasUniversalKey);
      
      // Debug logging
      if (provider.envVar) {
        debugInfo[provider.envVar] = !!primaryKey;
      }
      if ('envVarAlt' in provider && provider.envVarAlt) {
        debugInfo[provider.envVarAlt] = !!altKey;
      }
      debugInfo['LLM_KEY'] = hasUniversalKey;
      console.log(`[providers/status] ${provider.id}:`, debugInfo, 'configured:', configured);

      return {
        id: provider.id,
        name: provider.name,
        description: provider.description,
        color: provider.color,
        gradient: provider.gradient,
        bgColor: provider.bgColor,
        configured,
        models: provider.models,
        recommended: provider.recommended,
        settings: provider.settings,
      };
    });

    const configuredCount = providers.filter(p => p.configured).length;
    console.log(`[providers/status] Total configured: ${configuredCount}/${providers.length}`);

    return NextResponse.json({
      success: true,
      providers,
      configuredCount,
      // Debug info (only in development)
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          availableEnvVars: allEnvKeys,
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
