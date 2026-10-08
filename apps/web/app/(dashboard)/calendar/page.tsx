'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, CalendarDays, GripVertical } from 'lucide-react';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission } from '@/lib/auth/permissions';
import { businessDate, isOpenOrder } from '@/lib/features/orders/workspace';
import { orderHealth } from '@/lib/features/orders/lifecycle';
import type { Order } from '@/lib/types';
import { cn } from '@/lib/utils';
import { HealthBadge, LifecycleStrip, PageHeader, Skeleton, withUndo } from '@/components/kit';

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + 'T00:00:00Z');
/** Monday of the week that holds this date (UTC dates, the business date is already Istanbul's). */
const monday = (s: string) => { const d = parse(s); return iso(new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY)); };
const addDays = (s: string, n: number) => iso(new Date(parse(s).getTime() + n * DAY));
const dayName = (s: string) => new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(parse(s));

function OrderChip({ order, canMove, today }: { order: Order; canMove: boolean; today: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: order.id, disabled: !canMove });
  return (
    <div ref={setNodeRef} style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn('flex items-start gap-1 rounded-md border border-border bg-card p-1.5 text-xs shadow-sm', isDragging && 'z-20 ring-2 ring-primary')}>
      {canMove && <button type="button" {...listeners} {...attributes} aria-label={`${order.orderNumber} gününü değiştir`} className="cursor-grab touch-none text-muted-foreground"><GripVertical size={14} /></button>}
      <Link href={'/orders/' + order.id} className="min-w-0 flex-1 space-y-1">
        <span className="block truncate font-medium">{order.customerName}</span>
        <span className="flex items-center justify-between gap-1"><span className="truncate font-mono text-[10px] text-muted-foreground">{order.orderNumber}</span><HealthBadge health={orderHealth(order, today)} /></span>
        <LifecycleStrip status={order.status} compact />
      </Link>
    </div>
  );
}

function DayColumn({ day, orders, max, today, canMove }: { day: string; orders: Order[]; max: number; today: string; canMove: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  // Busier days are darker: share of the week's busiest day, shown as tint, bar and number.
  const load = max ? orders.length / max : 0;
  return (
    <section ref={setNodeRef} aria-label={`${dayName(day)}: ${orders.length} teslim`}
      className={cn('flex min-h-40 flex-col rounded-lg border border-border', day === today && 'ring-2 ring-primary/40', isOver && 'border-primary')}
      style={{ background: `hsl(var(--primary) / ${(load * 0.16).toFixed(3)})` }}>
      <header className="flex items-center justify-between gap-2 px-2 py-1.5">
        <span className={cn('text-xs font-semibold capitalize', day === today && 'text-primary')}>{dayName(day)}</span>
        <span className="text-xs font-semibold tabular-nums">{orders.length}</span>
      </header>
      <span aria-hidden className="mx-2 mb-1 block h-1 rounded bg-muted"><span className="block h-1 rounded bg-primary" style={{ width: `${load * 100}%` }} /></span>
      <div className="flex flex-1 flex-col gap-1.5 p-1.5">{orders.map((o) => <OrderChip key={o.id} order={o} canMove={canMove} today={today} />)}</div>
    </section>
  );
}

/** Delivery plan by week: drag an order to another day to move its date (undo for a few seconds). */
export default function CalendarPage() {
  const { user } = useAuth();
  const { orders, isLoading, refresh } = useOrders();
  const today = businessDate();
  const [week, setWeek] = useState(monday(today));
  const [moved, setMoved] = useState<Record<string, string>>({});
  const canMove = Boolean(user && hasPermission(user.role, 'orders.edit'));
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const shown = useMemo(() => orders.filter(isOpenOrder).map((o) => (moved[o.id] ? ({ ...o, deliveryDate: moved[o.id] } as Order) : o)), [orders, moved]);
  const byDay = Object.fromEntries(days.map((d) => [d, shown.filter((o) => o.deliveryDate === d)]));
  const max = Math.max(1, ...days.map((d) => byDay[d].length));
  const undated = shown.filter((o) => !o.deliveryDate).length;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }), useSensor(KeyboardSensor));

  const onDragEnd = (e: DragEndEvent) => {
    const order = shown.find((o) => o.id === e.active.id);
    const day = e.over?.id as string | undefined;
    if (!order || !day || day === order.deliveryDate) return;
    const forget = () => setMoved((m) => { const n = { ...m }; delete n[order.id]; return n; });
    setMoved((m) => ({ ...m, [order.id]: day }));
    withUndo({
      message: `${order.orderNumber} → ${dayName(day)}`,
      undo: forget,
      commit: async () => {
        const res = await fetch('/api/v1/orders/' + order.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deliveryDate: day }) });
        if (!res.ok) { forget(); throw new Error((await res.json().catch(() => ({}))).error || 'Termin kaydedilemedi'); }
        await refresh().catch(() => undefined);
        forget();
      },
    });
  };

  return (
    <div className="rf-page space-y-4">
      <PageHeader eyebrow="Teslim & montaj" title="Takvim" hint="Açık siparişler termin gününe göre. Gün ne kadar koyuysa o gün o kadar çok teslim var. Kartı başka güne sürükleyerek termini değiştirin."
        kpis={[{ label: 'bu hafta', value: isLoading ? '·' : days.reduce((n, d) => n + byDay[d].length, 0), icon: CalendarDays }, { label: 'terminsiz', value: isLoading ? '·' : undated, href: '/orders?view=active&sort=delivery', tone: undated ? 'warning' : 'neutral' }]}
        action={<div className="flex items-center gap-1">
          <button type="button" aria-label="Önceki hafta" onClick={() => setWeek(addDays(week, -7))} className="rf-icon-button grid h-9 w-9 place-items-center border border-border"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => setWeek(monday(today))} className="rf-secondary-button h-9 px-3 text-xs">Bugün</button>
          <button type="button" aria-label="Sonraki hafta" onClick={() => setWeek(addDays(week, 7))} className="rf-icon-button grid h-9 w-9 place-items-center border border-border"><ChevronRight size={16} /></button>
        </div>} />
      {isLoading ? <div className="grid gap-2 md:grid-cols-7">{days.map((d) => <Skeleton key={d} className="h-48" />)}</div> : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid gap-2 md:grid-cols-7">{days.map((d) => <DayColumn key={d} day={d} orders={byDay[d]} max={max} today={today} canMove={canMove} />)}</div>
        </DndContext>
      )}
    </div>
  );
}
