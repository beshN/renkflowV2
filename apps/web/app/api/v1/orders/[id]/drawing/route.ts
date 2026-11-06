import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { orderDrawings } from "@/lib/features/orders/makasli-drawing.server";
import { recordError, NO_STORE } from "@/lib/features/records/http";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireWorkOrderActor();
    const { id } = await params;
    return Response.json(await orderDrawings(actor, id), { headers: NO_STORE });
  } catch (error) {
    return recordError(error, "order-drawing");
  }
}
