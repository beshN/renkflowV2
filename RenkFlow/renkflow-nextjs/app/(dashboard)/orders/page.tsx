'use client';

import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { OrderTable } from '@/components/orders/OrderTable';
import { KanbanBoard } from '@/components/orders/KanbanBoard';
import { CalendarView } from '@/components/orders/CalendarView';
import { useOrders } from '@/lib/hooks/useOrders';
import { Order, ViewMode } from '@/lib/types';
import { useToast } from '@/lib/context/ToastContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

import { useSearch } from '@/lib/hooks/useSearch';
import { usePagination } from '@/lib/hooks/usePagination';
import { useSort } from '@/lib/hooks/useSort';

export default function OrdersPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const { orders, deleteOrder, updateOrderStatus, isLoading } = useOrders();
  const { showToast } = useToast();
  
  const [deleteConfirmState, setDeleteConfirmState] = useState<{ isOpen: boolean; orderId: string | null }>({ 
    isOpen: false, 
    orderId: null 
  });
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 1. Search
  const { searchTerm, setSearchTerm, filteredData } = useSearch(orders, ['id', 'customer', 'product']);

  // 2. Sort
  const { sortedData, requestSort, sortConfig } = useSort(filteredData);

  // 3. Pagination
  const { 
    currentData: paginatedOrders, 
    currentPage, 
    totalPages, 
    goToPage, 
    nextPage, 
    prevPage 
  } = usePagination(sortedData, 10);

  const handleDeleteClick = (id: string) => {
    setDeleteConfirmState({ isOpen: true, orderId: id });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmState.orderId) return;
    
    setIsDeleting(true);
    try {
      await deleteOrder(deleteConfirmState.orderId);
      showToast('Sipariş başarıyla silindi', 'success');
      setDeleteConfirmState({ isOpen: false, orderId: null });
    } catch (error) {
      showToast('Sipariş silinirken bir hata oluştu', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Navbar 
        title="Siparişler" 
        showSearch={true} 
        onSearch={setSearchTerm}
      />
      
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8">
        {/* Header with View Toggle and Export */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-text-light dark:text-text-dark">
              Tüm Siparişler
            </h2>
            <p className="text-xs md:text-sm text-subtle-light dark:text-subtle-dark mt-1">
              Toplam {filteredData.length} sipariş
              {searchTerm && ` ("${searchTerm}" için sonuçlar)`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
             {/* Export Button */}
             <button
                onClick={() => {
                  const headers = ['ID', 'Müşteri', 'Ürün', 'Tutar', 'Durum', 'Tarih'];
                  const csvContent = "data:text/csv;charset=utf-8," 
                      + headers.join(",") + "\n"
                      + filteredData.map(order => [
                          order.id, 
                          `"${order.customer}"`, // Quote strings with commas 
                          `"${order.product}"`,
                          order.amount,
                          order.status,
                          new Date(order.date).toLocaleDateString()
                        ].join(",")).join("\n");
                  
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", "siparisler_export.csv");
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  showToast('Siparişler dışa aktarıldı', 'success');
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200 shadow-sm"
             >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Dışa Aktar
             </button>

            {/* View Mode Toggle */}
            <div className="flex gap-1 md:gap-2 bg-card-light dark:bg-card-dark rounded-lg p-1 border border-border-light dark:border-border-dark overflow-x-auto">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'list'
                    ? 'bg-primary text-white'
                    : 'text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] md:text-[18px]">table_rows</span>
                <span className="hidden sm:inline">Liste</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'table'
                    ? 'bg-primary text-white'
                    : 'text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] md:text-[18px]">view_kanban</span>
                <span className="hidden sm:inline">Tablo</span>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'calendar'
                    ? 'bg-primary text-white'
                    : 'text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] md:text-[18px]">calendar_month</span>
                <span className="hidden sm:inline">Takvim</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-primary/20 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            </div>
            <p className="text-lg font-medium text-text-light dark:text-text-dark">Siparişler yükleniyor...</p>
            <p className="text-sm text-subtle-light dark:text-subtle-dark">Lütfen bekleyin</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <span className="material-symbols-outlined text-6xl text-subtle-light dark:text-subtle-dark">inventory_2</span>
            <p className="text-lg font-medium text-text-light dark:text-text-dark">Henüz sipariş bulunmuyor</p>
            <p className="text-sm text-subtle-light dark:text-subtle-dark">Yeni sipariş ekleyerek başlayın</p>
          </div>
        ) : viewMode === 'list' ? (
          <>
            <OrderTable 
              orders={paginatedOrders} 
              onDelete={handleDeleteClick}
              onStatusChange={updateOrderStatus}
              onSort={requestSort}
              sortConfig={sortConfig}
            />
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 border-t border-border-light dark:border-border-dark pt-4">
                <p className="text-sm text-subtle-light dark:text-subtle-dark">
                  Sayfa {currentPage} / {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={prevPage}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded-md border border-border-light dark:border-border-dark text-sm disabled:opacity-50 hover:bg-card-light dark:hover:bg-card-dark transition-colors"
                  >
                    Önceki
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`px-3 py-1 rounded-md border border-border-light dark:border-border-dark text-sm transition-colors ${
                        currentPage === page
                          ? 'bg-primary text-white border-primary'
                          : 'hover:bg-card-light dark:hover:bg-card-dark'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={nextPage}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded-md border border-border-light dark:border-border-dark text-sm disabled:opacity-50 hover:bg-card-light dark:hover:bg-card-dark transition-colors"
                  >
                    Sonraki
                  </button>
                </div>
              </div>
            )}
          </>
        ) : viewMode === 'table' ? (
          <KanbanBoard orders={filteredData} onOrderStatusChange={updateOrderStatus} />
        ) : (
          <CalendarView orders={filteredData} />
        )}
      </main>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmState.isOpen}
        onClose={() => setDeleteConfirmState({ isOpen: false, orderId: null })}
        onConfirm={handleConfirmDelete}
        title="Siparişi Sil"
        message="Bu siparişi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        confirmText="Sil"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
