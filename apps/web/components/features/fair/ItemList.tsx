"use client";
import Image from "next/image";
import { Pencil, Trash2 } from "lucide-react";
import { itemSpecs, itemSummary, type DesignItem } from "@/lib/features/fair/design";
import { fairText, productName, type Locale } from "@/lib/features/fair/i18n";

/** The design's products: preview, summary, the chosen options, and (when editable) edit/remove. */
export function ItemList({ locale, items, onEdit, onRemove, showSpecs = false }: { locale: Locale; items: DesignItem[]; onEdit?: (item: DesignItem) => void; onRemove?: (item: DesignItem) => void; showSpecs?: boolean }) {
  const f = fairText(locale);
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-border bg-card p-2">
          <div className="flex items-center gap-3">
            {item.image ? (
              <Image src={item.image} alt={productName(locale, item.kind)} width={112} height={72} unoptimized className="h-[72px] w-28 shrink-0 rounded object-cover" />
            ) : (
              <div className="flex h-[72px] w-28 shrink-0 items-center justify-center rounded bg-muted text-[10px] uppercase tracking-wider text-muted-foreground" aria-hidden>3D</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{itemSummary(locale, item)}</p>
              <span className="mt-1 inline-block h-3 w-3 rounded-full border border-border" style={{ backgroundColor: item.awning?.bodyColor ?? item.configuration?.bodyColor }} aria-hidden />
            </div>
            {onEdit && <button type="button" aria-label={`${f.edit}: ${productName(locale, item.kind)}`} className="flex h-12 w-12 items-center justify-center rounded-md border border-border" onClick={() => onEdit(item)}><Pencil size={16} /></button>}
            {onRemove && <button type="button" aria-label={`${f.remove}: ${productName(locale, item.kind)}`} className="flex h-12 w-12 items-center justify-center rounded-md border border-border" onClick={() => onRemove(item)}><Trash2 size={16} /></button>}
          </div>
          {showSpecs && (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 px-1 text-xs">
              {itemSpecs(locale, item).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          )}
        </li>
      ))}
    </ul>
  );
}
