'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RFFormView } from '@/components/shared/views/RFFormView';
import { createWorkOrder } from '@/lib/features/work-orders/client';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { FileText, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function NewWorkOrderPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Üretim',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
  });

  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth/login');
  }, [isLoading, router, user]);

  const handleSave = async () => {
    if (!form.title) {
      showToast('İş Emri başlığı zorunludur', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const wo = await createWorkOrder(form);
      showToast('İş Emri oluşturuldu', 'success');
      router.push(`/work-orders/${wo.id}`);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !user) return null;

  const content = (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">Üretim emri bilgileri</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="md:col-span-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Başlık *</span>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({...form, title: e.target.value})}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              placeholder="Örn: 200 Adet A-Profil Kesimi"
            />
          </label>
          <label className="md:col-span-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Açıklama</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm({...form, description: e.target.value})}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kategori</span>
            <select
              value={form.category}
              onChange={e => setForm({...form, category: e.target.value})}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="Üretim">Üretim</option>
              <option value="Kesim">Kesim</option>
              <option value="Paketleme">Paketleme</option>
              <option value="Bakım">Bakım</option>
            </select>
          </label>
          <label>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Öncelik</span>
            <select
              value={form.priority}
              onChange={e => setForm({...form, priority: e.target.value as any})}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="low">Düşük</option>
              <option value="medium">Orta</option>
              <option value="high">Yüksek</option>
              <option value="critical">Kritik</option>
            </select>
          </label>
        </div>
        
        <div className="flex justify-end pt-6">
          <Button variant="primary" onClick={handleSave} isLoading={isSaving} icon={<Save className="w-4 h-4"/>}>
            Emri oluştur
          </Button>
        </div>
      </section>
    </div>
  );

  return (
    <div className="rf-page space-y-5">
        <RFFormView
          title="Yeni üretim emri"
          subtitle="Üretim atölyesine yeni bir emir gönderin."
          icon={<FileText className="h-5 w-5 text-sky-500" />}
          breadcrumbs={[
            { label: 'İş emirleri', href: '/work-orders' },
            { label: 'Yeni emir' }
          ]}
          onBack={() => router.push('/work-orders')}
          tabs={[
            { id: 'details', label: 'Emir detayı', content }
          ]}
        />
    </div>
  );
}
