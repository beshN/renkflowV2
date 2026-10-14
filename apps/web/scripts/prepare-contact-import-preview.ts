/** Creates synthetic users only on the isolated local test database; never accepts DATABASE_URL. */
import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { localTestDatabaseURL } from './local-test-database';
async function main() {
  const db = postgres(localTestDatabaseURL());
  try {
    if (
      (await db`SELECT current_database() AS name`)[0].name !== 'renkflow_test'
    )
      throw new Error('Local test DB required');
    const tenantId = randomUUID(),
      ownerId = randomUUID(),
      workerId = randomUUID();
    const email = 'import-' + ownerId.slice(0, 8) + '@test.local',
      password = 'DirectorLocal!2026';
    await db`INSERT INTO tenants (id,name,slug) VALUES (${tenantId}, 'Aktarım Deneme Atölyesi', ${'preview-' + tenantId})`;
    await db`INSERT INTO users (id,name,email,password,email_verified) VALUES (${ownerId}, 'Deneme Sahibi', ${email}, ${await bcrypt.hash(password, 10)}, now())`;
    await db`INSERT INTO tenant_members (tenant_id,user_id,role) VALUES (${tenantId},${ownerId},'owner')`;
    await db`INSERT INTO users (id,name,email,password,email_verified) VALUES (${workerId}, 'Deneme Ustası', ${'worker-' + workerId.slice(0, 8) + '@test.local'}, ${await bcrypt.hash(password, 10)}, now())`;
    await db`INSERT INTO tenant_members (tenant_id,user_id,role) VALUES (${tenantId},${workerId},'worker')`;
    await db`INSERT INTO customers (tenant_id,full_name,email,tax_number) VALUES (${tenantId},'Örnek Yapı','kayitli@ornek.com','1234567890')`;
    await db`INSERT INTO suppliers (tenant_id,name,tax_number) VALUES (${tenantId},'Örnek Profil','9876543210')`;
    mkdirSync('.data', { recursive: true });
    writeFileSync(
      '.data/import-preview-fixture.json',
      JSON.stringify(
        {
          tenantId,
          ownerId,
          email,
          password,
          workerEmail: 'worker-' + workerId.slice(0, 8) + '@test.local',
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log('Synthetic preview ready:', email, password);
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
