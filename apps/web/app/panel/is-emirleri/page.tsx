import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganization } from "@/lib/auth";
import { deriveProductionProgress } from "@/lib/production/progression";

export default async function WorkOrdersPage() {
  const { supabase, membership } = await requireOrganization();
  const orgId = membership.organization_id;
  const [{ data: orders }, { data: stages }, { data: events }, { data: items }] = await Promise.all([
    supabase.from("orders").select("id, order_number, customer_name, project_name, status, approved_at, updated_at")
      .eq("organization_id", orgId).in("status", ["approved", "in_production", "ready"]).order("updated_at", { ascending: false }),
    supabase.from("production_stages").select("*").eq("organization_id", orgId).eq("is_active", true).order("position"),
    supabase.from("order_stage_events").select("order_id, stage_id, event_type, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }),
    supabase.from("order_items").select("order_id, quantity").eq("organization_id", orgId),
  ]);
  const eventsByOrder = new Map<string, NonNullable<typeof events>>();
  for (const event of events ?? []) eventsByOrder.set(event.order_id, [...(eventsByOrder.get(event.order_id) ?? []), event]);
  const quantities = new Map<string, number>();
  for (const item of items ?? []) quantities.set(item.order_id, (quantities.get(item.order_id) ?? 0) + Number(item.quantity));

  return (
    <>
      <PageHeader eyebrow="Atölye planlama" title="İş Emri Takibi" description="Onaydan sevkiyata kadar her iş emrinin aktif aşamasını, ürün adedini ve ilerlemesini izleyin." />
      <section className="work-order-grid">
        {(orders ?? []).map((order) => {
          const progress = deriveProductionProgress(stages ?? [], eventsByOrder.get(order.id) ?? []);
          const completed = progress.completedStageIds.length;
          const total = Math.max((stages ?? []).length, 1);
          return (
            <article className="work-order-card" key={order.id}>
              <header><div><span>İş emri</span><b>{order.order_number}</b></div><StatusBadge value={order.status} /></header>
              <h2>{order.customer_name || "Müşteri bekliyor"}</h2>
              <p>{order.project_name || "Proje bilgisi yok"}</p>
              <dl><div><dt>Ürün</dt><dd>{quantities.get(order.id) ?? 0} adet</dd></div><div><dt>Aktif aşama</dt><dd>{progress.message}</dd></div><div><dt>Güncelleme</dt><dd>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(order.updated_at))}</dd></div></dl>
              <div className="work-progress"><span style={{ width: `${Math.round((completed / total) * 100)}%` }} /></div>
              <footer><small>{completed}/{total} aşama tamamlandı</small><Link href={`/panel/siparisler/${order.id}`}>İş emrini aç</Link></footer>
            </article>
          );
        })}
        {!orders?.length && <div className="empty-state content-card work-orders-empty"><ClipboardList size={30} /><b>Aktif iş emri yok</b><p>Onaylanan siparişler otomatik olarak burada görünür.</p></div>}
      </section>
    </>
  );
}
