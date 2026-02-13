import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { listInventoryItems } from '@/app/actions/inventory.actions';

interface InventoryPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function getSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const q = getSingleParam(searchParams?.q)?.trim() || '';
  const low = getSingleParam(searchParams?.low) === '1';
  const active = getSingleParam(searchParams?.active) === '1';
  const page = toPositiveInt(getSingleParam(searchParams?.page), 1);
  const limit = toPositiveInt(getSingleParam(searchParams?.limit), 20);

  let result;
  try {
    result = await listInventoryItems({
      search: q || undefined,
      lowStockOnly: low,
      activeOnly: active,
      page,
      limit,
    });
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

  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

  const makeHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (low) params.set('low', '1');
    if (active) params.set('active', '1');
    params.set('limit', String(limit));
    params.set('page', String(nextPage));
    return `/inventory?${params.toString()}`;
  };

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Envanter" showSearch={false} />

      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Stok Envanteri</h1>
            <p className="text-sm text-slate-500 mt-1">Toplam {result.total} kalem</p>
          </div>
          <Link
            href="/inventory/new"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            Yeni Stok Kalemi
          </Link>
        </div>

        <form className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-2xl border border-white/50 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] p-4" method="GET">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="SKU veya ad ile ara"
            className="rounded-xl border border-transparent bg-slate-100/50 dark:bg-slate-800/50 px-4 py-2.5 text-sm outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-500"
          />

          <label className="inline-flex items-center gap-3 rounded-xl border border-transparent bg-slate-100/50 dark:bg-slate-800/50 px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors">
            <input type="checkbox" name="low" value="1" defaultChecked={low} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20" />
            <span className="text-slate-700 dark:text-slate-200 font-medium">Sadece düşük stok</span>
          </label>

          <label className="inline-flex items-center gap-3 rounded-xl border border-transparent bg-slate-100/50 dark:bg-slate-800/50 px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors">
            <input type="checkbox" name="active" value="1" defaultChecked={active} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20" />
            <span className="text-slate-700 dark:text-slate-200 font-medium">Sadece aktif</span>
          </label>

          <button className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white px-4 py-2.5 text-sm font-semibold shadow-lg shadow-slate-900/10 transition-all transform active:scale-95">
            Filtrele
          </button>

          <input type="hidden" name="limit" value={String(limit)} />
          <input type="hidden" name="page" value="1" />
        </form>

        <div className="rounded-2xl border border-white/50 dark:border-white/5 overflow-hidden bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-b border-white/40 dark:border-slate-700/40">
                <tr>
                  <th className="text-left text-xs font-bold tracking-wider uppercase px-6 py-4 text-slate-500 dark:text-slate-400">SKU</th>
                  <th className="text-left text-xs font-bold tracking-wider uppercase px-6 py-4 text-slate-500 dark:text-slate-400">Ad</th>
                  <th className="text-left text-xs font-bold tracking-wider uppercase px-6 py-4 text-slate-500 dark:text-slate-400">Lokasyon</th>
                  <th className="text-right text-xs font-bold tracking-wider uppercase px-6 py-4 text-slate-500 dark:text-slate-400">Güncel Stok</th>
                  <th className="text-right text-xs font-bold tracking-wider uppercase px-6 py-4 text-slate-500 dark:text-slate-400">Min Stok</th>
                  <th className="text-left text-xs font-bold tracking-wider uppercase px-6 py-4 text-slate-500 dark:text-slate-400">Durum</th>
                </tr>
              </thead>
              <tbody className="bg-transparent divide-y divide-slate-100/50 dark:divide-slate-800/50">
                {result.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500 italic">
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  result.items.map((item) => {
                    const isLow = item.currentStock < item.minStock;
                    return (
                      <tr key={item.id} className="group transition-colors duration-200 hover:bg-white/60 dark:hover:bg-slate-800/40">
                        <td className="px-6 py-4 text-sm font-mono text-indigo-600 dark:text-indigo-400">{item.sku}</td>
                        <td className="px-6 py-4 text-sm">
                          <Link href={`/inventory/${item.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-indigo-600 transition-colors">
                            {item.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{item.location || '-'}</td>
                        <td className="px-6 py-4 text-sm text-right font-bold text-slate-700 dark:text-slate-200">{item.currentStock} <span className="text-slate-400 font-normal text-xs">{item.unit}</span></td>
                        <td className="px-6 py-4 text-sm text-right text-slate-500">{item.minStock}</td>
                        <td className="px-6 py-4 text-sm">
                          {!item.active ? (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Pasif</span>
                          ) : isLow ? (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-600/20">Düşük</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 ring-1 ring-emerald-600/20">Normal</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Sayfa {page} / {totalPages}</p>
          <div className="flex items-center gap-2">
            <Link
              href={makeHref(Math.max(1, page - 1))}
              aria-disabled={page <= 1}
              className={`px-3 py-1.5 rounded-lg border text-sm ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
            >
              Önceki
            </Link>
            <Link
              href={makeHref(Math.min(totalPages, page + 1))}
              aria-disabled={page >= totalPages}
              className={`px-3 py-1.5 rounded-lg border text-sm ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
            >
              Sonraki
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
