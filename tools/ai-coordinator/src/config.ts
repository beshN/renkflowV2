import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Config } from './types.ts';

export const DEFAULT_CONFIG: Config = {
  models: {
    argon: { cli: 'gemini', model: null, label: 'Gemini 4 Argon', role: 'Ana geliştirici: UX ve fabrika simülasyonu' },
    sol: { cli: 'codex', model: null, label: 'GPT-6.1 Sol', role: 'Mimari, kritik iş kuralları, güvenlik, bağımsız denetim' },
    sonnet: { cli: 'claude', model: null, label: 'Claude Sonnet 5.5', role: 'Koordinatör: planlama, kritik karar, anlaşmazlık çözümü' },
  },
  limits: {
    timeoutMs: 15 * 60_000,
    maxAttempts: 3,
    maxTotalRuns: 60,
    maxRunsPerTask: 8,
    maxTotalUsd: 25,
    maxUsdPerRun: 2,
    maxConsecutiveFailures: 3,
  },
  checks: {
    docs: [],
    audit: [],
    simulation: [],
    code: [
      { name: 'type-check', command: 'npm run type-check', cwd: 'apps/web', timeoutMs: 10 * 60_000 },
      { name: 'lint', command: 'npm run lint', cwd: 'apps/web', timeoutMs: 10 * 60_000 },
      { name: 'unit-tests', command: 'npm test -- --runInBand', cwd: 'apps/web', timeoutMs: 20 * 60_000 },
    ],
  },
  docsAllowedPrefixes: ['ai-workspace'],
  protectedBranches: ['main', 'master', 'production', 'release'],
  worktreeRoot: '.ai-worktrees',
  envAllowlist: ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TERM', 'TMPDIR', 'USER', 'SHELL', 'NODE_OPTIONS',
    'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_USE_VERTEXAI', 'GOOGLE_GENAI_USE_GCA', 'GOOGLE_CLOUD_PROJECT', 'GOOGLE_CLOUD_LOCATION',
    'OPENAI_API_KEY', 'CODEX_HOME',
    'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CONFIG_DIR',
    'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'no_proxy', 'SSL_CERT_FILE', 'NODE_EXTRA_CA_CERTS', 'CURL_CA_BUNDLE'],
};

export function findRepoRoot(from = process.cwd()): string {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, 'ai-workspace')) && existsSync(join(dir, '.git'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) throw new Error('RenkFlow repo kökü bulunamadı (ai-workspace/ + .git yok).');
    dir = parent;
  }
}

/** ai-workspace/coordinator.config.json overrides defaults (shallow-merged per section). */
export async function loadConfig(repoRoot: string): Promise<Config> {
  const path = join(repoRoot, 'ai-workspace', 'coordinator.config.json');
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const o = JSON.parse(await readFile(path, 'utf8')) as Partial<Config>;
  const models = { ...DEFAULT_CONFIG.models };
  for (const k of Object.keys(o.models ?? {}) as (keyof Config['models'])[]) models[k] = { ...models[k], ...o.models![k] };
  return {
    ...DEFAULT_CONFIG,
    ...o,
    models,
    limits: { ...DEFAULT_CONFIG.limits, ...o.limits },
    checks: { ...DEFAULT_CONFIG.checks, ...o.checks },
  };
}
