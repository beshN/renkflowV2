"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Box, Expand, Play, RotateCcw, Check, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AwningConfiguration,
  AwningConfigurationSchema,
  DEFAULT_AWNING,
  BODY_COLORS,
  FABRIC_COLORS,
  awningSummary,
} from "@/lib/features/awning/configuration";
import type {
  AwningSceneController,
  AwningView,
} from "@/lib/features/awning/scene";

const views: [AwningView, string][] = [
  ["perspective", "Perspektif"],
  ["front", "Ön"],
  ["side", "Yan"],
  ["top", "Üst"],
  ["under", "Alt"],
  ["detail", "Mekanizma"],
];
export function AwningConfigurator({
  value = DEFAULT_AWNING,
  readOnly = false,
  previewImage,
  onApply,
  onChange,
  onValidationChange,
}: {
  value?: AwningConfiguration;
  readOnly?: boolean;
  previewImage?: string;
  onApply?: (value: AwningConfiguration, image?: string) => void;
  onChange?: (value: AwningConfiguration, image?: string) => void;
  onValidationChange?: (message: string) => void;
}) {
  const [draft, setDraft] = useState(value),
    [opening, setOpening] = useState(85),
    [time, setTime] = useState(0),
    [error, setError] = useState(""),
    [sceneError, setSceneError] = useState(""),
    [ready, setReady] = useState(false),
    [view, setView] = useState<AwningView>("perspective");
  const canvas = useRef<HTMLCanvasElement>(null),
    stage = useRef<HTMLDivElement>(null),
    controller = useRef<AwningSceneController | null>(null),
    initial = useRef(value);
  useEffect(() => {
    let cancelled = false;
    let instance: AwningSceneController | undefined;
    import("@/lib/features/awning/scene")
      .then(({ createAwningScene }) => {
        if (cancelled || !canvas.current) return;
        try {
          instance = createAwningScene(
            canvas.current,
            initial.current,
            setOpening,
            () => {
              setReady(false);
              setSceneError(
                "3D bağlantısı kesildi. Teknik seçimler ve kaydedilmiş görünüm kullanılabilir.",
              );
            },
          );
          controller.current = instance;
          setReady(true);
        } catch {
          setSceneError(
            "Bu cihazda 3D görüntü başlatılamadı. Teknik seçimlerle devam edebilirsiniz.",
          );
        }
      })
      .catch(() => {
        if (!cancelled) setSceneError("3D görüntü yüklenemedi.");
      });
    return () => {
      cancelled = true;
      instance?.dispose();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    const valid = AwningConfigurationSchema.safeParse(draft);
    if (!ready || !valid.success) return;
    const timer = window.setTimeout(() => controller.current?.setConfiguration(valid.data), 80);
    return () => window.clearTimeout(timer);
  }, [draft, ready]);
  const changeHandler = useRef(onChange), validationHandler = useRef(onValidationChange);
  changeHandler.current = onChange;
  validationHandler.current = onValidationChange;
  const emitted = useRef('');
  useEffect(() => {
    if (readOnly || !changeHandler.current) return;
    const valid = AwningConfigurationSchema.safeParse(draft);
    validationHandler.current?.(valid.success ? '' : valid.error.issues.map(i => i.message).join(' · '));
    if (!valid.success) return;
    const signature = JSON.stringify(valid.data);
    if (emitted.current !== signature) {
      emitted.current = signature;
      changeHandler.current(valid.data);
    }
    if (!ready || sceneError) return;
    const timer = window.setTimeout(() => {
      let image: string | undefined;
      try { image = controller.current?.capture(); } catch { /* Values remain usable. */ }
      if (image) changeHandler.current?.(valid.data, image);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft, ready, sceneError, opening, view, time]);
  function update<K extends keyof AwningConfiguration>(
    key: K,
    value: AwningConfiguration[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setError("");
  }
  function apply() {
    const result = AwningConfigurationSchema.safeParse(draft);
    if (!result.success) {
      setError(result.error.issues.map((i) => i.message).join(" · "));
      return;
    }
    let image: string | undefined;
    try {
      if (ready && !sceneError) image = controller.current?.capture();
    } catch {}
    onApply?.(result.data, image);
  }
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-3">
        <div
          ref={stage}
          className="relative overflow-hidden rounded-lg border border-border bg-[#eceeeb]"
        >
          <div
            className={`pointer-events-none absolute left-5 top-5 z-10 ${time > 70 ? "text-slate-100" : "text-[#203641]"}`}
          >
            <p className="text-[10px] font-semibold tracking-[.2em]">
              WINMAX / MAKASLI TENTE
            </p>
            <p className="mt-1 text-sm tabular-nums">
              {draft.widthMm / 10} × {draft.projectionMm / 10} cm ·{" "}
              {(
                (draft.widthMm * draft.projectionMm) /
                1_000_000
              ).toLocaleString("tr-TR")}{" "}
              m²
            </p>
          </div>
          <canvas
            ref={canvas}
            className="h-[360px] w-full touch-none sm:h-[470px]"
            aria-label="3D tente. Ok tuşlarıyla döndürün, artı ve eksiyle yakınlaştırın."
            tabIndex={0}
          />
          {!ready && !sceneError && (
            <p
              role="status"
              className="absolute bottom-5 left-5 rounded bg-white/90 px-3 py-2 text-xs text-slate-700"
            >
              <span aria-hidden className="inline-block h-2 w-16 animate-pulse rounded bg-slate-300 motion-reduce:animate-none" /><span className="sr-only">3D görünüm hazırlanıyor</span>
            </p>
          )}
          {sceneError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-card p-6">
              {previewImage && (
                <Image
                  src={previewImage}
                  width={640}
                  height={360}
                  alt="Kaydedilmiş tente görünümü"
                  unoptimized
                />
              )}
              <p role="alert" className="text-sm">
                {sceneError}
              </p>
            </div>
          )}
          <button
            type="button"
            aria-label="3D görünümü tam ekran aç"
            className="absolute bottom-4 right-4 rounded-md bg-white/90 p-2 text-slate-700"
            onClick={() =>
              stage.current
                ?.requestFullscreen?.()
                .catch(() =>
                  setError("Tam ekran bu tarayıcıda desteklenmiyor."),
                )
            }
          >
            <Expand size={18} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {views.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              className={`rounded-md border px-3 py-2 text-xs ${view === key ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
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
            className="rf-icon-button"
            aria-label="Kamerayı sıfırla"
            onClick={() => {
              setView("perspective");
              controller.current?.selectView("perspective");
            }}
          >
            <RotateCcw size={15} />
          </button>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-border p-3">
          <button
            type="button"
            aria-label="Açılma kapanma animasyonunu başlat veya durdur"
            className="rf-icon-button"
            onClick={() => controller.current?.toggleAnimation()}
          >
            <Play size={16} />
          </button>
          <label className="flex flex-1 items-center gap-3 text-xs">
            Açıklık
            <input
              type="range"
              min={0}
              max={100}
              value={opening}
              className="min-w-0 flex-1"
              onChange={(e) => {
                setOpening(+e.target.value);
                controller.current?.setOpening(+e.target.value);
              }}
            />
          </label>
          <output className="w-10 text-right text-xs tabular-nums">
            %{Math.round(opening)}
          </output>
        </div>
        <label className="flex items-center gap-3 text-xs">
          Gündüz / gece
          <input
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
          Temsili 3D görünüm. Üretim uygunluğu onaylı reçeteyle doğrulanır.
        </p>
      </div>
      <div className="space-y-4">
        {error && (
          <p
            role="alert"
            className="rounded border border-destructive/30 p-3 text-xs text-destructive"
          >
            {error}
          </p>
        )}
        <div>
          <h3 className="rf-section-title">Teknik yapılandırma</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Ölçüler milimetre cinsindedir.
          </p>
        </div>
        <fieldset disabled={readOnly} className="space-y-4 disabled:opacity-80">
          {(
            [
              ["widthMm", "En", 2500, 15000],
              ["projectionMm", "Açılım", 1500, 5000],
              ["mountingHeightMm", "Montaj yüksekliği", 2200, 4500],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key} className="block text-xs">
              {label} (mm)
              <input
                type="number"
                min={min}
                max={max}
                step={10}
                value={draft[key]}
                className="rf-input mt-1 w-full"
                onChange={(e) => update(key, Number(e.target.value))}
              />
            </label>
          ))}
          {(
            [
              ["body", "Gövde rengi", BODY_COLORS],
              ["fabric", "Kumaş", FABRIC_COLORS],
            ] as const
          ).map(([kind, label, colors]) => (
            <div key={kind}>
              <p className="mb-2 text-xs">
                {label}: {kind === "body" ? draft.bodyName : draft.fabricName}
              </p>
              <div className="flex gap-2">
                {colors.map(([name, color]) => (
                  <button
                    type="button"
                    key={name}
                    aria-label={`${label}: ${name}`}
                    aria-pressed={
                      (kind === "body"
                        ? draft.bodyColor
                        : draft.fabricColor) === color
                    }
                    className="h-8 w-8 rounded-full border-2 border-border aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:ring-offset-2"
                    style={{ backgroundColor: color }}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        ...(kind === "body"
                          ? { bodyColor: color, bodyName: name }
                          : { fabricColor: color, fabricName: name }),
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          ))}
          <label className="flex items-center justify-between text-xs">
            Özel gövde rengi
            <input
              type="color"
              aria-label="Özel gövde rengi"
              value={draft.bodyColor}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  bodyColor: e.target.value,
                  bodyName: e.target.value,
                }))
              }
            />
          </label>
          <label className="block text-xs">
            Motor ve kontrol
            <select
              value={draft.motor}
              className="rf-input mt-1 w-full"
              onChange={(e) =>
                update("motor", e.target.value as AwningConfiguration["motor"])
              }
            >
              <option value="remote">UBESER · Kumandalı</option>
              <option value="remote_wall">
                UBESER · Kumanda + duvar butonu
              </option>
            </select>
          </label>
          <label className="block text-xs">
            LED
            <select
              value={draft.led}
              className="rf-input mt-1 w-full"
              onChange={(e) =>
                update("led", e.target.value as AwningConfiguration["led"])
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
              type="range"
              min={0}
              max={100}
              value={draft.brightness}
              disabled={draft.led === "off"}
              onChange={(e) => update("brightness", +e.target.value)}
            />
            <span>%{draft.brightness}</span>
          </label>
        </fieldset>
        <p className="rounded-md bg-muted p-3 text-xs leading-5">
          {awningSummary(draft)}
        </p>
        {!readOnly && onApply && (
          <button
            type="button"
            className="rf-primary-button w-full"
            onClick={apply}
          >
            <Check size={15} /> Seçimleri uygula
          </button>
        )}
      </div>
    </div>
  );
}
export function AwningDialog({
  configuration,
  previewImage,
  onApply,
  label = "3D yapılandır",
  readOnly = false,
}: {
  configuration?: AwningConfiguration;
  previewImage?: string;
  onApply?: (c: AwningConfiguration, image?: string) => void;
  label?: string;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary"
        >
          <Box size={15} />
          {label}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-[81] overflow-y-auto bg-card p-5 sm:inset-6 sm:rounded-xl sm:p-7 xl:inset-x-[8%]">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <Dialog.Title className="text-xl font-semibold">
                WINMAX Makaslı Tente
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                Ölçü ve donanıma özel 3D görünüm
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="rf-icon-button"
              aria-label="3D yapılandırıcıyı kapat"
            >
              <X size={20} />
            </Dialog.Close>
          </div>
          <AwningConfigurator
            value={configuration}
            readOnly={readOnly}
            previewImage={previewImage}
            onApply={(c, image) => {
              onApply?.(c, image);
              setOpen(false);
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
