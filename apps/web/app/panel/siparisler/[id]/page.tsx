import { notFound } from "next/navigation";
import { Calculator, FileText, PackageCheck } from "lucide-react";
import { uploadDocumentAction } from "@/app/actions/documents";
import { AnalysisReview } from "@/components/analysis-review";
import { AnalysisStatusCard } from "@/components/analysis-status-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { CalculationAction } from "@/components/stage-action";
import { requireOrganization } from "@/lib/auth";
import type { ExtractedOrderFields } from "@/lib/types";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, membership } = await requireOrganization();
  const orgId = membership.organization_id;

  const [{ data: order }, { data: documents }, { data: analyses }, { data: events }, { data: calculations }, { data: activeRule }] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").eq("id", id).eq("organization_id", orgId).maybeSingle(),
    supabase.from("documents").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("document_analyses").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("order_stage_events").select("*, production_stages(name, color), profiles(full_name)").eq("order_id", id).order("created_at"),
    supabase.from("calculation_runs").select("*, calculation_rule_sets(name)").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("calculation_rule_sets").select("id").eq("organization_id", orgId).eq("status", "active").limit(1).maybeSingle(),
  ]);
  if (!order) notFound();

  const signedDocuments = await Promise.all((documents ?? []).map(async (document) => {
    const { data } = await supabase.storage.from("order-documents").createSignedUrl(document.storage_path, 300);
    return { ...document, signedUrl: data?.signedUrl };
  }));
  const latestAnalysis = analyses?.[0];
  const activeAnalysis = latestAnalysis?.status === "needs_review" ? latestAnalysis : undefined;
  const canUploadDocument = ["draft", "awaiting_review", "approved"].includes(order.status);

  return (
    <>
      <PageHeader eyebrow="Sipariş detayı" title={order.order_number} description={[order.customer_name, order.project_name].filter(Boolean).join(" · ") || "PDF analiziyle bilgiler doldurulacak."} action={<StatusBadge value={order.status} />} />
      <div className="order-detail-grid">
        <section className="document-card">
          <div className="card-heading"><div><span>Kaynak belge</span><h2>PDF görüntüleyici</h2></div>{latestAnalysis && <StatusBadge value={latestAnalysis.status} kind="analysis" />}</div>
          {signedDocuments[0]?.signedUrl ? (
            <iframe title={signedDocuments[0].original_name} src={signedDocuments[0].signedUrl} className="pdf-frame" />
          ) : (
            <div className="pdf-empty"><FileText size={34} /><b>PDF yüklenmedi</b><p>En fazla 25 MB ve 50 sayfa.</p></div>
          )}
          {latestAnalysis ? <AnalysisStatusCard analysisId={latestAnalysis.id} status={latestAnalysis.status} errorMessage={latestAnalysis.error_message} /> : null}
          {canUploadDocument ? (
            <form action={uploadDocumentAction} className="upload-form">
              <input type="hidden" name="organizationId" value={orgId} />
              <input type="hidden" name="orderId" value={order.id} />
              <input type="file" name="file" accept="application/pdf" required />
              <button className="button button-primary">{signedDocuments.length ? "Yeni PDF yükle" : "PDF yükle ve analiz et"}</button>
            </form>
          ) : <div className="upload-form upload-locked">Üretime alınmış veya kapanmış siparişlerde PDF değiştirilemez.</div>}
        </section>
        <aside className="order-summary-card">
          <span>Sipariş özeti</span>
          <h2>{order.customer_name || "Müşteri bekleniyor"}</h2>
          <dl>
            <div><dt>Proje</dt><dd>{order.project_name || "—"}</dd></div>
            <div><dt>Referans</dt><dd>{order.customer_reference || "—"}</dd></div>
            <div><dt>Ürün satırı</dt><dd>{order.order_items?.length ?? 0}</dd></div>
            <div><dt>PDF</dt><dd>{signedDocuments.length}</dd></div>
          </dl>
          <p>{order.notes || "Sipariş notu yok."}</p>
        </aside>
      </div>

      {activeAnalysis?.normalized_output && (
        <AnalysisReview
          analysisId={activeAnalysis.id}
          orderId={order.id}
          organizationId={orgId}
          initial={activeAnalysis.normalized_output as ExtractedOrderFields}
        />
      )}

      <div className="lower-detail-grid">
        <section className="content-card">
          <div className="card-heading"><div><span>Deterministik motor</span><h2>Hesap sonuçları</h2></div>{activeRule && ["approved", "in_production", "ready"].includes(order.status) ? <CalculationAction organizationId={orgId} orderId={order.id} /> : <Calculator size={20} />}</div>
          {calculations?.length ? calculations.map((run) => <pre className="result-json" key={run.id}>{JSON.stringify(run.result_snapshot, null, 2)}</pre>) : <div className="compact-empty"><Calculator size={24} /><p>Onaylanmış veri ve etkin kural seti olduğunda hesap sonucu burada görünür.</p></div>}
        </section>
        <section className="content-card">
          <div className="card-heading"><div><span>Üretim geçmişi</span><h2>Zaman çizelgesi</h2></div><PackageCheck size={20} /></div>
          <div className="timeline">
            {(events ?? []).map((event) => {
              const stage = Array.isArray(event.production_stages) ? event.production_stages[0] : event.production_stages;
              return <div key={event.id}><i style={{ background: stage?.color }} /><span><b>{stage?.name}</b><small>{event.event_type} · {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</small></span></div>;
            })}
            {!events?.length && <div className="compact-empty"><p>Üretim henüz başlamadı.</p></div>}
          </div>
        </section>
      </div>
    </>
  );
}
