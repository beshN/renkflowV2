"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  Check,
  WifiOff,
  RotateCcw,
  Camera,
  Clock,
} from "lucide-react";
import { useProduction } from "./useProduction";
import BarcodeScanner from "@/components/features/warehouse/BarcodeScanner";
import {ReworkCases} from "./QualityIntelligence";
import { QualityChecklist } from "./QualityChecklist";
import { AwningDialog } from "@/components/features/awning/AwningConfigurator";
import { awningSummary } from "@/lib/features/awning/configuration";
import {
  discardOperation,
  fileData,
} from "@/lib/features/manufacturing/offline";
const names: Record<string, string> = {
  ready: "İşe hazır",
  waiting: "Önceki aşama bekleniyor",
  running: "Çalışıyor",
  paused: "Duraklatıldı",
  blocked: "Sorun bekliyor",
  done: "Tamamlandı",
};
export default function FactoryWorkspace() {
  const { data, error, command, operate, queueCommand, pending, scope, sync, refresh } =
      useProduction(),
    [quality, setQuality] = useState<Record<string, Record<string, string>>>({}),
    [selected, setSelected] = useState(""),
    [scanResult, setScanResult] = useState<any>(null),
    [note, setNote] = useState(""),
    [quantity, setQuantity] = useState(1),
    [rootCause,setRootCause]=useState(""),
    [reasonCode, setReasonCode] = useState("quality"),
    [target, setTarget] = useState(""),
    [photos, setPhotos] = useState<File[]>([]),
    [localError, setLocalError] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("active"),
    [extra, setExtra] = useState<any[]>([]),
    fromQr = useRef(false);
  useEffect(() => {
    if (!data || fromQr.current) return;
    const query = new URLSearchParams(window.location.search);
    const id = query.get("job");
    if (query.get("code")) void scan(query.get("code")!);
    if (id) {
      const first =
        data.operations.find(
          (o: any) => o.work_order_id === id && o.status !== "done",
        ) || data.operations.find((o: any) => o.work_order_id === id);
      if (first) {
        setSelected(first.id);
        setTarget(first.id);
        setFilter("all");
      }
    }
    fromQr.current = true;
  }, [data]);
  if (!data)
    return (
      <div className="rf-page">
        <p role={error ? "alert" : "status"}>
          {error || "Atanan işler yükleniyor…"}
        </p>
        <button onClick={refresh} className="rf-input mt-4">
          Tekrar dene
        </button>
      </div>
    );
  const jobs = data.jobs.filter(
      (j: any) => filter === "all" || !["done", "cancelled"].includes(j.status),
    ),
    ops = data.operations,
    op = ops.find((o: any) => o.id === selected),
    job = data.jobs.find((j: any) => j.id === op?.work_order_id),
    canOperate =
      data.actor.role !== "worker" || op?.assigned_to === data.actor.userId,
    hasPending = (id: string) => pending.some((p) => p.data.operationId === id);
  async function scan(code: string) {
    setLocalError("");
    try {
      const response = await fetch(
        "/api/v1/production/scan?code=" + encodeURIComponent(code),
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setScanResult(result.data);
      if (result.data.workOrderId) {
        setFilter("all");
        const operation =
          ops.find(
            (o: any) =>
              o.work_order_id === result.data.workOrderId &&
              o.status !== "done",
          ) ||
          ops.find((o: any) => o.work_order_id === result.data.workOrderId);
        if (operation) {
          setSelected(operation.id);
          setNote("");setPhotos([]);setExtra([]);setRootCause("");
          setQuantity(
            Math.max(
              1,
              Number(operation.planned_qty) - Number(operation.completed_qty),
            ),
          );
        }
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Etiket okunamadı");
    }
  }
  async function send(action: string) {
    if (!op || !canOperate) return;
    setBusy(true);
    setLocalError("");
    try {
      const files = await Promise.all(
        photos.map(async (f) => ({
          ...(await fileData(f)),
          workOrderId: op.work_order_id,
        })),
      );
      await operate(
        {
          operationId: op.id,
          version: op.version,
          action,
          quantity:
            action === "complete" || action === "rework" ? quantity : undefined,
          reason: note || undefined,
          reasonCode: action === "rework" ? reasonCode : undefined,
          rootCause:action==="rework"?rootCause || undefined:undefined,
          targetOperationId: action === "rework" ? target : undefined,
          qualityResults: action === "complete" ? (op.quality_checks || []).map((check: any) => {
            const value = quality[op.id + ":" + op.attempt]?.[check.id];
            return { checkId: check.id, passed: check.kind === "pass_fail" && value ? value === "pass" : undefined, value: check.kind === "measurement" && value !== undefined && value !== "" ? Number(value) : undefined };
          }) : [],
          photos: [],
          additionalMaterials: action==="rework"?extra.filter((m) => m.itemId && m.quantity > 0):[],
        },
        files,
      );
      setQuality(current => ({ ...current, [op.id + ":" + op.attempt]: {} }));
      setNote("");
      setPhotos([]);
      setExtra([]);
      setRootCause("");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "İşlem sıraya alınamadı");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rf-page space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="rf-eyebrow">RENK ALÜMİNYUM / SAHA</p>
          <h1 className="rf-page-title">Usta ekranı</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.actor.role === "worker"
              ? "Size atanan işler ve teknik bilgiler"
              : "Üretimdeki işleri teknik görünümde inceleyin"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rf-input text-xs"
            onClick={() => setFilter(filter === "active" ? "all" : "active")}
          >
            {filter === "active"
              ? "Tamamlananları göster"
              : "Aktif işleri göster"}
          </button>
          <Link href="/warehouse/scan" className="rf-secondary-button">QR terminali</Link>
          <button className="rf-primary-button" onClick={sync}>
            Eşitle
          </button>
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-4 text-xs">
          <WifiOff size={16} />{" "}
          {navigator.onLine
            ? error
            : "Çevrim dışısınız. Son eşitlenen işler gösteriliyor; işlemler cihazda bekletilecek."}
        </div>
      )}
      {pending.length > 0 && (
        <section className="rf-panel border-amber-500/30">
          <h2 className="text-sm font-medium">
            {pending.length} işlem sunucu onayı bekliyor
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Sunucu kabul edene kadar bu işlemler üretim kaydına işlenmiş
            sayılmaz.
          </p>
          {pending.map((p) => (
            <div
              key={p.commandId}
              className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs"
            >
              <span className="mr-auto">
                {ops.find((o: any) => o.id === p.data.operationId)?.name} ·{" "}
                {String(p.data.action)} ·{" "}
                {p.status === "conflict"
                  ? "Çakışma: " + p.error
                  : "Cihazda sırada"}
              </span>
              {p.status === "conflict" && (
                <button
                  className="text-primary"
                  onClick={async () => {
                    await discardOperation(scope, p.commandId);
                    await sync();
                  }}
                >
                  Güncel kaydı kullan · bekleyen talebi kaldır
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      <ReworkCases cases={data.rework.filter((r:any)=>data.actor.role!=="worker" || ops.some((o:any)=>o.work_order_id===r.work_order_id && o.assigned_to===data.actor.userId))} operations={ops} jobs={data.jobs} pendingIds={pending.filter(p=>p.action==="rework.resolve").map(p=>String(p.data.id))} onResolve={payload=>queueCommand("rework.resolve",payload)} />
      <section className="rf-panel space-y-3">
        <BarcodeScanner onScan={code => void scan(code)} busy={busy} />
        {scanResult && (
          <div className="rounded border border-border p-3">
            <h2 className="text-sm font-semibold">{scanResult.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {scanResult.summary || scanResult.subtitle}
            </p>
            {scanResult.bars?.map((b: any, i: number) => (
              <p key={i} className="mt-2 text-xs">
                {i + 1}. {b.color} · {b.lengthMm} mm →{" "}
                {b.pieces.map((p: any) => p.lengthMm + " mm").join(" + ")} ·
                Kalan {b.remainingMm} mm
              </p>
            ))}
          </div>
        )}
        {localError && !op && (
          <p role="alert" className="text-xs text-destructive">
            {localError}
          </p>
        )}
      </section>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <section className="space-y-4">
          {jobs.map((j: any) => (
            <article key={j.id} className="rf-panel space-y-4">
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{j.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[j.order_number, j.customer_name].filter(Boolean).join(" · ")} · {Number(j.planned_qty)} adet ·{" "}
                    {j.due_at
                      ? new Date(j.due_at).toLocaleDateString("tr-TR")
                      : "Teslim tarihi girilmedi"}
                  </p>
                </div>
                <Link
                  href={`/production/labels?kind=job&id=${j.id}`}
                  className="text-xs text-primary"
                >
                  QR etiketi
                </Link>
              </div>
              {j.configuration?.version === 1 && (
                <div className="rounded bg-muted p-3">
                  <p className="text-xs leading-6">
                    {awningSummary(j.configuration)}
                  </p>
                  <div className="mt-3">
                    <AwningDialog
                      configuration={j.configuration}
                      previewImage={j.bom_snapshot?.preview}
                      readOnly
                      label="Teknik 3D görünüm"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {ops
                  .filter((o: any) => o.work_order_id === j.id)
                  .map((o: any) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setSelected(o.id);
                        setExtra([]);setRootCause("");
                        setQuantity(
                          Math.max(
                            1,
                            Number(o.planned_qty) - Number(o.completed_qty),
                          ),
                        );
                        setNote("");
                        setPhotos([]);
                        setTarget(o.id);
                      }}
                      className={`flex w-full items-center gap-3 rounded border p-4 text-left ${selected === o.id ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${o.status === "done" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}
                      >
                        {o.status === "done" ? (
                          <Check size={18} />
                        ) : (
                          o.position + 1
                        )}
                      </span>
                      <span className="mr-auto">
                        <span className="block text-sm font-semibold">
                          {o.name}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {hasPending(o.id)
                            ? "Sunucu onayı bekliyor"
                            : names[o.status]}{" "}
                          · {Number(o.completed_qty)}/{Number(o.planned_qty)}{" "}
                          adet
                        </span>
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {Math.floor(Number(o.active_seconds) / 60)} dk
                      </span>
                    </button>
                  ))}
              </div>
            </article>
          ))}
          {!jobs.length && (
            <section className="rf-panel text-sm text-muted-foreground">
              Bu görünümde atanmış iş yok.
            </section>
          )}
        </section>
        <section className="rf-panel space-y-5 lg:sticky lg:top-24">
          {!op ? (
            <p className="text-sm text-muted-foreground">
              İşlem yapmak için bir operasyon seçin.
            </p>
          ) : (
            <>
              <div>
                <p className="rf-eyebrow">{job?.title}</p>
                <h2 className="mt-2 text-xl font-semibold">{op.name}</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {names[op.status]} · Deneme {op.attempt} · Kayıt sürümü{" "}
                  {op.version}
                </p>
              </div>
              {data.rework.some(
                (r: any) =>
                  r.work_order_id === job?.id &&
                  ["pending", "approved"].includes(r.profile_status),
              ) && (
                <p
                  role="status"
                  className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs"
                >
                  Ek rework profilleri kesim onayı bekliyor. Kesim tamamlanınca
                  iş yeniden başlatılabilir.
                </p>
              )}
              {data.actor.role !== "worker" &&
                !["running", "done", "cancelled"].includes(op.status) && (
                  <label className="block text-xs">
                    Operasyon çalışanı
                    <select
                      className="rf-input mt-2 w-full"
                      value={op.assigned_to || ""}
                      onChange={async (e) => {
                        try {
                          await command("operation.assign", {
                            operationId: op.id,
                            version: op.version,
                            assignedTo: e.target.value,
                          });
                        } catch (err) {
                          setLocalError(
                            err instanceof Error ? err.message : "Atanamadı",
                          );
                        }
                      }}
                    >
                      {data.members
                        ?.filter((m: any) =>
                          ["owner", "admin", "office", "worker"].includes(
                            m.role,
                          ),
                        )
                        .map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.name || m.email}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded bg-muted p-3">
                  <Clock size={15} />
                  <p className="mt-2 text-sm">
                    {Math.floor(Number(op.active_seconds) / 60)} dk kayıtlı
                    çalışma
                  </p>
                </div>
                <div className="rounded bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Üretim</p>
                  <p className="mt-2 text-xl tabular-nums">
                    {Number(op.completed_qty)}/{Number(op.planned_qty)}
                  </p>
                </div>
              </div>
              {localError && (
                <p role="alert" className="text-sm text-destructive">
                  {localError}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {["ready", "paused", "blocked"].includes(op.status) && (
                  <button
                    disabled={busy || !canOperate || hasPending(op.id)}
                    className="rf-primary-button min-h-14 justify-center"
                    onClick={() => send("start")}
                  >
                    <Play size={18} /> Başlat
                  </button>
                )}
                {op.status === "running" && (
                  <button
                    disabled={busy || !canOperate || hasPending(op.id)}
                    className="rf-input min-h-14"
                    onClick={() => send("pause")}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Pause size={18} /> Duraklat
                    </span>
                  </button>
                )}
              </div>
              <QualityChecklist checks={op.quality_checks || []} values={quality[op.id + ":" + op.attempt] || {}} disabled={busy || !canOperate || hasPending(op.id)} onChange={(id, value) => setQuality(current => ({ ...current, [op.id + ":" + op.attempt]: { ...current[op.id + ":" + op.attempt], [id]: value } }))} />
              {(data.qualityInspections || []).filter((q: any) => q.operation_id === op.id).length > 0 && <details className="rounded border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Kalite kontrol geçmişi</summary><div className="mt-3 space-y-3">{(data.qualityInspections || []).filter((q: any) => q.operation_id === op.id).slice(0, 10).map((q: any) => <div key={q.id} className="border-t border-border pt-2 text-xs"><p className={q.passed ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{q.passed ? 'Geçti' : 'Kaldı · sonraki aşama engellendi'} · {Number(q.quantity)} adet · Deneme {q.attempt}</p><p className="mt-1 text-muted-foreground">{q.inspector_name} · {new Date(q.created_at).toLocaleString('tr-TR')}</p>{q.context?.recipeVersion && <p className="mt-1 text-muted-foreground">Reçete {q.context.recipeCode} v{q.context.recipeVersion} · İş merkezi {q.context.workCenterCode} · {q.context.traceability==='linked'?'Malzeme izleri bağlı':'Malzeme izi eksik'}</p>}{(q.context?.materialLots || []).map((l:any,index:number)=><p key={index} className="mt-1 text-muted-foreground">{l.lotNumber || (l.lotId?'Lot '+l.lotId.slice(0,8):'Lot bilgisi yok')} · {Number(l.quantity).toLocaleString('tr-TR')} {l.uom}{l.cutBatchId?' · Kesim '+l.cutBatchId.slice(0,8):''}</p>)}{q.results.map((r: any) => <p key={r.id} className="mt-1">{r.name}: {r.value !== undefined ? r.value + ' ' + r.unit + ' · ' : ''}{r.passed ? 'Geçti' : 'Kaldı'}</p>)}</div>)}</div></details>}
              <label className="block text-xs">
                Tamamlanan / yeniden işlenecek adet
                <input
                  className="rf-input mt-2 w-full"
                  type="number"
                  min={1}
                  max={Number(op.planned_qty)}
                  value={quantity}
                  onChange={(e) => setQuantity(+e.target.value)}
                />
              </label>
              {op.status === "running" && (
                <button
                  disabled={busy || !canOperate || hasPending(op.id)}
                  className="rf-primary-button min-h-14 w-full justify-center"
                  onClick={() => send("complete")}
                >
                  <Check size={18} /> {quantity} adet tamamlandı
                </button>
              )}
              <label className="block text-xs">
                İş notu / sorun açıklaması
                <textarea
                  className="rf-input mt-2 min-h-24 w-full"
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded border border-dashed border-border p-3 text-xs">
                <Camera size={18} />{" "}
                {photos.length
                  ? photos.map((f) => f.name).join(", ")
                  : "Fotoğraf ekle"}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(e) =>
                    setPhotos(Array.from(e.target.files || []).slice(0, 6))
                  }
                />
              </label>
              <button
                disabled={
                  busy ||
                  !canOperate ||
                  hasPending(op.id) ||
                  (!note && !photos.length)
                }
                className="rf-input w-full text-sm"
                onClick={() => send("note")}
              >
                Notu ve fotoğrafı kaydet
              </button>
              <details className="border-t border-border pt-4">
                <summary className="cursor-pointer text-sm font-medium">
                  İmalatta sorun çıktı · yeniden işlem
                </summary>
                <div className="mt-4 space-y-3">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Etkilenen adet ve gerekçeyi girin. Seçilen aşama ve sonraki
                    aşamalar yeniden açılır; önceki kayıtlar geçmişte korunur.
                  </p>
                  <label className="block text-xs">Kök neden adayı · isteğe bağlı<textarea className="rf-input mt-2 w-full" value={rootCause} onChange={e=>setRootCause(e.target.value)} /></label>
                  <label className="block text-xs">
                    Sorun türü
                    <select
                      className="rf-input mt-2 w-full"
                      value={reasonCode}
                      onChange={(e) => setReasonCode(e.target.value)}
                    >
                      {[
                        ["measurement", "Ölçü"],
                        ["material", "Malzeme"],
                        ["assembly", "Montaj"],
                        ["quality", "Kalite"],
                        ["other", "Diğer"],
                      ].map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs">
                    Geri dönülecek aşama
                    <select
                      className="rf-input mt-2 w-full"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                    >
                      {ops
                        .filter(
                          (o: any) =>
                            o.work_order_id === op.work_order_id &&
                            o.position <= op.position,
                        )
                        .map((o: any) => (
                          <option value={o.id} key={o.id}>
                            {o.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="space-y-2">
                    <p className="text-xs">
                      Ek malzeme ve hurda · isteğe bağlı
                    </p>
                    {extra.map((m: any, i: number) => (
                      <div
                        key={i}
                        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                      >
                        <select
                          aria-label={`Rework malzemesi ${i + 1}`}
                          className="rf-input text-xs"
                          value={m.itemId}
                          onChange={(e) =>
                            setExtra(
                              extra.map((v: any, n: number) =>
                                n === i ? { ...v, itemId: e.target.value } : v,
                              ),
                            )
                          }
                        >
                          <option value="">Malzeme</option>
                          {data.materialCards?.map((v: any) => (
                            <option key={v.id} value={v.id}>
                              {v.name} · {v.stock_uom}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label={`Ek miktar ${i + 1}`}
                          title={
                            data.materialCards.find(
                              (c: any) => c.id === m.itemId,
                            )?.stock_uom === "m"
                              ? "Kesilecek parça adedi"
                              : "Ek malzeme miktarı"
                          }
                          className="rf-input"
                          min={0}
                          step="any"
                          type="number"
                          value={m.quantity}
                          onChange={(e) =>
                            setExtra(
                              extra.map((v: any, n: number) =>
                                n === i
                                  ? { ...v, quantity: +e.target.value }
                                  : v,
                              ),
                            )
                          }
                        />
                        <input
                          aria-label={`Ek hurda ${i + 1}`}
                          className="rf-input"
                          min={0}
                          step="any"
                          type="number"
                          value={m.scrapQty}
                          onChange={(e) =>
                            setExtra(
                              extra.map((v: any, n: number) =>
                                n === i
                                  ? { ...v, scrapQty: +e.target.value }
                                  : v,
                              ),
                            )
                          }
                        />
                        {data.materialCards.find((c: any) => c.id === m.itemId)
                          ?.stock_uom === "m" && (
                          <input
                            aria-label={`Profil parça boyu mm ${i + 1}`}
                            title="Profil parça boyu · mm"
                            placeholder="Boy · mm"
                            type="number"
                            min={1}
                            className="rf-input"
                            value={m.cutLengthMm || ""}
                            onChange={(e) =>
                              setExtra(
                                extra.map((v: any, n: number) =>
                                  n === i
                                    ? {
                                        ...v,
                                        cutLengthMm: Number(e.target.value),
                                      }
                                    : v,
                                ),
                              )
                            }
                          />
                        )}
                      </div>
                    ))}
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      Profil seçilince miktar parça adedidir; boyu mm, hatalı
                      profil hurdasını metre girin. Ek profil yönetici kesim
                      havuzuna düşer.
                    </p>
                    <button
                      type="button"
                      className="text-xs text-primary"
                      onClick={() =>
                        setExtra([
                          ...extra,
                          { itemId: "", quantity: 1, scrapQty: 0 },
                        ])
                      }
                    >
                      Ek malzeme satırı ekle
                    </button>
                  </div>
                  <button
                    disabled={
                      busy ||
                      !canOperate ||
                      hasPending(op.id) ||
                      !note ||
                      !target
                    }
                    className="rf-primary-button min-h-12 w-full justify-center"
                    onClick={() => send("rework")}
                  >
                    <RotateCcw size={16} /> Gerekçeyle rework başlat
                  </button>
                </div>
              </details>
              <div className="border-t border-border pt-4">
                <h3 className="mb-3 text-xs font-medium">Ürün etiketleri</h3>
                <div className="mb-4 flex flex-wrap gap-2">
                  {data.units
                    ?.filter((u: any) => u.work_order_id === job?.id)
                    .map((u: any) => (
                      <Link
                        key={u.id}
                        className="rounded border border-border px-3 py-2 text-xs text-primary"
                        href={`/production/labels?kind=product&id=${u.id}`}
                      >
                        Ürün {u.serial} · QR
                      </Link>
                    ))}
                </div>
                <h3 className="mb-3 text-xs font-medium">İşlem geçmişi</h3>
                <div className="max-h-64 space-y-3 overflow-y-auto">
                  {data.events
                    .filter((e: any) => e.operation_id === op.id)
                    .map((e: any) => (
                      <p
                        key={e.id}
                        className="border-l-2 border-border pl-3 text-xs"
                      >
                        <span className="block font-medium">
                          {e.actor_name || "Çalışan"} ·{" "}
                          {e.event_type.replace("operation.", "")}
                        </span>
                        <span className="mt-1 block text-muted-foreground">
                          {new Date(e.created_at).toLocaleString("tr-TR")}{" "}
                          {e.payload.reason && "· " + e.payload.reason}
                        </span>
                      </p>
                    ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
