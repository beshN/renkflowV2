#!/usr/bin/env node
/**
 * Load test against a local production build (`next start`) on a local *_migration_test database
 * seeded by seed-load.ts. Never point this at a deployed site or a remote database.
 *
 *   LOAD_BASE_URL=http://127.0.0.1:3230 LOAD_DATABASE_URL=postgres://…_migration_test \
 *   LOAD_USERS_FILE=… LOAD_LEVELS=10,50,100 LOAD_SECONDS=30 node scripts/load/run-load.mjs
 *
 * Each virtual user signs in through the real credentials flow, then loops over a weighted mix of
 * what people do all day (lists, details, dashboards, search; office roles also write). Reports
 * p50/p95/p99 per endpoint, error rate, throughput and database activity per level.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

const BASE = process.env.LOAD_BASE_URL || 'http://127.0.0.1:3230';
const DB_URL = process.env.LOAD_DATABASE_URL || '';
const db = new URL(DB_URL);
if (!['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname) || !['127.0.0.1', 'localhost'].includes(db.hostname) || !db.pathname.endsWith('_migration_test')) {
  throw new Error('Load tests run only against a local server and a local *_migration_test database');
}
const LEVELS = (process.env.LOAD_LEVELS || '10,50,100').split(',').map(Number);
const SECONDS = Number(process.env.LOAD_SECONDS || 30);
const { password, users } = JSON.parse(readFileSync(process.env.LOAD_USERS_FILE, 'utf8'));
const sql = postgres(DB_URL, { max: 2, onnotice: () => {} });

function cookieJar() {
  const jar = new Map();
  return {
    store(res) { for (const c of res.headers.getSetCookie?.() ?? []) { const [pair] = c.split(';'); const i = pair.indexOf('='); jar.set(pair.slice(0, i), pair.slice(i + 1)); } },
    header() { return [...jar].map(([k, v]) => `${k}=${v}`).join('; '); },
    has(name) { return [...jar.keys()].some((k) => k.includes(name)); },
  };
}

async function signIn(user, n) {
  const jar = cookieJar();
  const csrf = await fetch(`${BASE}/api/auth/csrf`, { headers: { 'x-forwarded-for': `10.20.${Math.floor(n / 250)}.${n % 250 + 1}` } });
  jar.store(csrf);
  const { csrfToken } = await csrf.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: jar.header(), 'x-forwarded-for': `10.20.${Math.floor(n / 250)}.${n % 250 + 1}`, origin: BASE },
    body: new URLSearchParams({ email: user.email, password, csrfToken, callbackUrl: `${BASE}/dashboard` }),
  });
  jar.store(res);
  if (!jar.has('session-token')) throw new Error(`sign-in failed for ${user.email}: ${res.status}`);
  return jar;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
let orderIds = [];

function scenarios(role) {
  const read = [
    [25, 'orders list', () => ({ path: `/api/v1/orders?page=${1 + Math.floor(Math.random() * 5)}&limit=25` })],
    [15, 'order detail', () => ({ path: `/api/v1/orders/${pick(orderIds)}` })],
    [15, 'customers list', () => ({ path: `/api/v1/customers?page=${1 + Math.floor(Math.random() * 5)}&pageSize=25` })],
    [10, 'customer search', () => ({ path: `/api/v1/customers?search=${encodeURIComponent('Müşteri ' + Math.floor(Math.random() * 3000))}&page=1&pageSize=25` })],
    [10, 'dashboard summary', () => ({ path: '/api/analytics/summary' })],
    [10, 'production board', () => ({ path: '/api/v1/production' })],
    [5, 'warehouse', () => ({ path: '/api/v1/warehouse' })],
    [10, 'global search', () => ({ path: `/api/v1/search/all?q=${encodeURIComponent('L-' + Math.floor(Math.random() * 8000))}` })],
  ];
  const write = [
    [5, 'create customer', () => ({ path: '/api/v1/customers', method: 'POST', body: { fullName: 'Yük Müşterisi ' + randomUUID().slice(0, 8), phone: '0555' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0') } })],
  ];
  // Only what each role may open (accountants have no production board; workers see the floor).
  const exclude = new Set((process.env.LOAD_EXCLUDE || '').split(',').filter(Boolean));
  const allowed = ['owner', 'office'].includes(role) ? [...read, ...write]
    : role === 'worker' ? read.filter(([, name]) => ['production board', 'warehouse', 'order detail', 'orders list'].includes(name))
    : read.filter(([, name]) => !['production board', 'warehouse'].includes(name));
  return allowed.filter(([, name]) => !exclude.has(name));
}

function choose(mix) {
  const total = mix.reduce((s, [w]) => s + w, 0);
  let r = Math.random() * total;
  for (const m of mix) { if ((r -= m[0]) <= 0) return m; }
  return mix[0];
}

async function level(concurrency, sessions) {
  const stats = new Map();
  const record = (name, ms, ok, status) => {
    const s = stats.get(name) || { times: [], errors: 0, codes: {} };
    s.times.push(ms); if (!ok) { s.errors++; s.codes[status] = (s.codes[status] || 0) + 1; }
    stats.set(name, s);
  };
  const [before] = await sql`SELECT xact_commit, xact_rollback, tup_returned FROM pg_stat_database WHERE datname = current_database()`;
  const seqBefore = Object.fromEntries((await sql`SELECT relname, seq_scan, seq_tup_read FROM pg_stat_user_tables WHERE relname IN ('orders','order_items','customers','work_orders','stock_balances')`).map((r) => [r.relname, r]));
  let maxConnections = 0;
  const sampler = setInterval(async () => {
    const [r] = await sql`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND state <> 'idle'`;
    maxConnections = Math.max(maxConnections, r.n);
  }, 250);
  const end = Date.now() + SECONDS * 1000;
  await Promise.all(Array.from({ length: concurrency }, async (_, v) => {
    const s = sessions[v % sessions.length];
    const mix = scenarios(s.role);
    while (Date.now() < end) {
      const [, name, make] = choose(mix);
      const req = make();
      const started = performance.now();
      try {
        const res = await fetch(BASE + req.path, {
          method: req.method || 'GET',
          headers: { cookie: s.jar.header(), 'content-type': 'application/json', origin: BASE, 'x-forwarded-for': `10.30.0.${v % 250 + 1}` },
          body: req.body ? JSON.stringify(req.body) : undefined,
          signal: AbortSignal.timeout(30_000),
        });
        await res.arrayBuffer();
        record(name, performance.now() - started, res.status < 400 || res.status === 404, res.status);
      } catch (e) {
        record(name, performance.now() - started, false, e.name === 'TimeoutError' ? 'timeout' : 'network');
      }
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 600)); // think time between clicks
    }
  }));
  clearInterval(sampler);
  const [after] = await sql`SELECT xact_commit, xact_rollback, tup_returned FROM pg_stat_database WHERE datname = current_database()`;
  const seqAfter = await sql`SELECT relname, seq_scan, seq_tup_read FROM pg_stat_user_tables WHERE relname IN ('orders','order_items','customers','work_orders','stock_balances')`;
  const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
  const rows = [...stats].map(([name, s]) => ({ endpoint: name, requests: s.times.length, p50: Math.round(q(s.times, 0.5)), p95: Math.round(q(s.times, 0.95)), p99: Math.round(q(s.times, 0.99)), errors: s.errors, codes: s.codes }));
  const total = rows.reduce((t, r) => t + r.requests, 0);
  const errors = rows.reduce((t, r) => t + r.errors, 0);
  return {
    concurrency, seconds: SECONDS, requests: total, rps: Math.round(total / SECONDS), errorRate: total ? +(100 * errors / total).toFixed(2) : 0,
    p95All: Math.round(q(rows.flatMap((r) => stats.get(r.endpoint).times), 0.95)),
    db: { commits: Number(after.xact_commit) - Number(before.xact_commit), rollbacks: Number(after.xact_rollback) - Number(before.xact_rollback), rowsRead: Number(after.tup_returned) - Number(before.tup_returned), maxActiveConnections: maxConnections,
      seqScans: Object.fromEntries(seqAfter.map((r) => [r.relname, `${Number(r.seq_scan) - Number(seqBefore[r.relname]?.seq_scan ?? 0)} scans / ${Number(r.seq_tup_read) - Number(seqBefore[r.relname]?.seq_tup_read ?? 0)} rows`])) },
    endpoints: rows.sort((a, b) => b.p95 - a.p95),
  };
}

const sessions = [];
for (let i = 0; i < users.length; i += 10) {
  const batch = await Promise.all(users.slice(i, i + 10).map(async (u, k) => ({ role: u.role, jar: await signIn(u, i + k) })));
  sessions.push(...batch);
}
const tenantOrders = await sql`SELECT o.id FROM orders o JOIN tenants t ON t.id = o.tenant_id WHERE t.name = 'Yük Fabrikası' ORDER BY random() LIMIT 500`;
orderIds = tenantOrders.map((r) => r.id);
console.log(`signed in ${sessions.length} users`);
const results = [];
for (const c of LEVELS) {
  const r = await level(c, sessions);
  results.push(r);
  console.log(JSON.stringify({ concurrency: r.concurrency, requests: r.requests, rps: r.rps, errorRate: r.errorRate, p95All: r.p95All, db: r.db }));
  for (const e of r.endpoints) console.log(`   ${e.endpoint.padEnd(18)} n=${String(e.requests).padStart(5)}  p50=${String(e.p50).padStart(5)}ms  p95=${String(e.p95).padStart(5)}ms  p99=${String(e.p99).padStart(5)}ms  errors=${e.errors}${e.errors ? ' ' + JSON.stringify(e.codes) : ''}`);
}
if (process.env.LOAD_REPORT) writeFileSync(process.env.LOAD_REPORT, JSON.stringify(results, null, 1));
await sql.end();
