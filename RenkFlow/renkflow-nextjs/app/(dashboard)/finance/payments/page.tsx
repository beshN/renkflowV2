'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { canAccessFinance, hasPermission } from '@/lib/auth/permissions';
import { formatCurrency } from '@/lib/utils';
import { 
  ArrowLeft,
  CreditCard,
  Search,
  Filter,
  ChevronRight,
} from 'lucide-react';

import { getOrdersWithPayments } from '@/app/actions/finance.payments.actions';
import { OrderWithPayments } from '@/lib/types/finance';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Beklemede', color: 'bg-yellow-100 text-yellow-700' },
  in_production: { label: 'Üretimde', color: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Teslim Edildi', color: 'bg-green-100 text-green-700' },
};

export default function FinancePaymentsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<OrderWithPayments[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!user) return;
    
    if (!canAccessFinance(user.role as any)) {
      showToast('Finans modülüne erişim yetkiniz bulunmuyor', 'error');
      return;
    }

    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await getOrdersWithPayments();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      showToast('Veriler yüklenirken hata oluştu', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const totalReceivable = orders.reduce((sum, o) => sum + o.remainingAmount, 0);
  const totalCollected = orders.reduce((sum, o) => sum + o.paidAmount, 0);

  if (!user || !canAccessFinance(user.role as any)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500">Finans modülüne erişim yetkiniz bulunmuyor</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950/50 min-h-screen">
      <Navbar title="Ödemeler" showSearch={false} />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* Breadcrumb */}
        <Link href="/finance" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors mb-6">
          <ArrowLeft size={16} />
          Finans
        </Link>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500">Toplam Tahsilat</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalCollected, 'TRY')}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500">Bekleyen Alacak</p>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(totalReceivable, 'TRY')}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500">Toplam Sipariş</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {orders.length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm mb-6">
          <div className="p-4 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Müşteri veya sipariş no ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="pending">Beklemede</option>
                <option value="in_production">Üretimde</option>
                <option value="delivered">Teslim Edildi</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <CreditCard size={48} className="mb-4 opacity-30" />
              <p>Sipariş bulunamadı</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Sipariş</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Müşteri</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Durum</th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Toplam</th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Ödenen</th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Kalan</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredOrders.map((order) => {
                    const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: 'bg-slate-100 text-slate-700' };
                    const isPaid = order.remainingAmount <= 0;
                    
                    return (
                      <tr 
                        key={order.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                            #{order.orderNumber.slice(0, 8)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-900 dark:text-white">
                            {order.customerName}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-medium text-slate-900 dark:text-white">
                            {formatCurrency(order.totalAmount, order.currency)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-medium text-green-600">
                            {formatCurrency(order.paidAmount, order.currency)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-medium ${isPaid ? 'text-green-600' : 'text-orange-600'}`}>
                            {isPaid ? 'Tamamlandı' : formatCurrency(order.remainingAmount, order.currency)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link 
                            href={`/orders/${order.id}?tab=finance`}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center text-slate-400 hover:text-blue-600"
                          >
                            <ChevronRight size={18} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
