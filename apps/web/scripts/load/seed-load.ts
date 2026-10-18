/**
 * Synthetic data for load tests, only into a local *_migration_test database (never a remote one).
 * One busy factory (customers, orders, items, 100 members) plus 40 other firms as background volume,
 * so queries run against a realistic multi-firm table size.
 *
 *   LOAD_DATABASE_URL=postgres://…/renkflow_load_migration_test npx tsx scripts/load/seed-load.ts
 */
import { writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const url = process.env.LOAD_DATABASE_URL || '';
const parsed = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.endsWith('_migration_test')) {
  throw new Error('Load data goes only into a local *_migration_test database');
}

async function main() {
  const db = postgres(url, { onnotice: () => {}, max: 4 });
  const password = 'Load-test-only-' + Math.random().toString(36).slice(2, 10) + '!A1';
  const hash = await bcrypt.hash(password, 10);

  async function firm(name: string, customers: number, orders: number, itemsPerOrder: number) {
    const [t] = await db`INSERT INTO tenants (name, slug) VALUES (${name}, ${'load-' + Math.random().toString(36).slice(2)}) RETURNING id`;
    await db`INSERT INTO customers (tenant_id, full_name, company_name, phone, email, created_at)
      SELECT ${t.id}, 'Müşteri ' || g, CASE WHEN g % 3 = 0 THEN 'Firma ' || g END, '0532' || lpad(g::text, 7, '0'), 'm' || g || '@example.invalid', now() - (g || ' minutes')::interval
      FROM generate_series(1, ${customers}) g`;
    await db`INSERT INTO orders (tenant_id, order_number, customer_id, customer_name, status, total_amount, currency, product_name, delivery_date, created_at)
      SELECT ${t.id}, 'L-' || g, c.id, c.full_name, (ARRAY['new','approved','in_production','ready','delivered'])[1 + g % 5], 1000 + g % 9000, 'TRY', 'Pergola', current_date + (g % 60), now() - (g || ' minutes')::interval
      FROM generate_series(1, ${orders}) g
      JOIN LATERAL (SELECT id, full_name FROM customers WHERE tenant_id = ${t.id} ORDER BY id OFFSET (g % ${customers}) LIMIT 1) c ON true`;
    await db`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price)
      SELECT o.id, 'Kalem ' || k, 1, 500, 500 FROM orders o, generate_series(1, ${itemsPerOrder}) k WHERE o.tenant_id = ${t.id}`;
    return t.id as string;
  }

  const main = await firm('Yük Fabrikası', 3000, 8000, 3);
  const users: Array<{ email: string; role: string }> = [];
  for (let i = 1; i <= 100; i++) {
    const role = i === 1 ? 'owner' : i <= 30 ? 'office' : i <= 40 ? 'accountant' : 'worker';
    const email = `load-${i}-${main.slice(0, 6)}@example.invalid`;
    const [u] = await db`INSERT INTO users (name, email, password, email_verified) VALUES (${'Kullanıcı ' + i}, ${email}, ${hash}, now()) RETURNING id`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${main}, ${u.id}, ${role})`;
    users.push({ email, role });
  }
  for (let f = 1; f <= 40; f++) await firm('Arka plan ' + f, 1000, 3000, 2);
  await db`ANALYZE`;
  const [counts] = await db`SELECT (SELECT count(*) FROM orders)::int AS orders, (SELECT count(*) FROM order_items)::int AS items, (SELECT count(*) FROM customers)::int AS customers, (SELECT count(*) FROM tenants)::int AS tenants`;
  writeFileSync(process.env.LOAD_USERS_FILE || '/tmp/load-users.json', JSON.stringify({ tenantId: main, password, users }), { mode: 0o600 });
  console.log('seeded', counts);
  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
