import Link from "next/link";
import type { CSSProperties } from "react";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StageAction } from "@/components/stage-action";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganization } from "@/lib/auth";
import { deriveProductionProgress } from "@/lib/production/progression";

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
  const stageList = stages ?? [];
  const eventsByOrder = new Map<string, typeof events>();

  for (const event of events ?? []) {
    const orderEvents = eventsByOrder.get(event.order_id) ?? [];
    orderEvents.push(event);
    eventsByOrder.set(event.order_id, orderEvents);
  }
  const stageGridStyle = { "--stage-count": Math.max(stageList.length, 1) } as CSSProperties;

  return (
    <>
      <PageHeader eyebrow="Atölye görünümü" title="Üretim" description="Onaylanmış siparişleri aşama aşama ilerletin." />
      <section className="stage-strip" style={stageGridStyle}>{stageList.map((stage) => <div key={stage.id}><i style={{ background: stage.color }} /><span>{String(stage.position).padStart(2, "0")}</span><b>{stage.name}</b></div>)}</section>
      <section className="production-list">
        {(orders ?? []).map((order) => {
          const orderEvents = eventsByOrder.get(order.id) ?? [];
          const progress = deriveProductionProgress(stageList, orderEvents);
          const completedStageIds = new Set(progress.completedStageIds);
          return (
            <article key={order.id}>
              <div className="production-order">
                <span><b>{order.order_number}</b><small>{order.customer_name || "Müşteri"} · {order.project_name || "Proje yok"}</small></span>
                <StatusBadge value={order.status} />
              </div>
              <div className="production-progress" style={stageGridStyle} aria-label={progress.message}>{stageList.map((stage) => <i key={stage.id} className={completedStageIds.has(stage.id) ? "done" : progress.activeStageId === stage.id ? "active" : ""} title={stage.name} aria-hidden="true" />)}</div>
              <p className="production-message">{progress.message}</p>
              <div className="production-footer"><Link href={`/panel/siparisler/${order.id}`}>Siparişi aç</Link>{progress.action ? <StageAction organizationId={orgId} orderId={order.id} stageId={progress.action.stageId} eventType={progress.action.eventType} label={progress.action.label} /> : null}</div>
            </article>
          );
        })}
        {!orders?.length && <div className="empty-state content-card"><Boxes size={30} /><b>Üretime hazır sipariş yok</b><p>PDF analizi ofis tarafından onaylanan siparişler burada görünür.</p></div>}
      </section>
    </>
  );
}
