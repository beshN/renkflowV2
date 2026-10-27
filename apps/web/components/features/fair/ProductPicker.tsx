"use client";
import { fairText, productName, type Locale } from "@/lib/features/fair/i18n";
import { FAIR_PRODUCTS, type FairKind } from "@/lib/features/fair/products";

/** The products of the configurator, the same list on every screen. */
export function ProductPicker({ locale, onPick, disabled = false, kiosk = false }: { locale: Locale; onPick: (kind: FairKind) => void; disabled?: boolean; kiosk?: boolean }) {
  const f = fairText(locale);
  return (
    <section aria-labelledby="pick-title" className="space-y-4">
      <div>
        <h1 id="pick-title" className="font-display text-2xl font-semibold sm:text-3xl">{f.chooseProduct}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{f.chooseProductHint}</p>
      </div>
      <div className={`grid gap-3 ${kiosk ? "grid-cols-3 xl:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {FAIR_PRODUCTS.map((p) => (
          <button
            key={p.kind}
            type="button"
            disabled={disabled}
            className={`flex flex-col items-start gap-1 rounded-lg border border-border bg-card text-left transition hover:border-primary focus-visible:border-primary disabled:opacity-50 ${kiosk ? "min-h-32 p-5" : "min-h-24 p-4"}`}
            onClick={() => onPick(p.kind)}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{f.categories[p.category]}</span>
            <span className={kiosk ? "text-xl font-semibold" : "text-base font-semibold"}>{productName(locale, p.kind)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
