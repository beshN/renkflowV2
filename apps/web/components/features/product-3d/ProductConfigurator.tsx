"use client";
import { useEffect, useRef, useState } from "react";
import { Expand, Play, RotateCcw, Check } from "lucide-react";
import Image from "next/image";
import {
  BODY_COLORS,
  FABRIC_COLORS,
} from "@/lib/features/awning/configuration";
import {
  defaultVisualization,
  productMeta,
  PRODUCT_CATALOG,
  VisualizationConfigurationSchema,
  type ProductKind,
  type ProductVisualization,
  type VisualizationConfiguration,
} from "@/lib/features/product-3d/catalog";
import type {
  ProductStage,
  ProductView,
} from "@/lib/features/product-3d/stage";
const views: Array<[ProductView, string]> = [
  ["perspective", "Perspektif"],
  ["front", "Ön"],
  ["side", "Yan"],
  ["top", "Üst"],
  ["under", "Alt"],
  ["detail", "Mekanizma"],
];
export function ProductConfigurator({
  value,
  kind = "pergola",
  readOnly = false,
  onApply,
  showProductPicker = false,
}: {
  value?: ProductVisualization;
  kind?: ProductKind;
  readOnly?: boolean;
  onApply?: (v: ProductVisualization) => void;
  showProductPicker?: boolean;
}) {
  const [draft, setDraft] = useState<VisualizationConfiguration>(
    value?.configuration ?? defaultVisualization(kind),
  );
  const [opening, setOpening] = useState(0),
    [time, setTime] = useState(0),
    [view, setView] = useState<ProductView>("perspective"),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [rendering, setRendering] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    stage = useRef<HTMLDivElement>(null),
    controller = useRef<ProductStage | null>(null),
    initial = useRef(draft),
    rendered = useRef("");
  const meta = productMeta(draft.kind),
    roof = meta.category === "roof",
    motion = meta.motion !== "none";
  useEffect(() => {
    let cancelled = false,
      instance: ProductStage | undefined;
    import("@/lib/features/product-3d/stage")
      .then(async ({ createProductStage }) => {
        if (cancelled || !canvas.current) return;
        instance = await createProductStage(
          canvas.current,
          initial.current,
          setOpening,
          () => {
            setReady(false);
            setError(
              "3D bağlantısı kesildi. Kaydedilmiş görünümü ve seçimleri kullanabilirsiniz.",
            );
          },
        );
        if (cancelled) {
          instance.dispose();
          return;
        }
        controller.current = instance;
        rendered.current = JSON.stringify(initial.current);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Bu cihazda 3D görünüm başlatılamadı. Kaydedilmiş görünüm kullanılabilir.",
          );
      });
    return () => {
      cancelled = true;
      instance?.dispose();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const valid = VisualizationConfigurationSchema.safeParse(draft);
    if (!valid.success) {
      setRendering(false);
      setError(valid.error.issues.map((i) => i.message).join(" · "));
      return;
    }
    const signature = JSON.stringify(valid.data);
    let cancelled = false;
    setRendering(true);
    setError("");
    controller.current
      ?.setConfiguration(valid.data)
      .then(() => {
        if (!cancelled) {
          rendered.current = signature;
          setRendering(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRendering(false);
          setError("Ürün görünümü yüklenemedi.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [draft, ready]);
  const update = <K extends keyof VisualizationConfiguration>(
    key: K,
    v: VisualizationConfiguration[K],
  ) => setDraft((previous) => ({ ...previous, [key]: v }));
  function apply() {
    if (rendering) return;
    const valid = VisualizationConfigurationSchema.safeParse(draft);
    if (!valid.success) {
      setError(valid.error.issues.map((i) => i.message).join(" · "));
      return;
    }
    let image: string | undefined;
    try {
      if (ready && rendered.current === JSON.stringify(valid.data))
        image = controller.current?.capture();
    } catch {
      /* Technical values remain usable without capture. */
    }
    onApply?.({ configuration: valid.data, ...(image ? { image } : {}) });
  }
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-3">
        <style>{`.rf-product-stage:fullscreen {width:100vw;height:100dvh;border:0;border-radius:0}.rf-product-stage:fullscreen canvas {width:100vw;height:100dvh}`}</style>
        <div
          ref={stage}
          className="rf-product-stage relative overflow-hidden rounded-lg border border-border bg-[#eceeeb]"
        >
          <div
            className={`pointer-events-none absolute left-5 top-5 z-10 ${time > 70 ? "text-slate-100" : "text-[#203641]"}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[.18em]">
              RENK / {meta.name}
            </p>
            <p className="mt-1 text-sm tabular-nums">
              {draft.widthMm / 10} ×{" "}
              {(roof ? draft.projectionMm : draft.heightMm) / 10} cm
            </p>
          </div>
          <canvas
            ref={canvas}
            className="h-[360px] w-full touch-none sm:h-[470px]"
            aria-label={`${meta.name} 3D görünümü, %${Math.round(opening)} açık. Ok tuşları: döndür; artı/eksi: yakınlaştır; Home: sıfırla; PageUp/PageDown: açıklık; boşluk: oynat.`}
            tabIndex={0}
          />
          {!ready && !error && (
            <p
              role="status"
              className="absolute bottom-5 left-5 rounded bg-white/90 px-3 py-2 text-xs text-slate-700"
            >
              3D görünüm yükleniyor…
            </p>
          )}
          {ready && rendering && (
            <p
              role="status"
              className="absolute bottom-5 left-5 rounded bg-white/90 px-3 py-2 text-xs text-slate-700"
            >
              Ürün görünümü hazırlanıyor…
            </p>
          )}
          {!ready && error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-card p-6">
              {value?.image && (
                <Image
                  src={value.image}
                  width={900}
                  height={600}
                  alt={`${meta.name} kaydedilmiş 3D görünümü`}
                  unoptimized
                  className="max-h-64 w-auto rounded-md"
                />
              )}
              <p role="alert" className="text-sm">
                {error}
              </p>
            </div>
          )}
          <button
            type="button"
            aria-label="3D görünümü tam ekran aç"
            className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-md bg-white/90 text-slate-700"
            onClick={() => {
              const element = stage.current;
              if (document.fullscreenElement)
                void document.exitFullscreen().catch(() => {});
              else void element?.requestFullscreen?.().catch(() => {});
            }}
          >
            <Expand size={17} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {views.map(([key, label]) => (
            <button
              type="button"
              key={key}
              disabled={!ready || rendering}
              aria-pressed={view === key}
              className={`min-h-11 rounded-md border px-3 text-xs ${view === key ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
              onClick={() => {
                setView(key);
                controller.current?.selectView(key);
              }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            aria-label="Kamerayı sıfırla"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-border"
            onClick={() => {
              setView("perspective");
              controller.current?.selectView("perspective");
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
        {motion && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
            <button
              type="button"
              disabled={!ready}
              aria-label="Açılma kapanma animasyonunu başlat veya durdur"
              className="flex h-11 w-11 items-center justify-center rounded-md border border-border"
              onClick={() => controller.current?.toggleAnimation()}
            >
              <Play size={16} />
            </button>
            <label className="flex min-w-36 flex-1 items-center gap-3 text-xs">
              {meta.motion === "tilt" ? "Lamel açısı" : "Açıklık"}
              <input
                aria-label="Ürün açıklığı"
                disabled={!ready || rendering}
                aria-valuetext={`%${Math.round(opening)} açık`}
                className="min-w-0 flex-1"
                type="range"
                min={0}
                max={100}
                value={opening}
                onChange={(e) => {
                  setOpening(+e.target.value);
                  controller.current?.setOpening(+e.target.value);
                }}
              />
            </label>
            <output className="w-10 text-right text-xs tabular-nums">
              %{Math.round(opening)}
            </output>
            <div className="flex flex-wrap gap-1">
              {[0, 25, 50, 75, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={!ready || rendering}
                  className="min-h-11 min-w-11 rounded border border-border px-2 text-xs"
                  onClick={() => {
                    setOpening(n);
                    controller.current?.setOpening(n);
                  }}
                >
                  %{n}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="flex items-center gap-3 text-xs">
          Gündüz / gece
          <input
            aria-label="Gündüz gece ışığı"
            type="range"
            min={0}
            max={100}
            value={time}
            onChange={(e) => {
              setTime(+e.target.value);
              controller.current?.setTime(+e.target.value);
            }}
          />
          <span>
            {time < 30 ? "Gündüz" : time < 75 ? "Gün batımı" : "Gece"}
          </span>
        </label>
        <p className="text-[11px] leading-5 text-muted-foreground">
          Ölçüye göre görsel sunum. Üretim uygunluğu onaylı reçete ve projeyle
          doğrulanır.
        </p>
        <details className="rounded-md border border-border p-3 text-xs leading-5">
          <summary className="cursor-pointer font-medium">
            Ürün detayları ve referans
          </summary>
          <ul className="mt-2 list-disc pl-4">
            {meta.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          {meta.uncertainty && (
            <p className="mt-2 text-muted-foreground">{meta.uncertainty}</p>
          )}
          <a
            className="mt-2 inline-block text-primary underline"
            href={`https://www.renkaluminyum.com${meta.source}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Gerçek ürünü incele
          </a>
        </details>
      </div>
      <div className="space-y-4">
        {error && ready && (
          <p
            role="alert"
            className="rounded border border-destructive/30 p-3 text-xs"
          >
            {error}
          </p>
        )}
        <h3 className="rf-section-title">
          {readOnly ? "Kaydedilmiş seçimler" : "3D görünüm seçimleri"}
        </h3>
        <fieldset disabled={readOnly} className="space-y-4 disabled:opacity-80">
          {showProductPicker && (
            <label className="block text-xs">
              Ürün
              <select
                aria-label="3D ürün seçimi"
                className="rf-input mt-1 w-full"
                value={draft.kind}
                onChange={(e) => {
                  setDraft(defaultVisualization(e.target.value as ProductKind));
                  setOpening(0);
                  controller.current?.setOpening(0);
                }}
              >
                {PRODUCT_CATALOG.map((p) => (
                  <option key={p.kind} value={p.kind}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(
            [
              ["widthMm", "En", meta.viewMax[0]],
              ...(roof ? [["projectionMm", "Açılım", meta.viewMax[1]]] : []),
              [
                "heightMm",
                roof ? "Montaj yüksekliği" : "Yükseklik",
                meta.viewMax[2],
              ],
            ] as Array<
              [
                keyof Pick<
                  VisualizationConfiguration,
                  "widthMm" | "projectionMm" | "heightMm"
                >,
                string,
                number,
              ]
            >
          ).map(([key, label, max]) => (
            <label key={key} className="block text-xs">
              {label} (mm)
              <input
                className="rf-input mt-1 w-full"
                type="number"
                min={key === "heightMm" ? 1000 : 900}
                max={max}
                step={10}
                value={draft[key]}
                onChange={(e) => update(key, +e.target.value)}
              />
            </label>
          ))}
          <div>
            <p className="mb-2 text-xs">Gövde rengi</p>
            <div className="flex flex-wrap gap-2">
              {BODY_COLORS.map(([name, color]) => (
                <button
                  key={name}
                  type="button"
                  aria-label={`Gövde: ${name}`}
                  aria-pressed={draft.bodyColor === color}
                  className="h-11 w-11 rounded-full border-2 border-border aria-pressed:ring-2 aria-pressed:ring-primary"
                  style={{ backgroundColor: color }}
                  onClick={() => update("bodyColor", color)}
                />
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between text-xs">
            Özel gövde rengi
            <input
              aria-label="Özel gövde rengi"
              type="color"
              value={draft.bodyColor}
              onChange={(e) => update("bodyColor", e.target.value)}
            />
          </label>
          {(draft.kind === "pergola" || draft.kind === "zip") && (
            <div>
              <p className="mb-2 text-xs">Kumaş rengi</p>
              <div className="flex flex-wrap gap-2">
                {FABRIC_COLORS.map(([name, color]) => (
                  <button
                    key={name}
                    type="button"
                    aria-label={`Kumaş: ${name}`}
                    aria-pressed={draft.fabricColor === color}
                    className="h-11 w-11 rounded-full border-2 border-border aria-pressed:ring-2 aria-pressed:ring-primary"
                    style={{ backgroundColor: color }}
                    onClick={() => update("fabricColor", color)}
                  />
                ))}
              </div>
            </div>
          )}
          {draft.kind === "zip" && (
            <label className="block text-xs">
              Kumaş tipi
              <select
                className="rf-input mt-1 w-full"
                value={draft.screen}
                onChange={(e) =>
                  update(
                    "screen",
                    e.target.value as VisualizationConfiguration["screen"],
                  )
                }
              >
                <option value="screen">Screen</option>
                <option value="opaque">Opak</option>
              </select>
            </label>
          )}
          {(draft.kind === "giyotin" ||
            draft.kind === "wind-manual" ||
            draft.kind === "glass-roof" ||
            draft.kind === "winter-garden") && (
            <label className="block text-xs">
              Cam görünümü
              <select
                className="rf-input mt-1 w-full"
                value={draft.glass}
                onChange={(e) =>
                  update(
                    "glass",
                    e.target.value as VisualizationConfiguration["glass"],
                  )
                }
              >
                <option value="single">Tek cam</option>
                <option value="insulated">Çift cam</option>
              </select>
            </label>
          )}
          {(roof || draft.kind.startsWith("wind-")) && (
            <label className="block text-xs">
              Montaj
              <select
                className="rf-input mt-1 w-full"
                value={draft.mounting}
                onChange={(e) =>
                  update(
                    "mounting",
                    e.target.value as VisualizationConfiguration["mounting"],
                  )
                }
              >
                {roof ? (
                  <>
                    <option value="free">Bağımsız</option>
                    <option value="wall">Duvara monte</option>
                  </>
                ) : (
                  <>
                    <option value="wall">Zemine sabit</option>
                    <option value="planter">Tekerlekli saksı</option>
                  </>
                )}
              </select>
            </label>
          )}
          {roof &&
            draft.kind !== "glass-roof" &&
            draft.kind !== "winter-garden" && (
              <>
                <label className="block text-xs">
                  LED
                  <select
                    className="rf-input mt-1 w-full"
                    value={draft.led}
                    onChange={(e) =>
                      update(
                        "led",
                        e.target.value as VisualizationConfiguration["led"],
                      )
                    }
                  >
                    <option value="off">LED yok</option>
                    <option value="warm">Gün ışığı</option>
                    <option value="white">Beyaz</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs">
                  Parlaklık
                  <input
                    aria-label="LED parlaklığı"
                    type="range"
                    min={0}
                    max={100}
                    disabled={draft.led === "off"}
                    value={draft.brightness}
                    onChange={(e) => update("brightness", +e.target.value)}
                  />
                  <span>%{draft.brightness}</span>
                </label>
              </>
            )}
        </fieldset>
        {!readOnly && onApply && (
          <button
            type="button"
            disabled={rendering || (!!error && ready)}
            className="rf-primary-button w-full"
            onClick={apply}
          >
            <Check size={15} />{" "}
            {rendering ? "Görünüm hazırlanıyor…" : "Görünümü kaydet"}
          </button>
        )}
      </div>
    </div>
  );
}
