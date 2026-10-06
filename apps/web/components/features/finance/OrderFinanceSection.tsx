'use client';
import { prepareBrowserFile } from '@/lib/storage/client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { canAccessFinance, hasPermission, type UserRole } from '@/lib/auth/permissions';
import { formatCurrency } from '@/lib/utils';
import { safeParseCurrency } from '@/lib/types';
import {
  CreditCard,
  FileText,
  Plus,
  Trash2,
  Upload,
  ExternalLink,
  Check,
} from 'lucide-react';

import {
  listPaymentsByOrder,
  createPayment,
  deletePayment,
} from '@/app/actions/finance.payments.actions';
import {
  listOrderDocuments,
  uploadOrderDocument,
  deleteOrderDocument,
} from '@/app/actions/finance.documents.actions';
import {
  Payment,
  OrderDocument,
  PaymentMethod,
  OrderDocumentType,
  PAYMENT_METHOD_LABELS,
  DOCUMENT_TYPE_LABELS,
} from '@/lib/types/finance';
import { CutLoader } from '@/components/brand/CutLoader';

interface OrderFinanceSectionProps {
  orderId: string;
  orderTotal: number;
  currency: string;
}

const MAX_FINANCE_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_FINANCE_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const ALLOWED_FINANCE_DOCUMENT_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp']);

const PAYMENT_METHOD_OPTIONS: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: PAYMENT_METHOD_LABELS.cash },
  { value: 'bank_transfer', label: PAYMENT_METHOD_LABELS.bank_transfer },
  { value: 'credit_card', label: PAYMENT_METHOD_LABELS.credit_card },
  { value: 'check', label: PAYMENT_METHOD_LABELS.check },
  { value: 'other', label: PAYMENT_METHOD_LABELS.other },
];

const DOCUMENT_TYPE_OPTIONS: ReadonlyArray<{ value: OrderDocumentType; label: string }> = [
  { value: 'invoice', label: DOCUMENT_TYPE_LABELS.invoice },
  { value: 'delivery_note', label: DOCUMENT_TYPE_LABELS.delivery_note },
  { value: 'receipt', label: DOCUMENT_TYPE_LABELS.receipt },
  { value: 'contract', label: DOCUMENT_TYPE_LABELS.contract },
  { value: 'other', label: DOCUMENT_TYPE_LABELS.other },
];

function parseLocalizedAmount(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');

  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatBytes(sizeBytes?: number | null): string {
  if (!sizeBytes || sizeBytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(sizeBytes) / Math.log(1024)), units.length - 1);
  const value = sizeBytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function getDocumentViewerUrl(documentId: string): string {
  return `/api/orders/documents/${encodeURIComponent(documentId)}/content`;
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHOD_OPTIONS.some((option) => option.value === value);
}

function isOrderDocumentType(value: string): value is OrderDocumentType {
  return DOCUMENT_TYPE_OPTIONS.some((option) => option.value === value);
}

function isAllowedDocument(file: File): boolean {
  if (file.type && ALLOWED_FINANCE_DOCUMENT_MIME_TYPES.has(file.type)) {
    return true;
  }
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension) return false;
  return ALLOWED_FINANCE_DOCUMENT_EXTENSIONS.has(extension);
}

export function OrderFinanceSection({ orderId, orderTotal, currency }: OrderFinanceSectionProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  
  // Payment form state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [paymentNote, setPaymentNote] = useState('');
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const paymentKey = useRef<{ hash: string; id: string; paidAt: string } | null>(null);
  const paymentLock = useRef(false);
  
  // Document upload state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [docType, setDocType] = useState<OrderDocumentType>('invoice');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const role = user?.role as UserRole | undefined;
  const hasFinanceAccess = Boolean(role && canAccessFinance(role));

  const canCreatePayment = Boolean(role && hasPermission(role, 'finance.payments.create'));
  const canDeletePayment = Boolean(role && hasPermission(role, 'finance.payments.delete'));
  const canUploadDoc = Boolean(role && hasPermission(role, 'finance.documents.upload'));
  const canDeleteDoc = Boolean(role && hasPermission(role, 'finance.documents.delete'));

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [paymentsData, docsData] = await Promise.all([
        listPaymentsByOrder(orderId),
        listOrderDocuments(orderId),
      ]);
      setPayments(paymentsData);
      setDocuments(docsData);
    } catch (error) {
      console.error('Error loading finance data:', error);
      showToast('Finans verileri yüklenirken hata oluştu', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [orderId, showToast]);

  useEffect(() => {
    if (!hasFinanceAccess) {
      setIsLoading(false);
      return;
    }
    void loadData();
  }, [hasFinanceAccess, loadData]);

  const handleAddPayment = async () => {
    if (paymentLock.current) return;
    const amount = parseLocalizedAmount(paymentAmount);
    if (amount === null || amount <= 0) {
      showToast('Geçerli bir tutar girin', 'error');
      return;
    }

    try {
      paymentLock.current = true;
      const hash = JSON.stringify({ orderId, amount, currency, method: paymentMethod, note: paymentNote });
      if (paymentKey.current?.hash !== hash) paymentKey.current = { hash, id: crypto.randomUUID(), paidAt: new Date().toISOString() };
      setIsAddingPayment(true);
      const newPayment = await createPayment({
        commandId: paymentKey.current.id,
        paidAt: paymentKey.current.paidAt,
        orderId,
        amount,
        currency: safeParseCurrency(currency),
        method: paymentMethod,
        note: paymentNote.trim() || undefined,
      });
      setPayments(prev => [newPayment, ...prev]);
      paymentKey.current = null;
      setShowPaymentForm(false);
      setPaymentAmount('');
      setPaymentMethod('bank_transfer');
      setPaymentNote('');
      showToast('Ödeme kaydedildi', 'success');
    } catch (error) {
      console.error('Error adding payment:', error);
      showToast(error instanceof Error ? error.message : 'Ödeme eklenirken hata oluştu', 'error');
    } finally {
      paymentLock.current = false;
      setIsAddingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Bu ödemeyi silmek istediğinizden emin misiniz?')) return;

    try {
      setDeletingPaymentId(paymentId);
      await deletePayment(paymentId);
      setPayments(prev => prev.filter(p => p.id !== paymentId));
      showToast('Ödeme silindi', 'success');
    } catch (error) {
      console.error('Error deleting payment:', error);
      showToast('Ödeme silinirken hata oluştu', 'error');
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedFile) {
      showToast('Dosya seçin', 'error');
      return;
    }

    if (selectedFile.size > MAX_FINANCE_DOCUMENT_SIZE_BYTES) {
      showToast('Belge boyutu 10MB sınırını aşıyor.', 'error');
      return;
    }

    if (!isAllowedDocument(selectedFile)) {
      showToast('Sadece PDF, PNG, JPG veya WEBP dosyası yüklenebilir.', 'error');
      return;
    }

    try {
      setIsUploading(true);
      const newDoc = await uploadOrderDocument(orderId, docType, await prepareBrowserFile(selectedFile, "finance"));
      setDocuments(prev => [newDoc, ...prev]);
      setShowUploadForm(false);
      setSelectedFile(null);
      showToast('Belge yüklendi', 'success');
    } catch (error) {
      console.error('Error uploading document:', error);
      showToast('Belge yüklenirken hata oluştu', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Bu belgeyi silmek istediğinizden emin misiniz?')) return;

    try {
      setDeletingDocId(docId);
      await deleteOrderDocument(docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      showToast('Belge silindi', 'success');
    } catch (error) {
      console.error('Error deleting document:', error);
      showToast('Belge silinirken hata oluştu', 'error');
    } finally {
      setDeletingDocId(null);
    }
  };

  if (!hasFinanceAccess) {
    return null;
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = orderTotal - totalPaid;
  const isPaid = remaining <= 0;
  const selectedFileSizeLabel = formatBytes(selectedFile?.size ?? null);

  return (
    <div className="space-y-6">
      {/* Payment Summary */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
        <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <CreditCard size={20} className="text-blue-600" />
          Ödeme Durumu
        </h3>
        
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
            <p className="text-xs text-slate-500 mb-1">Toplam</p>
            <p className="font-bold text-slate-900 dark:text-white">
              {formatCurrency(orderTotal, currency)}
            </p>
          </div>
          <div className="text-center p-3 rounded-xl bg-green-50 dark:bg-green-900/20">
            <p className="text-xs text-slate-500 mb-1">Ödenen</p>
            <p className="font-bold text-green-600">
              {formatCurrency(totalPaid, currency)}
            </p>
          </div>
          <div className={`text-center p-3 rounded-xl ${isPaid ? 'bg-green-50 dark:bg-green-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
            <p className="text-xs text-slate-500 mb-1">Kalan</p>
            <p className={`font-bold ${isPaid ? 'text-green-600' : 'text-orange-600'}`}>
              {isPaid ? (
                <span className="flex items-center justify-center gap-1">
                  <Check size={16} /> Tamamlandı
                </span>
              ) : (
                formatCurrency(remaining, currency)
              )}
            </p>
          </div>
        </div>

        {/* Payment List */}
        {isLoading ? (
          <CutLoader variant="inline" />
        ) : payments.length > 0 ? (
          <div className="space-y-2 mb-4">
            {payments.map(payment => (
              <div 
                key={payment.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {PAYMENT_METHOD_LABELS[payment.method]}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(payment.paidAt).toLocaleDateString('tr-TR')}
                      {payment.note && ` • ${payment.note}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-green-600">
                    +{formatCurrency(payment.amount, payment.currency)}
                  </span>
                  {canDeletePayment && (
                    <button
                      onClick={() => handleDeletePayment(payment.id)}
                      disabled={deletingPaymentId === payment.id}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      {deletingPaymentId === payment.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">Henüz ödeme kaydı yok</p>
        )}

        {/* Add Payment Form */}
        {canCreatePayment && (
          showPaymentForm ? (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Tutar (örn: 12.450,75)"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={paymentMethod}
                  onChange={(event) => {
                    const nextMethod = event.target.value;
                    if (isPaymentMethod(nextMethod)) {
                      setPaymentMethod(nextMethod);
                    }
                  }}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                placeholder="Not (isteğe bağlı)"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPaymentForm(false)}
                  className="flex-1 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleAddPayment}
                  disabled={isAddingPayment}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {isAddingPayment ? 'Ekleniyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPaymentForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
            >
              <Plus size={16} />
              Ödeme Ekle
            </button>
          )
        )}
      </div>

      {/* Documents Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
        <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <FileText size={20} className="text-green-600" />
          Finansal Belgeler
        </h3>

        {isLoading ? (
          <CutLoader variant="inline" />
        ) : documents.length > 0 ? (
          <div className="space-y-2 mb-4">
            {documents.map(doc => (
              <div 
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                    <FileText size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                      {doc.fileName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {DOCUMENT_TYPE_LABELS[doc.type]}
                      {doc.sizeBytes ? ` • ${formatBytes(doc.sizeBytes)}` : ''}
                      {' • '}
                      {new Date(doc.uploadedAt).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={getDocumentViewerUrl(doc.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    title="Belgeyi yeni sekmede aç"
                  >
                    <ExternalLink size={14} />
                  </a>
                  {canDeleteDoc && (
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      disabled={deletingDocId === doc.id}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      {deletingDocId === doc.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">Henüz belge yüklenmemiş</p>
        )}

        {/* Upload Document Form */}
        {canUploadDoc && (
          showUploadForm ? (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
              <select
                value={docType}
                onChange={(event) => {
                  const nextType = event.target.value;
                  if (isOrderDocumentType(nextType)) {
                    setDocType(nextType);
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {selectedFile ? (
                <p className="text-xs text-slate-500">
                  {selectedFile.name}
                  {selectedFileSizeLabel ? ` • ${selectedFileSizeLabel}` : ''}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowUploadForm(false);
                    setSelectedFile(null);
                  }}
                  className="flex-1 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleUploadDocument}
                  disabled={isUploading || !selectedFile}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {isUploading ? 'Yükleniyor...' : 'Yükle'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowUploadForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
            >
              <Upload size={16} />
              Belge Yükle
            </button>
          )
        )}
      </div>
    </div>
  );
}
