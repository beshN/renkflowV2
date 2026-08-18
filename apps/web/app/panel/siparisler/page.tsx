import Link from "next/link";
import { Search, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganization } from "@/lib/auth";
import { orderStatuses, type OrderStatus } from "@/lib/types";

const statusLabels: Record<OrderStatus, string> = {
  draft: "Taslak",
  awaiting_review: "İnceleme bekliyor",
  approved: "Onaylandı",
  in_production: "Üretimde",
  ready: "Hazır",
  delivered: "Teslim edildi",
  cancelled: "İptal",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { supabase, membership } = await requireOrganization();
  const params = await searchParams;
  const canManageOrders = membership.role !== "production";
  const query = (params.q ?? "").trim().slice(0, 160);
  const safeQuery = query.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
  const status = orderStatuses.includes(params.status as OrderStatus) ? params.status as OrderStatus : null;
  let ordersQuery = supabase.from("orders")
    .select("id, order_number, customer_name, project_name, customer_reference, status, created_at, documents(count)")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (status) ordersQuery = ordersQuery.eq("status", status);
  if (safeQuery) {
    ordersQuery = ordersQuery.or([
      `order_number.ilike.%${safeQuery}%`,
      `customer_name.ilike.%${safeQuery}%`,
      `project_name.ilike.%${safeQuery}%`,
      `customer_reference.ilike.%${safeQuery}%`,
    ].join(","));
  }
  const { data: orders } = await ordersQuery;

  return (
    <>
      <PageHeader eyebrow="Sipariş merkezi" title="Siparişler" description="PDF, doğrulama ve üretim durumuyla tüm siparişler." action={canManageOrders ? <Link className="button button-primary" href="/panel/siparisler/yeni">Yeni sipariş</Link> : undefined} />
      <section className="content-card">
        <form className="list-toolbar" action="/panel/siparisler" method="get">
          <label className="order-search"><Search size={17} aria-hidden="true" /><input name="q" defaultValue={query} placeholder="Sipariş no, müşteri veya proje ara" aria-label="Sipariş ara" /></label>
          <select name="status" defaultValue={status ?? ""} aria-label="Sipariş durumu">
            <option value="">Tüm durumlar</option>
            {orderStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
          </select>
          <button type="submit" className="small-action">Filtrele</button>
          <span>{orders?.length ?? 0} kayıt</span>
        </form>
        <div className="orders-table">
          <div className="table-row table-head orders-list-head"><span>Sipariş</span><span>Müşteri / Proje</span><span>PDF</span><span>Durum</span></div>
          {(orders ?? []).map((order) => (
            <Link href={`/panel/siparisler/${order.id}`} className="table-row orders-list-head" key={order.id}>
              <span><b>{order.order_number}</b><small>{order.customer_reference || "Referans yok"}</small></span>
              <span><strong>{order.customer_name || "Henüz çıkarılmadı"}</strong><small>{order.project_name || "PDF analizi bekleniyor"}</small></span>
              <span>{Array.isArray(order.documents) ? order.documents[0]?.count ?? 0 : 0} dosya</span>
              <StatusBadge value={order.status} />
            </Link>
          ))}
          {!orders?.length && <div className="empty-state"><ShoppingBag size={30} /><b>{query || status ? "Eşleşen sipariş bulunamadı" : "İlk siparişinizi oluşturun"}</b><p>{query || status ? "Arama metnini veya durum filtresini değiştirin." : "Boş sipariş açın, PDF yükleyin ve alanları AI ile çıkarın."}</p></div>}
        </div>
      </section>
    </>
  );
}
