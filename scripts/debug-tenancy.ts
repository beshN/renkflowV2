
import { config } from 'dotenv';
config({ path: '.env.local' });

async function auditTenancy() {
  const { sql } = await import('../lib/db/neon');
  console.log('--- USERS & TENANTS ---');
  const users = await sql`
    SELECT u.id, u.email, tm.tenant_id, tm.role
    FROM users u
    LEFT JOIN tenant_members tm ON u.id = tm.user_id
  `;
  console.table(users);

  console.log('\n--- ORDERS BY TENANT ---');
  const orders = await sql`
    SELECT tenant_id, COUNT(*) as count, MIN(customer_name) as sample_customer
    FROM orders
    GROUP BY tenant_id
  `;
  console.table(orders);

  console.log('\n--- TENANTS ---');
  const tenants = await sql`SELECT * FROM tenants`;
  console.table(tenants);

  console.log('\n--- CHECK FOR NULL TENANTS ---');
  const nullOrders = await sql`SELECT count(*) FROM orders WHERE tenant_id IS NULL`;
  console.log('Orders with NULL tenant_id:', nullOrders[0].count);
}

auditTenancy().catch(console.error);
