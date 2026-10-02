'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { useOrders } from '@/lib/hooks/useOrders';
import { StatusBadge } from '@/components/shared/ui/StatusStepper';

export function OrderSearch({ initialQuery }: { initialQuery: string }) {
  const { orders, isLoading } = useOrders();
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);
  const matches = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('tr-TR');
    return text ? orders.filter(order =>
      [order.orderNumber, order.productName, order.customerName, order.notes].some(value => value?.toLocaleLowerCase('tr-TR').includes(text))
    ) : [];
  }, [orders, query]);
  return <div className="min-h-screen">
    <AppleNavbar title="Sipariş arama" showSearch={false} />
    <main className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <input type="search" aria-label="Sipariş ara" placeholder="Sipariş no, ürün, müşteri veya teknik not…" value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-lg border bg-white p-3 text-sm outline-none focus:border-blue-500 dark:bg-slate-900" />
      <p role="status" className="text-sm text-slate-500">{isLoading ? 'Siparişler yükleniyor…' : query ? matches.length + ' sipariş bulundu' : 'Aramak için bir sipariş, ürün veya müşteri adı yazın.'}</p>
      {matches.map(order => <Link key={order.id} href={'/orders/' + order.id} className="rf-panel flex items-center justify-between gap-3 p-4">
        <div><p className="text-xs text-blue-600">{order.orderNumber}</p><p className="mt-1 font-medium">{order.productName}</p><p className="text-sm text-slate-500">{order.customerName}</p></div>
        <StatusBadge status={order.status} />
      </Link>)}
    </main>
  </div>;
}
