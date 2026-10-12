'use client';
import { prepareBrowserFile, type UploadedFileReference } from '@/lib/storage/client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { AwningDialog } from '@/components/features/awning/AwningConfigurator';
import { applyAwning } from '@/lib/features/awning/configuration';

import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { type Currency, type NewOrderFormData, type NewOrderItemData } from '@/lib/types';
import { ColorChip } from '@/components/colors/ColorSwatch';
import { businessDate } from '@/lib/features/orders/workspace';
import {
  ORDER_FORM_ALLOWED_FILE_TYPES,
  ORDER_MAX_UPLOAD_COUNT,
  ORDER_MAX_UPLOAD_SIZE_BYTES,
} from '@/lib/features/orders/constants';

interface NewOrderFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  initialData?: NewOrderFormData;
  submitError?: string;
}

type FieldErrors = Partial<Record<'customerName' | 'productName' | 'quantity' | 'totalAmount' | string, string>>;

type UploadEntry = {
  id: string;
  file: File;
};

const ALLOWED_UPLOAD_TYPES: ReadonlySet<string> = new Set(ORDER_FORM_ALLOWED_FILE_TYPES);

function initialItems(data?: NewOrderFormData): NewOrderItemData[] {
  if (data?.items?.length) return data.items;
  const quantity = data?.quantity || 1;
  const totalPrice = data?.totalAmount || 0;
  return [{ productName: data?.productName || '', quantity, unitPrice: totalPrice / quantity, totalPrice }];
}

type CustomerMatch = { id: string; full_name: string; company_name?: string | null; email?: string | null; phone?: string | null };

export function NewOrderForm({ onSubmit, initialData, submitError }: NewOrderFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([]);

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

  useEffect(() => {
    const query = form.customerName.trim();
    if (form.customerId || query.length < 2) { setCustomerMatches([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/v1/customers?suggest=1&search=' + encodeURIComponent(query), { signal: controller.signal, cache: 'no-store' });
        const body = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) setCustomerMatches(Array.isArray(body?.customers) ? body.customers : []);
      } catch {
        if (!controller.signal.aborted) setCustomerMatches([]);
      }
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [form.customerName, form.customerId]);

  const [rawTotalAmount, setRawTotalAmount] = useState(String(initialData?.totalAmount ?? '0'));
  const [items, setItems] = useState<NewOrderItemData[]>(() => initialItems(initialData));

  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({ ...prev, ...initialData }));
      if (initialData.totalAmount !== undefined) {
        setRawTotalAmount(String(initialData.totalAmount));
      }
      setItems(initialItems(initialData));
    }
  }, [initialData]);

  const [files, setFiles] = useState<UploadEntry[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayISO = businessDate();

  // Calculate total amount from items if items exist
  const calculatedTotal = useMemo(() => {
    if (items.length === 0) return Number.parseFloat(rawTotalAmount.replace(',', '.')) || 0;
    return items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  }, [items, rawTotalAmount]);

  const calculatedQuantity = useMemo(() => {
    if (items.length === 0) return form.quantity;
    return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [items, form.quantity]);

  const validate = (): boolean => {
    const nextErrors: FieldErrors = {};

    if (!form.customerName.trim()) {
      nextErrors.customerName = 'Müşteri adı zorunlu alandır.';
    }

    if (items.length === 0 && !form.productName.trim()) {
      nextErrors.productName = 'Ürün adı zorunlu alandır.';
    }

    if (!Number.isFinite(calculatedTotal) || calculatedTotal < 0) {
      nextErrors.totalAmount = 'Geçerli bir sipariş tutarı girin.';
    }

    items.forEach((item, idx) => {
      if (!item.productName.trim()) {
        nextErrors[`items.${idx}.productName`] = 'Kalem adı zorunlu.';
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) nextErrors[`items.${idx}.quantity`] = 'Adet, sıfırdan büyük tam sayı olmalı.';
      if (item.unitPrice !== undefined && (!Number.isFinite(item.unitPrice) || item.unitPrice < 0)) nextErrors[`items.${idx}.unitPrice`] = 'Birim fiyat negatif olamaz.';
      for (const field of ['widthMm', 'heightMm'] as const) {
        if (item[field] !== undefined && (!Number.isFinite(item[field]) || item[field]! <= 0)) nextErrors[`items.${idx}.${field}`] = 'Ölçü, sıfırdan büyük olmalı.';
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
      if (form.customerId) payload.append('customerId', form.customerId);
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

      const uploaded: UploadedFileReference[] = [];
      for (const entry of files) {
        const prepared = await prepareBrowserFile(entry.file);
        if (prepared instanceof File) payload.append('files', prepared);
        else uploaded.push(prepared);
      }
      if (uploaded.length) payload.append('uploadedFiles', JSON.stringify(uploaded));

      await onSubmit(payload);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Dosya yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addFiles = (inputFiles: FileList | null) => {
    if (!inputFiles || inputFiles.length === 0) return;
    const selected = Array.from(inputFiles);
    const nextErrors: string[] = [];

      const existingKeys = new Set(files.map((entry) => `${entry.file.name}-${entry.file.size}-${entry.file.lastModified}`));
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

      const merged = [...files, ...accepted];
      if (merged.length > ORDER_MAX_UPLOAD_COUNT) {
        nextErrors.push(`En fazla ${ORDER_MAX_UPLOAD_COUNT} dosya yukleyebilirsiniz.`);
      }

      setFiles(merged.slice(0, ORDER_MAX_UPLOAD_COUNT));

    setFileError(nextErrors.length > 0 ? nextErrors[0] : null);
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { productName: '', quantity: 1, unitPrice: 0, totalPrice: 0 },
    ]);
  };

  const updateItem = (index: number, field: keyof NewOrderItemData, value: string | number | undefined) => {
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
    setItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isSubmitting}>
      <section className="rf-panel p-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">1. Müşteri ve proje</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Müşteri / firma adı *</span>
            <input
              type="text"
              value={form.customerName}
              required
              placeholder="Firma veya müşteri adı"
              autoComplete="organization"
              onChange={(e) => setForm((prev) => ({ ...prev, customerId: undefined, customerName: e.target.value }))}
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
            />
            {errors.customerName && <span className="mt-1 block text-xs text-rose-600">{errors.customerName}</span>}
          </label>
            {form.customerId ? (
              <span className="mt-1 block text-xs text-slate-500">Kayıtlı müşteri kartına bağlanacak.</span>
            ) : customerMatches.length > 0 ? (
              <ul aria-label="Kayıtlı müşteriler" className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                {customerMatches.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      onClick={() => {
                        // Keep the firm name when the typed text matched the card's company.
                        const typed = form.customerName.trim().toLocaleLowerCase('tr-TR');
                        const name = customer.company_name && customer.company_name.toLocaleLowerCase('tr-TR').includes(typed) ? customer.company_name : customer.full_name;
                        setForm((prev) => ({ ...prev, customerId: customer.id, customerName: name, email: customer.email || prev.email, phone: customer.phone || prev.phone }));
                        setCustomerMatches([]);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none dark:hover:bg-slate-800 dark:focus:bg-slate-800"
                    >
                      {customer.full_name}
                      <span className="text-xs text-slate-500">{[customer.company_name, customer.phone, customer.email].filter(Boolean).map((v) => ' · ' + v).join('')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : form.customerName.trim().length >= 2 ? (
              <span className="mt-1 block text-xs text-slate-500">Aynı ad, e-posta veya telefonla kayıtlı müşteri varsa ona bağlanır; yoksa yeni müşteri kartı açılır.</span>
            ) : null}
          </div>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">E-posta</span>
            <input
              type="email"
              value={form.email || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Telefon</span>
            <input
              type="text"
              value={form.phone || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </div>
      </section>

      <section className="rf-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">2. Ürün ve teknik ölçüler</h2>
            <p className="mt-1 text-sm text-slate-500">Her farklı ürün, ölçü ve renk için ayrı kalem ekleyin. Ölçüler mm cinsindedir.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addItem} className="gap-2">
            <Plus size={14} /> Kalem ekle
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-100 dark:border-slate-800">
            <label className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Ürün adı (Tekli Sipariş) *</span>
              <input
                type="text"
                value={form.productName}
                onChange={(e) => setForm((prev) => ({ ...prev, productName: e.target.value }))}
                className="w-full rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
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
                className="w-full rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Toplam tutar ({form.currency})</span>
              <input
                type="text"
                inputMode="decimal"
                value={rawTotalAmount}
                onChange={(e) => setRawTotalAmount(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-200 dark:border-slate-800 relative group">
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  aria-label={`${idx + 1}. kalemi sil`}
                  className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <Trash2 size={16} />
                </button>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pr-8">
                  <label className="md:col-span-2">
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">Ürün / sistem *</span>
                    <input
                      type="text"
                      value={item.productName}
                      required
                      placeholder="Örn: Alüminyum sürme doğrama"
                      onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
                    />
                    {errors[`items.${idx}.productName`] && <span className="mt-1 block text-xs text-rose-600">{errors[`items.${idx}.productName`]}</span>}
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">Genişlik (mm)</span>
                    <input
                      type="number"
                      min={1}
                      step="any"
                      placeholder="2400"
                      disabled={Boolean(item.awningConfiguration)}
                      value={item.widthMm ?? ''}
                      onChange={(e) => updateItem(idx, 'widthMm', e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">Ürün yüksekliği (mm)</span>
                    <input
                      type="number"
                      min={1}
                      step="any"
                      placeholder="2100"
                      value={item.heightMm ?? ''}
                      onChange={(e) => updateItem(idx, 'heightMm', e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">RAL renk / yüzey</span>
                    <input
                      type="text"
                      disabled={Boolean(item.awningConfiguration)}
                      value={item.color || ''}
                      placeholder="RAL 7016 Mat"
                      onChange={(e) => updateItem(idx, 'color', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
                    />
                    {item.color?.trim() && <ColorChip color={item.color} size={16} showName className="mt-1.5 text-xs" />}
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">Adet *</span>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      required
                      onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">Birim fiyat ({form.currency})</span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0,00"
                      value={item.unitPrice || ''}
                      onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">Toplam</span>
                    <div className="px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {formatCurrency(item.totalPrice || 0, form.currency)}
                    </div>
                  </label>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-500">Profil kodu / seri ve kalem notu</span>
                  <input value={item.notes || ''} onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                    placeholder="Örn: 40×40 profil · bağlantı ve aksesuar detayları"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900" />
                </label>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <AwningDialog configuration={item.awningConfiguration} previewImage={item.awningPreview} onApply={(c,image)=>setItems(prev=>prev.map((entry,i)=>i===idx?applyAwning({...entry,productName:entry.productName||'WINMAX Makaslı Tente'},c,image):entry))}/>
                  {item.awningConfiguration && <span className="text-xs text-muted-foreground">Açılım: {item.awningConfiguration.projectionMm} mm · Montaj: {item.awningConfiguration.mountingHeightMm} mm</span>}
                </div>
                {Object.entries(errors).filter(([key]) => key.startsWith(`items.${idx}.`) && !key.endsWith('productName')).map(([key, message]) => <p key={key} role="alert" className="mt-1 text-xs text-rose-600">{message}</p>)}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Termin tarihi</span>
            <input
              type="date"
              min={todayISO}
              value={form.deliveryDate || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, deliveryDate: e.target.value }))}
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Para birimi</span>
            <select
              value={form.currency}
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value as Currency }))}
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Üretim ve montaj notları</span>
            <textarea
              rows={3}
              placeholder="Kesim, işleme, aksesuar, montaj veya sevkiyat talimatları…"
              value={form.notes || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </div>
      </section>

      <section className="rf-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">3. Teknik belgeler</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2"><Plus size={14} />Dosya ekle</Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              aria-label="Teknik belge seç"
              accept="image/*,.pdf"
              onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ''; }}
            />
        </div>
        {files.length > 0 ? (
          <div className="mt-4 space-y-2">
            {files.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText size={16} className="text-slate-500" />
                  <span className="truncate text-sm text-slate-700 dark:text-slate-200">{entry.file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((item) => item.id !== entry.id))}
                  aria-label={`${entry.file.name} dosyasını kaldır`}
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
        <p className="mt-3 text-xs text-muted-foreground">PDF, JPG, PNG veya WebP · Dosya başına 10 MB · En fazla {ORDER_MAX_UPLOAD_COUNT} belge</p>
        {fileError && <p role="alert" className="mt-2 text-xs text-amber-700 dark:text-amber-400">{fileError}</p>}
      </section>

      <section className="rf-panel p-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sipariş özeti</h2>
        <div className="mt-3 rounded-md bg-slate-50 p-4 dark:bg-slate-900/50">
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>Toplam miktar</span>
            <span>{calculatedQuantity} adet</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Genel toplam</span>
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(calculatedTotal, form.currency)}</span>
          </div>
        </div>
      </section>

      {submitError && <p role="alert" className="rf-alert text-sm">{submitError} Girdiğiniz bilgiler korunuyor.</p>}
      {Object.keys(errors).length > 0 && <p role="alert" className="rf-alert text-sm">Kaydetmeden önce işaretlenen alanları kontrol edin.</p>}
      <div className="sticky bottom-20 z-20 flex items-center justify-end gap-3 rounded-lg border border-border bg-card p-3 sm:p-4 md:bottom-4">
        <span className="mr-auto hidden text-xs text-muted-foreground sm:block">{items.length} kalem · <span className="font-medium tabular-nums text-foreground">{calculatedQuantity} adet</span></span>
        <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => router.back()}>
          Vazgeç
        </Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting} loadingText="Sipariş kaydediliyor...">
          Siparişi kaydet
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Siparişi kaydetmek stoktan düşüm yapmaz. Malzeme üretim emrinde rezerve edilir; gerçek tüketim üretim tamamlandığında işlenir.</p>
    </form>
  );
}
