/**
 * seed-workspace-db.mjs
 * ─────────────────────
 * Seeds the local SQLite workspace.db with:
 *  1. A default WorkspaceSettings row (provider = "openai" placeholder — replace with your key)
 *  2. A sample UsageLog row to verify the table is writable
 *
 * Run with:
 *   node scripts/seed-workspace-db.mjs
 *
 * Or to reset and re-seed:
 *   node scripts/seed-workspace-db.mjs --reset
 */
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dir  = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// Minimal SQLite INSERT writer (no npm deps needed)
// We use Prisma's own CLI to run raw SQL via `prisma db execute` so we don't
// need better-sqlite3.
// ─────────────────────────────────────────────────────────────────────────────
import { execSync } from 'child_process';

const reset = process.argv.includes('--reset');

const WORKSPACE_ID  = 'default';
const now           = new Date().toISOString();

// Build the SQL to seed WorkspaceSettings + UsageLog
const workspaceSettingsId = crypto.randomUUID();
const usageLogId          = crypto.randomUUID();

// Dummy encrypted key placeholder — replace with a real bcrypt/AES-encrypted key
// in production.  For local dev this is just a recognisable stub.
const encryptedApiKeyPlaceholder = 'PLACEHOLDER_SET_REAL_KEY_IN_ENV';

const resetSQL = reset ? `
DELETE FROM "WorkspaceSettings";
DELETE FROM "UsageLog";
` : '';

const seedSQL = `
${resetSQL}

-- WorkspaceSettings: default workspace, openai provider
INSERT OR IGNORE INTO "WorkspaceSettings" ("id","workspaceId","provider","model","encryptedApiKey","updatedAt")
VALUES (
  '${workspaceSettingsId}',
  '${WORKSPACE_ID}',
  'openai',
  'gpt-4o',
  '${encryptedApiKeyPlaceholder}',
  '${now}'
);

-- UsageLog: seed a zero-cost row so the table shows as active
INSERT OR IGNORE INTO "UsageLog"
  ("id","workspaceId","provider","model","promptTokens","completionTokens","totalTokens","latencyMs","costUsd","cached","createdAt")
VALUES (
  '${usageLogId}',
  '${WORKSPACE_ID}',
  'openai',
  'gpt-4o',
  0, 0, 0, 0, 0.0, false,
  '${now}'
);
`.trim();

// Write the SQL to a temp file (avoids shell-escaping nightmares)
const sqlFile = resolve(__dir, '../tmp/seed-workspace.sql');
writeFileSync(sqlFile, seedSQL, 'utf8');
console.log('SQL to execute:\n', seedSQL, '\n');

// Run via prisma db execute (uses the dev DATABASE_URL = sqlite dev.db by default)
// For workspace.db we feed it via --url directly.
try {
  execSync(
    `npx prisma db execute --url "file:./data/projects/workspace.db" --file tmp/seed-workspace.sql`,
    { cwd: resolve(__dir, '..'), stdio: 'inherit' }
  );
  console.log('\n✅ workspace.db seeded successfully!');
  console.log('   WorkspaceSettings id :', workspaceSettingsId);
  console.log('   UsageLog id          :', usageLogId);
  console.log('\n⚠️  Remember to UPDATE the encryptedApiKey with your real key.');
} catch (err) {
  console.error('\n❌ Seed failed:', err.message);
  console.log('\nFallback: run this SQL manually in your SQLite client:');
  console.log(seedSQL);
  process.exit(1);
}
