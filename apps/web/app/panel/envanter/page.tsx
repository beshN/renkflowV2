import Link from "next/link";
import { Lightbulb, PackageSearch, Ruler, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/lib/auth";
import { redirect } from "next/navigation";

type Requirement = { name: string; quantity: number; orderCount: number };

export default async function InventoryPage() {
  const { supabase, membership } = await requireOrganization();
  if (membership.role === "production") redirect("/panel");
  const orgId = membership.organization_id;
  const { data: activeOrders } = await supabase.from("orders").select("id").eq("organization_id", orgId).in("status", ["approved", "in_production", "ready"]);
  const activeOrderIds = (activeOrders ?? []).map((order) => order.id);
  const { data: items } = activeOrderIds.length
    ? await supabase.from("order_items").select("order_id, quantity, width_mm, height_mm, light_color, profile_type, motor_type").eq("organization_id", orgId).in("order_id", activeOrderIds)
    : { data: [] };

  const profiles = aggregate(items ?? [], "profile_type");
  const motors = aggregate(items ?? [], "motor_type");
  const lights = aggregate(items ?? [], "light_color");
  const totalWidthMeters = (items ?? []).reduce((total, item) => total + (Number(item.width_mm || 0) * Number(item.quantity || 0)) / 1000, 0);
  const totalArea = (items ?? []).reduce((total, item) => total + (Number(item.width_mm || 0) * Number(item.height_mm || 0) * Number(item.quantity || 0)) / 1_000_000, 0);

  return (
    <>
      <PageHeader eyebrow="Üretimden türetilen ihtiyaç" title="Envanter İhtiyaçları" description="Eski stok görünümü, onaylanmış sipariş satırlarından gerçek malzeme ihtiyacını çıkaran yeni bir operasyon ekranına dönüştürüldü." />
      <section className="metrics-grid">
        <Metric icon={PackageSearch} label="Aktif ürün satırı" value={(items ?? []).length.toString()} detail={`${activeOrderIds.length} siparişten`} />
        <Metric icon={Ruler} label="Toplam genişlik" value={`${totalWidthMeters.toFixed(1)} m`} detail="Kesim planı girdisi" tone="blue" />
        <Metric icon={Settings2} label="Motor adedi" value={motors.reduce((sum, item) => sum + item.quantity, 0).toString()} detail={`${motors.length} motor tipi`} tone="violet" />
        <Metric icon={Lightbulb} label="Kaplanan alan" value={`${totalArea.toFixed(1)} m²`} detail="Onaylı ölçüler" tone="amber" />
      </section>
      <div className="inventory-grid">
        <RequirementCard title="Profil ihtiyaçları" subtitle="Profil tipi · adet" items={profiles} />
        <RequirementCard title="Motor ihtiyaçları" subtitle="Motor tipi · adet" items={motors} />
        <RequirementCard title="Işık renkleri" subtitle="LED/ışık seçimi · adet" items={lights} />
      </div>
      {!items?.length && <div className="module-note"><PackageSearch size={20} /><div><b>Hesaplanacak onaylı ürün yok</b><p>PDF analizi doğrulanıp sipariş onaylandığında profil, motor, renk ve ölçü ihtiyaçları burada otomatik toplanır.</p></div><Link href="/panel/siparisler">Siparişlere git</Link></div>}
    </>
  );
}

function aggregate<T extends Record<string, unknown>>(items: T[], key: keyof T): Requirement[] {
  const result = new Map<string, { quantity: number; orders: Set<string> }>();
  for (const item of items) {
    const name = String(item[key] || "Belirtilmemiş");
    const current = result.get(name) ?? { quantity: 0, orders: new Set<string>() };
    current.quantity += Number(item.quantity || 0);
    current.orders.add(String(item.order_id));
    result.set(name, current);
  }
  return [...result.entries()].map(([name, value]) => ({ name, quantity: value.quantity, orderCount: value.orders.size })).sort((a, b) => b.quantity - a.quantity);
}

function RequirementCard({ title, subtitle, items }: { title: string; subtitle: string; items: Requirement[] }) {
  const max = Math.max(...items.map((item) => item.quantity), 1);
  return <section className="content-card requirement-card"><div className="card-heading"><div><span>{subtitle}</span><h2>{title}</h2></div></div><div>{items.map((item) => <article key={item.name}><div><b>{item.name}</b><small>{item.orderCount} sipariş</small></div><span>{item.quantity} adet</span><i><em style={{ width: `${Math.max(4, (item.quantity / max) * 100)}%` }} /></i></article>)}{!items.length && <div className="compact-empty">Henüz veri yok.</div>}</div></section>;
}

function Metric({ icon: Icon, label, value, detail, tone = "green" }: { icon: typeof PackageSearch; label: string; value: string; detail: string; tone?: string }) {
  return <article className="metric-card"><div className={`metric-icon tone-${tone}`}><Icon size={20} /></div><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}
