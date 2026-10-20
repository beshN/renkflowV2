"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { requestJson } from "@/lib/shared/network";
import { WorkshopPhotoInput } from "../manufacturing/WorkshopPanel";
export function OrderLoadingPanel({
  orderId,
  revision,
  jobs,
  shipments,
  reload,
}: {
  orderId: string;
  revision: any;
  jobs: any[];
  shipments: any[];
  reload: () => Promise<void>;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({}),
    [photos, setPhotos] = useState<string[]>([]),
    [checks, setChecks] = useState<string[]>([]),
    [plate, setPlate] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    pending = useRef<{ signature: string; commandId: string } | null>(null);
  const ready = jobs.filter(
    (j) =>
      Number(j.produced_qty) >
      shipments
        .filter((s) => s.work_order_id === j.id)
        .reduce((n, s) => n + Number(s.quantity), 0),
  );
  const load = async () => {
    const data = {
      orderId,
      technicalRevisionId: revision.id,
      lines: ready
        .filter((j) => quantities[j.id] > 0)
        .map((j) => ({ workOrderId: j.id, quantity: quantities[j.id] })),
      photos,
      checkedIds: checks,
      vehiclePlate: plate,
      notes: note,
    };
    const signature = JSON.stringify(data);
    if (pending.current && pending.current.signature !== signature) {
      toast.error(
        "Önce sonucu belirsiz olan yüklemeyi aynı bilgilerle tekrar deneyin",
      );
      return;
    }
    pending.current ||= { signature, commandId: crypto.randomUUID() };
    setBusy(true);
    const r = await requestJson("/api/v1/production/loading", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...data, commandId: pending.current.commandId }),
    });
    setBusy(false);
    if (r.ok) {
      pending.current = null;
      setPhotos([]);
      setChecks([]);
      setQuantities({});
      toast.success("Ürünler araca yüklendi olarak kaydedildi");
      await reload();
    } else {
      if (r.status !== 0 && r.status < 500) pending.current = null;
      toast.error(r.error || "Yükleme kaydedilemedi");
    }
  };
  const deliver = async (s: any) => {
    setBusy(true);
    const r = await requestJson("/api/v1/production", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        commandId: crypto.randomUUID(),
        action: "shipment.delivered",
        data: { id: s.id, version: s.version },
      }),
    });
    setBusy(false);
    if (r.ok) await reload();
    else toast.error(r.error || "Teslim kaydedilemedi");
  };
  return (
    <section className="rf-panel space-y-3 p-3" aria-label="Yükleme ve teslim">
      <h2 className="text-lg font-semibold">Yükleme ve teslim</h2>
      {ready.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            Bu araca yüklenen ürünleri seçin; aksesuarları kontrol edip fotoğraf
            ekleyin.
          </p>
          {ready.map((j) => {
            const remaining =
              Number(j.produced_qty) -
              shipments
                .filter((s) => s.work_order_id === j.id)
                .reduce((n, s) => n + Number(s.quantity), 0);
            return (
              <label
                key={j.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                {j.title} · Hazır {remaining}
                <input
                  className="rf-input w-24"
                  aria-label={`${j.title} yüklenen adet`}
                  type="number"
                  min={0}
                  max={remaining}
                  value={quantities[j.id] || 0}
                  onChange={(e) =>
                    setQuantities((q) => ({
                      ...q,
                      [j.id]: Number(e.target.value),
                    }))
                  }
                />
              </label>
            );
          })}
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">Tamlık kontrolü</legend>
            {revision.technical.loadingChecklist?.map((c: any) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checks.includes(c.id)}
                  onChange={(e) =>
                    setChecks((v) =>
                      e.target.checked
                        ? [...v, c.id]
                        : v.filter((id) => id !== c.id),
                    )
                  }
                />
                {c.title}
              </label>
            ))}
          </fieldset>
          <WorkshopPhotoInput
            workOrderId={ready[0].id}
            onUploaded={(url) => setPhotos((p) => [...p, url])}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              Araç / plaka · isteğe bağlı
              <input
                className="rf-input mt-1 w-full"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Açıklama · isteğe bağlı
              <input
                className="rf-input mt-1 w-full"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          <button
            className="rf-primary-button"
            disabled={
              busy ||
              !photos.length ||
              !Object.values(quantities).some((n) => n > 0)
            }
            onClick={() => void load()}
          >
            Araca yüklendi
          </button>
        </>
      )}
      {!ready.length && !shipments.length && (
        <p className="text-sm text-muted-foreground">
          Ürün hazır olduğunda yükleme açılır.
        </p>
      )}
      {shipments.map((s) => (
        <article
          key={s.id}
          className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm"
        >
          <p>
            {jobs.find((j) => j.id === s.work_order_id)?.title} · {s.quantity}{" "}
            adet ·{" "}
            {s.status === "delivered" ? "Teslim edildi" : "Araca yüklendi"}
            {s.vehicle_plate ? " · " + s.vehicle_plate : ""} ·{" "}
            {new Date(s.created_at).toLocaleString("tr-TR")} ·{" "}
            {s.recorded_by || "Yetkili kullanıcı"}
          </p>
          <div className="flex w-full flex-wrap gap-3">
            {(s.photos || []).map((path: string, i: number) => (
              <a
                key={path}
                className="text-primary underline"
                href={path}
                target="_blank"
                rel="noreferrer"
              >
                Yükleme fotoğrafı {i + 1}
              </a>
            ))}
            {s.notes && <p>{s.notes}</p>}
          </div>
          {s.status === "shipped" && (
            <button
              className="rf-secondary-button"
              disabled={busy}
              onClick={() => void deliver(s)}
            >
              Teslim edildi
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
