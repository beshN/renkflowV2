"use client";
import { COUNT_UNITS } from "@/lib/features/inventory/vocabulary";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Package,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import BarcodeScanner from "./BarcodeScanner";
import { useWarehouse } from "./useWarehouse";
import { useAuth } from "@/lib/context/AuthContext";
import {
  LABEL_NAMES,
  type LabelKind,
} from "@/lib/features/warehouse/contracts";
const quantity = (q: any) =>
  Number(q || 0).toLocaleString("tr-TR", { maximumFractionDigits: 6 });
export default function ScanTerminal() {
  const { user } = useAuth();
  const actorScope = user?.tenantId + ":" + user?.id + ":" + user?.role;
  const { data, error, busy, online, refresh, command } = useWarehouse();
  const [mode, setMode] = useState("lookup"),
    [record, setRecord] = useState<any>(null),
    [reading, setReading] = useState(false),
    [message, setMessage] = useState(""),
    [localError, setLocalError] = useState("");
  const [itemId, setItemId] = useState(""),
    [lotId, setLotId] = useState(""),
    [sourceId, setSourceId] = useState(""),
    [targetId, setTargetId] = useState(""),
    [qty, setQty] = useState(""),
    [note, setNote] = useState("");
  const initial = useRef(false),
    readSeq = useRef(0),
    lastScan = useRef({ code: "", time: 0 });
  useEffect(() => {
    ++readSeq.current;
    setRecord(null);
    setItemId("");
    setLotId("");
    setSourceId("");
    setTargetId("");
    setMessage("");
    setLocalError("");
    initial.current = false;
  }, [actorScope]);
  const writable =
    data && ["owner", "admin", "office"].includes(data.actor.role);
  async function scan(code: string) {
    if (
      lastScan.current.code === code &&
      Date.now() - lastScan.current.time < 1200
    )
      return;
    lastScan.current = { code, time: Date.now() };
    const seq = ++readSeq.current;
    setReading(true);
    setLocalError("");
    setMessage("");
    setRecord(null);
    try {
      const r = await fetch(
        "/api/v1/warehouse?code=" + encodeURIComponent(code),
        { cache: "no-store" },
      );
      const b = await r.json();
      if (seq !== readSeq.current) return;
      if (!r.ok) throw Error(b.error);
      const result = b.data;
      setRecord(result);
      if (result.kind === "item" || result.kind === "lot") {
        setItemId(result.itemId || result.id);
        setLotId(result.kind === "lot" ? result.id : "");
        if (result.locationId) setSourceId(result.locationId);
        setQty(result.kind === "lot" ? String(result.quantity) : "");
      }
      if (result.kind === "location") {
        if (mode === "transfer" && sourceId) setTargetId(result.id);
        else setSourceId(result.id);
      }
    } catch (e) {
      if (seq === readSeq.current)
        setLocalError((e as Error).message || "Etiket okunamadı");
    } finally {
      if (seq === readSeq.current) setReading(false);
    }
  }
  useEffect(() => {
    if (initial.current) return;
    initial.current = true;
    const params = new URLSearchParams(window.location.search);
    const requestedMode=params.get("mode");
    if(requestedMode && ["lookup","transfer","count"].includes(requestedMode))setMode(requestedMode);
    const code = params.get("code");
    if (code) void scan(code);
  }, [actorScope]);
  const item = data?.items.find((i: any) => i.id === itemId),
    balance = data?.balances.find(
      (b: any) => b.item_id === itemId && b.location_id === sourceId,
    );
  const lot = data?.lots.find((l: any) => l.id === lotId);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLocalError("");
    try {
      if (!balance)
        throw Error(
          "Kaynak rafta bu malzemenin kaydı yok. Mal kabulünü kontrol edin.",
        );
      const amount = Number(qty);
      if (!qty.trim() || !Number.isFinite(amount))
        throw Error("Geçerli miktar girin");
      const result =
        mode === "transfer"
          ? await command("transfer", {
              itemId,
              lotId: lotId || undefined,
              sourceId,
              targetId,
              quantity: amount,
              version: balance.version,
              note,
            })
          : await command("count.submit", {
              itemId,
              locationId: sourceId,
              quantity: amount,
              version: balance.version,
              reason: note,
            });
      setMessage(
        mode === "transfer"
          ? "Transfer kaydedildi · " + result.entryNumber
          : "Sayım yönetici incelemesine gönderildi. Stok henüz değiştirilmedi.",
      );
      setQty("");
      setNote("");
      setLotId("");
      setRecord(null);
    } catch (e) {
      setLocalError((e as Error).message);
    }
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
      <div className="space-y-5">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Tarama işlemi"
        >
          {[
            ["lookup", "Kayıt sorgula"],
            ["transfer", "Raf transferi"],
            ["count", "Stok sayımı"],
          ].map(([key, label]) => (
            <button
              key={key}
              disabled={(!writable && key !== "lookup") || busy}
              aria-pressed={mode === key}
              className={
                mode === key ? "rf-primary-button" : "rf-secondary-button"
              }
              onClick={() => {
                setMode(key);
                setMessage("");
                setLocalError("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <BarcodeScanner
          onScan={(code) => void scan(code)}
          busy={reading || busy}
        />
        {!online && (
          <p role="status" className="rf-alert">
            <WifiOff size={20} />
            Çevrim dışısınız. Stok yazma işlemleri bağlantı gelene kadar kapalı.
          </p>
        )}
        {(error || localError) && (
          <div
            role="alert"
            className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"
          >
            {localError || error}
            <button className="ml-3 underline" onClick={() => void refresh()}>
              Veriyi yenile
            </button>
          </div>
        )}
        {message && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
          >
            <CheckCircle2 size={20} />
            {message}
          </p>
        )}
        {record && (
          <article className="rf-panel rf-scan-result">
            <div className="flex items-start gap-4">
              <div className="rf-result-icon">
                {record.kind === "location" ? (
                  <MapPin size={24} />
                ) : (
                  <Package size={24} />
                )}
              </div>
              <div className="min-w-0">
                <p className="rf-eyebrow">
                  {LABEL_NAMES[record.kind as LabelKind] || "Üretim kaydı"}
                </p>
                <h2 className="mt-2 break-words text-xl font-semibold">
                  {record.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {record.subtitle || record.summary}
                </p>
                {record.quantity !== undefined && (
                  <p className="mt-3 font-mono text-sm">
                    {quantity(record.quantity)} {record.uom} · {record.color} ·{" "}
                    {record.status}
                  </p>
                )}
                {record.code && (
                  <p className="mt-3 font-mono text-xs text-muted-foreground">
                    {record.code}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {record.href && (
                <Link href={record.href} className="rf-primary-button">
                  İlgili işi aç
                  <ArrowRight size={16} />
                </Link>
              )}
              <Link
                href={
                  "/warehouse/labels?kind=" + record.kind + "&id=" + record.id
                }
                className="rf-secondary-button"
              >
                Etiket hazırla
              </Link>
            </div>
          </article>
        )}
        {mode !== "lookup" && writable && (
          <form onSubmit={submit} className="rf-panel space-y-5">
            <div>
              <h2 className="rf-section-title">
                {mode === "transfer"
                  ? "Kaynak → hedef doğrulaması"
                  : "Raf sayım kaydı"}
              </h2>
              <p className="mt-2 text-xs text-muted-foreground">
                {mode === "transfer"
                  ? "Malzemeyi veya lotu, ardından kaynak ve hedef rafı okutun."
                  : "Fiilen sayılan miktarı girin. Farklar yönetici onayından önce stoğa yansımaz."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="rf-field">
                Malzeme
                <select
                  aria-label="Malzeme"
                  className="rf-input"
                  value={itemId}
                  onChange={(e) => {
                    setItemId(e.target.value);
                    setLotId("");
                    setQty("");
                  }}
                  required
                >
                  <option value="">Malzeme seçin / okutun</option>
                  {data?.items.map((i: any) => (
                    <option key={i.id} value={i.id}>
                      {i.sku} · {i.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="rf-field">
                Kaynak raf
                <select
                  aria-label="Kaynak raf"
                  className="rf-input"
                  value={sourceId}
                  onChange={(e) => {
                    setSourceId(e.target.value);
                    setLotId("");
                    setQty("");
                  }}
                  required
                >
                  <option value="">Raf seçin / okutun</option>
                  {data?.locations.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.warehouse_code} / {l.code}
                    </option>
                  ))}
                </select>
              </label>
              {mode === "transfer" && (
                <>
                  <label className="rf-field">
                    Fiziksel lot
                    <select
                      aria-label="Fiziksel lot"
                      className="rf-input"
                      value={lotId}
                      onChange={(e) => {
                        setLotId(e.target.value);
                        const l = data.lots.find(
                          (x: any) => x.id === e.target.value,
                        );
                        if (l) setQty(String(l.remaining_qty));
                      }}
                    >
                      <option value="">Lot takibi olmayan malzeme</option>
                      {data?.lots
                        .filter(
                          (l: any) =>
                            l.item_id === itemId && l.location_id === sourceId,
                        )
                        .map((l: any) => (
                          <option key={l.id} value={l.id}>
                            {l.lot_number} · {quantity(l.remaining_qty)}{" "}
                            {l.stock_uom} · {l.status}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="rf-field">
                    Hedef raf
                    <select
                      aria-label="Hedef raf"
                      className="rf-input"
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      required
                    >
                      <option value="">Hedefi seçin / okutun</option>
                      {data?.locations
                        .filter((l: any) => l.id !== sourceId)
                        .map((l: any) => (
                          <option key={l.id} value={l.id}>
                            {l.warehouse_code} / {l.code}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
              <label className="rf-field">
                {mode === "count" ? "Sayılan miktar" : "Taşınacak miktar"}{" "}
                {item ? "(" + item.stock_uom + ")" : ""}
                <input
                  type="number"
                  min={
                    mode === "count"
                      ? 0
                      : COUNT_UNITS.has(item?.stock_uom ?? "")
                        ? 1
                        : 0.000001
                  }
                  step={COUNT_UNITS.has(item?.stock_uom ?? "") ? 1 : "any"}
                  className="rf-input"
                  value={qty}
                  readOnly={mode === "transfer" && !!lot && item?.stock_uom === "m"}
                  onChange={(e) => setQty(e.target.value)}
                  required
                />
              </label>
              <div className="rounded-xl bg-accent/70 p-4">
                <p className="text-xs text-muted-foreground">
                  Kaynak raftaki güncel miktar
                </p>
                <p className="mt-2 text-xl font-semibold tabular-nums">
                  {balance
                    ? quantity(balance.quantity) + " " + item?.stock_uom
                    : "—"}
                </p>
              </div>
            </div>
            <label className="rf-field">
              {mode === "count" ? "Sayım gerekçesi" : "Transfer notu"}
              <textarea
                className="rf-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required={mode === "count"}
                minLength={mode === "count" ? 5 : undefined}
                maxLength={1000}
                rows={2}
              />
            </label>
            <button
              className="rf-primary-button min-h-12 w-full sm:w-auto"
              disabled={busy || !online || !balance}
            >
              {busy
                ? "Kaydediliyor…"
                : mode === "transfer"
                  ? "Transferi onayla"
                  : "Sayıma gönder"}
            </button>
          </form>
        )}
      </div>
      <aside className="space-y-5">
        <section className="rf-panel">
          <ShieldCheck size={24} className="text-primary" />
          <h2 className="mt-4 font-semibold">Her hareketin bir kaydı var.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            İşlem; kullanıcı, zaman, malzeme ve raf bilgisiyle stok defterine
            yazılır. Aynı isteği tekrar göndermek ikinci bir hareket oluşturmaz.
          </p>
          <div className="mt-5 space-y-3 border-t border-border pt-5">
            {[
              ["01", "Etiketi okut"],
              ["02", "Malzeme ve konumu doğrula"],
              ["03", "Miktarı kontrol edip onayla"],
            ].map(([n, label]) => (
              <p key={n} className="flex gap-3 text-sm">
                <span className="font-mono text-primary">{n}</span>
                {label}
              </p>
            ))}
          </div>
        </section>
        <section className="rf-panel">
          <h2 className="rf-section-title">İşe bağlı hareketler</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Mal kabul, üretim tüketimi ve sevkiyat kendi iş belgeleriyle yürür.
          </p>
          <div className="mt-4 grid gap-2">
            {[
              { href: "/receipts", label: "Mal kabul" },
              { href: "/factory", label: "Üretime teslim / tüketim" },
              { href: "/shipments", label: "Paketleme & sevkiyat" },
            ]
              .filter(
                (x) => data?.actor.role !== "worker" || x.href === "/factory",
              )
              .map((x) => (
                <Link
                  key={x.href}
                  href={x.href}
                  className="rf-secondary-button justify-between"
                >
                  {x.label}
                  <ArrowRight size={15} />
                </Link>
              ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
