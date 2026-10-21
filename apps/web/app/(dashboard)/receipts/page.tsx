import {WorkshopPanel} from '@/components/features/manufacturing/WorkshopPanel';
import ProcurementWorkspace from "@/components/features/manufacturing/ProcurementWorkspace";
export default function Page() { return <><div className="rf-page"><h1 className="text-2xl font-semibold">Mal kabul</h1><WorkshopPanel mode="receiving"/></div><details className="rf-page"><summary>Geçmiş kabul kayıtları ve düzeltmeler</summary><ProcurementWorkspace section="receipts" /></details></>; }
