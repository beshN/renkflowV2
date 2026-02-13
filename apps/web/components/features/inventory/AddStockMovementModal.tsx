'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createStockMovement, type StockMovementType } from '@/app/actions/inventory.actions';
import { Modal } from '@/components/shared/ui/Modal';
import { Button } from '@/components/shared/ui/Button';
import { Input } from '@/components/shared/ui/Input';
import { useToast } from '@/lib/context/ToastContext';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission, type UserRole } from '@/lib/auth/permissions';

interface AddStockMovementModalProps {
  itemId: string;
}

export function AddStockMovementModal({ itemId }: AddStockMovementModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const canCreateMovement = user?.role
    ? hasPermission(user.role as UserRole, 'inventory.movements.create')
    : false;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateMovement) {
      showToast('Bu işlem için yetkiniz bulunmuyor', 'error');
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      setSubmitting(true);
      await createStockMovement({
        itemId,
        type: String(data.get('type') || 'IN') as StockMovementType,
        quantity: Number(data.get('quantity') || 0),
        orderId: String(data.get('orderId') || '').trim() || undefined,
        note: String(data.get('note') || '').trim() || undefined,
      });

      showToast('Stok hareketi kaydedildi', 'success');
      setOpen(false);
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Hareket kaydedilemedi', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!canCreateMovement} title={!canCreateMovement ? 'Yetkiniz yok' : undefined}>
        Hareket Ekle
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Stok Hareketi Ekle">
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="space-y-1.5 block text-sm">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Hareket Tipi</span>
            <div className="relative">
              <select 
                name="type" 
                className="w-full h-11 px-4 rounded-xl border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 text-slate-900 dark:text-white ring-offset-transparent placeholder:text-slate-500 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 backdrop-blur-xl transition-all outline-none appearance-none"
              >
                <option value="IN">📥 Stok Girişi (IN)</option>
                <option value="OUT">📤 Stok Çıkışı (OUT)</option>
                <option value="ADJUST">🔄 Düzeltme / Sayım (ADJUST)</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </label>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Miktar</label>
            <Input 
              name="quantity" 
              type="number" 
              step="0.01" 
              min={0.01} 
              required 
              variant="glass"
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sipariş ID (opsiyonel)</label>
            <Input 
              name="orderId" 
              variant="glass"
              placeholder="İlgili sipariş numarası"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Not</label>
            <textarea 
              name="note" 
              rows={3} 
              className="w-full rounded-xl border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 px-4 py-3 text-sm text-slate-900 dark:text-white ring-offset-transparent placeholder:text-slate-500 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 backdrop-blur-xl transition-all outline-none resize-none"
              placeholder="Hareket ile ilgili açıklama..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>İptal</Button>
            <Button type="submit" isLoading={submitting}>Kaydet</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
