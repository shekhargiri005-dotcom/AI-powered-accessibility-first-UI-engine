-- Phase 4: Add source column to ComponentEmbedding for knowledge domain tagging.
-- This enables filtered retrieval (registry vs template vs blueprint vs motion).
-- Safe to re-run — ADD COLUMN IF NOT EXISTS is idempotent.

ALTER TABLE "ComponentEmbedding"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'template';

-- Backfill existing rows: anything already indexed is a template entry.
-- (No-op if column was just added — default handles it.)
UPDATE "ComponentEmbedding"
  SET "source" = 'template'
  WHERE "source" IS NULL OR "source" = '';

-- Create an index to speed up source-filtered cosine similarity queries.
-- The pgvector index (ivfflat) uses L2 distance by default; we use cosine in queries.
CREATE INDEX IF NOT EXISTS "ComponentEmbedding_source_idx"
  ON "ComponentEmbedding" ("source");
