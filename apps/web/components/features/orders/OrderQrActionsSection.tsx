'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createOrderQrToken,
  deactivateOrderQrToken,
  listOrderQrTokens,
  type OrderQrTokenDTO,
} from '@/app/actions/order.qr.actions';
import { ORDER_QR_ACTION_LIST, type OrderQrActionKey } from '@/lib/orders/qrActions';
import { Modal } from '@/components/shared/ui/Modal';
import { Button } from '@/components/shared/ui/Button';
import { QrCode, Copy, Download, Ban, Plus, ExternalLink } from 'lucide-react';
import { useToast } from '@/lib/context/ToastContext';

interface OrderQrActionsSectionProps {
  orderId: string;
}

export function OrderQrActionsSection({ orderId }: OrderQrActionsSectionProps) {
  const { showToast } = useToast();
  const [tokens, setTokens] = useState<OrderQrTokenDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [label, setLabel] = useState('Workshop QR');
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedActions, setSelectedActions] = useState<OrderQrActionKey[]>([
    'status.set_in_production',
    'status.set_delivered',
    'note.add',
  ]);

  const actionMap = useMemo(() => {
    return new Map(ORDER_QR_ACTION_LIST.map((item) => [item.key, item]));
  }, []);

  const loadTokens = useCallback(async () => {
    try {
      setLoading(true);
      const list = await listOrderQrTokens(orderId);
      setTokens(list);
    } catch (error) {
      showToast('QR token listesi yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId, showToast]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  function toggleAction(actionKey: OrderQrActionKey) {
    setSelectedActions((current) => {
      if (current.includes(actionKey)) {
        return current.filter((item) => item !== actionKey);
      }
      return [...current, actionKey];
    });
  }

  function getQrLink(token: string) {
    if (typeof window === 'undefined') return `/q/order?token=${token}`;
    return `${window.location.origin}/q/order?token=${token}`;
  }

  function getQrDownloadUrl(token: string, format: 'png' | 'svg' = 'png') {
    const params = new URLSearchParams();
    params.set('token', token);
    params.set('format', format);
    return `/api/orders/qr?${params.toString()}`;
  }

  async function handleCreateToken() {
    if (selectedActions.length === 0) {
      showToast('En az 1 aksiyon seçmelisiniz', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await createOrderQrToken({
        orderId,
        label,
        allowedActions: selectedActions,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      showToast('QR token oluşturuldu', 'success');
      setShowCreateModal(false);
      await loadTokens();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'QR token oluşturulamadı', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyLink(token: string) {
    try {
      await navigator.clipboard.writeText(getQrLink(token));
      showToast('Link kopyalandı', 'success');
    } catch (error) {
      showToast('Link kopyalanamadı', 'error');
    }
  }

  function handleOpenScan(token: string) {
    const url = getQrLink(token);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleDownloadQr(token: string, tokenLabel: string | null) {
    try {
      const anchor = document.createElement('a');
      anchor.href = getQrDownloadUrl(token, 'png');
      anchor.download = `${tokenLabel || 'order-qr'}-${token.slice(0, 8)}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      showToast('QR indirilemedi', 'error');
    }
  }

  async function handleDownloadQrSvg(token: string, tokenLabel: string | null) {
    try {
      const anchor = document.createElement('a');
      anchor.href = getQrDownloadUrl(token, 'svg');
      anchor.download = `${tokenLabel || 'order-qr'}-${token.slice(0, 8)}.svg`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      showToast('QR indirilemedi', 'error');
    }
  }

  async function handleDeactivate(tokenId: string) {
    try {
      await deactivateOrderQrToken(tokenId);
      showToast('QR token pasif hale getirildi', 'success');
      await loadTokens();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Token pasifleştirilemedi', 'error');
    }
  }

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            QR Actions
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            QR ile hızlı durum/not/fotoğraf aksiyonları
          </p>
        </div>

        <Button
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowCreateModal(true)}
        >
          Token Oluştur
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
        </div>
      ) : tokens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
          Bu sipariş için QR token bulunmuyor.
        </div>
      ) : (
        <div className="space-y-3">
          {tokens.map((token) => (
            <article
              key={token.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {token.label || 'QR Token'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {token.active ? 'Aktif' : 'Pasif'}
                    {token.expiresAt ? ` • Son: ${new Date(token.expiresAt).toLocaleString('tr-TR')}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopyLink(token.token)} leftIcon={<Copy className="w-3.5 h-3.5" />}>
                    Link
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleOpenScan(token.token)} leftIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                    Aç
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownloadQr(token.token, token.label)} leftIcon={<Download className="w-3.5 h-3.5" />}>
                    QR İndir
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownloadQrSvg(token.token, token.label)}>
                    SVG
                  </Button>
                  {token.active && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeactivate(token.id)}
                      leftIcon={<Ban className="w-3.5 h-3.5" />}
                    >
                      Pasifleştir
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {token.allowedActions.map((actionKey) => (
                  <span
                    key={actionKey}
                    className="text-xs rounded-full px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    {actionMap.get(actionKey)?.label || actionKey}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="QR Token Oluştur">
        <div className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="qr-label" className="text-sm font-medium text-slate-700 dark:text-slate-200">Etiket</label>
            <input
              id="qr-label"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-950"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Workshop QR"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="qr-expire" className="text-sm font-medium text-slate-700 dark:text-slate-200">Bitiş Tarihi (Opsiyonel)</label>
            <input
              id="qr-expire"
              type="datetime-local"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-950"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Aksiyonlar</p>
            <div className="space-y-2">
              {ORDER_QR_ACTION_LIST.map((action) => {
                const checked = selectedActions.includes(action.key);
                return (
                  <label key={action.key} className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={() => toggleAction(action.key)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{action.label}</span>
                      <span className="block text-xs text-slate-500">{action.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Vazgeç</Button>
            <Button isLoading={submitting} onClick={handleCreateToken}>Token Oluştur</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
