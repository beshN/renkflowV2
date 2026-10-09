import 'server-only';
import { createHash } from 'node:crypto';
import { sql } from '@/lib/db';
import { uploadFile, readFile } from '@/lib/storage';
import { assertFieldJob, type FieldActor } from '@/lib/features/field/service';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { validateMobileDTO } from './contract';
import { MobileConflict } from './sync';
export const PHOTO_CHUNK_BYTES=262144;
type UploadInput = { action:'init'|'chunk'|'finish';uploadId:string;workOrderId?:string;name?:string;totalBytes?:number;sha256?:string;offset?:number;base64?:string };
function status(row:Record<string,unknown>) {return {uploadId:String(row.id),receivedBytes:Number(row.received_bytes),totalBytes:Number(row.size_bytes),chunkBytes:PHOTO_CHUNK_BYTES,completed:Boolean(row.final_url),url:row.final_url||null};}
async function schema() {
  const [row]=await sql`SELECT to_regclass('public.mobile_uploads') IS NOT NULL AS present`;
  if(!row?.present) throw new WorkOrderApiError('Parçalı fotoğraf yükleme henüz etkin değil.',503);
}
async function authorize(a:FieldActor,jobId:string) {
  if(!a.mobileAccess?.production.edit) throw new WorkOrderApiError('Fotoğraf yükleme yetkiniz yok.',403);
  await assertFieldJob(a,jobId);
  const [job]=await sql`SELECT status FROM work_orders WHERE tenant_id=${a.tenantId} AND id=${jobId}`;
  if(['done','cancelled'].includes(job?.status)) throw new MobileConflict('Kapatılmış işe fotoğraf eklenemez.',false);
}
export async function uploadStatus(a:FieldActor,id:string) {
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new WorkOrderApiError('Yükleme kimliği geçersiz.',400);
  await schema();
  const [row]=await sql`SELECT * FROM mobile_uploads WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND id=${id}`;
  if(!row) throw new WorkOrderApiError('Yükleme bulunamadı.',404);
  await authorize(a,row.work_order_id);return status(row);
}
export async function uploadChunk(a:FieldActor,raw:unknown) {
  const d=validateMobileDTO('UploadInput',raw) as UploadInput;
  await schema();
  // Do auth/scope checks before the upload lock, so an idempotent replay also honors revocation.
  const [existing]=await sql`SELECT work_order_id FROM mobile_uploads WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND id=${d.uploadId}`;
  const jobId=existing?.work_order_id||d.workOrderId;
  if(!jobId) throw new WorkOrderApiError('Yükleme bulunamadı.',404);
  await authorize(a,jobId);
  return sql.begin(async(tx:any)=> {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId+':upload:'+a.userId+':'+d.uploadId},0))`;
    let [row]=await tx`SELECT * FROM mobile_uploads WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND id=${d.uploadId} FOR UPDATE`;
    if(d.action==='init') {
      if(row) {
        if(row.work_order_id!==d.workOrderId||row.name!==d.name||row.size_bytes!==d.totalBytes||row.sha256!==d.sha256) throw new MobileConflict('Bu yükleme kimliği başka bir fotoğraf için kullanılmış.',false);
      } else [row]=await tx`INSERT INTO mobile_uploads(tenant_id,user_id,id,work_order_id,name,size_bytes,sha256) VALUES(${a.tenantId},${a.userId},${d.uploadId},${jobId},${d.name!},${d.totalBytes!},${d.sha256!}) RETURNING *`;
      return status(row);
    }
    if(!row) throw new WorkOrderApiError('Yükleme bulunamadı.',404);
    if(row.final_url) return status(row);
    if(d.action==='chunk') {
      const bytes=Buffer.from(d.base64!,'base64');
      if(bytes.length<1||bytes.length>PHOTO_CHUNK_BYTES||bytes.toString('base64')!==d.base64) throw new WorkOrderApiError('Geçersiz fotoğraf parçası.',400);
      const hash=createHash('sha256').update(bytes).digest('hex');
      if(hash!==d.sha256) throw new WorkOrderApiError('Fotoğraf parçası doğrulanamadı.',400);
      const [old]=await tx`SELECT size_bytes,sha256 FROM mobile_upload_chunks WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND upload_id=${d.uploadId} AND byte_offset=${d.offset!}`;
      if(old) {
        if(old.sha256!==hash||old.size_bytes!==bytes.length) throw new MobileConflict('Yüklenen parça başka içerikle değiştirilemez.',false);
        return status(row);
      }
      if(row.received_bytes!==d.offset) throw new MobileConflict('Yükleme ofseti değişti; son onaylanan parçadan devam edin.',true);
      if(d.offset!+bytes.length>row.size_bytes) throw new WorkOrderApiError('Fotoğraf boyutu aşıldı.',413);
      const key=`mobile-chunks/${a.tenantId}/${a.userId}/${d.uploadId}/${d.offset}-${hash}`;
      await uploadFile(key,bytes,'application/octet-stream');
      await tx`INSERT INTO mobile_upload_chunks(tenant_id,user_id,upload_id,byte_offset,size_bytes,sha256,storage_key) VALUES(${a.tenantId},${a.userId},${d.uploadId},${d.offset!},${bytes.length},${hash},${key})`;
      [row]=await tx`UPDATE mobile_uploads SET received_bytes=received_bytes+${bytes.length} WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND id=${d.uploadId} RETURNING *`;
      return status(row);
    }
    if(row.received_bytes!==row.size_bytes) throw new MobileConflict('Fotoğrafın bütün parçaları henüz ulaşmadı.',true);
    const chunks=await tx`SELECT * FROM mobile_upload_chunks WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND upload_id=${d.uploadId} ORDER BY byte_offset`;
    const parts:Buffer[]=[];
    for(const chunk of chunks) {
      const file=await readFile(chunk.storage_key);
      if(file.size>PHOTO_CHUNK_BYTES) {await file.body.cancel();throw new WorkOrderApiError('Saklanan fotoğraf parçası bozuk.',409);}
      const bytes=Buffer.from(await new Response(file.body).arrayBuffer());
      if(bytes.length!==chunk.size_bytes||createHash('sha256').update(bytes).digest('hex')!==chunk.sha256) throw new WorkOrderApiError('Saklanan fotoğraf parçası bozuk.',409);
      parts.push(bytes);
    }
    const bytes=Buffer.concat(parts);
    if(bytes.length!==row.size_bytes||createHash('sha256').update(bytes).digest('hex')!==row.sha256) throw new WorkOrderApiError('Fotoğraf bütünü doğrulanamadı.',400);
    if(bytes[0]!==255||bytes[1]!==216) throw new WorkOrderApiError('Fotoğraf JPEG biçiminde değil.',400);
    // Lock the job before finalizing so a simultaneous closure/reassignment cannot attach a photo.
    const [job]=await tx`SELECT id,status FROM work_orders WHERE tenant_id=${a.tenantId} AND id=${row.work_order_id}
      AND (${a.role!=='worker'} OR assigned_to=${a.userId} OR EXISTS(SELECT 1 FROM production_operations p WHERE p.tenant_id=${a.tenantId} AND p.work_order_id=work_orders.id AND p.assigned_to=${a.userId})) FOR UPDATE`;
    if(!job) throw new WorkOrderApiError('İş emri bulunamadı veya size atanmamış.',404);
    if(['done','cancelled'].includes(job.status)) throw new MobileConflict('Kapatılmış işe fotoğraf eklenemez.',false);
    const key=`uploads/${a.tenantId}/${a.userId}/mobile-${d.uploadId}`;
    await uploadFile(key,bytes,'image/jpeg');
    // File metadata and final acknowledgement commit together in this transaction. No nested
    // connection is held, and a lost HTTP response returns the same final URL on replay.
    const [file]=await tx`INSERT INTO production_files(tenant_id,work_order_id,created_by,name,mime,file_path,size_bytes) VALUES(${a.tenantId},${row.work_order_id},${a.userId},${row.name},'image/jpeg',${key},${bytes.length}) RETURNING id`;
    const url=`/api/v1/production/files/${a.tenantId}/${file.id}`;
    [row]=await tx`UPDATE mobile_uploads SET final_url=${url} WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND id=${d.uploadId} RETURNING *`;
    return status(row);
  });
}
