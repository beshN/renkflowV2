import ProcurementWorkspace from "@/components/features/manufacturing/ProcurementWorkspace";
import { PurchasingDepth } from "@/components/purchasing/PurchasingDepth";
export default function Page() {
  return (
    <>
      <ProcurementWorkspace section="purchases" />
      <div className="mx-auto max-w-6xl px-4 pb-10 md:px-6"><PurchasingDepth /></div>
    </>
  );
}
