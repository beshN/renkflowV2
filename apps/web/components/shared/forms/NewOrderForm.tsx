'use client';
import { prepareBrowserFile, type UploadedFileReference } from '@/lib/storage/client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { InlineProductEditor } from '@/components/features/product-3d/InlineProductEditor';
import { applyInlineVisualization } from '@/lib/features/product-3d/inline';
import { defaultVisualization, productMeta } from '@/lib/features/product-3d/catalog';
import { DEFAULT_AWNING } from '@/lib/features/awning/configuration';
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
  const [editorKeys, setEditorKeys] = useState(() => initialItems(initialData).map(() => crypto.randomUUID()));
  const invalid3d = useRef<Record<number, string>>({});
  const [items, setItems] = useState<NewOrderItemData[]>(() => initialItems(initialData));

  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({ ...prev, ...initialData }));
      if (initialData.totalAmount !== undefined) {
        setRawTotalAmount(String(initialData.totalAmount));
      }
      setItems(initialItems(initialData));
      setEditorKeys(initialItems(initialData).map(() => crypto.randomUUID()));
      invalid3d.current = {};
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
    items.forEach((_, index) => { if (invalid3d.current[index]) nextErrors[`items.${index}.configuration`] = invalid3d.current[index]; });

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
      for (const field of ['widthMm', 'heightMm', 'projectionMm'] as const) {
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
    setEditorKeys(prev => [...prev, crypto.randomUUID()]);
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
    setEditorKeys(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
    invalid3d.current = Object.fromEntries(Object.entries(invalid3d.current).filter(([i]) => Number(i) !== index).map(([i, message]) => [Number(i) > index ? Number(i) - 1 : Number(i), message]));
    setItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  };

  const input = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-60';
  const label = 'mb-1 block text-xs font-medium text-muted-foreground';
  const more = 'group rounded-md border border-border/70 px-3 py-2 [&_summary::-webkit-details-marker]:hidden';
  const moreSummary = 'cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground';

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isSubmitting}>
      <section className="rf-panel space-y-3 p-4 sm:p-5">
        <label className="block">
          <span className={label}>Müşteri / firma adı *</span>
          <input
            type="text"
            value={form.customerName}
            required
            placeholder="Yazmaya başlayın; kayıtlı müşteri önerilir"
            autoComplete="organization"
            onChange={(e) => setForm((prev) => ({ ...prev, customerId: undefined, customerName: e.target.value }))}
            className={input}
          />
          {errors.customerName && <span className="mt-1 block text-xs text-rose-600">{errors.customerName}</span>}
        </label>
        {form.customerId ? (
          <span className="block text-xs text-emerald-700 dark:text-emerald-400">Kayıtlı müşteri kartına bağlanacak.</span>
        ) : customerMatches.length > 0 ? (
          <ul aria-label="Kayıtlı müşteriler" className="divide-y divide-border rounded-md border border-border">
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
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                >
                  {customer.full_name}
                  <span className="text-xs text-muted-foreground">{[customer.company_name, customer.phone].filter(Boolean).map((v) => ' · ' + v).join('')}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <details className={more}>
          <summary className={moreSummary}>Telefon ve e-posta (isteğe bağlı){form.phone ? ` · ${form.phone}` : ''}</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label><span className={label}>Telefon</span><input type="tel" value={form.phone || ''} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} className={input} /></label>
            <label><span className={label}>E-posta</span><input type="email" value={form.email || ''} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} className={input} /></label>
          </div>
        </details>
      </section>

      <section className="rf-panel space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Ürünler <span className="font-normal text-muted-foreground">· ölçüler mm</span></h2>
          <Button type="button" variant="secondary" size="sm" onClick={addItem} className="gap-2">
            <Plus size={14} /> Kalem Ekle
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="sm:col-span-2">
              <span className={label}>Ürün adı (Tekli Sipariş) *</span>
              <input type="text" value={form.productName} onChange={(e) => setForm((prev) => ({ ...prev, productName: e.target.value }))} className={input} />
              {errors.productName && <span className="mt-1 block text-xs text-rose-600">{errors.productName}</span>}
            </label>
            <label><span className={label}>Miktar *</span><input type="number" min={1} value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number.parseInt(e.target.value, 10) || 0 }))} className={input} /></label>
            <label><span className={label}>Toplam tutar ({form.currency})</span><input type="text" inputMode="decimal" value={rawTotalAmount} onChange={(e) => setRawTotalAmount(e.target.value)} className={input} /></label>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={editorKeys[idx]} className="relative rounded-md border border-border bg-muted/30 p-3">
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} aria-label={`${idx + 1}. kalemi sil`} className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-rose-600">
                    <Trash2 size={15} />
                  </button>
                )}
                <div className="grid grid-cols-2 gap-3 pr-6 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
                  <label className="col-span-2 sm:col-span-1">
                    <span className={label}>Ürün / sistem *</span>
                    <input type="text" value={item.productName} required placeholder="Örn: Makaslı pergola" onChange={(e) => updateItem(idx, 'productName', e.target.value)} className={input} />
                    {errors[`items.${idx}.productName`] && <span className="mt-1 block text-xs text-rose-600">{errors[`items.${idx}.productName`]}</span>}
                  </label>
                  <label>
                    <span className={label}>Genişlik (mm)</span>
                    <input type="number" min={1} step="any" inputMode="numeric" placeholder="4000" disabled={Boolean(item.awningConfiguration || item.productVisualization)} value={item.widthMm ?? ''} onChange={(e) => updateItem(idx, 'widthMm', e.target.value ? Number(e.target.value) : undefined)} className={input} />
                  </label>
                  <label>
                    <span className={label}>Açılım (mm)</span>
                    <input type="number" min={1} step="any" inputMode="numeric" placeholder="3500" disabled={Boolean(item.awningConfiguration || item.productVisualization)} value={item.projectionMm ?? ''} onChange={(e) => updateItem(idx, 'projectionMm', e.target.value ? Number(e.target.value) : undefined)} className={input} />
                  </label>
                  <label>
                    <span className={label}>Adet *</span>
                    <input type="number" min={1} inputMode="numeric" value={item.quantity} required onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)} className={input} />
                  </label>
                </div>
                <details className={`${more} mt-3 bg-background`} open={Boolean(item.color || item.heightMm || item.unitPrice || item.notes)}>
                  <summary className={moreSummary}>Renk, yükseklik, fiyat ve not{item.color ? ` · ${item.color}` : ''}{item.totalPrice ? ` · ${formatCurrency(item.totalPrice, form.currency)}` : ''}</summary>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <label className="col-span-2 sm:col-span-1">
                      <span className={label}>RAL renk / yüzey</span>
                      <input type="text" disabled={Boolean(item.awningConfiguration || item.productVisualization)} value={item.color || ''} placeholder="RAL 7016 Mat" onChange={(e) => updateItem(idx, 'color', e.target.value)} className={input} />
                      {item.color?.trim() && <ColorChip color={item.color} size={16} showName className="mt-1.5 text-xs" />}
                    </label>
                    <label>
                      <span className={label}>Ürün yüksekliği (mm)</span>
                      <input type="number" min={1} step="any" placeholder="2500" disabled={Boolean(item.productVisualization)} value={item.heightMm ?? ''} onChange={(e) => updateItem(idx, 'heightMm', e.target.value ? Number(e.target.value) : undefined)} className={input} />
                    </label>
                    <label>
                      <span className={label}>Birim fiyat ({form.currency})</span>
                      <input type="number" step="0.01" min={0} placeholder="0,00" value={item.unitPrice || ''} onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className={input} />
                    </label>
                    <div>
                      <span className={label}>Toplam</span>
                      <div className="py-2 text-sm font-semibold tabular-nums">{formatCurrency(item.totalPrice || 0, form.currency)}</div>
                    </div>
                    <label className="col-span-2 sm:col-span-4">
                      <span className={label}>Kalem notu</span>
                      <input value={item.notes || ''} onChange={(e) => updateItem(idx, 'notes', e.target.value)} placeholder="Profil serisi, aksesuar…" className={input} />
                    </label>
                  </div>
                </details>
                <div className="mt-3">
                  <InlineProductEditor
                    label={`Kalem ${idx + 1} ürün seçimi`}
                    productName={item.productName} visualization={item.productVisualization}
                    awningConfiguration={item.awningConfiguration} previewImage={item.awningPreview}
                    onValidationChange={message => { invalid3d.current[idx] = message; }}
                    onSelect={kind => {
                      invalid3d.current[idx] = '';
                      setItems(prev => prev.map((entry, i) => {
                        if (i !== idx) return entry;
                        const plain = { ...entry, awningConfiguration: undefined, awningPreview: undefined, productVisualization: undefined };
                        if (!kind) return { ...plain, productName: '', widthMm: undefined, heightMm: undefined, projectionMm: undefined, mountingHeightMm: undefined, color: undefined };
                        if (kind === 'makasli') return applyAwning({ ...plain, productName: 'WINMAX Makaslı Tente' }, DEFAULT_AWNING);
                        return applyInlineVisualization({ ...plain, productName: productMeta(kind).name }, { configuration: defaultVisualization(kind) });
                      }));
                    }}
                    onChange={v => setItems(prev => prev.map((entry, i) => i === idx ? applyInlineVisualization(entry, v) : entry))}
                    onChangeAwning={(c, image) => setItems(prev => prev.map((entry, i) => i === idx ? applyAwning({ ...entry, productVisualization: undefined, awningPreview: undefined }, c, image) : entry))}
                  />
                </div>
                {Object.entries(errors).filter(([key]) => key.startsWith(`items.${idx}.`) && !key.endsWith('productName')).map(([key, message]) => <p key={key} role="alert" className="mt-1 text-xs text-rose-600">{message}</p>)}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span className={label}>Termin tarihi</span>
            <input type="date" min={todayISO} value={form.deliveryDate || ''} onChange={(e) => setForm((prev) => ({ ...prev, deliveryDate: e.target.value }))} className={input} />
          </label>
        </div>

        <details className={more} open={Boolean(form.notes || files.length || (form.currency && form.currency !== 'TRY'))}>
          <summary className={moreSummary}>Not, belge ve para birimi{files.length ? ` · ${files.length} belge` : ''}{form.currency && form.currency !== 'TRY' ? ` · ${form.currency}` : ''}</summary>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className={label}>Üretim ve montaj notları</span>
              <textarea rows={2} placeholder="Kesim, aksesuar, montaj ya da sevkiyat notu" value={form.notes || ''} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} className={input} />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <label className="w-32">
                <span className={label}>Para birimi</span>
                <select value={form.currency} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value as Currency }))} className={input}>
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </label>
              <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2"><Plus size={14} />Belge ekle</Button>
              <input ref={fileInputRef} type="file" multiple className="hidden" aria-label="Teknik belge seç" accept="image/*,.pdf" onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ''; }} />
              <span className="text-[11px] text-muted-foreground">PDF/fotoğraf · en çok {ORDER_MAX_UPLOAD_COUNT}</span>
            </div>
            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5">
                    <span className="flex min-w-0 items-center gap-2"><FileText size={15} className="text-muted-foreground" /><span className="truncate text-sm">{entry.file.name}</span></span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((item) => item.id !== entry.id))} aria-label={`${entry.file.name} dosyasını kaldır`} className="rounded p-1 text-muted-foreground hover:text-rose-600"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
        {fileError && <p role="alert" className="text-xs text-amber-700 dark:text-amber-400">{fileError}</p>}
      </section>

      {submitError && <p role="alert" className="rf-alert text-sm">{submitError} Girdiğiniz bilgiler korunuyor.</p>}
      {Object.keys(errors).length > 0 && <p role="alert" className="rf-alert text-sm">Kaydetmeden önce işaretlenen alanları kontrol edin.</p>}
      <div className="sticky bottom-20 z-20 flex items-center justify-end gap-3 rounded-lg border border-border bg-card p-3 sm:p-4 md:bottom-4">
        <span className="mr-auto text-xs text-muted-foreground"><span className="font-medium tabular-nums text-foreground">{calculatedQuantity} adet</span>{calculatedTotal > 0 && <> · <span className="font-medium tabular-nums text-foreground">{formatCurrency(calculatedTotal, form.currency)}</span></>}</span>
        <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => router.back()}>
          Vazgeç
        </Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting} loadingText="Sipariş kaydediliyor...">
          Siparişi Kaydet
        </Button>
      </div>
    </form>
  );
}
