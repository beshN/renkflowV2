"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Link2, RefreshCw, Star, Trash2 } from "lucide-react";
import {
  BusinessDialog,
  BusinessField,
} from "@/components/shared/ui/BusinessDialog";
import { useToast } from "@/lib/context/ToastContext";
import {
  orderFiltersQuery,
  sameOrderFilters,
  type OrderFilters,
  type SavedOrderView,
} from "@/lib/features/orders/saved-views";
import { requestJson } from "@/lib/shared/network";

type Props = {
  filters: OrderFilters;
  selectedId: string;
  onApply: (filters: OrderFilters, id: string) => void;
};
export function SavedOrderViews({ filters, selectedId, onApply }: Props) {
  const { showToast } = useToast();
  const [views, setViews] = useState<SavedOrderView[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [dialog, setDialog] = useState<"create" | "rename" | "delete" | null>(
      null,
    ),
    [name, setName] = useState(""),
    [fallbackLink, setFallbackLink] = useState("");
  const seq = useRef(0),
    alive = useRef(true),
    inFlight = useRef(false),
    retry = useRef<{ payload: string; commandId: string } | null>(null);
  const current = views.find((v) => v.id === selectedId);
  const changed = Boolean(
    current && !sameOrderFilters(current.filters, filters),
  );
  const load = useCallback(async (signal?: AbortSignal) => {
    const number = ++seq.current;
    setLoading(true);
    const result = await requestJson<{ data: SavedOrderView[] }>(
      "/api/v1/workspace/views",
      { signal, cache: "no-store" },
      { timeoutMs: 15000 },
    );
    if (!alive.current || signal?.aborted || number !== seq.current) return;
    if (result.ok && result.data?.data) {
      setViews(result.data.data);
      setError("");
    } else setError(result.error || "Görünümler alınamadı. Yeniden deneyin.");
    setLoading(false);
  }, []);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [load]);
  async function command(data: Record<string, unknown>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const payload = JSON.stringify(data);
    const commandId =
      retry.current?.payload === payload
        ? retry.current.commandId
        : crypto.randomUUID();
    retry.current = { payload, commandId };
    try {
      const result = await requestJson<{
        data: SavedOrderView & { deleted?: boolean };
      }>(
        "/api/v1/workspace/views",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, commandId }),
        },
        { timeoutMs: 15000 },
      );
      if (!alive.current) return;
      if (!result.ok || !result.data?.data) {
        setError(result.error || "Görünüm kaydedilemedi.");
        return;
      }
      retry.current = null;
      setDialog(null);
      const saved = result.data.data;
      if (saved.deleted) {
        setViews((list) => list.filter((v) => v.id !== saved.id));
        onApply(filters, "");
      } else {
        setViews((list) =>
          [...list.filter((v) => v.id !== saved.id), saved].sort(
            (a, b) =>
              Number(b.pinned) - Number(a.pinned) ||
              a.name.localeCompare(b.name, "tr"),
          ),
        );
        onApply(data.action === "create" ? saved.filters : filters, saved.id);
      }
      showToast(
        saved.deleted
          ? "Kişisel görünüm silindi."
          : "Kişisel görünüm kaydedildi.",
        "success",
      );
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function copyLink() {
    const query = orderFiltersQuery(filters),
      url = window.location.origin + "/orders" + (query ? "?" + query : "");
    try {
      await navigator.clipboard.writeText(url);
      setFallbackLink("");
      showToast("Filtreli görünüm bağlantısı kopyalandı.", "success");
    } catch {
      setFallbackLink(url);
      showToast("Bağlantıyı alttaki alandan kopyalayabilirsiniz.", "info");
    }
  }
  function open(next: "create" | "rename" | "delete") {
    setName(next === "create" ? "" : current?.name || "");
    setError("");
    setDialog(next);
  }
  return (
    <section
      aria-label="Kişisel sipariş görünümleri"
      className="rounded-lg border border-border bg-card px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Bookmark size={14} className="text-muted-foreground" />
        <label className="sr-only" htmlFor="saved-order-view">
          Kayıtlı görünüm
        </label>
        <select
          id="saved-order-view"
          value={current?.id || ""}
          disabled={loading || busy}
          onChange={(e) => {
            const v = views.find((row) => row.id === e.target.value);
            if (v) onApply(v.filters, v.id);
            else onApply(filters, "");
          }}
          className="max-w-full rounded-md border border-border bg-background px-2 py-2 text-xs disabled:opacity-50"
        >
          <option value="">
            {loading ? "…" : "Kişisel görünümler"}
          </option>
          {views.map((v) => (
            <option key={v.id} value={v.id}>
              {v.pinned ? "★ " : ""}
              {v.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => open("create")}
          className="rf-secondary-button text-xs"
        >
          Görünümü kaydet
        </button>
        {current && (
          <>
            {changed && (
              <>
                <span className="text-[10px] text-amber-700">
                  Kaydedilmemiş filtreler
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void command({ action: "update", ...current, filters })
                  }
                  className="text-xs text-primary"
                >
                  Filtreleri güncelle
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onApply(current.filters, current.id)}
                  className="text-xs text-muted-foreground"
                >
                  Kaydedilene dön
                </button>
              </>
            )}
            <button
              type="button"
              disabled={busy}
              aria-label={current.pinned ? "Favoriden çıkar" : "Favoriye ekle"}
              aria-pressed={current.pinned}
              onClick={() =>
                void command({
                  action: "update",
                  id: current.id,
                  version: current.version,
                  name: current.name,
                  filters: current.filters,
                  pinned: !current.pinned,
                })
              }
              className="rf-icon-button"
            >
              <Star
                size={14}
                className={
                  current.pinned ? "fill-amber-400 text-amber-500" : ""
                }
              />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => open("rename")}
              className="text-xs text-muted-foreground"
            >
              Yeniden adlandır
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => open("delete")}
              aria-label="Kişisel görünümü sil"
              className="rf-icon-button text-rose-600"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => void copyLink()}
          className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link2 size={14} /> Bağlantıyı kopyala
        </button>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void load()}
          aria-label="Kişisel görünümleri yenile"
          className="rf-icon-button"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Görünümler yalnız size aittir; bu firmada tüm cihazlarınızda
        kullanılabilir. Bağlantılar erişim yetkisi kazandırmaz.
      </p>
      {error && !dialog && (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {error}
        </p>
      )}
      {fallbackLink && (
        <label className="mt-3 block text-xs">
          Görünüm bağlantısı
          <input
            readOnly
            value={fallbackLink}
            onFocus={(e) => e.target.select()}
            className="rf-input mt-2 w-full"
          />
        </label>
      )}
      <BusinessDialog
        open={Boolean(dialog)}
        title={
          dialog === "create"
            ? "Kişisel görünümü kaydet"
            : dialog === "delete"
              ? "Kişisel görünümü sil"
              : "Görünümü yeniden adlandır"
        }
        onClose={() => setDialog(null)}
        busy={busy}
        error={error}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (dialog === "delete" && current)
              void command({
                action: "delete",
                id: current.id,
                version: current.version,
              });
            else if (dialog === "rename" && current)
              void command({
                action: "update",
                id: current.id,
                version: current.version,
                name,
                filters: current.filters,
                pinned: current.pinned,
              });
            else
              void command({ action: "create", name, filters, pinned: false });
          }}
          className="space-y-4"
        >
          {dialog === "delete" ? (
            <p className="text-sm">
              “{current?.name}” kişisel görünümü silinecek. Siparişler korunur.
            </p>
          ) : (
            <BusinessField
              label="Görünüm adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
              autoFocus
              placeholder="Örn. Bu hafta teslim edilecekler"
            />
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setDialog(null)}
              className="rf-secondary-button"
            >
              Vazgeç
            </button>
            <button type="submit" disabled={busy} className="rf-primary-button">
              {busy
                ? "İşleniyor…"
                : dialog === "delete"
                  ? "Görünümü sil"
                  : "Kaydet"}
            </button>
          </div>
        </form>
      </BusinessDialog>
    </section>
  );
}
