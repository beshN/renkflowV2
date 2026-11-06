import { SupplierReturns } from "@/components/purchasing/SupplierReturns";
import { supplierReturnsReady } from "@/lib/features/manufacturing/supplier-return-schema.server";
export const dynamic = "force-dynamic";
export default async function Page() {
  // Before migration 086 (db:deploy) the page shows an empty list with an explanation.
  return <SupplierReturns schemaPending={!(await supplierReturnsReady())} />;
}
