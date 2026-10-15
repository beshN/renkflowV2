#!/usr/bin/env tsx

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import postgres from 'postgres';

type SqlClient = {
  unsafe: (query: string, parameters?: string[]) => Promise<unknown>;
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
    parsed.searchParams.delete('channel_binding');
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
    if (isProduction && isLocalHost && !hasCloudSqlSocketHost && !parsed.port) {
      throw new Error(
        'Production localhost DATABASE_URL requires host=/cloudsql/<INSTANCE_CONNECTION_NAME> unless explicit TCP port is configured.'
      );
    }
  } catch (error) {
    throw new Error(`[ensure-backend-schema] Invalid DATABASE_URL: ${error}`);
  }
}

// Every migration file is idempotent and re-applied on each release. The ledger records which
// files reached this database and their content hash, so a file edited after it was applied (or a
// file that never reached production) can be seen with `npm run db:status`.
const LEDGER_DDL = `CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename text PRIMARY KEY,
  checksum text NOT NULL,
  first_applied_at timestamptz NOT NULL DEFAULT now(),
  last_applied_at timestamptz NOT NULL DEFAULT now(),
  apply_count integer NOT NULL DEFAULT 1
)`;

export async function ensureMigrationLedger(sql: SqlClient): Promise<void> {
  await sql.unsafe(LEDGER_DDL);
}

export function migrationChecksum(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function recordMigration(sql: SqlClient, filename: string, raw: string): Promise<void> {
  await sql.unsafe(
    `INSERT INTO public.schema_migrations (filename, checksum) VALUES ($1, $2)
     ON CONFLICT (filename) DO UPDATE
       SET checksum = EXCLUDED.checksum, last_applied_at = now(), apply_count = schema_migrations.apply_count + 1`,
    [filename, migrationChecksum(raw)],
  );
}

/** Applied by `db:deploy` before ensureBackendSchema (older additive files on top of schema.sql). */
export const DEPLOY_BOOTSTRAP_MIGRATIONS = [
  '002_add_tenant_templates.sql',
  '003_add_order_custom_fields.sql',
  '003_order_qr.sql',
  '004_inventory.sql',
  '005_inventory_stock_cache.sql',
  '0005_add_integrations.sql',
];

/** Every ledger entry a fully released database should hold, in apply order. */
export function expectedLedgerEntries(): string[] {
  return [
    ...DEPLOY_BOOTSTRAP_MIGRATIONS,
    '001_finance_tables.sql',
    ...BACKEND_MIGRATIONS,
    ...MOBILE_MIGRATIONS.map((file) => `mobile/${file}`),
  ];
}

/** Applied in this order after 001 (finance core) on every release. */
export const BACKEND_MIGRATIONS = [
  '006_accounting_tables.sql',
  '007_accounting_journal_tables.sql',
  '008_accounting_control_tables.sql',
  '009_bank_reconciliation_tables.sql',
  '010_work_orders.sql',
  '011_onboarding_support_blocking.sql',
  '012_native_manufacturing.sql',
  '013_erp_core.sql',
  '014_production_platform.sql',
  '015_procurement_workflows.sql',
  '016_quality_inspections.sql',
  '017_finance_workflows.sql',
  '018_workspace_notifications.sql',
  '019_workspace_views_cleanup.sql',
  '020_vercel_storage.sql',
  '021_warehouse_barcodes.sql',
  '022_assistant_drafts.sql',
  '023_intake_provenance.sql',
  '024_recipe_parameters.sql',
  '025_production_resources.sql',
  '026_production_analytics.sql',
  '027_quality_traceability.sql',
  '028_rate_limits.sql',
  '029_ai_suggestions.sql',
  '030_cutting_defaults.sql',
  '031_stock_model.sql',
  '032_stock_counts.sql',
  '033_opening_bar_count.sql',
  '034_price_matrices.sql',
  '035_product_family_recipes.sql',
  '036_product_configuration.sql',
  '037_production_lead.sql',
  '038_notification_json.sql',
  '039_firm_colors.sql',
  '040_record_platform.sql',
  '041_quote_order_depth.sql',
  '042_production_depth.sql',
  '043_stock_purchasing_depth.sql',
  '044_access_control.sql',
  '045_sales_service_chain.sql',
  '046_fleet.sql',
  '047_finance_foundation.sql',
  '048_ai_assistant.sql',
  '049_product_visualization.sql',
  '049_personnel.sql',
  '051_activity_log_immutable.sql',
  '052_user_mfa.sql',
  '053_e_belge_core.sql',
  '054_e_belge_addresses.sql',
  '055_exchange_rates.sql',
  '056_ledger_posting.sql',
  '057_kvkk_requests.sql',
  '058_expense_vat.sql',
  '059_attendance_policy.sql',
  '061_order_technical_files.sql',
  '062_workshop_receiving.sql',
  '063_order_loading.sql',
  '064_technical_revision_control.sql',
  '065_count_reference_mode.sql',
  '066_part_assembly.sql',
  '067_technical_transition.sql',
  '068_standard_snapshots.sql',
  '069_lead_sales_context.sql',
  '070_vertical_recipe_geometry.sql',
  '071_revision_material_decisions.sql',
  '072_company_research.sql',
];

/** Mobile API tables (sessions, offline receipts, uploads, push devices); applied after 045 (installations). */
export const MOBILE_MIGRATIONS = ['001_offline.sql', '002_installation_photos.sql', '003_push_devices.sql', '004_sessions.sql'];

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
  const mobileMigrationsDir = path.join(baseDir, 'lib', 'features', 'mobile', 'migrations');

  await ensureMigrationLedger(sql);

  const financeRaw = fs.readFileSync(path.join(migrationsDir, '001_finance_tables.sql'), 'utf8');
  const financeCoreRaw =
    financeRaw.split(
      '-- ============================================\n-- Row Level Security (RLS)\n-- ============================================'
    )[0] || financeRaw;

  await runStatements(
    sql,
    '001_finance_tables (core)',
    [financeCoreRaw],
    prefix
  );
  await recordMigration(sql, '001_finance_tables.sql', financeCoreRaw);

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

  for (const file of BACKEND_MIGRATIONS) {
    const raw = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    // postgres.js unsafe() uses the simple protocol when there are no parameters.
    // Send the whole file so PostgreSQL parses DO blocks, functions and quoted
    // semicolons, and rolls back the file's statements together on an error.
    await runStatements(sql, file, [raw], prefix);
    await recordMigration(sql, file, raw);
  }

  for (const file of MOBILE_MIGRATIONS) {
    const raw = fs.readFileSync(path.join(mobileMigrationsDir, file), 'utf8');
    await runStatements(sql, `mobile/${file}`, [raw], prefix);
    await recordMigration(sql, `mobile/${file}`, raw);
  }
}

async function main() {
  dotenv.config({ path: '.env.local' });
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
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
