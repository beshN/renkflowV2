'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { NewOrderForm } from '@/components/forms/NewOrderForm';

import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { formatCurrency, formatDate, getOrderStatusInfo } from '@/lib/utils';
import { Order, NewOrderFormData, Document } from '@/lib/types';

const PDFViewer = dynamic(() => import('@/components/pdf-viewer/PDFViewer'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white" />
    </div>
  ),
});

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const { getOrderById, deleteOrder, updateOrder, updateOrderStatus, isLoading } = useOrders();
  const { user } = useAuth();
  const { showToast } = useToast();

  const order = getOrderById(orderId);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const isAdmin = user?.role === 'admin';


  const handleDeleteClick = () => setIsDeleteConfirmOpen(true);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteOrder(order!.id);
      showToast('Sipariş başarıyla silindi', 'success');
      router.push('/orders');
    } catch (error) {
      console.error('Error deleting order:', error);
      showToast('Sipariş silinirken bir hata oluştu', 'error');
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleStatusChange = async (status: Order['status']) => {
    if (!isAdmin) return;
    try {
      await updateOrderStatus(order!.id, status);
      showToast('Sipariş durumu güncellendi', 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Durum güncellenirken bir hata oluştu', 'error');
    }
  };

  const handleUpdate = async (formData: any) => {
    setIsUpdating(true);
    try {
      const quantity = formData.quantity;
      const unitPrice = formData.unitPrice || 0;
      await updateOrder(order!.id, {
        customer: formData.customerName,
        email: formData.customerEmail || undefined,
        phone: formData.customerPhone || undefined,
        product: formData.productName,
        quantity,
        amount: quantity * unitPrice,
        description: formData.notes || undefined,
        deliveryDate: formData.deliveryDate,
      });
      setIsEditModalOpen(false);
      showToast('Sipariş başarıyla güncellendi', 'success');
    } catch (error) {
      console.error('Error updating order:', error);
      showToast('Sipariş güncellenirken bir hata oluştu', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex-1 flex flex-col">
        <Navbar title="Sipariş Detayı" showSearch={false} />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined text-6xl text-subtle-light dark:text-subtle-dark mb-4">error</span>
            <h2 className="text-2xl font-semibold text-text-light dark:text-text-dark mb-2">Sipariş Bulunamadı</h2>
            <p className="text-subtle-light dark:text-subtle-dark mb-6">#{orderId} numaralı sipariş bulunamadı.</p>
            <Link href="/orders">
              <Button variant="primary">Siparişlere Dön</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const statusInfo = getOrderStatusInfo(order.status);

  return (
    <>
      <div className="flex-1 flex flex-col">
        <Navbar title={`Sipariş #${order.id}`} showSearch={false} />
      <main className="flex-1 p-8">
        <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-6">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Siparişlere Dön
        </Link>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-light dark:text-text-dark mb-2">Sipariş #{order.id}</h1>
            <p className="text-subtle-light dark:text-subtle-dark">{formatDate(order.date)} tarihinde oluşturuldu</p>
          </div>
          <div className="flex gap-3">
            <Badge status={order.status}>{statusInfo.label}</Badge>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)}>
                <span className="material-symbols-outlined text-base mr-2">edit</span>
                Düzenle
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDeleteClick}>
                <span className="material-symbols-outlined text-base mr-2">delete</span>
                Sil
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle>Müşteri Bilgileri</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-subtle-light dark:text-subtle-dark">person</span>
                    <div>
                      <p className="text-sm text-subtle-light dark:text-subtle-dark">Müşteri</p>
                      <p className="font-medium text-text-light dark:text-text-dark">{order.customer}</p>
                    </div>
                  </div>
                  {order.email && (
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-subtle-light dark:text-subtle-dark">mail</span>
                      <div>
                        <p className="text-sm text-subtle-light dark:text-subtle-dark">E-posta</p>
                        <p className="font-medium text-text-light dark:text-text-dark">{order.email}</p>
                      </div>
                    </div>
                  )}
                  {order.phone && (
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-subtle-light dark:text-subtle-dark">phone</span>
                      <div>
                        <p className="text-sm text-subtle-light dark:text-subtle-dark">Telefon</p>
                        <p className="font-medium text-text-light dark:text-text-dark">{order.phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Product Details */}
            <Card>
              <CardHeader>
                <CardTitle>Ürün Detayları</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-subtle-light dark:text-subtle-dark mb-1">Ürün</p>
                    <p className="font-medium text-text-light dark:text-text-dark">{order.product || 'Belirtilmemiş'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-subtle-light dark:text-subtle-dark mb-1">Miktar</p>
                      <p className="font-medium text-text-light dark:text-text-dark">{order.quantity || 1} adet</p>
                    </div>
                    <div>
                      <p className="text-sm text-subtle-light dark:text-subtle-dark mb-1">Tutar</p>
                      <p className="font-medium text-text-light dark:text-text-dark">{formatCurrency(order.amount, order.currency)}</p>
                    </div>
                  </div>
                  {order.deliveryDate && (
                    <div>
                      <p className="text-sm text-subtle-light dark:text-subtle-dark mb-1">Teslim Tarihi</p>
                      <p className="font-medium text-text-light dark:text-text-dark">{formatDate(order.deliveryDate)}</p>
                    </div>
                  )}
                  {order.description && (
                    <div>
                      <p className="text-sm text-subtle-light dark:text-subtle-dark mb-1">Notlar</p>
                      <p className="text-sm text-text-light dark:text-text-dark bg-background-light dark:bg-background-dark p-3 rounded-lg border border-border-light dark:border-border-dark">
                        {order.description}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Belgeler</CardTitle>
                  {isAdmin && (
                    <Button variant="outline" size="sm">
                      <span className="material-symbols-outlined text-base mr-2">upload</span>
                      Belge Yükle
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {order.documents && order.documents.length > 0 ? (
                  <div className="space-y-2">
                    {order.documents.map((doc, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedDocument(doc);
                          setIsViewerOpen(true);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark transition-colors text-left"
                      >
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                          <span className="material-symbols-outlined">
                            {doc.name.endsWith('.pdf') ? 'picture_as_pdf' : 'image'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-light dark:text-text-dark truncate">{doc.name}</p>
                          <p className="text-xs text-subtle-light dark:text-subtle-dark">Tıklayarak görüntüle</p>
                        </div>
                        <span className="material-symbols-outlined text-subtle-light dark:text-subtle-dark group-hover:text-primary transition-colors">visibility</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border-light dark:border-border-dark rounded-lg p-8 text-center">
                    <span className="material-symbols-outlined text-4xl text-subtle-light dark:text-subtle-dark mb-2">folder_open</span>
                    <p className="text-subtle-light dark:text-subtle-dark">Henüz belge eklenmemiş</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Status Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Sipariş Durumu</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button
                    variant={order.status === 'pending' ? 'primary' : 'outline'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleStatusChange('pending')}
                  >
                    <span className="material-symbols-outlined text-base mr-2">schedule</span>
                    Beklemede
                  </Button>
                  <Button
                    variant={order.status === 'in_production' ? 'primary' : 'outline'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleStatusChange('in_production')}
                  >
                    <span className="material-symbols-outlined text-base mr-2">factory</span>
                    Üretimde
                  </Button>
                  <Button
                    variant={order.status === 'delivered' ? 'primary' : 'outline'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleStatusChange('delivered')}
                  >
                    <span className="material-symbols-outlined text-base mr-2">check_circle</span>
                    Teslim Edildi
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
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

      {/* Document Viewer */}
      {selectedDocument ? (
        <PDFViewer
          file={{
            id: selectedDocument.id || 'doc-id',
            name: selectedDocument.name,
            size: 'Unknown',
            type: selectedDocument.name.endsWith('.pdf') ? 'pdf' : 'img',
            pageCount: 1,
            thumbnailUrl: selectedDocument.url,
            pages: [selectedDocument.url],
          }}
          onClose={() => setSelectedDocument(null)}
          onError={() => console.error('Error opening document')}
        />
      ) : null}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Siparişi Sil"
        message="Bu siparişi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        confirmText="Sil"
        variant="danger"
        isLoading={isDeleting}
      />
      </div>

      {/* Print-only content */}
    </>
  );
}
