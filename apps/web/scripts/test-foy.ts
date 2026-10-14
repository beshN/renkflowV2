/** Real PDF -> deterministic review -> persisted order, isolated local database only. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { localTestDatabaseURL } from './local-test-database';
async function main() {
 process.env.DATABASE_URL=localTestDatabaseURL();process.env.ALLOW_LOCAL_DATABASE='1';process.env.AUTH_SECRET='foy-local-verification-only-123456789012345';process.env.ANTHROPIC_API_KEY='';process.env.RESEND_API_KEY='';process.env.STORAGE_BACKEND='local';process.env.ALLOW_LOCAL_STORAGE='1';process.env.NATIVE_INVENTORY_ENABLED='1';
 const db=postgres(process.env.DATABASE_URL,{onnotice:()=>{}});
 assert.equal((await db`SELECT current_database() AS name`)[0].name,'renkflow_test');
 const [tenant]=await db`INSERT INTO tenants(name,slug) VALUES('Foy QA',${'foy-'+randomUUID()}) RETURNING id`;
 const email=randomUUID()+'@example.invalid',password='Foy-Test-12345!';
 const [user]=await db`INSERT INTO users(name,email,password,email_verified) VALUES('Foy QA',${email},${await bcrypt.hash(password,10)},now()) RETURNING id`;
 await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenant.id},${user.id},'owner')`;
 const actor={tenantId:tenant.id,userId:user.id,role:'owner' as const};
 const {analyzeFoy,createOrderFromFoy}=await import('../lib/features/foy/service.server');
 const upload={name:'pergola-two-systems.pdf',mime:'application/pdf',base64:readFileSync('__tests__/fixtures/foy/pergola-two-systems.pdf').toString('base64')};
 const analysis=await analyzeFoy(actor,upload);
 assert.equal(analysis.doc.template,'pergola');assert.match(analysis.doc.customer!,/PDF TEST FABRİKA/);assert.equal(analysis.doc.systems.length,2);assert.equal(analysis.doc.systems[0].railOuter,701);assert.equal(analysis.doc.systems[0].projection,400);assert.equal(analysis.doc.cutList.length,5);assert.equal(analysis.model.used,false);
 assert.equal((await db`SELECT count(*)::int AS n FROM orders WHERE tenant_id=${tenant.id}`)[0].n,0,'reading does not create an order');
 const created=await createOrderFromFoy(actor,{name:upload.name,doc:analysis.doc,customerId:null,customerName:'PDF Test Fabrika',file:upload});
 const [order]=await db`SELECT * FROM orders WHERE tenant_id=${tenant.id} AND id=${created.orderId}`;
 assert.equal(order.quantity,2);assert.equal(Number(order.total_amount),0);assert.ok(order.customer_id);assert.equal(order.status,'pending');
 const items=await db`SELECT * FROM order_items WHERE order_id=${order.id} ORDER BY product_name`;
 assert.equal(items.length,2);for(const i of items){assert.equal(Number(i.width_mm),7010);assert.equal(Number(i.projection_mm),4000);assert.equal(Number(i.unit_price),0);assert.equal(i.custom_parameters.bolme_sayisi,2);}
 assert.equal(created.attached,true);assert.equal((await db`SELECT count(*)::int AS n FROM documents WHERE tenant_id=${tenant.id} AND order_id=${order.id}`)[0].n,1);
 await assert.rejects(()=>analyzeFoy({...actor,role:'worker'},upload),(e:any)=>e.status===403);
 const [other]=await db`INSERT INTO tenants(name,slug) VALUES('Other Foy QA',${'other-foy-'+randomUUID()}) RETURNING id`;
 await assert.rejects(()=>createOrderFromFoy(actor,{name:upload.name,doc:analysis.doc,customerId:randomUUID(),customerName:'Foreign customer'}),(e:any)=>e.status===404);
 await assert.rejects(()=>analyzeFoy({...actor,tenantId:other.id},upload),(e:any)=>e.status===403);
 mkdirSync('../../.data',{recursive:true});writeFileSync('../../.data/foy-browser-fixture.json',JSON.stringify({email,password,tenantId:tenant.id,userId:user.id}),{mode:0o600});
 console.log('PASS real PDF reading, Turkish text, two systems, 701 cm -> 7010 mm, 400 cm -> 4000 mm, zero guessed prices, approval persistence, source attachment and tenant/worker rejection');
 await db.end();
}
main().catch(e=>{console.error(e);process.exit(1)});
