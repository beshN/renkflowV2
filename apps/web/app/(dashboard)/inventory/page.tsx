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

        <form className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3" method="GET">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="SKU veya ad ile ara"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
          />

          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
            <input type="checkbox" name="low" value="1" defaultChecked={low} />
            Sadece düşük stok
          </label>

          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
            <input type="checkbox" name="active" value="1" defaultChecked={active} />
            Sadece aktif
          </label>

          <button className="rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-3 py-2 text-sm font-medium">
            Filtrele
          </button>

          <input type="hidden" name="limit" value={String(limit)} />
          <input type="hidden" name="page" value="1" />
        </form>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60">
                  <th className="text-left text-xs font-semibold tracking-wide uppercase px-4 py-3">SKU</th>
                  <th className="text-left text-xs font-semibold tracking-wide uppercase px-4 py-3">Ad</th>
                  <th className="text-left text-xs font-semibold tracking-wide uppercase px-4 py-3">Lokasyon</th>
                  <th className="text-right text-xs font-semibold tracking-wide uppercase px-4 py-3">Güncel Stok</th>
                  <th className="text-right text-xs font-semibold tracking-wide uppercase px-4 py-3">Min Stok</th>
                  <th className="text-left text-xs font-semibold tracking-wide uppercase px-4 py-3">Durum</th>
                </tr>
              </thead>
              <tbody>
                {result.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  result.items.map((item) => {
                    const isLow = item.currentStock < item.minStock;
                    return (
                      <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-4 py-3 text-sm font-mono">{item.sku}</td>
                        <td className="px-4 py-3 text-sm">
                          <Link href={`/inventory/${item.id}`} className="font-medium text-blue-600 hover:underline">
                            {item.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.location || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">{item.currentStock} {item.unit}</td>
                        <td className="px-4 py-3 text-sm text-right">{item.minStock}</td>
                        <td className="px-4 py-3 text-sm">
                          {!item.active ? (
                            <span className="inline-flex rounded-full px-2 py-1 text-xs bg-slate-100 text-slate-600">Pasif</span>
                          ) : isLow ? (
                            <span className="inline-flex rounded-full px-2 py-1 text-xs bg-amber-100 text-amber-700">Düşük</span>
                          ) : (
                            <span className="inline-flex rounded-full px-2 py-1 text-xs bg-emerald-100 text-emerald-700">Normal</span>
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
