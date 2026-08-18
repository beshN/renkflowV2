import { Boxes, Mail, Phone, Truck } from "lucide-react";
import { redirect } from "next/navigation";
import { createSupplier } from "@/app/actions/business";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/lib/auth";

const statusLabels: Record<string, string> = { active: "Aktif", paused: "Beklemede", inactive: "Pasif" };

export default async function SuppliersPage() {
  const { supabase, membership } = await requireOrganization();
  if (membership.role === "production") redirect("/panel");
  const orgId = membership.organization_id;
  const [{ data: suppliers }, { data: inventory }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("organization_id", orgId).order("updated_at", { ascending: false }),
    supabase.from("inventory_items").select("supplier_id, on_hand, unit_cost").eq("organization_id", orgId),
  ]);
  const inventoryBySupplier = new Map<string, { cards: number; value: number }>();
  for (const item of inventory ?? []) { if (!item.supplier_id) continue; const current = inventoryBySupplier.get(item.supplier_id) ?? { cards: 0, value: 0 }; current.cards += 1; current.value += Number(item.on_hand || 0) * Number(item.unit_cost || 0); inventoryBySupplier.set(item.supplier_id, current); }
  return (
    <>
      <PageHeader eyebrow="Tedarik ağı" title="Tedarikçiler" description="Profil, motor, LED ve diğer malzeme sağlayıcılarını stok kartlarıyla bağlantılı yönetin." />
      <div className="business-layout">
        <section className="content-card"><div className="card-heading"><div><span>Aktif tedarik ağı</span><h2>Tedarikçi kartları</h2></div><Truck size={20} /></div><div className="business-list supplier-list">{(suppliers ?? []).map((supplier) => { const stock = inventoryBySupplier.get(supplier.id) ?? { cards: 0, value: 0 }; return <article key={supplier.id}><span><Truck size={17} /></span><div><b>{supplier.name}</b><small>{supplier.contact_person || "Yetkili belirtilmedi"}</small><p>{supplier.email ? <em><Mail size={11} />{supplier.email}</em> : null}{supplier.phone ? <em><Phone size={11} />{supplier.phone}</em> : null}</p><p>{supplier.material_categories?.map((category: string) => <i key={category}>{category}</i>)}</p></div><dl><div><dt>Stok kartı</dt><dd>{stock.cards}</dd></div><div><dt>Stok değeri</dt><dd>₺{stock.value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</dd></div></dl><i className={`business-status status-${supplier.status}`}>{statusLabels[supplier.status]}</i></article>; })}{!suppliers?.length && <div className="compact-empty"><Truck size={25} /><p>Henüz tedarikçi kartı yok.</p></div>}</div></section>
        <section className="form-card business-form-card"><div className="card-heading"><div><span>Yeni tedarikçi</span><h2>Tedarikçi kartı oluştur</h2></div></div><ActionForm action={createSupplier} className="record-form" submitLabel="Tedarikçiyi kaydet" pendingLabel="Kaydediliyor…"><input type="hidden" name="organizationId" value={orgId} /><label>Tedarikçi adı<input name="name" required /></label><div className="form-grid"><label>Yetkili kişi<input name="contactPerson" /></label><label>Durum<select name="status" defaultValue="active"><option value="active">Aktif</option><option value="paused">Beklemede</option><option value="inactive">Pasif</option></select></label></div><div className="form-grid"><label>E-posta<input type="email" name="email" /></label><label>Telefon<input name="phone" /></label></div><label>Malzeme kategorileri<input name="categories" placeholder="Profil, motor, LED" /></label><label>Notlar<textarea name="notes" rows={4} /></label></ActionForm></section>
      </div>
      <div className="module-note"><Boxes size={20} /><div><b>Stok kartlarıyla bağlantılı</b><p>Bir stok kartına tedarikçi atandığında kart sayısı ve yaklaşık stok değeri burada otomatik hesaplanır.</p></div></div>
    </>
  );
}
