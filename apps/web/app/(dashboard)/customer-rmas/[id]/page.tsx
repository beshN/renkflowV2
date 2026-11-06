import { CustomerRmas } from "@/components/orders/CustomerRmas";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <CustomerRmas id={(await params).id} />;
}
