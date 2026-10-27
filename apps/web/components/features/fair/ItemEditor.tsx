"use client";
import { useRef, useState } from "react";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { AwningConfigurator } from "@/components/features/awning/AwningConfigurator";
import { ProductConfigurator } from "@/components/features/product-3d/ProductConfigurator";
import type { AwningConfiguration } from "@/lib/features/awning/configuration";
import type { ProductKind, VisualizationConfiguration } from "@/lib/features/product-3d/catalog";
import { shrinkPreview } from "@/lib/features/fair/client";
import { limitProblem, type DesignItem } from "@/lib/features/fair/design";
import { configuratorText, fairText, INTL_LOCALE, productName, type Locale } from "@/lib/features/fair/i18n";
import { CONTROL_LABELS, fairProduct } from "@/lib/features/fair/products";

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
  const stage = kiosk ? "h-[56vh]" : "h-[340px] sm:h-[460px]";

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
  return (
    <section aria-labelledby="editor-title" className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" aria-label={f.back} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-card" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <h1 id="editor-title" className="font-display text-xl font-semibold sm:text-2xl">{productName(locale, item.kind)}</h1>
      </div>
      {item.kind === "makasli" ? (
        <AwningConfigurator
          value={item.awning}
          text={text}
          locale={INTL_LOCALE[locale]}
          stageClassName={stage}
          touchControls={kiosk}
          onValidationChange={(m) => setInvalid(sizeMessage(m))}
          onChange={(awning, image) => {
            latest.current = { awning, image };
          }}
        />
      ) : (
        <ProductConfigurator
          kind={item.kind as ProductKind}
          value={item.configuration ? { configuration: item.configuration } : undefined}
          text={text}
          stageClassName={stage}
          touchControls={kiosk}
          onValidationChange={(m) => setInvalid(sizeMessage(m))}
          onChange={(value) => {
            latest.current = { configuration: value.configuration, image: value.image };
          }}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
          {rule.controls.length > 0 && (
            <label className="block text-sm">
              {f.control}
              <select className="rf-input mt-1 w-full" value={control} onChange={(e) => setControl(e.target.value)}>
                <option value="">—</option>
                {rule.controls.map((key) => <option key={key} value={key}>{CONTROL_LABELS[locale][key]}</option>)}
              </select>
            </label>
          )}
          {/* Free text needs a keyboard: on the kiosk it is left for the phone. */}
          {!kiosk && (
            <label className="block text-sm sm:col-span-2">
              {f.otherRequests}
              <input className="rf-input mt-1 w-full" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          )}
      </div>
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-1" role="group" aria-label={f.quantity}>
          <button type="button" aria-label={`${f.quantity} −`} className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-card" onClick={() => setQuantity((q) => Math.max(1, q - 1))}><Minus size={18} /></button>
          <output className="w-16 text-center text-sm tabular-nums" aria-live="polite">{f.pieces(quantity)}</output>
          <button type="button" aria-label={`${f.quantity} +`} className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-card" onClick={() => setQuantity((q) => Math.min(99, q + 1))}><Plus size={18} /></button>
        </div>
        <button type="button" disabled={!!invalid || busy} className="rf-primary-button min-h-12 flex-1 justify-center text-base" onClick={() => void save()}>
          {busy ? f.preparingPreview : isNew ? f.addToList : f.saveChanges}
        </button>
        {invalid && <p role="alert" className="w-full text-sm text-rose-700 dark:text-rose-300">{invalid}</p>}
      </div>
    </section>
  );
}
