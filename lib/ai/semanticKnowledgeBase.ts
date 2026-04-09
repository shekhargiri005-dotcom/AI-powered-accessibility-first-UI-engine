/**
 * @file lib/ai/semanticKnowledgeBase.ts
 *
 * Async drop-in replacements for the sync keyword-based functions in knowledgeBase.ts.
 *
 * Uses pgvector cosine similarity via vectorStore.ts to find semantically relevant
 * knowledge entries, replacing brittle exact-keyword matching with true semantic search.
 *
 * Fallback strategy:
 *  - If DB / embedding is unavailable → silently falls back to keyword matching
 *  - Always returns a string (or null) — same contract as the original functions
 *
 * Usage:
 *   // Before (keyword):
 *   const knowledge = findRelevantKnowledge(prompt);          // sync, brittle
 *
 *   // After (semantic):
 *   const knowledge = await findRelevantKnowledgeSemantic(prompt); // async, robust
 */

import {
  searchComponents,
  searchFeedback,
  type SimilarComponent,
  type SimilarFeedback,
} from './vectorStore';
import {
  findRelevantKnowledge,
  findAppTemplate,
  findWebglTemplate,
} from './knowledgeBase';

// ─── Config ───────────────────────────────────────────────────────────────────

/** Minimum cosine similarity to include a component result */
const COMPONENT_THRESHOLD = 0.50;
/** Minimum cosine similarity to include a feedback result */
const FEEDBACK_THRESHOLD  = 0.62;
/** Maximum characters of corrected code to inject into the prompt */
const FEEDBACK_SNIPPET_CHARS = 700;

// ─── Semantic Component Search ────────────────────────────────────────────────

/**
 * Semantic replacement for `findRelevantKnowledge()`.
 *
 * Queries pgvector for the top-3 semantically similar KNOWLEDGE_BASE entries
 * and returns a formatted knowledge block for injection into the generation prompt.
 *
 * Falls back to the keyword matcher if vector search returns nothing.
 *
 * @param prompt  Raw user input / description
 * @param topK    Number of semantic results to consider (default 3)
 */
export async function findRelevantKnowledgeSemantic(
  prompt: string,
  topK   = 3,
): Promise<string | null> {
  try {
    const results: SimilarComponent[] = await searchComponents(prompt, topK, COMPONENT_THRESHOLD);

    if (results.length > 0) {
      // If single top result is very confident (>0.80) return it alone — avoids noise
      if (results.length === 1 || results[0].similarity >= 0.80) {
        const top = results[0];
        return `KNOWLEDGE BASE MATCH [${top.name}] (similarity: ${(top.similarity * 100).toFixed(0)}%):\n${top.guidelines}`;
      }

      // Multiple moderate matches — return all as ranked context
      const block = results
        .map(
          (r, i) =>
            `[${i + 1}] ${r.name} (${(r.similarity * 100).toFixed(0)}% match):\n${r.guidelines}`,
        )
        .join('\n\n');

      return `KNOWLEDGE BASE — ${results.length} SEMANTIC MATCHES:\n\n${block}`;
    }
  } catch {
    // Non-fatal — fall through to keyword fallback
  }

  // ── Fallback: original keyword matcher ────────────────────────────────────
  return findRelevantKnowledge(prompt);
}

/**
 * Semantic replacement for `findAppTemplate()`.
 * Searches only app templates (isAppTemplate: true entries in KNOWLEDGE_BASE).
 *
 * Falls back to `findAppTemplate()` if semantic search returns nothing.
 */
export async function findAppTemplateSemantic(prompt: string): Promise<string | null> {
  try {
    // App templates are identified by their knowledgeId starting with "app-"
    const results = await searchComponents(prompt, 5, COMPONENT_THRESHOLD);
    const appResults = results.filter((r) => r.knowledgeId.startsWith('app-'));

    if (appResults.length > 0) {
      const top = appResults[0];
      return `APP TEMPLATE [${top.name}] (similarity: ${(top.similarity * 100).toFixed(0)}%):\n${top.guidelines}`;
    }
  } catch {
    // Fall through
  }

  return findAppTemplate(prompt);
}

/**
 * Semantic replacement for `findWebglTemplate()`.
 * Searches only WebGL templates (isWebglTemplate: true entries in KNOWLEDGE_BASE).
 *
 * Falls back to `findWebglTemplate()` if semantic search returns nothing.
 */
export async function findWebglTemplateSemantic(prompt: string): Promise<string | null> {
  try {
    const results = await searchComponents(prompt, 5, COMPONENT_THRESHOLD);
    const webglResults = results.filter((r) => r.knowledgeId.startsWith('webgl-'));

    if (webglResults.length > 0) {
      const top = webglResults[0];
      return `WEBGL TEMPLATE [${top.name}] (similarity: ${(top.similarity * 100).toFixed(0)}%):\n${top.guidelines}`;
    }
  } catch {
    // Fall through
  }

  return findWebglTemplate(prompt);
}

// ─── Semantic Feedback RAG ────────────────────────────────────────────────────

/**
 * Retrieve past user-corrected generations that are semantically similar to the prompt.
 *
 * Returns a prompt-ready string block containing user-approved code snippets
 * and correction notes, ready to inject into the generation system prompt.
 *
 * Returns null if no relevant feedback exists or if the DB is unavailable.
 *
 * @param prompt  The user's generation prompt
 * @param topK    Max number of past corrections to retrieve (default 2)
 */
export async function findRelevantFeedback(
  prompt: string,
  topK   = 2,
): Promise<string | null> {
  try {
    const results: SimilarFeedback[] = await searchFeedback(prompt, topK, FEEDBACK_THRESHOLD);
    if (results.length === 0) return null;

    const sections = results.map((fb, i) => {
      const lines: string[] = [
        `[Example ${i + 1} — User-Corrected "${fb.intentType}" (a11y score: ${fb.a11yScore}/100, similarity: ${(fb.similarity * 100).toFixed(0)}%)]`,
      ];
      if (fb.correctionNote) {
        lines.push(`Correction note: ${fb.correctionNote}`);
      }
      lines.push(
        `Code (first ${FEEDBACK_SNIPPET_CHARS} chars):\n\`\`\`tsx\n${fb.correctedCode.slice(0, FEEDBACK_SNIPPET_CHARS)}\n// ... (truncated)\n\`\`\``,
      );
      return lines.join('\n');
    });

    return (
      `USER-CORRECTED EXAMPLES (use as quality benchmark — match or exceed):\n\n` +
      sections.join('\n\n')
    );
  } catch {
    return null;
  }
}
