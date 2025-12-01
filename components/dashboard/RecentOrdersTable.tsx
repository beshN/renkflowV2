'use client';

import Link from 'next/link';
import { Order } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getOrderStatusInfo } from '@/lib/utils';

interface RecentOrdersTableProps {
  orders: Order[];
}

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  if (!orders || orders.length === 0) {
    return (
      <div className="p-8 text-center text-subtle-light dark:text-subtle-dark">
        <p>Henüz sipariş bulunmuyor</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-light dark:border-border-dark">
            <th className="text-left p-4 text-sm font-semibold text-text-light dark:text-text-dark">
              Sipariş No
            </th>
            <th className="text-left p-4 text-sm font-semibold text-text-light dark:text-text-dark">
              Müşteri
            </th>
            <th className="text-left p-4 text-sm font-semibold text-text-light dark:text-text-dark">
              Ürün
            </th>
            <th className="text-left p-4 text-sm font-semibold text-text-light dark:text-text-dark">
              Tutar
            </th>
            <th className="text-left p-4 text-sm font-semibold text-text-light dark:text-text-dark">
              Durum
            </th>
            <th className="text-left p-4 text-sm font-semibold text-text-light dark:text-text-dark">
              Tarih
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const statusInfo = getOrderStatusInfo(order.status);
            return (
              <tr
                key={order.id}
                className="border-b border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark transition-colors"
              >
                <td className="p-4">
                  <Link
                    href={`/orders/${order.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    #{order.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="p-4 text-sm text-text-light dark:text-text-dark">
                  {order.customer}
                </td>
                <td className="p-4 text-sm text-text-light dark:text-text-dark">
                  {order.product || '-'}
                </td>
                <td className="p-4 text-sm font-medium text-text-light dark:text-text-dark">
                  {formatCurrency(order.amount, order.currency)}
                </td>
                <td className="p-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor}`}
                  >
                    {statusInfo.label}
                  </span>
                </td>
                <td className="p-4 text-sm text-subtle-light dark:text-subtle-dark">
                  {formatDate(order.date)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
