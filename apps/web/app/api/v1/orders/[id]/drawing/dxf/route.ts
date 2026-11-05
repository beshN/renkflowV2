import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { orderDrawingModels } from "@/lib/features/orders/makasli-drawing.server";
import { makasliDxf } from "@/lib/features/orders/makasli-dxf";
import { recordError, NO_STORE } from "@/lib/features/records/http";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireWorkOrderActor();
    const { id } = await params;
    const sheet = await orderDrawingModels(actor, id);
    return new Response(makasliDxf(sheet), {
      headers: {
        ...NO_STORE,
        "Content-Type": "application/dxf; charset=us-ascii",
        "Content-Disposition": `attachment; filename="makasli-${id}.dxf"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return recordError(error, "order-drawing-dxf");
  }
}
