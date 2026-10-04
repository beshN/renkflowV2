'use client';
import { prepareBrowserFile } from '@/lib/storage/client';

import { useMemo, useState } from 'react';
import { executeOrderQrAction, type ResolvedOrderQrToken } from '@/app/actions/order.qr.actions';
import { ORDER_QR_ACTION_LIST, type OrderQrActionKey } from '@/lib/orders/qrActions';
import { Button } from '@/components/shared/ui/Button';
import { Upload, StickyNote, CheckCircle2 } from 'lucide-react';

interface OrderQrActionScreenProps {
  token: string;
  resolved: ResolvedOrderQrToken;
}

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

function statusLabel(status: ResolvedOrderQrToken['order']['status']): string {
  if (status === 'pending') return 'Beklemede';
  if (status === 'in_production') return 'Üretimde';
  return 'Teslim Edildi';
}

function statusPillClass(status: ResolvedOrderQrToken['order']['status']): string {
  if (status === 'pending') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (status === 'in_production') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Dosya okunamadı'));
        return;
      }
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsDataURL(file);
  });
}

export function OrderQrActionScreen({ token, resolved }: OrderQrActionScreenProps) {
  const [activeAction, setActiveAction] = useState<OrderQrActionKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [photoNote, setPhotoNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState(resolved.order);

  const actionMap = useMemo(() => {
    return new Map(ORDER_QR_ACTION_LIST.map((item) => [item.key, item]));
  }, []);

  async function runAction(actionKey: OrderQrActionKey) {
    try {
      if (actionKey === 'status.set_delivered') {
        const ok = window.confirm('Siparişi Teslim Edildi olarak işaretlemek istiyor musunuz?');
        if (!ok) return;
      }
      setSubmitting(true);
      const result = await executeOrderQrAction({
        token,
        actionKey,
        payload: {},
      });
      setCurrentOrder(result.order);
      setStatusMessage(result.message);
      setActiveAction(null);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Aksiyon çalıştırılamadı');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNote() {
    try {
      if (!note.trim()) {
        setStatusMessage('Not boş olamaz');
        return;
      }
      setSubmitting(true);
      const result = await executeOrderQrAction({
        token,
        actionKey: 'note.add',
        payload: { note },
      });
      setCurrentOrder(result.order);
      setStatusMessage(result.message);
      setNote('');
      setActiveAction(null);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Not eklenemedi');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPhoto() {
    if (!file) {
      setStatusMessage('Lütfen dosya seçin');
      return;
    }

    try {
      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        setStatusMessage('Dosya çok büyük (maks. 10MB)');
        return;
      }
      const type = (file.type || '').toLowerCase();
      const okType = type === 'application/pdf' || type.startsWith('image/');
      if (!okType) {
        setStatusMessage('Yalnızca görsel veya PDF yüklenebilir');
        return;
      }
      setSubmitting(true);
      const prepared = await prepareBrowserFile(file,"qr",token);
      const source = prepared instanceof File ? {base64Data:await fileToBase64(prepared)} : {blobPath:prepared.blobPath};
      const result = await executeOrderQrAction({
        token,
        actionKey: 'photo.upload',
        payload: {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          ...source,
          note: photoNote || undefined,
        },
      });
      setCurrentOrder(result.order);
      setStatusMessage(result.message);
      setFile(null);
      setPhotoNote('');
      setActiveAction(null);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Fotoğraf yüklenemedi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-8">
      <div className="mx-auto max-w-xl space-y-4">
        <header className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            Sipariş #{currentOrder.orderNumber}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {currentOrder.customerName} • {currentOrder.productName || 'Ürün belirtilmemiş'}
          </p>
          <div className="mt-3 inline-flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Durum</span>
            <span className={`text-xs font-semibold rounded-full border px-2.5 py-1 ${statusPillClass(currentOrder.status)}`}>
              {statusLabel(currentOrder.status)}
            </span>
          </div>
        </header>

        {statusMessage && (
          <div className="rounded-xl bg-blue-50 border border-blue-100 text-blue-700 p-3 text-sm flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5" />
            <span>{statusMessage}</span>
          </div>
        )}

        {activeAction === 'note.add' && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <StickyNote className="w-4 h-4" /> Not Ekle
            </h2>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
              placeholder="Sipariş notu..."
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setActiveAction(null)}>İptal</Button>
              <Button isLoading={submitting} onClick={submitNote}>Kaydet</Button>
            </div>
          </section>
        )}

        {activeAction === 'photo.upload' && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Upload className="w-4 h-4" /> Fotoğraf / Doküman
            </h2>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="w-full text-sm"
            />
            <textarea
              value={photoNote}
              onChange={(event) => setPhotoNote(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
              placeholder="Opsiyonel açıklama"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setActiveAction(null)}>İptal</Button>
              <Button isLoading={submitting} onClick={submitPhoto}>Yükle</Button>
            </div>
          </section>
        )}

        <section className="space-y-3">
          {resolved.allowedActions.map((actionKey) => {
            const action = actionMap.get(actionKey);
            if (!action) return null;

            if (actionKey === 'note.add' || actionKey === 'photo.upload') {
              return (
                <Button
                  key={actionKey}
                  className="w-full !h-14 justify-start text-left"
                  variant="secondary"
                  onClick={() => setActiveAction(actionKey)}
                >
                  {action.label}
                </Button>
              );
            }

            return (
              <Button
                key={actionKey}
                className="w-full !h-14 justify-start text-left"
                variant="default"
                isLoading={submitting}
                onClick={() => runAction(actionKey)}
              >
                {action.label}
              </Button>
            );
          })}
        </section>
      </div>
    </div>
  );
}
