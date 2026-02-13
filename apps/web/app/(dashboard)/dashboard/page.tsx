import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import {
  getSuperDashboardActivityWidget,
  getSuperDashboardCoreData,
  getSuperDashboardInventoryWidget,
} from '@/app/actions/dashboard.actions';

function formatMoney(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

type InventoryWidgetData = Awaited<ReturnType<typeof getSuperDashboardInventoryWidget>>;
type ActivityWidgetData = Awaited<ReturnType<typeof getSuperDashboardActivityWidget>>;

function InventoryWidgetSection({ inventory }: { inventory: InventoryWidgetData }) {
  if (!inventory.authorized) {
    return (
      <section className="group relative flex flex-col p-6 rounded-2xl border border-white/50 bg-white/40 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] dark:border-white/5 dark:bg-white/5">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Envanter İzleme</h3>
        <p className="mt-2 text-sm text-slate-500">Bu widget için yetkiniz bulunmuyor.</p>
      </section>
    );
  }

  return (
    <section className="group relative flex flex-col p-6 rounded-2xl border border-white/50 bg-white/40 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] dark:border-white/5 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Envanter İzleme</h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500/80">Kritik stok listesi</p>
        </div>
        <Link
          href="/inventory?low=1&active=1"
          className="rounded-lg border border-slate-200/60 bg-white/50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-white hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Detaylar
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-slate-600 dark:text-slate-400">Düşük stok kalemi:</span>
        <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-900/20">
          {inventory.lowStockCount}
        </span>
      </div>

      <div className="space-y-3">
        {inventory.topLowStock.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Düşük stok kaydı bulunmuyor.</p>
        ) : (
          inventory.topLowStock.map((item) => (
            <div
              key={item.itemId}
              className="flex items-center justify-between rounded-xl border border-white/40 bg-white/40 px-4 py-3 shadow-sm transition-colors hover:bg-white/60 dark:border-slate-700/40 dark:bg-slate-800/40 dark:hover:bg-slate-800/60"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wide">{item.sku}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-amber-600 dark:text-amber-500">
                  {item.currentStock} <span className="text-slate-300 dark:text-slate-600 font-normal">/</span> <span className="text-slate-500">{item.minStock}</span>
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ActivityWidgetSection({ activity }: { activity: ActivityWidgetData }) {
  if (!activity.authorized) {
    return (
      <section className="group relative flex flex-col p-6 rounded-2xl border border-white/50 bg-white/40 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] dark:border-white/5 dark:bg-white/5">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Son Aktivite</h3>
        <p className="mt-2 text-sm text-slate-500">Bu widget için yetkiniz bulunmuyor.</p>
      </section>
    );
  }

  return (
    <section className="group relative flex flex-col p-6 rounded-2xl border border-white/50 bg-white/40 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] dark:border-white/5 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Son Aktivite</h3>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {activity.events.length} kayıt
        </span>
      </div>

      <div className="space-y-3">
        {activity.events.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Aktivite bulunmuyor.</p>
        ) : (
          activity.events.map((event) => (
            <div
              key={event.id}
              className="group/item flex flex-col gap-1 rounded-xl border border-white/40 bg-white/40 p-3.5 shadow-sm transition-colors hover:bg-white/60 dark:border-slate-700/40 dark:bg-slate-800/40 dark:hover:bg-slate-800/60"
            >
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{event.action}</p>
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">{event.userEmail || 'Sistem'}</span> • {new Date(event.createdAt).toLocaleString('tr-TR')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  let data, inventory, activity;
  try {
    [data, inventory, activity] = await Promise.all([
      getSuperDashboardCoreData(),
      getSuperDashboardInventoryWidget(),
      getSuperDashboardActivityWidget(),
    ]);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('Oturum açmanız gerekiyor') ||
      errorMessage.includes('AuthenticationError') ||
      errorMessage.includes('UNAUTHORIZED')
    ) {
      redirect('/auth/login');
    }

    throw error;
  }

  const totalStatus = data.orders.byStatus.pending + data.orders.byStatus.inProduction + data.orders.byStatus.delivered;
  const pendingPct = totalStatus ? Math.round((data.orders.byStatus.pending / totalStatus) * 100) : 0;
  const productionPct = totalStatus ? Math.round((data.orders.byStatus.inProduction / totalStatus) * 100) : 0;
  const deliveredPct = totalStatus ? Math.round((data.orders.byStatus.delivered / totalStatus) * 100) : 0;

  const updatedAt = new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());

  const quickLinks = [
    { href: '/orders', label: 'Siparişler', emphasis: true },
    { href: '/work-orders', label: 'İş Emirleri' },
    { href: '/inventory', label: 'Envanter' },
    { href: '/finance', label: 'Finans' },
  ];

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Navbar title="Dashboard" showSearch={false} />

      <main className="flex-1 space-y-6 p-4 pt-16 md:p-8 md:pt-8">
        <section className="rf-panel rounded-xl p-5 md:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-widest text-[color-mix(in_srgb,var(--rf-brand-700)_84%,var(--rf-text)_16%)]">
                  Operasyon Kontrol Merkezi
                </p>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
                Genel Operasyon Özeti
              </h1>
              <p className="max-w-2xl text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                Sipariş, finans, envanter ve aktivite metrikleri tek ekranda konsolide edilmiştir.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-200/60 bg-white/50 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-300">
              <div className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
              Son güncelleme: {updatedAt}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 ${
                  item.emphasis 
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:shadow-slate-900/30 dark:bg-white dark:text-slate-900 dark:shadow-white/10 dark:hover:bg-slate-100' 
                    : 'bg-white/50 text-slate-600 shadow-sm border border-white/40 ring-1 ring-slate-900/5 hover:bg-white hover:text-slate-900 hover:shadow-md hover:ring-slate-900/10 dark:bg-slate-800/40 dark:text-slate-300 dark:border-white/5 dark:ring-white/10 dark:hover:bg-slate-800/60 dark:hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <article className="group relative flex flex-col justify-between p-6 rounded-2xl border border-white/50 bg-white/40 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 dark:border-white/5 dark:bg-white/5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500/90 dark:text-slate-400">Bugün Açılan Sipariş</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">
                  {data.orders.authorized ? data.orders.createdToday.toLocaleString('tr-TR') : '-'}
                </p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-white text-blue-600 border border-white/40 shadow-sm dark:from-blue-900/20 dark:to-blue-900/5 dark:text-blue-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </div>
            </div>
            <p className="mt-4 text-[11px] font-medium text-slate-400/90 dark:text-slate-500">Günlük operasyon giriş hacmi</p>
          </article>

          <article className="group relative flex flex-col justify-between p-6 rounded-2xl border border-white/50 bg-white/40 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 dark:border-white/5 dark:bg-white/5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500/90 dark:text-slate-400">Bu Hafta Sipariş</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">
                  {data.orders.authorized ? data.orders.createdThisWeek.toLocaleString('tr-TR') : '-'}
                </p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-white text-indigo-600 border border-white/40 shadow-sm dark:from-indigo-900/20 dark:to-indigo-900/5 dark:text-indigo-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
            </div>
            <p className="mt-4 text-[11px] font-medium text-slate-400/90 dark:text-slate-500">Haftalık üretim planlama girdisi</p>
          </article>

          <article className="group relative flex flex-col justify-between p-6 rounded-2xl border border-white/50 bg-white/40 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 dark:border-white/5 dark:bg-white/5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500/90 dark:text-slate-400">Bu Ay Tahsilat</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">
                  {data.finance.authorized ? formatMoney(data.finance.paymentsCollectedThisMonth) : '-'}
                </p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-white text-emerald-600 border border-white/40 shadow-sm dark:from-emerald-900/20 dark:to-emerald-900/5 dark:text-emerald-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <p className="mt-4 text-[11px] font-medium text-slate-400/90 dark:text-slate-500">Cari dönem tahsilat performansı</p>
          </article>

          <article className="group relative flex flex-col justify-between p-6 rounded-2xl border border-white/50 bg-white/40 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 dark:border-white/5 dark:bg-white/5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500/90 dark:text-slate-400">Açık Alacak</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">
                  {data.finance.authorized ? formatMoney(data.finance.outstandingReceivables) : '-'}
                </p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-50 to-white text-amber-600 border border-white/40 shadow-sm dark:from-amber-900/20 dark:to-amber-900/5 dark:text-amber-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <p className="mt-4 text-[11px] font-medium text-slate-400/90 dark:text-slate-500">Tahsilat aksiyon öncelik listesi</p>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <article className="xl:col-span-7 group relative flex flex-col p-6 rounded-2xl border border-white/50 bg-white/40 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] dark:border-white/5 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3 mb-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Sipariş Durum Dağılımı</h3>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Toplam: {totalStatus}
              </span>
            </div>

            {!data.orders.authorized ? (
              <p className="mt-3 text-sm text-slate-500">Bu widget için yetkiniz bulunmuyor.</p>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Beklemede</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{data.orders.byStatus.pending} <span className="text-slate-400 font-normal">({pendingPct}%)</span></span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pendingPct}%`, backgroundColor: 'var(--rf-warning)' }} />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Üretimde</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{data.orders.byStatus.inProduction} <span className="text-slate-400 font-normal">({productionPct}%)</span></span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${productionPct}%`, backgroundColor: 'var(--rf-brand-600)' }} />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Teslim Edildi</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{data.orders.byStatus.delivered} <span className="text-slate-400 font-normal">({deliveredPct}%)</span></span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${deliveredPct}%`, backgroundColor: 'var(--rf-success)' }} />
                  </div>
                </div>

                {data.orders.overdueDeliveries > 0 && (
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/50 p-3 text-sm text-red-700 dark:border-red-900/20 dark:bg-red-900/10 dark:text-red-400">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="flex-1">
                      <span className="font-bold">{data.orders.overdueDeliveries}</span> siparişin teslimat tarihi geçti.
                    </div>
                  </div>
                )}
              </div>
            )}
          </article>

          <article className="xl:col-span-5 group relative flex flex-col p-6 rounded-2xl border border-white/50 bg-white/40 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] dark:border-white/5 dark:bg-white/5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-6">Finans Özeti</h3>
            {!data.finance.authorized ? (
              <p className="mt-3 text-sm text-slate-500">Bu widget için yetkiniz bulunmuyor.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-slate-50/50 p-4 dark:bg-slate-800/20">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Bu ay tahsilat</span>
                  <strong className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-display">{formatMoney(data.finance.paymentsCollectedThisMonth)}</strong>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50/50 p-4 dark:bg-slate-800/20">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Açık alacak</span>
                  <strong className="text-lg font-bold text-amber-600 dark:text-amber-400 font-display">{formatMoney(data.finance.outstandingReceivables)}</strong>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50/50 p-4 dark:bg-slate-800/20">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Bu ay bordro</span>
                  <strong className="text-lg font-bold text-slate-700 dark:text-slate-300 font-display">{formatMoney(data.finance.payrollCostThisMonth)}</strong>
                </div>
              </div>
            )}
          </article>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <InventoryWidgetSection inventory={inventory} />
          <ActivityWidgetSection activity={activity} />
        </section>
      </main>
    </div>
  );
}
