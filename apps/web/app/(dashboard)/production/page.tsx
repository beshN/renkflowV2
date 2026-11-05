import Link from "next/link";
import ProductionWorkspace from "@/components/features/manufacturing/ProductionWorkspace";
export default function ProductionPage() {
  return (
    <>
      <Link href="/production/weekly-plan" className="rf-secondary-button mb-4">
        Haftalık istasyon planı · salt okunur
      </Link>
      <ProductionWorkspace />
    </>
  );
}
