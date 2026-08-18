import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CirclePlus,
  FileCheck2,
  FileClock,
  KanbanSquare,
  PackageSearch,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganization } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";

const statusLabels: Record<OrderStatus, string> = {
  draft: "Taslak",
  awaiting_review: "İnceleme",
  approved: "Onaylandı",
  in_production: "Üretimde",
  ready: "Hazır",
  delivered: "Teslim",
  cancelled: "İptal",
};

const statusOrder: OrderStatus[] = ["draft", "awaiting_review", "approved", "in_production", "ready", "delivered", "cancelled"];

export default async function OverviewPage() {
  const { supabase, membership } = await requireOrganization();
  const orgId = membership.organization_id;
  const canManageOrders = membership.role !== "production";
  const [ordersResult, itemsResult, analysesResult, documentsResult, membersResult, eventsResult] = await Promise.all([
    supabase.from("orders").select("id, order_number, customer_name, project_name, status, created_at, updated_at")
      .eq("organization_id", orgId).order("updated_at", { ascending: false }).limit(200),
    supabase.from("order_items").select("quantity, width_mm, height_mm").eq("organization_id", orgId),
    supabase.from("document_analyses").select("id, status, cost_usd, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("organization_members").select("user_id", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("order_stage_events").select("id, event_type, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
  ]);

  const orders = ordersResult.data ?? [];
  const analyses = analysesResult.data ?? [];
  const totalQuantity = (itemsResult.data ?? []).reduce((total, item) => total + Number(item.quantity || 0), 0);
  const statusCounts = new Map<OrderStatus, number>();
  for (const order of orders) statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1);
  const waitingReview = analyses.filter((analysis) => analysis.status === "needs_review").length;
  const failedAnalyses = analyses.filter((analysis) => analysis.status === "failed").length;
  const activeProduction = statusCounts.get("in_production") ?? 0;
  const completedThisMonth = orders.filter((order) => {
    const date = new Date(order.updated_at);
    const now = new Date();
    return order.status === "delivered" && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;
  const completedStageEvents = (eventsResult.data ?? []).filter((event) => event.event_type === "completed").length;
  const operationalScore = orders.length === 0
    ? 0
    : Math.round(((orders.length - failedAnalyses - waitingReview * 0.35) / orders.length) * 100);

  return (
    <>
      <PageHeader
        eyebrow="Canlı operasyon merkezi"
        title="Kontrol Paneli"
        description="Eski RenkFlow’un kapsamlı görünümü, yeni Supabase verileri ve şirket bazlı yetkilendirmeyle yeniden çalışıyor."
        action={canManageOrders ? <Link className="button button-primary" href="/panel/siparisler/yeni"><CirclePlus size={17} /> Yeni sipariş</Link> : undefined}
      />

      <section className="metrics-grid dashboard-metrics">
        <Metric icon={ShoppingBag} label="Toplam sipariş" value={orders.length} detail={`${totalQuantity} ürün/adet`} trend="Canlı kayıt" />
        <Metric icon={FileClock} label="Kontrol bekleyen" value={waitingReview} detail="Ofis aksiyonu" tone="amber" trend={waitingReview ? "İnceleme gerekli" : "Akış temiz"} />
        <Metric icon={Boxes} label="Aktif üretim" value={activeProduction} detail={`${completedStageEvents} aşama tamamlandı`} tone="violet" trend="Atölye akışı" />
        <Metric icon={FileCheck2} label="Bu ay teslim" value={completedThisMonth} detail={`${documentsResult.count ?? 0} PDF arşivde`} tone="blue" trend="Doğrulanmış veri" />
      </section>

      <section className="dashboard-grid">
        <article className="content-card dashboard-chart-card">
          <div className="card-heading">
            <div><span>Sipariş dağılımı</span><h2>Operasyon akışı</h2></div>
            <Link href="/panel/analitik">Detaylı analitik <ArrowRight size={15} /></Link>
          </div>
          <div className="flow-chart" aria-label="Siparişlerin durumlara göre dağılımı">
            {statusOrder.map((status) => {
              const count = statusCounts.get(status) ?? 0;
              const percentage = orders.length ? Math.max(5, Math.round((count / orders.length) * 100)) : 5;
              return (
                <div className="flow-chart-column" key={status}>
                  <b>{count}</b>
                  <div><i className={`flow-${status}`} style={{ height: `${percentage}%` }} /></div>
                  <span>{statusLabels[status]}</span>
                </div>
              );
            })}
          </div>
          <div className="dashboard-health">
            <div className="health-ring" style={{ "--score": `${Math.max(0, Math.min(100, operationalScore)) * 3.6}deg` } as React.CSSProperties}><span><b>%{Math.max(0, operationalScore)}</b><small>Akış skoru</small></span></div>
            <div><b>Operasyon sağlığı</b><p>Başarısız analiz ve bekleyen insan kontrollerine göre canlı hesaplanır; örnek veya sahte veri kullanılmaz.</p></div>
          </div>
        </article>

        <article className="content-card quick-actions-card">
          <div className="card-heading"><div><span>Kısayollar</span><h2>Hızlı işlemler</h2></div><Sparkles size={19} /></div>
          <div className="quick-action-list">
            {canManageOrders ? <QuickAction href="/panel/siparisler/yeni" icon={CirclePlus} title="Yeni sipariş oluştur" text="PDF yükle ve AI analizini başlat" /> : null}
            <QuickAction href="/panel/kanban" icon={KanbanSquare} title="Akış Kanbanı" text="Siparişleri durumlarına göre izle" />
            <QuickAction href="/panel/envanter" icon={PackageSearch} title="Malzeme ihtiyaçları" text="Onaylanan ürünlerden ihtiyacı çıkar" />
            <QuickAction href="/panel/raporlar" icon={BarChart3} title="Operasyon raporu" text="Gerçek sipariş ve üretim metrikleri" />
            {membership.role === "owner" || membership.role === "admin" ? <QuickAction href="/panel/ekip" icon={Users} title="Ekip yönetimi" text={`${membersResult.count ?? 0} aktif kullanıcı`} /> : null}
          </div>
        </article>
      </section>

      <section className="content-card dashboard-orders-card">
        <div className="card-heading"><div><span>Son hareketler</span><h2>Güncel siparişler</h2></div><Link href="/panel/siparisler">Tüm siparişler <ArrowRight size={15} /></Link></div>
        <div className="orders-table">
          <div className="table-row table-head"><span>Sipariş</span><span>Müşteri / Proje</span><span>Durum</span><span>Güncelleme</span></div>
          {orders.slice(0, 7).map((order) => (
            <Link href={`/panel/siparisler/${order.id}`} className="table-row" key={order.id}>
              <b>{order.order_number}</b>
              <span><strong>{order.customer_name || "Müşteri bekliyor"}</strong><small>{order.project_name || "Proje bilgisi yok"}</small></span>
              <StatusBadge value={order.status} />
              <time>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(order.updated_at))}</time>
            </Link>
          ))}
          {!orders.length && <div className="empty-state"><ShoppingBag size={28} /><b>Henüz sipariş yok</b><p>İlk siparişi oluşturup PDF yükleyerek başlayın.</p></div>}
        </div>
      </section>
    </>
  );
}

function Metric({ icon: Icon, label, value, detail, trend, tone = "green" }: { icon: typeof ShoppingBag; label: string; value: number; detail: string; trend: string; tone?: string }) {
  return <article className="metric-card"><div className={`metric-icon tone-${tone}`}><Icon size={20} /></div><span>{label}</span><strong>{value}</strong><small>{detail}</small><em>{trend}</em></article>;
}

function QuickAction({ href, icon: Icon, title, text }: { href: string; icon: typeof CirclePlus; title: string; text: string }) {
  return <Link href={href}><span><Icon size={19} /></span><div><b>{title}</b><small>{text}</small></div><ArrowRight size={16} /></Link>;
}
