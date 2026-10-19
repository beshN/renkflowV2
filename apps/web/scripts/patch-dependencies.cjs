#!/usr/bin/env node
/**
 * Patches applied to installed dependencies (run after every install and before the Vercel build).
 *
 * postgres.js (3.4.8 and 3.4.9): when a backend connection is closed under a transaction (Neon
 * restarting a compute, a network drop, pg_terminate_backend), the transaction's ROLLBACK is written
 * to the dead connection and a scheduled write throws `TypeError: Cannot read properties of null
 * (reading 'write')` outside any promise, which kills the whole Node process — every request in
 * flight on that server fails. Guarded write: the closed connection drops the bytes (the server has
 * already rolled the transaction back with the connection). Reproduced in
 * scripts/test-factory-stress.ts ("a dropped database connection in the middle of a command").
 *
 * Idempotent. If the code to patch is not found (the library changed), the install fails loudly so
 * the patch is reviewed instead of silently disappearing.
 */
const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'RenkFlow patch: the connection may already be closed';
const ORIGINAL = '  function nextWrite(fn) {\n    const x = socket.write(chunk, fn)';
const PATCHED = `  function nextWrite(fn) {
    // ${MARKER} (terminated backend, network drop); a write
    // scheduled before or after that must not throw an uncaught TypeError and crash the process.
    if (!socket) {
      nextWriteTimer !== null && clearImmediate(nextWriteTimer)
      chunk = nextWriteTimer = null
      return false
    }
    const x = socket.write(chunk, fn)`;

function postgresRoots() {
  const roots = new Set();
  for (const base of [path.join(__dirname, '..'), path.join(__dirname, '../../..')]) {
    const dir = path.join(base, 'node_modules/postgres');
    if (fs.existsSync(path.join(dir, 'package.json'))) roots.add(fs.realpathSync(dir));
  }
  return [...roots];
}

let patched = 0;
const roots = postgresRoots();
if (!roots.length) {
  console.log('[patch-dependencies] postgres not installed here; nothing to patch');
  process.exit(0);
}
for (const root of roots) {
  for (const rel of ['cjs/src/connection.js', 'src/connection.js', 'cf/src/connection.js']) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (source.includes(MARKER)) continue;
    if (!source.includes(ORIGINAL)) {
      console.error(`[patch-dependencies] ${file}: the code to patch was not found. postgres.js changed; check whether the dead-connection write crash is fixed upstream and update scripts/patch-dependencies.cjs.`);
      process.exit(1);
    }
    fs.writeFileSync(file, source.replace(ORIGINAL, PATCHED));
    patched++;
  }
}
console.log(`[patch-dependencies] postgres.js dead-connection write guard: ${patched ? `applied to ${patched} file(s)` : 'already applied'}`);
