import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAdapter, ConfigurationError } from '@/lib/ai/adapters/index';
import { resolveDefaultAdapter } from '@/lib/ai/resolveDefaultAdapter';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import type { ProviderName } from '@/lib/ai/types';

export const maxDuration = 30;

const SUGGESTIONS_SYSTEM_PROMPT = `You are a world-class Senior UI/UX Designer with expertise in React and Tailwind CSS.
You review generated React component code and suggest targeted, actionable aesthetic improvements.

Your suggestions must be:
- Short: max 12 words each
- Actionable: phrased as an instruction (e.g. "Add a glowing gradient to the hero title")
- Specific: reference actual elements visible in the code
- Focused on: visual aesthetics, micro-animations, spacing, color vibrancy, typography, or accessibility

Return ONLY a valid JSON array of exactly 3 suggestion strings. No markdown, no explanation, no preamble.
Example: ["Add a gradient overlay to the hero background", "Animate card entrance with fade-in on scroll", "Increase heading font weight to font-black"]`;

export async function POST(request: NextRequest) {
  const reqLogger = logger.createRequestLogger('/api/suggestions');

  try {
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Request body required' }, { status: 400 });
    }

    // SECURITY: Only accept provider and model from client - NEVER apiKey or baseUrl
    const { componentName, codeSnippet, intentDescription, model, provider } = body as {
      componentName?: string;
      codeSnippet?: string;
      intentDescription?: string;
      model?: string;
      provider?: string;
    };

    if (!codeSnippet || typeof codeSnippet !== 'string' || codeSnippet.trim().length < 50) {
      return NextResponse.json({ success: false, error: 'codeSnippet required (min 50 chars)' }, { status: 400 });
    }

    // Get workspace context from session and headers
    const session = await auth();
    const userId = session?.user?.id;
    const workspaceId = request.headers.get('x-workspace-id') || 'default';

    // Resolve adapter using server-side credential resolution
    const providerId = (provider || 'openai') as ProviderName;
    const modelId = model || resolveDefaultAdapter('THINKING').model;

    const adapter = await getWorkspaceAdapter(providerId, modelId, workspaceId, userId);

    const userPrompt = `Component: "${componentName ?? 'Unknown'}"
${intentDescription ? `Original Goal: "${intentDescription}"\n` : ''}
CODE (first 2000 chars):
${codeSnippet.slice(0, 2000)}

Suggest exactly 3 specific, targeted UI improvements. Return ONLY a JSON array of 3 strings.`;

    reqLogger.info('Generating suggestions', { componentName, model: modelId, provider: providerId });

    const result = await adapter.generate({
      model: modelId,
      messages: [
        { role: 'system', content: SUGGESTIONS_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 300,
    });

    const raw = result.content ?? '';

    // Extract JSON array from response (handle models that wrap in prose)
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) {
      reqLogger.warn('Suggestions: model did not return a JSON array', { raw: raw.slice(0, 200) });
      return NextResponse.json({ success: true, suggestions: [] });
    }

    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(match[0]) as unknown[];
      suggestions = parsed
        .filter((s): s is string => typeof s === 'string' && s.length > 5)
        .slice(0, 3);
    } catch {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    reqLogger.end('Suggestions generated', { count: suggestions.length });
    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    reqLogger.error('Suggestions generation failed', error);
    
    // Handle configuration errors gracefully
    if (error instanceof ConfigurationError) {
      return NextResponse.json({ 
        success: true, 
        suggestions: [],
        warning: 'AI provider not configured'
      });
    }
    
    // Always return 200 — suggestions are non-blocking
    return NextResponse.json({ success: true, suggestions: [] });
  }
}
