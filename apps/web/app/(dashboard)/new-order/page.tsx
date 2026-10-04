'use client';
import { prepareFileUpload } from '@/lib/storage/client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Link from 'next/link';
import { NewOrderForm } from '@/components/forms/NewOrderForm';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { requestJson } from '@/lib/shared/network';
import { NewOrderFormData } from '@/lib/types';
import { ArrowLeft, FileUp, Loader2, ClipboardCheck, Info } from 'lucide-react';
import { ORDER_MAX_UPLOAD_SIZE_BYTES } from '@/lib/features/orders/constants';

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
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [capabilityError, setCapabilityError] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    requestJson<{ available: boolean }>('/api/ai/document-extract', { signal: controller.signal, cache: 'no-store' }, { timeoutMs: 10000 }).then(result => {
      if (controller.signal.aborted) return;
      if (result.ok && result.data) setAiAvailable(result.data.available);
      else setCapabilityError(true);
    });
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth/login');
    }
  }, [isLoading, router, user]);

  if (isLoading || !user) return null;

  const handleSubmit = async (formData: FormData) => {
    setSubmitError('');
    const result = await createOrderViaApi(formData);
    if (!result.ok) {
      if (result.status === 401) {
        router.push('/auth/login');
        return;
      }
      setSubmitError(result.message || 'Sipariş kaydedilemedi.');
      showToast(result.message || 'Sipariş kaydedilirken hata oluştu.', 'error');
      return;
    }

    showToast('Sipariş kaydı tamamlandı.', 'success');
    router.push('/orders');
    router.refresh();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || aiAvailable !== true) return;
    if (file.size > ORDER_MAX_UPLOAD_SIZE_BYTES || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) {
      showToast('PDF, JPG veya PNG seçin. Dosya en fazla 10 MB olabilir.', 'error');
      e.target.value = '';
      return;
    }
    
    try {
      setIsExtracting(true);
      showToast('Belge analiz ediliyor...', 'info');
      
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const [meta, base64] = result.split(',');
          const mimeType = meta.split(':')[1].split(';')[0];
          
          const res = await requestJson<{ success: boolean; error?: string; data: Record<string, string> }>('/api/ai/document-extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...(await prepareFileUpload({name:file.name,mime:mimeType,base64})), mimeType })
          }, { timeoutMs: 65000, fallbackError: 'Belge analizi tamamlanamadı.' });
          
          const resData = res.data;
          if (!res.ok || !resData?.success) {
            throw new Error(res.error || resData?.error || 'Analiz başarısız');
          }
          
          const extracted = resData.data;
          
          const parsedData: NewOrderFormData = {
            customerName: extracted.müşteri || extracted.customer || extracted.Müşteri || extracted.Customer || '',
            productName: extracted.ürün || extracted.product || extracted.Ürün || extracted.Product || 'Belirtilmemiş Ürün',
            quantity: parseInt(extracted.adet || extracted.quantity || extracted.Adet) || 1,
            totalAmount: parseFloat(String(extracted.tutar || extracted.fiyat || extracted.total || extracted.Tutar || 0).replace(',', '.')) || 0,
            currency: 'TRY',
            notes: `--- Belge taslağı · kullanıcı doğrulaması gerekli ---\nÖlçüler (mm): ${extracted.ölçüler || extracted.ölçü || '-'}\nRAL / yüzey: ${extracted.renk || '-'}\nProfil / seri: ${extracted.profil || extracted.seri || '-'}\nDiğer: ${extracted.notlar || '-'}`,
          };
          
          setAiFormData(parsedData);
          showToast('Belge taslağı hazır. Kaydetmeden önce ölçü ve ürün bilgilerini doğrulayın.', 'success');
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
    <div className="rf-page">
      <Link href="/orders" className="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Siparişlere dön</Link>
      <div className="mb-7">
        <p className="rf-eyebrow">Sipariş yönetimi / Yeni kayıt</p>
        <h1 className="rf-page-title">Yeni sipariş oluşturun</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Müşteri, teknik ölçüler ve teslimat bilgilerini üretim ekibiniz için bir araya getirin.</p>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
        <NewOrderForm onSubmit={handleSubmit} initialData={aiFormData} submitError={submitError} />
        <aside className="space-y-5 xl:sticky xl:top-20">
          <section className="rf-panel border border-border p-5" aria-busy={isExtracting}>
            <div className="mb-4 flex items-center gap-2.5"><FileUp size={18} className="text-primary" /><h2 className="rf-section-title">Belgeden sipariş taslağı</h2></div>
            <p className="text-xs leading-6 text-muted-foreground">Belgedeki bilgileri forma aktarın. Kaydetmeden önce ürün, adet ve ölçüleri mutlaka doğrulayın.</p>
            <div className="relative mt-4 rounded-md border border-dashed border-input bg-accent/50 p-6 text-center focus-within:ring-2 focus-within:ring-primary">
              <input type="file" className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" accept="application/pdf,image/png,image/jpeg" aria-label="Sipariş belgesi seç" onChange={handleFileUpload} disabled={isExtracting || aiAvailable !== true} />
              {isExtracting ? <Loader2 size={23} className="mx-auto mb-3 animate-spin text-primary" /> : <FileUp size={23} className="mx-auto mb-3 text-muted-foreground" />}
              <p className="text-xs font-medium">{isExtracting ? 'Belge analiz ediliyor…' : 'Belge seçin'}</p>
              <p className="mt-2 text-[10px] text-muted-foreground">PDF, JPG, PNG · En fazla 10 MB</p>
            </div>
            {aiAvailable !== true && <div className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><Info size={14} className="mt-0.5 shrink-0" /><p>{capabilityError ? 'Belge analizinin kullanılabilirliği kontrol edilemedi. Bilgileri elle girebilirsiniz.' : aiAvailable === false ? 'Belge analizi henüz etkinleştirilmedi. Bilgileri elle girip teknik belgeleri siparişe ekleyebilirsiniz.' : 'Belge analizi kontrol ediliyor…'}</p></div>}
          </section>
          <section className="rf-panel border border-border p-5">
            <div className="flex items-center gap-2.5"><ClipboardCheck size={18} className="text-primary" /><h2 className="rf-section-title">Kayıt kontrolü</h2></div>
            <ol className="mt-5 space-y-4">
              {['Ölçüleri milimetre olarak doğrulayın.', 'Profil serisi ve RAL rengini belirtin.', 'Teknik çizim ve müşteri onayını ekleyin.', 'Termin ve sevkiyat notlarını kontrol edin.'].map((text, index) => <li key={text} className="flex items-start gap-3 text-xs leading-5 text-muted-foreground"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border text-[10px] tabular-nums">{String(index + 1).padStart(2, '0')}</span>{text}</li>)}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
