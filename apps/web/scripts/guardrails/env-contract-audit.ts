#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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

const SECRET_ALLOWLIST = new Set([
  'DB_PASSWORD', // Operational secret for migration tooling
]);

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

function listSecretManagerKeys(): string[] {
  const result = spawnSync(
    'gcloud',
    ['secrets', 'list', '--format=value(name)'],
    { encoding: 'utf8' }
  );

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
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

  printList('Used in code but missing from .env.example', usedButMissingFromExample);
  printList('Defined in .env.example but not referenced in code', exampleButUnusedInCode);

  const secretManagerKeys = listSecretManagerKeys();
  if (secretManagerKeys.length > 0) {
    const unusedSecrets = secretManagerKeys
      .filter((secret) => !usedKeys.has(secret) && !SECRET_ALLOWLIST.has(secret))
      .sort();
    printList('Secret Manager keys not referenced in runtime code', unusedSecrets);
  } else {
    console.log('\nSecret Manager keys not checked (gcloud unavailable or not authenticated).');
  }
}

main();
