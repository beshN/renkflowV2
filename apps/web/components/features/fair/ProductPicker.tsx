"use client";
import { useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { configuratorText, fairText, INTL_LOCALE, productName, productPitch, type Locale } from "@/lib/features/fair/i18n";
import { productImage } from "@/lib/features/fair/media";
import { PICKER_PRODUCTS, productRange, type FairKind } from "@/lib/features/fair/products";

type Category = "all" | "roof" | "glass" | "screen";
const FEATURED: FairKind = "makasli";

/** "Width 0.9–7.8 m": what a visitor can set on this product. */
function rangeLine(locale: Locale, kind: FairKind) {
  const t = configuratorText(locale, kind),
    r = productRange(kind),
    m = (n: number) => (n / 1000).toLocaleString(INTL_LOCALE[locale], { maximumFractionDigits: 1 });
  const span = ([a, b]: [number, number]) => `${m(a)}–${m(b)} m`;
  return [`${t.width} ${span(r.width)}`, r.depth ? `${t.projection} ${span(r.depth)}` : `${t.height} ${span(r.height)}`].join(" · ");
}

/**
 * The products as a catalogue of real installations: WINMAX leads, the rest sit under their
 * category; the caption under each photo carries the name, what it is, and the sizes it comes in.
 */
/** Four products sit in one row of four, not three plus a gap. */
const columns = (count: number, kiosk: boolean) =>
  kiosk
    ? count === 4 ? "grid-cols-4 portrait:grid-cols-2" : "grid-cols-3 portrait:grid-cols-2"
    : count === 4 ? "grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-3";

export function ProductPicker({ locale, onPick, disabled = false, kiosk = false }: { locale: Locale; onPick: (kind: FairKind) => void; disabled?: boolean; kiosk?: boolean }) {
  const f = fairText(locale);
  const [category, setCategory] = useState<Category>("all");
  const tabs: Array<[Category, string]> = [["all", f.allProducts], ["roof", f.categories.roof], ["glass", f.categories.glass], ["screen", f.categories.screen]];
  const groups = (["roof", "glass", "screen"] as const)
    .filter((c) => category === "all" || category === c)
    .map((c) => ({ category: c, products: PICKER_PRODUCTS.filter((p) => p.category === c && (category !== "all" || p.kind !== FEATURED)) }))
    .filter((g) => g.products.length);

  const card = (kind: FairKind, priority = false) => (
    <li key={kind}>
      <button type="button" disabled={disabled} className="group block w-full text-left outline-none disabled:opacity-50" onClick={() => onPick(kind)}>
        <span className="relative block aspect-[3/2] overflow-hidden rounded-[4px] bg-muted ring-offset-2 group-focus-visible:ring-[3px] group-focus-visible:ring-primary">
          <Image src={productImage(kind)} alt="" fill unoptimized priority={priority} sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover transition duration-500 ease-out group-hover:scale-[1.04] group-active:scale-[1.04] motion-reduce:transition-none" />
        </span>
        <span className={`mt-3 flex items-start justify-between gap-3 ${kiosk ? "text-xl" : ""}`}>
          <span className="min-w-0">
            <span className={`fx-title block ${kiosk ? "text-2xl" : "text-lg sm:text-xl"} group-hover:text-primary`}>{productName(locale, kind)}</span>
            <span className={`mt-1 block text-muted-foreground ${kiosk ? "text-lg" : "text-sm"}`}>{productPitch(locale, kind)}</span>
            <span className={`fx-note mt-2 block ${kiosk ? "!text-base" : ""}`}>{rangeLine(locale, kind)}</span>
          </span>
          <ArrowRight size={kiosk ? 26 : 20} aria-hidden className="mt-1.5 flex-none text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary motion-reduce:transition-none" />
        </span>
      </button>
    </li>
  );

  return (
    <section aria-labelledby="pick-title" className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-border pb-0">
        <div className="pb-4">
          <h1 id="pick-title" className={`fx-display ${kiosk ? "text-5xl" : "text-3xl sm:text-4xl"}`}>{f.chooseProduct}</h1>
          <p className={`fx-copy mt-2 text-muted-foreground ${kiosk ? "text-xl" : ""}`}>{f.chooseProductHint}</p>
        </div>
        <div role="group" aria-label={f.chooseProduct} className="-mb-px flex max-w-full overflow-x-auto">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={category === key}
              className={`shrink-0 border-b-2 px-4 font-medium transition-colors ${kiosk ? "min-h-16 text-xl" : "min-h-12 text-[0.9375rem]"} ${category === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCategory(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {category === "all" && (
        <button type="button" disabled={disabled} className="group fx-sheet grid w-full overflow-hidden text-left outline-none focus-visible:ring-[3px] focus-visible:ring-primary disabled:opacity-50 md:grid-cols-[1.35fr_1fr]" onClick={() => onPick(FEATURED)}>
          <span className={`relative block ${kiosk ? "min-h-[26rem] portrait:min-h-[30rem]" : "min-h-64 md:min-h-[22rem]"}`}>
            <Image src={productImage(FEATURED)} alt="" fill unoptimized priority sizes="(min-width: 768px) 60vw, 100vw" className="object-cover transition duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none" />
          </span>
          <span className={`flex flex-col justify-center gap-4 ${kiosk ? "p-12" : "p-6 sm:p-9"}`}>
            <span className="fx-note">{f.featured}</span>
            <span className={`fx-display block ${kiosk ? "text-5xl" : "text-3xl sm:text-4xl"}`}>{productName(locale, FEATURED)}</span>
            <span className={`block text-muted-foreground ${kiosk ? "text-2xl" : "text-base sm:text-lg"}`}>{productPitch(locale, FEATURED)}</span>
            <span className={`fx-note ${kiosk ? "!text-lg" : ""}`}>{rangeLine(locale, FEATURED)}</span>
            <span className={`fx-btn mt-2 w-fit ${kiosk ? "!min-h-16 !px-8 text-xl" : ""}`}>
              {f.designIn3d} <ArrowRight size={kiosk ? 26 : 18} aria-hidden />
            </span>
          </span>
        </button>
      )}

      {groups.map((g) => (
        <div key={g.category}>
          <div className="mb-5 flex items-baseline gap-3 border-b border-border pb-2">
            <h2 className={`fx-title ${kiosk ? "text-3xl" : "text-xl"}`}>{f.categories[g.category]}</h2>
            <span className="fx-note">{g.products.length}</span>
          </div>
          <ul className={`grid gap-x-6 gap-y-9 ${columns(g.products.length, kiosk)}`}>
            {g.products.map((p, i) => card(p.kind, i < 3))}
          </ul>
        </div>
      ))}
    </section>
  );
}
