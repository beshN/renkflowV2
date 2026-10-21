"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useCommandRetry } from "@/lib/hooks/useCommandRetry";
import { requestJson } from "@/lib/shared/network";
import type { workshopOverview } from "@/lib/features/manufacturing/workshop.server";
type Data = Awaited<ReturnType<typeof workshopOverview>>;
const statuses: Record<string, string> = {
  submitted: "Bekliyor",
  approved: "Onaylandı",
  ordered: "Tedarik ediliyor",
  closed: "Karşılandı",
  cancelled: "İptal",
  checked: "Kabul onayı bekliyor",
  accepted: "Kabul edildi",
  rejected: "Reddedildi",
};
export async function workshopCommand(body: unknown) {
  const r = await requestJson("/api/v1/production/workshop", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(r.error || "İşlem tamamlanamadı");
  return r.data;
}
export function WorkshopPanel({
  mode = "requests",
  orderId,
  workOrderId,
}: {
  mode?: "requests" | "receiving";
  orderId?: string;
  workOrderId?: string;
}) {
  const sendCommand = useCommandRetry();
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await requestJson<Data>("/api/v1/production/workshop", {
      cache: "no-store",
    });
    if (r.ok && r.data) {
      setData(r.data);
      setError("");
    } else setError(r.error || "Kayıtlar alınamadı");
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (body: unknown) => {
    setBusy(true);
    try {
      if ((body as any)?.data?.commandId) {
        const r = await sendCommand(
          "/api/v1/production/workshop",
          body as any,
          "data",
        );
        if (!r.ok) throw new Error(r.error || "İşlem tamamlanamadı");
      } else await workshopCommand(body);
      toast.success("Kaydedildi");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Kayıtlar yükleniyor…</p>;
  return (
    <section
      className="space-y-4"
      aria-label={
        mode === "requests" ? "İhtiyaç talepleri" : "Mal kabul kontrolleri"
      }
    >
      <h2 className="text-lg font-semibold">
        {mode === "requests" ? "İhtiyaç talepleri" : "Mal kabul"}
      </h2>
      {mode === "requests" ? (
        <>
          {orderId && (
            <RequestForm
              orderId={orderId}
              workOrderId={workOrderId}
              items={data.items}
              warehouses={data.warehouses}
              submit={act}
              busy={busy}
            />
          )}
          {data.requests
            .filter((r: any) => !orderId || r.order_id === orderId)
            .map((r: any) => (
              <article key={r.id} className="rf-panel space-y-2 p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-medium">
                    {r.order_number} · {r.request_number}
                  </p>
                  <span className="text-sm">
                    {statuses[r.status] || r.status}
                  </span>
                </div>
                <p className="text-sm">{r.description}</p>
                {r.lines.map((l: any) => (
                  <p key={l.id} className="text-sm text-muted-foreground">
                    {l.name} · {l.quantity} {l.uom} · Karşılanan {l.received}
                  </p>
                ))}
                {r.required_by && (
                  <p className="text-sm">
                    İhtiyaç tarihi: {r.required_by.slice(0, 10)}
                  </p>
                )}
                {data.canPurchase &&
                  ["approved", "ordered"].includes(r.status) && (
                    <RequestPurchase
                      request={r}
                      suppliers={data.suppliers}
                      warehouses={data.warehouses}
                      submit={act}
                      busy={busy}
                    />
                  )}
                {data.canApprove && r.status === "submitted" && (
                  <button
                    disabled={busy}
                    className="rf-secondary-button"
                    onClick={() =>
                      void act({
                        action: "request.approve",
                        id: r.id,
                        version: r.version,
                      })
                    }
                  >
                    Talebi onayla
                  </button>
                )}
              </article>
            ))}
          {!data.requests.length && (
            <p className="text-sm text-muted-foreground">
              Henüz ihtiyaç talebi yok.
            </p>
          )}
        </>
      ) : (
        <>
          {data.orders.map((o: any) => (
            <ReceivingForm
              key={o.id + ":" + o.version}
              order={o}
              warehouses={data.warehouses}
              submit={act}
              busy={busy}
            />
          ))}
          {data.inspections.map((i: any) => (
            <article key={i.id} className="rf-panel space-y-2 p-3">
              <p className="font-medium">{statuses[i.status]}</p>
              <p className="text-sm">
                {new Date(i.checked_at).toLocaleString("tr-TR")}
              </p>
              <p className="text-sm">{i.notes}</p>
              {i.checklist.lines.map((l: any) => (
                <p key={l.lineId} className="text-sm">
                  Kabul {l.acceptedQty} · Red {l.rejectedQty}
                  {l.rejectionReason ? " · " + l.rejectionReason : ""}
                </p>
              ))}
              {data.canApprove && i.status === "checked" && (
                <button
                  className="rf-primary-button"
                  disabled={busy}
                  onClick={() =>
                    void act({
                      action: "receipt.approve",
                      id: i.id,
                      version: i.version,
                    })
                  }
                >
                  Nihai kabulü onayla
                </button>
              )}
              {i.status === "accepted" && (
                <p className="text-sm text-muted-foreground">
                  Sağlam miktar stoğa işlendi. Etiketler Stok–Depo bölümünden
                  basılabilir.
                </p>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
function RequestForm({
  orderId,
  workOrderId,
  items,
  warehouses,
  submit,
  busy,
}: {
  orderId: string;
  workOrderId?: string;
  items: any[];
  warehouses: any[];
  submit: (v: unknown) => Promise<void>;
  busy: boolean;
}) {
  const [item, setItem] = useState(""),
    [warehouse, setWarehouse] = useState(() =>
      onlyWarehouse(warehouses, "RAW"),
    ),
    [quantity, setQuantity] = useState(""),
    [description, setDescription] = useState(""),
    [requiredBy, setRequiredBy] = useState(""),
    [photoPaths, setPhotos] = useState<string[]>([]);
  return (
    <form
      className="rf-panel space-y-3 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit({
          action: "request.create",
          data: {
            commandId: crypto.randomUUID(),
            orderId,
            workOrderId,
            itemId: item || undefined,
            warehouseId: warehouse || undefined,
            quantity: item ? Number(quantity) : undefined,
            description,
            requiredBy: requiredBy || undefined,
            photos: photoPaths,
          },
        });
      }}
    >
      <h3 className="font-medium">Bu sipariş için ihtiyaç bildir</h3>
      <WarehouseChoice
        warehouses={warehouses}
        type="RAW"
        value={warehouse}
        onChange={setWarehouse}
        required={!!item && !workOrderId}
        label="İhtiyacın deposu"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Malzeme
          <select
            className="rf-input mt-1 w-full"
            value={item}
            onChange={(e) => setItem(e.target.value)}
          >
            <option value="">Diğer ihtiyaç / kartı bulunmayan malzeme</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · {i.stock_uom}
              </option>
            ))}
          </select>
        </label>
        {item && (
          <label className="text-sm">
            Miktar · {items.find((i) => i.id === item)?.stock_uom}
            <input
              className="rf-input mt-1 w-full"
              required
              type="number"
              min="0.001"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
        )}
        <label className="text-sm">
          İhtiyaç tarihi
          <input
            className="rf-input mt-1 w-full"
            type="date"
            value={requiredBy}
            onChange={(e) => setRequiredBy(e.target.value)}
          />
        </label>
      </div>
      <label className="block text-sm">
        Açıklama
        <textarea
          required
          minLength={3}
          maxLength={2000}
          className="rf-input mt-1 w-full"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {workOrderId && (
        <WorkshopPhotoInput
          workOrderId={workOrderId}
          onUploaded={(url) => setPhotos((p) => [...p, url])}
        />
      )}
      <button className="rf-primary-button" disabled={busy}>
        Talebi gönder
      </button>
    </form>
  );
}
export function WorkshopPhotoInput({
  workOrderId,
  purchaseOrderId,
  onUploaded,
}: {
  workOrderId?: string;
  purchaseOrderId?: string;
  onUploaded: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [count, setCount] = useState(0);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const base64 = await fileBase64(file);
      const r = await requestJson<{ data: { url: string } }>(
        "/api/v1/production/files",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            mime: file.type,
            base64,
            workOrderId,
            purchaseOrderId,
          }),
        },
      );
      if (!r.ok || !r.data) throw new Error(r.error || "Fotoğraf yüklenemedi");
      onUploaded(r.data.data.url);
      setCount((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fotoğraf yüklenemedi");
    } finally {
      setBusy(false);
    }
  };
  return (
    <label className="block text-sm">
      Fotoğraf ekle{count ? ` · ${count} eklendi` : ""}
      <input
        className="mt-1 block max-w-full"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      {busy && <span role="status">Yükleniyor…</span>}
    </label>
  );
}
export function fileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error("Dosya okunamadı"));
    r.readAsDataURL(file);
  });
}
function ReceivingForm({
  order,
  warehouses,
  submit,
  busy,
}: {
  order: any;
  warehouses: any[];
  submit: (v: unknown) => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false),
    [values, setValues] = useState<
      Record<
        string,
        {
          accepted: string;
          rejected: string;
          length: string;
          reason: string;
          color: string;
        }
      >
    >({}),
    [extraBars, setExtraBars] = useState<
      Record<
        string,
        Array<{ length: string; accepted: string; rejected: string }>
      >
    >({}),
    [rejectedColor, setRejectedColor] = useState<Record<string, string>>({}),
    [rejectWarehouse, setRejectWarehouse] = useState(() =>
      onlyWarehouse(warehouses, "REJECTED"),
    ),
    [paths, setPaths] = useState<string[]>([]),
    [documentId, setDocument] = useState<string>(),
    [reading, setReading] = useState(false),
    [extracted, setExtracted] = useState<any[]>([]),
    [matches, setMatches] = useState<any[]>([]),
    [documentMatches, setDocumentMatches] = useState<Record<number, string>>(
      {},
    ),
    [confirmed, setConfirmed] = useState(false);
  const patch = (id: string, key: string, value: string) =>
    setValues((v) => ({
      ...v,
      [id]: {
        ...(v[id] || {
          accepted: "0",
          rejected: "0",
          length: "",
          reason: "",
          color: "",
        }),
        [key]: value,
      },
    }));
  const read = async (file: File) => {
    setReading(true);
    try {
      const d: any = await workshopCommand({
        action: "document.read",
        data: {
          name: file.name,
          mime: file.type,
          base64: await fileBase64(file),
          purchaseOrderId: order.id,
        },
      });
      setDocument(d.id);
      setExtracted(d.extracted || []);
      setMatches(d.matches || []);
      setDocumentMatches(
        Object.fromEntries(
          (d.matches || [])
            .filter((m: any) => m.suggestedLineId)
            .map((m: any) => [m.rowIndex, m.suggestedLineId]),
        ),
      );
      toast.success(d.message || "Belge okundu; eşleştirmeleri kontrol edin");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Belge okunamadı");
    } finally {
      setReading(false);
    }
  };
  return (
    <article className="rf-panel p-3">
      <button
        type="button"
        className="flex w-full justify-between gap-2 text-left font-medium"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {order.purchase_order_number}
        <span>{open ? "Kapat" : "Mal kontrolü yap"}</span>
      </button>
      {open && (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const lines = order.lines.flatMap((l: any) => {
              const v = values[l.id] || {
                accepted: "0",
                rejected: "0",
                length: "",
                color: "",
                reason: "",
              };
              const physical = [v, ...(extraBars[l.id] || [])];
              const bars =
                l.uom === "m"
                  ? physical
                      .flatMap((row) => [
                        {
                          lengthMm: Number(row.length),
                          count: Number(row.accepted),
                          disposition: "accepted",
                        },
                        {
                          lengthMm: Number(row.length),
                          count: Number(row.rejected),
                          disposition: "rejected",
                        },
                      ])
                      .filter((bar) => bar.count > 0)
                  : undefined;
              const acceptedQty = bars
                ? bars
                    .filter((b) => b.disposition === "accepted")
                    .reduce((n, b) => n + (b.count * b.lengthMm) / 1000, 0)
                : Number(v.accepted);
              const rejectedQty = bars
                ? bars
                    .filter((b) => b.disposition === "rejected")
                    .reduce((n, b) => n + (b.count * b.lengthMm) / 1000, 0)
                : Number(v.rejected);
              if (acceptedQty + rejectedQty === 0) return [];
              return [
                {
                  lineId: l.id,
                  acceptedQty,
                  rejectedQty,
                  color: l.color || v.color,
                  rejectedColor: rejectedColor[l.id] || undefined,
                  rejectedWarehouseId:
                    rejectedQty > 0 ? rejectWarehouse : undefined,
                  rejectionReason: v.reason,
                  bars,
                },
              ];
            });
            void submit({
              action: "receipt.check",
              data: {
                checked: confirmed,
                commandId: crypto.randomUUID(),
                documentId,
                documentMatches: Object.entries(documentMatches)
                  .filter(([, lineId]) => lineId)
                  .map(([rowIndex, lineId]) => ({
                    rowIndex: Number(rowIndex),
                    lineId,
                  })),
                receipt: {
                  purchaseOrderId: order.id,
                  version: order.version,
                  notes: "Fiziksel ürün, renk ve miktar kontrol edildi",
                  lines,
                },
                photos: paths,
              },
            });
          }}
        >
          <label className="block text-sm">
            Fatura / irsaliye yükle
            <input
              className="mt-1 block max-w-full"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={reading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void read(f);
              }}
            />
          </label>
          {!!extracted.length && (
            <details>
              <summary>
                Belgeden okunan satırlar · eşleştirmeyi kontrol edin
              </summary>
              <ul className="mt-2 space-y-1 text-sm">
                {extracted.map((l, i) => (
                  <li key={i}>
                    {l.text ||
                      [
                        l.profileCode,
                        l.description,
                        l.quantity,
                        l.unit,
                        l.color,
                        l.lengthMm ? l.lengthMm + " mm" : "",
                      ]
                        .filter((v) => v != null)
                        .join(" · ")}{" "}
                    · Sayfa {l.page}
                    <label className="mt-1 block text-xs">
                      Satın alma kalemi
                      <select
                        className="rf-input mt-1 w-full"
                        value={documentMatches[i] || ""}
                        onChange={(e) =>
                          setDocumentMatches((v) => ({
                            ...v,
                            [i]: e.target.value,
                          }))
                        }
                      >
                        <option value="">
                          Eşleştirilmedi / malzeme satırı değil
                        </option>
                        {order.lines.map((line: any) => (
                          <option key={line.id} value={line.id}>
                            {line.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {matches[i]?.candidates
                      ?.find((m: any) => m.lineId === documentMatches[i])
                      ?.issues?.map((issue: string) => (
                        <p
                          key={issue}
                          className="text-xs text-amber-700 dark:text-amber-300"
                        >
                          {issue}
                        </p>
                      ))}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {order.lines.map((l: any) => (
            <fieldset
              key={l.id}
              className="space-y-2 rounded border border-border p-3"
            >
              <legend className="px-1 font-medium">{l.name}</legend>
              <p className="text-sm">
                Sipariş {l.ordered} {l.uom} · Önceki kabul {l.received} ·
                Beklenen {Number(l.ordered) - Number(l.received)} {l.uom}
              </p>
              <p className="text-sm">
                {l.color || "Renk kontrol edilmeli"}
                {l.lengthMm ? ` · Sipariş boyu ${l.lengthMm} mm` : ""}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {l.uom === "m" && (
                  <label className="text-sm">
                    Gerçekte gelen çubuk boyu · mm
                    <input
                      required={
                        Number(values[l.id]?.accepted || 0) +
                          Number(values[l.id]?.rejected || 0) >
                        0
                      }
                      className="rf-input mt-1 w-full"
                      type="number"
                      min={100}
                      max={30000}
                      value={values[l.id]?.length || ""}
                      onChange={(e) => patch(l.id, "length", e.target.value)}
                    />
                  </label>
                )}
                <label className="text-sm">
                  Sağlam · {l.uom === "m" ? "çubuk adedi" : l.uom}
                  <input
                    className="rf-input mt-1 w-full"
                    type="number"
                    min={0}
                    step={l.uom === "m" || l.uom === "adet" ? 1 : "any"}
                    value={values[l.id]?.accepted || "0"}
                    onChange={(e) => patch(l.id, "accepted", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Hasarlı / yanlış · {l.uom === "m" ? "çubuk adedi" : l.uom}
                  <input
                    className="rf-input mt-1 w-full"
                    type="number"
                    min={0}
                    step={l.uom === "m" || l.uom === "adet" ? 1 : "any"}
                    value={values[l.id]?.rejected || "0"}
                    onChange={(e) => patch(l.id, "rejected", e.target.value)}
                  />
                </label>
                {(Number(values[l.id]?.rejected) > 0 ||
                  (extraBars[l.id] || []).some(
                    (b) => Number(b.rejected) > 0,
                  )) && (
                  <label className="text-sm">
                    Hasar / yanlış ürün açıklaması
                    <input
                      required
                      minLength={5}
                      className="rf-input mt-1 w-full"
                      value={values[l.id]?.reason || ""}
                      onChange={(e) => patch(l.id, "reason", e.target.value)}
                    />
                  </label>
                )}
                {!l.color && l.uom === "m" && (
                  <label className="text-sm">
                    Doğrulanan renk / yüzey
                    <input
                      className="rf-input mt-1 w-full"
                      value={values[l.id]?.color || ""}
                      onChange={(e) => patch(l.id, "color", e.target.value)}
                    />
                  </label>
                )}
              </div>
              {l.uom === "m" && (
                <div className="space-y-3">
                  {(extraBars[l.id] || []).map((bar, index) => (
                    <div
                      className="grid gap-2 rounded border border-border p-2 sm:grid-cols-3"
                      key={index}
                    >
                      {[
                        ["length", "Gerçek boy · mm"],
                        ["accepted", "Sağlam çubuk adedi"],
                        ["rejected", "Hasarlı / yanlış çubuk adedi"],
                      ].map(([key, label]) => (
                        <label key={key} className="text-sm">
                          {label}
                          <input
                            required
                            type="number"
                            step={1}
                            min={key === "length" ? 100 : 0}
                            max={key === "length" ? 30000 : 10000}
                            className="rf-input mt-1 w-full"
                            value={bar[key as keyof typeof bar]}
                            onChange={(e) =>
                              setExtraBars((all) => ({
                                ...all,
                                [l.id]: all[l.id].map((v, i) =>
                                  i === index
                                    ? { ...v, [key]: e.target.value }
                                    : v,
                                ),
                              }))
                            }
                          />
                        </label>
                      ))}
                      <button
                        type="button"
                        className="text-sm text-destructive"
                        onClick={() =>
                          setExtraBars((all) => ({
                            ...all,
                            [l.id]: all[l.id].filter((_, i) => i !== index),
                          }))
                        }
                      >
                        Bu boyu kaldır
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="rf-secondary-button"
                    onClick={() =>
                      setExtraBars((all) => ({
                        ...all,
                        [l.id]: [
                          ...(all[l.id] || []),
                          { length: "", accepted: "0", rejected: "0" },
                        ],
                      }))
                    }
                  >
                    Farklı gerçek boy ekle
                  </button>
                </div>
              )}
              {l.uom === "m" &&
                (Number(values[l.id]?.rejected) > 0 ||
                  (extraBars[l.id] || []).some(
                    (b) => Number(b.rejected) > 0,
                  )) && (
                  <label className="block text-sm">
                    Yanlış gelen ürünün gerçek rengi / yüzeyi
                    <input
                      className="rf-input mt-1 w-full"
                      value={rejectedColor[l.id] || ""}
                      onChange={(e) =>
                        setRejectedColor((v) => ({
                          ...v,
                          [l.id]: e.target.value,
                        }))
                      }
                      placeholder="Renk farklıysa yazın"
                    />
                  </label>
                )}
            </fieldset>
          ))}
          {order.lines.some(
            (l: any) =>
              Number(values[l.id]?.rejected) > 0 ||
              (extraBars[l.id] || []).some((b) => Number(b.rejected) > 0),
          ) && (
            <WarehouseChoice
              warehouses={warehouses}
              type="REJECTED"
              value={rejectWarehouse}
              onChange={setRejectWarehouse}
              required
              label="Hasarlı / yanlış ürün deposu"
            />
          )}
          <WorkshopPhotoInput
            purchaseOrderId={order.id}
            onUploaded={(url) => setPaths((p) => [...p, url])}
          />
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Ürünleri, renk/yüzeyi, fiziksel boyları ve miktarları teslimatta
            kontrol ettim.
          </label>
          <p className="text-sm text-muted-foreground">
            Bu kayıt stok artırmaz. Nihai kabul yetkilisi onayladığında sağlam
            miktar stoğa girer.
          </p>
          <button className="rf-primary-button" disabled={busy || !confirmed}>
            Fiziksel kontrolü kaydet
          </button>
        </form>
      )}
    </article>
  );
}

function RequestPurchase({
  request,
  suppliers,
  warehouses,
  submit,
  busy,
}: {
  request: any;
  suppliers: any[];
  warehouses: any[];
  submit: (v: unknown) => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false),
    [supplier, setSupplier] = useState(""),
    [warehouse, setWarehouse] = useState(() =>
      onlyWarehouse(warehouses, "RAW"),
    ),
    [lineId, setLine] = useState(request.lines[0]?.id || ""),
    [length, setLength] = useState(""),
    [quantity, setQuantity] = useState(""),
    [price, setPrice] = useState(""),
    [color, setColor] = useState(""),
    [excess, setExcess] = useState(false);
  const l = request.lines.find((l: any) => l.id === lineId);
  if (!l) return null;
  return (
    <div>
      <button
        type="button"
        className="rf-secondary-button"
        onClick={() => setOpen(!open)}
      >
        Bu ihtiyaç için satın alma hazırla
      </button>
      {open && (
        <form
          className="mt-3 grid gap-3 rounded border border-border p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit({
              action: "purchase.create",
              data: {
                commandId: crypto.randomUUID(),
                purchase: {
                  supplierId: supplier,
                  notes: request.request_number,
                  currency: "TRY",
                  lines: [
                    {
                      itemId: l.itemId,
                      warehouseId: warehouse,
                      quantity: Number(quantity),
                      unitPrice: Number(price),
                      lengthMm: l.uom === "m" ? Number(length) : undefined,
                      color,
                      requestLineId: l.id,
                      allowExcess: excess,
                    },
                  ],
                },
              },
            });
          }}
        >
          <WarehouseChoice
            warehouses={warehouses}
            type="RAW"
            value={warehouse}
            onChange={setWarehouse}
            required
            label="Teslim alınacak depo"
          />
          <label className="text-sm">
            Tedarikçi
            <select
              required
              className="rf-input mt-1 w-full"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            >
              <option value="">Seçin</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Talep kalemi
            <select
              className="rf-input mt-1 w-full"
              value={lineId}
              onChange={(e) => setLine(e.target.value)}
            >
              {request.lines.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.quantity} {l.uom}
                </option>
              ))}
            </select>
          </label>
          {l.uom === "m" && (
            <>
              <label className="text-sm">
                Satın alınacak çubuk boyu · mm
                <input
                  required
                  type="number"
                  min={100}
                  max={30000}
                  className="rf-input mt-1 w-full"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Renk / yüzey
                <input
                  required
                  className="rf-input mt-1 w-full"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>
            </>
          )}
          <label className="text-sm">
            {l.uom === "m" ? "Çubuk adedi" : "Miktar · " + l.uom}
            <input
              required
              className="rf-input mt-1 w-full"
              type="number"
              min="0.001"
              step={l.uom === "m" || l.uom === "adet" ? 1 : "any"}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Birim fiyat · TRY/{l.uom}
            <input
              required
              className="rf-input mt-1 w-full"
              type="number"
              min={0}
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className="flex gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={excess}
              onChange={(e) => setExcess(e.target.checked)}
            />
            Gerçek çubuk/adet alımı nedeniyle talebi aşan miktarı da satın alma
            taslağına eklemeyi kabul ediyorum.
          </label>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Taslak mevcut Satın alma ekranında kontrol edilip onaylanır.
          </p>
          <button className="rf-primary-button" disabled={busy}>
            Satın alma taslağını kaydet
          </button>
        </form>
      )}
    </div>
  );
}

function onlyWarehouse(warehouses: any[], type: string) {
  const matches = warehouses.filter((w) => w.warehouse_type === type);
  return matches.length === 1 ? matches[0].id : "";
}
function WarehouseChoice({
  warehouses,
  type,
  value,
  onChange,
  required,
  label,
}: {
  warehouses: any[];
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  label: string;
}) {
  return (
    <label className="block text-sm">
      {label}
      <select
        required={required}
        className="rf-input mt-1 w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Depo seçin</option>
        {warehouses
          .filter((w) => w.warehouse_type === type)
          .map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
      </select>
    </label>
  );
}
