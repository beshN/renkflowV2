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
  Lock,
  ListChecks,
  RefreshCw,
  ScanLine,
  Scissors,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Activity,
  Flag,
} from "lucide-react";
import { PageHeader, ProgressRing, SkeletonRows, EmptyState } from "@/components/kit";
import { ProductDrawing } from "@/components/drawing/ProductDrawing";
import { CutDiagram } from "@/components/drawing/CutDiagram";
import { feedback, setSound, soundOn } from "@/lib/features/manufacturing/feedback";
import { useProduction } from "./useProduction";
import BarcodeScanner from "@/components/features/warehouse/BarcodeScanner";
import {ReworkCases} from "./QualityIntelligence";
import { QualityChecklist } from "./QualityChecklist";
import { AwningDialog } from "@/components/features/awning/AwningConfigurator";
import { ColorChip, WorkshopColor } from "@/components/colors/ColorSwatch";
import { barColorMismatch } from "@/lib/features/colors/color-spec";
import { VoiceCommand } from "@/components/features/ai/VoiceCommand";
import { MorningSummary } from "@/components/features/ai/MorningSummary";
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
    [sound, setSoundState] = useState(true),
    [cutFor, setCutFor] = useState<string | null>(null),
    [quick, setQuick] = useState<string | null>(null),
    fromQr = useRef(false);
  useEffect(() => setSoundState(soundOn()), []);
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
      <div className="rf-page space-y-4">
        {error ? <p role="alert" className="rf-alert">{error}</p> : <SkeletonRows rows={4} />}
        {error && <button onClick={refresh} className="rf-secondary-button h-12 px-5"><RefreshCw size={18} /> Tekrar dene</button>}
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
  /**
   * The one big button on a job card: start the next step, or finish the running one with the
   * pieces left. A step with quality checks opens its panel instead, so the checks are filled in.
   */
  async function quickAction(o: any) {
    if (!o) return;
    const mine = data.actor.role !== "worker" || o.assigned_to === data.actor.userId;
    if (!mine) return;
    if (o.status === "running" && (o.quality_checks || []).length) {
      setSelected(o.id);
      setQuantity(Math.max(1, Number(o.planned_qty) - Number(o.completed_qty)));
      return;
    }
    const action = o.status === "running" ? "complete" : "start";
    setQuick(o.id);
    setLocalError("");
    try {
      await operate({
        operationId: o.id,
        version: o.version,
        action,
        quantity: action === "complete" ? Math.max(1, Number(o.planned_qty) - Number(o.completed_qty)) : undefined,
        qualityResults: [],
        photos: [],
        additionalMaterials: [],
      }, []);
      feedback(action === "complete" ? "done" : "start");
    } catch (e) {
      feedback("error");
      setLocalError(e instanceof Error ? e.message : "İşlem sıraya alınamadı");
    } finally {
      setQuick(null);
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
      <PageHeader eyebrow="RENK ALÜMİNYUM / SAHA" title="Fabrika"
        kpis={[
          { label: "iş", value: data.jobs.filter((j: any) => !["done", "cancelled"].includes(j.status)).length, icon: ListChecks },
          { label: "çalışıyor", value: ops.filter((o: any) => o.status === "running").length, icon: Activity },
          { label: "biten", value: data.jobs.filter((j: any) => j.status === "done").length, icon: Flag },
        ]}
        action={<>
          <button type="button" aria-pressed={filter === "all"} aria-label={filter === "active" ? "Bitenleri göster" : "Yalnız aktif işler"} className="grid h-12 w-12 place-items-center rounded-md border border-border" onClick={() => setFilter(filter === "active" ? "all" : "active")}>{filter === "active" ? <Eye size={20} /> : <EyeOff size={20} />}</button>
          <button type="button" aria-pressed={sound} aria-label={sound ? "Sesi kapat" : "Sesi aç"} className="grid h-12 w-12 place-items-center rounded-md border border-border" onClick={() => { setSound(!sound); setSoundState(!sound); }}>{sound ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
          <button type="button" aria-label="Eşitle" className="grid h-12 w-12 place-items-center rounded-md border border-border" onClick={sync}><RefreshCw size={20} /></button>
          <Link href="/warehouse/scan" aria-label="QR terminali" className="grid h-12 w-12 place-items-center rounded-md bg-primary text-primary-foreground"><ScanLine size={22} /></Link>
        </>} />
      <MorningSummary />
      {(() => {
        // Voice acts on the selected step, or the worker's own running step.
        const v = op ?? ops.find((o: any) => o.status === "running" && (data.actor.role !== "worker" || o.assigned_to === data.actor.userId));
        const vJob = v ? data.jobs.find((j: any) => j.id === v.work_order_id) : null;
        // Start/finish by voice only where the card's own button would act directly.
        const vBlocked = !v ? null : data.actor.role === "worker" && v.assigned_to !== data.actor.userId ? "Bu adım size atanmamış." : hasPending(v.id) || quick === v.id ? "Bu adım için işlem sırada." : v.status === "running" && (v.quality_checks || []).length ? "Bu adımın kalite kontrolleri var; iş kartından bitirin." : null;
        return <VoiceCommand actionBlocked={vBlocked} target={v ? { operationId: v.id, workOrderId: v.work_order_id, name: `${vJob?.title ?? "İş"} · ${v.name}`, status: String(v.status) } : null} onStart={() => quickAction(v)} onComplete={() => quickAction(v)} />;
      })()}
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
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Clock size={16} aria-hidden /> {pending.length} işlem sırada
          </h2>
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
            {scanResult.bars?.map((b: any, i: number) => {
              // A bar must be the colour of every job it is cut for; say so when a record disagrees.
              const mismatch = barColorMismatch(b.color, b.pieces.map((p: any) => data.jobs.find((j: any) => j.id === p.workOrderId)?.configuration?.bodyName));
              return (
                <p key={i} className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span>{i + 1}.</span>
                  <ColorChip color={b.color} size={18} className="font-medium" />
                  <span>· {b.lengthMm} mm → {b.pieces.map((p: any) => p.lengthMm + " mm").join(" + ")} · Kalan {b.remainingMm} mm</span>
                  {mismatch && <span className="rounded border border-rose-500/40 px-1.5 font-medium text-rose-700 dark:text-rose-300">Renk iş emriyle uyuşmuyor</span>}
                </p>
              );
            })}
          </div>
        )}
        {localError && !op && (
          <p role="alert" className="text-xs text-destructive">
            {localError}
          </p>
        )}
      </section>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <section className="space-y-4">
          {jobs.map((j: any) => (
            <article key={j.id} className="rf-panel min-w-0 space-y-4">
              {(() => {
                const jobOps = ops.filter((o: any) => o.work_order_id === j.id);
                const next = jobOps.find((o: any) => o.status === "running") || jobOps.find((o: any) => ["ready", "paused"].includes(o.status)) || jobOps.find((o: any) => o.status !== "done");
                const planned = Number(j.planned_qty) || 0;
                const left = next ? Math.max(0, Number(next.planned_qty) - Number(next.completed_qty)) : 0;
                const mine = next && (data.actor.role !== "worker" || next.assigned_to === data.actor.userId);
                const blocked = !next || next.status === "waiting" || next.status === "blocked" || !mine;
                // The job's own plan first; otherwise the newest approved plan that cuts for it.
                const plans = data.cutPlans || [];
                const plan = plans.find((p: any) => p.id === j.cut_plan_id) || plans.find((p: any) => p.bars.some((b: any) => b.pieces.some((x: any) => x.workOrderId === j.id)));
                const cfg = j.configuration || {};
                return (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold">{j.order_number || j.title}</h2>
                        <p className="truncate text-sm text-muted-foreground">{[j.customer_name, j.title].filter(Boolean).join(" · ")}</p>
                        {j.due_at && (() => {
                          const due = new Date(j.due_at).toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
                          const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
                          return <p className={`mt-1 inline-flex items-center gap-1 text-sm font-medium ${due < today ? "text-rose-700 dark:text-rose-300" : ""}`}><Clock size={14} aria-hidden />{new Date(j.due_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}{due < today ? " · gecikti" : due === today ? " · bugün" : ""}</p>;
                        })()}
                      </div>
                      <ProgressRing size={64} stroke={7} value={planned - (next ? left : 0)} max={planned || 1} label={`${left} adet kaldı`} center={<span className="text-base">{next ? left : <Check size={20} />}</span>} />
                    </div>
                    <div className="grid items-center gap-3 sm:grid-cols-[1fr_180px]">
                      {j.color ? <WorkshopColor color={j.color} className="rounded-md border border-border p-2" /> : <span />}
                      {cfg.widthMm && cfg.version !== 1 && <ProductDrawing compact family={cfg.family || "pergola"} widthMm={Number(cfg.widthMm)} projectionMm={Number(cfg.projectionMm)} heightMm={Number(cfg.mountingHeightMm)} color={cfg.bodyName} className="h-24 w-full rounded-md border border-border bg-background p-1" />}
                    </div>
                    {cfg.version === 1 && <AwningDialog configuration={cfg} previewImage={j.bom_snapshot?.preview} readOnly label="3D görünüm" />}
                    {next && (
                      <button type="button" disabled={blocked || quick === next.id || hasPending(next.id)} onClick={() => void quickAction(next)}
                        className={`flex min-h-16 w-full items-center justify-center gap-3 rounded-lg text-lg font-semibold disabled:opacity-60 ${next.status === "running" ? "bg-emerald-700 text-white" : "bg-primary text-primary-foreground"}`}>
                        {blocked ? <Lock size={22} aria-hidden /> : next.status === "running" ? <Check size={24} aria-hidden /> : <Play size={24} aria-hidden />}
                        {next.name} · {hasPending(next.id) ? "sırada" : next.status === "running" ? "Bitti" : blocked ? (next.status === "waiting" ? "önceki adım" : "kilitli") : "Başla"}
                      </button>
                    )}
                    {plan && (
                      <button type="button" onClick={() => setCutFor(cutFor === j.id ? null : j.id)} aria-expanded={cutFor === j.id} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-border text-sm font-medium">
                        <Scissors size={18} aria-hidden /> Kesim şeması
                      </button>
                    )}
                    {plan && cutFor === j.id && (
                      <CutDiagram plan={plan} focusJobId={j.id} items={data.materialCards}
                        jobs={data.jobs.filter((x: any) => plan.bars.some((b: any) => b.pieces.some((p: any) => p.workOrderId === x.id))).map((x: any) => ({ id: x.id, title: x.order_number || x.title, color: x.configuration?.bodyName }))} />
                    )}
                    <div className="flex justify-end">
                      <Link href={`/warehouse/labels?kind=job&id=${j.id}`} className="text-xs text-primary">QR etiketi</Link>
                    </div>
                  </>
                );
              })()}
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
            <section className="rf-panel"><EmptyState title="İş yok" icon={ListChecks} /></section>
          )}
        </section>
        <section className="rf-panel space-y-5 lg:sticky lg:top-24">
          {!op ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><ListChecks size={18} aria-hidden /> Adım seçin</p>
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
                        href={`/warehouse/labels?kind=product&id=${u.id}`}
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
