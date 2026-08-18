import Link from "next/link";
import { KanbanSquare } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganization } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";

const columns: Array<{ status: OrderStatus; label: string; hint: string }> = [
  { status: "draft", label: "Taslak", hint: "Yeni kayıtlar" },
  { status: "awaiting_review", label: "İnceleme", hint: "Ofis kontrolü" },
  { status: "approved", label: "Onaylandı", hint: "Üretim kuyruğu" },
  { status: "in_production", label: "Üretimde", hint: "Atölyede" },
  { status: "ready", label: "Hazır", hint: "Sevkiyat bekliyor" },
  { status: "delivered", label: "Teslim", hint: "Tamamlandı" },
];

export default async function KanbanPage() {
  const { supabase, membership } = await requireOrganization();
  const { data: orders } = await supabase.from("orders")
    .select("id, order_number, customer_name, project_name, status, updated_at")
    .eq("organization_id", membership.organization_id)
    .neq("status", "cancelled")
    .order("updated_at", { ascending: false });

  return (
    <>
      <PageHeader eyebrow="Görsel operasyon" title="Akış Kanbanı" description="Eski Kanban görünümü yeni sipariş durumları ve canlı Supabase kayıtlarıyla geri döndü." />
      <section className="kanban-board">
        {columns.map((column) => {
          const columnOrders = (orders ?? []).filter((order) => order.status === column.status);
          return (
            <div className={`kanban-column kanban-${column.status}`} key={column.status}>
              <header><div><b>{column.label}</b><small>{column.hint}</small></div><span>{columnOrders.length}</span></header>
              <div className="kanban-cards">
                {columnOrders.map((order) => (
                  <Link href={`/panel/siparisler/${order.id}`} key={order.id}>
                    <span>{order.order_number}</span>
                    <b>{order.customer_name || "Müşteri bekliyor"}</b>
                    <small>{order.project_name || "Proje bilgisi yok"}</small>
                    <time>{new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(new Date(order.updated_at))}</time>
                  </Link>
                ))}
                {!columnOrders.length && <div className="kanban-empty"><KanbanSquare size={18} /><span>Kayıt yok</span></div>}
              </div>
            </div>
          );
        })}
      </section>
      {(orders ?? []).some((order) => order.status === "cancelled") ? <div className="cancelled-summary"><StatusBadge value="cancelled" /><span>{orders?.filter((order) => order.status === "cancelled").length} iptal edilmiş sipariş Kanban dışında tutuluyor.</span></div> : null}
    </>
  );
}
