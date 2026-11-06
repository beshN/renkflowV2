"use client";
import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/shared/network";
import { useMemberAccess } from "@/lib/hooks/useMemberAccess";

type Part = {
  id: string;
  work_order_title: string;
  order_number: string;
  profile_code: string | null;
  profile_name: string;
  length_mm: number;
  weight_kg: string | null;
  outcome?: string;
  reject_reason?: string;
  returned_at?: string;
};
type Dispatch = {
  id: string;
  dispatch_number: string;
  supplier_name: string;
  target_color: string;
  sent_at: string;
  expected_return_date: string | null;
  overdue: boolean;
  sent_count: number;
  pending_count: number;
  returned_count: number;
  rejected_count: number;
  weight_kg: string | null;
  note: string | null;
  parts: Part[];
};
type Candidates = {
  groups: { target_color: string; parts: Part[] }[];
  suppliers: { id: string; name: string }[];
};
type Choice = { outcome: string; rejectReason: string };
const root = "/api/v1/production/paint-dispatches";
const day = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("tr-TR") : "—";
const kg = (v: string | null) =>
  v == null
    ? "Gramaj eksik; ağırlık hesaplanmadı"
    : `${Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} kg`;
function useRead<T>(url: string | null, version: number) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    if (url)
      void requestJson<{ data: T }>(url, {
        cache: "no-store",
        signal: controller.signal,
      }).then((r) => {
        if (controller.signal.aborted) return;
        if (r.ok && r.data) setData(r.data.data);
        else setError(r.error || "Veriler yüklenemedi");
      });
    return () => controller.abort();
  }, [url, version, retry]);
  return { data, error, retry: () => setRetry((v) => v + 1) };
}
function ReadStatus({ error, retry }: { error: string; retry: () => void }) {
  return error ? (
    <div role="alert">
      <p>Yüklenemedi: {error}</p>
      <button className="rf-secondary-button mt-2" onClick={retry}>
        Tekrar dene
      </button>
    </div>
  ) : (
    <p role="status">Yükleniyor…</p>
  );
}
function PartLabel({ p }: { p: Part }) {
  return (
    <span>
      {p.order_number} · {p.work_order_title} · {p.profile_code || "—"} /{" "}
      {p.profile_name} · {p.length_mm} mm · {kg(p.weight_kg)}
    </span>
  );
}
export function PaintDispatchPanel() {
  const access = useMemberAccess();
  const view =
    !!access &&
    ["owner", "admin", "office"].includes(access.base) &&
    !!access.permissions.production?.includes("view");
  return view ? (
    <DispatchWorkspace
      key={access.base + ":" + access.permissions.production?.includes("edit")}
      edit={!!access.permissions.production?.includes("edit")}
    />
  ) : null;
}
function DispatchWorkspace({ edit }: { edit: boolean }) {
  const [version, setVersion] = useState(0),
    [creating, setCreating] = useState(false),
    [id, setId] = useState(""),
    [color, setColor] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [choices, setChoices] = useState<Record<string, Choice>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const list = useRead<Dispatch[]>(root, version),
    candidates = useRead<Candidates>(
      creating && edit ? root + "/candidates" : null,
      version,
    ),
    detail = useRead<Dispatch>(id ? root + "/" + id : null, version);
  async function run(action: string, data: Record<string, unknown>) {
    if (lock.current || !edit) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await requestJson("/api/v1/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandId: crypto.randomUUID(), action, data }),
      });
      if (!r.ok) {
        setError(r.error || "İşlem tamamlanamadı");
        return;
      }
      setSelected([]);
      setChoices({});
      setVersion((v) => v + 1);
      if (action === "paint.dispatch.create") {
        setCreating(false);
        setColor("");
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const group = candidates.data?.groups.find((g) => g.target_color === color);
  const pending = detail.data?.parts.filter((p) => p.outcome === "sent") || [];
  const returns = pending.filter((p) => choices[p.id]?.outcome);
  const invalid =
    !returns.length ||
    returns.some(
      (p) =>
        choices[p.id].outcome === "rejected" &&
        !choices[p.id].rejectReason.trim(),
    );
  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <section className="rf-panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="rf-section-title">Açık boyahane sevkiyatları</h2>
          {edit && (
            <button
              disabled={busy}
              className="rf-primary-button"
              onClick={() => {
                setCreating((v) => !v);
                setSelected([]);
                setColor("");
              }}
            >
              Yeni sevkiyat
            </button>
          )}
        </div>
        {!list.data ? (
          <ReadStatus error={list.error} retry={list.retry} />
        ) : !list.data.length ? (
          <p>Henüz açık sevkiyat yok.</p>
        ) : (
          list.data.map((d) => (
            <article
              key={d.id}
              className="space-y-2 border-t border-border pt-3 text-sm"
            >
              <button
                className="text-primary underline"
                disabled={busy}
                onClick={() => {
                  setId(d.id);
                  setChoices({});
                }}
              >
                Sevkiyat {d.dispatch_number} · {d.supplier_name} ·{" "}
                {d.target_color}
              </button>
              <p>
                Gönderim: {day(d.sent_at)} · Beklenen dönüş:{" "}
                {day(d.expected_return_date)}{" "}
                {d.overdue === true && (
                  <span className="rounded border border-border px-2 py-1 text-xs">
                    Gecikmiş
                  </span>
                )}
              </p>
              <p>
                Gönderilen {d.sent_count} adet · Bekleyen {d.pending_count} adet
                · Dönen {d.returned_count} adet · Hatalı {d.rejected_count} adet
              </p>
              <p>{kg(d.weight_kg)}</p>
            </article>
          ))
        )}
      </section>
      {creating && edit && (
        <section className="rf-panel space-y-4">
          <h2 className="rf-section-title">Yeni sevkiyat</h2>
          {!candidates.data ? (
            <ReadStatus error={candidates.error} retry={candidates.retry} />
          ) : !candidates.data.groups.length ? (
            <p>Sevkiyata uygun profil yok.</p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  busy ||
                  !selected.length ||
                  !group ||
                  selected.some(
                    (partId) => !group.parts.some((p) => p.id === partId),
                  )
                )
                  return;
                const f = new FormData(e.currentTarget);
                void run("paint.dispatch.create", {
                  partIds: selected,
                  supplierId: f.get("supplierId"),
                  ...(f.get("expectedReturnDate")
                    ? { expectedReturnDate: f.get("expectedReturnDate") }
                    : {}),
                  ...(f.get("note") ? { note: f.get("note") } : {}),
                });
              }}
            >
              <fieldset disabled={busy} className="space-y-3">
                <label className="block text-xs">
                  Renk grubu
                  <select
                    className="rf-input mt-2 w-full"
                    required
                    value={color}
                    onChange={(e) => {
                      setColor(e.target.value);
                      setSelected([]);
                    }}
                  >
                    <option value="">Seçin</option>
                    {candidates.data.groups.map((g) => (
                      <option key={g.target_color} value={g.target_color}>
                        {g.target_color} · {g.parts.length} adet
                      </option>
                    ))}
                  </select>
                </label>
                {group?.parts.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 border-t border-border pt-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, p.id]
                            : ids.filter((v) => v !== p.id),
                        )
                      }
                    />
                    <PartLabel p={p} />
                  </label>
                ))}
                <label className="block text-xs">
                  Boyahane
                  <select
                    name="supplierId"
                    required
                    className="rf-input mt-2 w-full"
                  >
                    <option value="">Seçin</option>
                    {candidates.data.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!candidates.data.suppliers.length && (
                  <p>Seçilebilecek tedarikçi yok.</p>
                )}
                <label className="block text-xs">
                  Beklenen dönüş tarihi (isteğe bağlı)
                  <input
                    name="expectedReturnDate"
                    type="date"
                    className="rf-input mt-2 w-full"
                  />
                </label>
                <label className="block text-xs">
                  Not (isteğe bağlı)
                  <textarea
                    name="note"
                    maxLength={4000}
                    className="rf-input mt-2 w-full"
                  />
                </label>
              </fieldset>
              <button
                className="rf-primary-button"
                disabled={
                  busy || !selected.length || !candidates.data.suppliers.length
                }
              >
                Sevkiyatı oluştur
              </button>
            </form>
          )}
        </section>
      )}
      {id && (
        <section className="rf-panel space-y-4">
          <h2 className="rf-section-title">Sevkiyat detayı</h2>
          {!detail.data ? (
            <ReadStatus error={detail.error} retry={detail.retry} />
          ) : (
            <>
              <p>
                {detail.data.dispatch_number} · {detail.data.supplier_name} ·{" "}
                {detail.data.target_color}
              </p>
              <p>
                Gönderim: {day(detail.data.sent_at)} · Beklenen dönüş:{" "}
                {day(detail.data.expected_return_date)}
              </p>
              {detail.data.note && <p>{detail.data.note}</p>}
              {detail.data.parts.map((p) => (
                <article
                  key={p.id}
                  className="space-y-2 border-t border-border pt-3 text-sm"
                >
                  <PartLabel p={p} />
                  {p.outcome === "sent" ? (
                    edit ? (
                      <fieldset disabled={busy} className="space-y-2">
                        <label className="block text-xs">
                          Dönüş sonucu
                          <select
                            aria-label={`${p.profile_name} ${p.id} dönüş sonucu`}
                            className="rf-input ml-2"
                            value={choices[p.id]?.outcome || ""}
                            onChange={(e) =>
                              setChoices((v) => ({
                                ...v,
                                [p.id]: {
                                  outcome: e.target.value,
                                  rejectReason: v[p.id]?.rejectReason || "",
                                },
                              }))
                            }
                          >
                            <option value="">Bekliyor</option>
                            <option value="returned">Döndü</option>
                            <option value="rejected">Hatalı</option>
                          </select>
                        </label>
                        {choices[p.id]?.outcome === "rejected" && (
                          <label className="block text-xs">
                            Hata gerekçesi
                            <input
                              required
                              maxLength={4000}
                              className="rf-input mt-2 w-full"
                              value={choices[p.id].rejectReason}
                              onChange={(e) =>
                                setChoices((v) => ({
                                  ...v,
                                  [p.id]: {
                                    ...v[p.id],
                                    rejectReason: e.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        )}
                      </fieldset>
                    ) : (
                      <p>Dönüş bekliyor</p>
                    )
                  ) : (
                    <p>
                      {p.outcome === "returned" ? "Döndü" : "Hatalı"} ·{" "}
                      {day(p.returned_at)}{" "}
                      {p.reject_reason && `· ${p.reject_reason}`}
                    </p>
                  )}
                </article>
              ))}
              {edit && pending.length > 0 && (
                <button
                  className="rf-primary-button"
                  disabled={busy || invalid}
                  onClick={() => {
                    if (invalid) return;
                    void run("paint.dispatch.return", {
                      dispatchId: id,
                      parts: returns.map((p) => ({
                        partId: p.id,
                        outcome: choices[p.id].outcome,
                        ...(choices[p.id].outcome === "rejected"
                          ? { rejectReason: choices[p.id].rejectReason.trim() }
                          : {}),
                      })),
                    });
                  }}
                >
                  Seçilen dönüşleri kaydet
                </button>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
