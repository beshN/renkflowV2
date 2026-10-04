import FinanceRecords from "@/components/features/finance/FinanceRecords";
export default async function Page({params}:{params:Promise<{id:string}>}){return <FinanceRecords section="employees" employeeId={(await params).id}/>;}
