"use client";
import { useId, useState } from 'react';
import { Box } from 'lucide-react';
import { productSuggestions } from '@/lib/features/product-3d/product-search';
import type { InlineProduct } from '@/lib/features/product-3d/inline';

export function ProductNameInput({ value, onChange, onSelect, label, disabled, className = 'rf-input w-full' }: {
  value: string; onChange: (name: string) => void; onSelect: (kind: InlineProduct) => void; label: string; disabled?: boolean; className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const options = productSuggestions(value), expanded = open && !disabled && options.length > 0;
  const selected = Math.min(active, Math.max(0, options.length - 1));
  function pick(index: number) { onSelect(options[index].kind); setOpen(false); setActive(0); }
  return <div className="relative min-w-0 flex-1">
    <input role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={expanded} aria-controls={id} aria-activedescendant={expanded ? `${id}-${selected}` : undefined}
      autoComplete="off" disabled={disabled} value={value} className={className} placeholder="Ürün adı yazın · örn. makaslı" onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onChange={e => { onChange(e.target.value); setActive(0); setOpen(true); }}
      onKeyDown={e => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Escape') { setOpen(false); return; }
        if (!expanded) return;
        if (e.key === 'Enter') { e.preventDefault(); pick(selected); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setActive((selected + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length); }
      }} />
    {expanded && <div id={id} role="listbox" aria-label="Ürün önerileri" className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl">
      {options.map((p, index) => <button key={p.kind} id={`${id}-${index}`} type="button" role="option" aria-selected={index === selected} onPointerDown={e => e.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => pick(index)} className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm ${index === selected ? 'bg-accent' : ''}`}>
        <Box size={17} aria-hidden /><span className="flex-1">{p.name}</span><span className="text-xs text-muted-foreground">3D · Enter</span>
      </button>)}
    </div>}
  </div>;
}
