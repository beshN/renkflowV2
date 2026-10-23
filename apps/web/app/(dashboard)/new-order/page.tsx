'use client';
import { prepareFileUpload } from '@/lib/storage/client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import Link from 'next/link';
import { NewOrderForm } from '@/components/forms/NewOrderForm';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { requestJson } from '@/lib/shared/network';
import { ArrowLeft, FileUp, Loader2, Info, RotateCcw } from 'lucide-react';
import { ORDER_MAX_UPLOAD_SIZE_BYTES } from '@/lib/features/orders/constants';
import { celebrate } from '@/components/spells/celebrate';

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

  const [isExtracting, setIsExtracting] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [capabilityError, setCapabilityError] = useState(false);
  const [capabilityAttempt, setCapabilityAttempt] = useState(0);
  const extraction = useRef<AbortController | null>(null);
  useEffect(() => () => extraction.current?.abort(), []);
  const [submitError, setSubmitError] = useState('');
  const capabilityScope = user ? `${user.id}:${user.tenantId}` : '';

  useEffect(() => {
    if (!capabilityScope) return;
    const controller = new AbortController();
    setCapabilityError(false);
    requestJson<{ available: boolean }>('/api/ai/document-extract', { signal: controller.signal, cache: 'no-store' }, { timeoutMs: 10000 }).then(result => {
      if (controller.signal.aborted) return;
      if (result.ok && result.data) setAiAvailable(result.data.available);
      else setCapabilityError(true);
    });
    return () => controller.abort();
  }, [capabilityScope, capabilityAttempt]);

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

    celebrate();
    showToast('Sipariş kaydı tamamlandı.', 'success');
    router.push('/orders');
    router.refresh();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || aiAvailable !== true || extraction.current) return;
    if (file.size > ORDER_MAX_UPLOAD_SIZE_BYTES || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) {
      showToast('PDF, JPG veya PNG seçin. Dosya en fazla 10 MB olabilir.', 'error');
      e.target.value = '';
      return;
    }
    
    const input = e.currentTarget;
    const controller = new AbortController();
    extraction.current = controller;
    try {
      setIsExtracting(true);
      showToast('Belge analiz ediliyor...', 'info');
      
      const reader = new FileReader();
      reader.onload = async () => {
        if (controller.signal.aborted) return;
        try {
          const result = reader.result as string;
          const [meta, base64] = result.split(',');
          const mimeType = meta.split(':')[1].split(';')[0];
          
          const res = await requestJson<{ success: boolean; error?: string; draftId: string }>('/api/ai/document-extract', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...(await prepareFileUpload({name:file.name,mime:mimeType,base64})), mimeType })
          }, { timeoutMs: 270000, fallbackError: 'Belge analizi tamamlanamadı.' });
          
          const resData = res.data;
          if (!res.ok || !resData?.success) {
            throw new Error(res.error || resData?.error || 'Analiz başarısız');
          }
          
          if (controller.signal.aborted) return;
          if (!resData.draftId) throw new Error('İnceleme taslağı alınamadı. Tekrar deneyin.');
          showToast('Belge taslağı hazır. Tüm kalemleri ve ölçüleri inceleyip onaylayın.', 'success');
          router.push(`/production/intake/${encodeURIComponent(resData.draftId)}`);
        } catch (err: any) {
          if (!controller.signal.aborted) showToast(err.message || 'Analiz tamamlanamadı.', 'error');
        } finally {
          extraction.current = null;
          if (!controller.signal.aborted) setIsExtracting(false);
          input.value = '';
        }
      };
      reader.onerror = () => {
        extraction.current = null;
        if (!controller.signal.aborted) { showToast('Dosya okunamadı', 'error'); setIsExtracting(false); }
        input.value = '';
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      extraction.current = null;
      if (!controller.signal.aborted) { showToast(err.message || 'Belge analizi başarısız', 'error'); setIsExtracting(false); }
      input.value = '';
    }
  };

  return (
    <div className="rf-page">
      <Link href="/orders" className="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Siparişlere dön</Link>
      <div className="mb-7">
        <p className="rf-eyebrow">Siparişler</p>
        <h1 className="rf-page-title">Yeni sipariş</h1>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
        <NewOrderForm onSubmit={handleSubmit} submitError={submitError} />
        <aside className="space-y-5 xl:sticky xl:top-20">
          <section className="rf-panel border border-border p-5" aria-busy={isExtracting}>
            <div className="mb-4 flex items-center gap-2.5"><FileUp size={18} className="text-primary" /><h2 className="rf-section-title">Belgeden doldur</h2></div>
            <div className="relative mt-4 rounded-md border border-dashed border-input bg-accent/50 p-6 text-center focus-within:ring-2 focus-within:ring-primary">
              <input type="file" className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" accept="application/pdf,image/png,image/jpeg" aria-label="Sipariş belgesi seç" onChange={handleFileUpload} disabled={isExtracting || aiAvailable !== true} />
              {isExtracting ? <Loader2 size={23} className="mx-auto mb-3 animate-spin text-primary" /> : <FileUp size={23} className="mx-auto mb-3 text-muted-foreground" />}
              <p className="text-xs font-medium">{isExtracting ? 'Belge analiz ediliyor…' : 'Belge seçin'}</p>
              <p className="mt-2 text-[10px] text-muted-foreground">PDF, JPG, PNG · En fazla 10 MB</p>
            </div>
            {capabilityError && <div role="alert" className="mt-3 space-y-2 text-xs text-muted-foreground"><p>Belge okuma durumu alınamadı.</p><button type="button" className="inline-flex items-center gap-1.5 text-primary" onClick={() => setCapabilityAttempt(n => n + 1)}><RotateCcw size={13} />Tekrar dene</button></div>}
            {aiAvailable === false && <p className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground"><Info size={14} className="mt-0.5 shrink-0" />Belge okuma kapalı.</p>}
            <Link href="/orders/foy" className="mt-3 inline-flex text-xs font-medium text-primary hover:underline">İmalat föyü mü? Föy okuyucuyu açın →</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
