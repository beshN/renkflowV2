import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sql } from '@/lib/db';
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from '@/lib/features/work-orders/security';
import { requireModuleAccess } from '@/lib/security/module-access.server';
import { recordAudit } from '@/lib/audit/audit-log';
import { uploadFile, deleteFile } from '@/lib/storage';
import {
  contentMatchesType,
  resolveUploadedFile,
  verifiedFileKey,
} from '@/lib/storage/upload-reference';
import { KnowledgeWriteSchema, mayReadKnowledge } from './contract';
const fail = (message: string, status = 404): never => {
  throw new WorkOrderApiError(message, status);
};
export async function listKnowledge(
  actor: WorkOrderActor,
  raw: { q?: string; category?: string; archived?: boolean } = {},
) {
  const access = await requireModuleAccess(actor, 'knowledge');
  const q = z
      .string()
      .trim()
      .max(180)
      .parse(raw.q ?? ''),
    category = z
      .string()
      .uuid()
      .optional()
      .parse(raw.category || undefined);
  const documents =
    await sql`SELECT d.id,d.title,d.visibility,d.version,d.category_id,d.archived,d.updated_at,c.name AS category_name,r.file_name,r.mime,r.size_bytes,left(d.content,220) AS excerpt
 FROM knowledge_documents d LEFT JOIN knowledge_categories c ON c.id=d.category_id AND c.tenant_id=d.tenant_id
 JOIN knowledge_revisions r ON r.document_id=d.id AND r.tenant_id=d.tenant_id AND r.version=d.version
 WHERE d.tenant_id=${actor.tenantId} AND d.archived=${Boolean(raw.archived)} AND (${category ?? null}::uuid IS NULL OR d.category_id=${category ?? null}::uuid)
 AND (d.visibility='company' OR ${['owner', 'admin'].includes(actor.role)} OR (d.visibility='office' AND ${['office', 'accountant'].includes(actor.role)}))
 AND (${q}='' OR to_tsvector('simple',d.title || ' ' || d.content) @@ plainto_tsquery('simple',${q}) OR d.title ILIKE ${'%' + q + '%'} OR r.file_name ILIKE ${'%' + q + '%'})
 ORDER BY d.updated_at DESC,d.id LIMIT 200`;
  const categories =
    await sql`SELECT id,name FROM knowledge_categories WHERE tenant_id=${actor.tenantId} ORDER BY name`;
  return {
    documents,
    categories,
    canWrite: (access.permissions.knowledge ?? []).includes('create'),
    canEdit: (access.permissions.knowledge ?? []).includes('edit'),
  };
}
export async function readKnowledge(
  actor: WorkOrderActor,
  id: string,
  version?: number,
) {
  await requireModuleAccess(actor, 'knowledge');
  z.string().uuid().parse(id);
  const [doc] =
    await sql`SELECT * FROM knowledge_documents WHERE tenant_id=${actor.tenantId} AND id=${id}`;
  if (!doc || !mayReadKnowledge(actor.role, doc.visibility))
    fail('Belge bulunamadı.');
  const [revision] =
    await sql`SELECT r.*,u.name AS author_name FROM knowledge_revisions r LEFT JOIN users u ON u.id=r.created_by WHERE r.tenant_id=${actor.tenantId} AND r.document_id=${id} AND r.version=${version ?? doc.version}`;
  if (!revision) fail('Belge sürümü bulunamadı.');
  const history =
    await sql`SELECT r.version,r.title,r.note,r.file_name,r.created_at,u.name AS author_name FROM knowledge_revisions r LEFT JOIN users u ON u.id=r.created_by WHERE r.tenant_id=${actor.tenantId} AND r.document_id=${id} ORDER BY r.version DESC LIMIT 100`;
  // Keys never leave the server; every byte request checks the current document's access again.
  const { file_path, ...safeRevision } = revision;
  return {
    document: doc,
    revision: safeRevision,
    history,
    fileKey: file_path as string | null,
  };
}
export async function createKnowledgeCategory(
  actor: WorkOrderActor,
  raw: unknown,
) {
  await requireModuleAccess(actor, 'knowledge', 'create');
  const { name } = z
    .object({ name: z.string().trim().min(1).max(100) })
    .parse(raw);
  const [row] =
    await sql`INSERT INTO knowledge_categories(tenant_id,name,created_by) VALUES(${actor.tenantId},${name},${actor.userId}) ON CONFLICT(tenant_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id,name`;
  return row;
}
export async function saveKnowledge(actor: WorkOrderActor, raw: unknown) {
  const d = KnowledgeWriteSchema.parse(raw);
  await requireModuleAccess(actor, 'knowledge', d.id ? 'edit' : 'create');
  if (!mayReadKnowledge(actor.role, d.visibility))
    fail('Bu görünürlükte belge yayınlayamazsınız.', 403);
  const id = d.id ?? randomUUID();
  let file: {
      file_path: string;
      file_name: string;
      mime: string;
      size_bytes: number;
    } | null = null,
    createdPath: string | null = null;
  if (d.file) {
    let bytes: Buffer, key: string | undefined;
    if (d.file.blobPath) {
      let uploaded: File;
      try {
        uploaded = await resolveUploadedFile(actor, d.file);
      } catch {
        fail('Dosya doğrulanamadı. Yeniden yükleyin.', 400);
      }
      bytes = Buffer.from(await uploaded!.arrayBuffer());
      key = verifiedFileKey(uploaded!);
    } else bytes = Buffer.from(d.file.base64!, 'base64');
    if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024)
      fail('Dosya 1 bayt ile 10 MB arasında olmalı.', 413);
    if (!contentMatchesType(d.file.mime, bytes))
      fail('Dosya içeriği türüyle uyuşmuyor.', 400);
    const filePath = key ?? `knowledge/${actor.tenantId}/${randomUUID()}`;
    if (!key) {
      await uploadFile(filePath, bytes, d.file.mime);
      createdPath = filePath;
    }
    file = {
      file_path: filePath,
      file_name: d.file.name,
      mime: d.file.mime,
      size_bytes: bytes.length,
    };
  }
  try {
    return await sql.begin(async (tx: any) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId + ':knowledge:' + id},0))`;
      const [old] =
        await tx`SELECT * FROM knowledge_documents WHERE tenant_id=${actor.tenantId} AND id=${id} FOR UPDATE`;
      if (d.id && (!old || !mayReadKnowledge(actor.role, old.visibility)))
        fail('Belge bulunamadı.');
      if ((old?.version ?? 0) !== d.version)
        fail('Belge başka bir oturumda değişti. Güncel sürümü açın.', 409);
      if (
        d.categoryId &&
        !(
          await tx`SELECT id FROM knowledge_categories WHERE tenant_id=${actor.tenantId} AND id=${d.categoryId}`
        ).length
      )
        fail('Kategori bulunamadı.');
      if (d.file?.blobPath) {
        const [used] =
          await tx`SELECT id FROM knowledge_revisions WHERE file_path=${d.file.blobPath} LIMIT 1`;
        if (used)
          fail(
            'Bu dosya yüklemesi zaten kaydedildi. Yeni dosya yükleyin.',
            409,
          );
      }
      const version = d.version + 1;
      if (old && !file && !d.removeFile) {
        const [previous] =
          await tx`SELECT file_path,file_name,mime,size_bytes FROM knowledge_revisions WHERE tenant_id=${actor.tenantId} AND document_id=${id} AND version=${old.version}`;
        file = previous?.file_path ? previous : null;
      }
      const [doc] =
        await tx`INSERT INTO knowledge_documents(id,tenant_id,category_id,title,content,visibility,version,created_by,updated_by) VALUES(${id},${actor.tenantId},${d.categoryId},${d.title},${d.content},${d.visibility},${version},${actor.userId},${actor.userId}) ON CONFLICT(id) DO UPDATE SET category_id=EXCLUDED.category_id,title=EXCLUDED.title,content=EXCLUDED.content,visibility=EXCLUDED.visibility,version=EXCLUDED.version,updated_by=EXCLUDED.updated_by,updated_at=now() WHERE knowledge_documents.tenant_id=EXCLUDED.tenant_id RETURNING id,version`;
      if (!doc) fail('Belge bulunamadı.');
      await tx`INSERT INTO knowledge_revisions(tenant_id,document_id,version,title,content,category_id,visibility,file_path,file_name,mime,size_bytes,note,created_by) VALUES(${actor.tenantId},${id},${version},${d.title},${d.content},${d.categoryId},${d.visibility},${file?.file_path ?? null},${file?.file_name ?? null},${file?.mime ?? null},${file?.size_bytes ?? null},${d.note},${actor.userId})`;
      await recordAudit(tx, {
        tenantId: actor.tenantId,
        actorId: actor.userId,
        entityType: 'knowledge_document',
        entityId: id,
        action: old ? 'document_revised' : 'document_created',
        metadata: { version, title: d.title, visibility: d.visibility },
      });
      return doc;
    });
  } catch (e) {
    if (createdPath) await deleteFile(createdPath).catch(() => {});
    throw e;
  }
}
export async function archiveKnowledge(
  actor: WorkOrderActor,
  id: string,
  raw: unknown,
) {
  await requireModuleAccess(actor, 'knowledge', 'edit');
  const { version, archived } = z
    .object({ version: z.number().int().positive(), archived: z.boolean() })
    .parse(raw);
  z.string().uuid().parse(id);
  return sql.begin(async (tx: any) => {
    const [doc] =
      await tx`SELECT * FROM knowledge_documents WHERE tenant_id=${actor.tenantId} AND id=${id} FOR UPDATE`;
    if (!doc || !mayReadKnowledge(actor.role, doc.visibility))
      fail('Belge bulunamadı.');
    if (doc.version !== version) fail('Belge değişti. Yenileyin.', 409);
    await tx`UPDATE knowledge_documents SET archived=${archived},updated_by=${actor.userId},updated_at=now() WHERE tenant_id=${actor.tenantId} AND id=${id}`;
    await recordAudit(tx, {
      tenantId: actor.tenantId,
      actorId: actor.userId,
      entityType: 'knowledge_document',
      entityId: id,
      action: archived ? 'document_archived' : 'document_restored',
      metadata: { version },
    });
    return { id, archived };
  });
}
