"use client";
import { useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { fairText, productName, productPitch, type Locale } from "@/lib/features/fair/i18n";
import { productImage } from "@/lib/features/fair/media";
import { PICKER_PRODUCTS, type FairKind } from "@/lib/features/fair/products";

type Category = "all" | "roof" | "glass" | "screen";

/**
 * The products of the configurator as photo cards of real Renk installations, the same list on every
 * screen. WINMAX leads as the featured card; category chips narrow the grid.
 */
export function ProductPicker({ locale, onPick, disabled = false, kiosk = false }: { locale: Locale; onPick: (kind: FairKind) => void; disabled?: boolean; kiosk?: boolean }) {
  const f = fairText(locale);
  const [category, setCategory] = useState<Category>("all");
  const products = PICKER_PRODUCTS.filter((p) => category === "all" || p.category === category);
  const chips: Array<[Category, string]> = [["all", f.allProducts], ["roof", f.categories.roof], ["glass", f.categories.glass], ["screen", f.categories.screen]];

  return (
    <section aria-labelledby="pick-title" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="pick-title" className={`font-display font-semibold ${kiosk ? "text-4xl" : "text-2xl sm:text-3xl"}`}>{f.chooseProduct}</h1>
          <p className={`mt-1 text-muted-foreground ${kiosk ? "text-lg" : "text-sm"}`}>{f.chooseProductHint}</p>
        </div>
        <div role="group" aria-label={f.chooseProduct} className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
          {chips.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={category === key}
              className={`shrink-0 rounded-full border px-4 font-medium transition-colors ${kiosk ? "min-h-12 text-base" : "min-h-10 text-sm"} ${category === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40"}`}
              onClick={() => setCategory(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-3 sm:gap-4 ${kiosk ? "grid-cols-3 xl:grid-cols-4" : "grid-cols-2 lg:grid-cols-3"}`}>
        {products.map((p, index) => {
          const featured = category === "all" && index === 0;
          return (
            <button
              key={p.kind}
              type="button"
              disabled={disabled}
              className={`group relative isolate overflow-hidden rounded-xl bg-neutral-900 text-left shadow-sm outline-none transition duration-200 focus-visible:ring-4 focus-visible:ring-primary/50 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none ${featured ? "col-span-2 row-span-2" : ""} ${featured ? (kiosk ? "min-h-[26rem] portrait:min-h-[34rem]" : "min-h-72 sm:min-h-96") : kiosk ? "min-h-52 portrait:min-h-[17rem]" : "min-h-44 sm:min-h-52"}`}
              onClick={() => onPick(p.kind)}
            >
              <Image
                src={productImage(p.kind)}
                alt=""
                fill
                unoptimized
                priority={index < 4}
                sizes={featured ? "(min-width: 1024px) 66vw, 100vw" : "(min-width: 1024px) 33vw, 50vw"}
                className="-z-10 object-cover transition duration-700 ease-out group-hover:scale-105 group-active:scale-105 motion-reduce:transition-none"
              />
              <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/35 to-black/0" />
              {featured && (
                <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[.14em] text-neutral-900">{f.featured}</span>
              )}
              <span className={`absolute inset-x-0 bottom-0 flex flex-col gap-1 text-white ${featured ? "p-5 sm:p-7" : "p-3 sm:p-4"}`}>
                <span className="text-[10px] font-semibold uppercase tracking-[.16em] text-white/70">{f.categories[p.category]}</span>
                <span className={`font-display font-semibold leading-tight ${featured ? (kiosk ? "text-4xl" : "text-2xl sm:text-4xl") : kiosk ? "text-xl" : "text-base sm:text-lg"}`}>{productName(locale, p.kind)}</span>
                <span className={`text-white/85 ${featured ? "max-w-xl text-sm sm:text-base" : "line-clamp-2 text-xs sm:text-sm"} ${!featured && !kiosk ? "hidden sm:block" : ""}`}>{productPitch(locale, p.kind)}</span>
                {featured && (
                  <span className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition group-hover:gap-3 motion-reduce:transition-none">
                    {f.designIn3d} <ArrowRight size={16} aria-hidden />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
