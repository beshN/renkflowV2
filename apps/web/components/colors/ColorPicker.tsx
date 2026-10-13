'use client';

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ANODIZED, DEFAULT_FINISH, FINISHES, RAL_GROUPS, RAW_LABEL, colorKey, formatColor, parseColor, searchRal,
  type Finish, type RalGroup,
} from '@/lib/features/colors/color-spec';
import { cn } from '@/lib/utils';
import { ColorChip, ColorPreview, ColorSwatch } from './ColorSwatch';

type Kind = 'ral' | 'raw' | 'anodized' | 'wood' | 'custom';
const KINDS: Array<{ key: Kind; label: string }> = [
  { key: 'ral', label: 'RAL' },
  { key: 'raw', label: 'Boyasız' },
  { key: 'anodized', label: 'Eloksal' },
  { key: 'wood', label: 'Ahşap desen' },
  { key: 'custom', label: 'Özel renk' },
];

function StockMark({ inStock }: { inStock: boolean | undefined }) {
  if (inStock === undefined) return null;
  return inStock
    ? <span className="rounded-full border border-emerald-600/30 px-1.5 text-[10px] leading-4 text-emerald-700 dark:text-emerald-300">stokta</span>
    : <span className="sr-only">stokta yok</span>;
}

const RalOption = memo(function RalOption({ code, name, hex, selected, stocked, focused, index, onFocus, onPick }: {
  code: string; name: string; hex: string; selected: boolean; stocked?: boolean; focused: boolean; index: number;
  onFocus: (index: number) => void; onPick: (code: string, index: number) => void;
}) {
  return <button type="button" role="option" aria-selected={selected} aria-label={`RAL ${code} ${name}${stocked ? ', stokta' : ''}`}
    tabIndex={focused ? 0 : -1} onFocus={() => onFocus(index)} onClick={() => onPick(code, index)}
    className={cn('flex min-h-[64px] flex-col items-stretch gap-1 rounded-md border p-1 text-left text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring', selected ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-border')}
    style={{ contentVisibility: 'auto', containIntrinsicSize: '72px 86px' }}>
    <span className="block h-8 w-full rounded-[4px] border border-black/15 dark:border-white/20" style={{ background: hex }} />
    <span className="flex items-center justify-between gap-1 font-medium tabular-nums">{code}{stocked && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}</span>
    <span className="truncate text-muted-foreground">{name}</span>
  </button>;
});

/**
 * The one colour picker: every RAL Classic colour (search by code or name, filter by group), the
 * non-RAL finishes and a named custom colour; the paint finish is chosen apart from the colour.
 * The firm's frequently used colours come first. Stock is only shown, never limits the choice.
 * The value is the canonical text ("RAL 7016 Mat") that the record stores.
 */
export function ColorPicker({ value, onChange, favorites = [], stockColors, label = 'Renk' }: {
  value: string;
  onChange: (text: string) => void;
  favorites?: string[];
  /** Colours on the shelf; when given, each colour says whether it is in stock. */
  stockColors?: string[];
  label?: string;
}) {
  const uid = useId();
  const changeHandler = useRef(onChange);
  changeHandler.current = onChange;
  const spec = parseColor(value);
  const [kind, setKind] = useState<Kind>(spec.kind === 'text' ? 'ral' : spec.kind);
  const [finish, setFinish] = useState<Finish>(spec.kind === 'ral' || (spec.kind === 'custom' && spec.finish) ? (spec.finish ?? DEFAULT_FINISH) : DEFAULT_FINISH);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<RalGroup | null>(null);
  const [woodName, setWoodName] = useState(spec.kind === 'wood' ? spec.name : '');
  const [customName, setCustomName] = useState(spec.kind === 'custom' ? spec.name : '');
  const [customHex, setCustomHex] = useState(spec.kind === 'custom' ? spec.hex : null);
  const [active, setActive] = useState(0);
  // The parent may set the value (a favourite, a reset after "add"): the tab and fields follow it.
  useEffect(() => {
    const s = parseColor(value);
    if (!value) {
      setWoodName('');
      setCustomName('');
      setCustomHex(null);
      return;
    }
    if (s.kind === 'text') return;
    setKind(s.kind);
    if (s.kind === 'ral') setFinish(s.finish);
    if (s.kind === 'wood') setWoodName(s.name);
    if (s.kind === 'custom') {
      setCustomName(s.name);
      setCustomHex(s.hex);
      if (s.finish) setFinish(s.finish);
    }
  }, [value]);
  const grid = useRef<HTMLDivElement>(null);

  const stockKeys = useMemo(() => (stockColors ? new Set(stockColors.map(colorKey)) : null), [stockColors]);
  const inStock = (text: string) => (stockKeys ? stockKeys.has(colorKey(text)) : undefined);
  const results = useMemo(() => searchRal(query, group), [query, group]);
  const selectedCode = spec.kind === 'ral' ? spec.code : null;

  const pickOption = useCallback((code: string, index: number) => {
    setActive(index);
    changeHandler.current(formatColor({ kind: 'ral', code, finish, finishAssumed: false }));
  }, [finish]);
  const pickRal = (code: string, f: Finish = finish) => onChange(formatColor({ kind: 'ral', code, finish: f, finishAssumed: false }));
  const setCustom = (name: string, hex: string | null, f: Finish | null) => {
    setCustomName(name);
    setCustomHex(hex);
    onChange(name.trim() ? formatColor({ kind: 'custom', name: name.trim(), finish: f, hex }) : '');
  };
  const changeFinish = (f: Finish) => {
    setFinish(f);
    if (spec.kind === 'ral') pickRal(spec.code, f);
    if (spec.kind === 'custom') setCustom(customName, customHex, f);
  };

  // One tab stop for the whole grid; arrows move, Enter/Space choose (listbox pattern).
  const onGridKey = (e: React.KeyboardEvent) => {
    const columns = grid.current ? getComputedStyle(grid.current).gridTemplateColumns.split(' ').length : 1;
    const move: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    let next = active;
    if (e.key in move) next = Math.min(results.length - 1, Math.max(0, active + move[e.key]));
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = results.length - 1;
    else return;
    e.preventDefault();
    setActive(next);
    grid.current?.querySelectorAll<HTMLElement>('[role="option"]')[next]?.focus();
  };
  const focusIndex = Math.min(active, Math.max(0, results.length - 1));

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-xs">{label}</legend>

      {favorites.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sık kullanılanlar</p>
          <div className="flex flex-wrap gap-1.5">
            {favorites.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={colorKey(f) === colorKey(value)}
                className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2 text-xs', colorKey(f) === colorKey(value) ? 'border-primary ring-2 ring-primary/25' : 'border-border hover:bg-accent')}
                onClick={() => {
                  const s = parseColor(f);
                  if (s.kind !== 'text') setKind(s.kind);
                  if (s.kind === 'ral') setFinish(s.finish);
                  onChange(s.kind === 'text' ? f : formatColor(s));
                }}
              >
                <ColorChip color={f} size={14} />
                <StockMark inStock={inStock(f)} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Renk türü">
        {KINDS.map((k) => (
          <button key={k.key} type="button" role="radio" aria-checked={kind === k.key}
            className={cn('min-h-9 rounded-md border px-3 text-xs', kind === k.key ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-accent')}
            onClick={() => {
              if (k.key === kind) return;
              setKind(k.key);
              // A choice from another kind does not stay selected behind the new tab.
              if (k.key === 'raw') onChange(RAW_LABEL);
              else if (k.key === 'wood' && woodName.trim()) onChange(formatColor({ kind: 'wood', name: woodName.trim() }));
              else if (k.key === 'custom' && customName.trim()) onChange(formatColor({ kind: 'custom', name: customName.trim(), finish, hex: customHex }));
              else onChange('');
            }}
          >{k.label}</button>
        ))}
      </div>

      {(kind === 'ral' || kind === 'custom') && (
        <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Boya cinsi">
          <span className="mr-1 text-xs text-muted-foreground">Boya cinsi</span>
          {FINISHES.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={finish === f}
              className={cn('min-h-9 rounded-md border px-3 text-xs', finish === f ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-accent')}
              onClick={() => changeFinish(f)}
            >{f}</button>
          ))}
        </div>
      )}

      {kind === 'ral' && (
        <div className="space-y-2">
          <input
            className="rf-input w-full"
            type="search"
            aria-label="RAL ara"
            placeholder="Kod veya ad: 7016, antrasit"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          />
          <div className="flex flex-wrap gap-1" aria-label="Renk grubu">
            {[{ key: null, label: 'Tümü' }, ...RAL_GROUPS].map((g) => (
              <button key={g.key ?? 'all'} type="button" aria-pressed={group === g.key}
                className={cn('min-h-8 rounded-full border px-2.5 text-[11px]', group === g.key ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent')}
                onClick={() => { setGroup(g.key as RalGroup | null); setActive(0); }}
              >{g.label}</button>
            ))}
          </div>
          {results.length ? (
            <div
              ref={grid}
              role="listbox"
              aria-label="RAL renkleri"
              id={`${uid}-ral`}
              onKeyDown={onGridKey}
              className="grid max-h-72 grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5 overflow-y-auto rounded-md border border-border p-1.5"
            >
              {results.map((c, i) => <RalOption key={c.code} code={c.code} name={c.name} hex={c.hex}
                selected={c.code === selectedCode} stocked={inStock(`RAL ${c.code} ${finish}`)} focused={i === focusIndex}
                index={i} onFocus={setActive} onPick={pickOption} />)}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground" role="status">&quot;{query}&quot; için RAL rengi yok. Kod (7016) ya da ad (antrasit) yazın.</p>
          )}
          {stockKeys && <p className="text-[11px] text-muted-foreground"><span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 align-middle" />Bu boya cinsiyle stokta olan renkler.</p>}
        </div>
      )}

      {kind === 'raw' && <p className="text-xs text-muted-foreground">Boyasız (ham alüminyum) seçildi.</p>}

      {kind === 'anodized' && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Eloksal">
          {(Object.keys(ANODIZED) as Array<keyof typeof ANODIZED>).map((tone) => (
            <button key={tone} type="button" role="radio" aria-checked={spec.kind === 'anodized' && spec.tone === tone}
              className={cn('inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm', spec.kind === 'anodized' && spec.tone === tone ? 'border-primary ring-2 ring-primary/25' : 'border-border hover:bg-accent')}
              onClick={() => onChange(ANODIZED[tone])}
            ><ColorSwatch color={ANODIZED[tone]} size={18} />{ANODIZED[tone]}</button>
          ))}
        </div>
      )}

      {kind === 'wood' && (
        <label className="block text-xs">Desen adı
          <input className="rf-input mt-1 w-full" maxLength={60} placeholder="ör. Ceviz, Altın meşe" value={woodName}
            onChange={(e) => { setWoodName(e.target.value); onChange(e.target.value.trim() ? formatColor({ kind: 'wood', name: e.target.value.trim() }) : ''); }} />
        </label>
      )}

      {kind === 'custom' && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="block text-xs">Renk adı
            <input className="rf-input mt-1 w-full" maxLength={60} placeholder="ör. Bordo metalik (boyacının kodu)" value={customName}
              onChange={(e) => setCustom(e.target.value, customHex, finish)} />
          </label>
          <div className="text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={customHex !== null} onChange={(e) => setCustom(customName, e.target.checked ? '#808080' : null, finish)} />
              Ekran rengi ekle
            </label>
            {customHex !== null && (
              <input type="color" aria-label="Ekran rengi" className="mt-1 h-9 w-20 cursor-pointer rounded border border-border bg-transparent" value={customHex.toLowerCase()}
                onChange={(e) => setCustom(customName, e.target.value.toUpperCase(), finish)} />
            )}
          </div>
        </div>
      )}

      {value && (
        <ColorPreview color={value} withProfile>
          {stockKeys && (
            <p className="text-xs">{inStock(value) ? 'Bu renkte profil stokta var.' : 'Bu renkte profil stokta yok; teklif verilebilir, malzeme satın almayla gelir.'}</p>
          )}
        </ColorPreview>
      )}
      {value && parseColor(value).kind === 'text' && (
        <p className="text-xs text-muted-foreground">&quot;{value}&quot; RAL listesinden önce yazılmış bir ad; olduğu gibi korunur. Yerine RAL rengi seçebilirsiniz.</p>
      )}
    </fieldset>
  );
}
