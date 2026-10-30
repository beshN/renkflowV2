"use client";
import { useRef, useState } from "react";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { AwningConfigurator } from "@/components/features/awning/AwningConfigurator";
import { ProductConfigurator } from "@/components/features/product-3d/ProductConfigurator";
import type { AwningConfiguration } from "@/lib/features/awning/configuration";
import type { ProductKind, VisualizationConfiguration } from "@/lib/features/product-3d/catalog";
import { shrinkPreview } from "@/lib/features/fair/client";
import { limitProblem, sizes, type DesignItem } from "@/lib/features/fair/design";
import { configuratorText, fairText, INTL_LOCALE, productName, type Locale } from "@/lib/features/fair/i18n";
import { CONTROL_LABELS, fairProduct } from "@/lib/features/fair/products";
import { DimensionStrip, type Dim } from "./DimensionStrip";

/**
 * One product in the shared 3D configurators (WINMAX scene or the product-3d stage), plus quantity,
 * the product's configurable options and a note. Kiosk, phone and web all edit items through this.
 */
export function ItemEditor({
  locale,
  item,
  isNew,
  kiosk = false,
  onSave,
  onBack,
}: {
  locale: Locale;
  item: DesignItem;
  isNew: boolean;
  kiosk?: boolean;
  onSave: (item: DesignItem) => void;
  onBack: () => void;
}) {
  const f = fairText(locale);
  const text = configuratorText(locale, item.kind);
  const rule = fairProduct(item.kind);
  const latest = useRef<{ configuration?: VisualizationConfiguration; awning?: AwningConfiguration; image?: string }>({
    configuration: item.configuration,
    awning: item.awning,
    image: item.image,
  });
  const [quantity, setQuantity] = useState(item.quantity);
  const [control, setControl] = useState(item.options?.control ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [invalid, setInvalid] = useState("");
  const [busy, setBusy] = useState(false);
  const roof = item.kind === "makasli" || rule.category === "roof";
  const [size, setSize] = useState(() => sizes(item));
  const stage = kiosk ? "h-[56vh] portrait:h-[42vh]" : "h-[340px] sm:h-[480px]";
  const dims: Dim[] = [
    { axis: "width", name: text.width ?? "", value: size.widthMm },
    ...(roof ? [{ axis: "depth" as const, name: text.projection ?? "", value: size.projectionMm }] : []),
    { axis: "height", name: (roof ? text.mountingHeight : text.height) ?? "", value: size.heightMm },
  ];
  const strip = <DimensionStrip dims={dims} />;

  async function save() {
    if (invalid || busy) return;
    const candidate = { ...item, configuration: latest.current.configuration, awning: latest.current.awning };
    if (limitProblem(candidate)) {
      setInvalid(f.sizeOutOfRange);
      return;
    }
    setBusy(true);
    // The preview is captured shortly after the 3D scene redraws; wait a moment for it rather than drop it.
    for (let waited = 0; !latest.current.image && waited < 4000; waited += 200) await new Promise((r) => setTimeout(r, 200));
    const image = latest.current.image ? await shrinkPreview(latest.current.image) : undefined;
    setBusy(false);
    onSave({
      ...candidate,
      quantity,
      options: control ? { control: control as NonNullable<DesignItem["options"]>["control"] } : {},
      ...(note.trim() ? { note: note.trim().slice(0, 500) } : { note: undefined }),
      ...(image ? { image } : { image: undefined }),
    });
  }

  const sizeMessage = (message: string) => (message ? f.sizeOutOfRange : "");
  const wide = kiosk ? "text-lg" : "text-sm";
  return (
    <section aria-labelledby="editor-title" className="space-y-6">
      <div className="flex items-center gap-4">
        <button type="button" aria-label={f.back} className={`fx-btn fx-btn-quiet !px-0 ${kiosk ? "!min-h-16 w-16" : "!min-h-12 w-12"}`} onClick={onBack}>
          <ArrowLeft size={kiosk ? 26 : 20} aria-hidden />
        </button>
        <div className="min-w-0">
          <p className={`fx-note ${kiosk ? "!text-lg" : ""}`}>{f.categories[rule.category]}</p>
          <h1 id="editor-title" className={`fx-display leading-none ${kiosk ? "text-5xl" : "text-3xl sm:text-4xl"}`}>{productName(locale, item.kind)}</h1>
        </div>
      </div>
      {item.kind === "makasli" ? (
        <AwningConfigurator
          value={item.awning}
          text={text}
          locale={INTL_LOCALE[locale]}
          stageClassName={stage}
          touchControls
          editableDimensions={!kiosk}
          overlay={strip}
          onValidationChange={(m) => setInvalid(sizeMessage(m))}
          onChange={(awning, image) => {
            latest.current = { awning, image };
            setSize({ widthMm: awning.widthMm, projectionMm: awning.projectionMm, heightMm: awning.mountingHeightMm });
          }}
        />
      ) : (
        <ProductConfigurator
          kind={item.kind as ProductKind}
          value={item.configuration ? { configuration: item.configuration } : undefined}
          text={text}
          stageClassName={stage}
          touchControls
          editableDimensions={!kiosk}
          overlay={strip}
          viewOptionsOpen
          onValidationChange={(m) => setInvalid(sizeMessage(m))}
          onChange={(value) => {
            latest.current = { configuration: value.configuration, image: value.image };
            setSize({ widthMm: value.configuration.widthMm, projectionMm: value.configuration.projectionMm, heightMm: value.configuration.heightMm });
          }}
        />
      )}
      {(rule.controls.length > 0 || !kiosk) && (
        <div className="fx-sheet grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          {rule.controls.length > 0 && (
            <label className="fx-field">
              {f.control}
              <select className="rf-input" value={control} onChange={(e) => setControl(e.target.value)}>
                <option value="">—</option>
                {rule.controls.map((key) => <option key={key} value={key}>{CONTROL_LABELS[locale][key]}</option>)}
              </select>
            </label>
          )}
          {/* Free text needs a keyboard: on the kiosk it is left for the phone. */}
          {!kiosk && (
            <label className="fx-field sm:col-span-2">
              {f.otherRequests}
              <input className="rf-input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          )}
        </div>
      )}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2" role="group" aria-label={f.quantity}>
            <span className={`mr-1 text-muted-foreground ${wide}`}>{f.quantity}</span>
            <button type="button" aria-label={`${f.quantity} −`} className={`fx-btn fx-btn-quiet !px-0 ${kiosk ? "!min-h-16 w-16" : "!min-h-12 w-12"}`} onClick={() => setQuantity((q) => Math.max(1, q - 1))}><Minus size={kiosk ? 24 : 18} aria-hidden /></button>
            <output className={`fx-figure min-w-[3.5rem] text-center font-semibold ${kiosk ? "text-2xl" : "text-lg"}`} aria-live="polite">{quantity}</output>
            <button type="button" aria-label={`${f.quantity} +`} className={`fx-btn fx-btn-quiet !px-0 ${kiosk ? "!min-h-16 w-16" : "!min-h-12 w-12"}`} onClick={() => setQuantity((q) => Math.min(99, q + 1))}><Plus size={kiosk ? 24 : 18} aria-hidden /></button>
          </div>
          <button type="button" disabled={!!invalid || busy} className={`fx-btn ml-auto flex-1 sm:flex-none sm:min-w-[18rem] ${kiosk ? "!min-h-[4.5rem] text-2xl" : "!min-h-12"}`} onClick={() => void save()}>
            {busy ? f.preparingPreview : isNew ? f.addToList : f.saveChanges}
          </button>
          {invalid && <p role="alert" className="w-full text-sm font-medium text-rose-700">{invalid}</p>}
        </div>
      </div>
    </section>
  );
}
