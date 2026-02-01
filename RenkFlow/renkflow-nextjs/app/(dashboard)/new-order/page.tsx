'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { NewOrderForm } from '@/components/forms/NewOrderForm';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { NewOrderFormData, Document } from '@/lib/types';
import { generateId } from '@/lib/utils';

export default function NewOrderPage() {
  const router = useRouter();
  const { addOrder } = useOrders();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return null; 
  }

  const handleSubmit = async (formData: FormData) => {
    try {
      await addOrder(formData);
      
      // Show success message and redirect
      showToast('Sipariş başarıyla oluşturuldu!', 'success');
      router.push('/orders');
    } catch (error) {
      console.error('Error creating order:', error);
      showToast('Sipariş oluşturulurken bir hata oluştu', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Yeni Sipariş" showSearch={false} />
      
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8">
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <NewOrderForm onSubmit={handleSubmit} />
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">İpuçları</p>
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mt-2">Sipariş oluşturma rehberi</h3>
              <ul className="mt-4 space-y-3 text-sm text-subtle-light dark:text-subtle-dark">
                <li>• Teslim tarihi ekleyerek önceliklendirme yapın.</li>
                <li>• Teknik çizim veya sözleşme dosyalarını yükleyin.</li>
                <li>• Not alanına üretim detaylarını yazın.</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">Kontrol Listesi</h3>
              <div className="mt-4 space-y-3 text-sm text-subtle-light dark:text-subtle-dark">
                <p>✓ Müşteri bilgileri</p>
                <p>✓ Ürün adı ve miktar</p>
                <p>✓ Toplam tutar</p>
                <p>✓ Teslim tarihi</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
