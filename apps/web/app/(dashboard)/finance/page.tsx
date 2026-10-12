'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, FileText, RefreshCw, Wallet } from 'lucide-react';

import { EmptyState, PageHeader, StatCard } from '@/components/kit';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { canAccessFinance, type UserRole } from '@/lib/auth/permissions';
import { getOrdersWithPayments } from '@/app/actions/finance.payments.actions';
import { formatCurrency } from '@/lib/utils';
import { type OrderWithPayments } from '@/lib/types/finance';

export default function FinanceOverviewPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [currency,setCurrency]=useState('TRY');
  const [loadError,setLoadError]=useState('');
  const [orders, setOrders] = useState<OrderWithPayments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestSequence=useRef(0);

  const hasAccess = Boolean(user?.role && canAccessFinance(user.role as UserRole));

  const totals = useMemo(() => {
    const currencyOrders=orders.filter(order=>order.currency===currency);
    const totalAmount = currencyOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const paidAmount = currencyOrders.reduce((sum, order) => sum + order.paidAmount, 0);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const closedOrderCount = currencyOrders.filter((order) => order.remainingAmount <= 0).length;

    return {
      totalAmount,
      paidAmount,
      remainingAmount,
      closedOrderCount,
      orderCount: currencyOrders.length,
    };
  }, [orders,currency]);

  const load = async (silent = false) => {
    const requestId=++requestSequence.current;
    try {
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);

      const data = await getOrdersWithPayments();
      if(requestId!==requestSequence.current)return;
      setOrders(data);setLoadError('');
    } catch (error) {
      if(requestId!==requestSequence.current)return;
      console.error('Finance load error:', error);
      setLoadError('Finans verileri alınamadı. Listeyi yenileyin.');
      showToast('Finans verileri alınamadı.', 'error');
    } finally {
      if(requestId===requestSequence.current){setIsLoading(false);setIsRefreshing(false);}
    }
  };

  useEffect(() => {
    setOrders([]);setLoadError('');
    if (!hasAccess) {
      setIsLoading(false);
      return;
    }
    void load(false);
    return()=>{requestSequence.current++;};
  }, [hasAccess,user?.tenantId,user?.id]);

  if (!hasAccess) {
    return (
      <div className="rf-page">
        <EmptyState icon={Wallet} title="Finans modülüne erişim yetkiniz bulunmuyor" action={{ label: 'Genel bakışa dön', href: '/dashboard' }} />
      </div>
    );
  }

  const money = (value: number) => (isLoading || loadError ? '—' : formatCurrency(value, currency));
  const currencies = [...new Set(['TRY', ...orders.map((order) => order.currency)])];
  return (
    <div className="rf-page space-y-5">
      <PageHeader
        eyebrow="Finans"
        title="Genel bakış"
        hint="Sipariş tutarları ve kayıtlı tahsilatlar. Farklı para birimleri birbiriyle toplanmaz; özet seçilen para biriminde gösterilir."
        action={<>
          <button type="button" className="rf-secondary-button inline-flex h-9 items-center gap-1.5 px-3 text-sm" onClick={() => void load(true)} disabled={isRefreshing} aria-label="Verileri yenile">
            <RefreshCw size={14} aria-hidden className={isRefreshing ? 'animate-spin' : undefined} /><span className="hidden sm:inline">Yenile</span>
          </button>
          <Link href="/finance/receivables" className="rf-secondary-button inline-flex h-9 items-center gap-1.5 px-3 text-sm"><Wallet size={14} aria-hidden />Alacaklar</Link>
          <Link href="/finance/invoices" className="rf-primary-button inline-flex h-9 items-center gap-1.5 px-3 text-sm"><FileText size={14} aria-hidden />Faturalar</Link>
        </>}
      />
      {loadError && <p role="alert" className="rf-panel text-sm text-rose-700 dark:text-rose-300">{loadError}</p>}
      {currencies.length > 1 && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Para birimi
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="rf-input h-9 w-auto pr-8">{currencies.map((value) => <option key={value}>{value}</option>)}</select>
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Toplam sipariş tutarı" value={money(totals.totalAmount)} loading={isLoading} />
        <StatCard label="Tahsil edilen" value={money(totals.paidAmount)} tone="success" loading={isLoading} href="/finance/payments" />
        <StatCard label="Kalan bakiye" value={money(totals.remainingAmount)} tone={totals.remainingAmount > 0 ? 'warning' : 'neutral'} loading={isLoading} href="/finance/receivables" />
        <StatCard label="Tahsilatı tamamlanan sipariş" value={isLoading || loadError ? '—' : `${totals.closedOrderCount} / ${totals.orderCount}`} loading={isLoading} />
      </div>
      <section className="rf-panel">
        <h2 className="rf-section-title mb-3">Kısayollar</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[['/finance/payments', 'Ödeme hareketleri'], ['/finance/documents', 'Belge arşivi'], ['/finance/employees', 'Personel maliyetleri']].map(([href, label]) => (
            <Link key={href} href={href} className="group flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-accent">
              {label}<ArrowRight size={14} aria-hidden className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
