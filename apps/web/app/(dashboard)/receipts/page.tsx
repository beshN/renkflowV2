'use client';

import { useEffect, useState } from 'react';
import { RFListView } from '@/components/shared/views/RFListView';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { PackageCheck, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function GoodsReceiptsPage() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadReceipts = () => {
    setLoading(true);
    fetch('/api/v1/goods-receipts')
      .then(r => r.json())
      .then(d => {
        if (d.success) setReceipts(d.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReceipts();
  }, []);

  const statusMap: Record<string, string> = {
    'draft': 'Taslak',
    'submitted': 'Onaylandı (Stoklara Eklendi)',
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
      <AppleNavbar 
        title="Mal Kabul Fişleri" 
        showSearch={true}
        action={
          <Button variant="primary" icon={<Plus className="w-4 h-4"/>}>
            Yeni Mal Kabul
          </Button>
        }
      />
      
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
          <RFListView
            data={receipts}
            title="Mal Kabul Listesi (GR)"
            description="Satın alma siparişlerinden teslim alınan malzemeler"
            icon={<PackageCheck className="h-5 w-5 text-emerald-500" />}
            isLoading={loading}
            columns={[
              { key: 'receipt_number', label: 'Fiş No' },
              { key: 'purchase_order_number', label: 'İlgili PO' },
              { key: 'supplier_name', label: 'Tedarikçi' },
              { 
                key: 'status', 
                label: 'Durum',
                render: (val) => (
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                    val === 'submitted' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-slate-50 text-slate-700 ring-slate-600/20'
                  }`}>
                    {statusMap[val] || val}
                  </span>
                )
              },
              {
                key: 'lines',
                label: 'Kabul Edilen Kalemler',
                render: (val: any[]) => {
                  if (!val || val.length === 0) return '-';
                  return (
                    <div className="text-xs space-y-1">
                      {val.map((l: any, i: number) => (
                        <div key={i}>
                          <span className="font-semibold">{l.item_name}</span> 
                          <span className="ml-1 text-emerald-600">({l.accepted_qty} {l.uom})</span>
                          {l.rejected_qty > 0 && <span className="ml-1 text-rose-500">({l.rejected_qty} Red)</span>}
                        </div>
                      ))}
                    </div>
                  );
                }
              },
              { key: 'received_by_name', label: 'Teslim Alan' },
              {
                key: 'created_at',
                label: 'Tarih',
                render: (val) => new Date(val).toLocaleString('tr-TR')
              }
            ]}
          />
        </div>
      </main>
    </div>
  );
}
