'use client';

import Link from 'next/link';
import { useState, memo } from 'react';
import { Order } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getOrderStatusInfo } from '@/lib/utils';
import { MoreHorizontal, Inbox } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';

interface RecentOrdersTableProps {
  orders: Order[];
}

function RecentOrdersTableComponent({ orders }: RecentOrdersTableProps) {
  const prefersReducedMotion = useReducedMotion();
  const { deleteOrder } = useOrders();
  const { user } = useAuth();
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const canDelete = user?.role === 'admin' || user?.role === 'owner';

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteOrder(deleteTarget.id);
      toast.success('Sipariş silindi');
    } catch {
      toast.error('Sipariş silinemedi');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (!orders || orders.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 opacity-50" />
        </div>
        <p className="font-medium">Henüz sipariş bulunmuyor</p>
        <p className="text-sm mt-1">Yeni sipariş oluşturarak başlayın.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-900 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
              <th className="text-left py-3 px-6 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Sipariş No
              </th>
              <th className="text-left py-3 px-6 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Müşteri
              </th>
              <th className="text-left py-3 px-6 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Ürün
              </th>
              <th className="text-left py-3 px-6 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Tutar
              </th>
              <th className="text-left py-3 px-6 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Durum
              </th>
              <th className="text-left py-3 px-6 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Tarih
              </th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {orders.map((order, index) => {
              const statusInfo = getOrderStatusInfo(order.status);
              
              // Refined Status Colors Professional
              let badgeClass = 'bg-neutral-100 text-neutral-600 border border-neutral-200';
              let dotClass = 'bg-neutral-400';
              
              if (order.status === 'delivered') {
                  badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-900/20';
                  dotClass = 'bg-emerald-500';
              } else if (order.status === 'in_production') {
                  badgeClass = 'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-900/20';
                  dotClass = 'bg-blue-500 animate-pulse';
              } else if (order.status === 'pending') {
                  badgeClass = 'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-900/20';
                  dotClass = 'bg-amber-500';
              }

              return (
                <motion.tr
                  key={order.id}
                  initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className="group hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors duration-200"
                >
                  <td className="py-3 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-500 font-mono text-xs font-semibold">
                          #{order.id.slice(-2)}
                      </div>
                      <div>
                          <Link
                              href={`/orders/${order.id}`}
                              className="text-sm font-medium text-neutral-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors block"
                          >
                          #{(order.orderNumber || order.id).slice(0, 8)}
                          </Link>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs text-neutral-600 dark:text-neutral-400 font-semibold border border-neutral-200 dark:border-neutral-700">
                          {order.customerName.charAt(0)}
                      </div>
                      <span className="text-sm text-neutral-700 dark:text-neutral-200">{order.customerName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-6 text-sm text-neutral-600 dark:text-neutral-400">
                    {order.productName || '-'}
                  </td>
                  <td className="py-3 px-6 text-sm font-medium text-neutral-900 dark:text-neutral-200 font-mono">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </td>
                  <td className="py-3 px-6">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
                      {statusInfo.label}
                    </div>
                  </td>
                  <td className="py-3 px-6 text-sm text-neutral-500 dark:text-neutral-500">
                    {formatDate(order.date)}
                  </td>
                  <td className="py-4 px-6 text-right relative">
                      <div className="group/menu relative inline-block">
                        <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                            <MoreHorizontal size={18} />
                        </button>
                        {/* Simple Hover Menu */}
                        <div className="absolute right-0 top-8 w-32 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 hidden group-hover/menu:block z-10 p-1">
                          <Link href={`/orders/${order.id}`} className="block w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md">
                            Görüntüle
                          </Link>
                          <Link
                            href={`/orders/${order.id}?edit=true`}
                            className="block w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md"
                          >
                            Düzenle
                          </Link>
                          {canDelete && (
                            <button
                              className="block w-full text-left px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                              onClick={() => setDeleteTarget(order)}
                            >
                              Sil
                            </button>
                          )}
                        </div>
                      </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Siparişi Sil"
        message={`${deleteTarget?.customerName ?? 'Bu müşteri'} için oluşturulan siparişi silmek istediğinize emin misiniz?`}
        confirmText="Sil"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

export const RecentOrdersTable = memo(RecentOrdersTableComponent);
