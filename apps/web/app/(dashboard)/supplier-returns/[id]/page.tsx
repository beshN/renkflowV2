import { SupplierReturns } from "@/components/purchasing/SupplierReturns";
import { supplierReturnsReady } from "@/lib/features/manufacturing/supplier-return-schema.server";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <SupplierReturns
      id={(await params).id}
      schemaPending={!(await supplierReturnsReady())}
    />
  );
}
