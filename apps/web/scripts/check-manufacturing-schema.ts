#!/usr/bin/env tsx

import dotenv from 'dotenv';
import postgres from 'postgres';

// Inspect metadata only. This command never applies a migration or seeds data.
const requiredTables = [
  'tenants', 'users', 'tenant_members', 'orders', 'documents', 'inventory_items',
  'work_orders', 'work_order_events', 'warehouses', 'stock_lots', 'stock_entries',
  'stock_entry_lines', 'stock_balances', 'boms', 'bom_items', 'work_order_materials',
  'stock_reservations', 'stock_reservation_lines', 'production_runs',
  'scrap_records', 'material_requests', 'material_request_lines',
  'purchase_orders', 'purchase_order_lines', 'goods_receipts', 'goods_receipt_lines',
  'document_extractions',
];
const requiredColumns: Record<string, string[]> = {
  inventory_items: ['item_type', 'stock_uom', 'profile_section', 'standard_length_m', 'weight_per_meter_kg', 'metadata'],
  work_orders: [
    'order_id', 'bom_id', 'production_item_id', 'planned_qty', 'produced_qty',
    'production_uom', 'source_warehouse_id', 'wip_warehouse_id', 'target_warehouse_id',
    'scrap_warehouse_id', 'reservation_status', 'manufacturing_idempotency_key',
  ],
};

async function main() {
  dotenv.config({ path: '.env.local', quiet: true });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL tanımlı değil. .env.local dosyasını yapılandırın.');
    process.exitCode = 1;
    return;
  }

  const parsed = new URL(databaseUrl);
  const socketHost = parsed.searchParams.get('host');
  if (socketHost?.startsWith('/')) parsed.searchParams.delete('host');
  const sql = postgres(parsed.toString(), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    ...(socketHost?.startsWith('/') ? { host: socketHost } : {}),
  });
  try {
    const report = await sql.begin('read only', async (tx) => {
      const tables = await tx<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `;
      const columns = await tx<{ table_name: string; column_name: string }[]>`
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public'
      `;
      const existingTables = new Set(tables.map((row) => row.table_name));
      const existingColumns = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));
      const missingTables = requiredTables.filter((table) => !existingTables.has(table));
      const missingColumns = Object.entries(requiredColumns).flatMap(([table, names]) =>
        existingTables.has(table)
          ? names.map((name) => `${table}.${name}`).filter((name) => !existingColumns.has(name))
          : [],
      );
      return { missingTables, missingColumns };
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.missingTables.length || report.missingColumns.length) {
      console.error('Native stok şeması eksik. Migration ve pilotu ayrı test veritabanında doğrulayın.');
      process.exitCode = 1;
    } else {
      console.log('Beklenen tablolar ve üretim alanları mevcut. Bu kontrol pilot veya veri bütünlüğü doğrulaması değildir.');
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  // Do not print a connection URL, credentials, or server error detail.
  console.error('Şema kontrolü başarısız:', error instanceof Error ? error.name : 'UnknownError');
  process.exitCode = 1;
});
