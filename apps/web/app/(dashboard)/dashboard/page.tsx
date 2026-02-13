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
      <section className="rf-panel rounded-xl p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Envanter İzleme</h3>
        <p className="mt-2 text-sm text-slate-500">Bu widget için yetkiniz bulunmuyor.</p>
      </section>
    );
  }

  return (
    <section className="rf-panel rounded-xl p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Envanter İzleme</h3>
          <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-500">Kritik stok listesi</p>
        </div>
        <Link
          href="/inventory?low=1&active=1"
          className="rounded-md border border-slate-300/80 dark:border-slate-700/80 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Detaylar
        </Link>
      </div>

      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        Düşük stok kalemi:{' '}
        <span className="font-semibold text-amber-700 dark:text-amber-400">{inventory.lowStockCount}</span>
      </p>

      <div className="mt-4 space-y-2.5">
        {inventory.topLowStock.length === 0 ? (
          <p className="text-sm text-slate-500">Düşük stok kaydı bulunmuyor.</p>
        ) : (
          inventory.topLowStock.map((item) => (
            <div
              key={item.itemId}
              className="flex items-center justify-between rounded-lg border border-slate-200/80 dark:border-slate-700/70 bg-slate-50/65 dark:bg-slate-900/40 px-3.5 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                <p className="font-mono text-xs text-slate-500">{item.sku}</p>
              </div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {item.currentStock} / {item.minStock}
              </p>
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
      <section className="rf-panel rounded-xl p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Son Aktivite</h3>
        <p className="mt-2 text-sm text-slate-500">Bu widget için yetkiniz bulunmuyor.</p>
      </section>
    );
  }

  return (
    <section className="rf-panel rounded-xl p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Son Aktivite</h3>
        <span className="rounded-md border border-slate-300/75 dark:border-slate-700/80 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          {activity.events.length} kayıt
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {activity.events.length === 0 ? (
          <p className="text-sm text-slate-500">Aktivite bulunmuyor.</p>
        ) : (
          activity.events.map((event) => (
            <div
              key={event.id}
              className="rounded-lg border border-slate-200/80 dark:border-slate-700/70 bg-slate-50/65 dark:bg-slate-900/40 p-3.5"
            >
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{event.action}</p>
              <p className="mt-1 text-xs text-slate-500">
                {event.userEmail || 'Sistem'} • {new Date(event.createdAt).toLocaleString('tr-TR')}
              </p>
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--rf-brand-700)_84%,var(--rf-text)_16%)]">
                Operasyon Kontrol Merkezi
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Genel Operasyon Özeti
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                Sipariş, finans, envanter ve aktivite metrikleri tek ekranda konsolide edilmiştir.
              </p>
            </div>

            <div className="rf-badge-brand px-3.5 py-2 text-xs">
              Son güncelleme: {updatedAt}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-sm ${item.emphasis ? 'rf-btn-brand' : 'rf-btn-subtle'}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rf-panel rounded-xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Bugün Açılan Sipariş</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {data.orders.authorized ? data.orders.createdToday.toLocaleString('tr-TR') : '-'}
            </p>
            <p className="mt-2 text-xs text-slate-500">Günlük operasyon giriş hacmi</p>
          </article>

          <article className="rf-panel rounded-xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Bu Hafta Sipariş</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {data.orders.authorized ? data.orders.createdThisWeek.toLocaleString('tr-TR') : '-'}
            </p>
            <p className="mt-2 text-xs text-slate-500">Haftalık üretim planlama girdisi</p>
          </article>

          <article className="rf-panel rounded-xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Bu Ay Tahsilat</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {data.finance.authorized ? formatMoney(data.finance.paymentsCollectedThisMonth) : '-'}
            </p>
            <p className="mt-2 text-xs text-slate-500">Cari dönem tahsilat performansı</p>
          </article>

          <article className="rf-panel rounded-xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Açık Alacak</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {data.finance.authorized ? formatMoney(data.finance.outstandingReceivables) : '-'}
            </p>
            <p className="mt-2 text-xs text-slate-500">Tahsilat aksiyon öncelik listesi</p>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <article className="rf-panel rounded-xl p-6 xl:col-span-7">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Sipariş Durum Dağılımı</h3>
              <span className="rounded-md border border-slate-300/75 dark:border-slate-700/80 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                Toplam: {totalStatus}
              </span>
            </div>

            {!data.orders.authorized ? (
              <p className="mt-3 text-sm text-slate-500">Bu widget için yetkiniz bulunmuyor.</p>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
                    <span>Beklemede</span>
                    <span className="font-medium">{data.orders.byStatus.pending} ({pendingPct}%)</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full" style={{ width: `${pendingPct}%`, backgroundColor: 'var(--rf-warning)' }} />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
                    <span>Üretimde</span>
                    <span className="font-medium">{data.orders.byStatus.inProduction} ({productionPct}%)</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full" style={{ width: `${productionPct}%`, backgroundColor: 'var(--rf-brand-600)' }} />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
                    <span>Teslim</span>
                    <span className="font-medium">{data.orders.byStatus.delivered} ({deliveredPct}%)</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full" style={{ width: `${deliveredPct}%`, backgroundColor: 'var(--rf-success)' }} />
                  </div>
                </div>

                <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--rf-danger) 40%, var(--rf-border) 60%)', color: 'var(--rf-danger)', backgroundColor: 'color-mix(in srgb, var(--rf-danger) 10%, transparent)' }}>
                  Geciken teslim: {data.orders.overdueDeliveries}
                </div>
              </div>
            )}
          </article>

          <article className="rf-panel rounded-xl p-6 xl:col-span-5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Finans Özeti</h3>
            {!data.finance.authorized ? (
              <p className="mt-3 text-sm text-slate-500">Bu widget için yetkiniz bulunmuyor.</p>
            ) : (
              <div className="mt-5 divide-y divide-slate-200/75 dark:divide-slate-700/70 text-sm">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-600 dark:text-slate-400">Bu ay tahsilat</span>
                  <strong className="text-slate-900 dark:text-slate-100">{formatMoney(data.finance.paymentsCollectedThisMonth)}</strong>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-600 dark:text-slate-400">Açık alacak</span>
                  <strong className="text-slate-900 dark:text-slate-100">{formatMoney(data.finance.outstandingReceivables)}</strong>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-600 dark:text-slate-400">Bu ay bordro</span>
                  <strong className="text-slate-900 dark:text-slate-100">{formatMoney(data.finance.payrollCostThisMonth)}</strong>
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
