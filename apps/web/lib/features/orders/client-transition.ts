'use client';

import type { Order } from '@/lib/types';

/** Moves an order to a new status through the guarded transition endpoint (rules, version, idempotency). */
export async function requestOrderTransition(order: Pick<Order, 'id' | 'version'>, newStatus: string, commandId = crypto.randomUUID()) {
  const res = await fetch(`/api/v1/orders/${order.id}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newStatus, version: order.version, commandId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Durum güncellenemedi');
  return data as { version: number };
}
