import Link from "next/link";
import { AlertTriangle, Lightbulb, PackageSearch, Ruler, Settings2 } from "lucide-react";
import { redirect } from "next/navigation";
import { createInventoryItem } from "@/app/actions/business";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/lib/auth";

type Requirement = { name: string; quantity: number; orderCount: number };

export default async function InventoryPage() {
  const { supabase, membership } = await requireOrganization();
  if (membership.role === "production") redirect("/panel");
  const orgId = membership.organization_id;
  const [{ data: activeOrders }, { data: stockItems }, { data: suppliers }] = await Promise.all([
    supabase.from("orders").select("id").eq("organization_id", orgId).in("status", ["approved", "in_production", "ready"]),
    supabase.from("inventory_items").select("*").eq("organization_id", orgId).order("name"),
    supabase.from("suppliers").select("id, name").eq("organization_id", orgId).eq("status", "active").order("name"),
  ]);
  const activeOrderIds = (activeOrders ?? []).map((order) => order.id);
  const { data: orderItems } = activeOrderIds.length
    ? await supabase.from("order_items").select("order_id, quantity, width_mm, height_mm, light_color, profile_type, motor_type").eq("organization_id", orgId).in("order_id", activeOrderIds)
    : { data: [] };
  const supplierNames = new Map((suppliers ?? []).map((supplier) => [supplier.id, supplier.name]));
  const profiles = aggregate(orderItems ?? [], "profile_type");
  const motors = aggregate(orderItems ?? [], "motor_type");
  const lights = aggregate(orderItems ?? [], "light_color");
  const totalWidthMeters = (orderItems ?? []).reduce((total, item) => total + (Number(item.width_mm || 0) * Number(item.quantity || 0)) / 1000, 0);
  const totalArea = (orderItems ?? []).reduce((total, item) => total + (Number(item.width_mm || 0) * Number(item.height_mm || 0) * Number(item.quantity || 0)) / 1_000_000, 0);
  const lowStock = (stockItems ?? []).filter((item) => Number(item.on_hand) <= Number(item.reorder_level));

  return (
    <>
      <PageHeader eyebrow="Stok ve üretim ihtiyacı" title="Envanter Yönetimi" description="Kalıcı stok kartlarını ve onaylanmış siparişlerden otomatik türetilen malzeme ihtiyacını birlikte yönetin." />
      <section className="metrics-grid">
        <Metric icon={PackageSearch} label="Stok kartı" value={(stockItems ?? []).length.toString()} detail={`${lowStock.length} kritik seviyede`} />
        <Metric icon={Ruler} label="Sipariş genişliği" value={`${totalWidthMeters.toFixed(1)} m`} detail={`${activeOrderIds.length} aktif siparişten`} tone="blue" />
        <Metric icon={Settings2} label="Motor ihtiyacı" value={motors.reduce((sum, item) => sum + item.quantity, 0).toString()} detail={`${motors.length} motor tipi`} tone="violet" />
        <Metric icon={Lightbulb} label="Kaplanan alan" value={`${totalArea.toFixed(1)} m²`} detail="Onaylı ölçüler" tone="amber" />
      </section>

      <div className="business-layout inventory-business-layout">
        <section className="content-card"><div className="card-heading"><div><span>Kalıcı envanter</span><h2>Stok kartları</h2></div><PackageSearch size={20} /></div><div className="stock-list">{(stockItems ?? []).map((item) => { const low = Number(item.on_hand) <= Number(item.reorder_level); return <article key={item.id}><span className={low ? "low-stock" : ""}>{low ? <AlertTriangle size={16} /> : <PackageSearch size={16} />}</span><div><b>{item.name}</b><small>{item.sku} · {item.category || "Kategorisiz"}</small><em>{item.supplier_id ? supplierNames.get(item.supplier_id) || "Tedarikçi" : "Tedarikçi atanmamış"}</em></div><dl><div><dt>Mevcut</dt><dd>{Number(item.on_hand).toLocaleString("tr-TR")} {item.unit}</dd></div><div><dt>Kritik seviye</dt><dd>{Number(item.reorder_level).toLocaleString("tr-TR")} {item.unit}</dd></div><div><dt>Birim maliyet</dt><dd>{item.unit_cost === null ? "—" : new Intl.NumberFormat("tr-TR", { style: "currency", currency: item.currency }).format(Number(item.unit_cost))}</dd></div></dl></article>; })}{!stockItems?.length && <div className="compact-empty">Henüz stok kartı yok.</div>}</div></section>
        <section className="form-card business-form-card"><div className="card-heading"><div><span>Yeni envanter kaydı</span><h2>Stok kartı oluştur</h2></div></div><ActionForm action={createInventoryItem} className="record-form" submitLabel="Stok kartını kaydet" pendingLabel="Kaydediliyor…"><input type="hidden" name="organizationId" value={orgId} /><div className="form-grid"><label>Stok kodu<input name="sku" required /></label><label>Malzeme adı<input name="name" required /></label></div><div className="form-grid"><label>Kategori<input name="category" placeholder="Profil, motor, LED…" /></label><label>Birim<select name="unit" defaultValue="adet"><option value="adet">Adet</option><option value="metre">Metre</option><option value="m2">m²</option><option value="kg">Kilogram</option><option value="kutu">Kutu</option></select></label></div><div className="form-grid"><label>Mevcut miktar<input name="onHand" type="number" min="0" step="0.001" defaultValue="0" required /></label><label>Kritik seviye<input name="reorderLevel" type="number" min="0" step="0.001" defaultValue="0" required /></label></div><div className="form-grid"><label>Birim maliyet<input name="unitCost" type="number" min="0" step="0.01" /></label><label>Para birimi<select name="currency" defaultValue="TRY"><option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label></div><label>Tedarikçi<select name="supplierId" defaultValue=""><option value="">Tedarikçi seçilmedi</option>{(suppliers ?? []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label>Notlar<textarea name="notes" rows={3} /></label></ActionForm></section>
      </div>

      <div className="inventory-grid inventory-requirements">
        <RequirementCard title="Profil ihtiyaçları" subtitle="Siparişten · adet" items={profiles} />
        <RequirementCard title="Motor ihtiyaçları" subtitle="Siparişten · adet" items={motors} />
        <RequirementCard title="Işık renkleri" subtitle="Siparişten · adet" items={lights} />
      </div>
      {!orderItems?.length && <div className="module-note"><PackageSearch size={20} /><div><b>Hesaplanacak onaylı ürün yok</b><p>PDF analizi doğrulanıp sipariş onaylandığında malzeme ihtiyaçları burada otomatik toplanır.</p></div><Link href="/panel/siparisler">Siparişlere git</Link></div>}
    </>
  );
}

function aggregate<T extends Record<string, unknown>>(items: T[], key: keyof T): Requirement[] { const result = new Map<string, { quantity: number; orders: Set<string> }>(); for (const item of items) { const name = String(item[key] || "Belirtilmemiş"); const current = result.get(name) ?? { quantity: 0, orders: new Set<string>() }; current.quantity += Number(item.quantity || 0); current.orders.add(String(item.order_id)); result.set(name, current); } return [...result.entries()].map(([name, value]) => ({ name, quantity: value.quantity, orderCount: value.orders.size })).sort((a, b) => b.quantity - a.quantity); }
function RequirementCard({ title, subtitle, items }: { title: string; subtitle: string; items: Requirement[] }) { const max = Math.max(...items.map((item) => item.quantity), 1); return <section className="content-card requirement-card"><div className="card-heading"><div><span>{subtitle}</span><h2>{title}</h2></div></div><div>{items.map((item) => <article key={item.name}><div><b>{item.name}</b><small>{item.orderCount} sipariş</small></div><span>{item.quantity} adet</span><i><em style={{ width: `${Math.max(4, (item.quantity / max) * 100)}%` }} /></i></article>)}{!items.length && <div className="compact-empty">Henüz veri yok.</div>}</div></section>; }
function Metric({ icon: Icon, label, value, detail, tone = "green" }: { icon: typeof PackageSearch; label: string; value: string; detail: string; tone?: string }) { return <article className="metric-card"><div className={`metric-icon tone-${tone}`}><Icon size={20} /></div><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
