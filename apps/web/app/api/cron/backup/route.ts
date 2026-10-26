import { cronAuthorized } from "@/lib/features/manufacturing/cron";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
/** Daily logical database backup into the private Blob store (backups/<date>/), 14-day retention. */
export async function GET(request: Request) {
 const headers = {"Cache-Control":"no-store"};
 // `await` keeps this correct whether cronAuthorized is sync or async.
 if (!(await cronAuthorized(request))) return Response.json({error:"Unauthorized"},{status:401,headers});
 // Preview DBs and providers stay isolated; Vercel only schedules production crons.
 if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return Response.json({error:"Cron is disabled in previews"},{status:403,headers});
 try {
  const result = await (await import("@/lib/db/backup.server")).runDatabaseBackup();
  // An incomplete backup answers 500 so the scheduler's failure alerting notices it.
  const ok = result.skipped || result.complete;
  return Response.json({ok,queue:"backup",result},{status:ok ? 200 : 500,headers});
 } catch {
  console.error("[cron] backup failed");
  return Response.json({error:"Backup failed"},{status:500,headers});
 }
}
