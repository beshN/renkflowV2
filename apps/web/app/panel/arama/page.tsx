import Link from "next/link";
import { FileText, Search, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganization } from "@/lib/auth";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase, membership } = await requireOrganization();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 120);
  const safeQuery = query.replace(/[^\p{L}\p{N}\s._-]/gu, " ").replace(/\s+/g, " ").trim();
  let orderQuery = supabase.from("orders").select("id, order_number, customer_name, project_name, customer_reference, status, updated_at")
    .eq("organization_id", membership.organization_id).order("updated_at", { ascending: false }).limit(50);
  let documentQuery = supabase.from("documents").select("id, order_id, original_name, created_at")
    .eq("organization_id", membership.organization_id).order("created_at", { ascending: false }).limit(50);
  if (safeQuery) {
    orderQuery = orderQuery.or(`order_number.ilike.%${safeQuery}%,customer_name.ilike.%${safeQuery}%,project_name.ilike.%${safeQuery}%,customer_reference.ilike.%${safeQuery}%`);
    documentQuery = documentQuery.ilike("original_name", `%${safeQuery}%`);
  }
  const [{ data: orders }, { data: documents }] = await Promise.all([orderQuery, documentQuery]);
  const orderIds = [...new Set((documents ?? []).map((document) => document.order_id))];
  const { data: documentOrders } = orderIds.length
    ? await supabase.from("orders").select("id, order_number").eq("organization_id", membership.organization_id).in("id", orderIds)
    : { data: [] as Array<{ id: string; order_number: string }> };
  const orderNumberById = new Map((documentOrders ?? []).map((order) => [order.id, order.order_number]));

  return (
    <>
      <PageHeader eyebrow="Merkezi kayıt bulucu" title="Kayıt Arama" description="Sipariş numarası, müşteri, proje, referans ve PDF dosya adına göre şirket kayıtlarını arayın." />
      <form className="search-hero" action="/panel/arama" method="get"><Search size={22} /><input name="q" defaultValue={query} placeholder="Aramak istediğiniz kaydı yazın…" autoFocus /><button type="submit">Ara</button></form>
      {!query ? <p className="search-suggestion">Son kayıtlar gösteriliyor. Daha dar sonuçlar için yukarıdaki arama alanını kullanın.</p> : <p className="search-suggestion"><b>“{query}”</b> için {(orders?.length ?? 0) + (documents?.length ?? 0)} sonuç bulundu.</p>}
      <div className="search-results-grid">
        <section className="content-card"><div className="card-heading"><div><span>Sipariş kayıtları</span><h2>Siparişler</h2></div><ShoppingBag size={19} /></div><div className="search-result-list">{(orders ?? []).map((order) => <Link href={`/panel/siparisler/${order.id}`} key={order.id}><ShoppingBag size={17} /><div><b>{order.order_number} · {order.customer_name || "Müşteri bekliyor"}</b><small>{order.project_name || order.customer_reference || "Ek bilgi yok"}</small></div><StatusBadge value={order.status} /></Link>)}{!orders?.length && <div className="compact-empty">Eşleşen sipariş yok.</div>}</div></section>
        <section className="content-card"><div className="card-heading"><div><span>Belge arşivi</span><h2>PDF dosyaları</h2></div><FileText size={19} /></div><div className="search-result-list">{(documents ?? []).map((document) => <Link href={`/panel/siparisler/${document.order_id}`} key={document.id}><FileText size={17} /><div><b>{document.original_name}</b><small>{orderNumberById.get(document.order_id) || "Sipariş"} · {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(document.created_at))}</small></div></Link>)}{!documents?.length && <div className="compact-empty">Eşleşen PDF yok.</div>}</div></section>
      </div>
    </>
  );
}
