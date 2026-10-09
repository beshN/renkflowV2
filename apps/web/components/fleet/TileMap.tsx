'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Scan } from 'lucide-react';
import { fitZoom, project } from '@/lib/features/fleet/engine';

export type MapMarker = { id: string; lat: number; lng: number; label: string; tone?: 'primary' | 'muted' };

const TILE = 256;
/** Tile address; set NEXT_PUBLIC_MAP_TILE_URL for a paid or self-hosted server in production (ADR 0003). */
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * A small map without a map library: OpenStreetMap tiles laid out with Web Mercator maths, the
 * route and markers drawn on top as SVG. Only the tiles in view are requested (no prefetch), and
 * the attribution is always visible, as the OSM tile policy asks.
 */
export function TileMap({ markers, route, height = 360, label }: { markers: MapMarker[]; route?: Array<{ lat: number; lng: number }>; height?: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const all = useMemo(() => [...markers, ...(route ?? [])], [markers, route]);
  const fitted = useMemo(() => fitZoom(all, width, height), [all, width, height]);
  const [zoomDelta, setZoomDelta] = useState(0);
  const zoom = Math.max(2, Math.min(18, fitted + zoomDelta));
  if (!all.length) return null;

  // Centre on the middle of everything shown.
  const px = all.map((p) => project(p.lat, p.lng, zoom));
  const cx = (Math.min(...px.map((p) => p.x)) + Math.max(...px.map((p) => p.x))) / 2;
  const cy = (Math.min(...px.map((p) => p.y)) + Math.max(...px.map((p) => p.y))) / 2;
  const left = cx - width / 2, top = cy - height / 2;
  const n = 2 ** zoom;
  const tiles: Array<{ x: number; y: number; key: string }> = [];
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++)
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++)
      if (ty >= 0 && ty < n) tiles.push({ x: tx, y: ty, key: `${zoom}/${tx}/${ty}` });
  const at = (p: { lat: number; lng: number }) => { const q = project(p.lat, p.lng, zoom); return { x: q.x - left, y: q.y - top }; };
  const path = route && route.length > 1 ? route.map((p, i) => { const q = at(p); return `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(' ') : null;

  return (
    <figure ref={box} className="relative overflow-hidden rounded-md border border-border bg-muted" style={{ height }} aria-label={label}>
      {tiles.map((t) => {
        const wrapped = ((t.x % n) + n) % n;
        return (
          <img key={t.key} alt="" draggable={false} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
            src={TILE_URL.replace('{z}', String(zoom)).replace('{x}', String(wrapped)).replace('{y}', String(t.y))}
            className="pointer-events-none absolute select-none" style={{ left: t.x * TILE - left, top: t.y * TILE - top, width: TILE, height: TILE }} />
        );
      })}
      <svg className="absolute inset-0" width={width} height={height} role="img" aria-label={label}>
        {path && <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />}
        {markers.map((m) => {
          const q = at(m);
          return (
            <g key={m.id} transform={`translate(${q.x},${q.y})`}>
              <circle r={7} fill={m.tone === 'muted' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))'} stroke="white" strokeWidth={2} />
              <text y={-12} textAnchor="middle" className="fill-foreground text-[11px] font-semibold" style={{ paintOrder: 'stroke', stroke: 'hsl(var(--background))', strokeWidth: 3 }}>{m.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button type="button" className="rf-icon-button bg-card" aria-label="Yakınlaştır" onClick={() => setZoomDelta((z) => z + 1)}><Plus size={14} /></button>
        <button type="button" className="rf-icon-button bg-card" aria-label="Uzaklaştır" onClick={() => setZoomDelta((z) => z - 1)}><Minus size={14} /></button>
        <button type="button" className="rf-icon-button bg-card" aria-label="Hepsini sığdır" onClick={() => setZoomDelta(0)}><Scan size={14} /></button>
      </div>
      <figcaption className="absolute bottom-0 right-0 bg-card/90 px-1.5 py-0.5 text-[10px] text-foreground">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener" className="underline">OpenStreetMap</a> katkıda bulunanlar
      </figcaption>
    </figure>
  );
}
