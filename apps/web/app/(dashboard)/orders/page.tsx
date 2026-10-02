'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrders } from '@/lib/hooks/useOrders';
import { useToast } from '@/lib/context/ToastContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { RFListView, RFColumn, RFFilter } from '@/components/shared/views/RFListView';
import { Order } from '@/lib/types';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { StatusBadge, ORDER_STATUS_STEPS } from '@/components/shared/ui/StatusStepper';

export default function OrdersPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { orders, isLoading, refresh, deleteOrder } = useOrders();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('status');
    if (status) setFilterValues({ status: status === 'new' ? 'pending' : status });
  }, []);

  const handleRefresh = async () => {
    try {
      await refresh();
      showToast('Sipariş listesi güncellendi.', 'success');
    } catch {
      showToast('Siparişler yenilenemedi.', 'error');
    }
  };

  const filteredOrders = useMemo(() => {
    let result = orders;
    
    if (searchQuery) {
      const keyword = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.orderNumber.toLowerCase().includes(keyword) ||
        o.customerName.toLowerCase().includes(keyword) ||
        o.productName?.toLowerCase().includes(keyword)
      );
    }

    if (filterValues.status) {
      result = result.filter(o => o.status === filterValues.status);
    }

    return result;
  }, [orders, searchQuery, filterValues]);

  const columns: RFColumn<Order>[] = [
    {
      key: 'orderNumber',
      label: 'Sipariş No',
      width: 'w-28',
      render: (val) => <span className="font-semibold text-foreground">#{val}</span>
    },
    {
      key: 'customerName',
      label: 'Müşteri ve Ürün',
      render: (_, row) => (
        <div>
          <p className="font-medium text-foreground">{row.customerName}</p>
          {row.productName && <p className="text-xs text-muted-foreground">{row.productName}</p>}
        </div>
      )
    },
    {
      key: 'date',
      label: 'Tarih',
      width: 'w-32',
      render: (val) => <span className="text-muted-foreground">{formatDate(val)}</span>
    },
    {
      key: 'status',
      label: 'Durum',
      width: 'w-48',
      render: (val) => <StatusBadge status={val} steps={ORDER_STATUS_STEPS} />
    },
    {
      key: 'totalAmount',
      label: 'Toplam',
      align: 'right',
      width: 'w-32',
      render: (val, row) => <span className="font-semibold">{formatCurrency(val, row.currency)}</span>
    }
  ];

  const filters: RFFilter[] = [
    {
      key: 'status',
      label: 'Durum',
      type: 'select',
      options: ORDER_STATUS_STEPS.map(s => ({ value: s.key, label: s.label }))
    }
  ];

  const handleDeleteSelected = async (selected: Order[]) => {
    if (!window.confirm(`${selected.length} siparişi silmek istediğinize emin misiniz?`)) return;
    
    try {
      for (const order of selected) {
        await deleteOrder(order.id);
      }
      showToast('Seçili siparişler silindi.', 'success');
    } catch {
      showToast('Silme işlemi sırasında hata oluştu.', 'error');
    }
  };

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 h-full bg-slate-50/50 dark:bg-slate-950/50">
      <RFListView
        title="Alüminyum siparişleri"
        subtitle="Ürün, müşteri ve termin bazında sipariş takibi"
        data={filteredOrders}
        columns={columns}
        filters={filters}
        filterValues={filterValues}
        onFilterChange={(k, v) => setFilterValues(prev => ({ ...prev, [k]: v }))}
        onSearch={setSearchQuery}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/orders/${row.id}`)}
        onRowSelect={() => {}}
        primaryAction={{
          label: 'Yeni Sipariş',
          icon: <Plus size={16} />,
          onClick: () => router.push('/new-order')
        }}
        secondaryActions={[
          {
            label: 'Yenile',
            icon: <RefreshCw size={14} />,
              requiresSelection: false,
            onClick: handleRefresh
          },
          {
            label: 'Sil',
            icon: <Trash2 size={14} className="text-rose-500" />,
            onClick: handleDeleteSelected
          }
        ]}
      />
    </div>
  );
}
