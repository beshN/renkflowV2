import { mkdir, rename, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

export const nowIso = (): string => new Date().toISOString();
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /AIza[0-9A-Za-z_-]{30,}/g,
  /gh[pousr]_[A-Za-z0-9]{30,}/g,
  /github_pat_[A-Za-z0-9_]{30,}/g,
  /xox[abprs]-[A-Za-z0-9-]{10,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/]+:[^\s@]+@/gi,
  /Bearer\s+[A-Za-z0-9._~+/-]{16,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];
const ASSIGNMENT = /\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|DATABASE_URL|POSTGRES_URL)[A-Z0-9_]*)\s*[=:]\s*(['"]?)[^\s'"]{4,}\2/g;

/** Strips secrets before anything is persisted to reports, events or task records. */
export function redact(text: string): string {
  let out = text;
  for (const p of SECRET_PATTERNS) out = out.replace(p, '[REDACTED]');
  return out.replace(ASSIGNMENT, '$1=[REDACTED]');
}

export const tail = (text: string, max = 4000): string => (text.length > max ? `…${text.slice(-max)}` : text);

export async function atomicWrite(path: string, data: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, data, 'utf8');
  await rename(tmp, path);
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

/**
 * Cross-process mutex built on atomic mkdir. A lock older than `staleMs` (crashed holder)
 * is broken. Every read-modify-write of shared coordinator state goes through this.
 */
export async function withLock<T>(lockPath: string, fn: () => Promise<T>, opts: { staleMs?: number; waitMs?: number } = {}): Promise<T> {
  const staleMs = opts.staleMs ?? 30_000;
  const deadline = Date.now() + (opts.waitMs ?? 20_000);
  for (;;) {
    try {
      await mkdir(lockPath);
      await writeFile(`${lockPath}/owner`, `${process.pid} ${nowIso()}\n`).catch(() => undefined);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      const age = await stat(lockPath).then((s) => Date.now() - s.mtimeMs).catch(() => 0);
      if (age > staleMs) {
        await rm(lockPath, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline) throw new Error(`Lock timeout: ${lockPath}`);
      await sleep(25 + Math.random() * 50);
    }
  }
  try {
    return await fn();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}

/** True when two repo-relative paths are equal or one contains the other. */
export function pathsOverlap(a: string, b: string): boolean {
  const n = (p: string) => p.replace(/^\.\//, '').replace(/\/+$/, '');
  const x = n(a);
  const y = n(b);
  return x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`);
}

export function isWithin(path: string, prefixes: string[]): boolean {
  const p = path.replace(/^\.\//, '');
  return prefixes.some((pre) => {
    const q = pre.replace(/^\.\//, '').replace(/\/+$/, '');
    return p === q || p.startsWith(`${q}/`);
  });
}
