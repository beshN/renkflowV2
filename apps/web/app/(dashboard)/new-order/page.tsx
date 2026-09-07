'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Navbar } from '@/components/layout/Navbar';
import { NewOrderForm } from '@/components/forms/NewOrderForm';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { requestJson } from '@/lib/shared/network';
import { NewOrderFormData } from '@/lib/types';
import { Loader2 } from 'lucide-react';

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

  const [aiFormData, setAiFormData] = useState<NewOrderFormData | undefined>();
  const [isExtracting, setIsExtracting] = useState(false);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setIsExtracting(true);
      showToast('Belge analiz ediliyor...', 'info');
      
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const [meta, base64] = result.split(',');
          const mimeType = meta.split(':')[1].split(';')[0];
          
          const res = await fetch('/api/ai/document-extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentBase64: base64, mimeType })
          });
          
          const resData = await res.json();
          if (!res.ok || !resData.success) {
            throw new Error(resData.error || 'Analiz basarisiz');
          }
          
          const extracted = resData.data;
          
          const parsedData: NewOrderFormData = {
            customerName: extracted.müşteri || extracted.customer || extracted.Müşteri || extracted.Customer || '',
            productName: extracted.ürün || extracted.product || extracted.Ürün || extracted.Product || 'Belirtilmemiş Ürün',
            quantity: parseInt(extracted.adet || extracted.quantity || extracted.Adet) || 1,
            totalAmount: parseFloat(String(extracted.tutar || extracted.fiyat || extracted.total || extracted.Tutar || 0).replace(',', '.')) || 0,
            currency: 'TRY',
            notes: `--- AI Çıkarımı ---\nÖlçüler: ${extracted.ölçüler || extracted.ölçü || '-'}\nRenk: ${extracted.renk || '-'}\nMotor: ${extracted.motor || '-'}\nLED: ${extracted.led || '-'}\nKumaş: ${extracted.kumaş || '-'}\nDiğer: ${extracted.notlar || '-'}`,
          };
          
          setAiFormData(parsedData);
          showToast('Analiz tamamlandı, form otomatik dolduruldu.', 'success');
        } catch (err: any) {
          showToast(err.message || 'Analiz tamamlanamadı.', 'error');
        } finally {
          setIsExtracting(false);
          e.target.value = ''; // Reset input
        }
      };
      reader.onerror = () => {
        showToast('Dosya okunamadı', 'error');
        setIsExtracting(false);
        e.target.value = '';
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      showToast(err.message || 'Belge analizi başarısız', 'error');
      setIsExtracting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
      <Navbar title="Yeni Sipariş Girişi" showSearch={false} />

      <main className="w-full flex-1 p-4 md:p-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <NewOrderForm onSubmit={handleSubmit} initialData={aiFormData} />

          <aside className="space-y-6">
            <section className="rf-panel rounded-2xl p-6 bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/40 border-sky-100 dark:border-sky-900/50 relative overflow-hidden">
              {isExtracting && (
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-3" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 animate-pulse">Belge analiz ediliyor...</p>
                </div>
              )}
              
              <div className="flex items-center gap-3 mb-4 relative z-0">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">AI Sipariş Asistanı</h2>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 mb-5 relative z-0">
                Müşteriden gelen PDF sipariş formunu veya irsaliyeyi yükleyin. RenkFlow AI, belgeyi analiz ederek formu sizin yerinize otomatik doldursun.
              </p>
              
              <div className="relative border-2 border-dashed border-sky-200 dark:border-sky-800 rounded-xl p-8 text-center hover:bg-sky-50/50 dark:hover:bg-sky-900/20 transition-colors cursor-pointer group z-0">
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  accept="application/pdf,image/png,image/jpeg"
                  title="PDF veya Görsel Yükle"
                  onChange={handleFileUpload}
                  disabled={isExtracting}
                />
                <div className="w-12 h-12 mx-auto rounded-full bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center text-sky-500 mb-3 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Belgeyi buraya sürükleyin</p>
                <p className="text-xs text-slate-500 mt-1">veya seçmek için tıklayın (PDF, JPG, PNG)</p>
              </div>
            </section>

            <section className="rf-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Standart İş Akışı</h2>
              <ol className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>1. Müşteri profilini doğrula.</li>
                <li>2. Ürün ve fiyat bilgisini netleştir.</li>
                <li>3. Gerekli teknik belgeleri ekle.</li>
                <li>4. Siparişi kaydet ve operasyona aktar.</li>
              </ol>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
