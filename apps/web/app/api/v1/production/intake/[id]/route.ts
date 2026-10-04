import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { NextRequest, NextResponse } from "next/server";
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
    return NextResponse.json({
      data: await approveIntake(
        await requireWorkOrderActor(),
        (await params).id,
        await req.json(),
      ),
    });
  } catch (e) {
    return NextResponse.json(
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
  try {return NextResponse.json({data:await getIntake(await requireWorkOrderActor(),(await params).id)},{headers:{"Cache-Control":"private, no-store"}});}
  catch(e) {return NextResponse.json({error:e instanceof WorkOrderApiError ? e.message : "Taslak okunamadı"},{status:e instanceof WorkOrderApiError ? e.status : 400});}
}
