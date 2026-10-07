"use client";
import { prepareFileUpload } from "@/lib/storage/client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Box,
  Layers,
  Scissors,
  CalendarClock,
  Warehouse,
  Mail,
  FileSearch,
  Plus,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";
import { useProduction } from "./useProduction";
import { QualityIntelligence,ReworkCases } from "./QualityIntelligence";
import { ProductionAnalytics } from "./ProductionAnalytics";
import { PlanningResources } from "./PlanningResources";
import { RecipeEditor } from "./RecipeEditor";
import { fileData } from "@/lib/features/manufacturing/offline";
import { AwningDialog } from "@/components/features/awning/AwningConfigurator";
import { cuttingEstimateNotice } from "@/lib/features/manufacturing/cutting-defaults";
import { PROCESSED_STATES, STATE_LABELS, STOCK_UNITS, UNIT_LABELS, WAREHOUSE_TYPE_LABELS, warehouseTypeLabel } from "@/lib/features/inventory/vocabulary";

/** Shown wherever a plan made with unconfirmed values appears; it is never presented as exact. */
function EstimateNotice({ text, onOpenSettings }: { text: string | null; onOpenSettings?: () => void }) {
  if (!text) return null;
  return (
    <p role="note" className="rounded border border-amber-400 bg-amber-50 p-3 text-xs font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      {text}
      {onOpenSettings && <> <button type="button" className="underline" onClick={onOpenSettings}>Kesim ayarlarını aç</button></>}
    </p>
  );
}
const tabs = [
  ["overview", "Üretim merkezi", Layers],
  ["recipes", "Reçeteler", Box],
  ["cutting", "Toplu kesim", Scissors],
  ["planning", "Çizelgeleme", CalendarClock],
  ["stock", "Malzeme ve kapasite", Warehouse],
  ["intake", "Belgeden sipariş", FileSearch],
  ["communication", "Müşteri iletişimi", Mail],
] as const;
const status: Record<string, string> = {
  open: "Hazırlık",
  in_progress: "Üretimde",
  blocked: "Bekliyor",
  done: "Tamamlandı",
  cancelled: "İptal",
  draft: "Taslak",
  approved: "Onaylı",
  completed: "Gerçekleşti",
  published: "Yayında",
  waiting: "Önceki aşama",
  ready: "Hazır",
  running: "Çalışıyor",
  paused: "Duraklatıldı",
  needs_review: "Kontrol bekliyor",
  failed: "Başarısız",
  pending: "Sırada",
  sent: "Gönderildi",
  delivered: "Teslim edildi",
  uncertain: "Teslimat doğrulanmalı",
  superseded: "Eski çizelge",
};
function Field({ name, label, type = "text", required = true, value }: any) {
  return (
    <label className="block text-xs">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        step={type === "number" ? "any" : undefined}
        defaultValue={value}
        className="rf-input mt-2 w-full"
      />
    </label>
  );
}
function Select({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: Array<{ id: string; name: string }>;
}) {
  return (
    <label className="block text-xs">
      {label}
      <select name={name} required className="rf-input mt-2 w-full">
        <option value="">Seçin</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function Badge({ value }: { value: string }) {
  return (
    <span className="rounded border border-border bg-muted px-2 py-1 text-[11px]">
      {status[value] || value}
    </span>
  );
}
export default function ProductionWorkspace() {
  const { data, error, busy, command, refresh } = useProduction(),
    [tab, setTab] = useState("overview"),
    [editor, setEditor] = useState<any>(false),
    [selected, setSelected] = useState<string[]>([]),
    [selectedRework, setSelectedRework] = useState<string[]>([]),
    [trackingPath, setTrackingPath] = useState(""),
    [uploadBusy, setUploadBusy] = useState(false),
    [localError, setLocalError] = useState(""),
    [measured, setMeasured] = useState<Record<string, number>>({}),
    [correctionReason, setCorrectionReason] = useState(""),
    qrLoaded = useRef(false);
  useEffect(() => {
    if (!data || qrLoaded.current) return;
    const q = new URLSearchParams(window.location.search);
    if (tabs.some(([id]) => id === q.get("tab"))) setTab(q.get("tab")!);
    if (q.has("cut")) setTab("cutting");
    if (q.has("lot")) setTab("stock");
    qrLoaded.current = true;
  }, [data]);
  useEffect(() => {
    if (tab === "stock" && data && window.location.hash === "#cutting-settings")
      document.getElementById("cutting-settings")?.scrollIntoView({ block: "start" });
  }, [tab, data]);
  function openCuttingSettings() {
    const query = new URLSearchParams(window.location.search);
    query.set("tab", "stock");
    window.history.replaceState(null, "", "/production?" + query.toString() + "#cutting-settings");
    setTab("stock");
  }
  useEffect(() => {
    if(tab!=="cutting" || !data)return;
    const id=new URLSearchParams(window.location.search).get("cut");
    if(id)document.getElementById("cut-plan-"+id)?.scrollIntoView({block:"center"});
  },[tab,data]);
  async function run(action: string, d: any) {
    try {
      setLocalError("");
      return await command(action, d);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "İşlem tamamlanamadı");
    }
  }
  function submit(
    action: string,
    numeric: string[] = [],
    after?: (r: any) => void,
  ) {
    return async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const d: any = Object.fromEntries(new FormData(e.currentTarget));
      numeric.forEach((k) => (d[k] = Number(d[k])));
      const r = await run(action, d);
      if (r) after?.(r);
    };
  }
  if (!data)
    return (
      <div className="rf-page space-y-4">
        <h1 className="rf-page-title">Üretim merkezi</h1>
        <p role={error ? "alert" : "status"}>
          {error || "Üretim verileri yükleniyor…"}
        </p>
        <button className="rf-input" onClick={refresh}>
          Tekrar dene
        </button>
      </div>
    );
  if (data.actor.role === "worker")
    return (
      <div className="rf-page">
        <Link className="rf-primary-button" href="/factory">
          Usta ekranını aç
        </Link>
      </div>
    );
  const items = data.items || [],
    warehouses = data.warehouses || [],
    jobs = data.jobs || [],
    ops = data.operations || [],
    manager = ["owner", "admin"].includes(data.actor.role),
    working = ops.filter((o: any) => o.status === "running"),
    ready = ops.filter((o: any) =>
      ["ready", "paused", "blocked"].includes(o.status),
    ),
    available = jobs.filter(
      (j: any) => !j.cut_plan_id && ["open", "in_progress"].includes(j.status),
    );
  const centers = (data.centers || [])
    .map((c: any) => ({
      ...c,
      queue: ready.filter((o: any) => o.work_center_code === c.code),
      active: working.filter((o: any) => o.work_center_code === c.code),
    }))
    .sort(
      (a: any, b: any) =>
        b.queue.reduce(
          (s: number, o: any) => s + Number(o.planned_minutes),
          0,
        ) -
        a.queue.reduce((s: number, o: any) => s + Number(o.planned_minutes), 0),
    );
  return (
    <div className="rf-page space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="rf-eyebrow">RENK ALÜMİNYUM / ÜRETİM</p>
          <h1 className="rf-page-title">Üretim merkezi</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Siparişten kesime, sahadan sevkiyata tek çalışma alanı.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rf-icon-button"
            aria-label="Üretimi yenile"
            onClick={refresh}
          >
            <RefreshCw size={16} />
          </button>
          <Link className="rf-primary-button" href="/factory">
            Usta ekranı <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
      <nav
        aria-label="Üretim bölümleri"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            onClick={() => { setTab(id); const query = new URLSearchParams(window.location.search); query.set("tab", id); window.history.replaceState(null, "", "/production?" + query.toString()); }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>
      {(error || localError) && (
        <p
          role="alert"
          className="rounded border border-destructive/25 bg-destructive/5 p-4 text-sm"
        >
          {localError || error}
        </p>
      )}
      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              [
                "Aktif üretim",
                jobs.filter(
                  (j: any) => j.status !== "done" && j.status !== "cancelled",
                ).length,
              ],
              ["Çalışan operasyon", working.length],
              ["İstasyonda bekleyen", ready.length],
              ["Yeniden işlem", data.rework?.length || 0],
            ].map(([label, value]) => (
              <section key={label} className="rf-panel">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-3 text-3xl font-semibold tabular-nums">
                  {value}
                </p>
              </section>
            ))}
          </div>
          <ProductionAnalytics data={data.analytics} />
          <QualityIntelligence data={data.qualityAnalytics} preferences={data.preferences} manager={manager} command={command} busy={busy} />
          <ReworkCases cases={data.rework} operations={ops} jobs={jobs} onResolve={payload=>command("rework.resolve",payload)} />
          <section className="rf-panel">
            <h2 className="rf-section-title mb-5">
              Sipariş kaleminden üretim emri
            </h2>
            <form
              className="grid items-end gap-3 md:grid-cols-3"
              onSubmit={submit("job.create")}
            >
              <Select
                name="orderItemId"
                label="Ölçüleri doğrulanmış sipariş kalemi"
                options={(data.orders || [])
                  .filter(
                    (o: any) =>
                      (o.awning_configuration || (o.width_mm && o.projection_mm && o.mounting_height_mm)) &&
                      !jobs.some(
                        (j: any) =>
                          j.order_item_id === o.id && j.status !== "cancelled",
                      ),
                  )
                  .map((o: any) => ({
                    id: o.id,
                    name: `${o.order_number} · ${o.customer_name} · ${o.product_name}`,
                  }))}
              />
              <Select
                name="recipeId"
                label="Yayınlanmış reçete"
                options={data.recipes
                  .filter((r: any) => r.status === "published")
                  .map((r: any) => ({
                    id: r.id,
                    name: `${r.name} · v${r.version}`,
                  }))}
              />
              <Select
                name="assignedTo"
                label="Atanan çalışan"
                options={data.members
                  .filter((m: any) =>
                    ["worker", "office", "owner", "admin"].includes(m.role),
                  )
                  .map((m: any) => ({ id: m.id, name: m.name || m.email }))}
              />
              {[
                ["sourceWarehouseId", "Hammadde", "RAW"],
                ["wipWarehouseId", "Üretim / WIP", "WIP"],
                ["targetWarehouseId", "Mamul", "FINISHED"],
              ].map(([name, label, type]) => (
                <Select
                  key={name}
                  name={name}
                  label={label}
                  options={warehouses.filter(
                    (w: any) => w.warehouse_type === type,
                  )}
                />
              ))}
              <button disabled={busy} className="rf-primary-button">
                Üretim emri oluştur
              </button>
            </form>
          </section>
          <section className="rf-panel overflow-x-auto">
            <h2 className="rf-section-title mb-5">Üretim emirleri</h2>
            {jobs.length ? (
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    {[
                      "Sipariş / iş",
                      "Üretim rotası",
                      "Miktar",
                      "Durum",
                      "",
                    ].map((v, i) => (
                      <th key={i} className="pb-3 font-medium">
                        {v}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j: any) => (
                    <tr key={j.id} className="border-t border-border">
                      <td className="py-4 pr-4">
                        <Link
                          href={`/orders/${j.order_id}`}
                          className="font-medium"
                        >
                          {j.title}
                        </Link>
                        <p className="mt-1 text-muted-foreground">
                          {j.customer_name}
                        </p>
                      </td>
                      <td className="py-4">
                        <div className="flex gap-1">
                          {ops
                            .filter((o: any) => o.work_order_id === j.id)
                            .map((o: any) => (
                              <span
                                key={o.id}
                                title={`${o.name}: ${status[o.status]}`}
                                className={`h-2 w-8 rounded-sm ${o.status === "done" ? "bg-emerald-500" : o.status === "running" ? "bg-primary" : o.status === "ready" ? "bg-amber-400" : "bg-muted"}`}
                              />
                            ))}
                        </div>
                        <p className="mt-2 text-muted-foreground">
                          {ops.find(
                            (o: any) =>
                              o.work_order_id === j.id &&
                              o.status === "running",
                          )?.name ||
                            ops.find(
                              (o: any) =>
                                o.work_order_id === j.id &&
                                o.status === "ready",
                            )?.name ||
                            "—"}
                        </p>
                      </td>
                      <td>
                        {j.produced_qty} / {j.planned_qty}
                      </td>
                      <td>
                        <Badge value={j.status} />
                      </td>
                      <td>
                        <Link
                          href={`/warehouse/labels?kind=job&id=${j.id}`}
                          className="text-primary"
                        >
                          Etiket
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Üretim emri henüz oluşturulmadı.
              </p>
            )}
          </section>
        </>
      )}
      {tab === "recipes" && (
        <>
          <div className="flex justify-between">
            <p className="text-sm text-muted-foreground">
              Yayınlanan sürüm üretim emrinde sabitlenir.
            </p>
            {manager && (
              <button
                className="rf-primary-button"
                onClick={() => setEditor({})}
              >
                <Plus size={15} /> Reçete oluştur
              </button>
            )}
          </div>
          {editor && (
            <RecipeEditor
              key={editor.id || "new"}
              items={items}
              initial={editor.code ? editor : undefined}
              busy={busy}
              onSave={async (f) => {
                const r = await command("recipe.save", f);
                setEditor(false);
                return r;
              }}
            />
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {data.recipes.map((r: any) => (
              <article key={r.id} className="rf-panel">
                <div className="flex justify-between">
                  <div>
                    <p className="rf-eyebrow">
                      {r.code} · v{r.version}
                    </p>
                    <h2 className="mt-2 font-medium">{r.name}</h2>
                  </div>
                  <Badge value={r.status} />
                </div>
                <p className="my-4 text-xs text-muted-foreground">
                  {r.rules.length} malzeme kuralı ·{" "}
                  {r.operations.map((o: any) => o.name).join(" → ")}
                </p>
                {manager && (
                  <div className="flex gap-3">
                    <button
                      className="rf-input text-xs"
                      onClick={() =>
                        setEditor(
                          r.status === "draft"
                            ? r
                            : {
                                ...r,
                                id: "",
                                finishedItemId: r.finished_item_id,
                                version: r.version + 1,
                                editRevision: undefined,
                              },
                        )
                      }
                    >
                      {r.status === "draft" ? "Düzenle" : "Yeni sürüm hazırla"}
                    </button>
                    {r.status === "draft" && (
                      <button
                        disabled={busy}
                        className="rf-primary-button"
                        onClick={() => run("recipe.publish", { id: r.id,editRevision:r.edit_revision })}
                      >
                        Örnekleri doğrula ve yayınla
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      {tab === "cutting" && (
        <>
          <section className="rf-panel">
            <h2 className="rf-section-title mb-4">Ortak kesim havuzu</h2>
            <p className="mb-4 text-xs leading-6 text-muted-foreground">
              Seçilen siparişlerin aynı profil ve renkteki parçaları birlikte
              hesaplanır. Fiziksel çubuk ve artık stoğu kullanılır; farklı
              boylar (ör. 6 m ve 7 m) arasından parçaların en iyi doldurduğu
              boy seçilir. Dört deterministik yerleşim karşılaştırılır: en az
              yeni çubuk, sonra en az yeni malzeme, sonra en az fire. Optimum
              garantisi yoktur. Onaydan önce stok ayrılmaz; onayda çubuklar
              ayrılır, kalıcı düşüm ölçülen kesimle yapılır.
            </p>
            <div className="mb-4">
              <EstimateNotice text={cuttingEstimateNotice(data.cutting?.source)} onOpenSettings={manager ? openCuttingSettings : undefined} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {available.map((j: any) => (
                <label
                  key={j.id}
                  className="flex items-center gap-3 rounded border border-border p-3 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(j.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, j.id]
                          : selected.filter((id) => id !== j.id),
                      )
                    }
                  />
                  {j.title} · {j.configuration.bodyName}
                </label>
              ))}
            </div>
            <button
              disabled={!selected.length || busy}
              className="rf-primary-button mt-4"
              onClick={async () => {
                const r = await run("cut.preview", { workOrderIds: selected });
                if (r) setSelected([]);
              }}
            >
              Kesim planını hesapla
            </button>
          </section>
          {data.rework.some((r: any) => r.profile_status === "pending") && (
            <section className="rf-panel space-y-3">
              <h2 className="rf-section-title">Rework profil havuzu</h2>
              <p className="text-xs text-muted-foreground">
                Ek profiller ilk reçeteden ayrı kesilir. Ustanın işi, bu kesim
                gerçekleşene kadar bekler.
              </p>
              {data.rework
                .filter((r: any) => r.profile_status === "pending")
                .map((r: any) => (
                  <label
                    key={r.id}
                    className="flex items-start gap-3 rounded border border-border p-3 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRework.includes(r.id)}
                      onChange={(e) =>
                        setSelectedRework(
                          e.target.checked
                            ? [...selectedRework, r.id]
                            : selectedRework.filter((id) => id !== r.id),
                        )
                      }
                    />
                    <span>
                      {jobs.find((j: any) => j.id === r.work_order_id)?.title} ·{" "}
                      {r.reason}
                      <span className="mt-1 block text-muted-foreground">
                        {r.profile_cuts
                          .map((c: any) => `${c.quantity} × ${c.lengthMm} mm`)
                          .join(" · ")}{" "}
                        · {Number(r.profile_scrap_kg).toFixed(3)} kg kayıtlı
                        rework hurdası
                      </span>
                    </span>
                  </label>
                ))}
              <button
                className="rf-primary-button"
                disabled={busy || !selectedRework.length}
                onClick={async () => {
                  const r = await run("cut.preview", {
                    reworkIds: selectedRework,
                  });
                  if (r) setSelectedRework([]);
                }}
              >
                Rework kesimini hesapla
              </button>
            </section>
          )}
          {data.plans.map((p: any) => (
            <article key={p.id} id={"cut-plan-"+p.id} className="rf-panel space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-medium">
                    {p.rework_ids?.length
                      ? "Rework kesim paketi"
                      : "Kesim paketi"}{" "}
                    {p.id.slice(0, 8).toUpperCase()}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.work_order_ids.length} iş emri · {p.result.bars.length}{" "}
                    çubuk · %{p.result.wastePercent.toFixed(2)} fire ·{" "}
                    {p.result.reusableMm} mm kullanılabilir artık
                  </p>
                </div>
                <Badge value={p.status} />
              </div>
              <EstimateNotice text={cuttingEstimateNotice(p.result.parameterSource)} onOpenSettings={manager && p.status === "draft" ? openCuttingSettings : undefined} />
              <p className="text-[11px] text-muted-foreground">
                Kullanılan değerler: testere payı {p.parameters.kerfMm} mm ·
                tıraş {p.parameters.trimStartMm}/{p.parameters.trimEndMm} mm ·
                en kısa artık {p.parameters.minimumRemnantMm} mm
                {p.result.alternatives && <> · {p.result.alternatives.length} yerleşim karşılaştırıldı</>}
              </p>
              {p.result.unfulfilled.length > 0 && (
                <div className="text-xs text-destructive">
                  <p>
                    {p.result.unfulfilled.length} parça için uygun boy veya
                    renkte profil eksik; plan onaylanamaz.
                  </p>
                  {p.result.purchase?.lines?.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-foreground">
                      {p.result.purchase.lines.map((l: any) => (
                        <li key={l.itemId + l.color}>
                          Satın alma ihtiyacı:{" "}
                          {items.find((x: any) => x.id === l.itemId)?.name} ·{" "}
                          {l.color} · {l.bars} × {l.lengthMm} mm çubuk
                        </li>
                      ))}
                    </ul>
                  )}
                  {p.result.purchase?.tooLong?.length > 0 && (
                    <p className="mt-1">
                      {p.result.purchase.tooLong.length} parça standart boydan
                      uzun; tek çubuktan kesilemez.
                    </p>
                  )}
                </div>
              )}
              {p.result.bars.map((bar: any, i: number) => (
                <div key={bar.source.id}>
                  <div className="mb-2 flex justify-between text-[11px] text-muted-foreground">
                    <span>
                      {i + 1}.{" "}
                      {items.find((x: any) => x.id === bar.source.itemId)?.name}{" "}
                      · {bar.source.color} ·{" "}
                      {bar.source.isRemnant ? "Artık" : "Çubuk"}
                    </span>
                    <span>{bar.source.lengthMm} mm</span>
                  </div>
                  <div className="flex h-10 overflow-hidden rounded border border-border bg-muted">
                    {bar.pieces.map((piece: any, n: number) => (
                      <div
                        key={n}
                        className="flex min-w-0 items-center justify-center border-r border-background bg-primary/75 text-[10px] text-primary-foreground"
                        title={`${piece.lengthMm} mm · ${jobs.find((j: any) => j.id === piece.workOrderId)?.title}`}
                        style={{
                          width:
                            (piece.lengthMm / bar.source.lengthMm) * 100 + "%",
                        }}
                      >
                        {piece.lengthMm}
                      </div>
                    ))}
                    {bar.reusable && (
                      <div
                        className="flex min-w-0 items-center justify-center bg-emerald-500/25 text-[10px]"
                        style={{
                          width:
                            (bar.remainingMm / bar.source.lengthMm) * 100 + "%",
                        }}
                        title="Stokta tutulacak artık"
                      >
                        {bar.remainingMm}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Testere ve düzeltme dahil kayıp: {bar.lossMm} mm
                  </p>
                  {p.status === "approved" && manager && (
                    <label className="mt-2 block text-xs">
                      Ölçülen kalan boy · mm
                      <input
                        type="number"
                        min={0}
                        max={bar.remainingMm}
                        step="any"
                        className="rf-input ml-3 w-32"
                        value={measured[bar.source.id] ?? bar.remainingMm}
                        onChange={(e) =>
                          setMeasured({
                            ...measured,
                            [bar.source.id]: +e.target.value,
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {manager && p.status === "draft" && (
                  <button
                    disabled={busy || p.result.unfulfilled.length > 0}
                    className="rf-primary-button"
                    onClick={() =>
                      run("cut.approve", {
                        id: p.id,
                        version: p.version,
                        acceptEstimate: Boolean(cuttingEstimateNotice(p.result.parameterSource)),
                      })
                    }
                  >
                    {cuttingEstimateNotice(p.result.parameterSource)
                      ? "Tahmini değerlerle onayla ve profilleri ayır"
                      : "Onayla ve profilleri ayır"}
                  </button>
                )}
                {manager && p.status === "approved" && (
                  <button
                    disabled={busy}
                    className="rf-primary-button"
                    onClick={() =>
                      run("cut.complete", {
                        id: p.id,
                        version: p.version,
                        confirmed: true,
                        actualBars: p.result.bars.map((b: any) => ({
                          lotId: b.source.id,
                          remainingMm: measured[b.source.id] ?? b.remainingMm,
                        })),
                      })
                    }
                  >
                    Ölçülen kesimi kaydet ve stok işle
                  </button>
                )}
                {manager && ["draft", "approved"].includes(p.status) && (
                  <button
                    disabled={busy}
                    className="rf-input text-xs"
                    onClick={() =>
                      run("cut.cancel", { id: p.id, version: p.version })
                    }
                  >
                    Planı iptal et
                  </button>
                )}
                {p.status !== "cancelled" && (
                  <Link
                    className="rf-input text-xs"
                    href={`/production/cut-plans/${p.id}/print`}
                  >
                    Usta kesim föyü (PDF)
                  </Link>
                )}
                <Link
                  className="rf-input text-xs"
                  href={`/warehouse/labels?kind=cut&id=${p.id}`}
                >
                  Kesim paketi etiketi
                </Link>
              </div>
              {p.actual && (
                <p className="text-xs text-muted-foreground">
                  Kaydedilen hurda:{" "}
                  {p.actual.bars
                    .reduce((s: number, b: any) => s + b.weightKg, 0)
                    .toFixed(3)}{" "}
                  kg · Malzeme maliyeti{" "}
                  {p.actual.bars
                    .reduce((s: number, b: any) => s + b.cost, 0)
                    .toFixed(2)}
                </p>
              )}
            </article>
          ))}
        </>
      )}
      {tab === "planning" && (
        <>
          {manager && <PlanningResources data={data} command={command} busy={busy} />}
          <section className="rf-panel">
            <h2 className="rf-section-title mb-3">Kapasiteye göre çizelge</h2>
            <p className="mb-5 text-xs leading-6 text-muted-foreground">
              Malzemesi hazır işler; öncelik, teslim tarihi, istasyon
              kapasitesi, vardiya ve bakım aralıklarıyla planlanır. Öneri
              yönetici yayınladığında geçerli olur.
            </p>
            {manager && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  await run("schedule.preview", {
                    startsAt: new Date(String(d.get("startsAt"))+"+03:00").toISOString(),
                  });
                }}
                className="flex flex-wrap items-end gap-3"
              >
                <Field
                  name="startsAt"
                  label="Plan başlangıcı · İstanbul"
                  type="datetime-local"
                />
                <button disabled={busy} className="rf-primary-button">
                  Çizelge öner
                </button>
              </form>
            )}
          </section>
          {data.schedules.map((s: any) => (
            <section key={s.id} className="rf-panel">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-medium">
                  {new Date(s.created_at).toLocaleString("tr-TR")}{" "}
                  <Badge value={s.status} />
                </h2>
                {manager && s.status === "draft" && (
                  <button
                    disabled={busy}
                    className="rf-primary-button"
                    onClick={() => run("schedule.publish", { id: s.id })}
                  >
                    Çizelgeyi yayınla
                  </button>
                )}
              </div>
              {s.tasks.blocked.length > 0 && (
                <p className="mb-3 text-xs text-amber-600">
                  {s.tasks.blocked.length} operasyon planlanamadı: {[...new Set(s.tasks.blocked.map((o: any)=>o.blockedReason || "Malzeme hazırlığı"))].join("; ")}
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      {[
                        "İş",
                        "Operasyon",
                        "İstasyon",
                        "Başlangıç",
                        "Bitiş",
                        "Teslim",
                      ].map((v) => (
                        <th className="pb-3 font-medium" key={v}>
                          {v}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.tasks.tasks.map((o: any) => (
                      <tr key={o.id} className="border-t border-border">
                        <td className="py-3 pr-3">
                          {jobs.find((j: any) => j.id === o.workOrderId)
                            ?.title || o.workOrderId.slice(0, 8)}
                        </td>
                        <td>{ops.find((p: any) => p.id === o.id)?.name}<p className="mt-1 max-w-xs text-[10px] text-muted-foreground">{o.explanation}</p></td>
                        <td>
                          {o.workCenterCode} · {o.lane + 1}
                        </td>
                        <td>{new Date(o.start).toLocaleString("tr-TR")}</td>
                        <td>{new Date(o.end).toLocaleString("tr-TR")}</td>
                        <td className={o.late ? "text-destructive" : ""}>
                          {o.late ? "Gecikme riski" : "Plan içinde"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
      {tab === "stock" && (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            {manager && (
              <>
                <form
                  className="rf-panel space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const f = new FormData(form);
                    const d: any = Object.fromEntries(f);
                    for (const k of ["standardLengthMm", "weightPerMeterKg", "minStock", "pieceLengthMm"]) {
                      if (d[k] === "" || d[k] === undefined) delete d[k];
                      else d[k] = Number(d[k]);
                    }
                    d.processedStates = f.getAll("processedStates");
                    if (await run("material.save", d)) form.reset();
                  }}
                >
                  <h2 className="rf-section-title">Malzeme / mamul kartı</h2>
                  <p className="text-xs text-muted-foreground">
                    Kalem = profil kodu + ölçü + işlenmiş hâl. Boyalı, boyasız,
                    delikli ve hazır hâller ayrı kalemdir. Profilin rengi ve
                    boyu her çubukta (stok girişinde) tutulur; adetli
                    parçalarda parça boyu kartta.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field name="sku" label="Stok kodu" />
                    <Field name="name" label="Malzeme adı" />
                    <Field name="profileCode" label="Profil kodu (ör. 108)" required={false} />
                    <Field name="sizeLabel" label="Ölçü (ör. 40x60)" required={false} />
                    <Select
                      name="itemType"
                      label="Kart türü"
                      options={[
                        { id: "raw_material", name: "Hammadde" },
                        { id: "consumable", name: "Sarf" },
                        { id: "finished_good", name: "Mamul" },
                      ]}
                    />
                    <Select
                      name="uom"
                      label="Stok birimi"
                      options={STOCK_UNITS.map((v) => ({
                        id: v,
                        name: UNIT_LABELS[v],
                      }))}
                    />
                    <Field
                      name="standardLengthMm"
                      label="Standart profil boyu · mm"
                      type="number"
                      value={0}
                    />
                    <Field
                      name="weightPerMeterKg"
                      label="Doğrulanmış profil ağırlığı · kg/m"
                      type="number"
                      value={0}
                    />
                    <Field name="pieceLengthMm" label="Parça boyu · mm (adetli parçalar, ör. 4500)" type="number" required={false} />
                    <Field name="minStock" label="Minimum stok (stok biriminde)" type="number" value={0} />
                  </div>
                  <fieldset className="flex flex-wrap gap-3 text-xs">
                    <legend className="mb-1">İşlenmiş hâl</legend>
                    {PROCESSED_STATES.map((state) => (
                      <label key={state} className="flex items-center gap-1">
                        <input type="checkbox" name="processedStates" value={state} /> {STATE_LABELS[state]}
                      </label>
                    ))}
                  </fieldset>
                  <button disabled={busy} className="rf-primary-button">
                    Kartı oluştur
                  </button>
                </form>
                <form
                  className="rf-panel space-y-4"
                  onSubmit={submit("warehouse.save")}
                >
                  <h2 className="rf-section-title">Depo tanımı</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field name="code" label="Depo kodu" />
                    <Field name="name" label="Depo adı" />
                    <Select
                      name="type"
                      label="Depo türü"
                      options={Object.entries(WAREHOUSE_TYPE_LABELS).map(([id, name]) => ({ id, name }))}
                    />
                  </div>
                  <button disabled={busy} className="rf-primary-button">
                    Depoyu oluştur
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {warehouses
                      .map((w: any) => `${w.name || w.code} · ${warehouseTypeLabel(w.warehouse_type)}`)
                      .join(" / ")}
                  </p>
                </form>
                <form
                  className="rf-panel space-y-4"
                  onSubmit={submit("stock.receive", [
                    "quantity",
                    "lengthMm",
                    "unitCost",
                  ])}
                >
                  <h2 className="rf-section-title">Fiziksel stok girişi</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select
                      name="itemId"
                      label="Malzeme"
                      options={items.filter(
                        (i: any) => i.item_type !== "finished_good",
                      )}
                    />
                    <Select
                      name="warehouseId"
                      label="Kabul deposu"
                      options={warehouses.filter(
                        (w: any) => w.warehouse_type === "RAW",
                      )}
                    />
                    <Field name="lotNumber" label="Lot / irsaliye kodu" />
                    <Field
                      name="quantity"
                      label="Profil çubuk adedi / diğer stok miktarı"
                      type="number"
                    />
                    <Field
                      name="lengthMm"
                      label="Profil boyu · mm (diğerlerinde 0)"
                      type="number"
                      value={0}
                    />
                    <Field
                      name="color"
                      label="Profil rengi · profilde zorunlu (boyasız için Boyasız), 3D seçim adıyla aynı"
                      required={false}
                    />
                    <Field
                      name="unitCost"
                      label="Birim maliyet · profilde metre fiyatı"
                      type="number"
                    />
                  </div>
                  <label className="block text-xs">Maliyet para birimi<select name="currency" className="rf-input mt-2 w-full">{["TRY","EUR","USD","GBP"].map(c=><option key={c}>{c}</option>)}</select></label>
                  <button disabled={busy} className="rf-primary-button">
                    Stok girişini kaydet
                  </button>
                </form>
                <form
                  id="cutting-settings"
                  className="rf-panel space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const d: any = Object.fromEntries(f);
                    [
                      "kerfMm",
                      "trimStartMm",
                      "trimEndMm",
                      "minimumRemnantMm",
                      "standardLengthMm",
                    ].forEach((k) => {
                      if (k in d) d[k] = +d[k];
                    });
                    d.cuttingConfirmed = f.has("cuttingConfirmed");
                    d.emailEnabled = f.has("emailEnabled");
                    d.whatsappEnabled = f.has("whatsappEnabled");
                    await run("preferences.save", d);
                  }}
                >
                  <h2 className="rf-section-title">
                    Kesim ve iletişim ayarları
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["kerfMm", "Testere payı · mm", "kerf_mm"],
                      ["trimStartMm", "Baş düzeltme · mm", "trim_start_mm"],
                      ["trimEndMm", "Son düzeltme · mm", "trim_end_mm"],
                      [
                        "minimumRemnantMm",
                        "En kısa kullanılabilir artık · mm",
                        "minimum_remnant_mm",
                      ],
                      ...(data.cutting?.standardLengthEditable
                        ? [["standardLengthMm", "Standart çubuk boyu · mm", "standard_length_mm"]]
                        : []),
                    ].map(([name, label]) => (
                      <Field
                        key={name}
                        name={name}
                        label={label}
                        type="number"
                        value={data.cutting?.parameters?.[name] ?? ""}
                      />
                    ))}
                  </div>
                  <EstimateNotice text={cuttingEstimateNotice(data.cutting?.source)} />
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Varsayılan değerler</summary>
                    <p className="mt-2">
                      Atölye değerleri girilip doğrulanana kadar bunlar
                      kullanılır: testere payı {data.cutting?.defaults?.kerfMm} mm ·
                      baş/son tıraş {data.cutting?.defaults?.trimStartMm}/
                      {data.cutting?.defaults?.trimEndMm} mm · en kısa artık{" "}
                      {data.cutting?.defaults?.minimumRemnantMm} mm · standart
                      boy {data.cutting?.defaults?.standardLengthMm} mm. Ölçüme
                      dayanmazlar; bu değerlerle yapılan planlar tahmini diye
                      işaretlenir. Profil kartındaki standart boy, firmanın
                      standart boyundan önce gelir.
                    </p>
                  </details>
                  <label className="flex gap-2 text-xs">
                    <input name="cuttingConfirmed" type="checkbox" />{" "}
                    Bu kesim değerlerini gerçek ekipman ve malzemeyle
                    doğruladım. (İşaretlenmezse değerler kaydedilir; daha önce
                    doğrulanmış değerler değişmediyse doğrulama korunur, aksi
                    hâlde planlar tahmini diye işaretlenir.)
                  </label>
                  <label className="flex gap-2 text-xs">
                    <input
                      name="emailEnabled"
                      type="checkbox"
                      defaultChecked={data.preferences?.email_enabled}
                    />{" "}
                    Müşteriye e-posta durum bildirimi
                  </label>
                  <label className="flex gap-2 text-xs">
                    <input
                      name="whatsappEnabled"
                      type="checkbox"
                      defaultChecked={data.preferences?.whatsapp_enabled}
                    />{" "}
                    WhatsApp durum bildirimi
                  </label>
                  <Field
                    name="whatsappTemplate"
                    label="Meta onaylı şablon adı"
                    required={false}
                    value={data.preferences?.whatsapp_template || ""}
                  />
                  <button disabled={busy} className="rf-primary-button">
                    Ayarları kaydet
                  </button>
                </form>
                <form
                  className="rf-panel space-y-4 xl:col-span-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget),
                      d: any = Object.fromEntries(f);
                    d.parallelCapacity = +d.parallelCapacity;
                    const existing=data.centers.find((c: any)=>c.code===d.code);
                    d.revision=existing?.revision;
                    d.machineRequired=existing?.machine_required || false;d.teamRequired=existing?.team_required || false;
                    d.workDays = String(d.workDays).split(",").map(Number);
                    d.maintenance =
                      d.maintenanceStart && d.maintenanceEnd
                        ? [
                            {
                              start: new Date(d.maintenanceStart).toISOString(),
                              end: new Date(d.maintenanceEnd).toISOString(),
                            },
                          ]
                        : [];
                    await run("center.save", d);
                  }}
                >
                  <h2 className="rf-section-title">İş merkezi ve vardiya</h2>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field
                      name="code"
                      label="Merkez kodu · CUT, DRILL, ASSEMBLY, QC, PACK"
                    />
                    <Field name="name" label="İş merkezi adı" />
                    <Field
                      name="parallelCapacity"
                      label="Eşzamanlı istasyon sayısı"
                      type="number"
                      value={1}
                    />
                    <Field
                      name="shiftStart"
                      label="Vardiya başlangıcı"
                      type="time"
                      value="08:00"
                    />
                    <Field
                      name="shiftEnd"
                      label="Vardiya bitişi"
                      type="time"
                      value="17:00"
                    />
                    <Field
                      name="workDays"
                      label="Çalışma günleri · Pzt=1, Pazar=0"
                      value="1,2,3,4,5"
                    />
                    <Field
                      name="maintenanceStart"
                      label="Bakım başlangıcı · isteğe bağlı"
                      type="datetime-local"
                      required={false}
                    />
                    <Field
                      name="maintenanceEnd"
                      label="Bakım bitişi · isteğe bağlı"
                      type="datetime-local"
                      required={false}
                    />
                  </div>
                  <button disabled={busy} className="rf-primary-button">
                    Merkezi kaydet / güncelle
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {data.centers
                      .map(
                        (c: any) =>
                          `${c.code} · ${c.parallel_capacity} istasyon · ${c.shift_start}–${c.shift_end}`,
                      )
                      .join(" / ")}
                  </p>
                </form>
              </>
            )}
          </div>
          <section className="rf-panel overflow-x-auto">
            <h2 className="rf-section-title mb-4">
              Kullanılabilir profiller ve artık lotları
            </h2>
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  {["Malzeme", "Lot", "Renk", "Kalan boy", "Durum", ""].map(
                    (v, i) => (
                      <th key={i} className="pb-3 font-medium">
                        {v}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.lots
                  .filter((l: any) => Number(l.remaining_qty) > 0)
                  .map((l: any) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="py-3">{l.name}</td>
                      <td>
                        {l.lot_number}
                        {l.metadata.isRemnant ? " · Artık" : ""}
                      </td>
                      <td>{l.metadata.color}</td>
                      <td>{Number(l.remaining_qty) * 1000} mm</td>
                      <td>
                        {l.status === "reserved" ? "Rezerve" : "Kullanılabilir"}
                      </td>
                      <td>
                        <Link
                          href={`/warehouse/labels?kind=lot&id=${l.id}`}
                          className="text-primary"
                        >
                          Etiket
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
          <section className="rf-panel">
            <h2 className="rf-section-title mb-4">Depo bakiyeleri</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {data.balances.map((b: any) => (
                <p
                  key={b.item_id + b.warehouse_id}
                  className="rounded border border-border p-3 text-xs"
                >
                  {items.find((i: any) => i.id === b.item_id)?.name}
                  <span className="mt-2 block text-muted-foreground">
                    {warehouses.find((w: any) => w.id === b.warehouse_id)?.code}{" "}
                    · {b.on_hand_qty}{" "}
                    {items.find((i: any) => i.id === b.item_id)?.stock_uom}
                  </span>
                </p>
              ))}
            </div>
          </section>
        </>
      )}
      {tab === "stock" && manager && (
        <section className="rf-panel space-y-4">
          <h2 className="rf-section-title">Onaylı stok düzeltmesi</h2>
          <label className="block text-xs">
            Düzeltme gerekçesi
            <input
              className="rf-input mt-2 w-full"
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="İrsaliye veya ölçü kaydındaki hatayı belirtin"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Tüketilmemiş giriş geri alınırken asıl kayıt korunur ve ters kayıt
            oluşturulur. Doğru değerlerle yeni stok girişi yapın.
          </p>
          {data.stockEntries
            ?.filter((s: any) => s.entry_type === "MATERIAL_RECEIPT")
            .map((s: any) => (
              <div
                key={s.id}
                className="flex items-center justify-between border-t border-border pt-3 text-xs"
              >
                <span>
                  {s.entry_number} ·{" "}
                  {new Date(s.created_at).toLocaleString("tr-TR")}
                </span>
                <button
                  disabled={busy || correctionReason.trim().length < 5}
                  className="text-destructive"
                  onClick={() =>
                    run("stock.reverse", { id: s.id, reason: correctionReason })
                  }
                >
                  Girişi ters kayıtla düzelt
                </button>
              </div>
            ))}
        </section>
      )}
      {tab === "intake" && (
        <>
          <section className="rf-panel">
            <h2 className="rf-section-title">Belgeden sipariş taslağı</h2>
            <p className="my-3 text-xs leading-6 text-muted-foreground">
              PDF, çizim veya fotoğraftaki yazılı alanlar GPT-6 Luna ile
              çıkarılır. Belirsiz değerler kontrol ekranında görünür. Sipariş
              yalnız sizin onayınızla oluşur.
            </p>
            <label className="rf-primary-button inline-flex cursor-pointer">
              {uploadBusy ? "Belge inceleniyor…" : "PDF / çizim yükle"}
              <input
                disabled={uploadBusy}
                className="sr-only"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadBusy(true);
                  setLocalError("");
                  try {
                    const r = await fetch("/api/v1/production/intake", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(await prepareFileUpload(await fileData(file))),
                    });
                    const body = await r.json();
                    if (!r.ok) throw new Error(body.error);
                    window.location.assign(
                      `/production/intake/${body.data.id}`,
                    );
                  } catch (e) {
                    setLocalError(
                      e instanceof Error ? e.message : "Belge okunamadı",
                    );
                  } finally {
                    setUploadBusy(false);
                  }
                }}
              />
            </label>
          </section>
          {data.drafts.map((d: any) => (
            <Link
              key={d.id}
              href={`/production/intake/${d.id}`}
              className="rf-panel flex items-center justify-between"
            >
              <div>
                <h2 className="text-sm font-medium">
                  {d.extracted_data.customerName || "Müşteri kontrol edilmeli"}
                </h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {d.source} · {d.extracted_data.items?.length || 0} kalem ·{" "}
                  {new Date(d.created_at).toLocaleString("tr-TR")}
                </p>
              </div>
              <Badge value={d.status} />
            </Link>
          ))}
        </>
      )}
      {tab === "communication" && (
        <>
          <section className="rf-panel">
            <h2 className="rf-section-title mb-4">Müşteri takip bağlantısı</h2>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={submit("tracking.create", [], (r) =>
                setTrackingPath(r.path),
              )}
            >
              <Select
                name="orderId"
                label="Sipariş"
                options={[
                  ...new Map<string, { id: string; name: string }>(
                    data.orders.map((o: any) => [
                      o.order_id,
                      {
                        id: o.order_id,
                        name: `${o.order_number} · ${o.customer_name}`,
                      },
                    ]),
                  ).values(),
                ]}
              />
              <button className="rf-primary-button" disabled={busy}>
                90 günlük takip bağlantısı oluştur
              </button>
            </form>
            {trackingPath && (
              <div className="mt-4 flex flex-wrap gap-3 rounded bg-muted p-3 text-xs">
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={trackingPath}
                  className="text-primary"
                >
                  {typeof window !== "undefined" ? window.location.origin : ""}
                  {trackingPath}
                </a>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(
                      window.location.origin + trackingPath,
                    )
                  }
                >
                  Bağlantıyı kopyala
                </button>
              </div>
            )}
            <div className="mt-5 space-y-2">
              {data.tracking.map((l: any) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between border-t border-border pt-3 text-xs"
                >
                  <span>
                    {l.order_id.slice(0, 8)} ·{" "}
                    {new Date(l.expires_at).toLocaleDateString("tr-TR")} ·{" "}
                    {l.revoked_at ? "İptal edildi" : "Aktif"}
                  </span>
                  {!l.revoked_at && (
                    <button
                      disabled={busy}
                      className="text-destructive"
                      onClick={() => run("tracking.revoke", { id: l.id })}
                    >
                      Bağlantıyı iptal et
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
          <section className="rf-panel">
            <h2 className="rf-section-title mb-4">Kısmi veya tam sevkiyat</h2>
            <form
              onSubmit={submit("shipment.create", ["quantity"])}
              className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5"
            >
              <Select
                name="workOrderId"
                label="Paketlenmiş üretim"
                options={jobs
                  .filter((j: any) => Number(j.produced_qty) > 0)
                  .map((j: any) => ({
                    id: j.id,
                    name: `${j.title} · ${j.produced_qty} paketlendi`,
                  }))}
              />
              <Field name="quantity" label="Sevk adedi" type="number" />
              <Field name="carrier" label="Taşıyıcı" required={false} />
              <Field
                name="trackingNumber"
                label="Takip numarası"
                required={false}
              />
              <button className="rf-primary-button" disabled={busy}>
                Sevkiyatı kaydet
              </button>
            </form>
          </section>
          <section className="rf-panel space-y-3">
            <h2 className="rf-section-title">Sevkiyat ve teslimat kayıtları</h2>
            {data.shipments.map((s: any) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs"
              >
                <span>
                  {jobs.find((j: any) => j.id === s.work_order_id)?.title} ·{" "}
                  {s.quantity} adet · {s.carrier} {s.tracking_number}
                </span>
                {s.status === "delivered" ? (
                  <span className="text-emerald-600">Teslim edildi</span>
                ) : (
                  <button
                    disabled={busy}
                    className="text-primary"
                    onClick={() =>
                      run("shipment.delivered", {
                        id: s.id,
                        version: s.version,
                      })
                    }
                  >
                    Teslimatı kaydet
                  </button>
                )}
              </div>
            ))}
          </section>
          <section className="rf-panel">
            <h2 className="rf-section-title mb-3">
              Bildirim kuyruğu ve teslimat geçmişi
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              E-posta:{" "}
              {data.providers.email
                ? "Sağlayıcı yapılandırılmış"
                : "Resend anahtarı gerekli"}{" "}
              · WhatsApp:{" "}
              {data.providers.whatsapp
                ? "Sağlayıcı yapılandırılmış"
                : "Meta erişim bilgileri gerekli"}
              . Kanal ayarları malzeme ve kapasite bölümündedir.
            </p>
            <div className="space-y-3">
              {data.notifications.map((n: any) => (
                <div
                  key={n.id}
                  className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs"
                >
                  <span className="mr-auto">
                    {n.payload.orderNumber} · {n.channel} · {n.recipient}
                    <span className="mt-1 block text-muted-foreground">
                      {n.payload.status} · {n.attempts} deneme{" "}
                      {n.last_error && "· " + n.last_error}
                    </span>
                  </span>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-primary">
                      Deneme geçmişi
                    </summary>
                    <div className="mt-2 space-y-2">
                      {data.notificationAttempts
                        .filter(
                          (attempt: any) => attempt.notification_id === n.id,
                        )
                        .map((attempt: any) => (
                          <p key={attempt.id}>
                            {new Date(attempt.created_at).toLocaleString(
                              "tr-TR",
                            )}{" "}
                            · {attempt.attempt}. deneme ·{" "}
                            {status[attempt.status] || attempt.status}{" "}
                            {attempt.error && "· " + attempt.error}
                          </p>
                        ))}
                    </div>
                  </details>
                  <Badge value={n.status} />
                  {manager && ["failed", "uncertain"].includes(n.status) && (
                    <button
                      disabled={busy}
                      className="text-primary"
                      onClick={() => run("notification.retry", { id: n.id })}
                    >
                      {n.status === "uncertain"
                        ? "Sağlayıcıyı kontrol ettim · yeniden dene"
                        : "Yeniden dene"}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">
                Gelen e-posta / WhatsApp işleme durumu
              </h3>
              {data.inboundMessages?.map((message: any) => (
                <div
                  key={message.id}
                  className="flex flex-wrap items-center gap-3 text-xs"
                >
                  <span className="mr-auto">
                    {message.provider} ·{" "}
                    {new Date(message.created_at).toLocaleString("tr-TR")} ·{" "}
                    {message.attempts} deneme
                    {message.last_error && (
                      <span className="mt-1 block text-destructive">
                        {message.last_error}
                      </span>
                    )}
                  </span>
                  <Badge value={message.status} />
                  {message.draft_id && (
                    <Link
                      className="text-primary"
                      href={`/production/intake/${message.draft_id}`}
                    >
                      Taslağı incele
                    </Link>
                  )}
                  {manager && message.status === "failed" && (
                    <button
                      className="text-primary"
                      disabled={busy}
                      onClick={() => run("inbound.retry", { id: message.id })}
                    >
                      Yeniden işle
                    </button>
                  )}
                </div>
              ))}
              {!data.inboundMessages?.length && (
                <p className="text-xs text-muted-foreground">
                  Henüz gelen içerik yok.
                </p>
              )}
            </div>
            {!data.notifications.length && (
              <p className="text-sm text-muted-foreground">
                Henüz bildirim yok.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
