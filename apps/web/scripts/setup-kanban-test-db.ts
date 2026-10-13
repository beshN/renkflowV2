import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { ensureBackendSchema } from './ensure-backend-schema';
async function main() {
 const admin=postgres('postgres://postgres@127.0.0.1:55439/postgres',{onnotice:()=>{}});
 if (!(await admin`SELECT 1 FROM pg_database WHERE datname='renkflow_kanban_test'`).length) await admin.unsafe("CREATE DATABASE renkflow_kanban_test ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0");
 await admin.end();
 const db=postgres('postgres://postgres@127.0.0.1:55439/renkflow_kanban_test',{onnotice:()=>{}});
 if (!(await db`SELECT to_regclass('public.orders') AS name`)[0].name) {
  await db.unsafe(readFileSync('lib/db/schema.sql','utf8'));
  for(const f of ['002_add_tenant_templates.sql','003_add_order_custom_fields.sql','003_order_qr.sql','004_inventory.sql','005_inventory_stock_cache.sql']) await db.unsafe(readFileSync('lib/db/migrations/'+f,'utf8'));
 }
 await ensureBackendSchema(db,{logPrefix:'[kanban local test]'}); await db.end(); console.log('Isolated Kanban database ready on 127.0.0.1:55439.');
}
main().catch(e=>{ console.error(e);process.exit(1); });
