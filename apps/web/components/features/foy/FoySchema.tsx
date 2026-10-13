import type { FoySystem } from '@/lib/features/foy/types';

const n = (v: number | null) => (v === null ? '—' : v.toLocaleString('tr-TR', { maximumFractionDigits: 1, useGrouping: false }));

/**
 * The bay schema as the sheet draws it: bays to scale side by side, iron and rail clear spans above
 * each bay, the overall rail width below, the projection on the right. Pure SVG, prints as is.
 */
export function FoySchema({ system, index, total }: { system: FoySystem; index: number; total: number }) {
  const bays = system.bays;
  const sum = bays.reduce((s, b) => s + (b.ironInner ?? 0), 0) || 1;
  const W = 560;
  const left = 8;
  const inner = W - 16 - 70;
  let x = left;
  return (
    <figure className="space-y-1">
      {total > 1 && <figcaption className="text-[11px] font-medium text-muted-foreground">{index + 1}. sistem</figcaption>}
      <svg viewBox={`0 0 ${W} 134`} className="h-auto w-full text-foreground" role="img" aria-label={`Bölmeler: ${bays.map((b) => n(b.ironInner)).join(', ')}; ray dıştan dışa ${n(system.railOuter)}; açılım ${n(system.projection)}`}>
        {bays.map((b, k) => {
          const w = Math.max(40, ((b.ironInner ?? sum / bays.length) / sum) * inner);
          const bx = x;
          x += w;
          return (
            <g key={k}>
              <rect x={bx} y={30} width={w} height={50} fill="hsl(var(--primary) / 0.06)" stroke="currentColor" strokeOpacity={0.35} />
              <rect x={bx - 2} y={26} width={4} height={58} fill="currentColor" opacity={0.7} />
              <text x={bx + w / 2} y={18} textAnchor="middle" fontSize={13} fontWeight={600} fill="currentColor">{n(b.ironInner)}</text>
              <text x={bx + w / 2} y={50} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>demir içten içe</text>
              <text x={bx + w / 2} y={68} textAnchor="middle" fontSize={12} fill="currentColor">{n(b.railInner)}</text>
              <text x={bx + w / 2} y={78} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.6}>ray içten içe</text>
            </g>
          );
        })}
        <rect x={x - 2} y={26} width={4} height={58} fill="currentColor" opacity={0.7} />
        <line x1={left} y1={100} x2={x} y2={100} stroke="currentColor" strokeOpacity={0.5} markerStart="url(#foy-a)" markerEnd="url(#foy-a)" />
        <text x={(left + x) / 2} y={118} textAnchor="middle" fontSize={13} fontWeight={600} fill="currentColor">{n(system.railOuter)}</text>
        <text x={(left + x) / 2} y={129} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.6}>ray dıştan dışa</text>
        <g transform={`translate(${W - 58}, 30)`}>
          <line x1={0} y1={0} x2={0} y2={50} stroke="currentColor" strokeOpacity={0.5} />
          <path d="M0 0 L40 16" stroke="currentColor" strokeOpacity={0.6} fill="none" />
          <text x={22} y={42} textAnchor="middle" fontSize={13} fontWeight={600} fill="currentColor">{n(system.projection)}</text>
          <text x={22} y={56} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.6}>açılım</text>
          {system.height !== null && <text x={22} y={70} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.6}>yükseklik {n(system.height)}</text>}
        </g>
        <defs>
          <marker id="foy-a" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L6 3 L0 6 z" fill="currentColor" opacity={0.5} />
          </marker>
        </defs>
      </svg>
    </figure>
  );
}
