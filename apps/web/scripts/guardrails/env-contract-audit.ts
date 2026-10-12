#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');
const ENV_EXAMPLE_PATH = path.join(ROOT, '.env.example');

const SCAN_DIRS = [
  path.join(ROOT, 'app'),
  path.join(ROOT, 'lib'),
  path.join(ROOT, 'scripts'),
  path.join(ROOT, 'server'),
];

const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const ENV_REGEX = /process\.env\.([A-Z0-9_]+)/g;

function readDirRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      files.push(...readDirRecursive(absolutePath));
      continue;
    }

    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!FILE_EXTENSIONS.has(ext)) continue;
    files.push(absolutePath);
  }

  return files;
}

function collectUsedEnvKeys(): Set<string> {
  const used = new Set<string>();
  const files = SCAN_DIRS.flatMap(readDirRecursive);

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = ENV_REGEX.exec(content)) !== null) {
      used.add(match[1]);
    }
  }

  return used;
}

function collectExampleEnvKeys(): Set<string> {
  if (!fs.existsSync(ENV_EXAMPLE_PATH)) return new Set<string>();
  const content = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');
  const keys = new Set<string>();

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const key = line.split('=')[0]?.trim();
    if (key) keys.add(key);
  }

  return keys;
}

function printList(title: string, values: string[]) {
  console.log(`\n${title}`);
  if (values.length === 0) {
    console.log('- none');
    return;
  }
  for (const value of values) {
    console.log(`- ${value}`);
  }
}

function main() {
  const usedKeys = collectUsedEnvKeys();
  const exampleKeys = collectExampleEnvKeys();

  const usedButMissingFromExample = [...usedKeys].filter((key) => !exampleKeys.has(key)).sort();
  const exampleButUnusedInCode = [...exampleKeys].filter((key) => !usedKeys.has(key)).sort();

  console.log('[env-contract-audit] Summary');
  console.log(`- used keys in code: ${usedKeys.size}`);
  console.log(`- keys in .env.example: ${exampleKeys.size}`);

  printList('Defined in .env.example but not referenced in code', exampleButUnusedInCode);

  // Framework/CI keys are injected by the platform rather than copied into env files.
  const automatic = new Set(['HOME', 'PATH', 'VERCEL', 'VERCEL_ENV', 'VERCEL_URL', 'VERCEL_OIDC_TOKEN', 'VERCEL_GIT_COMMIT_SHA', 'GITHUB_SHA', 'COMMIT_SHA', 'NEXT_BUILD_ID', 'NEXT_PHASE', 'NODE_ENV', 'PORT', 'HOSTNAME', 'NEXT_RUNTIME']);
  const missing = usedButMissingFromExample.filter(key => !automatic.has(key));
  printList('Application keys missing from .env.example', missing);
  if (missing.length) process.exitCode = 1;

}

main();
