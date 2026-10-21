import { NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import {
  technicalWorkspace,
  attachTechnicalSheet,
  approveTechnicalPlan,
  rejectTechnicalRevision,
  refreshTechnicalDraft,
  saveDrillingRule,
  recheckTechnicalRules,
  planTechnicalCut,
} from "@/lib/features/orders/technical.server";
import { recordError, NO_STORE } from "@/lib/features/records/http";
import { redactedJson } from "@/lib/security/field-access.server";
import { resolveRevisionMaterials } from "@/lib/features/orders/revision-materials.server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_req: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    return redactedJson(
      await technicalWorkspace(await requireWorkOrderActor(), id),
      { headers: NO_STORE },
    );
  } catch (e) {
    return recordError(e, "order-technical");
  }
}
export async function POST(req: NextRequest, { params }: Context) {
  try {
    requireSameOriginJson(req, 8_500_000);
    const { id } = await params,
      a = await requireWorkOrderActor();
    const input = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("attach"), data: z.unknown() }),
        z.object({ action: z.literal("resolve-materials"), data: z.unknown() }),
        z.object({
          action: z.literal("save-drilling-rule"),
          data: z.unknown(),
        }),
        z.object({
          action: z.literal("recheck-rules"),
          revisionId: z.uuid(),
          commandId: z.uuid(),
        }),
        z.object({
          action: z.literal("approve"),
          revisionId: z.uuid(),
          acknowledgeWarnings: z.boolean().optional(),
        }),
        z.object({ action: z.literal("plan-cut"), commandId: z.uuid() }),
        z.object({ action: z.literal("reject"), revisionId: z.uuid() }),
        z.object({
          action: z.literal("refresh"),
          revisionId: z.uuid(),
          commandId: z.uuid(),
        }),
      ])
      .parse(await req.json());
    return redactedJson(
      input.action === "save-drilling-rule"
        ? await saveDrillingRule(a, id, input.data)
        : input.action === "recheck-rules"
          ? await recheckTechnicalRules(
              a,
              id,
              input.revisionId,
              input.commandId,
            )
          : input.action === "resolve-materials"
            ? await resolveRevisionMaterials(a, id, input.data)
            : input.action === "attach"
              ? await attachTechnicalSheet(a, id, input.data)
              : input.action === "refresh"
                ? await refreshTechnicalDraft(
                    a,
                    id,
                    input.revisionId,
                    input.commandId,
                  )
                : input.action === "reject"
                  ? await rejectTechnicalRevision(a, id, input.revisionId)
                  : input.action === "plan-cut"
                    ? await planTechnicalCut(a, id, input.commandId)
                    : await approveTechnicalPlan(a, id, input.revisionId, {
                        acknowledgeWarnings: input.acknowledgeWarnings,
                      }),
      { headers: NO_STORE },
    );
  } catch (e) {
    return recordError(e, "order-technical");
  }
}
