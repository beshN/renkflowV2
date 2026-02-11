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
      <section className="rf-panel rounded-3xl p-5">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Envanter</h3>
        <p className="text-sm text-slate-500 mt-2">Bu widget için yetkiniz bulunmuyor.</p>
      </section>
    );
  }

  return (
    <section className="rf-panel rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Envanter</h3>
        <Link href="/inventory?low=1&active=1" className="text-xs text-primary-600 hover:underline">Detay</Link>
      </div>

      <p className="text-sm text-slate-500 mt-1">Düşük stok kalemi: <span className="font-semibold text-amber-600">{inventory.lowStockCount}</span></p>

      <div className="mt-4 space-y-2">
        {inventory.topLowStock.length === 0 ? (
          <p className="text-sm text-slate-500">Düşük stok kaydı bulunmuyor.</p>
        ) : (
          inventory.topLowStock.map((item) => (
            <div key={item.itemId} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                <p className="text-xs text-slate-500 font-mono">{item.sku}</p>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-400">{item.currentStock} / {item.minStock}</p>
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
      <section className="rf-panel rounded-3xl p-5">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Son Aktivite</h3>
        <p className="text-sm text-slate-500 mt-2">Bu widget için yetkiniz bulunmuyor.</p>
      </section>
    );
  }

  return (
    <section className="rf-panel rounded-3xl p-5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">Son Aktivite</h3>

      <div className="mt-3 space-y-2">
        {activity.events.length === 0 ? (
          <p className="text-sm text-slate-500">Aktivite bulunmuyor.</p>
        ) : (
          activity.events.map((event) => (
            <div key={event.id} className="rounded-lg border border-slate-100 dark:border-slate-800 p-3">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{event.action}</p>
              <p className="text-xs text-slate-500 mt-1">
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
    // Handle authentication/authorization errors by redirecting to login
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('Oturum açmanız gerekiyor') ||
      errorMessage.includes('AuthenticationError') ||
      errorMessage.includes('UNAUTHORIZED')
    ) {
      redirect('/auth/login');
    }
    // Re-throw other errors to be caught by error boundary
    throw error;
  }

  const totalStatus = data.orders.byStatus.pending + data.orders.byStatus.inProduction + data.orders.byStatus.delivered;
  const pendingPct = totalStatus ? Math.round((data.orders.byStatus.pending / totalStatus) * 100) : 0;
  const productionPct = totalStatus ? Math.round((data.orders.byStatus.inProduction / totalStatus) * 100) : 0;
  const deliveredPct = totalStatus ? Math.round((data.orders.byStatus.delivered / totalStatus) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Navbar title="Dashboard" showSearch={false} />

      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Super Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Tenant-scope aggregate metrikler (45 sn cache)</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/orders" className="rounded-full border border-slate-300/90 dark:border-slate-700 px-3.5 py-2 text-sm bg-white/80 dark:bg-slate-900/70 hover:border-primary-400 hover:text-primary-700 transition-colors">Siparişler</Link>
            <Link href="/work-orders" className="rounded-full border border-slate-300/90 dark:border-slate-700 px-3.5 py-2 text-sm bg-white/80 dark:bg-slate-900/70 hover:border-primary-400 hover:text-primary-700 transition-colors">İş Emirleri</Link>
            <Link href="/inventory" className="rounded-full border border-slate-300/90 dark:border-slate-700 px-3.5 py-2 text-sm bg-white/80 dark:bg-slate-900/70 hover:border-primary-400 hover:text-primary-700 transition-colors">Envanter</Link>
            <Link href="/finance" className="rounded-full border border-slate-300/90 dark:border-slate-700 px-3.5 py-2 text-sm bg-white/80 dark:bg-slate-900/70 hover:border-primary-400 hover:text-primary-700 transition-colors">Finans</Link>
          </div>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <article className="rf-panel rounded-3xl p-4">
            <p className="text-xs uppercase text-slate-500">Bugün Açılan Sipariş</p>
            <p className="text-3xl font-bold mt-2">{data.orders.authorized ? data.orders.createdToday : '-'}</p>
          </article>

          <article className="rf-panel rounded-3xl p-4">
            <p className="text-xs uppercase text-slate-500">Bu Hafta Sipariş</p>
            <p className="text-3xl font-bold mt-2">{data.orders.authorized ? data.orders.createdThisWeek : '-'}</p>
          </article>

          <article className="rf-panel rounded-3xl p-4">
            <p className="text-xs uppercase text-slate-500">Bu Ay Tahsilat</p>
            <p className="text-2xl font-bold mt-2">{data.finance.authorized ? formatMoney(data.finance.paymentsCollectedThisMonth) : '-'}</p>
          </article>

          <article className="rf-panel rounded-3xl p-4">
            <p className="text-xs uppercase text-slate-500">Açık Alacak</p>
            <p className="text-2xl font-bold mt-2">{data.finance.authorized ? formatMoney(data.finance.outstandingReceivables) : '-'}</p>
          </article>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <article className="rf-panel rounded-3xl p-5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Sipariş Durum Dağılımı</h3>
            {!data.orders.authorized ? (
              <p className="text-sm text-slate-500 mt-2">Bu widget için yetkiniz bulunmuyor.</p>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1"><span>Beklemede</span><span>{data.orders.byStatus.pending} ({pendingPct}%)</span></div>
                  <div className="h-2 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-amber-500" style={{ width: `${pendingPct}%` }} /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1"><span>Üretimde</span><span>{data.orders.byStatus.inProduction} ({productionPct}%)</span></div>
                  <div className="h-2 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-primary-500" style={{ width: `${productionPct}%` }} /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1"><span>Teslim</span><span>{data.orders.byStatus.delivered} ({deliveredPct}%)</span></div>
                  <div className="h-2 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${deliveredPct}%` }} /></div>
                </div>
                <div className="pt-2 text-sm text-red-600">Geciken teslim: {data.orders.overdueDeliveries}</div>
              </div>
            )}
          </article>

          <article className="rf-panel rounded-3xl p-5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Finans Özeti</h3>
            {!data.finance.authorized ? (
              <p className="text-sm text-slate-500 mt-2">Bu widget için yetkiniz bulunmuyor.</p>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between"><span>Bu ay tahsilat</span><strong>{formatMoney(data.finance.paymentsCollectedThisMonth)}</strong></div>
                <div className="flex items-center justify-between"><span>Açık alacak</span><strong>{formatMoney(data.finance.outstandingReceivables)}</strong></div>
                <div className="flex items-center justify-between"><span>Bu ay bordro</span><strong>{formatMoney(data.finance.payrollCostThisMonth)}</strong></div>
              </div>
            )}
          </article>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InventoryWidgetSection inventory={inventory} />
          <ActivityWidgetSection activity={activity} />
        </section>
      </main>
    </div>
  );
}
