#!/usr/bin/env tsx
import dotenv from 'dotenv';
import postgres from 'postgres';
import { checkPilotReadiness, pilotColumns, type Finding, type PilotRows, type Row } from '../lib/features/manufacturing/pilot-readiness';

const json = process.argv.includes('--json');
function output(findings: Finding[]) {
  if (json) console.log(JSON.stringify(findings, null, 2));
  else console.table(findings.map(f => ({ Kod: f.code, Önem: { blocker: 'Engel', warning: 'Uyarı', info: 'Bilgi' }[f.severity], Bulgu: f.message, Öneri: f.hint })));
  if (findings.some(f => f.severity === 'blocker')) process.exitCode = 1;
}
async function main() {
  dotenv.config({ path: '.env.local', quiet: true });
  if (!process.env.DATABASE_URL) {
    output([{ code: 'DATABASE_CONFIG', severity: 'blocker', message: 'DATABASE_URL tanımlı değil.', hint: 'Ayrı test veritabanı için .env.local dosyasını yapılandırın.' }]);
    return;
  }
  const parsed = new URL(process.env.DATABASE_URL);
  const socketHost = parsed.searchParams.get('host');
  if (socketHost?.startsWith('/')) parsed.searchParams.delete('host');
  const sql = postgres(parsed.toString(), { max: 1, prepare: false, connect_timeout: 10, ...(socketHost?.startsWith('/') ? { host: socketHost } : {}) });
  try {
    const findings = await sql.begin('read only', async tx => {
      const tables = await tx<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
      const columns = await tx<{ table_name: string; column_name: string }[]>`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'`;
      const read = async (table: string): Promise<Row[]> => {
        if (!tables.some(r => r.table_name === table) || !pilotColumns[table].every(c => columns.some(r => r.table_name === table && r.column_name === c))) return [];
        // Read only the fixed assessment fields, never unrelated row payloads.
        const names = [...new Set([...pilotColumns[table], ...(table === 'inventory_items' ? ['weight_per_meter_kg', 'standard_length_m', 'profile_section'] : [])])];
        if (table === 'tenant_members' && columns.some(r => r.table_name === table && r.column_name === 'deactivated_at')) names.push('deactivated_at');
        const available = names.filter(c => columns.some(r => r.table_name === table && r.column_name === c));
        return await tx<Row[]>`SELECT ${tx(available)} FROM public.${tx(table)}`;
      };
      const input: PilotRows = { tables, columns, families: await read('product_family_recipes'), recipes: await read('production_recipes'), items: await read('inventory_items'), centers: await read('work_centers'), members: await read('tenant_members'), resources: await read('production_resources'), lots: await read('stock_lots'), balances: await read('stock_balances') };
      return checkPilotReadiness(input);
    });
    output(findings);
  } finally { await sql.end({ timeout: 5 }); }
}
main().catch(() => {
  // Never expose connection URLs, server details, or arbitrary exception messages.
  output([{ code: 'READ_FAILED', severity: 'blocker', message: 'Pilot hazırlık kontrolü tamamlanamadı.', hint: 'Bağlantı ayarlarını ve okuma izinlerini güvenli ortamda kontrol edin.' }]);
});
