'use client';

import Link from 'next/link';
import { Order } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getOrderStatusInfo } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-react';

interface RecentOrdersTableProps {
  orders: Order[];
}

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  if (!orders || orders.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl">inbox</span>
        </div>
        <p className="font-medium">Henüz sipariş bulunmuyor</p>
        <p className="text-sm mt-1">Yeni sipariş oluşturarak başlayın.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Sipariş No
            </th>
            <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Müşteri
            </th>
            <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ürün
            </th>
            <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tutar
            </th>
            <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Durum
            </th>
            <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tarih
            </th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {orders.map((order) => {
            const statusInfo = getOrderStatusInfo(order.status);
            return (
              <tr
                key={order.id}
                className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
              >
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-xs font-bold">
                        #{order.id.slice(-2)}
                    </div>
                    <Link
                        href={`/orders/${order.id}`}
                        className="text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                        #{order.id.slice(0, 6)}
                    </Link>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-[10px] text-white font-bold">
                        {order.customer.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{order.customer}</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-400">
                  {order.product || '-'}
                </td>
                <td className="py-4 px-6 text-sm font-medium text-slate-900 dark:text-white font-mono">
                  {formatCurrency(order.amount, order.currency)}
                </td>
                <td className="py-4 px-6">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color.replace('text-', 'border-').replace('600', '200')} ${statusInfo.bgColor} bg-opacity-10`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusInfo.color.replace('text-', 'bg-')}`}></span>
                    {statusInfo.label}
                  </span>
                </td>
                <td className="py-4 px-6 text-sm text-slate-500 dark:text-slate-400">
                  {formatDate(order.date)}
                </td>
                <td className="py-4 px-6 text-right">
                    <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                        <MoreHorizontal size={16} />
                    </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
