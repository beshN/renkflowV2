"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/shared/network";
import ScanTerminal from "../warehouse/ScanTerminal";
import LabelCenter from "../warehouse/LabelCenter";
import { WorkshopPanel } from "./WorkshopPanel";
import { OrderTechnicalPanel } from "../orders/OrderTechnicalPanel";
import { FAMILY_LABELS } from "@/lib/features/orders/technical";
const categories = [
  { id: "makasli", name: "Makaslı tente", families: ["makasli"] },
  { id: "pergola", name: "Pergola", families: ["pergola"] },
  {
    id: "wind",
    name: "Rüzgâr kırıcı",
    families: ["wind-manual", "wind-piston", "giyotin"],
  },
  { id: "other", name: "Ortak işler", families: ["other"] },
];
export function WorkerWorkspace() {
  const [data, setData] = useState<{ orders: any[]; worker: boolean } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [category, setCategory] = useState("makasli"),
    [selected, setSelected] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState("production");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("code"))
      setTab("stock");
    const controller = new AbortController();
    void requestJson<{ orders: any[]; worker: boolean }>(
      "/api/v1/production/worker",
      { signal: controller.signal },
    ).then((r) => {
      if (r.ok && r.data) {
        setData(r.data);
        // Open on the first category that has work, not on an empty default.
        const busy = categories.find((c) =>
          r.data!.orders.some((o) => c.families.includes(o.family)),
        );
        if (busy) setCategory(busy.id);
      }
      else if (!controller.signal.aborted)
        setError(r.error || "Üretim listesi alınamadı");
    });
    return () => controller.abort();
  }, []);
  const current = categories.find((c) => c.id === category)!;
  return (
    <div className="rf-page space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Usta ekranı</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ürünü açın; güncel ölçüleri, kesim planını ve yapacağınız işlemleri
          görün.
        </p>
      </div>
      {error && <p role="alert">{error}</p>}
      <nav aria-label="Usta bölümleri" className="flex flex-wrap gap-2">
        {[
          ["production", "Üretim"],
          ["stock", "Stok–Depo"],
          ["receiving", "Mal kabul"],
          ["requests", "Talepler"],
        ].map(([key, name]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            className={
              tab === key ? "rf-primary-button" : "rf-secondary-button"
            }
            onClick={() => setTab(key)}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === "stock" ? (
        <div className="space-y-5">
          <ScanTerminal />
          <details>
            <summary className="cursor-pointer font-medium">
              Etiket hazırla ve yazdır
            </summary>
            <LabelCenter />
          </details>
        </div>
      ) : tab === "requests" ? (
        <WorkshopPanel />
      ) : tab === "receiving" ? (
        <WorkshopPanel mode="receiving" />
      ) : selected ? (
        <>
          <button
            className="rf-secondary-button"
            onClick={() => setSelected(null)}
          >
            Üretim listesine dön
          </button>
          <OrderTechnicalPanel
            key={selected}
            orderId={selected}
            worker={data?.worker}
          />
        </>
      ) : (
        <>
          <nav aria-label="Ürün kategorileri" className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                aria-pressed={category === c.id}
                className={
                  category === c.id
                    ? "rf-primary-button"
                    : "rf-secondary-button"
                }
                onClick={() => setCategory(c.id)}
              >
                {c.name}
                {data && (
                  <span className="ml-1.5 tabular-nums opacity-70">
                    {data.orders.filter((o) => c.families.includes(o.family)).length}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <label className="block max-w-lg text-sm">
            Sipariş veya ürün ara
            <input
              className="rf-input mt-1 w-full"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {!data ? (
            <p role="status">Üretim listesi yükleniyor…</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.orders
                .filter(
                  (o) =>
                    // A search looks through every category.
                    (query.trim() !== "" || current.families.includes(o.family)) &&
                    `${o.order_number} ${o.product_name}`
                      .toLocaleLowerCase("tr-TR")
                      .includes(query.toLocaleLowerCase("tr-TR")),
                )
                .map((o) => (
                  <button
                    key={o.id}
                    className="rf-panel space-y-2 p-4 text-left hover:border-primary"
                    onClick={() => setSelected(o.id)}
                  >
                    <p className="font-semibold">{o.order_number}</p>
                    <p>
                      {o.product_name} · {o.quantity} adet
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {FAMILY_LABELS[o.family as keyof typeof FAMILY_LABELS]} ·{" "}
                      {o.revision
                        ? `Liste sürümü ${o.revision}`
                        : "Mevcut üretim kaydı"}
                    </p>
                  </button>
                ))}
              {!data.orders.some((o) =>
                current.families.includes(o.family),
              ) && (
                <p className="text-sm text-muted-foreground">
                  Bu kategoride bekleyen iş yok.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
