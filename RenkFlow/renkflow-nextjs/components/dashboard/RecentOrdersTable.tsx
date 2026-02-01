'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Order } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getOrderStatusInfo } from '@/lib/utils';
import { MoreHorizontal, Inbox } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';

interface RecentOrdersTableProps {
  orders: Order[];
}

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
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
    <div className="glass-panel overflow-hidden rounded-xl border border-slate-200/60 dark:border-slate-800/60">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/80 dark:bg-slate-800/80">
              <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Sipariş No
              </th>
              <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Müşteri
              </th>
              <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Ürün
              </th>
              <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tutar
              </th>
              <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Durum
              </th>
              <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tarih
              </th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {orders.map((order, index) => {
              const statusInfo = getOrderStatusInfo(order.status);
              
              // Refined Status Colors
              let badgeClass = 'bg-slate-100 text-slate-600 ring-slate-500/10';
              let dotClass = 'bg-slate-400';
              
              if (order.status === 'delivered') {
                  badgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-emerald-600/20';
                  dotClass = 'bg-emerald-500';
              } else if (order.status === 'in_production') {
                  badgeClass = 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 ring-blue-600/20';
                  dotClass = 'bg-blue-500 animate-pulse';
              } else if (order.status === 'pending') {
                  badgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 ring-amber-600/20';
                  dotClass = 'bg-amber-500';
              }

              return (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="group hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors duration-200"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 font-mono text-xs font-bold shadow-sm group-hover:border-blue-200 dark:group-hover:border-blue-800 transition-colors">
                          #{order.id.slice(-2)}
                      </div>
                      <div>
                          <Link
                              href={`/orders/${order.id}`}
                              className="text-sm font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors block"
                          >
                          #{(order.orderNumber || order.id).slice(0, 6)}
                          </Link>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs text-white font-bold shadow-md shadow-indigo-500/20 ring-2 ring-white dark:ring-slate-900">
                          {order.customerName.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{order.customerName}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-400 font-medium">
                    {order.productName || '-'}
                  </td>
                  <td className="py-4 px-6 text-sm font-bold text-slate-900 dark:text-white font-mono tracking-tight">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </td>
                  <td className="py-4 px-6">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
                      {statusInfo.label}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-500 dark:text-slate-400 font-medium">
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
