import Link from "next/link";
import { CheckCircle2, CircleDollarSign, FileQuestion, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganization } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function FinancePage() {
  const { supabase, membership } = await requireOrganization();
  if (membership.role !== "owner" && membership.role !== "admin") redirect("/panel");
  const orgId = membership.organization_id;
  const [{ data: orders }, { data: items }, { data: calculations }] = await Promise.all([
    supabase.from("orders").select("id, order_number, customer_name, project_name, status, approved_at, updated_at").eq("organization_id", orgId).order("updated_at", { ascending: false }),
    supabase.from("order_items").select("order_id, quantity").eq("organization_id", orgId),
    supabase.from("calculation_runs").select("order_id, created_at").eq("organization_id", orgId),
  ]);
  const quantityByOrder = new Map<string, number>();
  for (const item of items ?? []) quantityByOrder.set(item.order_id, (quantityByOrder.get(item.order_id) ?? 0) + Number(item.quantity));
  const calculatedOrders = new Set((calculations ?? []).map((run) => run.order_id));
  const commerciallyReady = (orders ?? []).filter((order) => order.approved_at && calculatedOrders.has(order.id));

  return (
    <>
      <PageHeader eyebrow="Ticari hazırlık kontrolü" title="Finans Kontrolü" description="Eski finans modülü korunuyor; ilk aşamada siparişlerin teklif/faturalama verisi için operasyonel hazır oluşunu denetliyor." />
      <section className="finance-readiness">
        <article><span><CheckCircle2 size={21} /></span><div><small>Onaylı sipariş</small><b>{orders?.filter((order) => order.approved_at).length ?? 0}</b><p>İnsan tarafından doğrulandı</p></div></article>
        <article><span className="tone-blue"><CircleDollarSign size={21} /></span><div><small>Hesabı tamamlanan</small><b>{calculatedOrders.size}</b><p>Sürümlü kural sonucu var</p></div></article>
        <article><span className="tone-amber"><FileQuestion size={21} /></span><div><small>Ticari işleme hazır</small><b>{commerciallyReady.length}</b><p>Onay + hesap mevcut</p></div></article>
      </section>
      <div className="module-note finance-note"><ShieldCheck size={20} /><div><b>Sahte tutar göstermiyoruz</b><p>Yeni çekirdek şemada fiyat, vergi, para birimi ve ödeme tabloları henüz bulunmadığı için finans ekranı gerçek olmayan ciro üretmez. Bu alanlar bir sonraki güvenli şema genişletmesinde eklenecek.</p></div></div>
      <section className="content-card"><div className="card-heading"><div><span>Ticari iş listesi</span><h2>Sipariş hazırlık durumu</h2></div></div><div className="orders-table"><div className="table-row table-head finance-table"><span>Sipariş</span><span>Müşteri / Proje</span><span>Ürün</span><span>Hesap</span><span>Durum</span></div>{(orders ?? []).map((order) => <Link className="table-row finance-table" href={`/panel/siparisler/${order.id}`} key={order.id}><b>{order.order_number}</b><span><strong>{order.customer_name || "Müşteri bekliyor"}</strong><small>{order.project_name || "Proje yok"}</small></span><span>{quantityByOrder.get(order.id) ?? 0} adet</span><span>{calculatedOrders.has(order.id) ? "Hazır" : "Bekliyor"}</span><StatusBadge value={order.status} /></Link>)}</div></section>
    </>
  );
}
