import { OrderDrawings } from "@/components/features/orders/OrderDrawings";
export default async function ManufacturingDrawing({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="rf-page mx-auto max-w-4xl">
      <OrderDrawings orderId={id} printable />
    </div>
  );
}
