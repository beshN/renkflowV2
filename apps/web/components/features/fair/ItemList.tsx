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
          <li key={item.id} className="overflow-hidden fx-sheet">
            <div className="flex flex-col gap-4 p-3 sm:flex-row sm:p-4">
              {item.image ? (
                <div className={`${thumb} relative shrink-0 overflow-hidden rounded-[4px] bg-muted`}>
                  <Image src={item.image} alt={name} fill unoptimized sizes="256px" className="object-cover" />
                </div>
              ) : (
                <div className={`${thumb} flex shrink-0 items-center justify-center rounded-[4px] bg-muted text-muted-foreground`} aria-hidden><Box size={28} /></div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className={`fx-display leading-tight ${large ? "text-2xl" : "text-lg"}`}>{name}</p>
                    <p className={`fx-note mt-1 ${large ? "text-lg" : "text-sm"}`}>
                      {itemSize(item)}{item.quantity > 1 && <> · <span className="font-medium text-foreground">{f.pieces(item.quantity)}</span></>}
                    </p>
                  </div>
                  {(onEdit || onRemove) && (
                    <div className="flex gap-2">
                      {onEdit && (
                        <button type="button" aria-label={`${f.edit}: ${name}`} className={`fx-btn fx-btn-quiet gap-2 !px-4 ${large ? "!min-h-14 text-base" : "!min-h-11 text-sm"}`} onClick={() => onEdit(item)}>
                          <Pencil size={16} aria-hidden /> {f.edit}
                        </button>
                      )}
                      {onRemove && (
                        <button type="button" aria-label={`${f.remove}: ${name}`} className={`fx-btn fx-btn-quiet !px-0 ${large ? "!min-h-14 w-14" : "!min-h-11 w-11"}`} onClick={() => onRemove(item)}>
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
                        <dt className="fx-note">{k}</dt>
                        <dd className="fx-figure text-right font-medium sm:text-left">{v}</dd>
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
