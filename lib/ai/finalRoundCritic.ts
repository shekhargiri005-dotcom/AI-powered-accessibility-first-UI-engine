/**
 * @file lib/ai/finalRoundCritic.ts
 *
 * "Holy Grail" Final Round — Vision-in-the-Loop UI/UX Quality Gate
 *
 * After the generation pipeline completes and the UI renders, this module
 * submits a screenshot of the rendered UI PLUS the source code to the
 * SAME model the user selected, instructing it to act as a world-class
 * UI/UX designer performing a final aesthetic pass.
 *
 * If the model detects quality issues it returns fully repaired TSX code.
 *
 * Model routing:
 *  - OpenAI / OpenAI-compat (groq, openrouter…) → image_url content part
 *  - Google Gemini            → inline_data base64 part
 *  - Anthropic (Claude)       → base64 image source block
 *  - Everything else          → text-only fallback (no screenshot)
 *
 * All errors are caught and result in a graceful `skipped` status so the
 * pipeline never fails due to Final Round errors.
 */

import { z } from 'zod';

// ─── Result schema ─────────────────────────────────────────────────────────────

export const FinalRoundResultSchema = z.object({
  /** true = design approved, false = design was improved */
  passed:       z.boolean(),
  /** 0–100 aesthetic score */
  score:        z.number().min(0).max(100),
  /** Short human-readable verdict from the AI designer */
  critique:     z.string(),
  /** Only present when passed=false — the fully repaired TSX */
  suggestedCode: z.string().nullable().optional(),
});

export type FinalRoundResult = z.infer<typeof FinalRoundResultSchema>;

export type FinalRoundStatus =
  | 'idle'
  | 'running'
  | 'passed'
  | 'fixed'
  | 'skipped'
  | 'error';

// ─── System Prompt ─────────────────────────────────────────────────────────────

const FINAL_ROUND_SYSTEM_PROMPT = `You are a world-class Senior UI/UX Designer and Accessibility Engineer with 15+ years of experience at Apple, Figma, Linear, and the W3C Accessibility Task Force.
You are in the FINAL ROUND of an AI-powered UI generation pipeline.

Your job is quality control of the rendered interface across TWO domains:
1. AESTHETIC QUALITY — Does this look stunning and production-ready?
2. ACCESSIBILITY & REALISM — Is this genuinely usable and complete?

JUDGE THESE 8 DIMENSIONS:
1. Visual Hierarchy     — Clear focal point? Sizes guide the eye correctly?
2. Spacing & Breathing  — Cramped elements? Inconsistent gaps?
3. Color Harmony        — Colors work together? Contrast ratios acceptable (WCAG AA minimum)?
4. Typography           — Font sizes, weights, line-heights balanced?
5. Polish & Details     — Shadows, borders, rounded corners done tastefully?
6. Overall Impression   — Would this pass a senior design review at a top-tier startup?
7. Accessibility        — Semantic HTML visible? Focus indicators present? Labels on inputs/buttons? Motion respects user preference?
8. UX Realism           — Does the UI have realistic placeholder data? Loading/empty/error states considered? No placeholder "Lorem Ipsum" without intent?

SCORING (0–100):
- 90–100: Exceptional. Ships as-is.
- 82–89:  Good — minor improvements available.
- 65–81:  Mediocre — needs cosmetic polish or accessibility work.
- < 65:   Needs significant repair across multiple dimensions.

RULES:
- If score >= 82: Set passed=true, no suggestedCode needed.
- If score < 82: Set passed=false, return COMPLETE repaired TSX in suggestedCode.
  The repaired code must be a drop-in replacement for the original component.
  Fix ONLY what the critique identified — preserve all functionality and component names.
  Use Tailwind CSS classes exclusively. Do NOT add new dependencies.
  If accessibility issues found: add aria-label, alt attributes, role, focus:ring classes.
  If motion found without prefers-reduced-motion: add useReducedMotion() guard.

OUTPUT: Return ONLY valid JSON matching this exact schema:
{
  "passed": boolean,
  "score": number,
  "critique": "Concise 2–3 sentence verdict covering aesthetics AND accessibility",
  "suggestedCode": "// full repaired TSX here, or null if passed=true"
}`;

// ─── Provider-specific multimodal message builders ─────────────────────────────

interface MultimodalMessage {
  role: 'user';
  content: unknown;
}

/**
 * Detects the provider category from model name + provider string.
 * Returns 'openai' | 'google' | 'anthropic' | 'text-only'
 */
function detectVisionProvider(model: string, provider?: string): 'openai' | 'google' | 'anthropic' | 'text-only' {
  const m = model.toLowerCase();
  const p = (provider ?? '').toLowerCase();

  // Google Gemini
  if (p === 'google' || m.includes('gemini')) return 'google';

  // Anthropic Claude — uses native SDK format via OpenAI compat shim
  // Their compat endpoint doesn't support vision, so we handle separately
  if (p === 'anthropic' || m.includes('claude')) return 'anthropic';

  // OpenAI and all OpenAI-compat providers (groq, openrouter, together, etc.)
  // that accept image_url content parts
  if (
    p === 'openai' || p === 'groq' || p === 'openrouter' ||
    p === 'together' || p === 'lmstudio' || p === 'huggingface' ||
    m.includes('gpt-') || m.includes('gpt4') || m.includes('llava') ||
    m.includes('vision') || m.includes('bakllava') || m.includes('moondream')
  ) return 'openai';

  // Local/Ollama — vision depends on model, default to text-only for safety
  // Exception: known multimodal Ollama models
  if (m.includes('llava') || m.includes('bakllava') || m.includes('moondream') || m.includes('minicpm-v')) {
    return 'openai'; // Ollama uses OpenAI-compat format
  }

  return 'text-only';
}

/**
 * Extract base64 data from data URL.
 * Input:  "data:image/png;base64,iVBOR..."
 * Output: { mimeType: "image/png", base64: "iVBOR..." }
 */
function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

// OpenAI / OpenAI-compat multimodal user message
function buildOpenAIUserMessage(
  imageDataUrl: string,
  codeContext: string,
): MultimodalMessage {
  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text: `Here is the rendered UI screenshot and the source code for context.\n\nSOURCE CODE:\n${codeContext}\n\nPlease analyze the screenshot aesthetically and return your judgment as JSON.`,
      },
      {
        type: 'image_url',
        image_url: { url: imageDataUrl, detail: 'high' },
      },
    ],
  };
}

// Google Gemini inline_data message (via REST API)
function buildGoogleUserMessage(
  imageDataUrl: string,
  codeContext: string,
): Record<string, unknown> {
  const parsed = parseDataUrl(imageDataUrl);
  if (!parsed) {
    return {
      role: 'user',
      parts: [{ text: `SOURCE CODE:\n${codeContext}\n\n(Screenshot unavailable — analyze code aesthetics only.)` }],
    };
  }
  return {
    role: 'user',
    parts: [
      { text: `Here is the rendered UI screenshot and the source code for context.\n\nSOURCE CODE:\n${codeContext}\n\nPlease analyze the screenshot aesthetically and return your judgment as JSON.` },
      { inline_data: { mime_type: parsed.mimeType, data: parsed.base64 } },
    ],
  };
}

// Anthropic messages API with vision content blocks
function buildAnthropicUserMessage(
  imageDataUrl: string,
  codeContext: string,
): Record<string, unknown> {
  const parsed = parseDataUrl(imageDataUrl);
  if (!parsed) {
    return {
      role: 'user',
      content: `SOURCE CODE:\n${codeContext}\n\n(Screenshot unavailable — analyze code aesthetics only.)`,
    };
  }
  return {
    role: 'user',
    content: [
      { type: 'text', text: `Here is the rendered UI screenshot and the source code for context.\n\nSOURCE CODE:\n${codeContext}` },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: parsed.mimeType,
          data: parsed.base64,
        },
      },
      { type: 'text', text: 'Please analyze the screenshot aesthetically and return your judgment as JSON.' },
    ],
  };
}

// ─── Public API entry point ────────────────────────────────────────────────────

export interface FinalRoundCriticOptions {
  /** Screenshot as a data URL (data:image/png;base64,...) */
  imageDataUrl: string;
  /** Generated source code */
  code: string | Record<string, string>;
  /** Model identifier chosen by the user */
  model: string;
  /** Provider identifier (openai, anthropic, google, ollama, etc.) */
  provider?: string;
  /** API key for the selected model */
  apiKey?: string;
  /** Custom base URL for OpenAI-compat providers */
  baseUrl?: string;
}

export interface FinalRoundCriticResponse {
  status: FinalRoundStatus;
  result?: FinalRoundResult;
  error?: string;
}

/**
 * Calls the selected model with a screenshot + code for a final aesthetic review.
 * Always resolves — never throws. Returns a `skipped` status on unsupported models.
 */
export async function runFinalRoundCritic(
  opts: FinalRoundCriticOptions,
): Promise<FinalRoundCriticResponse> {
  const { imageDataUrl, code, model, provider, apiKey, baseUrl } = opts;

  const visionProvider = detectVisionProvider(model, provider);

  const codeContext =
    typeof code === 'string'
      ? code.slice(0, 8000) // limit for token budget
      : JSON.stringify(code, null, 2).slice(0, 8000);

  try {
    let rawJson: string;

    switch (visionProvider) {
      case 'openai':
        rawJson = await callOpenAIVision({ model, apiKey, baseUrl, provider, imageDataUrl, codeContext });
        break;
      case 'google':
        rawJson = await callGoogleVision({ model, apiKey, imageDataUrl, codeContext });
        break;
      case 'anthropic':
        rawJson = await callAnthropicVision({ model, apiKey, imageDataUrl, codeContext });
        break;
      case 'text-only':
      default:
        return {
          status: 'skipped',
          error: `Model "${model}" does not support vision input. Final Round requires a multimodal model (gpt-4o, claude-3, gemini, llava, etc.).`,
        };
    }

    // Parse and validate the JSON response
    let parsed: unknown;
    try {
      // Strip markdown fences if model wrapped the JSON
      const cleaned = rawJson.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/im, '').trim();
      // Find the first { ... } JSON block in case the model added preamble
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleaned);
    } catch {
      return { status: 'error', error: 'Final Round model returned invalid JSON' };
    }

    const validation = FinalRoundResultSchema.safeParse(parsed);
    if (!validation.success) {
      return { status: 'error', error: 'Final Round result did not match expected schema' };
    }

    const result = validation.data;
    const status: FinalRoundStatus = result.passed ? 'passed' : 'fixed';
    return { status, result };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    // Gracefully handle "model does not support vision" API errors
    if (msg.includes('does not support') || msg.includes('vision') || msg.includes('multimodal') || msg.includes('image')) {
      return {
        status: 'skipped',
        error: `Model "${model}" returned a vision-unsupported error. Final Round skipped.`,
      };
    }
    return { status: 'error', error: `Final Round critic error: ${msg}` };
  }
}

// ─── Provider-specific callers ─────────────────────────────────────────────────

interface OpenAIVisionOpts {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  provider?: string;
  imageDataUrl: string;
  codeContext: string;
}

async function callOpenAIVision(opts: OpenAIVisionOpts): Promise<string> {
  const { model, apiKey, baseUrl, provider, imageDataUrl, codeContext } = opts;

  // Resolve base URL: explicit baseUrl > known provider URL > OpenAI default
  const COMPAT_URLS: Record<string, string> = {
    groq:        'https://api.groq.com/openai/v1',
    openrouter:  'https://openrouter.ai/api/v1',
    together:    'https://api.together.xyz/v1',
    lmstudio:    'http://localhost:1234/v1',
    huggingface: 'https://router.huggingface.co/hf-inference/v1',
  };
  const resolvedBase =
    baseUrl ??
    (provider && COMPAT_URLS[provider]) ??
    'https://api.openai.com/v1';

  // Key resolution: explicit > env fallback
  const resolvedKey =
    apiKey ??
    (provider === 'groq'       ? process.env.GROQ_API_KEY          : undefined) ??
    (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY     : undefined) ??
    (provider === 'together'   ? process.env.TOGETHER_API_KEY       : undefined) ??
    process.env.OPENAI_API_KEY;

  if (!resolvedKey) {
    throw new Error(`API key required for ${provider ?? 'openai'} Final Round vision call.`);
  }

  const userMessage = buildOpenAIUserMessage(imageDataUrl, codeContext);

  const res = await fetch(`${resolvedBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolvedKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: FINAL_ROUND_SYSTEM_PROMPT },
        userMessage,
      ],
      response_format: { type: 'json_object' },
      temperature: 0.15,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    throw new Error(`OpenAI vision API error (HTTP ${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string | null } }> };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI vision API');
  return content;
}

interface GoogleVisionOpts {
  model: string;
  apiKey?: string;
  imageDataUrl: string;
  codeContext: string;
}

async function callGoogleVision(opts: GoogleVisionOpts): Promise<string> {
  const { model, apiKey, imageDataUrl, codeContext } = opts;
  const resolvedKey = apiKey ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!resolvedKey) throw new Error('Google API key required for Final Round vision call.');

  const userPart = buildGoogleUserMessage(imageDataUrl, codeContext);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${resolvedKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: FINAL_ROUND_SYSTEM_PROMPT }] },
        contents: [userPart],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 4000,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    throw new Error(`Google vision API error (HTTP ${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  const content = data.candidates[0]?.content?.parts[0]?.text;
  if (!content) throw new Error('Empty response from Google vision API');
  return content;
}

interface AnthropicVisionOpts {
  model: string;
  apiKey?: string;
  imageDataUrl: string;
  codeContext: string;
}

async function callAnthropicVision(opts: AnthropicVisionOpts): Promise<string> {
  const { model, apiKey, imageDataUrl, codeContext } = opts;
  const resolvedKey = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!resolvedKey) throw new Error('Anthropic API key required for Final Round vision call.');

  const userMessage = buildAnthropicUserMessage(imageDataUrl, codeContext);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': resolvedKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: FINAL_ROUND_SYSTEM_PROMPT,
      messages: [userMessage],
      temperature: 0.15,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    throw new Error(`Anthropic vision API error (HTTP ${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  const textBlock = data.content?.find((b) => b.type === 'text');
  if (!textBlock?.text) throw new Error('Empty response from Anthropic vision API');
  return textBlock.text;
}
