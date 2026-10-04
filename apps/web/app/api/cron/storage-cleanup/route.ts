import { runCron } from "@/lib/features/manufacturing/cron";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) { return runCron(request,"storage-cleanup"); }
