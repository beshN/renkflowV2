'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/context/AuthContext';
import { useGlobalSearch } from '@/lib/hooks/useGlobalSearch';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Search, Filter, ArrowUpRight, Loader2 } from 'lucide-react';

export default function SearchPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const {
    query,
    setQuery,
    results,
    isLoading: isSearching,
    filters,
    setFilters,
    page,
    setPage,
    suggestions,
  } = useGlobalSearch({ pageSize: 12 });
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  const statusOptions = [
    { value: 'pending', label: 'Beklemede' },
    { value: 'in_production', label: 'Üretimde' },
    { value: 'delivered', label: 'Teslim' },
  ];

  const toggleStatus = (status: string) => {
    const current = filters.status || [];
    if (current.includes(status)) {
      setFilters({ ...filters, status: current.filter((s) => s !== status) });
    } else {
      setFilters({ ...filters, status: [...current, status] });
    }
  };

  const totalPages = results?.totalPages || 1;

  if (isLoading || !user) return null;

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Global Arama" showSearch={false} />
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <Card spotlight className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Merkez Arama</p>
              <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Siparişlerde hızlı arama</h2>
              <p className="text-sm text-subtle-light dark:text-subtle-dark">
                Anahtar kelime, müşteri, ürün, not ve tutar filtreleriyle tarama yapın.
              </p>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {results ? (
                <span>{results.total} sonuç • {results.engine} • {results.executionTime}ms</span>
              ) : (
                <span>Hazır</span>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-6">
            <div className="relative">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/60">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Müşteri, ürün, sipariş no, not..."
                  className="flex-1 bg-transparent text-sm outline-none"
                />
                {isSearching && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
              </div>

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200/70 bg-white p-2 text-sm shadow-xl dark:border-slate-700/60 dark:bg-slate-900">
                  {suggestions.map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setQuery(item);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm dark:border-slate-700/60 dark:bg-slate-900/60">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold mb-3">
                <Filter className="w-4 h-4" /> Filtreler
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-2">Durum</p>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((status) => (
                      <button
                        key={status.value}
                        onClick={() => toggleStatus(status.value)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-semibold border',
                          filters.status?.includes(status.value)
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white/70 text-slate-600 border-slate-200 dark:bg-slate-900/60 dark:text-slate-200 dark:border-slate-700'
                        )}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="input-professional"
                  />
                  <input
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="input-professional"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Min ₺"
                    value={filters.amountMin ?? ''}
                    onChange={(e) => setFilters({ ...filters, amountMin: e.target.value ? Number(e.target.value) : undefined })}
                    className="input-professional"
                  />
                  <input
                    type="number"
                    placeholder="Max ₺"
                    value={filters.amountMax ?? ''}
                    onChange={(e) => setFilters({ ...filters, amountMax: e.target.value ? Number(e.target.value) : undefined })}
                    className="input-professional"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card spotlight className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">Arama Sonuçları</h3>
            <span className="text-xs text-slate-500">Sayfa {page} / {totalPages}</span>
          </div>

          {isSearching ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Aranıyor...
            </div>
          ) : results && results.items.length > 0 ? (
            <div className="space-y-3">
              {results.items.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm hover:border-slate-300 dark:border-slate-700/60 dark:bg-slate-900/60"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {order.customerName} • {order.productName}
                    </p>
                    <p className="text-xs text-slate-500">
                      #{order.orderNumber} • {order.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>{formatCurrency(order.totalAmount, order.currency)}</span>
                    <span>{order.deliveryDate ? formatDate(order.deliveryDate) : '-'}</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700">
              Henüz bir sonuç yok. Farklı bir anahtar kelime deneyin.
            </div>
          )}

          {results && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setPage(Math.max(page - 1, 1))}
                disabled={page === 1}
                className="text-xs font-semibold px-3 py-2 rounded-full border border-slate-200 disabled:opacity-50"
              >
                Önceki
              </button>
              <button
                onClick={() => setPage(Math.min(page + 1, totalPages))}
                disabled={page >= totalPages}
                className="text-xs font-semibold px-3 py-2 rounded-full border border-slate-200 disabled:opacity-50"
              >
                Sonraki
              </button>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
