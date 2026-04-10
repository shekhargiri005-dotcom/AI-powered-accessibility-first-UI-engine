/**
 * Reads workspace.db table names directly from the SQLite binary without any npm deps.
 * SQLite page 1 contains the sqlite_master table.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dir, '../data/projects/workspace.db');
const buf = readFileSync(dbPath);

// --- SQLite file header (100 bytes) ---
const magic = buf.slice(0, 16).toString('ascii');
const pageSize = (buf[16] << 8) | buf[17];
const pageCount = buf.readUInt32BE(28);
const textEncoding = buf.readUInt32BE(56); // 1=UTF-8, 2=UTF-16le, 3=UTF-16be

console.log('=== SQLite Header ===');
console.log('Magic     :', magic.replace(/\x00/g, '\\0'));
console.log('Page size :', pageSize);
console.log('Pages     :', pageCount);
console.log('Encoding  :', textEncoding === 1 ? 'UTF-8' : 'UTF-16');

// Scan the whole file for ASCII strings that look like SQL DDL
// (CREATE TABLE, etc.) — a heuristic that works even without B-tree parsing.
const raw = buf.toString('latin1');

const ddlMatches = [...raw.matchAll(/CREATE TABLE[^(]+\([^;]+?(?=CREATE TABLE|$)/gi)];
if (ddlMatches.length > 0) {
  console.log('\n=== DDL Statements Found ===');
  ddlMatches.forEach((m, i) => {
    const cleaned = m[0].replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`\n[${i + 1}] ${cleaned.substring(0, 600)}`);
  });
} else {
  console.log('\nNo CREATE TABLE statements found — database may be empty or use non-ASCII names.');
}

// Also scan for table name hints in strings like "sqlite_sequence" or known schema patterns
const tableNameRe = /"([A-Za-z_][A-Za-z0-9_]*)"/g;
const seen = new Set();
for (const m of raw.matchAll(tableNameRe)) {
  if (!seen.has(m[1])) { seen.add(m[1]); }
}
if (seen.size > 0) {
  console.log('\n=== Quoted identifiers found ===');
  console.log([...seen].join(', '));
}
