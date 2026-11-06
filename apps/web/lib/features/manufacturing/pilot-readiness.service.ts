import "server-only";
import type { Sql, TransactionSql } from "postgres";
import { sql } from "@/lib/db";
import { hasPermission } from "@/lib/features/auth/permissions";
import { can } from "@/lib/security/access-matrix";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "@/lib/features/work-orders/security";
import { checkPilotReadiness } from "./pilot-readiness";
import { readPilotRows } from "./pilot-readiness-reader";

/** Receives a verified actor, never a tenant identifier from query parameters. */
export async function pilotReadinessReport(actor: WorkOrderActor) {
  if (
    !actor.userId ||
    !actor.tenantId ||
    actor.station ||
    !hasPermission(actor.role, "team.manage") ||
    (actor.access && !can(actor.access, "production", "view"))
  ) {
    throw new WorkOrderApiError(
      "Pilot hazırlık raporunu yalnız firma yöneticileri görebilir.",
      403,
    );
  }
  if (!process.env.DATABASE_URL)
    throw new Error("Pilot report database unavailable");
  return (sql as Sql).begin("read only", async (tx: TransactionSql) => {
    const rows = await readPilotRows(tx, actor.tenantId);
    const findings = checkPilotReadiness(rows);
    return {
      findings,
      empty: !rows.families.some((row) => row.family === "makasli"),
    };
  });
}
