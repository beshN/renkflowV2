import { readJsonBody } from '@/lib/security/request-body.server';
import { redactedJson } from '@/lib/security/field-access.server';
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { NextRequest } from "next/server";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { approveIntake, getIntake } from "@/lib/features/manufacturing/intake.service";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOriginJson(req, 4000000);
    return redactedJson({
      data: await approveIntake(
        await requireWorkOrderActor(),
        (await params).id,
        await readJsonBody(req, 4_000_000),
      ),
    });
  } catch (e) {
    return redactedJson(
      {
        error:
          e instanceof WorkOrderApiError
            ? e.message
            : "Kontrol edilen alanları doğrulayın; taslak kaydedilemedi.",
      },
      { status: e instanceof WorkOrderApiError ? e.status : 400 },
    );
  }
}

export async function GET(_req: NextRequest, {params}: {params: Promise<{id:string}>}) {
  try {return redactedJson({data:await getIntake(await requireWorkOrderActor(),(await params).id)},{headers:{"Cache-Control":"private, no-store"}});}
  catch(e) {return redactedJson({error:e instanceof WorkOrderApiError ? e.message : "Taslak okunamadı"},{status:e instanceof WorkOrderApiError ? e.status : 400});}
}
