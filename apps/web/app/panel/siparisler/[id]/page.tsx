import { notFound } from "next/navigation";
import { Calculator, CircleCheck, ExternalLink, FileText, PackageCheck, TriangleAlert } from "lucide-react";
import { uploadDocumentAction } from "@/app/actions/documents";
import { AnalysisReview } from "@/components/analysis-review";
import { ActionForm } from "@/components/action-form";
import { AnalysisStatusCard, AnalyzeDocumentAction } from "@/components/analysis-status-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { CalculationAction } from "@/components/stage-action";
import { CancelOrderAction } from "@/components/cancel-order-action";
import { updateOrderForm } from "@/app/actions/core";
import { requireOrganization } from "@/lib/auth";
import type { ExtractedOrderFields } from "@/lib/types";
import { ManualOrderItemsEditor, ReadonlyOrderItems, type ManualOrderItemValue } from "@/components/manual-order-items-editor";

type OrderItemRow = {
  id: string;
  line_number: number;
  quantity: number;
  width_mm: number | string | null;
  height_mm: number | string | null;
  light_color: string | null;
  profile_type: string | null;
  motor_type: string | null;
  notes: string | null;
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; upload?: string }>;
}) {
  const { id } = await params;
  const creationState = await searchParams;
  const { supabase, membership } = await requireOrganization();
  const orgId = membership.organization_id;
  const canManageOrder = membership.role !== "production";

  const [orderResult, documentsResult, analysesResult, eventsResult, calculationsResult, activeRuleResult] = await Promise.all([
    supabase.from("orders").select("*, order_items!order_items_order_id_fkey(*)").eq("id", id).eq("organization_id", orgId).maybeSingle(),
    supabase.from("documents").select("*").eq("organization_id", orgId).eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("document_analyses").select("*").eq("organization_id", orgId).eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("order_stage_events").select("*, production_stages!order_stage_events_stage_id_fkey(name, color), profiles(full_name)").eq("organization_id", orgId).eq("order_id", id).order("created_at"),
    supabase.from("calculation_runs").select("*, calculation_rule_sets!calculation_runs_rule_set_id_fkey(name)").eq("organization_id", orgId).eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("calculation_rule_sets").select("id").eq("organization_id", orgId).eq("status", "active").limit(1).maybeSingle(),
  ]);
  const firstError = [orderResult, documentsResult, analysesResult, eventsResult, calculationsResult, activeRuleResult]
    .find((result) => result.error)?.error;
  if (firstError) throw new Error("Sipariş ayrıntıları yüklenemedi.", { cause: firstError });
  const { data: order } = orderResult;
  const { data: documents } = documentsResult;
  const { data: analyses } = analysesResult;
  const { data: events } = eventsResult;
  const { data: calculations } = calculationsResult;
  const { data: activeRule } = activeRuleResult;
  if (!order) notFound();

  const signedDocuments = await Promise.all((documents ?? []).map(async (document) => {
    const { data } = await supabase.storage.from("order-documents").createSignedUrl(document.storage_path, 300);
    return { ...document, signedUrl: data?.signedUrl };
  }));
  const latestDocument = signedDocuments[0];
  const latestAnalysis = analyses?.find((analysis) => analysis.document_id === latestDocument?.id);
  const activeAnalysis = canManageOrder && latestAnalysis?.status === "needs_review" ? latestAnalysis : undefined;
  const runningAnalysis = analyses?.find((analysis) => analysis.status === "queued" || analysis.status === "running");
  const canUploadDocument = canManageOrder && ["draft", "awaiting_review", "approved"].includes(order.status);
  const canEditOrder = canManageOrder && ["draft", "awaiting_review", "approved"].includes(order.status);
  const orderItems: ManualOrderItemValue[] = (order.order_items as OrderItemRow[] | undefined ?? [])
    .toSorted((left, right) => left.line_number - right.line_number)
    .map((item) => ({
      id: item.id,
      quantity: Number(item.quantity),
      widthMm: item.width_mm === null ? null : Number(item.width_mm),
      heightMm: item.height_mm === null ? null : Number(item.height_mm),
      lightColor: item.light_color ?? "",
      profileType: item.profile_type ?? "",
      motorType: item.motor_type ?? "",
      notes: item.notes ?? "",
    }));

  return (
    <>
      <PageHeader eyebrow="Sipariş detayı" title={order.order_number} description={[order.customer_name, order.project_name].filter(Boolean).join(" · ") || "PDF analiziyle bilgiler doldurulacak."} action={<StatusBadge value={order.status} />} />
      {creationState.created === "1" ? <CreationNotice upload={creationState.upload} /> : null}
      <div className="order-detail-grid">
        <section className="document-card">
          <div className="card-heading"><div><span>Kaynak belge</span><h2>PDF görüntüleyici</h2></div>{latestAnalysis && <StatusBadge value={latestAnalysis.status} kind="analysis" />}</div>
          {signedDocuments[0]?.signedUrl ? (
            <iframe title={signedDocuments[0].original_name} src={signedDocuments[0].signedUrl} className="pdf-frame" />
          ) : (
            <div className="pdf-empty"><FileText size={34} /><b>PDF yüklenmedi</b><p>En fazla 25 MB ve 50 sayfa.</p></div>
          )}
          {latestAnalysis ? <AnalysisStatusCard analysisId={latestAnalysis.id} status={latestAnalysis.status} errorMessage={latestAnalysis.error_message} /> : null}
          {canManageOrder && latestDocument && !latestAnalysis ? <AnalyzeDocumentAction documentId={latestDocument.id} /> : null}
          {canUploadDocument ? (
            <ActionForm
              action={uploadDocumentAction}
              className="upload-form"
              submitLabel={signedDocuments.length ? "Yeni PDF yükle" : "PDF yükle ve analiz et"}
              pendingLabel="PDF yükleniyor…"
            >
              <input type="hidden" name="organizationId" value={orgId} />
              <input type="hidden" name="orderId" value={order.id} />
              <label className="file-input-label">PDF dosyası<input type="file" name="file" accept="application/pdf" required /></label>
            </ActionForm>
          ) : canManageOrder ? <div className="upload-form upload-locked">Üretime alınmış veya kapanmış siparişlerde PDF değiştirilemez.</div> : null}
          {signedDocuments.length ? <div className="document-history"><header><span>Belge geçmişi</span><b>{signedDocuments.length} sürüm</b></header>{signedDocuments.map((document, index) => <article key={document.id}><FileText size={15} /><div><b>{document.original_name}</b><small>{document.page_count} sayfa · {(Number(document.size_bytes) / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB · {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(document.created_at))}</small></div>{index === 0 ? <em>Güncel</em> : null}{document.signedUrl ? <a href={document.signedUrl} target="_blank" rel="noreferrer" aria-label={`${document.original_name} belgesini aç`}><ExternalLink size={14} /></a> : null}</article>)}</div> : null}
        </section>
        <aside className="order-summary-card">
          <span>Sipariş özeti</span>
          <h2>{order.customer_name || "Müşteri bekleniyor"}</h2>
          <dl>
            <div><dt>Proje</dt><dd>{order.project_name || "—"}</dd></div>
            <div><dt>Referans</dt><dd>{order.customer_reference || "—"}</dd></div>
            <div><dt>Planlanan teslim</dt><dd>{order.planned_delivery_date ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${order.planned_delivery_date}T00:00:00Z`)) : "—"}</dd></div>
            <div><dt>Ürün satırı</dt><dd>{order.order_items?.length ?? 0}</dd></div>
            <div><dt>PDF</dt><dd>{signedDocuments.length}</dd></div>
            {order.delivered_at ? <div><dt>Teslim edildi</dt><dd>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.delivered_at))}</dd></div> : null}
          </dl>
          <p>{order.notes || "Sipariş notu yok."}</p>
          {order.delivery_note ? <p className="delivery-note"><b>Teslim notu</b>{order.delivery_note}</p> : null}
          {canEditOrder ? <details className="order-edit-details">
            <summary>Temel bilgileri düzenle</summary>
            <ActionForm action={updateOrderForm} className="record-form" submitLabel="Bilgileri kaydet" pendingLabel="Kaydediliyor…">
              <input type="hidden" name="organizationId" value={orgId} />
              <input type="hidden" name="orderId" value={order.id} />
              <label>Müşteri<input name="customerName" defaultValue={order.customer_name ?? ""} maxLength={160} /></label>
              <label>Proje<input name="projectName" defaultValue={order.project_name ?? ""} maxLength={160} /></label>
              <label>Referans<input name="customerReference" defaultValue={order.customer_reference ?? ""} maxLength={120} /></label>
              <label>Planlanan teslim<input type="date" name="plannedDeliveryDate" defaultValue={order.planned_delivery_date ?? ""} /></label>
              <label>Notlar<textarea name="notes" defaultValue={order.notes ?? ""} rows={4} maxLength={5000} /></label>
            </ActionForm>
            <CancelOrderAction organizationId={orgId} orderId={order.id} />
          </details> : null}
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

      {canEditOrder && !activeAnalysis ? (
        <ManualOrderItemsEditor
          organizationId={orgId}
          orderId={order.id}
          orderStatus={order.status as "draft" | "awaiting_review" | "approved"}
          initialItems={orderItems}
          approvalBlockedReason={runningAnalysis ? "PDF analizi şu anda çalışıyor. Manuel taslağı kaydedebilirsiniz; üretim onayı analiz tamamlandıktan sonra açılır." : undefined}
        />
      ) : !activeAnalysis ? <ReadonlyOrderItems items={orderItems} /> : null}

      <div className="lower-detail-grid">
        <section className="content-card">
          <div className="card-heading"><div><span>Deterministik motor</span><h2>Hesap sonuçları</h2></div>{canManageOrder && activeRule && ["approved", "in_production", "ready"].includes(order.status) ? <CalculationAction organizationId={orgId} orderId={order.id} /> : <Calculator size={20} />}</div>
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

function CreationNotice({ upload }: { upload?: string }) {
  if (upload === "queued") return <div className="operation-banner operation-success"><CircleCheck size={19} /><div><b>Sipariş ve PDF kaydedildi</b><p>PDF analizi otomatik olarak sıraya alındı. Sonuç hazır olduğunda bu ekran yenilenecek.</p></div></div>;
  if (upload === "attention") return <div className="operation-banner operation-warning"><TriangleAlert size={19} /><div><b>Sipariş ve PDF kaydedildi</b><p>PDF korundu ancak analiz şu anda başlayamadı. Belge bölümündeki “Analizi başlat” işlemini kullanabilirsiniz.</p></div></div>;
  if (upload === "failed") return <div className="operation-banner operation-danger"><TriangleAlert size={19} /><div><b>Sipariş oluşturuldu, PDF yüklenemedi</b><p>Dosyayı kontrol edip bu sayfadaki PDF yükleme alanından yeniden deneyin.</p></div></div>;
  return <div className="operation-banner operation-success"><CircleCheck size={19} /><div><b>Sipariş taslağı oluşturuldu</b><p>Kaynak PDF’yi ekleyerek otomatik analiz akışını başlatabilirsiniz.</p></div></div>;
}
