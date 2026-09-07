'use client';

import { useEffect, useState } from 'react';
import { RFListView } from '@/components/shared/views/RFListView';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { Users, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/context/ToastContext';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const { showToast } = useToast();

  const [form, setForm] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    paymentTerms: 30
  });

  const loadSuppliers = () => {
    setLoading(true);
    fetch('/api/v1/suppliers')
      .then(r => r.json())
      .then(d => {
        if (d.success) setSuppliers(d.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleSave = async () => {
    if (!form.name) return showToast('Tedarikçi adı zorunludur', 'error');

    try {
      const res = await fetch('/api/v1/suppliers', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      const d = await res.json();
      if (d.success) {
        showToast('Tedarikçi eklendi', 'success');
        setIsAdding(false);
        loadSuppliers();
      } else {
        showToast(d.error || 'Hata oluştu', 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
      <AppleNavbar 
        title="Tedarikçiler" 
        showSearch={true}
        action={
          <Button variant="primary" onClick={() => setIsAdding(!isAdding)} icon={<Plus className="w-4 h-4"/>}>
            Yeni Tedarikçi
          </Button>
        }
      />
      
      <main className="flex-1 p-4 md:p-8 space-y-6">
        {isAdding && (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
            <h3 className="font-medium text-lg mb-4">Yeni Tedarikçi Ekle</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label>
                <span className="block text-sm font-medium mb-1">Tedarikçi Adı *</span>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
              <label>
                <span className="block text-sm font-medium mb-1">Yetkili Kişi</span>
                <input type="text" value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} className="w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
              <label>
                <span className="block text-sm font-medium mb-1">Telefon</span>
                <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
              <label>
                <span className="block text-sm font-medium mb-1">E-posta</span>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsAdding(false)}>İptal</Button>
              <Button variant="primary" onClick={handleSave} icon={<Save className="w-4 h-4"/>}>Kaydet</Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
          <RFListView
            data={suppliers}
            title="Tedarikçi Listesi"
            description="Tüm hammadde ve hizmet tedarikçileriniz"
            icon={<Users className="h-5 w-5 text-sky-500" />}
            isLoading={loading}
            columns={[
              { key: 'name', label: 'Tedarikçi Adı' },
              { key: 'contact_name', label: 'Yetkili' },
              { key: 'phone', label: 'Telefon' },
              { 
                key: 'payment_terms', 
                label: 'Vade',
                render: (val) => `${val} Gün`
              },
              {
                key: 'is_active',
                label: 'Durum',
                render: (val) => (
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                    val ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-rose-50 text-rose-700 ring-rose-600/20'
                  }`}>
                    {val ? 'Aktif' : 'Pasif'}
                  </span>
                )
              }
            ]}
          />
        </div>
      </main>
    </div>
  );
}
