import "server-only";
import { sql } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
/** Finalization expires after one day; sweep unreferenced direct uploads after seven days. */
export async function sweepAbandonedUploads() {
 if (process.env.STORAGE_BACKEND !== "vercel-blob") return {deleted:0};
 const {list}=await import("@vercel/blob");
 return sql.begin(async (tx:any)=>{
  const [state]=await tx`SELECT cursor FROM storage_sweep_state WHERE id=1 FOR UPDATE SKIP LOCKED`;
  if(!state) return {deleted:0};
  const page=await list({prefix:"uploads/",limit:20,cursor:state.cursor || undefined});
  let deleted=0;
  for (const file of page.blobs) {
   if(file.uploadedAt.getTime()>Date.now()-7*24*60*60*1000)continue;
   const [refs]=await tx`SELECT EXISTS(SELECT 1 FROM documents WHERE file_path=${file.pathname}) OR EXISTS(SELECT 1 FROM order_documents WHERE file_url=${file.pathname}) OR EXISTS(SELECT 1 FROM production_files WHERE file_path=${file.pathname}) OR EXISTS(SELECT 1 FROM knowledge_revisions WHERE file_path=${file.pathname}) AS present`;
   if(refs.present)continue;
   await deleteFile(file.pathname);
   deleted++;
  }
  await tx`UPDATE storage_sweep_state SET cursor=${page.hasMore ? page.cursor || null : null},updated_at=now() WHERE id=1`;
  return {deleted};
 });
}
