'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Building2, Phone, Mail, TrendingUp, ShoppingBag, Upload } from 'lucide-react';
import Link from 'next/link';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { RFListView, type RFColumn, type RFFilter } from '@/components/shared/views/RFListView';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { hasPermission } from '@/lib/features/auth/permissions';
import { NewCustomerDialog } from '@/components/features/customers/NewCustomerDialog';

// ============================================
// Types
// ============================================

interface Customer {
  id: string;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  order_count: string;
  total_revenue: string;
  last_order_at: string | null;
  created_at: string;
}

// ============================================
// Page
// ============================================

export default function CRMPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const canCreate = Boolean(user && hasPermission(user.role, 'customers.create'));
  const [loadError, setLoadError] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const PAGE_SIZE = 25;

  // Latest request wins: a slow earlier search must not overwrite (or fail over) a newer one.
  const latestLoad = useRef(0);
  const loadCustomers = useCallback(async (p: number, search: string) => {
    const requestId = ++latestLoad.current;
    setIsLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(PAGE_SIZE),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/v1/customers?${params}`);
      if (!res.ok) throw new Error('Müşteriler yüklenemedi');
      const data = await res.json();
      if (requestId !== latestLoad.current) return;
      setCustomers(data.customers || []);
      setTotal(data.total || 0);
    } catch (err) {
      if (requestId !== latestLoad.current) return;
      console.error(err);
      setLoadError('Müşteri listesi yüklenemedi.');
    } finally {
      if (requestId === latestLoad.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers(page, searchQuery);
  }, [page, searchQuery, loadCustomers]);

  const columns: RFColumn<Customer>[] = useMemo(() => [
    {
      key: 'full_name',
      label: 'Müşteri',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary/30 to-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
            {row.full_name[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{row.full_name}</p>
            {row.company_name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 size={10} />
                {row.company_name}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'İletişim',
      render: (_, row) => (
        <div className="space-y-0.5">
          {row.phone && (
            <p className="text-sm text-foreground flex items-center gap-1.5">
              <Phone size={12} className="text-muted-foreground" />
              {row.phone}
            </p>
          )}
          {row.email && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Mail size={10} />
              {row.email}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'order_count',
      label: 'Sipariş',
      align: 'center',
      render: (val) => (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-bold">
          <ShoppingBag size={10} />
          {val || '0'}
        </span>
      ),
    },
    {
      key: 'total_revenue',
      label: 'Toplam Ciro',
      align: 'right',
      render: (val) => (
        <span className="text-sm font-bold text-foreground">
          {val && parseFloat(val) > 0 ? formatCurrency(parseFloat(val), 'TRY') : '—'}
        </span>
      ),
    },
    {
      key: 'last_order_at',
      label: 'Son Sipariş',
      align: 'right',
      render: (val) => val ? (
        <span className="text-xs text-muted-foreground">
          {new Date(val).toLocaleDateString('tr-TR')}
        </span>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
  ], []);

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
      <AppleNavbar title="Müşteri Yönetimi" showSearch={false} action={canCreate ? <Link href="/crm/import" className="rf-secondary-button inline-flex items-center gap-1 text-sm"><Upload size={14} aria-hidden /> Listeden içe aktar</Link> : undefined} />

      <div className="flex-1 p-4 md:p-8">
        <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><Building2 size={14} aria-hidden /><span className="font-semibold tabular-nums text-foreground">{total}</span> müşteri</p>

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
          <RFListView<Customer>
            title="Müşteri Listesi"
            subtitle="Tüm müşterileriniz ve sipariş geçmişleri"
            data={customers}
            columns={columns}
            isLoading={isLoading}
            error={loadError || undefined}
            onRetry={() => loadCustomers(page, searchQuery)}
            totalCount={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            onSearch={(q) => { setSearchQuery(q); setPage(1); }}
            onRowClick={(row) => router.push(`/crm/${row.id}`)}
            primaryAction={canCreate ? {
              label: 'Yeni Müşteri',
              icon: <Plus size={16} />,
              onClick: () => setShowNewCustomer(true),
            } : undefined}
            emptyState={{
              title: 'Henüz müşteri yok',
              description: canCreate ? 'İlk müşterinizi ekleyin; siparişler de müşteri kartına bağlanır.' : 'Müşteri kartları siparişlerle birlikte oluşur.',
              action: canCreate && !loadError ? { label: 'Müşteri Ekle', onClick: () => setShowNewCustomer(true) } : undefined,
            }}
          />
        </div>
        {canCreate && (
          <NewCustomerDialog
            open={showNewCustomer}
            onClose={() => setShowNewCustomer(false)}
            onCreated={(customer) => {
              setShowNewCustomer(false);
              if (customer) {
                // The list is sorted by revenue and may be filtered: open the new card instead.
                showToast(`${customer.full_name} kaydedildi.`, 'success');
                router.push(`/crm/${customer.id}`);
              } else {
                showToast('Müşteri kaydedildi.', 'success');
                void loadCustomers(page, searchQuery);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
