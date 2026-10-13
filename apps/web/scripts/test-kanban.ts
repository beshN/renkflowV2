/** Full persistence checks against an explicitly isolated local database. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import bcrypt from 'bcryptjs';
async function main() {
 process.env.AUTH_SECRET='kanban-local-test-secret-never-production-20261013';
 process.env.DATABASE_URL='postgres://postgres@127.0.0.1:55439/renkflow_kanban_test';
 process.env.STORAGE_BACKEND='local';
 const db=postgres(process.env.DATABASE_URL,{onnotice:()=>{}});
 assert.equal((await db`SELECT current_database() AS name`)[0].name,'renkflow_kanban_test');
 const service=await import('../lib/features/work-orders/service');
 const { requireWorkOrderPermission }=await import('../lib/features/work-orders/security');
 const { effectiveAccess }=await import('../lib/security/access-matrix');
 const {sql}=await import('../lib/db');
 const tenantId=randomUUID(),otherTenant=randomUUID(),userId=randomUUID(),workerId=randomUUID();
 const email='kanban-'+userId.slice(0,8)+'@test.local',password='Kanban-local-verified-2026!';
 await db`INSERT INTO tenants(id,name,slug) VALUES (${tenantId},'Kanban yerel test',${'kanban-'+tenantId.slice(0,8)}),(${otherTenant},'Başka firma',${'other-'+otherTenant.slice(0,8)})`;
 await db`INSERT INTO users(id,email,name,password,email_verified) VALUES (${userId},${email},'Pano Yöneticisi',${await bcrypt.hash(password,10)},now()),(${workerId},${'worker-'+workerId.slice(0,8)+'@test.local'},'Atölye Sorumlusu',${await bcrypt.hash(password,10)},now())`;
 await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES (${tenantId},${userId},'owner'),(${tenantId},${workerId},'worker')`;
 const actor={tenantId,userId,role:'owner' as const};
 const worker={tenantId,userId:workerId,role:'worker' as const};
 const a=await service.createWorkOrder(actor,service.CreateWorkOrderInputSchema.parse({title:'Pergola profil kesimi',category:'Kesim',priority:'high',assignedToUserId:workerId,checklist:[{title:'Ölçüyü doğrula'}]}));
 const b=await service.createWorkOrder(actor,service.CreateWorkOrderInputSchema.parse({title:'Cam ölçüsü teyidi',category:'Kontrol'}));
 const c=await service.createWorkOrder(actor,service.CreateWorkOrderInputSchema.parse({title:'Paketleme hazırlığı',category:'Paketleme'}));
 await db`UPDATE work_orders SET board_position=CASE id WHEN ${a.id}::uuid THEN 1024 WHEN ${b.id}::uuid THEN 2048 ELSE 3072 END WHERE tenant_id=${tenantId}`;
 let moved=await service.updateWorkOrder(actor,c.id,service.UpdateWorkOrderInputSchema.parse({boardPlacement:{beforeId:a.id,afterId:b.id},expectedRevision:c.revision}));
 assert.equal(moved.boardPosition,1536);
 assert.deepEqual((await service.listWorkOrders(tenantId,service.ListWorkOrdersQuerySchema.parse({sort:'board'}))).data.map(row=>row.id),[a.id,c.id,b.id]);
 let started=await service.updateWorkOrder(actor,b.id,service.UpdateWorkOrderInputSchema.parse({status:'in_progress',boardPlacement:{beforeId:null,afterId:null},expectedRevision:b.revision}));
 assert.equal((await service.getWorkOrderDetails(tenantId,b.id)).status,'in_progress');
 await assert.rejects(service.updateWorkOrder(actor,b.id,service.UpdateWorkOrderInputSchema.parse({title:'Stale edit',expectedRevision:b.revision})),(e:any)=>e.status===409);
 await assert.rejects(service.updateWorkOrder({ ...actor,tenantId:otherTenant },b.id,service.UpdateWorkOrderInputSchema.parse({status:'open'})),(e:any)=>e.status===404);
 await assert.rejects(service.updateWorkOrder(worker,b.id,service.UpdateWorkOrderInputSchema.parse({status:'open'})),(e:any)=>e.status===404);
 await assert.rejects(service.updateWorkOrder(actor,b.id,service.UpdateWorkOrderInputSchema.parse({status:'blocked',expectedRevision:started.revision})),/kategori/);
 started=await service.updateWorkOrder(actor,b.id,service.UpdateWorkOrderInputSchema.parse({status:'blocked',blockedReasonCategory:'material',blockedReasonDetail:'Motor tedariki bekleniyor',expectedRevision:started.revision}));
 assert.equal((await service.getWorkOrderDetails(tenantId,b.id)).blockedReasonDetail,'Motor tedariki bekleniyor');
 const outcomes=await Promise.allSettled([
  service.updateWorkOrder(actor,c.id,service.UpdateWorkOrderInputSchema.parse({title:'Paketleme kontrolü',expectedRevision:moved.revision})),
  service.updateWorkOrder(actor,c.id,service.UpdateWorkOrderInputSchema.parse({title:'Paketleme ölçü kontrolü',expectedRevision:moved.revision})),
 ]);
 assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);
 assert.equal(outcomes.filter(result=>result.status==='rejected'&&(result.reason as any).status===409).length,1,'concurrent edit must conflict, not silently overwrite');
 const details=await service.getWorkOrderDetails(tenantId,a.id);
 await service.toggleWorkOrderChecklistItem(actor,a.id,details.checklist[0].id,true);
 await service.addWorkOrderComment(actor,a.id,'Ölçüler teyit edildi.');
 const refreshed=await service.getWorkOrderDetails(tenantId,a.id);
 assert.equal(refreshed.checklistCompleted,1);assert.equal(refreshed.commentTotal,1);assert.equal(refreshed.assigneeName,'Atölye Sorumlusu');
 assert.throws(()=>requireWorkOrderPermission({ ...actor,role:'office',access:effectiveAccess('office',{key:'limited',name:'Salt okunur',permissions:{production:['view'],orders:['view']},hidden:[]}) },'transition'),(e:any)=>e.status===403);
 await db`INSERT INTO work_orders(tenant_id,title,category,created_by,board_position) SELECT ${tenantId},'Üretim kartı '||n,'Üretim',${userId},4096+n*1024 FROM generate_series(1,105) n`;
 const first=await service.listWorkOrders(tenantId,service.ListWorkOrdersQuerySchema.parse({pageSize:100,sort:'board'}));
 const second=await service.listWorkOrders(tenantId,service.ListWorkOrdersQuerySchema.parse({page:2,pageSize:100,sort:'board'}));
 assert.equal(first.pagination.total,108);assert.equal(first.data.length,100);assert.equal(second.data.length,8);
 const oldRows=await db`SELECT to_jsonb(w)-'board_position' AS row FROM work_orders w WHERE tenant_id=${tenantId} ORDER BY id`;
 await db.unsafe(readFileSync('lib/db/migrations/050_work_order_kanban.sql','utf8'));
 assert.deepEqual(await db`SELECT to_jsonb(w)-'board_position' AS row FROM work_orders w WHERE tenant_id=${tenantId} ORDER BY id`,oldRows,'migration re-run must preserve every existing field');
 mkdirSync('../../.local',{recursive:true,mode:0o700});
 writeFileSync('../../.local/kanban-fixture.json',JSON.stringify({tenantId,userId,workerId,email,password,a:a.id,b:b.id,c:c.id}),{mode:0o600});
 console.log('PASS · persisted column/order; empty-column move; stale/concurrent writes; tenant/assigned-worker isolation; block reason; checklist/comments/assignee; pagination; idempotent migration.');
 await db.end();await sql.end();
}
main().catch(error=>{ console.error(error);process.exit(1); });
