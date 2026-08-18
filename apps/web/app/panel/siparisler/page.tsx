import Link from "next/link";
import { Search, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganization } from "@/lib/auth";

export default async function OrdersPage() {
  const { supabase, membership } = await requireOrganization();
  const { data: orders } = await supabase.from("orders")
    .select("id, order_number, customer_name, project_name, customer_reference, status, created_at, documents(count)")
    .eq("organization_id", membership.organization_id).order("created_at", { ascending: false });

  return (
    <>
      <PageHeader eyebrow="Sipariş merkezi" title="Siparişler" description="PDF, doğrulama ve üretim durumuyla tüm siparişler." action={<Link className="button button-primary" href="/panel/siparisler/yeni">Yeni sipariş</Link>} />
      <section className="content-card">
        <div className="list-toolbar"><div className="fake-search"><Search size={17} /><span>Sipariş no, müşteri veya proje ara</span></div><span>{orders?.length ?? 0} kayıt</span></div>
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
          {!orders?.length && <div className="empty-state"><ShoppingBag size={30} /><b>İlk siparişinizi oluşturun</b><p>Boş sipariş açın, PDF yükleyin ve alanları AI ile çıkarın.</p></div>}
        </div>
      </section>
    </>
  );
}
