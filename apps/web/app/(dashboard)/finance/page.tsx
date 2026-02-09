'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { canAccessFinance, UserRole } from '@/lib/auth/permissions';
import { cn, formatCurrency } from '@/lib/utils';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  FileText, 
  Users,
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  Receipt,
  Wallet,
  Calendar,
  Download,
  RefreshCw,
  ChevronRight,
  BarChart3,
  PieChart,
} from 'lucide-react';

import {
  getFinanceOverview,
} from '@/app/actions/finance.overview.actions';
import { getRecentDocuments } from '@/app/actions/finance.documents.actions';
import { listEmployees } from '@/app/actions/finance.employees.actions';
import {
  listAllPayments,
  getOrdersWithPayments,
} from '@/app/actions/finance.payments.actions';
import { Payment, OrderDocument, PAYMENT_METHOD_LABELS, DOCUMENT_TYPE_LABELS } from '@/lib/types/finance';
import { FinanceOverviewSkeleton, CardListSkeleton } from '@/components/finance/FinanceSkeletons';
import { MiniEmptyState } from '@/components/finance/EmptyStates';
import { MiniBarChart, ProgressBar, Sparkline } from '@/components/finance/MiniChart';
import { 
  formatFinanceCurrency, 
  formatCompactCurrency,
  getRelativeTimeString,
  groupPaymentsByMethod,
  getPaymentStatus,
  PAYMENT_STATUS_CONFIG,
} from '@/lib/utils/finance';

export default function FinanceOverviewPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    thisMonthPayments: 0,
    lastMonthPayments: 0,
    outstandingReceivables: 0,
    thisMonthPayroll: 0,
    employeeCount: 0,
    orderCount: 0,
  });
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<(OrderDocument & { orderNumber?: string })[]>([]);

  // Calculate payment method distribution
  const paymentMethodStats = useMemo(() => {
    return groupPaymentsByMethod(allPayments);
  }, [allPayments]);

  // Calculate sparkline data (last 7 days)
  const sparklineData = useMemo(() => {
    const last7Days: number[] = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayTotal = allPayments
        .filter(p => p.paidAt.split('T')[0] === dateStr)
        .reduce((sum, p) => sum + p.amount, 0);
      
      last7Days.push(dayTotal);
    }
    
    return last7Days;
  }, [allPayments]);

  useEffect(() => {
    if (!user) return;
    
    if (!canAccessFinance(user.role as UserRole)) {
      showToast('Finans modülüne erişim yetkiniz bulunmuyor', 'error');
      router.replace('/dashboard');
      return;
    }

    loadData();
  }, [user]);

  const loadData = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      const [overview, payments, documents, orders, employees] = await Promise.all([
        getFinanceOverview(),
        listAllPayments({ limit: 50 }),
        getRecentDocuments(5),
        getOrdersWithPayments(),
        listEmployees(),
      ]);

      setStats({
        thisMonthPayments: overview.thisMonthPayments,
        lastMonthPayments: overview.lastMonthPayments,
        outstandingReceivables: overview.outstandingReceivables,
        thisMonthPayroll: overview.thisMonthPayroll,
        employeeCount: employees.length,
        orderCount: orders.length,
      });
      setRecentPayments(payments.slice(0, 5));
      setAllPayments(payments);
      setRecentDocuments(documents);
      
      if (refresh) {
        showToast('Veriler güncellendi', 'success');
      }
    } catch (error) {
      console.error('Error loading finance data:', error);
      showToast('Veriler yüklenirken hata oluştu', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => loadData(true);

  // Calculate trend percentage
  const paymentTrend = stats.lastMonthPayments > 0 
    ? ((stats.thisMonthPayments - stats.lastMonthPayments) / stats.lastMonthPayments) * 100 
    : 0;

  const netBalance = stats.thisMonthPayments - stats.thisMonthPayroll;
  const collectionRate = stats.outstandingReceivables + stats.thisMonthPayments > 0
    ? (stats.thisMonthPayments / (stats.outstandingReceivables + stats.thisMonthPayments)) * 100
    : 0;

  if (!user || !canAccessFinance(user.role as UserRole)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500">Finans modülüne erişim yetkiniz bulunmuyor</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950/50 min-h-screen">
        <Navbar title="Finans" showSearch={false} />
        <main className="flex-1 w-full p-4 md:p-8">
          <FinanceOverviewSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950/50 min-h-screen">
      <Navbar title="Finans" showSearch={false} />
      
      <main className="flex-1 w-full p-4 md:p-8">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Finans Özeti</h1>
            <p className="text-sm text-slate-500 mt-1">
              {new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} dönemi
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={cn(isRefreshing && 'animate-spin')} />
              Yenile
            </button>
          </div>
        </div>

        {/* Stats Cards - Enhanced */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* This Month Collections */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white shadow-lg shadow-green-500/20">
                <DollarSign size={24} />
              </div>
              <div className={cn(
                'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
                paymentTrend >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              )}>
                {paymentTrend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(paymentTrend).toFixed(1)}%
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Bu Ay Tahsilat</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              {formatFinanceCurrency(stats.thisMonthPayments)}
            </p>
            <div className="flex items-center justify-between">
              <Sparkline data={sparklineData} color="#22c55e" />
              <span className="text-xs text-slate-400">Son 7 gün</span>
            </div>
          </div>

          {/* Outstanding Receivables */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                <Receipt size={24} />
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                {stats.orderCount} sipariş
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Bekleyen Alacak</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              {formatFinanceCurrency(stats.outstandingReceivables)}
            </p>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-500">Tahsilat Oranı</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{collectionRate.toFixed(0)}%</span>
              </div>
              <ProgressBar value={collectionRate} max={100} color="bg-orange-500" size="sm" />
            </div>
          </div>

          {/* Payroll */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                <Users size={24} />
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                {stats.employeeCount} personel
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Bu Ay Bordro</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              {formatFinanceCurrency(stats.thisMonthPayroll)}
            </p>
            <Link 
              href="/finance/employees"
              className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
            >
              Detayları gör <ArrowRight size={12} />
            </Link>
          </div>

          {/* Net Balance */}
          <div className={cn(
            'rounded-2xl p-6 border shadow-sm hover:shadow-md transition-shadow',
            netBalance >= 0 
              ? 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 border-blue-100 dark:border-blue-900' 
              : 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 border-red-100 dark:border-red-900'
          )}>
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg',
                netBalance >= 0 
                  ? 'bg-gradient-to-br from-blue-400 to-cyan-600 shadow-blue-500/20' 
                  : 'bg-gradient-to-br from-red-400 to-orange-600 shadow-red-500/20'
              )}>
                <Wallet size={24} />
              </div>
              <span className={cn(
                'text-xs font-medium px-2 py-1 rounded-full',
                netBalance >= 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
              )}>
                {netBalance >= 0 ? 'Pozitif' : 'Negatif'}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Net Durum</p>
            <p className={cn(
              'text-2xl font-bold mb-3',
              netBalance >= 0 ? 'text-blue-600' : 'text-red-600'
            )}>
              {netBalance >= 0 ? '+' : ''}{formatFinanceCurrency(netBalance)}
            </p>
            <p className="text-xs text-slate-500">
              Tahsilat - Bordro = Net Bakiye
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link 
            href="/finance/payments"
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Ödemeler</h3>
                  <p className="text-sm text-slate-500">Sipariş ödemelerini yönet</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          <Link 
            href="/finance/documents"
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Belgeler</h3>
                  <p className="text-sm text-slate-500">Fatura ve belgeler</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          <Link 
            href="/finance/employees"
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Personel Bordro</h3>
                  <p className="text-sm text-slate-500">Maaş ve avans takibi</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Payments */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 dark:text-white">Son Ödemeler</h2>
              <Link href="/finance/payments" className="text-sm text-blue-600 hover:underline">
                Tümünü Gör
              </Link>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600" />
                </div>
              ) : recentPayments.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Henüz ödeme kaydı yok</p>
              ) : (
                <div className="space-y-3">
                  {recentPayments.map((payment) => (
                    <div 
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                          <CreditCard size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {PAYMENT_METHOD_LABELS[payment.method]}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(payment.paidAt).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                      </div>
                      <p className="font-semibold text-green-600">
                        +{formatCurrency(payment.amount, payment.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Documents */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 dark:text-white">Son Belgeler</h2>
              <Link href="/finance/documents" className="text-sm text-blue-600 hover:underline">
                Tümünü Gör
              </Link>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600" />
                </div>
              ) : recentDocuments.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Henüz belge yok</p>
              ) : (
                <div className="space-y-3">
                  {recentDocuments.map((doc) => (
                    <a 
                      key={doc.id}
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                          <FileText size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                            {doc.fileName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {DOCUMENT_TYPE_LABELS[doc.type]} • #{doc.orderNumber?.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">
                        {new Date(doc.uploadedAt).toLocaleDateString('tr-TR')}
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
