'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Check, CheckSquare, Factory, Mail, MessageSquareHeart, Phone, Ruler, Truck } from 'lucide-react';
import { toast } from 'sonner';
import type { ActivityKind } from '@/lib/features/records/types';
import { EmptyState, Skeleton } from '@/components/kit';
import { cn } from '@/lib/utils';

type Due = { id: string; kind: ActivityKind; title: string; dueOn: string; overdue: boolean; assigneeName: string | null; record: { type: string; id: string; title: string; href: string } };
const ICON: Record<ActivityKind, typeof Phone> = { call: Phone, email: Mail, measure: Ruler, delivery: Truck, production: Factory, feedback: MessageSquareHeart, todo: CheckSquare };

/** "Bugün": activities due today or late, one tap to finish. Hidden until the record platform is installed. */
export function DueActivities() {
  const [items, setItems] = useState<Due[] | null>(null);
  const [available, setAvailable] = useState(true);
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/records/activities', { cache: 'no-store' });
      const body = r.ok ? await r.json() : { available: false, items: [] };
      setAvailable(body.available !== false);
      setItems(body.items ?? []);
    } catch { setItems([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const finish = async (a: Due) => {
    setItems((list) => list?.filter((x) => x.id !== a.id) ?? null);
    const r = await fetch(`/api/v1/records/${a.record.type}/${a.record.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'activity.done', activityId: a.id, done: true }) });
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || 'Kaydedilemedi'); void load(); }
    else toast.success(`${a.title} tamamlandı`);
  };
  if (!available) return null;
  return (
    <section className="rf-panel p-4" aria-label="Aktiviteler">
      <h2 className="rf-section-title mb-3 flex items-center gap-2"><CalendarClock size={16} aria-hidden /> Aktiviteler <span className="rounded-full bg-muted px-2 text-xs tabular-nums">{items?.length ?? '·'}</span></h2>
      {!items ? <Skeleton className="h-24 w-full" /> : items.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((a) => {
            const Icon = ICON[a.kind] ?? CheckSquare;
            return (
              <li key={a.id} className={cn('flex items-center gap-2 rounded-md border p-2', a.overdue ? 'border-rose-500/50' : 'border-border')}>
                <button type="button" onClick={() => void finish(a)} aria-label={`${a.title} tamamlandı`} className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border hover:border-primary hover:text-primary"><Check size={18} /></button>
                <Icon size={16} aria-hidden className="shrink-0 text-muted-foreground" />
                <Link href={a.record.href} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.record.title}{a.overdue && <span className="font-semibold text-rose-700 dark:text-rose-300"> · gecikti</span>}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : <EmptyState title="Bugün iş yok" icon={CheckSquare} />}
    </section>
  );
}
