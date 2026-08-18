import { BarChart3, CheckCircle2, Clock3, FileWarning, PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { OrderStatus } from "@/lib/types";

const statuses: Array<{ value: OrderStatus; label: string }> = [
  { value: "draft", label: "Taslak" }, { value: "awaiting_review", label: "İnceleme" }, { value: "approved", label: "Onaylı" },
  { value: "in_production", label: "Üretimde" }, { value: "ready", label: "Hazır" }, { value: "delivered", label: "Teslim" }, { value: "cancelled", label: "İptal" },
];

export default async function ReportsPage() {
  const { supabase, membership } = await requireOrganization();
  if (membership.role === "production") redirect("/panel");
  const orgId = membership.organization_id;
  const [{ data: orders }, { data: analyses }, { data: items }, { data: events }] = await Promise.all([
    supabase.from("orders").select("status, created_at, approved_at, updated_at").eq("organization_id", orgId),
    supabase.from("document_analyses").select("status, cost_usd, created_at, completed_at").eq("organization_id", orgId),
    supabase.from("order_items").select("quantity").eq("organization_id", orgId),
    supabase.from("order_stage_events").select("event_type, created_at").eq("organization_id", orgId),
  ]);
  const total = orders?.length ?? 0;
  const delivered = orders?.filter((order) => order.status === "delivered").length ?? 0;
  const successfulAnalyses = analyses?.filter((analysis) => ["needs_review", "completed"].includes(analysis.status)).length ?? 0;
  const failedAnalyses = analyses?.filter((analysis) => analysis.status === "failed").length ?? 0;
  const totalCost = analyses?.reduce((sum, analysis) => sum + Number(analysis.cost_usd || 0), 0) ?? 0;
  const maxStatus = Math.max(...statuses.map((status) => orders?.filter((order) => order.status === status.value).length ?? 0), 1);

  return (
    <>
      <PageHeader eyebrow="Gerçek zamanlı operasyon özeti" title="Operasyon Raporları" description="Sipariş, PDF analizi ve üretim olaylarından hesaplanan şirket raporu." />
      <section className="report-summary-grid">
        <Summary icon={PackageCheck} label="Teslim oranı" value={total ? `%${Math.round((delivered / total) * 100)}` : "%0"} detail={`${delivered}/${total} sipariş`} />
        <Summary icon={CheckCircle2} label="AI sonuç oranı" value={analyses?.length ? `%${Math.round((successfulAnalyses / analyses.length) * 100)}` : "%0"} detail={`${failedAnalyses} başarısız analiz`} tone="blue" />
        <Summary icon={Clock3} label="Üretim olayı" value={(events?.length ?? 0).toString()} detail="Başlatma ve tamamlama" tone="violet" />
        <Summary icon={FileWarning} label="AI maliyeti" value={`$${totalCost.toFixed(4)}`} detail="Kaydedilen toplam" tone="amber" />
      </section>
      <section className="reports-layout">
        <article className="content-card report-bars"><div className="card-heading"><div><span>Durum kırılımı</span><h2>Sipariş yaşam döngüsü</h2></div><BarChart3 size={19} /></div><div>{statuses.map((status) => { const count = orders?.filter((order) => order.status === status.value).length ?? 0; return <div key={status.value}><span>{status.label}</span><i><em className={`flow-${status.value}`} style={{ width: `${Math.max(count ? 5 : 0, (count / maxStatus) * 100)}%` }} /></i><b>{count}</b></div>; })}</div></article>
        <article className="content-card report-facts"><div className="card-heading"><div><span>Ürün hacmi</span><h2>Doğrulanmış sipariş verisi</h2></div></div><dl><div><dt>Toplam ürün adedi</dt><dd>{items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) ?? 0}</dd></div><div><dt>PDF analiz sayısı</dt><dd>{analyses?.length ?? 0}</dd></div><div><dt>İnsan kontrolü bekleyen</dt><dd>{analyses?.filter((analysis) => analysis.status === "needs_review").length ?? 0}</dd></div><div><dt>Aktif üretim</dt><dd>{orders?.filter((order) => order.status === "in_production").length ?? 0}</dd></div></dl></article>
      </section>
    </>
  );
}

function Summary({ icon: Icon, label, value, detail, tone = "green" }: { icon: typeof PackageCheck; label: string; value: string; detail: string; tone?: string }) {
  return <article className="report-summary"><span className={`tone-${tone}`}><Icon size={20} /></span><div><small>{label}</small><b>{value}</b><p>{detail}</p></div></article>;
}
