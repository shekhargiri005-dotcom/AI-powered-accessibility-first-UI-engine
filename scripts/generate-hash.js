#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * scripts/generate-hash.js
 *
 * Generates a bcrypt password hash to put in OWNER_PASSWORD_HASH.
 *
 * Usage:
 *   node scripts/generate-hash.js
 *
 * Then paste the output into your .env.local:
 *   OWNER_PASSWORD_HASH="$2b$12$..."
 */

const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

// Hide input while typing
function askPassword(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    let password = '';

    // If running in a TTY, hide input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      const onData = (ch) => {
        ch = ch.toString();
        if (ch === '\r' || ch === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
        } else if (ch === '\u0003') {
          // Ctrl+C
          process.exit();
        } else if (ch === '\u007F') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(prompt + '*'.repeat(password.length));
          }
        } else {
          password += ch;
          process.stdout.write('*');
        }
      };

      process.stdin.on('data', onData);
    } else {
      // Fallback for non-TTY (e.g. piped input)
      rl.question('', (answer) => resolve(answer));
    }
  });
}

async function main() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   AI UI Engine — Password Hash Generator     ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');

  const password = await askPassword('  Enter your desired password:');
  const password2 = await askPassword('  Confirm password:            ');

  if (password !== password2) {
    console.error('\n  ✗ Passwords do not match. Exiting.\n');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('\n  ✗ Password must be at least 8 characters.\n');
    process.exit(1);
  }

  console.log('\n  Generating bcrypt hash (cost=12)…');
  const hash = await bcrypt.hash(password, 12);

  console.log('\n  ✔ Success! Add these lines to your .env.local:\n');
  console.log('  ─────────────────────────────────────────────────');
  console.log(`  OWNER_EMAIL="shekhargiri005@gmail.com"`);
  console.log(`  OWNER_PASSWORD_HASH="${hash}"`);
  console.log('  ─────────────────────────────────────────────────');
  console.log('');
  console.log('  ⚠  Never commit .env.local to git.\n');

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
