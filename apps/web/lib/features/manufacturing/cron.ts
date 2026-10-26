import "server-only";
import { sweepAbandonedUploads } from "@/lib/storage/orphan-cleanup";
import { timingSafeEqual } from "node:crypto";
import { drainNotifications } from "./notification.service";
import { drainInbound } from "./inbound.service";
import { drainStorageCleanup } from "../orders/deletion.service";
import { pruneRateLimitBuckets } from "@/lib/security/rate-limit";
import { pruneVehiclePositions } from "@/lib/features/fleet/retention.server";
import { verifyGitHubCronToken } from "@/lib/security/github-oidc";
type CronQueue = "inbound" | "notifications" | "storage-cleanup" | "e-invoices" | "fx";
/** Queues `.github/workflows/cron.yml` drains; only these also accept its GitHub OIDC token. */
const GITHUB_OIDC_QUEUES: ReadonlySet<CronQueue> = new Set(["notifications","inbound","e-invoices"]);
function secretAuthorized(header: string) {
 const secret = process.env.CRON_SECRET?.trim();
 if (!secret || secret.length < 32) return false;
 const actual = Buffer.from(header);
 const expected = Buffer.from(`Bearer ${secret}`);
 return actual.length === expected.length && timingSafeEqual(actual,expected);
}
/** `Bearer <CRON_SECRET>` (Vercel Cron), or with `allowGitHubOidc` a GitHub Actions OIDC JWT from cron.yml on main. */
export async function cronAuthorized(request: Request, { allowGitHubOidc = false }: { allowGitHubOidc?: boolean } = {}) {
 const header = request.headers.get("authorization") || "";
 if (secretAuthorized(header)) return true;
 if (!allowGitHubOidc) return false;
 const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(header);
 return match ? verifyGitHubCronToken(match[1]) : false;
}
export async function runCron(request: Request, queue: CronQueue) {
 const headers = {"Cache-Control":"no-store"};
 if (!(await cronAuthorized(request,{allowGitHubOidc:GITHUB_OIDC_QUEUES.has(queue)}))) return Response.json({error:"Unauthorized"},{status:401,headers});
 // Preview DBs and providers stay isolated; Vercel only schedules production crons.
 if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return Response.json({error:"Cron is disabled in previews"},{status:403,headers});
 try {
  const result = queue === "fx" ? await (await import("@/lib/features/fx/rates.server")).syncTcmb((await import("@/lib/db")).sql) : queue === "inbound" ? await drainInbound(1) : queue === "notifications" ? await drainNotifications(5) : queue === "e-invoices" ? await (await import("@/lib/features/einvoice/document.server")).drainEInvoices(10) : {cleanup:await drainStorageCleanup(undefined,20),orphaned:await sweepAbandonedUploads(),expiredRateLimits:await pruneRateLimitBuckets(),vehiclePositions:await pruneVehiclePositions(),detectors:await (await import('@/lib/ai/detectors/cron.server')).runDetectorsDue()};
  return Response.json({ok:true,queue,result},{headers});
 } catch {
  console.error(`[cron] ${queue} failed`);
  return Response.json({error:"Queue processing failed"},{status:500,headers});
 }
}
