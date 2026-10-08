'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { ArrowRight, GripVertical, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { LIFECYCLE, dropPath, dropTarget, lifecycleIndex, orderHealth, type LifecycleKey } from '@/lib/features/orders/lifecycle';
import { businessDate } from '@/lib/features/orders/workspace';
import type { Order } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { HealthBadge, LifecycleStrip } from '@/components/kit';

function Card({ order, canMove, onAdvance }: { order: Order; canMove: boolean; onAdvance: (o: Order) => void }) {
  const locked = !canMove || Boolean(order.productionManaged);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: order.id, disabled: locked });
  const at = lifecycleIndex(order.status);
  const next = at >= 0 && at < LIFECYCLE.length - 1 ? LIFECYCLE[at + 1] : null;
  const canAdvance = !locked && next && dropTarget(order.status, next.key);
  return (
    <article
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn('space-y-2 rounded-md border border-border bg-card p-2.5 text-sm shadow-sm', isDragging && 'z-20 opacity-80 ring-2 ring-primary')}
    >
      <div className="flex items-start gap-1.5">
        {locked
          ? <span className="mt-0.5 text-muted-foreground" title={order.productionManaged ? 'Durum üretimden hesaplanır' : 'Yetki yok'}><Lock size={14} aria-label="Taşınamaz" /></span>
          : <button type="button" {...listeners} {...attributes} aria-label={`${order.orderNumber} taşı`} className="mt-0.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"><GripVertical size={16} /></button>}
        <Link href={'/orders/' + order.id} className="min-w-0 flex-1">
          <span className="block truncate font-mono text-xs font-semibold">{order.orderNumber}</span>
          <span className="block truncate font-medium">{order.customerName}</span>
          <span className="block truncate text-xs text-muted-foreground">{order.productName}</span>
        </Link>
      </div>
      <div className="flex items-center justify-between gap-2">
        <HealthBadge health={orderHealth(order, businessDate())} />
        {order.deliveryDate && <span className="text-[11px] tabular-nums text-muted-foreground">{formatDate(order.deliveryDate)}</span>}
      </div>
      {canAdvance && (
        <button type="button" onClick={() => onAdvance(order)} className="flex min-h-9 w-full items-center justify-center gap-1 rounded-md border border-border text-xs font-medium hover:border-primary/50 hover:text-primary">
          {next!.label} <ArrowRight size={13} aria-hidden />
        </button>
      )}
    </article>
  );
}

function Column({ step, count, children }: { step: (typeof LIFECYCLE)[number]; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: step.key });
  return (
    <section ref={setNodeRef} aria-label={step.label} className={cn('flex w-[260px] shrink-0 flex-col rounded-lg border border-border bg-muted/40 lg:w-auto lg:min-w-0 lg:flex-1', isOver && 'border-primary bg-primary/5')}>
      <h2 className="flex items-center justify-between px-3 py-2 text-sm font-semibold">{step.label}<span className="rounded-full bg-background px-2 text-xs tabular-nums">{count}</span></h2>
      <div className="flex min-h-24 flex-1 flex-col gap-2 p-2 pt-0">{children}</div>
    </section>
  );
}

/**
 * Orders as cards in the six lifecycle columns. Dragging (mouse, touch or keyboard) or the "next
 * step" button moves an order; only moves the rules allow are accepted, the screen changes at once
 * and the change is sent after the undo window. Orders whose status production computes are locked.
 */
export function OrdersBoard({ orders, canMove, onMove }: {
  orders: Order[];
  canMove: boolean;
  /** The moves to make, in order (one or more allowed transitions). */
  onMove: (order: Order, path: string[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }), useSensor(KeyboardSensor));
  const [, force] = useState(0);
  const move = (order: Order, step: LifecycleKey) => {
    if (LIFECYCLE[lifecycleIndex(order.status)]?.key === step) return;
    const path = dropPath(order.status, step);
    if (!path) {
      toast.error(`${order.orderNumber}: bu adıma doğrudan geçilemez`);
      force((n) => n + 1);
      return;
    }
    onMove(order, path);
  };
  const onDragEnd = (e: DragEndEvent) => {
    const order = orders.find((o) => o.id === e.active.id);
    if (order && e.over) move(order, e.over.id as LifecycleKey);
  };
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd} accessibility={{ screenReaderInstructions: { draggable: 'Taşımak için boşluk, sütun seçmek için oklar, bırakmak için boşluk.' } }}>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {orders.some((o) => lifecycleIndex(o.status) < 0) && (
          <section aria-label="Beklemede / iptal" className="flex w-[220px] shrink-0 flex-col rounded-lg border border-dashed border-border lg:w-[200px]">
            <h2 className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-muted-foreground">Beklemede<span className="rounded-full bg-muted px-2 text-xs tabular-nums">{orders.filter((o) => lifecycleIndex(o.status) < 0).length}</span></h2>
            <div className="flex flex-col gap-2 p-2 pt-0">
              {orders.filter((o) => lifecycleIndex(o.status) < 0).map((o) => (
                <Link key={o.id} href={'/orders/' + o.id} className="rounded-md border border-border bg-card p-2.5 text-sm">
                  <span className="block truncate font-mono text-xs font-semibold">{o.orderNumber}</span>
                  <span className="block truncate">{o.customerName}</span>
                  <LifecycleStrip status={o.status} compact />
                </Link>
              ))}
            </div>
          </section>
        )}
        {LIFECYCLE.map((step, i) => {
          const items = orders.filter((o) => lifecycleIndex(o.status) === i);
          return (
            <Column key={step.key} step={step} count={items.length}>
              {items.map((o) => (
                <Card key={o.id} order={o} canMove={canMove} onAdvance={(ord) => { const next = LIFECYCLE[i + 1]; if (next) move(ord, next.key); }} />
              ))}
            </Column>
          );
        })}
      </div>
    </DndContext>
  );
}
