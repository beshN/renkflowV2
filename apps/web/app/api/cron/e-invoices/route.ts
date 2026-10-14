import { runCron } from "@/lib/features/manufacturing/cron";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
/** Sends queued e-Belge invoices and polls sent ones (does nothing while E_INVOICE_PROVIDER is unset). */
export async function GET(request: Request) { return runCron(request,"e-invoices"); }
