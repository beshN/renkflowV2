'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { type Currency, type NewOrderFormData } from '@/lib/types';
import {
  ORDER_FORM_ALLOWED_FILE_TYPES,
  ORDER_MAX_UPLOAD_COUNT,
  ORDER_MAX_UPLOAD_SIZE_BYTES,
} from '@/lib/features/orders/constants';

interface NewOrderFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  initialData?: NewOrderFormData;
}

type FieldErrors = Partial<Record<'customerName' | 'productName' | 'quantity' | 'totalAmount', string>>;

type UploadEntry = {
  id: string;
  file: File;
};

const ALLOWED_UPLOAD_TYPES: ReadonlySet<string> = new Set(ORDER_FORM_ALLOWED_FILE_TYPES);

function parseLocalizedNumber(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

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
      customFields: {},
    },
  );

  const [rawTotalAmount, setRawTotalAmount] = useState(String(initialData?.totalAmount ?? ''));
  const [files, setFiles] = useState<UploadEntry[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayISO = useMemo(buildTodayISO, []);
  const summaryAmount = parseLocalizedNumber(rawTotalAmount);
  const summaryAmountValue = summaryAmount ?? 0;

  const validate = (): boolean => {
    const nextErrors: FieldErrors = {};

    if (!form.customerName.trim()) {
      nextErrors.customerName = 'Müşteri adı zorunlu alandır.';
    }

    if (!form.productName.trim()) {
      nextErrors.productName = 'Ürün adı zorunlu alandır.';
    }

    if (!Number.isInteger(form.quantity) || form.quantity < 1) {
      nextErrors.quantity = 'Miktar en az 1 olmalıdır.';
    }

    if (!rawTotalAmount.trim() || summaryAmount === null) {
      nextErrors.totalAmount = 'Toplam tutar gecersiz.';
    } else if (summaryAmount <= 0) {
      nextErrors.totalAmount = 'Toplam tutar sifirdan buyuk olmali.';
    } else if (summaryAmount > 99999999.99) {
      nextErrors.totalAmount = 'Toplam tutar limitin uzerinde.';
    }

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
      payload.append('productName', form.productName.trim());
      payload.append('quantity', String(form.quantity));
      payload.append('totalAmount', String(summaryAmountValue));
      payload.append('currency', (form.currency || 'TRY') as Currency);
      if (form.deliveryDate) payload.append('deliveryDate', form.deliveryDate);
      if (form.notes?.trim()) payload.append('notes', form.notes.trim());

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rf-panel rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Müşteri Profili</h2>
        <p className="mt-1 text-sm text-slate-500">Siparişin bağlı olduğu müşteri bilgisini eksiksiz girin.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Müşteri adı *</span>
            <input
              type="text"
              value={form.customerName}
              onChange={(event) => setForm((prev) => ({ ...prev, customerName: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Örn: Ahmet Yılmaz"
            />
            {errors.customerName && <span className="mt-1 block text-xs text-rose-600">{errors.customerName}</span>}
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">E-posta</span>
            <input
              type="email"
              value={form.email || ''}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="ornek@firma.com"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Telefon</span>
            <input
              type="text"
              value={form.phone || ''}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="+90 5XX XXX XX XX"
            />
          </label>
        </div>
      </section>

      <section className="rf-panel rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sipariş Kapsamı</h2>
        <p className="mt-1 text-sm text-slate-500">Ürün, miktar ve toplam tutar bilgisini operasyon standardına uygun girin.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Ürün adı *</span>
            <input
              type="text"
              value={form.productName}
              onChange={(event) => setForm((prev) => ({ ...prev, productName: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Örn: Kartvizit"
            />
            {errors.productName && <span className="mt-1 block text-xs text-rose-600">{errors.productName}</span>}
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Miktar *</span>
            <input
              type="number"
              min={1}
              step={1}
              value={form.quantity}
              onChange={(event) => setForm((prev) => ({ ...prev, quantity: Number.parseInt(event.target.value, 10) || 0 }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            {errors.quantity && <span className="mt-1 block text-xs text-rose-600">{errors.quantity}</span>}
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Toplam tutar ({form.currency})</span>
            <input
              type="text"
              inputMode="decimal"
              value={rawTotalAmount}
              onChange={(event) => setRawTotalAmount(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Örn: 33.329,97"
            />
            {errors.totalAmount && <span className="mt-1 block text-xs text-rose-600">{errors.totalAmount}</span>}
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Teslimat tarihi</span>
            <input
              type="date"
              min={todayISO}
              value={form.deliveryDate || ''}
              onChange={(event) => setForm((prev) => ({ ...prev, deliveryDate: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Para birimi</span>
            <select
              value={form.currency}
              onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value as Currency }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>

          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Operasyon notları</span>
            <textarea
              rows={3}
              value={form.notes || ''}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Üretim veya sevkiyat için gerekli notlar"
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
              onChange={(event) => {
                addFiles(event.target.files);
                event.currentTarget.value = '';
              }}
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
                  onClick={() => {
                    setFiles((prev) => prev.filter((item) => item.id !== entry.id));
                    setFileError(null);
                  }}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/10"
                  aria-label="Dosyayi kaldir"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Henüz belge yüklenmedi.</p>
        )}

        {fileError ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{fileError}</p> : null}
      </section>

      <section className="rf-panel rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sipariş Özeti</h2>
        <div className="mt-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50">
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>Miktar</span>
            <span>{form.quantity} adet</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Genel toplam</span>
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(summaryAmountValue, form.currency)}</span>
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
