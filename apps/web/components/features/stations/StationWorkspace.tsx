"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  RefreshCw,
  Play,
  Pause,
  Check,
  Search,
  Tablet,
  ArrowLeft,
  FileText,
  WifiOff,
  ClipboardCheck,
} from "lucide-react";
import LazyPDFViewer from "@/components/features/pdf-viewer/LazyPDFViewer";
import { BrandMark } from "@/components/brand/BrandMark";
import { ProductDrawing } from "@/components/drawing/ProductDrawing";
import { CutDiagram } from "@/components/drawing/CutDiagram";
import { cn } from "@/lib/utils";
import type {
  StationCheck,
  StationKind,
} from "@/lib/features/stations/contract";
import type { CutView } from "@/lib/features/manufacturing/cut-view";
import type { QualityCheck } from "@/lib/features/manufacturing/quality";
type Op = {
  id: string;
  workOrderId: string;
  name: string;
  status: string;
  version: number;
  plannedQty: number;
  completedQty: number;
  orderNumber: string;
  productName: string;
  configuration: {
    family: string;
    widthMm: number | null;
    projectionMm: number | null;
    heightMm: number | null;
    mountingHeightMm: number | null;
    bodyName: string | null;
    motor: boolean;
    led: boolean;
  };
  qualityChecks: QualityCheck[];
  checklist: StationCheck[];
};
type Data = {
  device: {
    name: string;
    kind: StationKind;
    label: string;
    workCenterCode: string | null;
  };
  operations: Op[];
  files: { id: string; name: string; mime: string; work_order_id: string }[];
  instructions: {
    id: string;
    title: string;
    content: string;
    version: number;
    file_name: string | null;
    mime: string | null;
  }[];
  cutPlans: CutView[];
  balances: {
    id: string;
    sku: string;
    name: string;
    stock_uom: string;
    location_code: string;
    location_name: string;
    quantity: number;
  }[];
  moves: {
    id: number;
    quantity_delta: number;
    created_at: string;
    name: string;
    sku: string;
    stock_uom: string;
    location_code: string;
    entry_type: string;
  }[];
};
const names: Record<string, string> = {
  running: "Çalışıyor",
  ready: "İşe hazır",
  paused: "Duraklatıldı",
  waiting: "Önceki aşama bekleniyor",
  blocked: "Kontrol bekliyor",
};
class StationRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function api(path: string, options?: RequestInit) {
  const r = await fetch("/api/station" + path, {
    cache: "no-store",
    ...options,
  });
  const b = await r.json();
  if (!r.ok)
    throw new StationRequestError(b.error || "İşlem tamamlanamadı.", r.status);
  return b.data;
}
const post = (body: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const fileUrl = (kind: "production" | "knowledge", id: string) =>
  "/api/station/file?" + new URLSearchParams({ kind, id });
export function StationWorkspace() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [pairing, setPairing] = useState(false),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [q, setQ] = useState(""),
    [selected, setSelected] = useState(""),
    [online, setOnline] = useState(true),
    [loading, setLoading] = useState(true),
    [updated, setUpdated] = useState(""),
    [quality, setQuality] = useState<Record<string, string>>({}),
    [quantity, setQuantity] = useState(1),
    [photos, setPhotos] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState<{
      name: string;
      url: string;
      mime: string;
    } | null>(null);
  const pairingRequested = useRef(false),
    readSequence = useRef(0);
  const inFlight = useRef(false),
    alive = useRef(true),
    pending = useRef<{
      commandId: string;
      data: Record<string, unknown>;
    } | null>(null);
  const load = useCallback(async (query: string, signal?: AbortSignal) => {
    if (inFlight.current || pairingRequested.current) return;
    inFlight.current = true;
    const sequence = ++readSequence.current;
    try {
      const result = await api("?q=" + encodeURIComponent(query), { signal });
      if (
        !alive.current ||
        signal?.aborted ||
        pairingRequested.current ||
        sequence !== readSequence.current
      )
        return;
      setData(result);
      setPairing(false);
      setUpdated(
        new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      setError("");
    } catch (e) {
      if (
        signal?.aborted ||
        !alive.current ||
        pairingRequested.current ||
        sequence !== readSequence.current
      )
        return;
      if (e instanceof StationRequestError && e.status === 401) {
        setPairing(true);
        setData(null);
      } else setError(e instanceof Error ? e.message : "Bağlantı kurulamadı.");
    } finally {
      if (sequence === readSequence.current) {
        inFlight.current = false;
        if (alive.current) setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    setOnline(navigator.onLine);
    const connect = () => setOnline(true),
      disconnect = () => setOnline(false);
    window.addEventListener("online", connect);
    window.addEventListener("offline", disconnect);
    const readPairingLink = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1)).get(
        "pair",
      );
      if (!fragment) return;
      // An explicit new enrollment takes precedence over an existing device cookie.
      pairingRequested.current = true;
      readSequence.current += 1;
      inFlight.current = false;
      pending.current = null;
      setPairing(true);
      setCode(fragment);
      setData(null);
      setSelected("");
      setPreview(null);
      setQ("");
      setError("");
      setMessage("");
      setLoading(false);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    };
    readPairingLink();
    window.addEventListener("hashchange", readPairingLink);
    return () => {
      alive.current = false;
      window.removeEventListener("online", connect);
      window.removeEventListener("offline", disconnect);
      window.removeEventListener("hashchange", readPairingLink);
    };
  }, []);
  useEffect(() => {
    const abort = new AbortController(),
      timer = setTimeout(() => void load(q, abort.signal), 200);
    const poll = setInterval(() => {
      if (!document.hidden && navigator.onLine && !busy)
        void load(q, abort.signal);
    }, 15_000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      abort.abort();
    };
  }, [q, load, busy]);
  const op = data?.operations.find((o) => o.id === selected);
  useEffect(() => {
    setQuality({});
    setPhotos([]);
    setQuantity(op ? Math.max(1, op.plannedQty - op.completedQty) : 1);
  }, [op?.id, op?.version]);
  async function pair(e: React.FormEvent) {
    e.preventDefault();
    pairingRequested.current = true;
    readSequence.current += 1;
    inFlight.current = false;
    setBusy(true);
    setError("");
    try {
      await api("/pair", post({ code }));
      pairingRequested.current = false;
      setCode("");
      await load(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eşleştirme yapılamadı.");
    } finally {
      setBusy(false);
    }
  }
  async function check(c: StationCheck) {
    if (!op) return;
    setBusy(true);
    setError("");
    try {
      await api(
        "/check",
        post({
          operationId: op.id,
          operationVersion: op.version,
          key: c.key,
          checked: !c.checked,
          version: c.version,
        }),
      );
      await load(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kontrol kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }
  async function operate(action: string, retry = false) {
    if (!op && !retry) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!retry)
        pending.current = {
          commandId: crypto.randomUUID(),
          data: {
            operationId: op!.id,
            version: op!.version,
            action,
            quantity: action === "complete" ? quantity : undefined,
            qualityResults: op!.qualityChecks.map((c) => ({
              checkId: c.id,
              ...(c.kind === "measurement"
                ? {
                    value:
                      quality[c.id] === "" || quality[c.id] === undefined
                        ? undefined
                        : Number(quality[c.id]),
                  }
                : c.kind === "pass_fail"
                  ? {
                      passed:
                        quality[c.id] === undefined
                          ? undefined
                          : quality[c.id] === "true",
                    }
                  : {}),
            })),
            photos,
            additionalMaterials: [],
          },
        };
      const result = await api("/operate", post(pending.current));
      pending.current = null;
      setMessage(
        result.qualityRejected
          ? "Kalite kontrolü geçilemedi. İş kontrol bekliyor."
          : action === "complete"
            ? "Üretim kaydı sunucuda tamamlandı."
            : action === "start"
              ? "İş başlatıldı."
              : "İş duraklatıldı.",
      );
      await load(q);
    } catch (e) {
      if (e instanceof StationRequestError && e.status < 500)
        pending.current = null;
      setError(
        e instanceof Error
          ? e.message
          : "Sunucu onayı alınamadı. Bağlantıyı kontrol edip aynı işlemi tekrar deneyin.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function photo(file: File | null) {
    if (!file || !op) return;
    setBusy(true);
    setError("");
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 20 * 1024 * 1024
      )
        throw Error("JPEG, PNG veya WebP fotoğraf seçin (en fazla 20 MB).");
      const bitmap = await createImageBitmap(file),
        scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        bitmap.close();
        throw Error("Fotoğraf işlenemedi.");
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
      if (base64.length > 3_000_000)
        throw Error("Fotoğraf çok büyük. Daha küçük bir fotoğraf seçin.");
      const result = await api(
        "/photo",
        post({
          operationId: op.id,
          version: op.version,
          name: "istasyon-fotograf.jpg",
          base64,
        }),
      );
      setPhotos((v) => [...v, result.url].slice(-6));
      setMessage(
        "Fotoğraf yüklendi. İşi tamamladığınızda kalite kaydına eklenecek.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fotoğraf yüklenemedi.");
    } finally {
      setBusy(false);
    }
  }
  const controlsDisabled = busy || !online;
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-7">
        <div className="flex items-center gap-5">
          <BrandMark href="/station" size="sm" />
          <div className="border-l border-border pl-5">
            <h1 className="text-lg font-semibold">
              {data?.device.name ?? "RenkFlow İstasyon"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {data
                ? data.device.label +
                  " · " +
                  (data.device.workCenterCode ?? "Depo terminali")
                : "Sabit fabrika tableti"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {!online ? (
            <span className="flex items-center gap-2 text-amber-600">
              <WifiOff size={18} /> Çevrim dışı · işlemler durduruldu
            </span>
          ) : (
            updated && <span>Son güncelleme {updated}</span>
          )}
          <button
            onClick={() => load(q)}
            disabled={busy || !online}
            aria-label="İstasyonu yenile"
            className="rf-secondary-button min-h-12 min-w-12 px-3"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-7">
        {error && (
          <div
            role="alert"
            className="rf-alert flex flex-wrap items-center justify-between gap-3 p-4"
          >
            {error}
            {pending.current && (
              <button
                disabled={controlsDisabled}
                onClick={() => operate("", true)}
                className="rf-secondary-button min-h-12 px-4"
              >
                Aynı işlemi tekrar dene
              </button>
            )}
          </div>
        )}
        {message && (
          <div
            role="status"
            className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm"
          >
            {message}
          </div>
        )}
        {pairing ? (
          <section className="rf-panel mx-auto max-w-lg space-y-5 p-6 md:mt-12">
            <Tablet size={32} strokeWidth={1.5} />
            <h2 className="text-2xl font-semibold">
              Tableti istasyona bağlayın
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Yönetici panelinde Ayarlar → İstasyon tabletleri bölümünden bir
              eşleştirme kodu oluşturun. Bağlandıktan sonra günlük işlemler PIN
              gerektirmez.
            </p>
            <form onSubmit={pair} className="space-y-4">
              <label
                htmlFor="station-pair"
                className="block text-sm font-medium"
              >
                Tek kullanımlık eşleştirme kodu
              </label>
              <input
                id="station-pair"
                required
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                className="rf-input h-14 w-full font-mono text-base"
              />
              <button
                disabled={controlsDisabled}
                className="rf-primary-button min-h-14 w-full text-base"
              >
                {busy ? "Bağlanıyor…" : "Tableti bağla"}
              </button>
            </form>
            <p className="text-xs text-muted-foreground">
              Eşleştirme kodu yalnız ilgili fabrikanın istasyonuna erişim verir.
              Bağlantı yönetici tarafından her an kapatılabilir.
            </p>
          </section>
        ) : !data ? (
          <p role="status" className="py-20 text-center text-muted-foreground">
            {loading
              ? "İstasyon açılıyor…"
              : "İstasyon verileri alınamadı. Yenile düğmesini kullanın."}
          </p>
        ) : (
          <>
            <label className="rf-panel flex min-h-14 items-center gap-3 px-4">
              <Search size={22} aria-hidden />
              <input
                className="w-full bg-transparent text-lg outline-none"
                aria-label={
                  data.device.kind === "warehouse"
                    ? "Stok veya raf ara"
                    : "Sipariş ara"
                }
                placeholder={
                  data.device.kind === "warehouse"
                    ? "Stok adı, ürün kodu veya raf ara…"
                    : "Sipariş numarası veya ürün ara…"
                }
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            {data.device.kind === "warehouse" ? (
              <div className="grid items-start gap-5 xl:grid-cols-[1.3fr_1fr]">
                <section className="rf-panel overflow-hidden">
                  <h2 className="border-b border-border p-5 text-lg font-semibold">
                    Malzemeler ve konumlar
                  </h2>
                  {data.balances.length ? (
                    <div className="divide-y divide-border">
                      {data.balances.map((b, i) => (
                        <article
                          key={b.id + ":" + b.location_code + ":" + i}
                          className="flex min-h-24 items-center justify-between gap-4 p-5"
                        >
                          <div className="min-w-0">
                            <h3 className="font-semibold">{b.name}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {b.sku} · Raf {b.location_code} ·{" "}
                              {b.location_name}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <strong className="text-xl tabular-nums">
                              {Number(b.quantity).toLocaleString("tr-TR")}
                            </strong>
                            <span className="ml-2 text-sm text-muted-foreground">
                              {b.stock_uom}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="p-8 text-muted-foreground">
                      Bu depoda aramaya uygun stok yok.
                    </p>
                  )}
                </section>
                <section className="rf-panel">
                  <h2 className="border-b border-border p-5 text-lg font-semibold">
                    Son stok hareketleri
                  </h2>
                  {data.moves.length ? (
                    data.moves.map((m) => (
                      <article
                        key={m.id}
                        className="flex min-h-20 justify-between gap-3 border-b border-border p-4"
                      >
                        <div>
                          <h3 className="font-medium">{m.name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Raf {m.location_code} ·{" "}
                            {new Date(m.created_at).toLocaleString("tr-TR")}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "whitespace-nowrap font-semibold tabular-nums",
                            Number(m.quantity_delta) > 0
                              ? "text-emerald-600"
                              : "text-amber-600",
                          )}
                        >
                          {Number(m.quantity_delta) > 0 ? "+" : ""}
                          {Number(m.quantity_delta).toLocaleString(
                            "tr-TR",
                          )}{" "}
                          {m.stock_uom}
                        </span>
                      </article>
                    ))
                  ) : (
                    <p className="p-8 text-muted-foreground">
                      {q.trim()
                        ? "Aramanıza uygun stok hareketi yok."
                        : "Henüz stok hareketi yok."}
                    </p>
                  )}
                  <p className="p-4 text-xs leading-5 text-muted-foreground">
                    Bu ekran stok ve raf bilgisini gösterir. Sayım düzeltme ve
                    stok iptali yetkili depo ekranından yapılır.
                  </p>
                </section>
              </div>
            ) : (
              <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                <aside
                  className={cn("space-y-3", op && "hidden lg:block")}
                  aria-label="İstasyon işleri"
                >
                  <h2 className="px-1 text-lg font-semibold">
                    İş kuyruğu{" "}
                    <span className="text-muted-foreground">
                      {data.operations.length}
                    </span>
                  </h2>
                  {data.operations.length ? (
                    data.operations.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => {
                          setSelected(o.id);
                          setPreview(null);
                          setMessage("");
                        }}
                        className={cn(
                          "rf-panel min-h-28 w-full space-y-2 p-5 text-left transition-colors hover:bg-muted/40",
                          selected === o.id && "border-primary",
                        )}
                      >
                        <span className="block text-lg font-semibold">
                          {o.orderNumber}
                        </span>
                        <span className="block text-sm">
                          {o.productName || o.name}
                        </span>
                        <span className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{names[o.status] ?? o.status}</span>
                          <span>
                            {o.completedQty}/{o.plannedQty} adet
                          </span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="rf-panel space-y-3 p-8 text-muted-foreground">
                      <ClipboardCheck size={28} />
                      <p>Bu istasyonda bekleyen iş yok.</p>
                    </div>
                  )}
                </aside>
                <section className="rf-panel min-w-0 space-y-5 p-4 md:p-6">
                  {op ? (
                    <>
                      <button
                        onClick={() => setSelected("")}
                        className="rf-secondary-button min-h-12 px-4 lg:hidden"
                      >
                        <ArrowLeft size={18} /> İş kuyruğu
                      </button>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-2xl font-semibold">
                            {op.orderNumber}
                          </h2>
                          <p className="mt-1 text-lg text-muted-foreground">
                            {op.productName || op.name} · {op.name}
                          </p>
                        </div>
                        <span className="rounded-lg bg-muted px-3 py-2 text-sm font-medium">
                          {names[op.status]}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {[
                          ["En", op.configuration.widthMm],
                          ["Açılım", op.configuration.projectionMm],
                          [
                            "Montaj yüksekliği",
                            op.configuration.mountingHeightMm,
                          ],
                        ].map(([label, v]) => (
                          <div
                            key={String(label)}
                            className="rounded-xl bg-muted/50 p-4"
                          >
                            <p className="text-sm text-muted-foreground">
                              {label}
                            </p>
                            <strong className="mt-1 block text-xl tabular-nums">
                              {typeof v === "number"
                                ? v.toLocaleString("tr-TR") + " mm"
                                : "Kayıt yok"}
                            </strong>
                          </div>
                        ))}
                      </div>
                      <div className="text-base">
                        Gövde:{" "}
                        <strong>
                          {op.configuration.bodyName || "Belirtilmedi"}
                        </strong>{" "}
                        · Motor: {op.configuration.motor ? "Var" : "Yok"} · LED:{" "}
                        {op.configuration.led ? "Var" : "Yok"}
                      </div>
                      {data.device.kind === "assembly" && (
                        <ProductDrawing
                          family={op.configuration.family}
                          widthMm={op.configuration.widthMm}
                          projectionMm={op.configuration.projectionMm}
                          heightMm={
                            op.configuration.heightMm ??
                            op.configuration.mountingHeightMm
                          }
                          color={op.configuration.bodyName}
                          className="mx-auto max-h-96 w-full"
                        />
                      )}
                      {data.device.kind === "cutting" &&
                        data.cutPlans
                          .filter((p) =>
                            p.bars.some((b) =>
                              b.pieces.some(
                                (piece) => piece.workOrderId === op.workOrderId,
                              ),
                            ),
                          )
                          .map((plan) => (
                            <div key={plan.id} className="space-y-3">
                              <h3 className="font-semibold">
                                Onaylı kesim yerleşimi
                              </h3>
                              <CutDiagram
                                plan={plan}
                                jobs={data.operations.map((o) => ({
                                  id: o.workOrderId,
                                  title: o.orderNumber,
                                  color: o.configuration.bodyName,
                                }))}
                                focusJobId={op.workOrderId}
                              />
                            </div>
                          ))}
                      <fieldset className="space-y-3">
                        <legend className="mb-3 text-lg font-semibold">
                          {data.device.kind === "packing"
                            ? "Aksesuar ve paket kontrolü"
                            : "Kontrol listesi"}
                        </legend>
                        {op.checklist.map((c) => (
                          <label
                            key={c.key}
                            className={cn(
                              "flex min-h-16 items-center gap-4 rounded-xl border border-border px-4 text-base",
                              c.checked &&
                                "border-emerald-500/25 bg-emerald-500/5",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="h-6 w-6 shrink-0 accent-emerald-600"
                              checked={c.checked}
                              disabled={
                                controlsDisabled || op.status === "waiting"
                              }
                              onChange={() => check(c)}
                            />
                            <span>{c.label}</span>
                          </label>
                        ))}
                      </fieldset>
                      {op.qualityChecks.length > 0 && (
                        <fieldset className="space-y-3">
                          <legend className="mb-3 text-lg font-semibold">
                            Üretim kalite kontrolleri
                          </legend>
                          {op.qualityChecks.map((c) => (
                            <label
                              key={c.id}
                              className="rf-panel block space-y-2 p-4"
                            >
                              <span className="block text-base font-medium">
                                {c.name}
                              </span>
                              {c.kind === "pass_fail" ? (
                                <select
                                  aria-label={c.name}
                                  className="rf-input h-14 w-full text-base"
                                  value={quality[c.id] ?? ""}
                                  onChange={(e) =>
                                    setQuality({
                                      ...quality,
                                      [c.id]: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Sonucu seçin</option>
                                  <option value="true">Uygun</option>
                                  <option value="false">Uygun değil</option>
                                </select>
                              ) : c.kind === "measurement" ? (
                                <>
                                  <input
                                    aria-label={c.name}
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    className="rf-input h-14 w-full text-lg"
                                    value={quality[c.id] ?? ""}
                                    onChange={(e) =>
                                      setQuality({
                                        ...quality,
                                        [c.id]: e.target.value,
                                      })
                                    }
                                  />
                                  <span className="text-sm text-muted-foreground">
                                    {c.minimum}–{c.maximum} {c.unit}
                                  </span>
                                </>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Fotoğraf doğrulaması gerekli.
                                </p>
                              )}
                            </label>
                          ))}
                        </fieldset>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="rf-secondary-button min-h-14 cursor-pointer px-4">
                          <Camera size={20} /> Fotoğraf ekle
                          <input
                            type="file"
                            className="sr-only"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            disabled={controlsDisabled || photos.length >= 6}
                            onChange={(e) => {
                              void photo(e.target.files?.[0] ?? null);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <span className="text-sm text-muted-foreground">
                          {photos.length}/6 fotoğraf · bu üretim kaydına
                          eklenecek
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {["ready", "paused", "blocked"].includes(op.status) && (
                          <button
                            disabled={controlsDisabled}
                            onClick={() => operate("start")}
                            className="rf-primary-button min-h-16 px-6 text-lg"
                          >
                            <Play size={22} />{" "}
                            {op.status === "paused" ? "Devam et" : "İşi başlat"}
                          </button>
                        )}
                        {op.status === "running" && (
                          <>
                            <button
                              disabled={controlsDisabled}
                              onClick={() => operate("pause")}
                              className="rf-secondary-button min-h-16 px-6 text-lg"
                            >
                              <Pause size={22} /> Duraklat
                            </button>
                            <label className="flex items-center justify-between gap-3 text-base">
                              Tamamlanan adet
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={op.plannedQty - op.completedQty}
                                className="rf-input h-16 w-28 text-xl"
                                value={quantity}
                                onChange={(e) =>
                                  setQuantity(Number(e.target.value))
                                }
                              />
                            </label>
                            <button
                              disabled={
                                controlsDisabled ||
                                op.checklist.some((c) => !c.checked) ||
                                (op.qualityChecks.some(
                                  (c) => c.kind === "photo",
                                ) &&
                                  photos.length === 0)
                              }
                              onClick={() => operate("complete")}
                              className="rf-primary-button min-h-16 px-6 text-lg sm:col-span-2"
                            >
                              <Check size={24} /> İşi tamamla
                            </button>
                          </>
                        )}
                        {op.status === "waiting" && (
                          <p className="rounded-lg bg-muted/50 p-4 text-sm sm:col-span-2">
                            Önceki üretim aşaması tamamlandığında bu iş
                            başlatılabilir.
                          </p>
                        )}
                      </div>
                      {(data.files.some(
                        (f) => f.work_order_id === op.workOrderId,
                      ) ||
                        data.instructions.length > 0) && (
                        <section className="space-y-3 border-t border-border pt-5">
                          <h3 className="text-lg font-semibold">
                            Teknik çizimler ve talimatlar
                          </h3>
                          {data.files
                            .filter((f) => f.work_order_id === op.workOrderId)
                            .map((f) => (
                              <button
                                key={f.id}
                                onClick={() =>
                                  setPreview({
                                    name: f.name,
                                    mime: f.mime,
                                    url: fileUrl("production", f.id),
                                  })
                                }
                                className="rf-secondary-button min-h-14 w-full justify-start px-4"
                              >
                                <FileText size={20} />
                                {f.name}
                              </button>
                            ))}
                          {data.instructions.map((doc) => (
                            <details
                              key={doc.id}
                              className="rounded-xl border border-border p-4"
                            >
                              <summary className="cursor-pointer py-2 text-base font-medium">
                                {doc.title} · v{doc.version}
                              </summary>
                              <p className="mt-3 whitespace-pre-wrap text-base leading-7">
                                {doc.content}
                              </p>
                              {doc.file_name && doc.mime && (
                                <button
                                  onClick={() =>
                                    setPreview({
                                      name: doc.file_name!,
                                      mime: doc.mime!,
                                      url: fileUrl("knowledge", doc.id),
                                    })
                                  }
                                  className="rf-secondary-button mt-4 min-h-14 px-4"
                                >
                                  <FileText size={20} /> {doc.file_name}
                                </button>
                              )}
                            </details>
                          ))}
                        </section>
                      )}
                      {preview && (
                        <section className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-semibold">{preview.name}</h3>
                            <button
                              className="rf-secondary-button min-h-12 px-4"
                              onClick={() => setPreview(null)}
                            >
                              Kapat
                            </button>
                          </div>
                          {preview.mime === "application/pdf" ? (
                            <LazyPDFViewer
                              key={preview.url}
                              fileUrl={preview.url}
                              fileName={preview.name}
                              onClose={() => setPreview(null)}
                            />
                          ) : preview.mime.startsWith("image/") ? (
                            <img
                              src={preview.url}
                              alt={preview.name}
                              className="max-h-[70vh] w-full object-contain"
                            />
                          ) : (
                            <a
                              href={preview.url}
                              className="rf-primary-button min-h-14 px-5"
                            >
                              Dosyayı indir
                            </a>
                          )}
                        </section>
                      )}
                    </>
                  ) : (
                    <div className="flex min-h-96 flex-col items-center justify-center gap-4 text-center text-muted-foreground">
                      <Tablet size={40} strokeWidth={1.25} />
                      <h2 className="text-xl font-medium">
                        Başlamak için kuyruktan bir iş seçin
                      </h2>
                      <p>Yalnız bu istasyona atanan işler gösterilir.</p>
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
