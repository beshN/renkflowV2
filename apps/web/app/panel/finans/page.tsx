import Link from "next/link";
import { CheckCircle2, CircleDollarSign, FileText, ReceiptText } from "lucide-react";
import { redirect } from "next/navigation";
import { createFinancialRecord, updateFinancialStatus } from "@/app/actions/business";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganization } from "@/lib/auth";

const typeLabels: Record<string, string> = { quote: "Teklif", invoice: "Fatura", payment: "Tahsilat", expense: "Gider" };
const financeStatusLabels: Record<string, string> = { draft: "Taslak", issued: "Düzenlendi", paid: "Ödendi", overdue: "Gecikmiş", cancelled: "İptal" };

export default async function FinancePage() {
  const { supabase, membership } = await requireOrganization();
  if (membership.role !== "owner" && membership.role !== "admin") redirect("/panel");
  const orgId = membership.organization_id;
  const [{ data: orders, error: ordersError }, { data: items, error: itemsError }, { data: calculations, error: calculationsError }, { data: records, error: recordsError }, { data: customers, error: customersError }] = await Promise.all([
    supabase.from("orders").select("id, order_number, customer_name, project_name, status, approved_at, updated_at").eq("organization_id", orgId).order("updated_at", { ascending: false }),
    supabase.from("order_items").select("order_id, quantity").eq("organization_id", orgId),
    supabase.from("calculation_runs").select("order_id, created_at").eq("organization_id", orgId),
    supabase.from("financial_records").select("*").eq("organization_id", orgId).order("issue_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("crm_customers").select("id, name").eq("organization_id", orgId).eq("status", "active").order("name"),
  ]);
  if (ordersError || itemsError || calculationsError || recordsError || customersError) throw new Error("Finans verileri yüklenemedi.");
  const quantityByOrder = new Map<string, number>(); for (const item of items ?? []) quantityByOrder.set(item.order_id, (quantityByOrder.get(item.order_id) ?? 0) + Number(item.quantity));
  const calculatedOrders = new Set((calculations ?? []).map((run) => run.order_id));
  const orderNumbers = new Map((orders ?? []).map((order) => [order.id, order.order_number]));
  const customerNames = new Map((customers ?? []).map((customer) => [customer.id, customer.name]));
  const totals = new Map<string, number>(); for (const record of records ?? []) if (record.status !== "cancelled") totals.set(record.currency, (totals.get(record.currency) ?? 0) + (record.record_type === "expense" ? -1 : 1) * Number(record.amount));
  const overdue = records?.filter((record) => record.status === "overdue" || (record.status === "issued" && record.due_date && new Date(record.due_date) < new Date())).length ?? 0;

  return (
    <>
      <PageHeader eyebrow="Teklif, fatura ve nakit akışı" title="Finans Kontrolü" description="Eski finans modülü, gerçek para birimli kayıtlar ve sipariş bağlantılarıyla Supabase üzerinde yeniden çalışıyor." />
      <section className="finance-readiness"><article><span><ReceiptText size={21} /></span><div><small>Finans kaydı</small><b>{records?.length ?? 0}</b><p>Teklif, fatura, tahsilat ve gider</p></div></article><article><span className="tone-blue"><CircleDollarSign size={21} /></span><div><small>Net kayıt toplamı</small><b>{[...totals.entries()].map(([currency, value]) => `${currency} ${value.toLocaleString("tr-TR")}`).join(" · ") || "—"}</b><p>İptal kayıtlar hariç</p></div></article><article><span className="tone-amber"><FileText size={21} /></span><div><small>Geciken kayıt</small><b>{overdue}</b><p>Takip gerektiren finans işi</p></div></article></section>
      <div className="business-layout finance-business-layout">
        <section className="content-card"><div className="card-heading"><div><span>Gerçek finans kayıtları</span><h2>Finans hareketleri</h2></div><CircleDollarSign size={20} /></div><div className="financial-list">{(records ?? []).map((record) => <article key={record.id}><span><ReceiptText size={17} /></span><div><b>{record.record_number} · {typeLabels[record.record_type]}</b><small>{record.description}</small><em>{record.order_id ? orderNumbers.get(record.order_id) : record.customer_id ? customerNames.get(record.customer_id) : "Genel kayıt"}</em></div><strong>{new Intl.NumberFormat("tr-TR", { style: "currency", currency: record.currency }).format(Number(record.amount))}</strong><div className="business-record-actions finance-record-actions"><i className={`finance-status finance-${record.status}`}>{financeStatusLabels[record.status]}</i><ActionForm action={updateFinancialStatus} className="inline-status-form" submitLabel="Güncelle" pendingLabel="…"><input type="hidden" name="organizationId" value={orgId} /><input type="hidden" name="recordId" value={record.id} /><select name="status" defaultValue={record.status} aria-label={`${record.record_number} durumu`}><option value="draft">Taslak</option><option value="issued">Düzenlendi</option><option value="paid">Ödendi</option><option value="overdue">Gecikmiş</option><option value="cancelled">İptal</option></select></ActionForm></div><time>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(`${record.issue_date}T00:00:00`))}</time></article>)}{!records?.length && <div className="compact-empty">Henüz finans kaydı yok.</div>}</div></section>
        <section className="form-card business-form-card"><div className="card-heading"><div><span>Yeni ticari hareket</span><h2>Finans kaydı oluştur</h2></div></div><ActionForm action={createFinancialRecord} className="record-form" submitLabel="Finans kaydını oluştur" pendingLabel="Kaydediliyor…"><input type="hidden" name="organizationId" value={orgId} /><div className="form-grid"><label>Kayıt numarası<input name="recordNumber" placeholder="TF-2026-001" required /></label><label>Tür<select name="recordType" defaultValue="quote"><option value="quote">Teklif</option><option value="invoice">Fatura</option><option value="payment">Tahsilat</option><option value="expense">Gider</option></select></label></div><label>Açıklama<input name="description" required /></label><div className="form-grid"><label>Tutar<input name="amount" type="number" min="0" step="0.01" required /></label><label>Para birimi<select name="currency" defaultValue="TRY"><option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label></div><div className="form-grid"><label>Durum<select name="status" defaultValue="draft"><option value="draft">Taslak</option><option value="issued">Düzenlendi</option><option value="paid">Ödendi</option><option value="overdue">Gecikmiş</option><option value="cancelled">İptal</option></select></label><label>Sipariş<select name="orderId" defaultValue=""><option value="">Sipariş seçilmedi</option>{(orders ?? []).map((order) => <option key={order.id} value={order.id}>{order.order_number} · {order.customer_name || "Müşteri"}</option>)}</select></label></div><label>Müşteri kartı<select name="customerId" defaultValue=""><option value="">Müşteri seçilmedi</option>{(customers ?? []).map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><div className="form-grid"><label>Düzenleme tarihi<input name="issueDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label>Vade tarihi<input name="dueDate" type="date" /></label></div><label>Notlar<textarea name="notes" rows={3} /></label></ActionForm></section>
      </div>
      <section className="content-card finance-order-readiness"><div className="card-heading"><div><span>Ticari hazırlık</span><h2>Siparişlerin finans hazırlığı</h2></div><CheckCircle2 size={20} /></div><div className="orders-table"><div className="table-row table-head finance-table"><span>Sipariş</span><span>Müşteri / Proje</span><span>Ürün</span><span>Hesap</span><span>Durum</span></div>{(orders ?? []).map((order) => <Link className="table-row finance-table" href={`/panel/siparisler/${order.id}`} key={order.id}><b>{order.order_number}</b><span><strong>{order.customer_name || "Müşteri bekliyor"}</strong><small>{order.project_name || "Proje yok"}</small></span><span>{quantityByOrder.get(order.id) ?? 0} adet</span><span>{calculatedOrders.has(order.id) ? "Hazır" : "Bekliyor"}</span><StatusBadge value={order.status} /></Link>)}</div></section>
    </>
  );
}
