import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { recordAudit } from '@/lib/audit/audit-log';
import { tableExists } from '@/lib/db/schema-guard';
import { createNotification, getNotificationPreferences, type NotificationType } from '@/lib/notifications/service';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { generateFilePath, uploadFile } from '@/lib/storage';
import { resolveUploadedFile, verifiedFileKey } from '@/lib/storage/upload-reference';
import { ORDER_ALLOWED_FILE_TYPES } from '@/lib/features/orders/constants';
import { RECORDS, openRecord, type RecordHead } from './registry';
import { ACTIVITY_KINDS, TAG_COLORS, mentionIds, plainMentions, type RecordType } from './types';

const fail = (message: string, status = 400): never => {
  throw new WorkOrderApiError(message, status);
};
const MANAGERS = ['owner', 'admin'];
const istanbulToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
const tagKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');

/** True once 040_record_platform.sql is applied; until then the record screens stay hidden. */
export const recordPlatformAvailable = () => tableExists('record_comments');
async function requireAvailable() {
  if (!(await recordPlatformAvailable())) fail('Kayıt paylaşımı bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor)', 409);
}

/** In-app notice to each person, unless they turned this kind off; never to the person acting. */
async function notify(tenantId: string, userIds: string[], except: string, type: NotificationType, title: string, message: string, data: Record<string, unknown>) {
  await Promise.all([...new Set(userIds)].filter((u) => u && u !== except).map(async (userId) => {
    try {
      const prefs = await getNotificationPreferences(userId);
      if ((prefs?.inApp as Record<string, unknown> | undefined)?.[type] === false) return;
      await createNotification(userId, tenantId, type, title, message, data);
    } catch (error) {
      console.error('[records] notice failed', error instanceof Error ? error.message : error);
    }
  }));
}

/** Members who may be mentioned or assigned on this record: they must be able to open it. */
async function membersWhoCanSee(db: any, tenantId: string, type: RecordType, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db`SELECT m.user_id, m.role, u.name FROM tenant_members m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = ${tenantId} AND m.user_id = ANY(${ids}::uuid[])`;
  const found = new Map(rows.map((r: any) => [r.user_id, r]));
  for (const id of ids) {
    const m: any = found.get(id);
    if (!m) fail('Kişi bu firmanın üyesi değil');
    if (!RECORDS[type].canView(m.role)) fail(`${m.name || 'Bu kişi'} bu kaydı göremez`);
  }
  return rows as Array<{ user_id: string; role: string; name: string }>;
}

/** Everything the record drawer shows: head, smart buttons, tags, owner, checklist, activities, followers and one timeline. */
export async function getRecord(actor: WorkOrderActor, type: string, id: string) {
  await requireAvailable();
  const { def, head } = await openRecord(sql, actor, type, id);
  const t = actor.tenantId;
  const [related, tags, meta, checklist, activities, followers, comments, attachments, audit] = await Promise.all([
    def.related(sql, actor, id),
    sql`SELECT g.id, g.name, g.color FROM record_tag_links l JOIN record_tags g ON g.id = l.tag_id WHERE l.tenant_id = ${t} AND l.entity_type = ${type} AND l.entity_id = ${id} ORDER BY g.name`,
    sql`SELECT m.assignee_id, m.due_on, u.name AS assignee_name FROM record_meta m LEFT JOIN users u ON u.id = m.assignee_id WHERE m.tenant_id = ${t} AND m.entity_type = ${type} AND m.entity_id = ${id}`,
    sql`SELECT c.id, c.title, c.done_at, u.name AS done_by_name FROM record_checklist_items c LEFT JOIN users u ON u.id = c.done_by WHERE c.tenant_id = ${t} AND c.entity_type = ${type} AND c.entity_id = ${id} ORDER BY c.position, c.created_at`,
    sql`SELECT a.id, a.kind, a.title, a.due_on, a.done_at, a.assignee_id, u.name AS assignee_name, a.rule_key FROM record_activities a LEFT JOIN users u ON u.id = a.assignee_id WHERE a.tenant_id = ${t} AND a.entity_type = ${type} AND a.entity_id = ${id} ORDER BY a.done_at NULLS FIRST, a.due_on`,
    sql`SELECT f.user_id, u.name FROM record_followers f JOIN users u ON u.id = f.user_id WHERE f.tenant_id = ${t} AND f.entity_type = ${type} AND f.entity_id = ${id}`,
    sql`SELECT c.id, c.body, c.created_by, u.name AS author, c.created_at, c.edited_at, c.deleted_at FROM record_comments c LEFT JOIN users u ON u.id = c.created_by WHERE c.tenant_id = ${t} AND c.entity_type = ${type} AND c.entity_id = ${id} ORDER BY c.created_at`,
    sql`SELECT id, comment_id, file_name, mime_type, size_bytes, created_at FROM record_attachments WHERE tenant_id = ${t} AND entity_type = ${type} AND entity_id = ${id} AND deleted_at IS NULL ORDER BY created_at`,
    sql`SELECT a.id, a.action, a.changes, a.note, a.created_at, coalesce(u.name, a.actor_name) AS actor FROM activity_logs a LEFT JOIN users u ON u.id = a.actor_id
        WHERE a.tenant_id = ${t} AND a.entity_type = ANY(${def.auditTypes}::text[]) AND a.entity_id = ${id} ORDER BY a.created_at DESC LIMIT 200`,
  ]);
  const today = istanbulToday();
  const day = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : null);
  return {
    head,
    canEdit: def.canEdit(actor.role),
    related,
    tags: tags.map((g: any) => ({ id: g.id, name: g.name, color: g.color })),
    owner: meta[0] ? { id: meta[0].assignee_id, name: meta[0].assignee_name, dueOn: day(meta[0].due_on) } : { id: null, name: null, dueOn: null },
    checklist: checklist.map((c: any) => ({ id: c.id, title: c.title, done: Boolean(c.done_at), doneBy: c.done_by_name })),
    activities: activities.map((a: any) => ({ id: a.id, kind: a.kind, title: a.title, dueOn: day(a.due_on), done: Boolean(a.done_at), assigneeId: a.assignee_id, assigneeName: a.assignee_name, fromRule: a.rule_key })),
    following: followers.some((f: any) => f.user_id === actor.userId),
    followers: followers.map((f: any) => ({ id: f.user_id, name: f.name })),
    today,
    // One stream: comments and recorded changes, newest first. A deleted comment shows as deleted.
    timeline: [
      ...comments.map((c: any) => ({
        kind: 'comment' as const, id: c.id, at: c.created_at, actor: c.author, mine: c.created_by === actor.userId,
        body: c.deleted_at ? null : c.body, edited: Boolean(c.edited_at), deleted: Boolean(c.deleted_at),
        attachments: attachments.filter((f: any) => f.comment_id === c.id).map((f: any) => ({ id: f.id, name: f.file_name, mime: f.mime_type, size: f.size_bytes })),
      })),
      ...audit.filter((e: any) => !String(e.action).startsWith('comment_')).map((e: any) => ({ kind: 'event' as const, id: e.id, at: e.created_at, actor: e.actor, action: e.action, changes: e.changes, note: e.note })),
    ].sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime()),
  };
}

const Attachment = z.union([
  z.object({ name: z.string().min(1).max(180), mime: z.enum(ORDER_ALLOWED_FILE_TYPES), blobPath: z.string().max(700) }),
  z.object({ name: z.string().min(1).max(180), mime: z.enum(ORDER_ALLOWED_FILE_TYPES), base64: z.string().max(14_000_000) }),
]);
export const RecordCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('comment.add'), body: z.string().trim().min(1).max(4000), attachments: z.array(Attachment).max(5).default([]) }),
  z.object({ action: z.literal('comment.edit'), commentId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal('comment.delete'), commentId: z.string().uuid() }),
  z.object({ action: z.literal('follow'), on: z.boolean() }),
  z.object({ action: z.literal('tags.set'), tagIds: z.array(z.string().uuid()).max(20) }),
  z.object({ action: z.literal('owner.set'), assigneeId: z.string().uuid().nullable(), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }),
  z.object({ action: z.literal('checklist.add'), title: z.string().trim().min(1).max(200) }),
  z.object({ action: z.literal('checklist.toggle'), itemId: z.string().uuid(), done: z.boolean() }),
  z.object({ action: z.literal('checklist.remove'), itemId: z.string().uuid() }),
  z.object({ action: z.literal('activity.add'), kind: z.enum(ACTIVITY_KINDS), title: z.string().trim().min(1).max(200), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), assigneeId: z.string().uuid().nullable() }),
  z.object({ action: z.literal('activity.done'), activityId: z.string().uuid(), done: z.boolean() }),
]);
export type RecordCommand = z.infer<typeof RecordCommandSchema>;

const EDIT_ACTIONS = new Set(['tags.set', 'owner.set', 'checklist.add', 'checklist.remove', 'activity.add']);

/** One change to a record. Every change is written to the audit trail with who and when. */
export async function recordCommand(actor: WorkOrderActor, type: string, id: string, raw: unknown) {
  await requireAvailable();
  const cmd = RecordCommandSchema.parse(raw);
  // A worker may tick the checklist and the activities of a work order they can open; the rest needs edit rights.
  const { head } = await openRecord(sql, actor, type, id, EDIT_ACTIONS.has(cmd.action) ? 'edit' : 'view');
  const rt = head.type;
  const t = actor.tenantId;
  const audit = (tx: any, action: string, changes?: Record<string, unknown>, note?: string | null, metadata?: Record<string, unknown>) =>
    recordAudit(tx, { tenantId: t, actorId: actor.userId, entityType: RECORDS[rt].auditTypes[0], entityId: id, action, changes: changes as any, note: note ?? null, metadata });
  const notices: Array<() => Promise<void>> = [];

  const result = await withTransaction(async (tx: any) => {
    switch (cmd.action) {
      case 'comment.add': {
        const mentioned = mentionIds(cmd.body);
        await membersWhoCanSee(tx, t, rt, mentioned);
        const [c] = await tx`INSERT INTO record_comments (tenant_id, entity_type, entity_id, body, mentions, created_by) VALUES (${t}, ${rt}, ${id}, ${cmd.body}, ${mentioned}::uuid[], ${actor.userId}) RETURNING id`;
        for (const file of cmd.attachments) await saveAttachment(tx, actor, rt, id, c.id, file);
        // The author and the people mentioned follow the record from now on.
        for (const u of [actor.userId, ...mentioned])
          await tx`INSERT INTO record_followers (tenant_id, entity_type, entity_id, user_id) VALUES (${t}, ${rt}, ${id}, ${u}) ON CONFLICT DO NOTHING`;
        await audit(tx, 'comment_added', undefined, null, { commentId: c.id, attachments: cmd.attachments.length, mentions: mentioned.length });
        const followers = (await tx`SELECT user_id FROM record_followers WHERE tenant_id = ${t} AND entity_type = ${rt} AND entity_id = ${id}`).map((f: any) => f.user_id);
        const text = plainMentions(cmd.body).slice(0, 140);
        const data = { href: head.href, entityType: rt, entityId: id };
        notices.push(() => notify(t, mentioned, actor.userId, 'mention', `${head.title}: sizden bahsedildi`, text, data));
        notices.push(() => notify(t, followers.filter((f: string) => !mentioned.includes(f)), actor.userId, 'system', `${head.title}: yeni yorum`, text, data));
        return { commentId: c.id };
      }
      case 'comment.edit':
      case 'comment.delete': {
        const [c] = await tx`SELECT body, created_by, deleted_at FROM record_comments WHERE tenant_id = ${t} AND entity_type = ${rt} AND entity_id = ${id} AND id = ${cmd.commentId} FOR UPDATE`;
        if (!c || c.deleted_at) fail('Yorum bulunamadı', 404);
        if (c.created_by !== actor.userId && !MANAGERS.includes(actor.role)) fail('Yalnız yazan ya da yönetici değiştirebilir', 403);
        if (cmd.action === 'comment.edit') {
          const mentioned = mentionIds(cmd.body);
          await membersWhoCanSee(tx, t, rt, mentioned);
          await tx`UPDATE record_comments SET body = ${cmd.body}, mentions = ${mentioned}::uuid[], edited_at = now() WHERE id = ${cmd.commentId}`;
          // The earlier text stays in the audit trail.
          await audit(tx, 'comment_edited', { body: { from: c.body, to: cmd.body } }, null, { commentId: cmd.commentId });
        } else {
          await tx`UPDATE record_comments SET deleted_at = now() WHERE id = ${cmd.commentId}`;
          await tx`UPDATE record_attachments SET deleted_at = now() WHERE comment_id = ${cmd.commentId}`;
          await audit(tx, 'comment_deleted', { body: { from: c.body, to: null } }, null, { commentId: cmd.commentId });
        }
        return { ok: true };
      }
      case 'follow': {
        if (cmd.on) await tx`INSERT INTO record_followers (tenant_id, entity_type, entity_id, user_id) VALUES (${t}, ${rt}, ${id}, ${actor.userId}) ON CONFLICT DO NOTHING`;
        else await tx`DELETE FROM record_followers WHERE tenant_id = ${t} AND entity_type = ${rt} AND entity_id = ${id} AND user_id = ${actor.userId}`;
        return { ok: true };
      }
      case 'tags.set': {
        const valid = cmd.tagIds.length ? await tx`SELECT id, name FROM record_tags WHERE tenant_id = ${t} AND id = ANY(${cmd.tagIds}::uuid[])` : [];
        if (valid.length !== new Set(cmd.tagIds).size) fail('Etiket bulunamadı', 404);
        const before = (await tx`SELECT g.name FROM record_tag_links l JOIN record_tags g ON g.id = l.tag_id WHERE l.tenant_id = ${t} AND l.entity_type = ${rt} AND l.entity_id = ${id} ORDER BY g.name`).map((r: any) => r.name);
        await tx`DELETE FROM record_tag_links WHERE tenant_id = ${t} AND entity_type = ${rt} AND entity_id = ${id}`;
        for (const g of valid) await tx`INSERT INTO record_tag_links (tenant_id, tag_id, entity_type, entity_id) VALUES (${t}, ${g.id}, ${rt}, ${id})`;
        const after = valid.map((g: any) => g.name).sort();
        if (JSON.stringify(before) !== JSON.stringify(after)) await audit(tx, 'tags_changed', { tags: { from: before, to: after } });
        return { ok: true };
      }
      case 'owner.set': {
        const who = cmd.assigneeId ? await membersWhoCanSee(tx, t, rt, [cmd.assigneeId]) : [];
        const [before] = await tx`SELECT m.assignee_id, m.due_on, u.name FROM record_meta m LEFT JOIN users u ON u.id = m.assignee_id WHERE m.tenant_id = ${t} AND m.entity_type = ${rt} AND m.entity_id = ${id}`;
        await tx`INSERT INTO record_meta (tenant_id, entity_type, entity_id, assignee_id, due_on, updated_at) VALUES (${t}, ${rt}, ${id}, ${cmd.assigneeId}, ${cmd.dueOn}, now())
          ON CONFLICT (tenant_id, entity_type, entity_id) DO UPDATE SET assignee_id = EXCLUDED.assignee_id, due_on = EXCLUDED.due_on, updated_at = now()`;
        const fromDue = before?.due_on ? new Date(before.due_on).toISOString().slice(0, 10) : null;
        await audit(tx, 'owner_changed', { assignee: { from: before?.name ?? null, to: who[0]?.name ?? null }, dueOn: { from: fromDue, to: cmd.dueOn } });
        if (cmd.assigneeId && cmd.assigneeId !== before?.assignee_id)
          notices.push(() => notify(t, [cmd.assigneeId!], actor.userId, 'system', `${head.title} size atandı`, RECORDS[rt].label, { href: head.href, entityType: rt, entityId: id }));
        return { ok: true };
      }
      case 'checklist.add': {
        const [{ pos }] = await tx`SELECT coalesce(max(position), -1) + 1 AS pos FROM record_checklist_items WHERE tenant_id = ${t} AND entity_type = ${rt} AND entity_id = ${id}`;
        const [c] = await tx`INSERT INTO record_checklist_items (tenant_id, entity_type, entity_id, title, position, created_by) VALUES (${t}, ${rt}, ${id}, ${cmd.title}, ${pos}, ${actor.userId}) RETURNING id`;
        await audit(tx, 'checklist_added', { item: { from: null, to: cmd.title } });
        return { itemId: c.id };
      }
      case 'checklist.toggle':
      case 'checklist.remove': {
        const [c] = await tx`SELECT title, done_at FROM record_checklist_items WHERE tenant_id = ${t} AND entity_type = ${rt} AND entity_id = ${id} AND id = ${cmd.itemId} FOR UPDATE`;
        if (!c) fail('Madde bulunamadı', 404);
        if (cmd.action === 'checklist.remove') {
          await tx`DELETE FROM record_checklist_items WHERE id = ${cmd.itemId}`;
          await audit(tx, 'checklist_removed', { item: { from: c.title, to: null } });
        } else if (Boolean(c.done_at) !== cmd.done) {
          await tx`UPDATE record_checklist_items SET done_at = ${cmd.done ? new Date() : null}, done_by = ${cmd.done ? actor.userId : null} WHERE id = ${cmd.itemId}`;
          await audit(tx, cmd.done ? 'checklist_done' : 'checklist_reopened', { item: { from: c.title, to: c.title } });
        }
        return { ok: true };
      }
      case 'activity.add': {
        if (cmd.assigneeId) await membersWhoCanSee(tx, t, rt, [cmd.assigneeId]);
        const [a] = await tx`INSERT INTO record_activities (tenant_id, entity_type, entity_id, kind, title, due_on, assignee_id, created_by) VALUES (${t}, ${rt}, ${id}, ${cmd.kind}, ${cmd.title}, ${cmd.dueOn}, ${cmd.assigneeId}, ${actor.userId}) RETURNING id`;
        await audit(tx, 'activity_planned', { activity: { from: null, to: `${cmd.title} · ${cmd.dueOn}` } }, null, { kind: cmd.kind });
        if (cmd.assigneeId) notices.push(() => notify(t, [cmd.assigneeId!], actor.userId, 'reminder', `${head.title}: ${cmd.title}`, `Tarih ${cmd.dueOn}`, { href: head.href, entityType: rt, entityId: id }));
        return { activityId: a.id };
      }
      case 'activity.done': {
        const [a] = await tx`SELECT title, done_at, assignee_id FROM record_activities WHERE tenant_id = ${t} AND entity_type = ${rt} AND entity_id = ${id} AND id = ${cmd.activityId} FOR UPDATE`;
        if (!a) fail('Aktivite bulunamadı', 404);
        // A worker ticks only what is theirs; office and up may close any.
        if (!RECORDS[rt].canEdit(actor.role) && a.assignee_id !== actor.userId) fail('Bu aktiviteyi kapatma yetkiniz yok', 403);
        if (Boolean(a.done_at) !== cmd.done) {
          await tx`UPDATE record_activities SET done_at = ${cmd.done ? new Date() : null}, done_by = ${cmd.done ? actor.userId : null} WHERE id = ${cmd.activityId}`;
          await audit(tx, cmd.done ? 'activity_done' : 'activity_reopened', { activity: { from: a.title, to: a.title } });
        }
        return { ok: true };
      }
    }
  });
  for (const send of notices) await send();
  return result;
}

async function saveAttachment(tx: any, actor: WorkOrderActor, type: RecordType, id: string, commentId: string, raw: z.infer<typeof Attachment>) {
  let key: string, size: number;
  if ('blobPath' in raw) {
    const file = await resolveUploadedFile(actor, raw);
    key = verifiedFileKey(file) ?? fail('Yükleme doğrulanamadı');
    size = file.size;
  } else {
    // Local and small uploads come inline; the same type and size rules apply.
    const bytes = Buffer.from(raw.base64, 'base64');
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) fail('Dosya 10 MB sınırını aşıyor');
    key = generateFilePath(id, raw.name);
    await uploadFile(key, bytes, raw.mime);
    size = bytes.length;
  }
  await tx`INSERT INTO record_attachments (tenant_id, entity_type, entity_id, comment_id, file_name, mime_type, size_bytes, storage_key, uploaded_by)
    VALUES (${actor.tenantId}, ${type}, ${id}, ${commentId}, ${raw.name}, ${raw.mime}, ${size}, ${key}, ${actor.userId})`;
}

/** The stored key of an attachment the person may open (they must be able to open its record). */
export async function attachmentForDownload(actor: WorkOrderActor, attachmentId: string) {
  await requireAvailable();
  const [f] = await sql`SELECT entity_type, entity_id, file_name, mime_type, storage_key FROM record_attachments WHERE tenant_id = ${actor.tenantId} AND id = ${attachmentId} AND deleted_at IS NULL`;
  if (!f) fail('Dosya bulunamadı', 404);
  await openRecord(sql, actor, f.entity_type, f.entity_id);
  return { key: f.storage_key as string, name: f.file_name as string, mime: f.mime_type as string };
}

// ---------- Tags (firm-wide) ----------

const TagSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(40), color: z.enum(TAG_COLORS) });
export async function listTags(actor: WorkOrderActor) {
  await requireAvailable();
  return sql`SELECT g.id, g.name, g.color, (SELECT count(*)::int FROM record_tag_links l WHERE l.tag_id = g.id) AS uses FROM record_tags g WHERE g.tenant_id = ${actor.tenantId} ORDER BY g.name`;
}
/** Create or rename a tag (office and up). Names are unique per firm ignoring case and spaces. */
export async function saveTag(actor: WorkOrderActor, raw: unknown) {
  await requireAvailable();
  if (!['owner', 'admin', 'office'].includes(actor.role)) fail('Etiketleri ofis ve yöneticiler düzenler', 403);
  const tag = TagSchema.parse(raw);
  return withTransaction(async (tx: any) => {
    const clash = await tx`SELECT id FROM record_tags WHERE tenant_id = ${actor.tenantId} AND name_key = ${tagKey(tag.name)} AND id IS DISTINCT FROM ${tag.id ?? null}::uuid`;
    if (clash.length) fail(`"${tag.name}" etiketi zaten var`, 409);
    const [row] = tag.id
      ? await tx`UPDATE record_tags SET name = ${tag.name}, name_key = ${tagKey(tag.name)}, color = ${tag.color} WHERE tenant_id = ${actor.tenantId} AND id = ${tag.id} RETURNING id, name, color`
      : await tx`INSERT INTO record_tags (tenant_id, name, name_key, color) VALUES (${actor.tenantId}, ${tag.name}, ${tagKey(tag.name)}, ${tag.color}) RETURNING id, name, color`;
    if (!row) fail('Etiket bulunamadı', 404);
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant_settings', entityId: actor.tenantId, action: tag.id ? 'tag_updated' : 'tag_created', changes: { tag: { from: null, to: `${row.name} (${row.color})` } } });
    return row;
  });
}
export async function deleteTag(actor: WorkOrderActor, id: string) {
  await requireAvailable();
  if (!['owner', 'admin'].includes(actor.role)) fail('Etiketi yönetici siler', 403);
  return withTransaction(async (tx: any) => {
    const [row] = await tx`DELETE FROM record_tags WHERE tenant_id = ${actor.tenantId} AND id = ${id} RETURNING name`;
    if (!row) fail('Etiket bulunamadı', 404);
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant_settings', entityId: actor.tenantId, action: 'tag_deleted', changes: { tag: { from: row.name, to: null } } });
    return { ok: true };
  });
}

// ---------- Activities due ("Bugün") ----------

/**
 * Open activities due today or earlier for this person (and unassigned ones for office and up),
 * with the record they belong to. Each due activity reminds its assignee once a day.
 */
export async function dueActivities(actor: WorkOrderActor) {
  if (!(await recordPlatformAvailable())) return { available: false, items: [] };
  const today = istanbulToday();
  const office = ['owner', 'admin', 'office'].includes(actor.role);
  const rows = await sql`
    SELECT a.id, a.entity_type, a.entity_id, a.kind, a.title, a.due_on, a.assignee_id, a.notified_on, u.name AS assignee_name
    FROM record_activities a LEFT JOIN users u ON u.id = a.assignee_id
    WHERE a.tenant_id = ${actor.tenantId} AND a.done_at IS NULL AND a.due_on <= ${today}::date
      AND (a.assignee_id = ${actor.userId} OR (${office} AND a.assignee_id IS NULL))
    ORDER BY a.due_on, a.created_at LIMIT 50`;
  const items: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    const def = RECORDS[r.entity_type as RecordType];
    if (!def || !def.canView(actor.role)) continue;
    const head: RecordHead | null = await def.head(sql, actor, r.entity_id);
    if (!head) continue;
    const dueOn = r.due_on instanceof Date ? r.due_on.toISOString().slice(0, 10) : String(r.due_on).slice(0, 10);
    items.push({ id: r.id, kind: r.kind, title: r.title, dueOn, overdue: dueOn < today, assigneeName: r.assignee_name, record: head });
    const notified = r.notified_on instanceof Date ? r.notified_on.toISOString().slice(0, 10) : r.notified_on;
    if (r.assignee_id === actor.userId && notified !== today) {
      await sql`UPDATE record_activities SET notified_on = ${today}::date WHERE id = ${r.id}`;
      await notify(actor.tenantId, [actor.userId], '', 'reminder', `${head.title}: ${r.title}`, dueOn < today ? `Gecikti (${dueOn})` : 'Bugün', { href: head.href, entityType: r.entity_type, entityId: r.entity_id });
    }
  }
  return { available: true, items };
}
