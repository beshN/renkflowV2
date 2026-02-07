'use client';

/**
 * Bulk Actions Toolbar
 * Floating toolbar for multi-select operations
 */

import React, { useState } from 'react';
import { useOrdersStore } from '@/lib/stores/orders.store';
import { OrderStatus } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  CreditCard, 
  ArrowLeftRight, 
  Download, 
  Tag, 
  Printer, 
  Trash2, 
  X,
  Clock,
  Factory,
  FileSpreadsheet,
  FileText,
  FileJson
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface BulkActionsToolbarProps {
  totalFilteredCount: number;
  filteredIds: string[];
  onExport: (format: 'csv' | 'excel' | 'pdf' | 'json') => void;
  onServerExport?: () => void;
  onBulkUpdateStatus?: (ids: string[], status: OrderStatus) => Promise<void> | void;
  onBulkDelete?: (ids: string[]) => Promise<void> | void;
}

// ============================================
// Status Options
// ============================================

const statusOptions: { 
  value: OrderStatus; 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  color: string 
}[] = [
  { value: 'pending', label: 'Beklemede', icon: Clock, color: 'text-yellow-600' },
  { value: 'in_production', label: 'Üretimde', icon: Factory, color: 'text-blue-600' },
  { value: 'delivered', label: 'Teslim Edildi', icon: CheckCircle2, color: 'text-green-600' },
];

// ============================================
// Dropdown Menu
// ============================================

const DropdownMenu: React.FC<{
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
}> = ({ trigger, children, align = 'left' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={cn(
                'absolute z-50 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[200px]',
                align === 'right' ? 'right-0' : 'left-0'
              )}
              onClick={() => setIsOpen(false)}
            >
              {children}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// Confirmation Dialog
// ============================================

const ConfirmDialog: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, title, message, confirmLabel, confirmVariant = 'primary', onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 text-sm text-white rounded-lg',
              confirmVariant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================
// Main Bulk Actions Toolbar
// ============================================

export const BulkActionsToolbar: React.FC<BulkActionsToolbarProps> = ({
  totalFilteredCount,
  filteredIds,
  onExport,
  onServerExport,
  onBulkUpdateStatus,
  onBulkDelete,
}) => {
  const {
    selectedIds,
    selectAllMode,
    selectAll,
    clearSelection,
    bulkUpdateStatus,
    bulkDelete,
    getSelectedOrders,
    getFilteredOrders,
  } = useOrdersStore();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedOrders = getSelectedOrders();
  const effectiveOrders = selectAllMode === 'all' ? getFilteredOrders() : selectedOrders;
  const selectedCount = selectAllMode === 'all' ? totalFilteredCount : selectedIds.size;
  
  // Calculate total amount of selected orders
  const totalAmount = effectiveOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const currency = effectiveOrders[0]?.currency || 'TRY';

  // Handle status change
  const handleStatusChange = async (status: OrderStatus) => {
    setIsProcessing(true);
    try {
      const ids = selectAllMode === 'all'
        ? filteredIds
        : Array.from(selectedIds);
      if (onBulkUpdateStatus) {
        await onBulkUpdateStatus(ids, status);
      } else {
        await bulkUpdateStatus(ids, status);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      const ids = selectAllMode === 'all'
        ? filteredIds
        : Array.from(selectedIds);
      if (onBulkDelete) {
        await onBulkDelete(ids);
      } else {
        await bulkDelete(ids);
      }
      setShowDeleteConfirm(false);
    } finally {
      setIsProcessing(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
      >
        <div className="flex items-center gap-4 px-6 py-3 bg-gray-900/90 dark:bg-gray-800/90 backdrop-blur-xl text-white rounded-xl shadow-2xl border border-gray-700/50">
          {/* Selection Info */}
          <div className="flex items-center gap-3 pr-4 border-r border-gray-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-400" />
              <span className="font-medium">{selectedCount}</span>
              <span className="text-gray-400">seçildi</span>
            </div>
            {selectAllMode !== 'all' && selectedIds.size < totalFilteredCount && (
              <button
                onClick={() => selectAll('all', filteredIds)}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Tümünü seç ({totalFilteredCount})
              </button>
            )}
          </div>

          {/* Total Amount */}
          <div className="flex items-center gap-2 px-4 border-r border-gray-700">
            <CreditCard className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-400">Toplam:</span>
            <span className="font-medium">{formatCurrency(totalAmount, currency)}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Status Change */}
            <DropdownMenu
              trigger={
                <button
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Durum Değiştir
                </button>
              }
            >
              <div className="py-1">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <option.icon className={cn('w-4 h-4', option.color)} />
                    <span className="text-gray-900 dark:text-white">{option.label}</span>
                  </button>
                ))}
              </div>
            </DropdownMenu>

            {/* Export */}
            <DropdownMenu
              trigger={
                <button
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Dışa Aktar
                </button>
              }
            >
              <div className="py-1">
                {onServerExport && (
                  <button
                    onClick={() => onServerExport()}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Download className="w-4 h-4 text-blue-600" />
                    <span className="text-gray-900 dark:text-white">Sunucuda Oluştur (Job)</span>
                  </button>
                )}
                <button
                  onClick={() => onExport('csv')}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  <span className="text-gray-900 dark:text-white">CSV</span>
                </button>
                <button
                  onClick={() => onExport('excel')}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-700" />
                  <span className="text-gray-900 dark:text-white">Excel</span>
                </button>
                <button
                  onClick={() => onExport('pdf')}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileText className="w-4 h-4 text-red-600" />
                  <span className="text-gray-900 dark:text-white">PDF</span>
                </button>
                <button
                  onClick={() => onExport('json')}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileJson className="w-4 h-4 text-yellow-600" />
                  <span className="text-gray-900 dark:text-white">JSON</span>
                </button>
              </div>
            </DropdownMenu>

            {/* Add Tags */}
            <button
              disabled={isProcessing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <Tag className="w-4 h-4" />
              Etiket Ekle
            </button>

            {/* Print */}
            <button
              disabled={isProcessing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Delete */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isProcessing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Sil
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-700 mx-2" />

            {/* Clear Selection */}
            <button
              onClick={clearSelection}
              className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
              title="Seçimi Temizle"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Siparişleri Sil"
        message={`${selectedCount} sipariş kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
        confirmLabel="Sil"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
};

export default BulkActionsToolbar;
