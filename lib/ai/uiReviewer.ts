import { getWorkspaceAdapter } from './adapters/index';
import type { AdapterConfig } from './adapters/index';
import { resolveDefaultAdapter } from './resolveDefaultAdapter';
import { z } from 'zod';

/**
 * Optional override that allows callers to pass the user's UI-selected provider
 * instead of relying on env-var auto-detection (resolveDefaultAdapter).
 * This ensures the review/repair engines honour the active Generation Engine Setup.
 */
export interface ReviewerAdapterOverride {
  /** Provider id (e.g. 'groq', 'anthropic', 'google') */
  provider?: string;
  /** Raw API key for the provider */
  apiKey?: string;
  /** Custom base URL (OpenAI-compat providers) */
  baseUrl?: string;
  /** The explicit model ID supplied by the user */
  model?: string;
}

const ReviewSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  critiques: z.array(z.string()),
  repairInstructions: z.string().optional(),
});

export type UIReviewResult = z.infer<typeof ReviewSchema>;

const REVIEWER_SYSTEM_PROMPT = `You are a strict, senior UI Frontend Architect analyzing generated React code.

Your job is to run a second-pass review and ensure the code meets our mandatory quality rules.

MANDATORY CHECKS:
1. Is the layout logical and the visual hierarchy strong?
2. Is the spacing balanced (e.g., proper use of gaps, margins, paddings without looking cluttered)?
3. Are components consistent and modular?
4. Are there visually broken concepts (like random empty boxes, meaningless card spam, broken responsive design)?
5. Is the UI too plain, or is the 3D/animation excessive and unusable?
6. Does the code compile and look like production-worthy Tailwind?

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
{
  "passed": boolean, // true if the UI is production-ready, false if it needs repair
  "score": number, // 0-100 rating
  "critiques": string[], // Specific issues found (e.g., "The hero section lacks spacing", "Too many generic boxes")
  "repairInstructions": string // If passed=false, provide exact instructions for the repair agent to fix it
}

If the score is below 75, passed must be false.
Be highly critical. We want premium, expert-level interfaces, not basic templates.`;

export async function reviewGeneratedCode(
  code: string,
  intentContext: string,
  adapterOverride?: ReviewerAdapterOverride,
): Promise<UIReviewResult> {
  try {
    const purposeModel = process.env.REVIEW_MODEL ?? '';
    let cfg: AdapterConfig;

    if (purposeModel) {
      // Explicit purpose-specific env override always wins
      cfg = { model: purposeModel };
    } else if (adapterOverride?.provider) {
      // Use the provider and model the user selected in the Generation Engine Setup UI
      cfg = {
        model:    adapterOverride.model || 'gpt-4o', // fallback if perfectly unconfigured
        provider: adapterOverride.provider,
        apiKey:   adapterOverride.apiKey,
        baseUrl:  adapterOverride.baseUrl,
      };
    } else {
      cfg = resolveDefaultAdapter('REVIEW');
    }

    const adapter = await getWorkspaceAdapter(cfg);

    const unindentedCode = code.replace(/^[ \t]+/gm, '');

    const adapterResult = await adapter.generate({
      model: cfg.model,
      messages: [
        { role: 'system', content: REVIEWER_SYSTEM_PROMPT },
        { role: 'user', content: `Original Intent Context:\n${intentContext}\n\nGenerated Code to Review:\n\`\`\`tsx\n${unindentedCode}\n\`\`\`` },
      ],
      responseFormat: 'json_object',
      temperature: 0.1,
      maxTokens: 400, // BUG-06 FIX: 200 was too low — repairInstructions was always truncated
    });

    const raw = adapterResult.content;
    if (!raw) return { passed: true, score: 80, critiques: ['Reviewer returned empty'] };

    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return { passed: true, score: 80, critiques: ['Parse failed'] }; }

    const result = ReviewSchema.safeParse(parsed);
    if (!result.success) {
      return { passed: true, score: 80, critiques: ['Schema validation failed'] };
    }

    return result.data;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Surface quota errors as a clear warning rather than a noisy stacktrace
    if (msg.includes('429') || msg.includes('insufficient_quota') || msg.includes('quota')) {
      console.warn('Critique Engine: provider quota exceeded — skipping critique. Consider adding GROQ_API_KEY or switching REVIEW_PROVIDER.', { hint: msg.slice(0, 200) });
    } else {
      console.error('Critique Engine Error:', error);
    }
    // On failure, default to pass to avoid breaking the pipeline entirely
    return { passed: true, score: 80, critiques: ['Critique engine skipped (quota or provider error)'] };
  }
}

const REPAIR_SYSTEM_PROMPT = `You are an expert React/TypeScript repair agent.
You are given a broken or low-quality React component, along with specific critiques from a Senior UI Architect.

Your job is to FIX the component entirely.
Apply the requested structural, visual, or logical patches.
Ensure the layout is robust, the aesthetics are premium, and Tailwind classes are used correctly.

OUTPUT FORMAT: Return ONLY the raw TSX code for the fixed component. No markdown fences. No explanations.`;

export async function repairGeneratedCode(
  brokenCode: string,
  repairInstructions: string,
  adapterOverride?: ReviewerAdapterOverride,
): Promise<string> {
  try {
    const purposeModel = process.env.REPAIR_MODEL ?? '';
    let cfg: AdapterConfig;

    if (purposeModel) {
      cfg = { model: purposeModel };
    } else if (adapterOverride?.provider) {
      cfg = {
        model:    adapterOverride.model || 'gpt-4o',
        provider: adapterOverride.provider,
        apiKey:   adapterOverride.apiKey,
        baseUrl:  adapterOverride.baseUrl,
      };
    } else {
      cfg = resolveDefaultAdapter('REPAIR');
    }

    const adapter = await getWorkspaceAdapter(cfg);

    const adapterResult = await adapter.generate({
      model: cfg.model,
      messages: [
        { role: 'system', content: REPAIR_SYSTEM_PROMPT },
        { role: 'user', content: `REPAIR INSTRUCTIONS:\n${repairInstructions}\n\nBROKEN / SUBPAR CODE:\n\`\`\`tsx\n${brokenCode}\n\`\`\`` },
      ],
      temperature: 0.2,
      maxTokens: 5000,
    });

    const rawContent = adapterResult.content;
    
    // Strip markdown code fences if the model wrapped its output in them
    const match = rawContent.match(/```(?:tsx?|jsx?|typescript|javascript)?\s*([\s\S]*?)(?:```|$)/i);
    const cleaned = match && match[1]
      ? match[1].trim()
      : rawContent
          .replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/gim, '')
          .replace(/```\s*$/gim, '')
          .trim();

    return cleaned || brokenCode; // fallback to original if completely empty
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('429') || msg.includes('insufficient_quota') || msg.includes('quota')) {
      console.warn('Repair Engine: provider quota exceeded — returning original code. Consider adding GROQ_API_KEY or switching REPAIR_PROVIDER.', { hint: msg.slice(0, 200) });
    } else {
      console.error('Repair Engine Error:', error);
    }
    return brokenCode;
  }
}
