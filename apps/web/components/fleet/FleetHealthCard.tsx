'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Car } from 'lucide-react';
import { StatusChip } from '@/components/kit';
import { formatPlate } from '@/lib/features/fleet/engine';

type Summary = { total: number; good: number; attention: number; critical: number; items: Array<{ id: string; plate: string; health: 'attention' | 'critical'; reasons: string[] }> };

/** Dashboard card (owner/admin): how the vehicles are, and which need attention. Hidden for others and with no vehicles. */
export function FleetHealthCard() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    let alive = true;
    void fetch('/api/v1/vehicles?view=health', { cache: 'no-store' }).then(async (r) => { if (alive && r.ok) setS(await r.json()); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  if (!s || !s.total) return null;
  return (
    <section className="rf-panel space-y-2 p-4" aria-label="Araç sağlığı">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Car size={16} aria-hidden /> Araç sağlığı</h2>
        <Link href="/vehicles" className="text-xs text-primary">Filo →</Link>
      </div>
      <p className="flex flex-wrap gap-2 text-xs">
        <StatusChip tone="success" label={`${s.good} iyi`} />
        <StatusChip tone="warning" label={`${s.attention} dikkat`} />
        <StatusChip tone="danger" label={`${s.critical} kritik`} />
      </p>
      {s.items.length > 0 && (
        <ul className="space-y-1 text-sm">
          {s.items.map((v) => <li key={v.id}><Link className="font-mono font-medium text-primary underline" href={`/vehicles/${v.id}`}>{formatPlate(v.plate)}</Link> <span className="text-xs text-muted-foreground">{v.reasons.join(' · ')}</span></li>)}
        </ul>
      )}
    </section>
  );
}
