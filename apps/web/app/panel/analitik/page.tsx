import { Activity, BrainCircuit, Factory, Gauge } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AnalyticsPage() {
  const { supabase, membership } = await requireOrganization();
  if (membership.role === "production") redirect("/panel");
  const orgId = membership.organization_id;
  const [{ data: analyses }, { data: stages }, { data: events }, { data: corrections }] = await Promise.all([
    supabase.from("document_analyses").select("id, status, escalated, input_tokens, output_tokens, cost_usd, created_at").eq("organization_id", orgId),
    supabase.from("production_stages").select("id, name, color, position").eq("organization_id", orgId).order("position"),
    supabase.from("order_stage_events").select("stage_id, event_type").eq("organization_id", orgId),
    supabase.from("analysis_corrections").select("id, analysis_id, field_path").eq("organization_id", orgId),
  ]);
  const completedByStage = new Map<string, number>();
  for (const event of events ?? []) if (event.event_type === "completed") completedByStage.set(event.stage_id, (completedByStage.get(event.stage_id) ?? 0) + 1);
  const maxStage = Math.max(...(stages ?? []).map((stage) => completedByStage.get(stage.id) ?? 0), 1);
  const totalTokens = analyses?.reduce((sum, analysis) => sum + Number(analysis.input_tokens || 0) + Number(analysis.output_tokens || 0), 0) ?? 0;
  const escalationRate = analyses?.length ? Math.round(((analyses.filter((analysis) => analysis.escalated).length) / analyses.length) * 100) : 0;
  const correctionRate = analyses?.length ? Math.round(((new Set((corrections ?? []).map((correction) => correction.analysis_id)).size) / analyses.length) * 100) : 0;

  return (
    <>
      <PageHeader eyebrow="Karar destek görünümü" title="Karar Analitiği" description="AI çıkarımı, insan düzeltmeleri ve üretim aşaması performansını aynı ekranda karşılaştırın." />
      <section className="analytics-kpis">
        <Kpi icon={BrainCircuit} label="Toplam AI çalışması" value={(analyses?.length ?? 0).toString()} detail={`${totalTokens.toLocaleString("tr-TR")} token`} />
        <Kpi icon={Gauge} label="Model yükseltme oranı" value={`%${escalationRate}`} detail="İkinci model kullanımı" tone="violet" />
        <Kpi icon={Activity} label="İnsan düzeltme oranı" value={`%${correctionRate}`} detail={`${corrections?.length ?? 0} alan düzeltildi`} tone="amber" />
        <Kpi icon={Factory} label="Tamamlanan aşama" value={(events?.filter((event) => event.event_type === "completed").length ?? 0).toString()} detail="Üretim hareketi" tone="blue" />
      </section>
      <section className="content-card stage-analytics"><div className="card-heading"><div><span>Üretim yoğunluğu</span><h2>Aşama tamamlama analizi</h2></div></div><div>{(stages ?? []).map((stage) => { const count = completedByStage.get(stage.id) ?? 0; return <article key={stage.id}><span style={{ background: stage.color }}><Factory size={15} /></span><div><b>{stage.name}</b><i><em style={{ background: stage.color, width: `${Math.max(count ? 5 : 0, (count / maxStage) * 100)}%` }} /></i></div><strong>{count}</strong></article>; })}{!stages?.length && <div className="compact-empty">Üretim aşaması bulunamadı.</div>}</div></section>
    </>
  );
}

function Kpi({ icon: Icon, label, value, detail, tone = "green" }: { icon: typeof Activity; label: string; value: string; detail: string; tone?: string }) {
  return <article><span className={`tone-${tone}`}><Icon size={19} /></span><div><small>{label}</small><b>{value}</b><p>{detail}</p></div></article>;
}
