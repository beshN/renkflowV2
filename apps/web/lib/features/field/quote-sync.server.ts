import "server-only";
import { tableExists } from "@/lib/db/schema-guard";
import { recordAudit } from "@/lib/audit/audit-log";
/** Quote decisions drive the existing lead pipeline in the same transaction. */
export async function syncLeadQuoteState(
  tx: any,
  tenantId: string,
  quotationId: string,
) {
  if (!(await tableExists("leads"))) return;
  const linked = await tableExists("lead_quotation_links");
  const leads =
    await tx`SELECT l.id,l.stage,l.quotation_id FROM leads l WHERE l.tenant_id=${tenantId} AND (l.quotation_id=${quotationId} ${linked ? tx`OR EXISTS(SELECT 1 FROM lead_quotation_links x WHERE x.tenant_id=l.tenant_id AND x.lead_id=l.id AND x.quotation_id=${quotationId})` : tx``}) FOR UPDATE OF l`;
  const [changed] =
    await tx`SELECT status FROM quotations WHERE tenant_id=${tenantId} AND id=${quotationId}`;
  for (const lead of leads) {
    const [accepted] =
      await tx`SELECT q.id FROM quotations q WHERE q.tenant_id=${tenantId} AND q.status IN('accepted','converted') AND (q.id=${lead.quotation_id} ${linked ? tx`OR EXISTS(SELECT 1 FROM lead_quotation_links x WHERE x.tenant_id=q.tenant_id AND x.lead_id=${lead.id} AND x.quotation_id=q.id)` : tx``}) LIMIT 1`;
    const next = accepted
      ? "won"
      : lead.stage === "won" && changed?.status === "draft"
        ? "quoted"
        : lead.stage;
    if (next === lead.stage) continue;
    await tx`UPDATE leads SET stage=${next},closed_at=${next === "won" ? new Date() : null},lost_reason=NULL,lost_note=NULL,stage_changed_at=now(),version=version+1,updated_at=now() WHERE tenant_id=${tenantId} AND id=${lead.id}`;
    await recordAudit(tx, {
      tenantId,
      actorId: null,
      entityType: "lead",
      entityId: lead.id,
      action: "quote_status_synced",
      changes: { aşama: { from: lead.stage, to: next } },
      metadata: { quotationId },
    });
  }
}
