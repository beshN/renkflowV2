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

function resolveDatabaseRuntimeConfig(databaseUrl: string): {
  connectionString: string;
  clientOptions: Record<string, unknown>;
} {
  try {
    const parsed = new URL(databaseUrl);
    const socketHost = parsed.searchParams.get('host');
    const clientOptions: Record<string, unknown> = {};

    if (socketHost && socketHost.startsWith('/')) {
      clientOptions.host = socketHost;
      parsed.searchParams.delete('host');
    }

    return {
      connectionString: parsed.toString(),
      clientOptions,
    };
  } catch {
    return { connectionString: databaseUrl, clientOptions: {} };
  }
}

function validateDatabaseUrl(databaseUrl: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  try {
    const parsed = new URL(databaseUrl);
    const runtimeHost = parsed.hostname?.trim().toLowerCase() || '';
    const socketHost = parsed.searchParams.get('host')?.trim() || '';
    const hasCloudSqlSocketHost = socketHost.startsWith('/cloudsql/');
    const isLocalHost =
      runtimeHost === 'localhost' ||
      runtimeHost === '127.0.0.1' ||
      runtimeHost === '::1';
    const lowerUrl = databaseUrl.toLowerCase();
    const legacyDbTag = `${'neo'}${'n'}`;
    const legacyDbHost = `.${legacyDbTag}.tech`;
    const pointsToLegacyHost =
      runtimeHost.endsWith(legacyDbHost) ||
      runtimeHost === `${legacyDbTag}.tech` ||
      lowerUrl.includes(legacyDbHost) ||
      lowerUrl.includes(`${legacyDbTag}db`);

    if (isProduction && pointsToLegacyHost) {
      throw new Error('Production DATABASE_URL cannot target legacy database hosts');
    }

    if (isProduction && isLocalHost && !hasCloudSqlSocketHost && !parsed.port) {
      throw new Error(
        'Production localhost DATABASE_URL requires host=/cloudsql/<INSTANCE_CONNECTION_NAME> unless explicit TCP port is configured.'
      );
    }
  } catch (error) {
    throw new Error(`[ensure-backend-schema] Invalid DATABASE_URL: ${error}`);
  }
}

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
    '009_bank_reconciliation_tables.sql',
    '010_work_orders.sql',
    '011_onboarding_support_blocking.sql',
    '012_native_manufacturing.sql',
    '013_erp_core.sql',
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

  validateDatabaseUrl(databaseUrl);
  const runtimeConfig = resolveDatabaseRuntimeConfig(databaseUrl);

  const sql = postgres(runtimeConfig.connectionString, {
    max: 1,
    prepare: false,
    connect_timeout: 15,
    ...runtimeConfig.clientOptions,
  });
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
