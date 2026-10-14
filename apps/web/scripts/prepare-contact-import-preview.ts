/** Creates synthetic users only on the isolated local test database; never accepts DATABASE_URL. */
import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { toCsv } from '../lib/features/products/csv';
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
      workerId = randomUUID(), warehouseId = randomUUID();
    const email = 'import-' + ownerId.slice(0, 8) + '@test.local',
      password = 'DirectorLocal!2026';
    await db`INSERT INTO tenants (id,name,slug) VALUES (${tenantId}, 'Aktarım Deneme Atölyesi', ${'preview-' + tenantId})`;
    await db`INSERT INTO users (id,name,email,password,email_verified) VALUES (${ownerId}, 'Deneme Sahibi', ${email}, ${await bcrypt.hash(password, 10)}, now())`;
    await db`INSERT INTO tenant_members (tenant_id,user_id,role) VALUES (${tenantId},${ownerId},'owner')`;
    await db`INSERT INTO users (id,name,email,password,email_verified) VALUES (${workerId}, 'Deneme Ustası', ${'worker-' + workerId.slice(0, 8) + '@test.local'}, ${await bcrypt.hash(password, 10)}, now())`;
    await db`INSERT INTO tenant_members (tenant_id,user_id,role) VALUES (${tenantId},${workerId},'worker')`;
    await db`INSERT INTO customers (tenant_id,full_name,email,tax_number) VALUES (${tenantId},'Örnek Yapı','kayitli@ornek.com','1234567890')`;
    await db`INSERT INTO suppliers (tenant_id,name,tax_number) VALUES (${tenantId},'Örnek Profil','9876543210')`;
    await db`INSERT INTO warehouses (id,tenant_id,code,name,warehouse_type) VALUES (${warehouseId},${tenantId},'HAM','Deneme hammadde deposu','RAW')`;
    const restrictedAdminId = randomUUID(), restrictedRoleId = randomUUID();
    const restrictedAdminEmail = 'restricted-' + restrictedAdminId.slice(0,8) + '@test.local';
    await db`INSERT INTO users (id,name,email,password,email_verified) VALUES (${restrictedAdminId},'Salt okunur yönetici',${restrictedAdminEmail},${await bcrypt.hash(password,10)},now())`;
    await db`INSERT INTO access_roles (id,tenant_id,name,name_key,base_role,permissions,created_by) VALUES (${restrictedRoleId},${tenantId},'Salt okunur deneme','readonly-preview','admin',${JSON.stringify({inventory:['view'],production:['view']})}::text::jsonb,${ownerId})`;
    await db`INSERT INTO tenant_members (tenant_id,user_id,role,access_role) VALUES (${tenantId},${restrictedAdminId},'admin',${restrictedRoleId})`;
    const profileId = randomUUID(), finishedItemId = randomUUID();
    await db`INSERT INTO inventory_items (id,tenant_id,sku,name,unit,item_type,stock_uom,profile_code,standard_length_m,weight_per_meter_kg) VALUES (${profileId},${tenantId},'UI-108','Deneme profil','m','raw_material','m','108',6,1.25), (${finishedItemId},${tenantId},'UI-MAMUL','Deneme pergola','adet','finished_good','adet',null,0,0)`;
    await db`INSERT INTO work_centers (tenant_id,code,name) VALUES (${tenantId},'KESIM','Deneme kesim')`;
    mkdirSync('.data', { recursive: true });
    writeFileSync(
      '.data/import-preview-fixture.json',
      JSON.stringify(
        {
          tenantId,
          ownerId,
          warehouseId,
          profileId,
          finishedItemId,
          restrictedAdminEmail,
          email,
          password,
          workerEmail: 'worker-' + workerId.slice(0, 8) + '@test.local',
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    writeFileSync('.data/recipe-preview.csv', toCsv([
      ['satir_turu','kod','ad','tur','birim','miktar_formulu','kesim_boyu_formulu','kosul','varsayilan','en_az','en_cok'],
      ['sinir','en','','','','','','','','1000','6000'],
      ['sinir','acilim','','','','','','','','1000','6000'],
      ['sinir','yukseklik','','','','','','','','1000','6000'],
      ['malzeme','UI-108','Deneme profil','profil','m','2','widthMm-20','','','',''],
      ['operasyon','KESIM','Kesim','','','15','','','','',''],
    ]), {mode:0o600});
    console.log('Synthetic preview ready:', email, password);
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
