'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Order } from '@/lib/types';
import { formatCurrency, formatDate, getOrderStatusInfo } from '@/lib/utils';
import { Badge } from '../ui/Badge';
import { useAuth } from '@/lib/context/AuthContext';
import { SortConfig } from '@/lib/hooks/useSort';

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
      return <span className="material-symbols-outlined text-[16px] opacity-30">unfold_more</span>;
    }
    return (
      <span className="material-symbols-outlined text-[16px] text-primary">
        {sortConfig.direction === 'asc' ? 'expand_less' : 'expand_more'}
      </span>
    );
  };

  const SortableHeader = ({ label, sortKey }: { label: string; sortKey: keyof Order }) => (
    <th 
      className="p-4 font-semibold text-text-light dark:text-text-dark cursor-pointer hover:bg-background-light dark:hover:bg-background-dark transition-colors select-none"
      onClick={() => onSort?.(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {renderSortIcon(sortKey)}
      </div>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark">
      <table className="w-full">
        <thead className="border-b border-border-light dark:border-border-dark bg-background-light/50 dark:bg-background-dark/50">
          <tr className="text-left text-sm">
            <SortableHeader label="Sipariş No" sortKey="id" />
            <SortableHeader label="Müşteri" sortKey="customer" />
            <SortableHeader label="Tarih" sortKey="date" />
            <SortableHeader label="Tutar" sortKey="amount" />
            <SortableHeader label="Durum" sortKey="status" />
            <th className="p-4 font-semibold text-text-light dark:text-text-dark">
              Belgeler
            </th>
            <th className="p-4 font-semibold text-text-light dark:text-text-dark text-right">
              İşlemler
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const statusInfo = getOrderStatusInfo(order.status);
            return (
              <tr
                key={order.id}
                className="border-b border-border-light dark:border-border-dark last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/orders/${order.id}`)}
              >
                <td className="p-4">
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-medium text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    #{order.id}
                  </Link>
                </td>
                <td className="p-4 text-text-light dark:text-text-dark">
                  {order.customer}
                </td>
                <td className="p-4 text-subtle-light dark:text-subtle-dark">
                  {formatDate(order.date)}
                </td>
                <td className="p-4 text-text-light dark:text-text-dark font-medium">
                  {formatCurrency(order.amount, order.currency)}
                </td>
                <td className="p-4">
                  <div onClick={(e) => handleStatusClick(e, order)} className="cursor-pointer hover:opacity-80 transition-opacity inline-block" title="Durumu değiştirmek için tıklayın">
                    <Badge status={order.status}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                </td>
                <td className="p-4">
                  {order.documents && order.documents.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {order.documents.map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.url}
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="material-symbols-outlined text-[18px]">description</span>
                          <span className="truncate max-w-[100px]">{doc.name}</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-subtle-light dark:text-subtle-dark">-</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/orders/${order.id}`}
                      className="p-2 text-subtle-light dark:text-subtle-dark hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      onClick={(e) => e.stopPropagation()}
                      title="Detayları Gör"
                    >
                      <span className="material-symbols-outlined text-[20px]">visibility</span>
                    </Link>
                    {onDelete && user?.role === 'admin' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(order.id);
                        }}
                        className="p-2 text-subtle-light dark:text-subtle-dark hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Sil"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {orders.length === 0 && (
        <div className="p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-subtle-light dark:text-subtle-dark mb-2">
            inbox
          </span>
          <p className="text-subtle-light dark:text-subtle-dark">
            Gösterilecek sipariş bulunamadı
          </p>
        </div>
      )}
    </div>
  );
}
