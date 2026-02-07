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
      className="text-left py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none group"
      onClick={() => onSort?.(sortKey)}
    >
      <div className="flex items-center">
        {label}
        {renderSortIcon(sortKey)}
      </div>
    </th>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm">
      <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
            <SortableHeader label="Sipariş No" sortKey="orderNumber" />
            <SortableHeader label="Müşteri" sortKey="customerName" />
            <SortableHeader label="Tarih" sortKey="date" />
            <SortableHeader label="Tutar" sortKey="totalAmount" />
            <SortableHeader label="Durum" sortKey="status" />
            <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Belgeler
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
                className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer"
                onClick={() => router.push(`/orders/${order.id}`)}
              >
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-xs font-bold">
                        #{order.id.slice(-2)}
                    </div>
                    <Link
                        href={`/orders/${order.id}`}
                        className="font-medium text-slate-900 dark:text-white hover:text-blue-600 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        #{(order.orderNumber || order.id).slice(0, 8)}
                    </Link>
                  </div>
                </td>
                <td className="py-4 px-6">
                   <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-[10px] text-white font-bold">
                            {order.customerName.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{order.customerName}</span>
                    </div>
                </td>
                <td className="py-4 px-6 text-sm text-slate-500 dark:text-slate-400">
                  {formatDate(order.date)}
                </td>
                <td className="py-4 px-6 text-sm font-medium text-slate-900 dark:text-white font-mono">
                  {formatCurrency(order.totalAmount, order.currency)}
                </td>
                <td className="py-4 px-6">
                  <div onClick={(e) => handleStatusClick(e, order)} className="cursor-pointer hover:scale-105 transition-transform inline-block">
                    <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color.replace('text-', 'border-').replace('600', '200')} ${statusInfo.bgColor} bg-opacity-10`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusInfo.color.replace('text-', 'bg-')}`}></span>
                        {statusInfo.label}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  {order.documents && order.documents.length > 0 ? (
                    <div className="flex -space-x-2 overflow-hidden">
                      {order.documents.slice(0,3).map((doc, i) => (
                        <div key={`${order.id}-doc-${i}`} className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center" title={doc.name}>
                            <FileText size={12} className="text-slate-500" />
                        </div>
                      ))}
                      {order.documents.length > 3 && (
                          <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-medium text-slate-600">
                              +{order.documents.length - 3}
                          </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
                <td className="py-4 px-6 text-right">
                  <div className="relative group/actions">
                        <button className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                            <MoreVertical size={16} />
                        </button>
                        {/* Dropdown could go here, for now simple hover */}
                         {onDelete && user?.role === 'admin' && (
                             <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden group-hover/actions:flex bg-white dark:bg-slate-800 shadow-lg rounded-lg border border-slate-100 dark:border-slate-700 p-1">
                                <button
                                    onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(order.id);
                                    }}
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
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
        <div className="p-12 text-center text-slate-500">
          <p>Gösterilecek sipariş bulunamadı</p>
        </div>
      )}
    </div>
  );
}
