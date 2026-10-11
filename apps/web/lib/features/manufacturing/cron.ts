import "server-only";
import { sweepAbandonedUploads } from "@/lib/storage/orphan-cleanup";
import { timingSafeEqual } from "node:crypto";
import { drainNotifications } from "./notification.service";
import { drainInbound } from "./inbound.service";
import { drainStorageCleanup } from "../orders/deletion.service";
import { pruneRateLimitBuckets } from "@/lib/security/rate-limit";
import { pruneVehiclePositions } from "@/lib/features/fleet/retention.server";
export function cronAuthorized(request: Request) {
 const secret = process.env.CRON_SECRET?.trim();
 if (!secret || secret.length < 32) return false;
 const actual = Buffer.from(request.headers.get("authorization") || "");
 const expected = Buffer.from(`Bearer ${secret}`);
 return actual.length === expected.length && timingSafeEqual(actual,expected);
}
export async function runCron(request: Request, queue: "inbound" | "notifications" | "storage-cleanup") {
 const headers = {"Cache-Control":"no-store"};
 if (!cronAuthorized(request)) return Response.json({error:"Unauthorized"},{status:401,headers});
 // Preview DBs and providers stay isolated; Vercel only schedules production crons.
 if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return Response.json({error:"Cron is disabled in previews"},{status:403,headers});
 try {
  const result = queue === "inbound" ? await drainInbound(1) : queue === "notifications" ? await drainNotifications(5) : {cleanup:await drainStorageCleanup(undefined,20),orphaned:await sweepAbandonedUploads(),expiredRateLimits:await pruneRateLimitBuckets(),vehiclePositions:await pruneVehiclePositions(),detectors:await (await import('@/lib/ai/detectors/cron.server')).runDetectorsDue()};
  return Response.json({ok:true,queue,result},{headers});
 } catch {
  console.error(`[cron] ${queue} failed`);
  return Response.json({error:"Queue processing failed"},{status:500,headers});
 }
}
