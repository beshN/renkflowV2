import Link from "next/link";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StageAction } from "@/components/stage-action";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganization } from "@/lib/auth";

export default async function ProductionPage() {
  const { supabase, membership } = await requireOrganization();
  const orgId = membership.organization_id;
  const [{ data: stages }, { data: orders }, { data: events }] = await Promise.all([
    supabase.from("production_stages").select("*").eq("organization_id", orgId).eq("is_active", true).order("position"),
    supabase.from("orders").select("id, order_number, customer_name, project_name, status")
      .eq("organization_id", orgId).in("status", ["approved", "in_production", "ready"]).order("updated_at"),
    supabase.from("order_stage_events").select("order_id, stage_id, event_type, created_at")
      .eq("organization_id", orgId).order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <PageHeader eyebrow="Atölye görünümü" title="Üretim" description="Onaylanmış siparişleri aşama aşama ilerletin." />
      <section className="stage-strip">{(stages ?? []).map((stage) => <div key={stage.id}><i style={{ background: stage.color }} /><span>{String(stage.position).padStart(2, "0")}</span><b>{stage.name}</b></div>)}</section>
      <section className="production-list">
        {(orders ?? []).map((order) => {
          const orderEvents = (events ?? []).filter((event) => event.order_id === order.id);
          const latestStageId = orderEvents[0]?.stage_id;
          const latestIndex = Math.max(0, (stages ?? []).findIndex((stage) => stage.id === latestStageId));
          const nextStage = (stages ?? [])[orderEvents.length ? Math.min(latestIndex + 1, (stages?.length ?? 1) - 1) : 0];
          return (
            <article key={order.id}>
              <div className="production-order">
                <span><b>{order.order_number}</b><small>{order.customer_name || "Müşteri"} · {order.project_name || "Proje yok"}</small></span>
                <StatusBadge value={order.status} />
              </div>
              <div className="production-progress">{(stages ?? []).map((stage, index) => <i key={stage.id} className={index <= latestIndex && orderEvents.length ? "done" : ""} />)}</div>
              <div className="production-footer"><Link href={`/panel/siparisler/${order.id}`}>Siparişi aç</Link>{nextStage && <StageAction organizationId={orgId} orderId={order.id} stageId={nextStage.id} label={orderEvents.length ? `${nextStage.name} aşamasına geçir` : "Üretimi başlat"} />}</div>
            </article>
          );
        })}
        {!orders?.length && <div className="empty-state content-card"><Boxes size={30} /><b>Üretime hazır sipariş yok</b><p>PDF analizi ofis tarafından onaylanan siparişler burada görünür.</p></div>}
      </section>
    </>
  );
}
