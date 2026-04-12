/**
 * @file lib/ai/vectorStore.ts
 *
 * pgvector integration layer.
 *
 * Responsibilities:
 *  1. embedText()                  — generate a 768-dim embedding via Google text-embedding-004
 *  2. upsertComponentEmbedding()   — embed + store a KNOWLEDGE_BASE entry
 *  3. searchComponents()           — cosine similarity search → top-K knowledge guidelines
 *  4. upsertFeedbackEmbedding()    — embed corrected user feedback for RAG
 *  5. searchFeedback()             — retrieve past corrections similar to current prompt
 *
 * Storage: pgvector columns (vector(768)) on Neon — queried via @neondatabase/serverless
 * raw SQL because Prisma has no native vector type support yet.
 *
 * Embedding model: Google embedding API (with runtime fallback model selection)
 * called directly via the REST API using GOOGLE_API_KEY.
 */

import { neon } from '@neondatabase/serverless';
import { logger } from '@/lib/logger';

// ─── Config ───────────────────────────────────────────────────────────────────

const EMBEDDING_MODELS = ['gemini-embedding-001', 'text-embedding-004'] as const;
const EMBEDDING_DIMS  = 768;

const GOOGLE_API_KEY  = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? '';
// ─── Neon SQL client (raw — for vector ops) ───────────────────────────────────

/**
 * Returns a Neon SQL tag function for raw queries.
 * Created lazily so the module can be imported without a DB connection in CI.
 */
function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('[vectorStore] DATABASE_URL is not set');
  return neon(url);
}

// ─── Embedding Generation ─────────────────────────────────────────────────────

/**
 * Generate a normalized 768-dim embedding vector using Google's embedding API.
 * Tries multiple model IDs for compatibility across API projects/regions.
 *
 * Returns null instead of throwing so callers can gracefully fall back.
 */
export async function embedText(text: string): Promise<number[] | null> {
  if (!GOOGLE_API_KEY) {
    logger.debug({ endpoint: 'vectorStore', message: 'GOOGLE_API_KEY not set — graceful skip of semantic embedding' });
    return null;
  }

  try {
    for (const modelId of EMBEDDING_MODELS) {
      const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:embedContent?key=${GOOGLE_API_KEY}`;
      const res = await fetch(embedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${modelId}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMS,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        logger.warn({
          endpoint: 'vectorStore',
          message: 'Embedding API error',
          metadata: { status: res.status, modelId, body: errText },
        });
        continue;
      }

      const data = await res.json() as { embedding?: { values?: number[] } };
      const values = data?.embedding?.values;
      if (!Array.isArray(values) || values.length !== EMBEDDING_DIMS) {
        logger.warn({
          endpoint: 'vectorStore',
          message: 'Unexpected embedding shape',
          metadata: { modelId, length: values?.length },
        });
        continue;
      }

      return values;
    }
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ endpoint: 'vectorStore', message: 'embedText failed', error: msg });
    return null;
  }
}

/**
 * Serialise a JS number[] into the PostgreSQL vector literal format:
 * '[0.1, 0.2, -0.3, ...]'
 */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

// ─── ComponentEmbedding CRUD ──────────────────────────────────────────────────

export interface ComponentEmbeddingInput {
  knowledgeId: string;
  name:        string;
  keywords:    string[];
  guidelines:  string;
  /** Knowledge domain tag. Default: 'template'. */
  source?:     'template' | 'registry' | 'blueprint' | 'motion' | 'feedback' | 'repair';
}

/**
 * Embed a KNOWLEDGE_BASE item and upsert it in the ComponentEmbedding table.
 * Safe to call multiple times — uses ON CONFLICT DO UPDATE.
 *
 * @returns true if the record was written; false if embedding failed (graceful)
 */
export async function upsertComponentEmbedding(item: ComponentEmbeddingInput): Promise<boolean> {
  // Embed name + keywords + guidelines for maximum semantic coverage
  const textToEmbed = [item.name, item.keywords.join(', '), item.guidelines].join('\n\n');
  const embedding   = await embedText(textToEmbed);
  if (!embedding)   return false;

  const sql    = getSql();
  const id     = crypto.randomUUID();
  const vec    = toVectorLiteral(embedding);
  const source = item.source ?? 'template';

  try {
    await sql`
      INSERT INTO "ComponentEmbedding"
        ("id", "knowledgeId", "name", "keywords", "guidelines", "source", "embedding", "updatedAt")
      VALUES
        (${id}, ${item.knowledgeId}, ${item.name}, ${item.keywords}, ${item.guidelines}, ${source}, ${vec}::vector, now())
      ON CONFLICT ("knowledgeId") DO UPDATE SET
        "name"      = EXCLUDED."name",
        "keywords"  = EXCLUDED."keywords",
        "guidelines"= EXCLUDED."guidelines",
        "source"    = EXCLUDED."source",
        "embedding" = EXCLUDED."embedding",
        "updatedAt" = now()
    `;
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ endpoint: 'vectorStore', message: 'upsertComponentEmbedding failed', metadata: { knowledgeId: item.knowledgeId }, error: msg });
    return false;
  }
}

export interface SimilarComponent {
  knowledgeId: string;
  name:        string;
  guidelines:  string;
  /** Knowledge domain tag: 'template' | 'registry' | 'blueprint' | 'motion' | etc. */
  source:      string;
  similarity:  number;
}

/**
 * Cosine similarity search over ComponentEmbedding.
 * Returns the top-K most semantically similar knowledge entries.
 *
 * @param query  The user prompt / intent description to search with
 * @param topK   How many results to return (default 3)
 * @param threshold  Minimum similarity score 0–1 (default 0.5)
 */
export async function searchComponents(
  query:     string,
  topK      = 3,
  threshold = 0.50,
): Promise<SimilarComponent[]> {
  const embedding = await embedText(query);
  if (!embedding) return [];

  const sql = getSql();
  const vec = toVectorLiteral(embedding);

  try {
    const rows = await sql`
      SELECT
        "knowledgeId",
        "name",
        "guidelines",
        "source",
        1 - ("embedding" <=> ${vec}::vector) AS similarity
      FROM "ComponentEmbedding"
      WHERE "embedding" IS NOT NULL
        AND 1 - ("embedding" <=> ${vec}::vector) >= ${threshold}
      ORDER BY similarity DESC
      LIMIT ${topK}
    `;

    return rows.map((r) => ({
      knowledgeId: r.knowledgeId as string,
      name:        r.name        as string,
      guidelines:  r.guidelines  as string,
      source:      (r.source     as string) ?? 'template',
      similarity:  Number(r.similarity),
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ endpoint: 'vectorStore', message: 'searchComponents failed', error: msg });
    return [];
  }
}

/**
 * Source-filtered cosine similarity search.
 * Restricts results to a specific knowledge domain (e.g. 'registry', 'blueprint').
 *
 * @param query   The user prompt / intent description
 * @param source  The knowledge domain to search within
 * @param topK    How many results to return (default 3)
 * @param threshold  Minimum similarity score 0–1 (default 0.50)
 */
export async function searchComponentsBySource(
  query:     string,
  source:    'template' | 'registry' | 'blueprint' | 'motion' | 'feedback' | 'repair',
  topK      = 3,
  threshold = 0.50,
): Promise<SimilarComponent[]> {
  const embedding = await embedText(query);
  if (!embedding) return [];

  const sql = getSql();
  const vec = toVectorLiteral(embedding);

  try {
    const rows = await sql`
      SELECT
        "knowledgeId",
        "name",
        "guidelines",
        "source",
        1 - ("embedding" <=> ${vec}::vector) AS similarity
      FROM "ComponentEmbedding"
      WHERE "embedding" IS NOT NULL
        AND "source" = ${source}
        AND 1 - ("embedding" <=> ${vec}::vector) >= ${threshold}
      ORDER BY similarity DESC
      LIMIT ${topK}
    `;

    return rows.map((r) => ({
      knowledgeId: r.knowledgeId as string,
      name:        r.name        as string,
      guidelines:  r.guidelines  as string,
      source:      (r.source     as string) ?? source,
      similarity:  Number(r.similarity),
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ endpoint: 'vectorStore', message: 'searchComponentsBySource failed', metadata: { source }, error: msg });
    return [];
  }
}

// ─── FeedbackEmbedding CRUD ───────────────────────────────────────────────────

export interface FeedbackEmbeddingInput {
  feedbackId:     string;
  intentType:     string;
  correctedCode:  string;
  correctionNote?: string;
  a11yScore:      number;
}

/**
 * Embed a corrected user feedback entry and upsert it in FeedbackEmbedding.
 * Called fire-and-forget from feedbackStore.ts after a 'corrected' signal.
 *
 * We only embed entries with correctedCode (there is actual learned content).
 */
export async function upsertFeedbackEmbedding(input: FeedbackEmbeddingInput): Promise<boolean> {
  if (!input.correctedCode?.trim()) return false;

  // Embed intent description + correction note for best retrieval context
  const textToEmbed = [
    `Intent type: ${input.intentType}`,
    input.correctionNote ? `Correction note: ${input.correctionNote}` : '',
    `Code snippet: ${input.correctedCode.slice(0, 800)}`,
  ].filter(Boolean).join('\n\n');

  const embedding = await embedText(textToEmbed);
  if (!embedding) return false;

  const sql = getSql();
  const id  = crypto.randomUUID();
  const vec = toVectorLiteral(embedding);

  try {
    await sql`
      INSERT INTO "FeedbackEmbedding"
        ("id", "feedbackId", "intentType", "correctedCode", "correctionNote", "a11yScore", "embedding")
      VALUES
        (${id}, ${input.feedbackId}, ${input.intentType}, ${input.correctedCode},
         ${input.correctionNote ?? null}, ${input.a11yScore}, ${vec}::vector)
      ON CONFLICT ("feedbackId") DO UPDATE SET
        "intentType"     = EXCLUDED."intentType",
        "correctedCode"  = EXCLUDED."correctedCode",
        "correctionNote" = EXCLUDED."correctionNote",
        "a11yScore"      = EXCLUDED."a11yScore",
        "embedding"      = EXCLUDED."embedding"
    `;
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ endpoint: 'vectorStore', message: 'upsertFeedbackEmbedding failed', metadata: { feedbackId: input.feedbackId }, error: msg });
    return false;
  }
}

export interface SimilarFeedback {
  feedbackId:     string;
  intentType:     string;
  correctedCode:  string;
  correctionNote: string | null;
  a11yScore:      number;
  similarity:     number;
}

/**
 * Retrieve past user corrections that are semantically similar to the current prompt.
 * Used for RAG: injecting prior user-approved code patterns into the generation prompt.
 *
 * @param query      The user prompt / intent description
 * @param topK       Number of results to return (default 2)
 * @param threshold  Minimum similarity score 0–1 (default 0.60)
 */
export async function searchFeedback(
  query:     string,
  topK      = 2,
  threshold = 0.60,
): Promise<SimilarFeedback[]> {
  const embedding = await embedText(query);
  if (!embedding) return [];

  const sql = getSql();
  const vec = toVectorLiteral(embedding);

  try {
    const rows = await sql`
      SELECT
        "feedbackId",
        "intentType",
        "correctedCode",
        "correctionNote",
        "a11yScore",
        1 - ("embedding" <=> ${vec}::vector) AS similarity
      FROM "FeedbackEmbedding"
      WHERE "embedding" IS NOT NULL
        AND 1 - ("embedding" <=> ${vec}::vector) >= ${threshold}
      ORDER BY similarity DESC
      LIMIT ${topK}
    `;

    return rows.map((r) => ({
      feedbackId:     r.feedbackId     as string,
      intentType:     r.intentType     as string,
      correctedCode:  r.correctedCode  as string,
      correctionNote: r.correctionNote as string | null,
      a11yScore:      Number(r.a11yScore),
      similarity:     Number(r.similarity),
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ endpoint: 'vectorStore', message: 'searchFeedback failed', error: msg });
    return [];
  }
}
