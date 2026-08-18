import Link from "next/link";
import { ArrowRight, Boxes, FileCheck2, FileClock, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganization } from "@/lib/auth";

export default async function OverviewPage() {
  const { supabase, membership } = await requireOrganization();
  const orgId = membership.organization_id;
  const canManageOrders = membership.role !== "production";
  const [orders, activeProduction, waitingReview, documents, orderCount] = await Promise.all([
    supabase.from("orders").select("id, order_number, customer_name, project_name, status, updated_at")
      .eq("organization_id", orgId).order("updated_at", { ascending: false }).limit(6),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "in_production"),
    supabase.from("document_analyses").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "needs_review"),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
  ]);

  return (
    <>
      <PageHeader eyebrow="Operasyon merkezi" title="Genel Bakış" description="Sipariş, PDF inceleme ve üretim akışının güncel durumu." action={canManageOrders ? <Link className="button button-primary" href="/panel/siparisler/yeni">Yeni sipariş</Link> : undefined} />
      <section className="metrics-grid">
        <Metric icon={ShoppingBag} label="Toplam sipariş" value={orderCount.count ?? 0} detail="Tüm zamanlar" />
        <Metric icon={FileClock} label="Onay bekleyen analiz" value={waitingReview.count ?? 0} detail="Ofis aksiyonu gerekli" tone="amber" />
        <Metric icon={Boxes} label="Üretimde" value={activeProduction.count ?? 0} detail="Aktif sipariş" tone="violet" />
        <Metric icon={FileCheck2} label="Yüklenen PDF" value={documents.count ?? 0} detail="Bilgi tabanı" tone="blue" />
      </section>
      <section className="content-card">
        <div className="card-heading"><div><span>Son hareketler</span><h2>Güncel siparişler</h2></div><Link href="/panel/siparisler">Tümünü gör <ArrowRight size={15} /></Link></div>
        <div className="orders-table">
          <div className="table-row table-head"><span>Sipariş</span><span>Müşteri / Proje</span><span>Durum</span><span>Güncelleme</span></div>
          {(orders.data ?? []).map((order) => (
            <Link href={`/panel/siparisler/${order.id}`} className="table-row" key={order.id}>
              <b>{order.order_number}</b>
              <span><strong>{order.customer_name || "Müşteri bekliyor"}</strong><small>{order.project_name || "Proje bilgisi yok"}</small></span>
              <StatusBadge value={order.status} />
              <time>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(order.updated_at))}</time>
            </Link>
          ))}
          {!orders.data?.length && <div className="empty-state"><ShoppingBag size={28} /><b>Henüz sipariş yok</b><p>İlk siparişi oluşturup PDF yükleyerek başlayın.</p></div>}
        </div>
      </section>
    </>
  );
}

function Metric({ icon: Icon, label, value, detail, tone = "green" }: { icon: typeof ShoppingBag; label: string; value: number; detail: string; tone?: string }) {
  return <article className="metric-card"><div className={`metric-icon tone-${tone}`}><Icon size={20} /></div><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}
