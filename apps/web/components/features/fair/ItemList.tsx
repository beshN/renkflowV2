"use client";
import Image from "next/image";
import { Box, Pencil, Trash2 } from "lucide-react";
import { itemChoices, itemSize, type DesignItem } from "@/lib/features/fair/design";
import { fairText, productName, type Locale } from "@/lib/features/fair/i18n";

/** The design's products: preview, name and size, the chosen options, and (when editable) edit/remove. */
export function ItemList({ locale, items, onEdit, onRemove, large = false }: { locale: Locale; items: DesignItem[]; onEdit?: (item: DesignItem) => void; onRemove?: (item: DesignItem) => void; large?: boolean }) {
  const f = fairText(locale);
  const thumb = `aspect-[3/2] w-full ${large ? "sm:w-72" : "sm:w-48"}`;
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const name = productName(locale, item.kind);
        const specs = itemChoices(locale, item);
        return (
          <li key={item.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-4 p-3 sm:flex-row sm:p-4">
              {item.image ? (
                <div className={`${thumb} relative shrink-0 overflow-hidden rounded-lg bg-muted`}>
                  <Image src={item.image} alt={name} fill unoptimized sizes="256px" className="object-cover" />
                </div>
              ) : (
                <div className={`${thumb} flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground`} aria-hidden><Box size={28} /></div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className={`font-display font-semibold leading-tight ${large ? "text-2xl" : "text-lg"}`}>{name}</p>
                    <p className={`mt-0.5 tabular-nums text-muted-foreground ${large ? "text-lg" : "text-sm"}`}>
                      {itemSize(item)}{item.quantity > 1 && <> · <span className="font-medium text-foreground">{f.pieces(item.quantity)}</span></>}
                    </p>
                  </div>
                  {(onEdit || onRemove) && (
                    <div className="flex gap-2">
                      {onEdit && (
                        <button type="button" aria-label={`${f.edit}: ${name}`} className={`inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 font-medium transition hover:border-primary/50 hover:text-primary ${large ? "min-h-14 text-base" : "min-h-11 text-sm"}`} onClick={() => onEdit(item)}>
                          <Pencil size={16} aria-hidden /> {f.edit}
                        </button>
                      )}
                      {onRemove && (
                        <button type="button" aria-label={`${f.remove}: ${name}`} className={`inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:border-rose-300 hover:text-rose-700 ${large ? "h-14 w-14" : "h-11 w-11"}`} onClick={() => onRemove(item)}>
                          <Trash2 size={16} aria-hidden />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {specs.length > 0 && (
                  <dl className={`mt-3 grid gap-x-6 gap-y-1.5 border-t border-border pt-3 sm:grid-cols-2 ${large ? "text-base" : "text-sm"}`}>
                    {specs.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 sm:block">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="text-right font-medium sm:text-left">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
