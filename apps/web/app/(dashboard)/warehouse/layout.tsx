import { WarehouseShell } from "@/components/features/warehouse/WarehouseShell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <WarehouseShell>{children}</WarehouseShell>;
}
