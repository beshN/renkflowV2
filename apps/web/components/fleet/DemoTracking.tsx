'use client';

import { useEffect, useMemo, useState } from 'react';
import { Navigation, Pause, Play, Square } from 'lucide-react';
import { StatusChip } from '@/components/kit';
import { demoFleetAt, DEMO_VEHICLES } from '@/lib/features/fleet/demo';
import { formatPlate } from '@/lib/features/fleet/engine';
import { TileMap } from './TileMap';

/** Seconds of demo time that pass per real second, so a route is seen moving without a long wait. */
const SPEED_UP = 30;

/**
 * Demo tracking: four made-up vehicles driving around Istanbul. Not stored, not real: it shows how
 * the live map looks once vehicles have a device. Real positions are never mixed into it.
 */
export function DemoTracking({ onClose }: { onClose: () => void }) {
  const [seconds, setSeconds] = useState(120);
  const [running, setRunning] = useState(true);
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((s) => s + SPEED_UP / 2), 500);
    return () => clearInterval(timer);
  }, [running]);

  const fleet = useMemo(() => demoFleetAt(seconds), [seconds]);
  const shown = focus ? fleet.filter((s) => s.vehicle.id === focus) : fleet;
  const route = focus ? DEMO_VEHICLES.find((v) => v.id === focus)?.route : undefined;

  return (
    <section className="space-y-3" aria-label="Demo araç takibi">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <Navigation size={16} aria-hidden />
        <span className="font-medium">Demo: örnek veri, gerçek araç değil.</span>
        <span className="text-xs">Araca cihaz bağlandığında harita böyle görünür.</span>
        <span className="ml-auto flex gap-2">
          <button type="button" className="rf-secondary-button inline-flex items-center gap-1 text-xs" onClick={() => setRunning((r) => !r)}>
            {running ? <><Pause size={12} aria-hidden /> Durdur</> : <><Play size={12} aria-hidden /> Devam</>}
          </button>
          <button type="button" className="rf-secondary-button inline-flex items-center gap-1 text-xs" onClick={onClose}><Square size={12} aria-hidden /> Demoyu kapat</button>
        </span>
      </div>
      <TileMap label="Demo araçların anlık konumu" height={380} route={route} markers={shown.map((s) => ({ id: s.vehicle.id, lat: s.lat, lng: s.lng, label: s.vehicle.label, tone: s.status === 'stopped' ? 'muted' : 'primary' }))} />
      <ul className="grid gap-2 sm:grid-cols-2" aria-label="Demo araçlar">
        {fleet.map((s) => (
          <li key={s.vehicle.id}>
            <button type="button" aria-pressed={focus === s.vehicle.id} onClick={() => setFocus(focus === s.vehicle.id ? null : s.vehicle.id)} className={`rf-panel flex w-full items-center justify-between gap-3 p-3 text-left ${focus === s.vehicle.id ? 'border-primary' : ''}`}>
              <span className="min-w-0">
                <span className="block font-mono text-sm font-semibold">{formatPlate(s.vehicle.plate)} <span className="font-sans font-normal text-muted-foreground">· {s.vehicle.label}</span></span>
                <span className="block truncate text-xs text-muted-foreground">{s.vehicle.driver} · {s.vehicle.job}</span>
                <span className="block text-xs tabular-nums">{s.distanceKm.toLocaleString('tr-TR')} km</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <StatusChip tone={s.status === 'driving' ? 'success' : 'neutral'} label={s.status === 'driving' ? 'Yolda' : 'Durdu'} />
                <span className="text-sm font-semibold tabular-nums">{s.speedKmh} km/s</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
