'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sun } from 'lucide-react';
import { requestJson } from '@/lib/shared/network';

type Line = { key: string; text: string; href: string; tone: 'danger' | 'warn' | 'info' };
const DOT = { danger: 'bg-rose-500', warn: 'bg-amber-500', info: 'bg-sky-500' } as const;

/** A few lines for the start of the day, by role; each opens the list behind it. */
export function MorningSummary() {
  const [data, setData] = useState<{ available: boolean; greeting: string; lines: Line[] } | null>(null);
  useEffect(() => { void requestJson<{ available: boolean; greeting: string; lines: Line[] }>('/api/v1/ai/morning').then((r) => setData(r.ok && r.data ? r.data : null)); }, []);
  if (!data?.available) return null;
  return (
    <section className="rf-panel space-y-2 p-4" aria-label="Sabah özeti">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Sun size={15} className="text-amber-500" aria-hidden /> {data.greeting}</h2>
      {data.lines.length ? (
        <ul className="space-y-1">
          {data.lines.map((l) => (
            <li key={l.key}><Link href={l.href} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent"><span className={`h-2 w-2 shrink-0 rounded-full ${DOT[l.tone]}`} aria-hidden />{l.text}</Link></li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">Bugün öne çıkan bir şey yok.</p>}
    </section>
  );
}
