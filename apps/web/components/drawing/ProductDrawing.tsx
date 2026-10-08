import { colorInfo } from '@/lib/features/colors/color-spec';

type Props = {
  family: string;
  widthMm?: number | null;
  projectionMm?: number | null;
  heightMm?: number | null;
  color?: string | null;
  className?: string;
  /** Smaller labels for thumbnails (factory cards). */
  compact?: boolean;
};

const mmText = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} mm`;
const ok = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** A horizontal or vertical dimension line with ticks and the size written on it. */
function Dim({ x1, y1, x2, y2, label, font, side = -1 }: { x1: number; y1: number; x2: number; y2: number; label: string; font: number; side?: number }) {
  const vertical = x1 === x2;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const t = 4;
  return (
    <g className="text-muted-foreground" stroke="currentColor" strokeWidth={1}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical
        ? <><line x1={x1 - t} y1={y1} x2={x1 + t} y2={y1} /><line x1={x2 - t} y1={y2} x2={x2 + t} y2={y2} /></>
        : <><line x1={x1} y1={y1 - t} x2={x1} y2={y1 + t} /><line x1={x2} y1={y2 - t} x2={x2} y2={y2 + t} /></>}
      {/* Vertical sizes are written along the line, so they never run off the drawing. */}
      <text x={vertical ? mx + side * 8 : mx} y={vertical ? my : my + side * 6} fontSize={font} fill="hsl(var(--foreground))" stroke="none" fontWeight={600}
        textAnchor="middle" dominantBaseline={vertical ? 'middle' : side < 0 ? 'auto' : 'hanging'}
        transform={vertical ? `rotate(-90 ${mx + side * 8} ${my})` : undefined}>{label}</text>
    </g>
  );
}

/**
 * Scaled drawing of the product as configured: it redraws as the measures are typed and the frame
 * takes the chosen colour. Pergola: front view (width × height) and plan view (width × projection)
 * at one scale. Guillotine glass: front view with its panes. Schematic, not a shop drawing.
 */
export function ProductDrawing({ family, widthMm, projectionMm, heightMm, color, className, compact = false }: Props) {
  const c = colorInfo(color);
  const fill = c?.hex ?? '#9aa1a9';
  const W = 520, font = compact ? 16 : 12;
  const w = ok(widthMm) ? widthMm : null, p = ok(projectionMm) ? projectionMm : null, h = ok(heightMm) ? heightMm : null;
  const label = `${family === 'giyotin' ? 'Giyotin cam' : 'Pergola'} çizimi${w ? `, en ${mmText(w)}` : ''}${p ? `, açılım ${mmText(p)}` : ''}${h ? `, yükseklik ${mmText(h)}` : ''}${c ? `, renk ${c.label}` : ''}`;

  if (!w || !h) {
    return (
      <svg viewBox={`0 0 ${W} 200`} className={className} role="img" aria-label="Ölçü girildikçe çizim belirir">
        <rect x={60} y={40} width={400} height={120} rx={4} fill="none" stroke="hsl(var(--border))" strokeDasharray="6 6" strokeWidth={2} />
        <text x={W / 2} y={106} textAnchor="middle" fontSize={14} fill="hsl(var(--muted-foreground))">En × yükseklik</text>
      </svg>
    );
  }

  if (family === 'giyotin') {
    const scale = Math.min((W - 120) / w, 300 / h);
    const fw = w * scale, fh = h * scale, x0 = (W - fw) / 2, y0 = 30, bar = Math.max(5, 40 * scale);
    const panes = 3;
    return (
      <svg viewBox={`0 0 ${W} ${fh + 90}`} className={className} role="img" aria-label={label}>
        <rect x={x0} y={y0} width={fw} height={fh} fill={fill} stroke="rgb(0 0 0 / .35)" />
        {Array.from({ length: panes }, (_, i) => {
          const ph = (fh - bar * (panes + 1)) / panes;
          return <rect key={i} x={x0 + bar} y={y0 + bar + i * (ph + bar)} width={fw - 2 * bar} height={ph} fill="hsl(200 60% 88% / .55)" stroke="rgb(0 0 0 / .25)" />;
        })}
        <Dim x1={x0} y1={y0 + fh + 22} x2={x0 + fw} y2={y0 + fh + 22} label={mmText(w)} font={font} side={1} />
        <Dim x1={x0 - 18} y1={y0} x2={x0 - 18} y2={y0 + fh} label={mmText(h)} font={font} />
      </svg>
    );
  }

  // Pergola: front view on the left, plan view on the right, one scale for both.
  const depth = p ?? w * 0.6;
  const gap = 70;
  const scale = Math.min((W - 150 - gap) / (w * 2), 240 / Math.max(h, depth));
  const fw = w * scale, fh = h * scale, pd = depth * scale;
  const post = Math.max(5, 110 * scale), beam = Math.max(6, 200 * scale);
  const x0 = 70, y0 = 20 + Math.max(0, pd - fh);
  const x1 = x0 + fw + gap, y1 = 20 + Math.max(0, fh - pd);
  const blades = Math.max(3, Math.min(40, Math.round(depth / 200)));
  const height = Math.max(fh, pd) + 70;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className={className} role="img" aria-label={label}>
      {/* front view */}
      <line x1={x0 - 20} y1={y0 + fh} x2={x0 + fw + 20} y2={y0 + fh} stroke="hsl(var(--border))" strokeWidth={2} />
      <rect x={x0} y={y0} width={fw} height={beam} fill={fill} stroke="rgb(0 0 0 / .35)" />
      <rect x={x0} y={y0} width={post} height={fh} fill={fill} stroke="rgb(0 0 0 / .35)" />
      <rect x={x0 + fw - post} y={y0} width={post} height={fh} fill={fill} stroke="rgb(0 0 0 / .35)" />
      <Dim x1={x0} y1={y0 + fh + 22} x2={x0 + fw} y2={y0 + fh + 22} label={mmText(w)} font={font} side={1} />
      <Dim x1={x0 - 16} y1={y0} x2={x0 - 16} y2={y0 + fh} label={mmText(h)} font={font} />
      {!compact && <text x={x0 + fw / 2} y={y0 + fh / 2} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">Ön</text>}
      {/* plan view: frame and louvre blades */}
      <rect x={x1} y={y1} width={fw} height={pd} fill="none" stroke={fill} strokeWidth={Math.max(3, beam / 2)} />
      {Array.from({ length: blades }, (_, i) => {
        const y = y1 + ((i + 1) * pd) / (blades + 1);
        return <line key={i} x1={x1 + 4} y1={y} x2={x1 + fw - 4} y2={y} stroke={fill} strokeWidth={Math.max(1.5, (pd / blades) * 0.45)} strokeOpacity={0.85} />;
      })}
      <Dim x1={x1} y1={y1 + pd + 22} x2={x1 + fw} y2={y1 + pd + 22} label={mmText(w)} font={font} side={1} />
      <Dim x1={x1 + fw + 16} y1={y1} x2={x1 + fw + 16} y2={y1 + pd} label={p ? mmText(p) : 'açılım ?'} font={font} side={1} />
      {!compact && <text x={x1 + fw / 2} y={y1 - 6} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">Üst</text>}
    </svg>
  );
}
