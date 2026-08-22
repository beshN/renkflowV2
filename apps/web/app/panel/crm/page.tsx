import { Building2, Mail, Phone, ShoppingBag, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { createCustomer, updateCustomerStatus } from "@/app/actions/business";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/lib/auth";

const statusLabels: Record<string, string> = { prospect: "Potansiyel", active: "Aktif", inactive: "Pasif" };

export default async function CrmPage() {
  const { supabase, membership } = await requireOrganization();
  if (membership.role === "production") redirect("/panel");
  const orgId = membership.organization_id;
  const [{ data: customers, error: customersError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase.from("crm_customers").select("*").eq("organization_id", orgId).order("updated_at", { ascending: false }),
    supabase.from("orders").select("customer_name, status").eq("organization_id", orgId).not("customer_name", "is", null),
  ]);
  if (customersError || ordersError) throw new Error("CRM verileri yüklenemedi.");
  const ordersByCustomer = new Map<string, { total: number; active: number }>();
  for (const order of orders ?? []) {
    const name = order.customer_name?.trim(); if (!name) continue;
    const current = ordersByCustomer.get(name.toLocaleLowerCase("tr-TR")) ?? { total: 0, active: 0 };
    current.total += 1; if (!["delivered", "cancelled"].includes(order.status)) current.active += 1;
    ordersByCustomer.set(name.toLocaleLowerCase("tr-TR"), current);
  }

  return (
    <>
      <PageHeader eyebrow="Müşteri ilişkileri" title="CRM ve Müşteriler" description="Eski CRM modülü, sipariş geçmişiyle birleşen şirket bazlı müşteri kartlarıyla geri döndü." />
      <div className="business-layout">
        <section className="content-card">
          <div className="card-heading"><div><span>Müşteri portföyü</span><h2>Kayıtlı müşteriler</h2></div><Building2 size={20} /></div>
          <div className="business-list">{(customers ?? []).map((customer) => { const stats = ordersByCustomer.get(customer.name.toLocaleLowerCase("tr-TR")) ?? { total: 0, active: 0 }; return <article key={customer.id}><span>{customer.name.slice(0, 1).toUpperCase()}</span><div><b>{customer.name}</b><small>{customer.contact_person || "Yetkili belirtilmedi"}</small><p>{customer.email ? <em><Mail size={11} />{customer.email}</em> : null}{customer.phone ? <em><Phone size={11} />{customer.phone}</em> : null}</p></div><dl><div><dt>Toplam sipariş</dt><dd>{stats.total}</dd></div><div><dt>Aktif iş</dt><dd>{stats.active}</dd></div></dl><div className="business-record-actions"><i className={`business-status status-${customer.status}`}>{statusLabels[customer.status]}</i><ActionForm action={updateCustomerStatus} className="inline-status-form" submitLabel="Güncelle" pendingLabel="…"><input type="hidden" name="organizationId" value={orgId} /><input type="hidden" name="customerId" value={customer.id} /><select name="status" defaultValue={customer.status} aria-label={`${customer.name} durumu`}><option value="prospect">Potansiyel</option><option value="active">Aktif</option><option value="inactive">Pasif</option></select></ActionForm></div></article>; })}{!customers?.length && <div className="compact-empty"><UserRound size={25} /><p>Henüz müşteri kartı yok. Siparişlerdeki müşterileri kartlaştırarak başlayın.</p></div>}</div>
        </section>
        <section className="form-card business-form-card">
          <div className="card-heading"><div><span>Yeni CRM kaydı</span><h2>Müşteri kartı oluştur</h2></div></div>
          <ActionForm action={createCustomer} className="record-form" submitLabel="Müşteriyi kaydet" pendingLabel="Kaydediliyor…">
            <input type="hidden" name="organizationId" value={orgId} />
            <label>Müşteri / şirket adı<input name="name" required /></label>
            <div className="form-grid"><label>Yetkili kişi<input name="contactPerson" /></label><label>Durum<select name="status" defaultValue="active"><option value="prospect">Potansiyel</option><option value="active">Aktif</option><option value="inactive">Pasif</option></select></label></div>
            <div className="form-grid"><label>E-posta<input type="email" name="email" /></label><label>Telefon<input name="phone" /></label></div>
            <label>Notlar<textarea name="notes" rows={4} /></label>
          </ActionForm>
        </section>
      </div>
      <div className="module-note"><ShoppingBag size={20} /><div><b>Sipariş geçmişiyle otomatik eşleşme</b><p>Müşteri kartındaki şirket adı ile siparişteki müşteri adı aynı olduğunda toplam ve aktif sipariş sayıları otomatik görünür.</p></div></div>
    </>
  );
}
