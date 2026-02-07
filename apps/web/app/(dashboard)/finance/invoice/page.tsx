'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { canAccessFinance, hasPermission, UserRole } from '@/lib/auth/permissions';
import { formatCurrency } from '@/lib/utils';
import { normalizeCurrencyInput } from '@/lib/utils/currency';
import { getOrdersWithPayments } from '@/app/actions/finance.payments.actions';
import { OrderWithPayments } from '@/lib/types/finance';
import { 
  ArrowLeft,
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  MoreHorizontal,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  Calendar,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Invoice types
interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  currency: string;
  notes?: string;
}

const STATUS_CONFIG: Record<Invoice['status'], { label: string; color: string; icon: typeof CheckCircle }> = {
  draft: { label: 'Taslak', color: 'bg-slate-100 text-slate-700', icon: Clock },
  sent: { label: 'Gönderildi', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  paid: { label: 'Ödendi', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  overdue: { label: 'Gecikmiş', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  cancelled: { label: 'İptal', color: 'bg-gray-100 text-gray-700', icon: AlertCircle },
};

const DEFAULT_DUE_DAYS = 30;

function toInvoiceStatus(order: OrderWithPayments, dueDate: Date): Invoice['status'] {
  if (order.remainingAmount <= 0) return 'paid';
  if (dueDate < new Date()) return 'overdue';
  if (order.status === 'pending') return 'draft';
  return 'sent';
}

function mapOrderToInvoice(order: OrderWithPayments): Invoice {
  const issueDate = order.date || new Date().toISOString();
  const dueDate = order.deliveryDate || new Date(new Date(issueDate).getTime() + (DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000)).toISOString();
  const dueDateObj = new Date(dueDate);

  return {
    id: `inv-${order.id}`,
    invoiceNumber: `FAT-${order.orderNumber}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    issueDate,
    dueDate,
    totalAmount: order.totalAmount,
    paidAmount: order.paidAmount,
    status: toInvoiceStatus(order, dueDateObj),
    currency: normalizeCurrencyInput(order.currency),
  };
}

export default function FinanceInvoicePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!user) return;
    
    if (!canAccessFinance(user.role as UserRole)) {
      showToast('Finans modülüne erişim yetkiniz bulunmuyor', 'error');
      return;
    }

    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const orders = await getOrdersWithPayments();
      setInvoices(orders.map(mapOrderToInvoice));
    } catch (error) {
      console.error('Error loading invoices:', error);
      showToast('Faturalar yüklenirken hata oluştu', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const totalAmount = invoices.reduce((sum, i) => sum + i.totalAmount, 0);
  const paidAmount = invoices.reduce((sum, i) => sum + i.paidAmount, 0);
  const outstandingAmount = totalAmount - paidAmount;
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  if (!user || !canAccessFinance(user.role as UserRole)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500">Finans modülüne erişim yetkiniz bulunmuyor</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950/50 min-h-screen">
      <Navbar 
        title="Faturalar" 
        showSearch={false}
      />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fatura Yönetimi</h1>
            <p className="text-sm text-slate-500 mt-1">
              {invoices.length} fatura • {formatCurrency(outstandingAmount)} tahsilat bekliyor
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/finance"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft size={16} />
              Geri
            </Link>
            {hasPermission(user.role as UserRole, 'finance.documents.upload') && (
              <button
                onClick={() => showToast('Yeni fatura özelliği yakında geliyor', 'info')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors"
              >
                <Plus size={16} />
                Yeni Fatura
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Toplam Fatura</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {invoices.length}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Toplam Tutar</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {formatCurrency(totalAmount)}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Tahsil Edilen</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(paidAmount)}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Gecikmiş</p>
            <p className={cn(
              'text-2xl font-bold mt-1',
              overdueCount > 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'
            )}>
              {overdueCount}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Müşteri, fatura veya sipariş no ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="draft">Taslak</option>
                <option value="sent">Gönderildi</option>
                <option value="paid">Ödendi</option>
                <option value="overdue">Gecikmiş</option>
                <option value="cancelled">İptal</option>
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-500">Faturalar yükleniyor...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Fatura bulunamadı</p>
              <p className="text-sm text-slate-400 mt-1">
                {searchQuery ? 'Arama kriterlerini değiştirmeyi deneyin' : 'Henüz fatura oluşturulmamış'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fatura No</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sipariş</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Müşteri</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tarih</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tutar</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Durum</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredInvoices.map((invoice) => {
                    const statusConfig = STATUS_CONFIG[invoice.status];
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <tr key={invoice.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-slate-400" />
                            <span className="font-medium text-slate-900 dark:text-white">{invoice.invoiceNumber}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {invoice.orderNumber}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{invoice.customerName}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {new Date(invoice.issueDate).toLocaleDateString('tr-TR')}
                            </span>
                            <span className="text-xs text-slate-400">
                              Vade: {new Date(invoice.dueDate).toLocaleDateString('tr-TR')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {formatCurrency(invoice.totalAmount, invoice.currency)}
                            </span>
                            {invoice.paidAmount > 0 && (
                              <span className="text-xs text-green-600">
                                {formatCurrency(invoice.paidAmount, invoice.currency)} tahsil edildi
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                            statusConfig.color
                          )}>
                            <StatusIcon size={12} />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/finance/invoice/print?orderId=${invoice.orderId}`}
                              className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Görüntüle ve Yazdır"
                            >
                              <Eye size={16} />
                            </Link>
                            <button
                              onClick={() => showToast('İndirme özelliği yakında geliyor', 'info')}
                              className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="İndir"
                            >
                              <Download size={16} />
                            </button>
                            <button
                              onClick={() => showToast('Diğer işlemler yakında geliyor', 'info')}
                              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                          </div>
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
