import "server-only";
import { tableExists } from "@/lib/db/schema-guard";

// Migration 086 is applied by hand (db:deploy). Until then the code ships and must keep running:
// existing flows skip return checks, and the return endpoints answer with this message.
export const SUPPLIER_RETURN_SCHEMA_PENDING =
  "Tedarikçi iadesi için veritabanı güncellemesi bekleniyor";

/** True only when both 086 tables exist. */
export async function supplierReturnsReady(): Promise<boolean> {
  return (
    (await tableExists("supplier_returns")) &&
    (await tableExists("supplier_return_lines"))
  );
}
