#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import postgres from 'postgres';

type SqlClient = {
  unsafe: (query: string) => Promise<unknown>;
};

type EnsureOptions = {
  baseDir?: string;
  logPrefix?: string;
};

function removeLineComments(content: string): string {
  return content
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
}

function splitStatements(content: string): string[] {
  return content
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function runStatements(sql: SqlClient, label: string, statements: string[], prefix: string) {
  let applied = 0;
  for (const statement of statements) {
    await sql.unsafe(statement);
    applied += 1;
  }
  console.log(`${prefix} ${label}: applied ${applied} statements`);
}

export async function ensureBackendSchema(sql: SqlClient, options: EnsureOptions = {}): Promise<void> {
  const baseDir = options.baseDir || path.join(__dirname, '..');
  const prefix = options.logPrefix || '[ensure-backend-schema]';
  const migrationsDir = path.join(baseDir, 'lib', 'db', 'migrations');

  const financeRaw = fs.readFileSync(path.join(migrationsDir, '001_finance_tables.sql'), 'utf8');
  const financeCoreRaw =
    financeRaw.split(
      '-- ============================================\n-- Row Level Security (RLS)\n-- ============================================'
    )[0] || financeRaw;

  await runStatements(
    sql,
    '001_finance_tables (core)',
    splitStatements(removeLineComments(financeCoreRaw)),
    prefix
  );

  await runStatements(
    sql,
    'finance role constraints',
    [
      "ALTER TABLE public.tenant_members DROP CONSTRAINT IF EXISTS tenant_members_role_check",
      "ALTER TABLE public.tenant_members ADD CONSTRAINT tenant_members_role_check CHECK (role IN ('owner', 'admin', 'accountant', 'office', 'worker', 'member'))",
      "ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_role_check",
      "ALTER TABLE public.invitations ADD CONSTRAINT invitations_role_check CHECK (role IN ('admin', 'accountant', 'office', 'worker', 'member'))",
    ],
    prefix
  );

  for (const file of [
    '006_accounting_tables.sql',
    '007_accounting_journal_tables.sql',
    '008_accounting_control_tables.sql',
  ]) {
    const raw = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await runStatements(sql, file, splitStatements(removeLineComments(raw)), prefix);
  }
}

async function main() {
  dotenv.config({ path: '.env.local' });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[ensure-backend-schema] DATABASE_URL not found');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 15 });
  try {
    await ensureBackendSchema(sql);
    console.log('[ensure-backend-schema] completed successfully');
  } catch (error) {
    console.error('[ensure-backend-schema] failed:', error);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const invokedAsScript = (process.argv[1] || '').includes('ensure-backend-schema');
if (invokedAsScript) {
  void main();
}
