'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Order } from '@/lib/types';
import { formatCurrency, formatDate, getOrderStatusInfo } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { SortConfig } from '@/lib/hooks/useSort';
import { MoreVertical, FileText, ArrowUpDown, Trash2 } from 'lucide-react';

interface OrderTableProps {
  orders: Order[];
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: Order['status']) => void;
  onSort?: (key: keyof Order) => void;
  sortConfig?: SortConfig<Order>;
}

export function OrderTable({ orders, onDelete, onStatusChange, onSort, sortConfig }: OrderTableProps) {
  const router = useRouter();
  const { user } = useAuth();

  const handleStatusClick = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    if (!onStatusChange) return;

    const nextStatus: Record<Order['status'], Order['status']> = {
      'pending': 'in_production',
      'in_production': 'delivered',
      'delivered': 'pending',
    };

    onStatusChange(order.id, nextStatus[order.status]);
  };

  const renderSortIcon = (key: keyof Order) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown size={14} className="opacity-30 ml-1" />;
    }
    return <ArrowUpDown size={14} className={`ml-1 text-blue-600 ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />;
  };

  const SortableHeader = ({ label, sortKey }: { label: string; sortKey: keyof Order }) => (
    <th 
      className="text-left py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors select-none group first:rounded-tl-xl last:rounded-tr-xl border-b border-white/40 dark:border-slate-800/50"
      onClick={() => onSort?.(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {renderSortIcon(sortKey)}
      </div>
    </th>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-white/50 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
      <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
            <SortableHeader label="Sipariş No" sortKey="orderNumber" />
            <SortableHeader label="Müşteri" sortKey="customerName" />
            <SortableHeader label="Tarih" sortKey="date" />
            <SortableHeader label="Tutar" sortKey="totalAmount" />
            <SortableHeader label="Durum" sortKey="status" />
            <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-white/40 dark:border-slate-800/50">
              Belgeler
            </th>
            <th className="w-10 border-b border-white/40 dark:border-slate-800/50"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/40 dark:divide-slate-800/50">
          {orders.map((order) => {
            const statusInfo = getOrderStatusInfo(order.status);
            return (
              <tr
                key={order.id}
                className="group hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                onClick={() => router.push(`/orders/${order.id}`)}
              >
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 flex items-center justify-center text-slate-500 text-xs font-bold shadow-sm">
                        #{order.id.slice(-2)}
                    </div>
                    <Link
                        href={`/orders/${order.id}`}
                        className="font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                        #{(order.orderNumber || order.id).slice(0, 8)}
                    </Link>
                  </div>
                </td>
                <td className="py-4 px-6">
                   <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[10px] text-white font-bold shadow-sm ring-2 ring-white/50 dark:ring-slate-800/50">
                            {order.customerName.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{order.customerName}</span>
                    </div>
                </td>
                <td className="py-4 px-6 text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {formatDate(order.date)}
                </td>
                <td className="py-4 px-6 text-sm font-bold text-slate-900 dark:text-white font-display">
                  {formatCurrency(order.totalAmount, order.currency)}
                </td>
                <td className="py-4 px-6">
                  <div onClick={(e: React.MouseEvent) => handleStatusClick(e, order)} className="cursor-pointer hover:scale-105 transition-transform inline-block">
                    <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo.color.replace('text-', 'border-').replace('600', '200')}/50 ${statusInfo.bgColor} bg-opacity-20 backdrop-blur-sm shadow-sm`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusInfo.color.replace('text-', 'bg-')}`}></span>
                        {statusInfo.label}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  {order.documents && order.documents.length > 0 ? (
                    <div className="flex -space-x-2 overflow-hidden py-1">
                      {order.documents.slice(0,3).map((doc, i) => (
                        <div key={`${order.id}-doc-${i}`} className="inline-block h-7 w-7 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-50 dark:bg-slate-800 flex items-center justify-center shadow-sm" title={doc.name}>
                            <FileText size={13} className="text-slate-500" />
                        </div>
                      ))}
                      {order.documents.length > 3 && (
                          <div className="inline-block h-7 w-7 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm">
                              +{order.documents.length - 3}
                          </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium ml-2">-</span>
                  )}
                </td>
                <td className="py-4 px-6 text-right">
                  <div className="relative group/actions">
                        <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all">
                            <MoreVertical size={16} />
                        </button>
                        {/* Dropdown could go here, for now simple hover */}
                         {onDelete && user?.role === 'admin' && (
                             <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden group-hover/actions:flex bg-white/90 dark:bg-slate-800/90 shadow-xl rounded-xl border border-white/50 dark:border-slate-700 backdrop-blur-md p-1.5 z-10">
                                <button
                                    onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    onDelete(order.id);
                                    }}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Sil"
                                >
                                    <Trash2 size={16} />
                                </button>
                             </div>
                         )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      
      {orders.length === 0 && (
        <div className="p-16 text-center text-slate-500 dark:text-slate-400">
          <p className="text-lg font-medium">Gösterilecek sipariş bulunamadı</p>
          <p className="text-sm opacity-70 mt-1">Yeni sipariş oluşturarak başlayın.</p>
        </div>
      )}
    </div>
  );
}
