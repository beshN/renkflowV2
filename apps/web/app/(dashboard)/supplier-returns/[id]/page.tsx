import { SupplierReturns } from "@/components/purchasing/SupplierReturns";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <SupplierReturns id={(await params).id} />;
}
