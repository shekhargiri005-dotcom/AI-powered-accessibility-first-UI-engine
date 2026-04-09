/**
 * @file scripts/seed-embeddings.ts
 *
 * One-time script: embed all KNOWLEDGE_BASE entries and upsert them into
 * the ComponentEmbedding table in Neon (pgvector).
 *
 * Safe to re-run — uses ON CONFLICT DO UPDATE semantics in the DB.
 *
 * Prerequisites:
 *  1. pgvector extension enabled in Neon (`CREATE EXTENSION IF NOT EXISTS vector;`)
 *  2. Migration applied (`npx prisma migrate deploy`)
 *  3. GOOGLE_API_KEY set in .env
 *  4. DATABASE_URL set in .env
 *
 * Usage:
 *   npx tsx scripts/seed-embeddings.ts
 */

import 'dotenv/config';
import { KNOWLEDGE_BASE } from '../lib/ai/knowledgeBase';
import { upsertComponentEmbedding } from '../lib/ai/vectorStore';

const DELAY_MS = 100; // Throttle to avoid rate-limiting (free tier: 1500 req/min)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`\n🔵 Seeding ${KNOWLEDGE_BASE.length} knowledge base entries into pgvector...\n`);

  let success = 0;
  let failed  = 0;

  for (const item of KNOWLEDGE_BASE) {
    process.stdout.write(`  → [${item.id}] ${item.name} ... `);

    const ok = await upsertComponentEmbedding({
      knowledgeId: item.id,
      name:        item.name,
      keywords:    item.keywords,
      guidelines:  item.guidelines,
    });

    if (ok) {
      success++;
      console.log('✅');
    } else {
      failed++;
      console.log('❌ (check GOOGLE_API_KEY and DATABASE_URL)');
    }

    // Throttle to stay comfortably within Google free-tier rate limits
    await sleep(DELAY_MS);
  }

  console.log(`\n✨ Done — ${success} embedded, ${failed} failed.\n`);

  if (failed > 0) {
    console.warn('⚠️  Some items failed. Re-run the script — it is idempotent.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Seed script crashed:', err);
  process.exit(1);
});
