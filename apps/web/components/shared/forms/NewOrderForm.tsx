'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { type Currency, type NewOrderFormData, type NewOrderItemData } from '@/lib/types';
import {
  ORDER_FORM_ALLOWED_FILE_TYPES,
  ORDER_MAX_UPLOAD_COUNT,
  ORDER_MAX_UPLOAD_SIZE_BYTES,
} from '@/lib/features/orders/constants';

interface NewOrderFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  initialData?: NewOrderFormData;
}

type FieldErrors = Partial<Record<'customerName' | 'productName' | 'quantity' | 'totalAmount' | string, string>>;

type UploadEntry = {
  id: string;
  file: File;
};

const ALLOWED_UPLOAD_TYPES: ReadonlySet<string> = new Set(ORDER_FORM_ALLOWED_FILE_TYPES);

function buildTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function NewOrderForm({ onSubmit, initialData }: NewOrderFormProps) {
  const router = useRouter();

  const [form, setForm] = useState<NewOrderFormData>(
    initialData ?? {
      customerName: '',
      email: '',
      phone: '',
      productName: '',
      quantity: 1,
      totalAmount: 0,
      currency: 'TRY',
      deliveryDate: '',
      notes: '',
      specialNotes: '',
      items: [],
      customFields: {},
    },
  );

  const [rawTotalAmount, setRawTotalAmount] = useState(String(initialData?.totalAmount ?? '0'));
  const [items, setItems] = useState<NewOrderItemData[]>(initialData?.items ?? []);

  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({ ...prev, ...initialData }));
      if (initialData.totalAmount !== undefined) {
        setRawTotalAmount(String(initialData.totalAmount));
      }
      if (initialData.items) {
        setItems(initialData.items);
      }
    }
  }, [initialData]);

  const [files, setFiles] = useState<UploadEntry[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayISO = useMemo(buildTodayISO, []);

  // Calculate total amount from items if items exist
  const calculatedTotal = useMemo(() => {
    if (items.length === 0) return Number.parseFloat(rawTotalAmount.replace(',', '.')) || 0;
    return items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  }, [items, rawTotalAmount]);

  const calculatedQuantity = useMemo(() => {
    if (items.length === 0) return form.quantity;
    return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [items, form.quantity]);

  const validate = (): boolean => {
    const nextErrors: FieldErrors = {};

    if (!form.customerName.trim()) {
      nextErrors.customerName = 'Müşteri adı zorunlu alandır.';
    }

    if (items.length === 0 && !form.productName.trim()) {
      nextErrors.productName = 'Ürün adı zorunlu alandır.';
    }

    if (calculatedTotal <= 0) {
      nextErrors.totalAmount = 'Toplam tutar sıfırdan büyük olmalı.';
    }

    items.forEach((item, idx) => {
      if (!item.productName.trim()) {
        nextErrors[`items.${idx}.productName`] = 'Kalem adı zorunlu.';
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('customerName', form.customerName.trim());
      if (form.email?.trim()) payload.append('email', form.email.trim());
      if (form.phone?.trim()) payload.append('phone', form.phone.trim());
      
      // If items exist, use the first item's name as the main product name (or a generic one)
      const mainProductName = items.length > 0 ? (items.length === 1 ? items[0].productName : `${items[0].productName} ve diğerleri`) : form.productName.trim();
      
      payload.append('productName', mainProductName);
      payload.append('quantity', String(calculatedQuantity));
      payload.append('totalAmount', String(calculatedTotal));
      payload.append('currency', (form.currency || 'TRY') as Currency);
      if (form.deliveryDate) payload.append('deliveryDate', form.deliveryDate);
      if (form.notes?.trim()) payload.append('notes', form.notes.trim());
      if (form.specialNotes?.trim()) payload.append('specialNotes', form.specialNotes.trim());

      if (items.length > 0) {
        payload.append('items', JSON.stringify(items));
      }

      files.forEach((entry) => payload.append('files', entry.file));

      await onSubmit(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addFiles = (inputFiles: FileList | null) => {
    if (!inputFiles || inputFiles.length === 0) return;
    const selected = Array.from(inputFiles);
    const nextErrors: string[] = [];

    setFiles((prev) => {
      const existingKeys = new Set(prev.map((entry) => `${entry.file.name}-${entry.file.size}-${entry.file.lastModified}`));
      const accepted: UploadEntry[] = [];

      for (const file of selected) {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (existingKeys.has(key)) {
          nextErrors.push(`${file.name}: Dosya zaten eklendi.`);
          continue;
        }
        if (file.size > ORDER_MAX_UPLOAD_SIZE_BYTES) {
          nextErrors.push(`${file.name}: 10MB limitini asiyor.`);
          continue;
        }
        if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
          nextErrors.push(`${file.name}: Dosya tipi desteklenmiyor.`);
          continue;
        }
        existingKeys.add(key);
        accepted.push({ id: crypto.randomUUID(), file });
      }

      const merged = [...prev, ...accepted];
      if (merged.length > ORDER_MAX_UPLOAD_COUNT) {
        nextErrors.push(`En fazla ${ORDER_MAX_UPLOAD_COUNT} dosya yukleyebilirsiniz.`);
      }

      return merged.slice(0, ORDER_MAX_UPLOAD_COUNT);
    });

    setFileError(nextErrors.length > 0 ? nextErrors[0] : null);
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { productName: '', quantity: 1, unitPrice: 0, totalPrice: 0 },
    ]);
  };

  const updateItem = (index: number, field: keyof NewOrderItemData, value: any) => {
    setItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Auto calc total price
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = newItems[index].quantity || 0;
        const price = newItems[index].unitPrice || 0;
        newItems[index].totalPrice = qty * price;
      }
      
      return newItems;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rf-panel rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Müşteri Profili</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Müşteri adı *</span>
            <input
              type="text"
              value={form.customerName}
              onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
            />
            {errors.customerName && <span className="mt-1 block text-xs text-rose-600">{errors.customerName}</span>}
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">E-posta</span>
            <input
              type="email"
              value={form.email || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Telefon</span>
            <input
              type="text"
              value={form.phone || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </div>
      </section>

      <section className="rf-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sipariş Kalemleri</h2>
            <p className="mt-1 text-sm text-slate-500">Ürün, ölçü ve fiyat detaylarını girin.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addItem} className="gap-2">
            <Plus size={14} /> Kalem Ekle
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <label className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Ürün adı (Tekli Sipariş) *</span>
              <input
                type="text"
                value={form.productName}
                onChange={(e) => setForm((prev) => ({ ...prev, productName: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
              />
              {errors.productName && <span className="mt-1 block text-xs text-rose-600">{errors.productName}</span>}
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Miktar *</span>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number.parseInt(e.target.value, 10) || 0 }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Toplam tutar ({form.currency})</span>
              <input
                type="text"
                inputMode="decimal"
                value={rawTotalAmount}
                onChange={(e) => setRawTotalAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 relative group">
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pr-8">
                  <label className="md:col-span-2">
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">Ürün Adı *</span>
                    <input
                      type="text"
                      value={item.productName}
                      onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
                    />
                    {errors[`items.${idx}.productName`] && <span className="mt-1 block text-xs text-rose-600">{errors[`items.${idx}.productName`]}</span>}
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">Genişlik (mm)</span>
                    <input
                      type="number"
                      value={item.widthMm || ''}
                      onChange={(e) => updateItem(idx, 'widthMm', parseFloat(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">Yükseklik (mm)</span>
                    <input
                      type="number"
                      value={item.heightMm || ''}
                      onChange={(e) => updateItem(idx, 'heightMm', parseFloat(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">Renk</span>
                    <input
                      type="text"
                      value={item.color || ''}
                      onChange={(e) => updateItem(idx, 'color', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">Miktar</span>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">Birim Fiyat</span>
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitPrice || ''}
                      onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">Toplam</span>
                    <div className="px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {formatCurrency(item.totalPrice || 0, form.currency)}
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Teslimat tarihi</span>
            <input
              type="date"
              min={todayISO}
              value={form.deliveryDate || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, deliveryDate: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Para birimi</span>
            <select
              value={form.currency}
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value as Currency }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Notlar (AI Çıkarımları)</span>
            <textarea
              rows={3}
              value={form.notes || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </div>
      </section>

      <section className="rf-panel rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Teknik Belgeler</h2>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            <Plus size={14} />
            Dosya ekle
            <input
              type="file"
              multiple
              className="hidden"
              accept="image/*,.pdf"
              onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ''; }}
            />
          </label>
        </div>
        {files.length > 0 ? (
          <div className="mt-4 space-y-2">
            {files.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText size={16} className="text-slate-500" />
                  <span className="truncate text-sm text-slate-700 dark:text-slate-200">{entry.file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((item) => item.id !== entry.id))}
                  className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Henüz belge yüklenmedi.</p>
        )}
        {fileError && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{fileError}</p>}
      </section>

      <section className="rf-panel rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sipariş Özeti</h2>
        <div className="mt-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50">
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>Toplam Miktar</span>
            <span>{calculatedQuantity} adet</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Genel toplam</span>
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(calculatedTotal, form.currency)}</span>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" variant="primary" size="lg" className="sm:flex-1" isLoading={isSubmitting} loadingText="Sipariş kaydediliyor...">
          Siparişi Kaydet
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={() => router.back()}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
