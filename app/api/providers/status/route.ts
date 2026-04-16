/**
 * @file app/api/providers/status/route.ts
 *
 * GET /api/providers/status → returns which providers have API keys configured
 * in environment variables (Vercel env vars)
 *
 * This allows the UI to show only the adapters the user has configured.
 */

import { NextResponse } from 'next/server';

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
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Run models locally on your machine',
    color: 'text-gray-300',
    gradient: 'from-gray-500/20 to-gray-400/20 border-gray-500/30',
    bgColor: 'bg-gray-500',
    envVar: null, // No API key needed
    models: ['llama3', 'mistral', 'codellama', 'custom'],
    localOnly: true,
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
  localOnly?: boolean;
}

// ─── GET — return provider status (which ones have env vars configured) ───────

export async function GET() {
  try {
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

    const providers: ProviderStatus[] = PROVIDER_CONFIG.map((provider) => {
      // Check if provider is configured via env var
      let configured = false;
      
      if (provider.localOnly) {
        // Ollama is only configured if NOT on Vercel (local only)
        configured = !isVercel;
      } else {
        // Check primary env var
        const primaryKey = provider.envVar ? process.env[provider.envVar] : undefined;
        // Check alternate env var (for Google which has GEMINI_API_KEY as fallback)
        const altKey = 'envVarAlt' in provider && provider.envVarAlt 
          ? process.env[provider.envVarAlt] 
          : undefined;
        
        configured = !!(primaryKey || altKey);
      }

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
        localOnly: provider.localOnly,
      };
    });

    return NextResponse.json({
      success: true,
      providers,
      // Count of configured providers (for UI display)
      configuredCount: providers.filter(p => p.configured).length,
    });
  } catch (err) {
    console.error('[providers/status GET]', err);
    return NextResponse.json(
      { success: false, error: 'Failed to check provider status' },
      { status: 500 }
    );
  }
}
