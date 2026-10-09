'use client';

import { useState } from 'react';
import { StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';

type Version = { id: string; n: number; status: string; createdAt: string; wastePercent: number; bars: number; newBars: number; missing: number; wasteDelta: number | null };
const STATUS: Record<string, string> = { draft: 'Taslak', approved: 'Onaylı', completed: 'Kesildi', cancelled: 'İptal' };

/** The plans made for the same jobs, oldest first: did the re-plan waste less? Loaded when opened. */
export function CutPlanVersions({ planId }: { planId: string }) {
  const [rows, setRows] = useState<Version[] | null>(null);
  const [error, setError] = useState('');
  return (
    <details className="text-xs" onToggle={(e) => {
      if ((e.target as HTMLDetailsElement).open && !rows)
        void requestJson<{ versions: Version[] }>(`/api/v1/production/cut-plans/${planId}/versions`).then((r) => (r.ok && r.data ? setRows(r.data.versions) : setError(r.error || 'Alınamadı')));
    }}>
      <summary className="cursor-pointer text-muted-foreground">Plan geçmişi</summary>
      {error && <p role="alert" className="mt-1">{error}</p>}
      {rows && (
        <ol className="mt-2 space-y-1">
          {rows.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium tabular-nums">#{v.n}</span>
              <StatusChip tone={v.id === planId ? 'info' : 'muted'} label={STATUS[v.status] ?? v.status} />
              <span className="tabular-nums">fire %{v.wastePercent} · {v.bars} çubuk{v.missing ? ` · ${v.missing} eksik` : ''}</span>
              {v.wasteDelta != null && v.wasteDelta !== 0 && <span className={v.wasteDelta < 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>{v.wasteDelta > 0 ? '+' : ''}{v.wasteDelta}</span>}
              <span className="ml-auto text-muted-foreground">{new Date(v.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
