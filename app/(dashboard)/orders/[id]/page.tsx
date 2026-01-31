'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import { Navbar } from '@/components/layout/Navbar';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { NewOrderForm } from '@/components/forms/NewOrderForm';

import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { formatCurrency, formatDate, formatFileSize, getOrderStatusInfo } from '@/lib/utils';
import { Document } from '@/lib/types';
import { 
  ArrowLeft, Calendar, User, Package, CreditCard, 
  FileText, Clock, CheckCircle, Truck
} from 'lucide-react';

const PDFViewer = dynamic(() => import('@/components/pdf-viewer/PDFViewer'), {
  ssr: false,
  loading: () => <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600" />,
});

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { getOrderById, deleteOrder, updateOrder, updateOrderStatus, uploadDocuments, isLoading } = useOrders();
  const { user } = useAuth();
  const { showToast } = useToast();

  const order = getOrderById(orderId);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const canEditDelete = user?.role === 'admin' || user?.role === 'owner';

  const handleDeleteClick = () => setIsDeleteConfirmOpen(true);

  const handleInvoiceClick = () => {
    showToast('Fatura modülü yakında aktif olacak.', 'info');
  };

  const handleUploadClick = () => {
    if (!canEditDelete) {
      showToast('Belge yüklemek için yetkiniz yok.', 'error');
      return;
    }
    setIsEditModalOpen(true);
  };

  const handleDocumentOpen = (doc: Document) => {
    if (!doc.url) {
      showToast('Bu belge için geçerli bir bağlantı bulunamadı.', 'error');
      return;
    }
    const extension = doc.name.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') {
      setSelectedDocument(doc);
      return;
    }
    window.open(doc.url, '_blank', 'noopener,noreferrer');
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteOrder(order!.id);
      showToast('Sipariş silindi', 'success');
      router.push('/orders');
    } catch {
      showToast('Hata oluştu', 'error');
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleUpdate = async (formData: FormData) => {
    setIsUpdating(true);
    try {
      const quantity = parseInt(formData.get('quantity') as string);
      const unitPrice = parseFloat(formData.get('unitPrice') as string) || 0;
      await updateOrder(order!.id, {
        customer: formData.get('customerName') as string,
        email: (formData.get('customerEmail') as string) || undefined,
        phone: (formData.get('customerPhone') as string) || undefined,
        product: formData.get('productName') as string,
        quantity,
        amount: quantity * unitPrice,
        description: (formData.get('notes') as string) || undefined,
        deliveryDate: formData.get('deliveryDate') as string,
      });
      const files = formData.getAll('files');
      if (files.length > 0) await uploadDocuments(order!.id, formData);
      setIsEditModalOpen(false);
      showToast('Güncellendi', 'success');
    } catch {
      showToast('Hata oluştu', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const statusInfo = order ? getOrderStatusInfo(order.status) : { label: '', color: '', bgColor: '' };
  
  const steps = [
    { id: 'pending', label: 'Beklemede', icon: Clock },
    { id: 'in_production', label: 'Üretimde', icon: Package },
    { id: 'delivered', label: 'Teslim Edildi', icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === order?.status);
  const safeStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  const getDocumentMeta = (doc: Document) => {
    const extension = doc.name.split('.').pop()?.toLowerCase() ?? '';
    const typeMap: Record<string, string> = {
      pdf: 'PDF',
      png: 'PNG',
      jpg: 'JPG',
      jpeg: 'JPG',
      svg: 'SVG',
      webp: 'WEBP',
    };

    return {
      typeLabel: typeMap[extension] ?? 'DOSYA',
      sizeLabel: formatFileSize(doc.size),
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Sipariş bulunamadı</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Bu siparişe erişemiyoruz. Lütfen sipariş listesinden tekrar deneyin.
        </p>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft size={16} />
          Siparişlere dön
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950/50 min-h-screen">
      <Navbar title={`Sipariş #${order.id.slice(0,8)}`} showSearch={false} />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* Breadcrumb & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <Link href="/orders" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                <ArrowLeft size={16} />
                Sipariş Listesine Dön
            </Link>
            
            <div className="flex items-center gap-3">
                {canEditDelete && (
                     <button onClick={() => setIsEditModalOpen(true)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        Düzenle
                     </button>
                )}
                <button
                  onClick={handleInvoiceClick}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 transition-all"
                >
                    Fatura Oluştur
                </button>
                {canEditDelete && (
                    <button onClick={handleDeleteClick} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <span className="material-symbols-outlined">delete</span>
                    </button>
                )}
            </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column: Order Info */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Status Timeline Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 opacity-20" />
                     <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                {order.product}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                Sipariş No: #{order.id}
                            </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold border ${statusInfo.color.replace('text-', 'border-').replace('600', '200')} ${statusInfo.bgColor} bg-opacity-10 text-${statusInfo.color.split('-')[1]}-600`}>
                            {statusInfo.label}
                        </span>
                     </div>
                     
                     {/* Stepper */}
                     <div className="relative flex justify-between">
                        {/* Connecting Line */}
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 -z-10 -translate-y-1/2 rounded-full" />
                        <div 
                            className="absolute top-1/2 left-0 h-0.5 bg-blue-500 -z-10 -translate-y-1/2 rounded-full transition-all duration-500"
                            style={{ width: `${(safeStepIndex / (steps.length - 1)) * 100}%` }}
                        />

                        {steps.map((step, idx) => {
                            const isCompleted = idx <= safeStepIndex;
                            const isCurrent = idx === safeStepIndex;
                            const Icon = step.icon;
                            return (
                                <div key={step.id} className="flex flex-col items-center gap-2 bg-white dark:bg-slate-900 px-2">
                                    <button 
                                        onClick={() => {
                                          if (!canEditDelete) {
                                            showToast('Durumu güncellemek için yetkiniz yok.', 'error');
                                            return;
                                          }
                                          updateOrderStatus(order.id, step.id as any);
                                        }}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                                        isCompleted 
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' 
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'
                                    } ${!canEditDelete ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-110'}`}
                                        disabled={!canEditDelete}
                                    >
                                        <Icon size={18} />
                                    </button>
                                    <span className={`text-xs font-medium ${isCurrent ? 'text-blue-600' : 'text-slate-500'}`}>
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                     </div>
                </div>

                {/* Details Grid */}
                <div className="grid sm:grid-cols-2 gap-6">
                     <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4 text-slate-500">
                            <User size={18} />
                            <span className="text-sm font-medium uppercase tracking-wider">Müşteri</span>
                        </div>
                        <p className="font-bold text-lg text-slate-900 dark:text-white mb-1">{order.customer}</p>
                        {order.email && <p className="text-sm text-slate-500">{order.email}</p>}
                        {order.phone && <p className="text-sm text-slate-500">{order.phone}</p>}
                     </div>

                     <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4 text-slate-500">
                            <CreditCard size={18} />
                            <span className="text-sm font-medium uppercase tracking-wider">Ödeme Detayı</span>
                        </div>
                        <p className="font-bold text-2xl text-slate-900 dark:text-white mb-1 tracking-tight">
                            {formatCurrency(order.amount, order.currency)}
                        </p>
                        <p className="text-sm text-slate-500">
                            {order.quantity || 1} Adet x {formatCurrency(order.amount / (order.quantity || 1), order.currency)}
                        </p>
                     </div>
                </div>

                {/* Description */}
                {order.description && (
                     <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                        <h3 className="font-bold text-slate-900 dark:text-white mb-2">Sipariş Notu</h3>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
                            {order.description}
                        </p>
                     </div>
                )}
            </div>

            {/* Right Column: Documents and Dates */}
            <div className="space-y-6">
                 {/* Dates */}
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                     <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                            <Calendar size={20} />
                         </div>
                         <div>
                             <p className="text-xs text-slate-500 uppercase font-semibold">Oluşturulma</p>
                             <p className="font-medium text-slate-900 dark:text-white">{formatDate(order.date)}</p>
                         </div>
                     </div>
                     {order.deliveryDate && (
                         <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600">
                                <Truck size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold">Teslimat</p>
                                <p className="font-medium text-slate-900 dark:text-white">{formatDate(order.deliveryDate)}</p>
                            </div>
                         </div>
                     )}
                 </div>

                 {/* Documents */}
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                     <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-slate-900 dark:text-white">Belgeler</h3>
                         <button
                           onClick={handleUploadClick}
                           disabled={!canEditDelete}
                           className={`text-xs font-bold uppercase ${canEditDelete ? 'text-blue-600 hover:underline' : 'text-slate-300 cursor-not-allowed'}`}
                         >
                           Yükle
                         </button>
                     </div>
                     
                     <div className="space-y-3">
                         {order.documents && order.documents.length > 0 ? order.documents.map((doc, i) => {
                             const { typeLabel, sizeLabel } = getDocumentMeta(doc);
                             return (
                             <div 
                                key={i} 
                                onClick={() => handleDocumentOpen(doc)}
                                className="group flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all"
                             >
                                 <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">
                                     <FileText size={20} />
                                 </div>
                                 <div className="flex-1 min-w-0">
                                     <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{doc.name}</p>
                                     <p className="text-xs text-slate-500">{typeLabel} • {sizeLabel}</p>
                                 </div>
                                 {doc.url && (
                                   <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <Link
                                       href={doc.url}
                                       target="_blank"
                                       rel="noreferrer"
                                       className="text-xs font-semibold text-blue-600 hover:underline"
                                       onClick={(event) => event.stopPropagation()}
                                     >
                                       Aç
                                     </Link>
                                   </div>
                                 )}
                             </div>
                            );
                         }) : (
                             <p className="text-sm text-slate-400 text-center py-4">Belge eklenmemiş</p>
                         )}
                     </div>
                 </div>
            </div>
        </div>

        {/* Modals are kept same logic-wise */}
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Siparişi Düzenle">
             <NewOrderForm onSubmit={handleUpdate} initialData={{
                customerName: order.customer,
                customerEmail: order.email || '',
                customerPhone: order.phone || '',
                productName: order.product || '',
                quantity: order.quantity || 1,
                unitPrice: (order.amount / (order.quantity || 1)) || 0,
                deliveryDate: order.deliveryDate || '',
                notes: order.description || '',
                documents: order.documents || [],
             }} />
        </Modal>

        {selectedDocument && (
            <PDFViewer
                fileUrl={selectedDocument.url}
                fileName={selectedDocument.name}
                onClose={() => setSelectedDocument(null)}
            />
        )}

        <ConfirmDialog
            isOpen={isDeleteConfirmOpen}
            onClose={() => setIsDeleteConfirmOpen(false)}
            onConfirm={handleConfirmDelete}
            title="Siparişi Sil"
            message="Emin misiniz?"
            confirmText="Sil"
            variant="danger"
            isLoading={isDeleting}
        />

      </main>
    </div>
  );
}
