'use client';

import { cn } from '@/lib/utils';

/** Three everyday sections; every other section stays one selection away. */
export function SectionPicker<T extends string>({ label, items, value, onChange, primary }: {
  label: string;
  items: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  primary: readonly T[];
}) {
  const secondary = items.filter(item => !primary.includes(item.id));
  return <nav aria-label={label} className="border-b border-border pb-3">
    <label className="flex items-center gap-3 text-sm sm:hidden">
      <span className="shrink-0 text-muted-foreground">Bölüm</span>
      <select aria-label={label} className="rf-input min-w-0 flex-1" value={value} onChange={event => onChange(event.target.value as T)}>
        {items.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
    <div className="hidden flex-wrap items-center gap-2 sm:flex">
      {items.filter(item => primary.includes(item.id)).map(item => <button key={item.id} type="button" aria-pressed={value === item.id}
        className={cn('min-h-11 rounded-md px-4 text-sm font-medium', value === item.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
        onClick={() => onChange(item.id)}>{item.label}</button>)}
      {secondary.length > 0 && <select aria-label={label} className="rf-input max-w-full sm:ml-auto" value={primary.includes(value) ? '' : value}
        onChange={event => { if (event.target.value) onChange(event.target.value as T); }}>
        <option value="" disabled>Diğer bölümler</option>
        {secondary.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>}
    </div>
  </nav>;
}
