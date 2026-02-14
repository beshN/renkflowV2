'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Navbar } from '@/components/layout/Navbar';
import { NewOrderForm } from '@/components/forms/NewOrderForm';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { requestJson } from '@/lib/shared/network';

async function createOrderViaApi(payload: FormData): Promise<{ ok: boolean; status: number; message?: string }> {
  const result = await requestJson('/api/v1/orders', {
    method: 'POST',
    body: payload,
  }, {
    timeoutMs: 25000,
    fallbackError: 'Siparis kaydi su anda tamamlanamadi.',
  });

  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      message: result.error || 'Siparis kaydi olusturulamadi.',
    };
  }

  const payloadBody = result.data as { success?: boolean; error?: string; message?: string } | null;
  if (payloadBody?.success === false) {
    return {
      ok: false,
      status: result.status,
      message: payloadBody.error || payloadBody.message || 'Siparis kaydi olusturulamadi.',
    };
  }

  return { ok: true, status: result.status };
}

export default function NewOrderPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth/login');
    }
  }, [isLoading, router, user]);

  if (isLoading || !user) return null;

  const handleSubmit = async (formData: FormData) => {
    const result = await createOrderViaApi(formData);
    if (!result.ok) {
      if (result.status === 401) {
        router.push('/auth/login');
        return;
      }
      showToast(result.message || 'Siparis kaydedilirken hata olustu.', 'error');
      return;
    }

    showToast('Sipariş kaydı tamamlandı.', 'success');
    router.push('/orders');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
      <Navbar title="Yeni Sipariş Girişi" showSearch={false} />

      <main className="w-full flex-1 p-4 md:p-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <NewOrderForm onSubmit={handleSubmit} />

          <aside className="space-y-6">
            <section className="rf-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Standart İş Akışı</h2>
              <ol className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>1. Müşteri profilini doğrula.</li>
                <li>2. Ürün ve fiyat bilgisini netleştir.</li>
                <li>3. Gerekli teknik belgeleri ekle.</li>
                <li>4. Siparişi kaydet ve operasyona aktar.</li>
              </ol>
            </section>

            <section className="rf-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Kalite Notu</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Form doğrulamaları API sözleşmesiyle uyumlu çalışır. Bir sonraki adımda müşteri geçmişi ve fiyat önerisi bu akışa otomatik bağlanacaktır.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
