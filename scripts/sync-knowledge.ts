/**
 * @file scripts/sync-knowledge.ts
 *
 * Full Knowledge Sync Script — Phase 4 of the Architecture Upgrade.
 *
 * Aggregates ALL internal knowledge sources (templates, component registry,
 * layout registry, motion patterns) and syncs them to the pgvector database
 * as source-tagged semantic embeddings.
 *
 * Run:
 *   npx tsx scripts/sync-knowledge.ts
 *
 * Options:
 *   --source=template   Sync only one source (template|registry|blueprint|motion)
 *   --dry-run           Print what would be synced without writing to DB
 *   --verbose           Print each chunk's content before embedding
 *
 * Requires:
 *   GOOGLE_API_KEY or GEMINI_API_KEY   (for text-embedding-004)
 *   DATABASE_URL                        (Neon/Postgres pgvector)
 */

import 'dotenv/config';
import {
  aggregateAllKnowledge,
  aggregateBySource,
  getAggregationSummary,
  type KnowledgeSource,
} from '../lib/ai/knowledgeAggregator';
import { upsertComponentEmbedding } from '../lib/ai/vectorStore';

// ─── CLI Args ─────────────────────────────────────────────────────────────────

const args          = process.argv.slice(2);
const dryRun        = args.includes('--dry-run');
const verbose       = args.includes('--verbose');
const sourceFilter  = args.find(a => a.startsWith('--source='))?.split('=')[1] as KnowledgeSource | undefined;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  process.stdout.write(msg + '\n');
}

function logSection(title: string): void {
  log(`\n${'─'.repeat(60)}`);
  log(`  ${title}`);
  log('─'.repeat(60));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log('\n╔══════════════════════════════════════════════════════════╗');
  log('║   AI UI Engine — Knowledge Sync (Phase 4)                ║');
  log('╚══════════════════════════════════════════════════════════╝');

  if (dryRun) log('\n⚠  DRY RUN — No DB writes will occur.\n');

  // ── Pre-flight summary ─────────────────────────────────────────────────────
  const summary = getAggregationSummary();
  logSection('Knowledge Sources Summary');

  let total = 0;
  for (const [source, count] of Object.entries(summary)) {
    log(`  ${source.padEnd(12)} → ${count} chunks`);
    total += count;
  }
  log(`\n  TOTAL             → ${total} chunks to embed`);

  if (sourceFilter) {
    log(`\n  Filter applied: --source=${sourceFilter}`);
  }

  // ── Collect chunks ─────────────────────────────────────────────────────────
  const chunks = sourceFilter
    ? aggregateBySource(sourceFilter)
    : aggregateAllKnowledge();

  if (chunks.length === 0) {
    log('\n  No chunks to sync. Exiting.\n');
    process.exit(0);
  }

  if (dryRun) {
    logSection(`Dry Run: ${chunks.length} chunks`);
    for (const chunk of chunks) {
      log(`  [${chunk.source.toUpperCase()}] ${chunk.id} — ${chunk.name}`);
      if (verbose) {
        log(`    Keywords: ${chunk.keywords.slice(0, 5).join(', ')}`);
        log(`    Content snippet: ${chunk.content.slice(0, 120).replace(/\n/g, ' ')}...`);
      }
    }
    log('\n✅ Dry run complete. Run without --dry-run to sync.\n');
    process.exit(0);
  }

  // ── Verify env ────────────────────────────────────────────────────────────
  const embeddingKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!embeddingKey) {
    log('\n❌  ERROR: GOOGLE_API_KEY or GEMINI_API_KEY is required for embedding generation.');
    log('   Set it in .env and retry.\n');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    log('\n❌  ERROR: DATABASE_URL is required to write to pgvector.');
    log('   Set it in .env and retry.\n');
    process.exit(1);
  }

  // ── Sync chunks ────────────────────────────────────────────────────────────
  logSection(`Syncing ${chunks.length} chunks to pgvector...`);

  const results = {
    success: 0,
    failed:  0,
    skipped: 0,
  };

  const BATCH_SIZE = 5; // Embed in batches to avoid rate limiting

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (chunk) => {
        if (verbose) {
          log(`\n  [${chunk.source.toUpperCase()}] ${chunk.id}`);
          log(`    ${chunk.content.slice(0, 100).replace(/\n/g, ' ')}...`);
        }

        try {
          const ok = await upsertComponentEmbedding({
            knowledgeId: chunk.id,
            name:        chunk.name,
            keywords:    chunk.keywords,
            guidelines:  chunk.content,
            source:      chunk.source,
          });

          if (ok) {
            results.success++;
            if (!verbose) {
              process.stdout.write(
                `\r  Progress: ${results.success + results.failed}/${chunks.length} ` +
                `(✓ ${results.success}  ✗ ${results.failed})  `,
              );
            } else {
              log(`    ✓ Embedded`);
            }
          } else {
            results.skipped++;
            if (verbose) log(`    ⚠ Skipped (embedding returned null)`);
          }
        } catch (err) {
          results.failed++;
          const msg = err instanceof Error ? err.message : String(err);
          if (verbose) log(`    ✗ Failed: ${msg}`);
        }
      }),
    );

    // Brief pause between batches to respect Google embedding API rate limits
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise(r => setTimeout(r, 250));
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  logSection('Sync Complete');
  log(`  ✓ Succeeded : ${results.success}`);
  log(`  ✗ Failed    : ${results.failed}`);
  log(`  ⚠ Skipped   : ${results.skipped}`);
  log(`  Total       : ${chunks.length}`);

  if (results.success === chunks.length) {
    log('\n  🎉 All chunks synced successfully!\n');
  } else if (results.failed > 0) {
    log('\n  ⚠  Some chunks failed. Check your GOOGLE_API_KEY and DATABASE_URL.\n');
  } else {
    log(`\n  ✅ Sync complete with ${results.skipped} skipped (no embedding returned).\n`);
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write('\n🔥 Fatal error in sync-knowledge.ts:\n' + String(err) + '\n');
  process.exit(1);
});
