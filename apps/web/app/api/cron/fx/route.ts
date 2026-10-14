import { runCron } from "@/lib/features/manufacturing/cron";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
/** Stores the day's TCMB bulletin (announced 15:30 Istanbul). */
export async function GET(request: Request) { return runCron(request,"fx"); }
