import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { getInventoryItem, listStockMovements } from '@/app/actions/inventory.actions';
import { AddStockMovementModal } from '@/components/features/inventory/AddStockMovementModal';

interface InventoryDetailPageProps {
  params: {
    id: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
}

function getSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function InventoryDetailPage({ params, searchParams }: InventoryDetailPageProps) {
  const page = Math.max(1, Number(getSingleParam(searchParams?.page) || 1));
  const limit = 20;

  const [item, movements] = await Promise.all([
    getInventoryItem(params.id),
    listStockMovements({ itemId: params.id, page, limit }),
  ]);

  if (!item) {
    return (
      <div className="flex-1 flex flex-col">
        <Navbar title="Envanter Detayı" showSearch={false} />
        <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8">
          <p className="text-sm text-slate-500">Envanter kalemi bulunamadı.</p>
        </main>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(movements.total / limit));

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title={`Envanter: ${item.name}`} showSearch={false} />

      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <Link href="/inventory" className="text-sm text-blue-600 hover:underline">← Envantere dön</Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{item.name}</h1>
            <p className="text-sm text-slate-500">SKU: {item.sku}</p>
          </div>
          <AddStockMovementModal itemId={item.id} />
        </div>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs uppercase text-slate-500">Güncel Stok</p>
            <p className="text-2xl font-bold mt-1">{item.currentStock} {item.unit}</p>
          </article>

          <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs uppercase text-slate-500">Minimum</p>
            <p className="text-2xl font-bold mt-1">{item.minStock}</p>
          </article>

          <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs uppercase text-slate-500">Lokasyon</p>
            <p className="text-lg font-semibold mt-1">{item.location || '-'}</p>
          </article>

          <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs uppercase text-slate-500">Durum</p>
            <p className="text-lg font-semibold mt-1">{item.active ? 'Aktif' : 'Pasif'}</p>
          </article>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
          <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-semibold">Stok Hareketleri</h2>
          </header>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60">
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wide">Tarih</th>
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wide">Tip</th>
                  <th className="text-right px-4 py-2 text-xs uppercase tracking-wide">Miktar</th>
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wide">Sipariş</th>
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wide">Not</th>
                </tr>
              </thead>
              <tbody>
                {movements.movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Hareket bulunamadı.</td>
                  </tr>
                ) : (
                  movements.movements.map((movement) => (
                    <tr key={movement.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2 text-sm">{new Date(movement.createdAt).toLocaleString('tr-TR')}</td>
                      <td className="px-4 py-2 text-sm">{movement.type}</td>
                      <td className="px-4 py-2 text-sm text-right font-semibold">{movement.quantity}</td>
                      <td className="px-4 py-2 text-sm font-mono">{movement.orderId ? movement.orderId.slice(0, 8) : '-'}</td>
                      <td className="px-4 py-2 text-sm text-slate-600">{movement.note || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <footer className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <p className="text-xs text-slate-500">Sayfa {page}/{totalPages}</p>
            <div className="flex gap-2">
              <Link
                href={`/inventory/${item.id}?page=${Math.max(1, page - 1)}`}
                className={`px-3 py-1.5 rounded-lg border text-sm ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
              >
                Önceki
              </Link>
              <Link
                href={`/inventory/${item.id}?page=${Math.min(totalPages, page + 1)}`}
                className={`px-3 py-1.5 rounded-lg border text-sm ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
              >
                Sonraki
              </Link>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
