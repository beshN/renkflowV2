'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { requestJson } from '@/lib/shared/network';
import { Quotation, CreateQuotationInput } from '@/lib/features/quotations/types';
import { Navbar } from '@/components/layout/Navbar';
import { RFFormView } from '@/components/shared/views/RFFormView';
import { FileText, ArrowRight, Printer, AlertCircle, Save } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

type QuotationResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export default function QuotationDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  
  const isNew = params.id === 'new';
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [isFetching, setIsFetching] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [form, setForm] = useState<Partial<CreateQuotationInput>>({
    customerName: '',
    validUntil: '',
    currency: 'TRY',
    discountPercent: 0,
    notes: '',
    items: [],
  });

  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth/login');
  }, [isLoading, router, user]);

  useEffect(() => {
    if (user && !isNew) fetchQuotation();
  }, [user, isNew]);

  const fetchQuotation = async () => {
    setIsFetching(true);
    try {
      const res = await requestJson<QuotationResponse<Quotation>>(`/api/v1/quotations/${params.id}`);
      if (res.ok && res.data?.success) {
        const loadedQuotation = res.data.data;
        setQuotation(loadedQuotation);
        setForm({
          customerId: loadedQuotation.customerId ?? undefined,
          customerName: loadedQuotation.customerName,
          validUntil: loadedQuotation.validUntil ?? undefined,
          currency: loadedQuotation.currency,
          discountPercent: loadedQuotation.discountPercent,
          notes: loadedQuotation.notes ?? undefined,
          internalNotes: loadedQuotation.internalNotes ?? undefined,
          termsAndConditions: loadedQuotation.termsAndConditions ?? undefined,
          items: loadedQuotation.items,
        });
      } else {
        throw new Error(res.data?.message || res.error || 'Teklif alınamadı');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
      router.push('/quotations');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSave = async () => {
    if (!form.customerName) {
      showToast('Müşteri adı zorunludur', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (isNew) {
        const res = await requestJson<QuotationResponse<Quotation>>('/api/v1/quotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
        if (res.ok && res.data?.success) {
          showToast('Teklif oluşturuldu', 'success');
          router.push(`/quotations/${res.data.data.id}`);
        } else {
          throw new Error(res.data?.message || res.error || 'Kaydedilemedi');
        }
      } else {
        const res = await requestJson<QuotationResponse<Quotation>>(`/api/v1/quotations/${params.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
        if (res.ok && res.data?.success) {
          showToast('Teklif güncellendi', 'success');
          setQuotation(res.data.data);
        } else {
          throw new Error(res.data?.message || res.error || 'Kaydedilemedi');
        }
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConvertToOrder = async () => {
    if (!confirm('Bu teklifi siparişe dönüştürmek istediğinize emin misiniz?')) return;
    
    try {
      const res = await requestJson<QuotationResponse<{ orderId: string }>>(`/api/v1/quotations/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'convert' })
      });
      if (res.ok && res.data?.success) {
        showToast('Siparişe dönüştürüldü', 'success');
        router.push(`/orders/${res.data.data.orderId}`);
      } else {
        throw new Error(res.data?.message || res.error || 'Dönüştürülemedi');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  if (isLoading || !user) return null;
  if (isFetching) return <div className="p-8 text-center">Yükleniyor...</div>;

  const isEditable = isNew || quotation?.status === 'draft';

  const renderContent = () => {
    return (
      <div className="space-y-6">
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">Genel Bilgiler</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label>
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Müşteri Adı *</span>
              <input
                type="text"
                disabled={!isEditable}
                value={form.customerName || ''}
                onChange={e => setForm({...form, customerName: e.target.value})}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm disabled:opacity-50"
              />
            </label>
            <label>
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Geçerlilik Tarihi</span>
              <input
                type="date"
                disabled={!isEditable}
                value={form.validUntil || ''}
                onChange={e => setForm({...form, validUntil: e.target.value})}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm disabled:opacity-50"
              />
            </label>
            <label>
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Para Birimi</span>
              <select
                disabled={!isEditable}
                value={form.currency || 'TRY'}
                onChange={e => setForm({...form, currency: e.target.value as any})}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Teklif Kalemleri</h3>
            {isEditable && (
              <Button type="button" variant="secondary" size="sm" onClick={() => {
                setForm(prev => ({
                  ...prev,
                  items: [...(prev.items || []), { productName: '', quantity: 1, unitPrice: 0, discountPercent: 0, totalPrice: 0 }]
                }))
              }}>Satır Ekle</Button>
            )}
          </div>
          
          <div className="space-y-4">
            {form.items?.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-slate-50 dark:bg-slate-950/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800 relative">
                {isEditable && (
                  <button onClick={() => {
                    const newItems = [...(form.items || [])];
                    newItems.splice(idx, 1);
                    setForm({...form, items: newItems});
                  }} className="absolute top-2 right-2 text-rose-500 hover:text-rose-700">Sil</button>
                )}
                
                <label className="md:col-span-2">
                  <span className="block text-xs text-slate-500 mb-1">Ürün Adı</span>
                  <input type="text" disabled={!isEditable} value={item.productName}
                    onChange={e => {
                      const newItems = [...(form.items || [])];
                      newItems[idx].productName = e.target.value;
                      setForm({...form, items: newItems});
                    }}
                    className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50" />
                </label>
                <label>
                  <span className="block text-xs text-slate-500 mb-1">Miktar</span>
                  <input type="number" disabled={!isEditable} value={item.quantity}
                    onChange={e => {
                      const newItems = [...(form.items || [])];
                      newItems[idx].quantity = parseInt(e.target.value) || 0;
                      setForm({...form, items: newItems});
                    }}
                    className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50" />
                </label>
                <label>
                  <span className="block text-xs text-slate-500 mb-1">Birim Fiyat</span>
                  <input type="number" disabled={!isEditable} value={item.unitPrice}
                    onChange={e => {
                      const newItems = [...(form.items || [])];
                      newItems[idx].unitPrice = parseFloat(e.target.value) || 0;
                      setForm({...form, items: newItems});
                    }}
                    className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50" />
                </label>
                <div>
                  <span className="block text-xs text-slate-500 mb-1">Toplam</span>
                  <div className="font-semibold text-sm py-1">{formatCurrency(item.quantity * (item.unitPrice || 0), form.currency || 'TRY')}</div>
                </div>
              </div>
            ))}
            {form.items?.length === 0 && <p className="text-sm text-slate-500">Kalem eklenmemiş.</p>}
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Ara Toplam:</span>
                <span>{formatCurrency(form.items?.reduce((acc, it) => acc + (it.quantity * (it.unitPrice||0)), 0) || 0, form.currency || 'TRY')}</span>
              </div>
              {quotation && (
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Genel Toplam:</span>
                  <span>{formatCurrency(quotation.totalAmount, quotation.currency)}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {isEditable && (
          <div className="flex justify-end pt-4">
            <Button variant="primary" onClick={handleSave} isLoading={isSaving} icon={<Save className="w-4 h-4"/>}>
              Kaydet
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
      <Navbar title={isNew ? 'Yeni Teklif' : `Teklif: ${quotation?.quotationNumber}`} />
      <main className="w-full flex-1 p-4 md:p-8">
        <RFFormView
          title={isNew ? 'Yeni Teklif' : quotation?.quotationNumber || ''}
          subtitle={quotation?.customerName}
          icon={<FileText className="h-5 w-5 text-sky-500" />}
          breadcrumbs={[
            { label: 'Teklifler', href: '/quotations' },
            { label: isNew ? 'Yeni' : quotation?.quotationNumber || '' }
          ]}
          onBack={() => router.push('/quotations')}
          primaryAction={!isNew && quotation?.status !== 'converted' ? {
            label: "Siparişe Dönüştür",
            icon: <ArrowRight className="h-4 w-4" />,
            onClick: handleConvertToOrder
          } : undefined}
          secondaryActions={[
            {
              label: "Yazdır",
              icon: <Printer className="h-4 w-4" />,
              onClick: () => window.print(),
              hidden: isNew
            }
          ]}
          tabs={[
            { id: 'details', label: 'Teklif Detayı', content: renderContent() }
          ]}
        />
      </main>
    </div>
  );
}
