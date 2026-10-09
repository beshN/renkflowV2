import 'server-only';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { type FieldActor } from '@/lib/features/field/service';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';

export async function mobileInstallations(actor: FieldActor) {
  if (!actor.mobileAccess?.installations.view) throw new WorkOrderApiError('Montaj görme yetkiniz yok.', 403);
  const [available] = await sql`SELECT to_regclass('public.installations') IS NOT NULL AS present`;
  if (!available?.present) return { available: false, installations: [] };
  // Same assigned-crew scope as the web worker view. No customer/contact/address/sign-off identity.
  const rows = await sql`SELECT i.id,i.installation_number,i.scheduled_date,i.start_time,i.duration_minutes,i.status,i.version,i.signed_at,o.product_name,
    (SELECT count(*) FROM record_checklist_items c WHERE c.tenant_id=i.tenant_id AND c.entity_type='installation' AND c.entity_id=i.id) AS total,
    (SELECT count(*) FROM record_checklist_items c WHERE c.tenant_id=i.tenant_id AND c.entity_type='installation' AND c.entity_id=i.id AND c.done_at IS NOT NULL) AS done
    FROM installations i JOIN orders o ON o.id=i.order_id AND o.tenant_id=i.tenant_id
    WHERE i.tenant_id=${actor.tenantId} AND (${actor.role !== 'worker'} OR ${actor.userId}::uuid=ANY(i.crew))
    AND i.status IN('planned','in_progress') ORDER BY i.scheduled_date NULLS FIRST,i.start_time LIMIT 100`;
  return { available: true, installations: rows.map((r: Record<string, unknown>) => ({ id: String(r.id), number: String(r.installation_number), date: r.scheduled_date instanceof Date ? r.scheduled_date.toISOString().slice(0,10) : r.scheduled_date ? String(r.scheduled_date).slice(0,10) : null, startTime: r.start_time || null, durationMinutes: Number(r.duration_minutes), status: String(r.status), version: Number(r.version), signed: Boolean(r.signed_at), productName: r.product_name || null, checklistTotal: Number(r.total), checklistCompleted: Number(r.done) })) };
}
export async function mobileNotifications(actor: FieldActor) {
  const rows = await sql`SELECT id,type,read,created_at FROM notifications WHERE tenant_id=${actor.tenantId} AND user_id=${actor.userId}
    AND type IN('work_order:assigned','mention','deadline:approaching','order:delayed') ORDER BY created_at DESC LIMIT 100`;
  return { provider: 'disconnected', notifications: rows.map((r: Record<string, unknown>) => ({ id: String(r.id), kind: String(r.type), read: Boolean(r.read), createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at) })) };
}
const preferenceKey = { assignment: 'work_order:assigned', mention: 'mention', delay: 'deadline:approaching' } as const;
export async function mobileNotificationPreferences(actor: FieldActor, input?: { assignment: boolean; mention: boolean; delay: boolean }) {
  if (input) {
    const values = Object.fromEntries(Object.entries(preferenceKey).map(([k,v]) => [v,input[k as keyof typeof input]]));
    values['order:delayed']=input.delay;
    await sql`INSERT INTO notification_preferences(user_id,in_app,push,updated_at) VALUES(${actor.userId},${JSON.stringify(values)}::text::jsonb,${JSON.stringify(values)}::text::jsonb,now())
      ON CONFLICT(user_id) DO UPDATE SET in_app=coalesce(notification_preferences.in_app,'{}'::jsonb)||EXCLUDED.in_app,push=coalesce(notification_preferences.push,'{}'::jsonb)||EXCLUDED.push,updated_at=now()`;
  }
  const [row] = await sql`SELECT in_app FROM notification_preferences WHERE user_id=${actor.userId}`;
  const prefs = row?.in_app as Record<string, unknown> | undefined;
  return { assignment: prefs?.[preferenceKey.assignment] !== false, mention: prefs?.[preferenceKey.mention] !== false, delay: prefs?.[preferenceKey.delay] !== false && prefs?.['order:delayed'] !== false };
}

export async function mobileInstallationDetails(actor: FieldActor,id:string) {
  if(!actor.mobileAccess?.installations.view) throw new WorkOrderApiError('Montaj görme yetkiniz yok.',403);
  z.string().uuid().parse(id);
  const [available]=await sql`SELECT to_regclass('public.installations') IS NOT NULL AS present`;
  if(!available?.present) throw new WorkOrderApiError('Montaj modülü sunucuda henüz etkin değil.',503);
  const [row]=await sql`SELECT id,status,version,issues FROM installations WHERE tenant_id=${actor.tenantId} AND id=${id} AND (${actor.role!=='worker'} OR ${actor.userId}::uuid=ANY(crew))`;
  if(!row) throw new WorkOrderApiError('Montaj bulunamadı veya ekibinize atanmamış.',404);
  const items=await sql`SELECT id,title,done_at FROM record_checklist_items WHERE tenant_id=${actor.tenantId} AND entity_type='installation' AND entity_id=${id} ORDER BY position LIMIT 100`;
  const photos=await sql`SELECT id FROM record_attachments WHERE tenant_id=${actor.tenantId} AND entity_type='installation' AND entity_id=${id} AND deleted_at IS NULL AND mime_type='image/jpeg' ORDER BY created_at DESC LIMIT 50`;
  return {photos:photos.map((p:any)=>({id:String(p.id),url:`/api/mobile/v1/installation-files/${p.id}`})),id:String(row.id),status:String(row.status),version:Number(row.version),checklist:items.map((i:any)=>({id:String(i.id),title:String(i.title),completed:Boolean(i.done_at)})),issues:((row.issues||[]) as Array<Record<string,unknown>>).filter(i=>i.kind==='missing'||i.kind==='damage').map(i=>({kind:String(i.kind),text:String(i.text||'')}))};
}
