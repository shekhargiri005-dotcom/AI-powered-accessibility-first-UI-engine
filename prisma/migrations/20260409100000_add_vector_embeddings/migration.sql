-- pgvector extension (already enabled via Neon SQL Editor, but idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── ComponentEmbedding ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ComponentEmbedding" (
  "id"          TEXT NOT NULL,
  "knowledgeId" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "keywords"    TEXT[],
  "guidelines"  TEXT NOT NULL,
  "embedding"   vector(768),
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "ComponentEmbedding_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "ComponentEmbedding_knowledgeId_key" UNIQUE ("knowledgeId")
);

-- ─── FeedbackEmbedding ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FeedbackEmbedding" (
  "id"             TEXT NOT NULL,
  "feedbackId"     TEXT NOT NULL,
  "intentType"     TEXT NOT NULL,
  "correctedCode"  TEXT NOT NULL,
  "correctionNote" TEXT,
  "a11yScore"      INTEGER NOT NULL DEFAULT 0,
  "embedding"      vector(768),
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "FeedbackEmbedding_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "FeedbackEmbedding_feedbackId_key" UNIQUE ("feedbackId")
);

-- ─── IVFFlat indexes for cosine similarity (fast ANN at scale) ────────────────
-- lists=10 is appropriate for < 100k rows; bump to 100 as data grows
CREATE INDEX IF NOT EXISTS "ComponentEmbedding_embedding_idx"
  ON "ComponentEmbedding" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 10);

CREATE INDEX IF NOT EXISTS "FeedbackEmbedding_embedding_idx"
  ON "FeedbackEmbedding" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 10);
