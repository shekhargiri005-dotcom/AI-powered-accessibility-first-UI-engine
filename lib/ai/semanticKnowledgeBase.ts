/**
 * @file lib/ai/semanticKnowledgeBase.ts
 *
 * Async semantic knowledge retrieval — drop-in replacements for sync keyword search.
 *
 * Phase 4 Update: Now uses source-tagged retrieval via searchComponentsBySource().
 * Each knowledge domain (template / registry / blueprint / motion) can be
 * queried independently, giving the generation pipeline fine-grained context.
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
  searchComponentsBySource,
  searchFeedback,
  type SimilarComponent,
  type SimilarFeedback,
} from './vectorStore';
import {
  findRelevantKnowledge,
  findAppTemplate,
  findDepthUITemplate,
} from './knowledgeBase';

// ─── Config ───────────────────────────────────────────────────────────────────

/** Minimum cosine similarity to include a component result */
const COMPONENT_THRESHOLD  = 0.50;
/** Minimum cosine similarity for registry / blueprint results */
const REGISTRY_THRESHOLD   = 0.48;
/** Minimum cosine similarity to include a feedback result */
const FEEDBACK_THRESHOLD   = 0.62;
/** Maximum characters of corrected code to inject into the prompt */
const FEEDBACK_SNIPPET_CHARS = 700;

// ─── Formatting Helpers ───────────────────────────────────────────────────────

function formatResults(results: SimilarComponent[], header: string): string {
  if (results.length === 0) return '';

  if (results.length === 1 || results[0].similarity >= 0.80) {
    const top = results[0];
    return `${header} [${top.name}] (similarity: ${(top.similarity * 100).toFixed(0)}%):\n${top.guidelines}`;
  }

  const block = results
    .map((r, i) => `[${i + 1}] ${r.name} (${(r.similarity * 100).toFixed(0)}% match):\n${r.guidelines}`)
    .join('\n\n');

  return `${header} — ${results.length} MATCHES:\n\n${block}`;
}

// ─── Source: template — General knowledge ─────────────────────────────────────

/**
 * Semantic replacement for `findRelevantKnowledge()`.
 *
 * Queries the `template` and all sources for semantically similar entries.
 * Falls back to keyword matcher if vector search returns nothing.
 */
export async function findRelevantKnowledgeSemantic(
  prompt: string,
  topK   = 3,
): Promise<string | null> {
  try {
    const results: SimilarComponent[] = await searchComponents(prompt, topK, COMPONENT_THRESHOLD);
    if (results.length > 0) {
      return formatResults(results, 'KNOWLEDGE BASE MATCH');
    }
  } catch {
    // Fall through to keyword fallback
  }

  return findRelevantKnowledge(prompt);
}

// ─── Source: template — App & Depth templates ─────────────────────────────────

/**
 * Semantic replacement for `findAppTemplate()`.
 * Uses source-filtered search for source:'template' entries with app prefix.
 * Falls back to `findAppTemplate()` keyword matching.
 */
export async function findAppTemplateSemantic(prompt: string): Promise<string | null> {
  try {
    const results = await searchComponentsBySource(prompt, 'template', 5, COMPONENT_THRESHOLD);
    const appResults = results.filter(r => r.knowledgeId.startsWith('template:app-'));

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
 * Semantic replacement for `findDepthUITemplate()`.
 * Uses source-filtered search for source:'template' entries with depth prefix.
 * Falls back to `findDepthUITemplate()` keyword matching.
 */
export async function findDepthUITemplateSemantic(prompt: string): Promise<string | null> {
  try {
    const results = await searchComponentsBySource(prompt, 'template', 5, COMPONENT_THRESHOLD);
    const depthResults = results.filter(r => r.knowledgeId.startsWith('template:depth-'));

    if (depthResults.length > 0) {
      const top = depthResults[0];
      return `DEPTH UI TEMPLATE [${top.name}] (similarity: ${(top.similarity * 100).toFixed(0)}%):\n${top.guidelines}`;
    }
  } catch {
    // Fall through
  }

  return findDepthUITemplate(prompt);
}

// ─── Source: registry — Component discovery ───────────────────────────────────

/**
 * Retrieve semantically relevant components from the COMPONENT_REGISTRY.
 *
 * This is the key function that enables the AI to discover real component
 * names instead of hallucinating imports. Queries source:'registry' only.
 *
 * Returns a prompt-ready block listing suggested component names + usage.
 *
 * @param prompt  The user's generation prompt
 * @param topK    How many registry matches to return (default 5)
 */
export async function findRegistryComponents(
  prompt: string,
  topK   = 5,
): Promise<string | null> {
  try {
    const results = await searchComponentsBySource(prompt, 'registry', topK, REGISTRY_THRESHOLD);
    if (results.length === 0) return null;

    const block = results
      .map(r => {
        // Extract component name from "registry:ComponentName" id
        const componentName = r.knowledgeId.replace(/^registry:/, '');
        return `  • ${componentName} (${(r.similarity * 100).toFixed(0)}% match) — ${r.guidelines.split('\n')[2] ?? ''}`;
      })
      .join('\n');

    return `AVAILABLE COMPONENTS (use these real names, do NOT hallucinate imports):\n${block}`;
  } catch {
    return null;
  }
}

// ─── Source: blueprint — Layout discovery ────────────────────────────────────

/**
 * Retrieve semantically matching layout blueprints from the LAYOUT_REGISTRY.
 *
 * Used to suggest the most appropriate layout structure for the user's intent.
 * Queries source:'blueprint' only.
 *
 * @param prompt  The user's generation prompt
 * @param topK    How many blueprint matches to return (default 2)
 */
export async function findBlueprintPattern(
  prompt: string,
  topK   = 2,
): Promise<string | null> {
  try {
    const results = await searchComponentsBySource(prompt, 'blueprint', topK, REGISTRY_THRESHOLD);
    if (results.length === 0) return null;

    const block = results
      .map((r, i) => {
        const layoutName = r.knowledgeId.replace(/^blueprint:/, '');
        return [
          `[Layout ${i + 1}] ${r.name} (${(r.similarity * 100).toFixed(0)}% match):`,
          r.guidelines
            .split('\n')
            .slice(0, 4) // First 4 lines of the layout description
            .map(line => `  ${line}`)
            .join('\n'),
        ].join('\n');
      })
      .join('\n\n');

    return `RECOMMENDED LAYOUT PATTERNS:\n${block}`;
  } catch {
    return null;
  }
}

// ─── Source: motion — Depth UI pattern discovery ──────────────────────────────

/**
 * Retrieve the most semantically relevant Depth UI / motion pattern.
 *
 * Used when generation mode is 'depth_ui' to inject expert motion knowledge.
 * Queries source:'motion' only.
 *
 * @param prompt  The user's generation prompt
 * @param topK    How many motion patterns to return (default 1)
 */
export async function findMotionPattern(
  prompt: string,
  topK   = 1,
): Promise<string | null> {
  try {
    const results = await searchComponentsBySource(prompt, 'motion', topK, 0.40);
    if (results.length === 0) return null;

    const top = results[0];
    return `DEPTH UI MOTION PATTERN [${top.name}] (${(top.similarity * 100).toFixed(0)}% match):\n${top.guidelines}`;
  } catch {
    return null;
  }
}

// ─── Semantic Feedback RAG ────────────────────────────────────────────────────

/**
 * Retrieve past user-corrected generations semantically similar to the prompt.
 *
 * Returns a prompt-ready string block with user-approved code snippets
 * and correction notes. Returns null if no relevant feedback exists.
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

// ─── Combined Context Builder ─────────────────────────────────────────────────

/**
 * Build a comprehensive multi-source RAG context block for the generation prompt.
 *
 * Runs all relevant source searches in parallel and merges results into a
 * single structured context string. Falls back gracefully on any error.
 *
 * @param prompt       The user's generation prompt
 * @param mode         'component' | 'app' | 'depth_ui'
 */
export async function buildSemanticContext(
  prompt: string,
  mode:   'component' | 'app' | 'depth_ui',
): Promise<string> {
  const sections: string[] = [];

  const [knowledge, registry, blueprint, motion, feedback] = await Promise.allSettled([
    // 1. Template knowledge (all modes)
    mode === 'app'      ? findAppTemplateSemantic(prompt)
    : mode === 'depth_ui' ? findDepthUITemplateSemantic(prompt)
    : findRelevantKnowledgeSemantic(prompt),

    // 2. Component registry discovery (all modes)
    findRegistryComponents(prompt),

    // 3. Layout blueprint matching (all modes)
    findBlueprintPattern(prompt),

    // 4. Motion pattern (depth_ui mode only)
    mode === 'depth_ui' ? findMotionPattern(prompt) : Promise.resolve(null),

    // 5. Feedback RAG (all modes)
    findRelevantFeedback(prompt),
  ]);

  if (knowledge.status === 'fulfilled' && knowledge.value) sections.push(knowledge.value);
  if (registry.status  === 'fulfilled' && registry.value)  sections.push(registry.value);
  if (blueprint.status === 'fulfilled' && blueprint.value) sections.push(blueprint.value);
  if (motion.status    === 'fulfilled' && motion.value)    sections.push(motion.value);
  if (feedback.status  === 'fulfilled' && feedback.value)  sections.push(feedback.value);

  return sections.join('\n\n---\n\n');
}
