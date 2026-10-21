"use client";
import Link from "next/link";
import { useCommandRetry } from "@/lib/hooks/useCommandRetry";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  MAIN_PROCESS,
  FAMILY_LABELS,
  technicalIssues,
} from "@/lib/features/orders/technical";
import type { TechnicalFamily } from "@/lib/features/orders/technical";
import type { technicalWorkspace } from "@/lib/features/orders/technical.server";
import { requestJson } from "@/lib/shared/network";
import { MeasuredFoyView, MeasuredVerticalView } from "../foy/MeasuredFoyView";
import { QualityChecklist } from "../manufacturing/QualityChecklist";
import { OrderLoadingPanel } from "./OrderLoadingPanel";
import { WorkshopPanel } from "../manufacturing/WorkshopPanel";
import { FoyWorkbench } from "../foy/FoyWorkbench";
import { AwningConfigurator } from "../awning/AwningConfigurator";
import { ProductConfigurator as ProductModel } from "../product-3d/ProductConfigurator";
import { ProductDrawing } from "@/components/drawing/ProductDrawing";
import { FoySchema } from "../foy/FoySchema";
type Workspace = Awaited<ReturnType<typeof technicalWorkspace>>;

export function OrderTechnicalPanel({
  orderId,
  worker = false,
}: {
  orderId: string;
  worker?: boolean;
}) {
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [upload, setUpload] = useState(false),
    [acknowledged, setAcknowledged] = useState(false);
  const load = useCallback(async () => {
    const r = await requestJson<Workspace>(
      `/api/v1/orders/${orderId}/technical`,
      { cache: "no-store" },
    );
    if (r.ok && r.data) {
      setData(r.data);
      setError("");
    } else setError(r.error || "Teknik dosya alınamadı");
  }, [orderId]);
  useEffect(() => {
    void load();
  }, [load]);
  const send = (body: Record<string, unknown>) =>
    requestJson<{ waitingForStock?: boolean }>(
      `/api/v1/orders/${orderId}/technical`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  const approve = async (revisionId: string, action = "approve") => {
    setBusy(true);
    const r = await send({
      action,
      revisionId,
      commandId: action === "refresh" ? crypto.randomUUID() : undefined,
      acknowledgeWarnings: action === "approve" ? acknowledged : undefined,
    });
    // Stock moved since the sheet was read: recalculate at once rather than asking for a second click.
    if (!r.ok && action === "approve" && /Stok veya kesim hesabı değişti/.test(r.error || "")) {
      const refreshed = await send({
        action: "refresh",
        revisionId,
        commandId: crypto.randomUUID(),
      });
      setBusy(false);
      if (refreshed.ok)
        toast.info(
          "Stok bu arada değişmiş; plan güncel stokla yeniden hesaplandı. Kontrol edip yeniden onaylayın.",
        );
      else toast.error(refreshed.error || "Plan yenilenemedi");
      void load();
      return;
    }
    setBusy(false);
    if (r.ok) {
      toast.success(
        action === "reject"
          ? "Revizyon reddedildi; önceki sürüm kullanılabilir"
          : action === "refresh"
            ? "Taslak güncel stokla yeniden hesaplandı"
            : r.data?.waitingForStock
              ? "Üretime açıldı. Stok eksik olduğu için kesim, profiller gelince planlanır."
              : "Plan onaylandı, üretime açıldı",
      );
      void load();
    } else toast.error(r.error || "Plan onaylanamadı");
  };
  const planCut = async () => {
    setBusy(true);
    const r = await send({ action: "plan-cut", commandId: crypto.randomUUID() });
    setBusy(false);
    if (r.ok) {
      toast.success("Kesim planlandı ve çubuklar ayrıldı");
      void load();
    } else toast.error(r.error || "Kesim planlanamadı");
  };
  if (error)
    return (
      <p role="alert" className="rf-panel p-4 text-sm">
        {error}{" "}
        <button className="text-primary" onClick={() => void load()}>
          Tekrar dene
        </button>
      </p>
    );
  if (!data)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Sipariş dosyası yükleniyor…
      </p>
    );
  const r = data.revisions.find((x: any) =>
      ["draft", "approved", "blocked"].includes(x.status),
    ),
    family = data.family as TechnicalFamily,
    issues = technicalIssues(r?.technical);
  return (
    <section className="min-w-0 space-y-4" aria-label="Sipariş teknik dosyası">
      {!worker && (
        <ol
          aria-label="Siparişin ana süreci"
          className="flex gap-2 overflow-x-auto pb-2"
        >
          {MAIN_PROCESS.map((label, i) => (
            <li
              key={label}
              aria-current={data.step === i ? "step" : undefined}
              className={`shrink-0 rounded px-3 py-2 text-xs ${data.step === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {label}
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            {worker ? data.order.order_number : "Teknik plan"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {FAMILY_LABELS[family]}
            {r ? ` · Liste sürümü ${r.revision}` : ""}
          </p>
        </div>
        {data.canEdit && !data.order.provisional && (
          <button
            className="rf-secondary-button"
            onClick={() => setUpload(!upload)}
          >
            {upload ? "Liste yüklemeyi kapat" : "Föy yükle / güncelle"}
          </button>
        )}
      </div>
      {data.order.provisional && (
        <p className="rf-panel p-4 text-sm">
          {data.quote?.status === "rejected"
            ? "Teklif reddedildi."
            : data.quote?.status === "expired"
              ? "Teklifin süresi doldu."
              : "Müşteri onayı bekleniyor."}{" "}
          Üretim kapalıdır.
        </p>
      )}
      {upload && (
        <FoyWorkbench
          orderId={orderId}
          family={family}
          controlled={!!data.jobs.length}
          expectedRevision={data.revisions[0]?.revision || 0}
          onAttached={() => {
            setUpload(false);
            void load();
          }}
        />
      )}
      {!r && !data.order.provisional && !data.legacy && (
        <p className="text-sm text-muted-foreground">
          Onaylı siparişin föyünü bu dosyaya yükleyin. Teknik plan hazırlanırken
          stok değişmez.
        </p>
      )}
      {data.legacy && (
        <>
          <p className="text-sm text-muted-foreground">
            Mevcut üretim kaydı. Önceki ölçüler, kesimler ve işlemler korunur.
          </p>
          {data.legacyProducts.map((p: any) => (
            <article key={p.id} className="rf-panel p-3">
              {p.awning ? (
                <TechnicalAwning value={p.awning} />
              ) : (
                <ProductDrawing
                  family={family}
                  widthMm={p.widthMm}
                  projectionMm={p.projectionMm}
                  heightMm={p.mountingHeightMm}
                  color={p.color}
                />
              )}
              <ul className="space-y-1 text-sm">
                {p.cuts.map((c: any, i: number) => (
                  <li key={i}>
                    {c.quantity} × {c.lengthMm} mm
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {data.legacyCutPlan?.bars.map((b: any) => (
            <p key={b.id} className="rf-panel p-3 text-sm">
              {b.color} · Kaynak {b.lengthMm} mm ·{" "}
              {b.pieces.map((c: any) => c.lengthMm + " mm").join(" + ")} · Kalan{" "}
              {b.remainingMm} mm · Kayıp {b.lossMm} mm
            </p>
          ))}
        </>
      )}
      {r && (
        <>
          {r.status === "blocked" && (
            <p
              role="status"
              className="rounded border border-amber-500/40 p-3 text-sm"
            >
              Teknik revizyon onayı bekleniyor. Üretim işlemleri geçici olarak
              kapalı.
            </p>
          )}
          {!worker && r.source_file_id && (
            <a
              className="text-sm text-primary"
              target="_blank"
              rel="noreferrer"
              href={`/api/v1/production/files/${data.order.tenant_id || ""}/${r.source_file_id}`}
            >
              Kaynak föyü aç
            </a>
          )}
          {r.technical?.gutter && (
            <p className="text-sm">
              Standart dere: <strong>170 Makaslı Dere</strong>
            </p>
          )}
          {issues.blockers.length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/50 p-3"
            >
              <p className="font-medium">Üretime açmadan önce düzeltilmeli</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {issues.blockers.map((s: string) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {issues.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 p-3">
              <p className="font-medium">
                {r.status === "draft" ? "Uyarılar" : "Onaylanırken kabul edilen uyarılar"}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {issues.warnings.map((s: string) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              {data.canApprove && r.status === "draft" && !issues.blockers.length && (
                <label className="mt-3 flex items-start gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                  />
                  Uyarıları gördüm, üretim yine de açılsın
                </label>
              )}
            </div>
          )}
          <div className="grid gap-3 xl:grid-cols-2">
            {r.document.systems?.map((s: any, i: number) =>
              r.technical.awnings?.[i] ? (
                <div key={i} className="min-w-0 space-y-3">
                  <TechnicalAwning value={r.technical.awnings[i]} />
                  <FoySchema
                    system={s}
                    index={i}
                    total={r.document.systems.length}
                  />
                </div>
              ) : r.technical.visualizations?.[i] ? (
                <div key={i} className="min-w-0 space-y-3">
                  <TechnicalProduct value={r.technical.visualizations[i]} />
                  <FoySchema
                    system={s}
                    index={i}
                    total={r.document.systems.length}
                  />
                </div>
              ) : (
                <MeasuredFoyView
                  key={i}
                  system={s}
                  index={i}
                  total={r.document.systems.length}
                />
              ),
            )}
          </div>
          <p className="text-sm">
            {r.document.windbreaker?.systemCount
              ? `${r.document.windbreaker.systemCount} adet · kaynak föydeki en ve yükseklik`
              : null}
          </p>
          <div className="grid gap-3 xl:grid-cols-2">
            {Array.from(
              new Map<string, any>(
                (r.technical.measures || [])
                  .map((m: any, i: number) => ({
                    ...m,
                    visualization: r.technical.visualizations?.[i],
                  }))
                  .filter((m: any) => m.heightMm != null)
                  .map((m: any) => [m.widthMm + "|" + m.heightMm, m]),
              ).values(),
            ).map((m: any, i: number) => (
              <div key={i} className="min-w-0 space-y-3">
                {m.visualization && (
                  <TechnicalProduct value={m.visualization} />
                )}
                <MeasuredVerticalView
                  widthMm={m.widthMm}
                  heightMm={m.heightMm}
                  index={i}
                  total={1}
                />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {r.plan?.plan?.groups?.map((g: any) => (
              <article
                key={g.itemId + g.color}
                className="rounded-lg border border-border p-3"
              >
                <h3 className="font-semibold">
                  {g.itemName} · {g.color || "Yüzey doğrulanmalı"}
                </h3>
                {g.uncertain && (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    Fiziksel boy bilgisi eksik; kesin satın alma ve fire hesabı
                    gösterilmez.
                  </p>
                )}
                {g.bars.map((b: any) => (
                  <div
                    key={b.lotId}
                    className="mt-3 border-t border-border pt-2 text-sm"
                  >
                    <p className="font-medium">
                      {b.sourceLengthMm} mm · {b.lotNumber}
                    </p>
                    <p className="text-muted-foreground">
                      {[b.warehouseName, b.locationCode]
                        .filter(Boolean)
                        .join(" / ")}
                    </p>
                    <p>
                      {b.cuts
                        .map((c: any) => `${c.count} × ${c.lengthMm} mm`)
                        .join(" · ")}
                    </p>
                    <p className="text-muted-foreground">
                      Testere {r.plan.parameters.kerfMm} mm · Uçlar{" "}
                      {r.plan.parameters.trimStartMm}/
                      {r.plan.parameters.trimEndMm} mm ·{" "}
                      {b.leftover === "keep" ? "Kullanılabilir artık" : "Hurda"}{" "}
                      {b.leftoverMm} mm
                    </p>
                    <p className="text-muted-foreground">
                      {b.cutWeightKg == null
                        ? "Gramaj eksik; ağırlık hesaplanmadı"
                        : `Kesilen parçalar ${Number(b.cutWeightKg).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} kg · Kesim kaybı ${Number(b.lossWeightKg).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} kg`}
                    </p>
                    {b.paintTo && (
                      <p className="mt-1 text-amber-700 dark:text-amber-300">
                        Kesilen parçalar {b.paintTo} boyanacak. Kalan artık
                        boyasızdır.
                      </p>
                    )}
                  </div>
                ))}
                {g.buy && (
                  <p className="mt-2 text-sm">
                    Eksik: {g.buy.bars} çubuk × {g.buy.lengthMm} mm. Satın alma
                    kararı bekler.
                  </p>
                )}
              </article>
            ))}
          </div>
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer font-medium">
              Stok boyları ve kesim yöntemi
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Önce siparişin renk ve yüzeyine uygun boyalı stok, sonra uyumlu
              boyasız stok değerlendirilir. Testere, uç düzeltme ve
              kullanılabilir artık sınırıyla farklı yerleşimler karşılaştırılır;
              sonuç matematiksel en az fire garantisi değildir.
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {r.plan?.availableLengths?.map((l: any, i: number) => (
                <li key={i}>
                  {l.itemName} · {l.lengthMm} mm × {l.count} çubuk · {l.color} ·{" "}
                  {l.kind === "remnant" ? "Kullanılabilir artık" : "Tam boy"}
                </li>
              ))}
            </ul>
          </details>
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer font-medium">
              Delik ölçüleri ve kaynakları
            </summary>
            <ul className="mt-2 space-y-2 text-sm">
              {r.technical?.drilling?.map((d: any) => (
                <li key={d.rowId}>
                  {d.label} · {d.lengthMm} mm:{" "}
                  {d.problem ||
                    (d.holes.mode === "none"
                      ? `Delik gerekmiyor · ${d.holes.reason} · ${d.source}`
                      : `${d.holes.positionsMm.join(" / ")} mm; referans ${d.holes.reference === "start" ? "başlangıç" : "bitiş"}, yüz ${d.holes.face}, çap ${d.holes.diameterMm} mm · ${d.source} (sürüm ${d.ruleVersion})`)}
                </li>
              ))}
            </ul>
            {data.canApprove && (
              <DrillingRuleForm
                key={r.id}
                orderId={orderId}
                revision={r}
                reload={load}
              />
            )}
          </details>
          {r.revision_reason && (
            <p className="text-sm">
              Revizyon gerekçesi: {r.revision_reason}.{" "}
              {r.impact?.keepsCuts
                ? "Ayrılan çubuklar ve kesilen parçalar korunur."
                : "Parça ve stok etkisi teknik kontrolden geçmeli."}
            </p>
          )}
          {data.canApprove &&
            r.status === "draft" &&
            r.replaces_id &&
            !r.impact?.keepsCuts &&
            !r.impact?.materialsResolved && (
              <RevisionMaterials
                key={r.id}
                orderId={orderId}
                revisionId={r.id}
                parts={data.revisionParts}
                jobs={data.jobs}
                sharedPlans={data.sharedPlans}
                reload={load}
              />
            )}
          {r.impact?.materialsResolved && (
            <p className="text-sm">
              Parça kararları stok hareketleriyle kaydedildi. Güncel stokla
              hesabı yenileyip yeni teknik sürümü kontrol edin.
            </p>
          )}
          {data.canEdit && r.status === "draft" && !data.jobs.length && (
            <button
              className="rf-secondary-button"
              disabled={busy}
              onClick={() => void approve(r.id, "refresh")}
            >
              Stok hesabını yenile
            </button>
          )}
          {data.canApprove && r.status === "draft" && (
            <button
              className="rf-primary-button"
              disabled={
                busy ||
                issues.blockers.length > 0 ||
                (issues.warnings.length > 0 && !acknowledged)
              }
              onClick={() => void approve(r.id)}
            >
              {busy ? "Kontrol ediliyor…" : "Planı onayla ve üretime aç"}
            </button>
          )}
          {!data.canApprove && r.status === "draft" && (
            <p className="text-sm text-muted-foreground">
              Planı firma sahibi veya yöneticisi onaylayıp üretime açar.
            </p>
          )}
          {r.status === "approved" &&
            !data.cutPlan &&
            data.jobs.some((j: any) => !j.cut_plan_id) && (
              <div className="rounded-lg border border-amber-500/40 p-3 text-sm">
                <p className="font-medium">Kesim stok bekliyor</p>
                <p className="mt-1 text-muted-foreground">
                  Üretim açık. Eksik profiller depoya girince kesimi buradan
                  planlayın; çubuklar bu siparişe ayrılır.
                </p>
                {data.canApprove && (
                  <button
                    className="rf-secondary-button mt-2"
                    disabled={busy}
                    onClick={() => void planCut()}
                  >
                    {busy ? "Kontrol ediliyor…" : "Stoğu kontrol et ve kesimi planla"}
                  </button>
                )}
              </div>
            )}
          {data.canApprove &&
            r.status === "draft" &&
            r.replaces_id &&
            !r.impact?.materialsResolved && (
              <button
                className="rf-secondary-button"
                disabled={busy}
                onClick={() => void approve(r.id, "reject")}
              >
                Revizyonu reddet, önceki sürümle devam et
              </button>
            )}
          {r.status === "approved" && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Onaylı teknik sürüm · Usta bu sürümle çalışır.
            </p>
          )}
        </>
      )}
      {!worker && data.materialDecisions.length > 0 && (
        <details className="rf-panel p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Revizyon malzeme geçmişi
          </summary>
          {data.materialDecisions.map((d: any, i: number) => (
            <div key={i} className="mt-3 text-sm">
              <p>
                {d.approved_by} ·{" "}
                {new Date(d.approved_at).toLocaleString("tr-TR")}
              </p>
              <p>
                {d.result.returned.length} parça yeniden kullanıma ayrıldı ·{" "}
                {d.result.scrapped.length} parça hurda
              </p>
              {d.result.finishedProducts?.map((f: any) => (
                <p key={f.workOrderId}>
                  {f.quantity} tamamlanmış ürün:{" "}
                  {f.disposition === "keep_stock"
                    ? "mevcut stokta korundu"
                    : f.disposition === "disassemble"
                      ? "fiilen söküldü; parçalar değerlendirildi"
                      : "hurdaya ayrıldı"}
                  .{" "}
                  {f.photos?.map((url: string, i: number) => (
                    <a
                      key={url}
                      className="mr-2 text-primary"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Fotoğraf {i + 1}
                    </a>
                  ))}
                </p>
              ))}
              {d.result.sharedSuccessors?.map((p: any) => (
                <p key={p.planId}>
                  Ortak kesimde diğer listeler için devam planı:{" "}
                  <Link
                    href={`/production?tab=cutting&cut=${p.planId}`}
                    className="text-primary"
                  >
                    {p.planId.slice(0, 8)}
                  </Link>
                </p>
              ))}
              <p className="text-xs text-muted-foreground">
                Önceki kesim, maliyet ve stok hareketleri korunur. Yeni kesimin
                testere payı ayrıca hesaplanır.
              </p>
            </div>
          ))}
        </details>
      )}
      {r &&
        ["approved", "blocked", "draft"].includes(r.status) &&
        data.parts
          ?.filter((p: any) => p.target_color)
          .map((p: any) => (
            <PaintProgress
              key={p.work_order_id + p.item_id + p.length_mm + p.target_color}
              part={p}
              revisionId={
                r.status === "draft" && r.replaces_id ? r.replaces_id : r.id
              }
              returnOnly={r.status !== "approved"}
              reload={load}
            />
          ))}
      {(r?.status === "approved" || data.legacy) &&
        data.cutPlan?.status === "approved" && (
          <CutCompletion plan={data.cutPlan} reload={load} />
        )}
      {(r?.status === "approved" || data.legacy) &&
        !!data.operations.length && (
          <div className="rf-panel space-y-2 p-3">
            <h3 className="font-semibold">Üretim işlemleri</h3>
            {data.operations
              .filter(
                (op: any) =>
                  !(
                    !data.legacy &&
                    /kesim|cut|boya|paint/i.test(op.name) &&
                    !op.quality_checks?.length
                  ),
              )
              .map((op: any) => (
                <Operation key={op.id} op={op} reload={load} />
              ))}
          </div>
        )}
      {(r?.status === "approved" || data.legacy) && (
        <OrderLoadingPanel
          orderId={orderId}
          revision={
            r || {
              id: data.jobs[0].id,
              technical: {
                loadingChecklist: [
                  { id: "product", title: "Ürünler ve adetler tam" },
                ],
              },
            }
          }
          jobs={data.jobs}
          shipments={data.shipments}
          reload={load}
        />
      )}
      {!!data.jobs.length && (
        <details className="rf-panel p-3">
          <summary className="cursor-pointer font-medium">
            İhtiyaç bildir / talepleri gör
          </summary>
          <WorkshopPanel orderId={orderId} workOrderId={data.jobs[0].id} />
        </details>
      )}
      {!worker && (
        <Link
          href="/production/worker"
          className="inline-block text-sm text-primary"
        >
          Usta ekranını aç
        </Link>
      )}
    </section>
  );
}

function DrillingRuleForm({
  orderId,
  revision,
  reload,
}: {
  orderId: string;
  revision: any;
  reload: () => Promise<void>;
}) {
  const groups = revision.plan?.plan?.groups || [];
  const [itemId, setItem] = useState(""),
    [mode, setMode] = useState(""),
    [source, setSource] = useState(""),
    [reason, setReason] = useState(""),
    [face, setFace] = useState(""),
    [reference, setReference] = useState("start"),
    [diameter, setDiameter] = useState(""),
    [edge, setEdge] = useState(""),
    [offsets, setOffsets] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const act = async (body: unknown) => {
    setBusy(true);
    const r = await requestJson(`/api/v1/orders/${orderId}/technical`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) toast.error(r.error || "Kural kaydedilemedi");
    return r.ok;
  };
  return (
    <details className="mt-3 border-t border-border pt-3">
      <summary className="cursor-pointer text-sm">
        Doğrulanmış delik kuralı tanımla
      </summary>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const group = groups.find((g: any) => g.itemId === itemId),
            rowIds =
              group?.bars.flatMap((b: any) =>
                b.cuts.map((c: any) => c.label),
              ) || [],
            previous = revision.technical.drilling
              .filter((d: any) => rowIds.includes(d.label))
              .reduce(
                (n: number, d: any) => Math.max(n, d.ruleVersion || 0),
                0,
              );
          if (
            await act({
              action: "save-drilling-rule",
              data: {
                revisionId: revision.id,
                itemId,
                expectedVersion: previous,
                source,
                rule:
                  mode === "none"
                    ? { mode: "none", reason }
                    : {
                        reference,
                        face,
                        diameterMm: Number(diameter),
                        edgeDistanceMm: Number(edge),
                        offsetsMm: offsets
                          .split(/[;\s]+/)
                          .filter(Boolean)
                          .map(Number),
                      },
              },
            })
          ) {
            setSaved(true);
            toast.success(
              "Kural yeni sürüm olarak kaydedildi; teknik liste henüz değişmedi",
            );
          }
        }}
      >
        <label className="text-sm">
          Profil
          <select
            required
            className="rf-input mt-1 w-full"
            value={itemId}
            onChange={(e) => setItem(e.target.value)}
          >
            <option value="">Seçin</option>
            {groups.map((g: any) => (
              <option key={g.itemId} value={g.itemId}>
                {g.itemName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Kaynağın kararı
          <select
            required
            className="rf-input mt-1 w-full"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="">Seçin</option>
            <option value="coordinates">Doğrulanmış delik ölçüleri var</option>
            <option value="none">Doğrulanmış kaynakta delik gerekmiyor</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          Teknik kaynak, sürüm ve sayfa
          <input
            required
            minLength={5}
            maxLength={1000}
            className="rf-input mt-1 w-full"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </label>
        {mode === "none" && (
          <label className="text-sm sm:col-span-2">
            Delik gerekmeme gerekçesi
            <input
              required
              minLength={5}
              maxLength={500}
              className="rf-input mt-1 w-full"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        {mode === "coordinates" && (
          <>
            <label className="text-sm">
              Referans ucu
              <select
                className="rf-input mt-1 w-full"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              >
                <option value="start">Başlangıç</option>
                <option value="end">Bitiş</option>
              </select>
            </label>
            <label className="text-sm">
              Delinen yüz
              <input
                required
                className="rf-input mt-1 w-full"
                value={face}
                onChange={(e) => setFace(e.target.value)}
              />
            </label>
            {[
              ["Delik çapı · mm", diameter, setDiameter],
              ["Asgari kenar mesafesi · mm", edge, setEdge],
            ].map(([label, value, set]: any) => (
              <label key={label} className="text-sm">
                {label}
                <input
                  required
                  type="number"
                  min={label.startsWith("Delik") ? 0.01 : 0}
                  step="any"
                  className="rf-input mt-1 w-full"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                />
              </label>
            ))}
            <label className="text-sm sm:col-span-2">
              Referans ucundan delik merkezleri · mm
              <input
                required
                className="rf-input mt-1 w-full"
                value={offsets}
                onChange={(e) => setOffsets(e.target.value)}
                placeholder="Ölçüleri boşluk veya noktalı virgülle ayırın"
              />
            </label>
          </>
        )}
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Yalnız doğrulanmış kaynaktaki değerleri girin. Kural geçmişi korunur;
          mevcut üretim listesi yeni teknik onay olmadan değişmez.
        </p>
        <button className="rf-secondary-button" disabled={busy || saved}>
          Kuralı yeni sürüm olarak kaydet
        </button>
        {saved && revision.status === "approved" && (
          <button
            type="button"
            className="rf-primary-button"
            disabled={busy}
            onClick={async () => {
              if (
                await act({
                  action: "recheck-rules",
                  revisionId: revision.id,
                  commandId: crypto.randomUUID(),
                })
              )
                await reload();
            }}
          >
            Kuralla yeni teknik sürüm hazırla
          </button>
        )}
        {saved && revision.status === "draft" && (
          <p className="text-sm">
            Kuralı listeye almak için stok hesabını yenileyin.
          </p>
        )}
      </form>
    </details>
  );
}

function RevisionMaterials({
  orderId,
  revisionId,
  parts,
  jobs,
  sharedPlans,
  reload,
}: {
  orderId: string;
  revisionId: string;
  parts: any[];
  jobs: any[];
  sharedPlans: any[];
  reload: () => Promise<void>;
}) {
  const [decisions, setDecisions] = useState<Record<string, string>>({}),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState<
      Record<
        string,
        { disposition: string; photos: string[]; reuseAccessories: boolean }
      >
    >({}),
    [actualLengths, setActualLengths] = useState<Record<string, string>>({}),
    [sharedAccepted, setSharedAccepted] = useState(false);
  const finishedJobs = jobs.filter((j) => Number(j.produced_qty) > 0);
  const send = useCommandRetry(),
    physical = parts.filter(
      (p) =>
        [
          "cut",
          "paint_waiting",
          "paint_returned",
          "paint_sent",
          "assembled",
        ].includes(p.state) &&
        (p.state !== "assembled" ||
          finished[p.work_order_id]?.disposition === "disassemble"),
    );
  const blocked = physical.some((p) => p.state === "paint_sent");
  const uploadPhoto = async (jobId: string, file: File) => {
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await requestJson<{ data: { url: string } }>(
        "/api/v1/production/files",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workOrderId: jobId,
            name: file.name,
            mime: file.type,
            base64,
          }),
        },
      );
      if (response.ok && response.data)
        setFinished((v) => ({
          ...v,
          [jobId]: {
            ...(v[jobId] || {
              disposition: "",
              photos: [],
              reuseAccessories: false,
            }),
            photos: [...(v[jobId]?.photos || []), response.data!.data.url],
          },
        }));
      else toast.error(response.error || "Fotoğraf yüklenemedi");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="rf-panel space-y-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const result = await send(
          `/api/v1/orders/${orderId}/technical`,
          {
            action: "resolve-materials",
            data: {
              revisionId,
              reason,
              finishedProducts: finishedJobs.map((j) => ({
                workOrderId: j.id,
                revision: j.revision,
                quantity: Number(j.produced_qty),
                ...finished[j.id],
              })),
              sharedPlans: sharedAccepted
                ? sharedPlans.map((p) => ({ planId: p.id, version: p.version }))
                : [],
              decisions: physical.map((p) => ({
                partId: p.id,
                disposition: decisions[p.id],
                actualLengthMm: actualLengths[p.id]
                  ? Number(actualLengths[p.id])
                  : undefined,
              })),
            },
          },
          "data",
        );
        setBusy(false);
        if (result.ok) {
          toast.success("Malzeme kararları kaydedildi; yeni planı hesaplayın");
          await reload();
        } else toast.error(result.error || "Malzeme kararı kaydedilemedi");
      }}
    >
      <h3 className="font-semibold">Kesilmiş parçaların kararı</h3>
      <p className="text-sm text-muted-foreground">
        Kesilmiş parçaları gerçek boylarıyla yeniden kullanıma alın veya hurda
        ayırın. Başka listede kullanılmayan kesilmemiş çubuklar serbest
        bırakılır. Yeni plan ayrıca onaylanır.
      </p>
      {finishedJobs.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium">Tamamlanmış ürünlerin kararı</h4>
          <p className="text-sm text-muted-foreground">
            Karar listedeki tamamlanmış ürünlerin tümünü kapsar. Siparişin yeni
            ölçüleri ayrıca üretilecektir. Söküm seçeneğini yalnız fiilen söküp
            parçaları kontrol ettikten sonra kaydedin.
          </p>
          {finishedJobs.map((j) => (
            <div
              key={j.id}
              className="space-y-2 rounded border border-border p-3"
            >
              <p className="text-sm font-medium">
                {j.title} · {Number(j.produced_qty)} adet
              </p>
              <label className="block text-sm">
                Fiziksel ürün kararı
                <select
                  required
                  className="rf-input mt-1 w-full"
                  disabled={busy}
                  value={finished[j.id]?.disposition || ""}
                  onChange={(e) =>
                    setFinished((v) => ({
                      ...v,
                      [j.id]: {
                        ...(v[j.id] || { photos: [], reuseAccessories: false }),
                        disposition: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="">Karar seçin</option>
                  <option value="keep_stock">
                    Mevcut bitmiş ürün stoğunda koru
                  </option>
                  <option value="scrap">Tamamlanmış ürünü hurdaya ayır</option>
                  <option value="disassemble">
                    Fiilen söküldü; ölçülen parçaları değerlendir
                  </option>
                </select>
              </label>
              {finished[j.id]?.disposition === "disassemble" && (
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={finished[j.id]?.reuseAccessories || false}
                    disabled={busy}
                    onChange={(e) =>
                      setFinished((v) => ({
                        ...v,
                        [j.id]: {
                          ...v[j.id],
                          reuseAccessories: e.target.checked,
                        },
                      }))
                    }
                  />
                  Sökülen aksesuarların tamamını kontrol ettim; yeniden
                  kullanılabilir. Seçilmezse tüketilmiş aksesuarlar hurda kabul
                  edilir.
                </label>
              )}
              <label className="block text-sm">
                Ürünün / sökümün fotoğrafı
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={busy || (finished[j.id]?.photos.length || 0) >= 6}
                  className="mt-1 block w-full text-sm"
                  onChange={(e) => {
                    if (e.target.files?.[0])
                      void uploadPhoto(j.id, e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                {finished[j.id]?.photos.length || 0} fotoğraf kaydedildi.
              </p>
            </div>
          ))}
        </div>
      )}
      {sharedPlans.length > 0 && (
        <div className="space-y-2 rounded border border-border p-3 text-sm">
          <h4 className="font-medium">
            Ortak kesimden etkilenen diğer listeler
          </h4>
          {sharedPlans.map((p) => (
            <p key={p.id}>
              {p.others
                ?.map((j: any) => j.orderNumber + " · " + j.title)
                .join(", ")}{" "}
              · Plan sürümü {p.version}
            </p>
          ))}
          <label className="flex gap-2">
            <input
              type="checkbox"
              required
              checked={sharedAccepted}
              disabled={busy}
              onChange={(e) => setSharedAccepted(e.target.checked)}
            />
            Diğer listelerin bekleyen parçaları aynı fiziksel çubuklarda
            korunarak devam planına alınsın. Gerçekleşmiş kesimler korunsun.
          </label>
        </div>
      )}
      {physical.map((p) => (
        <label
          key={p.id}
          className="block rounded border border-border p-3 text-sm"
        >
          {p.name} · {Number(p.length_mm)} mm ·{" "}
          {p.paint_returned_at ? p.target_color : p.source_color}
          <select
            required
            disabled={blocked || busy}
            className="rf-input mt-2 w-full"
            value={decisions[p.id] || ""}
            onChange={(e) =>
              setDecisions((v) => ({ ...v, [p.id]: e.target.value }))
            }
          >
            <option value="">Karar seçin</option>
            <option value="reuse">Gerçek boyuyla yeniden kullan</option>
            <option value="scrap">Hurda ayır</option>
          </select>
          {decisions[p.id] === "reuse" && (
            <span className="mt-2 block">
              Kullanılabilir gerçek boy (mm)
              <input
                className="rf-input mt-1 w-full"
                type="number"
                min="0.001"
                step="0.001"
                max={Number(p.length_mm)}
                required={p.state === "assembled"}
                value={actualLengths[p.id] || ""}
                placeholder={String(Number(p.length_mm))}
                disabled={busy}
                onChange={(e) =>
                  setActualLengths((v) => ({ ...v, [p.id]: e.target.value }))
                }
              />
            </span>
          )}
        </label>
      ))}
      {!physical.length && (
        <p className="text-sm">
          Ayrıca karar verilecek kesilmiş parça yok. Yalnız bu sipariş için
          ayrılmış, kesilmemiş çubuklar serbest bırakılacak.
        </p>
      )}
      {blocked && (
        <p role="alert" className="text-sm text-destructive">
          Boyadaki parçalar geri gelmeden malzeme kararı kaydedilemez.
        </p>
      )}
      <label className="block text-sm">
        Kararın gerekçesi
        <textarea
          required
          minLength={5}
          maxLength={1000}
          className="rf-input mt-2 w-full"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <button
        className="rf-secondary-button"
        disabled={
          busy ||
          blocked ||
          finishedJobs.some(
            (j) =>
              !finished[j.id]?.disposition || !finished[j.id]?.photos.length,
          )
        }
      >
        {busy ? "Kaydediliyor…" : "Malzeme kararını onayla"}
      </button>
    </form>
  );
}
function Operation({ op, reload }: { op: any; reload: () => Promise<void> }) {
  const sendCommand = useCommandRetry();
  const [quantity, setQuantity] = useState(1),
    [busy, setBusy] = useState(false),
    [quality, setQuality] = useState<Record<string, string>>({}),
    [photos, setPhotos] = useState<string[]>([]);
  const act = async (action: string) => {
    if (
      action === "complete" &&
      (op.quality_checks || []).some(
        (c: any) => c.kind !== "photo" && !quality[c.id]?.trim(),
      )
    ) {
      toast.error("Kontrol listesindeki tüm değerleri doldurun");
      return;
    }
    setBusy(true);
    const r = await sendCommand("/api/v1/production", {
      commandId: crypto.randomUUID(),
      action: "operation",
      data: {
        operationId: op.id,
        version: op.version,
        action,
        quantity,
        photos,
        qualityResults: (op.quality_checks || []).map((c: any) =>
          c.kind === "measurement"
            ? { checkId: c.id, value: Number(quality[c.id]) }
            : c.kind === "pass_fail"
              ? { checkId: c.id, passed: quality[c.id] === "pass" }
              : { checkId: c.id },
        ),
      },
    });
    setBusy(false);
    if (r.ok) await reload();
    else toast.error(r.error || "İşlem kaydedilemedi");
  };
  const photo = async (file: File) => {
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const r = await requestJson<{ data: { url: string } }>(
        "/api/v1/production/files",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            mime: file.type,
            base64,
            workOrderId: op.work_order_id,
          }),
        },
      );
      if (r.ok && r.data) setPhotos((p) => [...p, r.data!.data.url]);
      else toast.error(r.error || "Fotoğraf yüklenemedi");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{op.name}</p>
        <p className="text-sm text-muted-foreground">
          Tamamlanan {op.completed_qty} / {op.planned_qty}
        </p>
      </div>
      {["ready", "paused"].includes(op.status) && (
        <button
          disabled={busy}
          className="rf-secondary-button"
          onClick={() => void act("start")}
        >
          Başlat
        </button>
      )}
      {op.status === "running" && (
        <>
          <div className="w-full">
            <QualityChecklist
              checks={op.quality_checks || []}
              values={quality}
              onChange={(id, value) =>
                setQuality((q) => ({ ...q, [id]: value }))
              }
              disabled={busy}
            />
            <label className="mt-2 block text-sm">
              Kontrol fotoğrafı
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void photo(f);
                }}
              />
            </label>
          </div>
          <label className="text-xs">
            Miktar
            <input
              className="rf-input ml-2 w-20"
              aria-label={`${op.name} tamamlanan miktar`}
              inputMode="numeric"
              type="number"
              min={1}
              max={Number(op.planned_qty) - Number(op.completed_qty)}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <button
            disabled={busy}
            className="rf-primary-button"
            onClick={() => void act("complete")}
          >
            Kaydet
          </button>
        </>
      )}
    </div>
  );
}

function CutCompletion({
  plan,
  reload,
}: {
  plan: any;
  reload: () => Promise<void>;
}) {
  const sendCommand = useCommandRetry();
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const remaining = (plan.sources || []).filter((s: any) => !s.consumed);
  const complete = async () => {
    setBusy(true);
    try {
      const r = await sendCommand("/api/v1/production", {
        commandId: crypto.randomUUID(),
        action: "cut.complete",
        data: {
          id: plan.id,
          version: plan.version,
          confirmed,
          sourceLotIds: selected,
        },
      });
      if (r.ok) {
        setConfirmed(false);
        setSelected([]);
        await reload();
      } else toast.error(r.error || "Kesim kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rf-panel space-y-3 p-3">
      <h3 className="font-semibold">Kesim kaydı</h3>
      <p className="text-sm text-muted-foreground">
        Kesilen çubukları seçin. Diğerleri ayrılmış olarak bekler.
      </p>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {remaining.map((s: any) => (
          <label
            key={s.lot_id}
            className="flex items-center gap-2 rounded border border-border p-2 text-sm"
          >
            <input
              type="checkbox"
              disabled={busy}
              checked={selected.includes(s.lot_id)}
              onChange={(e) => {
                setSelected((ids) =>
                  e.target.checked
                    ? [...ids, s.lot_id]
                    : ids.filter((id) => id !== s.lot_id),
                );
                setConfirmed(false);
              }}
            />
            {s.lot_number} · {Number(s.length_m) * 1000} mm
          </label>
        ))}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        Seçilen çubuklar plandaki ölçülerle kesildi. Parçaları ve artıkları
        kontrol ettim.
      </label>
      <button
        disabled={busy || !confirmed || !selected.length}
        className="rf-primary-button"
        onClick={() => void complete()}
      >
        Seçilen kesimleri kaydet
      </button>
    </div>
  );
}

function PaintProgress({
  part,
  revisionId,
  reload,
  returnOnly = false,
}: {
  part: any;
  revisionId: string;
  reload: () => Promise<void>;
  returnOnly?: boolean;
}) {
  const sendCommand = useCommandRetry();
  const [quantity, setQuantity] = useState(1),
    [busy, setBusy] = useState(false);
  const record = async (action: string) => {
    setBusy(true);
    const r = await sendCommand("/api/v1/production/parts", {
      commandId: crypto.randomUUID(),
      workOrderId: part.work_order_id,
      technicalRevisionId: revisionId,
      itemId: part.item_id,
      lengthMm: Number(part.length_mm),
      targetColor: part.target_color,
      quantity,
      action,
    });
    setBusy(false);
    if (r.ok) await reload();
    else toast.error(r.error || "Boya miktarı kaydedilemedi");
  };
  return (
    <article className="rf-panel space-y-2 p-3">
      <h3 className="font-medium">
        {part.item_name} · {part.length_mm} mm · {part.target_color}
      </h3>
      <p className="text-sm">
        Boyaya gitmeyi bekleyen {part.waiting} · Boyada {part.sent} · Gelen{" "}
        {part.returned} / {part.total} · Son hazırlıkta kullanılan{" "}
        {part.assembled}
      </p>
      <p className="text-sm text-muted-foreground">
        {part.weight_kg == null
          ? "Gramaj eksik; ağırlık hesaplanmadı"
          : `Toplam ${Number(part.weight_kg).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} kg`}
      </p>
      {returnOnly && (
        <p className="text-sm text-muted-foreground">
          Teknik revizyon sırasında yalnız boyadan fiziksel dönüş
          kaydedilebilir.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="text-sm">
          Miktar
          <input
            className="rf-input ml-2 w-20"
            type="number"
            min={1}
            max={Math.max(part.waiting, part.sent)}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
        {!returnOnly && (
          <button
            className="rf-secondary-button"
            disabled={busy || part.waiting < quantity}
            onClick={() => void record("paint.send")}
          >
            Boyaya gönderildi
          </button>
        )}
        <button
          className="rf-secondary-button"
          disabled={busy || part.sent < quantity}
          onClick={() => void record("paint.return")}
        >
          Boyadan geldi
        </button>
      </div>
    </article>
  );
}

function TechnicalProduct({
  value,
}: {
  value: React.ComponentProps<typeof ProductModel>["value"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="rf-secondary-button"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "3D görünümü kapat" : "Siparişin 3D görünümünü aç"}
      </button>
      {open && <ProductModel value={value} readOnly />}
    </div>
  );
}
function TechnicalAwning({
  value,
}: {
  value: React.ComponentProps<typeof AwningConfigurator>["value"];
}) {
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="space-y-2">
      <button
        type="button"
        className="rf-secondary-button"
        onClick={() => setOpen(false)}
      >
        3D görünümü kapat
      </button>
      <AwningConfigurator value={value} readOnly />
    </div>
  ) : (
    <button
      type="button"
      className="rf-secondary-button"
      onClick={() => setOpen(true)}
    >
      Siparişin 3D görünümünü aç
    </button>
  );
}
