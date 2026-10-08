"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Printer, Plus, Trash2, Copy, ScanLine } from "lucide-react";
import { useWarehouse } from "./useWarehouse";
import { canonicalColor } from "@/lib/features/colors/color-spec";
import { useAuth } from "@/lib/context/AuthContext";
import {
  LABEL_NAMES,
  type LabelKind,
} from "@/lib/features/warehouse/contracts";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
export function FactoryLabel({
  label,
  size,
  onReady,
}: {
  label: any;
  size: string;
  onReady?: (code: string, ready: boolean) => void;
}) {
  const [qr, setQr] = useState(""),
    [error, setError] = useState(""),
    barcode = useRef<SVGSVGElement>(null);
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(
      window.location.origin +
        "/warehouse/scan?code=" +
        encodeURIComponent(label.code),
      { width: 400, margin: 4, errorCorrectionLevel: "M" },
    )
      .then((r) => {
        if (active) setQr(r);
      })
      .catch(() => {
        if (active) setError("QR görseli hazırlanamadı");
      });
    try {
      if (barcode.current)
        JsBarcode(barcode.current, label.code, {
          format: "CODE128",
          width: 1.5,
          height: 35,
          displayValue: false,
          margin: 15,
          background: "#ffffff",
          lineColor: "#000000",
        });
    } catch {
      setError("Barkod hazırlanamadı");
    }
    return () => {
      active = false;
    };
  }, [label.code]);
  useEffect(() => {
    onReady?.(label.code, Boolean(qr) && !error);
  }, [qr, error, label.code, onReady]);
  const r = label.record;
  return (
    <article
      className={
        "rf-factory-label " + (size === "80x50" ? "rf-label-compact" : "")
      }
    >
      <div className="rf-label-heading">
        <span>{label.brand || "RENKFLOW"}</span>
        <span>{LABEL_NAMES[label.kind as LabelKind]}</span>
      </div>
      <div className="rf-label-body">
        <div className="rf-label-text">
          <h3>{r.title}</h3>
          <p>{r.subtitle}</p>
          {r.quantity !== undefined && (
            <strong>
              {Number(r.quantity).toLocaleString("tr-TR", {
                maximumFractionDigits: 3,
              })}{" "}
              {r.uom} {r.color ? "· " + canonicalColor(r.color) : ""}
            </strong>
          )}
          {r.status && <p>{r.status}</p>}
          <small>Etiket, kayıt kimliğidir. Güncel bilgiyi okutun.</small>
        </div>
        {qr && (
          <img
            src={qr}
            alt={label.code + " QR kodu"}
            width={120}
            height={120}
          />
        )}
      </div>
      <svg
        ref={barcode}
        role="img"
        aria-label={label.code + " Code 128 barkodu"}
        className="rf-label-barcode"
      />
      <p className="rf-label-human">{label.code}</p>
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
export default function LabelCenter() {
  const { user } = useAuth();
  const { data, error, busy, online, command } = useWarehouse(),
    [kind, setKind] = useState<LabelKind>("lot"),
    [id, setId] = useState(""),
    [search, setSearch] = useState(""),
    [labels, setLabels] = useState<any[]>([]),
    [production, setProduction] = useState<any>(null),
    [layout, setLayout] = useState("a4"),
    [copies, setCopies] = useState(1),
    [localError, setLocalError] = useState(""),
    [feedback, setFeedback] = useState(""),
    [preparing, setPreparing] = useState(false),
    [ready, setReady] = useState<Record<string, boolean>>({});
  const onReady = useCallback(
    (code: string, value: boolean) =>
      setReady((old) =>
        old[code] === value ? old : { ...old, [code]: value },
      ),
    [],
  );
  const loaded = useRef(false),
    initialized = useRef(false);
  const labelScope = user?.tenantId + ":" + user?.id + ":" + user?.role;
  useEffect(() => {
    setLabels([]);
    setProduction(null);
    loaded.current = false;
    initialized.current = false;
  }, [labelScope]);
  useEffect(() => {
    if (!data || loaded.current) return;
    loaded.current = true;
    if (["owner", "admin", "office", "worker"].includes(data.actor.role))
      void fetch("/api/v1/production", { cache: "no-store" })
        .then(async (r) => {
          const b = await r.json();
          if (r.ok) setProduction(b.data);
        })
        .catch(() =>
          setLocalError(
            "Üretim kayıtları yüklenemedi. Sayfayı yenileyip tekrar deneyin.",
          ),
        );
  }, [data, labelScope]);
  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    const q = new URLSearchParams(window.location.search),
      k = q.get("kind"),
      value = q.get("id");
    if (k && Object.keys(LABEL_NAMES).includes(k)) {
      setKind(k as LabelKind);
      if (value) setId(value);
    }
  }, [data]);
  const source =
    kind === "lot"
      ? data?.lots
      : kind === "item"
        ? data?.items
        : kind === "location"
          ? data?.locations
          : kind === "job"
            ? production?.jobs
            : kind === "cut"
              ? production?.plans
              : production?.units;
  const options =
    source?.filter(
      (r: any) =>
        !search ||
        (
          (r.name || r.title || r.lot_number || r.code || r.serial || r.id) +
          " " +
          (r.sku || "")
        )
          .toLocaleLowerCase("tr-TR")
          .includes(search.toLocaleLowerCase("tr-TR")),
    ) || [];
  async function add(value = id) {
    setLocalError("");
    setFeedback("");
    setPreparing(true);
    try {
      if (!value) throw Error("Etiketlenecek kaydı seçin");
      const label = await command("label.issue", { kind, id: value });
      setLabels((old) =>
        old.some((l) => l.id === label.id) ? old : [...old, label],
      );
      setFeedback("Etiket baskı listesine eklendi.");
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setPreparing(false);
    }
  }
  async function addVisible() {
    setLocalError("");
    setPreparing(true);
    try {
      const selected = options.slice(0, Math.min(20, 100 - labels.length));
      const next: any[] = [];
      for (const r of selected)
        next.push(await command("label.issue", { kind, id: r.id }));
      setLabels((old) => [
        ...old,
        ...next.filter((l) => !old.some((x) => x.id === l.id)),
      ]);
      setFeedback(selected.length + " etiket hazırlandı.");
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setPreparing(false);
    }
  }
  async function print() {
    if (!labels.every((l) => ready[l.code])) return;
    setLocalError("");
    setPreparing(true);
    try {
      await command("label.print", { ids: labels.map((l) => l.id) });
      setFeedback("Yazdırma penceresi açıldı. Yazıcı ölçeğini %100 seçin.");
      window.print();
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setPreparing(false);
    }
  }
  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback("Etiket kodu kopyalandı.");
    } catch {
      setLocalError(
        "Kopyalama izni yok. Etiketin altındaki kodu seçip kopyalayın.",
      );
    }
  }
  const size = layout === "80x50" ? "80x50" : "100x70",
    total = labels.length * copies;
  return (
    <div className="space-y-6 rf-label-center">
      <style>{`@media print{@page{size:${layout === "a4" ? "A4" : layout === "80x50" ? "80mm 50mm" : "100mm 70mm"};margin:${layout === "a4" ? "5mm" : "0"}}.rf-dashboard-shell,.rf-dashboard-shell main{background:white!important}.rf-dashboard-shell,.rf-dashboard-shell>div,#workspace-content,#workspace-content>div,.rf-label-center,.rf-label-sheet,.rf-label-wrapper{min-height:0!important;height:auto!important}.rf-workspace-header,.rf-sidebar,nav,.rf-warehouse-header,.rf-print-hidden,.rf-dashboard-shell>button,.rf-dashboard-shell>nav,[data-sonner-toaster]{display:none!important}.rf-page{padding:0!important}.rf-label-center{margin:0!important}.rf-label-sheet{display:${layout === "a4" ? "grid" : "block"}!important;grid-template-columns:repeat(2,100mm)!important;gap:0!important;padding:0!important;background:white!important}.rf-factory-label{width:${layout === "80x50" ? "80mm" : "100mm"}!important;height:calc(${layout === "80x50" ? "50mm" : "70mm"} - .2mm)!important;border:${layout === "a4" ? "1px dashed #ccc" : "0"}!important;box-shadow:none!important;margin:0!important;break-inside:avoid;${layout === "a4" ? "" : "break-after:page;"}}.rf-label-wrapper:last-child .rf-factory-label{break-after:auto!important}}`}</style>
      <section className="rf-panel rf-print-hidden">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="rf-eyebrow">RAF · MALZEME · ÜRETİM</p>
            <h2 className="mt-2 text-xl font-semibold">
              Doğru etiketi, doğru yere.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Telefon için QR, el terminali için Code 128. İki kod da aynı kaydı
              açar.
            </p>
          </div>
          <Printer className="text-primary" size={26} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="rf-field">
            Etiket türü
            <select
              aria-label="Etiket türü"
              className="rf-input"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as LabelKind);
                setId("");
                setSearch("");
              }}
            >
              {Object.entries(LABEL_NAMES)
                .filter(
                  ([k]) => !["job", "cut", "product"].includes(k) || production,
                )
                .map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label className="rf-field">
            Kayıt ara
            <input
              className="rf-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kod, lot, raf veya ad…"
            />
          </label>
          <label className="rf-field">
            Etiketlenecek kayıt
            <select
              aria-label="Etiketlenecek kayıt"
              className="rf-input"
              value={id}
              onChange={(e) => setId(e.target.value)}
            >
              <option value="">Kayıt seçin</option>
              {options.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.lot_number ||
                    r.title ||
                    r.name ||
                    r.code ||
                    "Ürün " + r.serial ||
                    r.id}{" "}
                  {r.sku ? "· " + r.sku : ""}{" "}
                  {r.code && kind === "location" ? "· " + r.code : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rf-primary-button"
            disabled={
              busy || preparing || !online || !id || labels.length >= 100
            }
            onClick={() => void add()}
          >
            <Plus size={16} />
            Baskı listesine ekle
          </button>
          <button
            className="rf-secondary-button"
            disabled={
              busy ||
              preparing ||
              !online ||
              !options.length ||
              labels.length >= 100
            }
            onClick={() => void addVisible()}
          >
            Listedeki ilk 20 kaydı ekle
          </button>
          <span className="self-center text-xs text-muted-foreground">
            {options.length} kayıt · en fazla 100 etiket
          </span>
        </div>
        {(error || localError) && (
          <p
            role="alert"
            className="mt-4 text-sm text-rose-600 dark:text-rose-400"
          >
            {localError || error}
          </p>
        )}
        {feedback && (
          <p
            role="status"
            className="mt-4 flex gap-2 text-sm text-emerald-700 dark:text-emerald-400"
          >
            <Check size={17} />
            {feedback}
          </p>
        )}
      </section>
      <div className="rf-panel rf-print-hidden flex flex-wrap items-end gap-4">
        <label className="rf-field">
          Baskı düzeni
          <select
            aria-label="Baskı düzeni"
            className="rf-input"
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
          >
            <option value="a4">A4 · 100 × 70 mm etiketler</option>
            <option value="100x70">Termal · 100 × 70 mm</option>
            <option value="80x50">Termal · 80 × 50 mm</option>
          </select>
        </label>
        <label className="rf-field">
          Her etiketten kopya
          <input
            className="rf-input w-24"
            type="number"
            min={1}
            max={20}
            value={copies}
            onChange={(e) =>
              setCopies(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
            }
          />
        </label>
        <button
          className="rf-primary-button min-h-11"
          disabled={
            busy ||
            preparing ||
            !online ||
            !labels.length ||
            total > 100 ||
            !labels.every((l) => ready[l.code])
          }
          onClick={() => void print()}
        >
          <Printer size={17} />
          {total} etiket yazdır
        </button>
        <p className="max-w-sm text-xs leading-5 text-muted-foreground">
          Ölçek %100; üstbilgi/altbilgi kapalı.{" "}
          {total > 100
            ? "Bir baskıda en fazla 100 kopya hazırlayın."
            : "Baskı isteği kaydedilir; fiziksel yazıcı teslimatı tarayıcı tarafından doğrulanmaz."}
        </p>
      </div>
      {!labels.length ? (
        <div className="rf-panel rf-print-hidden py-14 text-center">
          <ScanLine size={36} className="mx-auto text-primary" />
          <h3 className="mt-4 text-lg font-semibold">
            Etiketler burada hazırlanacak
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Bir raf, malzeme veya lot seçerek baskı listesine ekleyin.
          </p>
        </div>
      ) : (
        <div className="rf-label-sheet">
          {labels.flatMap((l) =>
            Array.from({ length: copies }, (_, i) => (
              <div className="rf-label-wrapper" key={l.id + ":" + i}>
                <FactoryLabel
                  label={{
                    ...l,
                    brand: user?.tenantName?.toLocaleUpperCase("tr-TR"),
                  }}
                  size={size}
                  onReady={onReady}
                />
                {i === 0 && (
                  <div className="rf-print-hidden mt-3 flex justify-between">
                    <button
                      className="rf-secondary-button"
                      onClick={() => void copy(l.code)}
                    >
                      <Copy size={15} />
                      Kodu kopyala
                    </button>
                    <button
                      className="rf-secondary-button"
                      aria-label={l.record.title + " etiketini kaldır"}
                      onClick={() =>
                        setLabels((old) => old.filter((x) => x.id !== l.id))
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            )),
          )}
        </div>
      )}
    </div>
  );
}
