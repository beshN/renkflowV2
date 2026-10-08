import { APPROXIMATE_NOTE, NOTE_TEXT, colorInfo, textOn, type ColorInfo } from '@/lib/features/colors/color-spec';
import { cn } from '@/lib/utils';

/** Stored text, or a colour object from an API (only its canonical label is read back). */
type ColorInput = string | { label: string } | null | undefined;
const info = (color: ColorInput): ColorInfo | null => colorInfo(typeof color === 'string' || color == null ? color : color.label);

/**
 * The finish drawn on a flat swatch, never with gradients: gloss is one thin light band, textured
 * finishes a fine dot pattern in the text colour. Mat has neither.
 */
function FinishMark({ c, idSuffix }: { c: ColorInfo; idSuffix: string }) {
  if (c.finish === 'Parlak') return <span aria-hidden className="absolute inset-x-0 top-[22%] h-[3px] bg-white/45" />;
  if (c.finish !== 'İnce doku' && c.finish !== 'Kum') return null;
  const step = c.finish === 'Kum' ? 5 : 3;
  const id = `rf-finish-${idSuffix}`;
  return (
    <svg aria-hidden className="absolute inset-0 h-full w-full" style={{ color: textOn(c.hex), opacity: 0.18 }}>
      <defs>
        <pattern id={id} width={step} height={step} patternUnits="userSpaceOnUse">
          <circle cx={step / 2} cy={step / 2} r={c.finish === 'Kum' ? 0.9 : 0.5} fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** A square of the colour. A colour with no screen value shows an empty box with a slash. */
export function ColorSwatch({ color, size = 20, className }: { color: ColorInput; size?: number; className?: string }) {
  const c = info(color);
  // Printed quotes and cut lists keep the swatch: browsers drop backgrounds in print otherwise.
  const style = { width: size, height: size, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact', ...(c?.hex ? { background: c.hex } : {}) } as React.CSSProperties;
  return (
    <span
      aria-hidden
      title={c?.label}
      className={cn('relative inline-block shrink-0 overflow-hidden rounded-[4px] border border-black/15 dark:border-white/20', !c?.hex && 'bg-muted', className)}
      style={style}
    >
      {c?.hex ? <FinishMark c={c} idSuffix={`${c.label}-${size}`.replace(/[^a-z0-9]/gi, '')} /> : (
        <svg aria-hidden className="absolute inset-0 h-full w-full text-muted-foreground"><line x1="0" y1="100%" x2="100%" y2="0" stroke="currentColor" strokeWidth="1" /></svg>
      )}
    </span>
  );
}

/** Swatch and canonical text on one line: lists, tables, item cards. */
export function ColorChip({ color, size = 16, showName = false, className }: { color: ColorInput; size?: number; showName?: boolean; className?: string }) {
  const c = info(color);
  if (!c) return <span className={cn('text-muted-foreground', className)}>Renk yok</span>;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 align-middle', className)}>
      <ColorSwatch color={c} size={size} />
      <span className="min-w-0 truncate">
        {c.label}
        {showName && c.kind === 'ral' && <span className="text-muted-foreground"> · {c.name}</span>}
      </span>
    </span>
  );
}

/**
 * The large preview after a colour is chosen: the colour itself with its code written on it in
 * whichever of black/white reads better, then name, finish, hex and the "approximate" note.
 */
export function ColorPreview({ color, className, children, withProfile = false }: { color: ColorInput; className?: string; children?: React.ReactNode; withProfile?: boolean }) {
  const c = info(color);
  if (!c) return null;
  return (
    <figure className={cn('overflow-hidden rounded-md border border-border', className)} aria-label={`Renk önizlemesi: ${c.label}`}>
      <div className={cn('relative flex h-28 items-end justify-between gap-3 p-3', !c.hex && 'bg-muted')} style={c.hex ? { background: c.hex, color: textOn(c.hex) } : undefined}>
        {c.hex && <FinishMark c={c} idSuffix={`preview-${c.label}`.replace(/[^a-z0-9]/gi, '')} />}
        <span className="relative text-2xl font-semibold tracking-tight">{c.code}</span>
        {withProfile && c.hex && <ProfileSection hex={c.hex} gloss={c.finish === 'Parlak'} />}
      </div>
      <figcaption className="space-y-1 p-3 text-sm">
        <p className="font-medium">{c.name}{c.finish && <span className="text-muted-foreground"> · {c.finish}{c.finishAssumed && ' (yazılmamış, varsayılan)'}</span>}</p>
        <p className="text-xs text-muted-foreground">
          {c.hex && !c.standIn && <span className="tabular-nums">Ekran rengi {c.hex}. </span>}
          {c.standIn && 'Temsili ton. '}
          {!c.hex && 'Bu renk için ekran tonu yok. '}
          {c.note && `${NOTE_TEXT[c.note]} `}
          {APPROXIMATE_NOTE}
        </p>
        {children}
      </figcaption>
    </figure>
  );
}

/**
 * A small cross-section of a hollow box profile painted in the colour, on a light card so the
 * colour reads against both the swatch and the page. Schematic: it is not a drawing of a real code.
 */
export function ProfileSection({ hex, gloss = false }: { hex: string; gloss?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 64 88" className="relative h-20 w-auto shrink-0 rounded-[4px] bg-white p-1.5 dark:bg-neutral-100">
      <rect x="4" y="4" width="56" height="80" rx="3" fill={hex} stroke="rgb(0 0 0 / 0.35)" strokeWidth="1" />
      <rect x="11" y="11" width="42" height="29" rx="1.5" fill="#fff" stroke="rgb(0 0 0 / 0.25)" strokeWidth="0.75" />
      <rect x="11" y="48" width="42" height="29" rx="1.5" fill="#fff" stroke="rgb(0 0 0 / 0.25)" strokeWidth="0.75" />
      {gloss && <rect x="6.5" y="8" width="1.6" height="72" fill="#fff" opacity="0.5" />}
    </svg>
  );
}

/**
 * The workshop view of a colour: a big swatch and the code in large type, readable on a phone
 * under workshop light. Used on job cards and job details that workers see.
 */
export function WorkshopColor({ color, size = 'md', note = true, className }: { color: ColorInput; size?: 'md' | 'lg'; note?: boolean; className?: string }) {
  const c = info(color);
  if (!c) return null;
  const px = size === 'lg' ? 88 : 52;
  return (
    <div className={cn('flex items-center gap-3', className)} aria-label={`Renk: ${c.label}`}>
      <ColorSwatch color={c} size={px} className="rounded-md" />
      <div className="min-w-0">
        <p className={cn('font-semibold leading-tight tracking-tight', size === 'lg' ? 'text-3xl' : 'text-xl')}>{c.code}</p>
        <p className="text-sm">{c.kind === 'text' ? 'Yazıldığı gibi' : c.name}{c.finish && ` · ${c.finish}`}</p>
        {note && <p className="text-[11px] text-muted-foreground">Ekran rengi yaklaşık; numuneyle teyit et.</p>}
      </div>
    </div>
  );
}
