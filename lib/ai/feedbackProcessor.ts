/**
 * @file lib/ai/feedbackProcessor.ts
 *
 * Translates persisted feedback stats into two actionable outputs:
 *
 *  1. systemPromptAppend — a string appended to the generation system prompt
 *     that warns the model about its historical failure patterns for this
 *     intent type and injects user-approved example snippets.
 *
 *  2. warn / warnReason — signals that the UI should show a pre-generation
 *     badge ("this model has a low approval rate for dashboards").
 *
 * Called by componentGenerator.ts just before building the prompt (Step 4).
 * Zero network calls — reads only from the local stats cache.
 */

import { getFeedbackStats, getTopRatedGenerations } from './feedbackStore';
import { getProjectByIdAsync } from './memory';
import type { UIIntent } from '../validation/schemas';

// ─── Config ───────────────────────────────────────────────────────────────────

/** Approval rate below which we inject corrective guidance into the system prompt */
const WARN_THRESHOLD   = 0.40;  // < 40% → warn
/** Minimum sample count before we trust the signal */
const MIN_SAMPLES      = 3;
/** Characters of an approved snippet to inject */
const SNIPPET_CHARS    = 600;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeedbackEnrichment {
  /** String to append to the system prompt — empty if nothing to inject */
  systemPromptAppend: string;
  /** Whether to surface a pre-generation warning badge */
  warn:       boolean;
  warnReason: string;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Build a prompt enrichment block based on historical feedback for this
 * model + intent type combination.
 *
 * @param intent   The parsed UI intent for this request
 * @param modelId  The resolved model identifier (e.g. "gpt-4o")
 */
export async function enrichPromptWithFeedback(
  intent:  UIIntent,
  modelId: string,
): Promise<FeedbackEnrichment> {
  const intentType = (intent.componentType ?? 'component').toLowerCase();
  const stats      = getFeedbackStats(modelId, intentType);

  const lines: string[] = [];
  let warn       = false;
  let warnReason = '';

  // ── Signal: low approval rate ──────────────────────────────────────────────────────────
  if (stats && stats.total >= MIN_SAMPLES) {
    if (stats.successRate < WARN_THRESHOLD) {
      warn       = true;
      warnReason = `${modelId} has a ${Math.round(stats.successRate * 100)}% approval rate for "${intentType}" components (${stats.total} samples)`;

      lines.push(
        `HISTORICAL QUALITY NOTE: Previous "${intentType}" generations with this model were frequently rejected by users.`,
        `Success rate: ${Math.round(stats.successRate * 100)}% over ${stats.total} attempts.`,
        `Common failure reasons include: incomplete layout, poor visual hierarchy, or truncated output.`,
        `Avg critique score: ${stats.avgCritiqueScore}/100. Your target is above 85.`,
        `Pay extra attention to: completeness, production-level aesthetics, and component structure.`,
      );
    }

    if (stats.corrected > 0) {
      lines.push(
        `Users manually corrected ${stats.corrected} of ${stats.total} "${intentType}" outputs — ensure the component is not truncated and matches production standards.`,
      );
    }
  }

  // ── Signal: inject approved examples ──────────────────────────────────────────────────
  const topRated = await getTopRatedGenerations(intentType, 1);

  if (topRated.length > 0) {
    // Prefer correctedCode (user-improved) over original generated code
    let snippet: string | null = topRated[0].correctedCode?.slice(0, SNIPPET_CHARS) ?? null;

    if (!snippet) {
      // Fall back to the original code from the DB
      try {
        const memEntry = await getProjectByIdAsync(topRated[0].generationId);
        if (memEntry && typeof memEntry.code === 'string') {
          snippet = memEntry.code.slice(0, SNIPPET_CHARS);
        }
      } catch {
        // Non-fatal
      }
    }

    if (snippet) {
      lines.push(
        `\nEXAMPLE OF USER-APPROVED "${intentType.toUpperCase()}" OUTPUT (use as a quality benchmark — match or exceed this standard):\n\`\`\`tsx\n${snippet}\n// ... (truncated)\n\`\`\``,
      );
    }
  }

  return {
    systemPromptAppend: lines.join('\n'),
    warn,
    warnReason,
  };
}

/**
 * Lightweight check — returns whether to show a warning before generation.
 * Used by /api/generate to optionally include a warning in the response.
 */
export function shouldWarnAboutModel(
  modelId:    string,
  intentType: string,
): { warn: boolean; reason: string } {
  const stats = getFeedbackStats(modelId, intentType);
  if (!stats || stats.total < MIN_SAMPLES) return { warn: false, reason: '' };

  if (stats.successRate < WARN_THRESHOLD) {
    return {
      warn:   true,
      reason: `${Math.round(stats.successRate * 100)}% approval rate for "${intentType}" — ${stats.total} samples`,
    };
  }

  return { warn: false, reason: '' };
}
