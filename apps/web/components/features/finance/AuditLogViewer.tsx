'use client';

/**
 * Audit Log Viewer Component
 * Interactive viewer for audit logs with filters and export
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  Filter, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  User,
  Calendar,
  Search,
  X,
  Eye,
  FileJson,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from './FinanceSkeletons';

// ============================================
// Types
// ============================================

interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AuditLogViewerProps {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onFilterChange?: (filters: AuditFilters) => void;
  onExport?: () => void;
}

interface AuditFilters {
  action?: string;
  entityType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

// ============================================
// Action Labels
// ============================================

const ACTION_LABELS: Record<string, string> = {
  'payment.create': 'Ödeme Oluşturuldu',
  'payment.update': 'Ödeme Güncellendi',
  'payment.delete': 'Ödeme Silindi',
  'payment.batch_delete': 'Toplu Ödeme Silindi',
  'document.upload': 'Belge Yüklendi',
  'document.delete': 'Belge Silindi',
  'document.batch_delete': 'Toplu Belge Silindi',
  'employee.create': 'Çalışan Eklendi',
  'employee.update': 'Çalışan Güncellendi',
  'employee.delete': 'Çalışan Silindi',
  'employee.batch_update': 'Toplu Çalışan Güncellendi',
  'ledger.create': 'Bordro Kaydı Eklendi',
  'ledger.update': 'Bordro Kaydı Güncellendi',
  'ledger.delete': 'Bordro Kaydı Silindi',
  'order.create': 'Sipariş Oluşturuldu',
  'order.update': 'Sipariş Güncellendi',
  'order.delete': 'Sipariş Silindi',
  'export.payments': 'Ödemeler Dışa Aktarıldı',
  'export.documents': 'Belgeler Dışa Aktarıldı',
  'export.employees': 'Çalışanlar Dışa Aktarıldı',
  'export.ledger': 'Bordro Dışa Aktarıldı',
  'auth.login': 'Giriş Yapıldı',
  'auth.logout': 'Çıkış Yapıldı',
  'auth.permission_denied': 'Erişim Reddedildi',
};

const ENTITY_LABELS: Record<string, string> = {
  'payment': 'Ödeme',
  'order_document': 'Belge',
  'employee': 'Çalışan',
  'employee_ledger_entry': 'Bordro Kaydı',
  'order': 'Sipariş',
  'user': 'Kullanıcı',
  'tenant': 'Şirket',
};

const ACTION_COLORS: Record<string, string> = {
  'create': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'update': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'delete': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'upload': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'export': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'login': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  'logout': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  'permission_denied': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

// ============================================
// Helper Functions
// ============================================

function getActionColor(action: string): string {
  const type = action.split('.').pop() || '';
  return ACTION_COLORS[type] || 'bg-slate-100 text-slate-700';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// Detail Modal
// ============================================

function DetailModal({ 
  log, 
  onClose 
}: { 
  log: AuditLogEntry; 
  onClose: () => void 
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <FileJson className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white">
                Audit Log Detayı
              </h3>
              <p className="text-sm text-slate-500">
                {log.requestId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">İşlem</label>
              <p className="mt-1 font-medium">{ACTION_LABELS[log.action] || log.action}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Varlık Türü</label>
              <p className="mt-1">{ENTITY_LABELS[log.entityType] || log.entityType}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Kullanıcı</label>
              <p className="mt-1">{log.userEmail || 'Sistem'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Tarih</label>
              <p className="mt-1">{formatDate(log.createdAt)}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">IP Adresi</label>
              <p className="mt-1 font-mono text-sm">{log.ipAddress || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Rol</label>
              <p className="mt-1">{log.userRole || '-'}</p>
            </div>
          </div>

          {/* Old Values */}
          {log.oldValues && Object.keys(log.oldValues).length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Eski Değerler</label>
              <pre className="mt-2 p-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm overflow-x-auto">
                {JSON.stringify(log.oldValues, null, 2)}
              </pre>
            </div>
          )}

          {/* New Values */}
          {log.newValues && Object.keys(log.newValues).length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Yeni Değerler</label>
              <pre className="mt-2 p-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm overflow-x-auto">
                {JSON.stringify(log.newValues, null, 2)}
              </pre>
            </div>
          )}

          {/* Metadata */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Metadata</label>
              <pre className="mt-2 p-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* User Agent */}
          {log.userAgent && (
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">User Agent</label>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 break-all">
                {log.userAgent}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function AuditLogViewer({
  logs,
  total,
  page,
  pageSize,
  isLoading,
  onPageChange,
  onFilterChange,
  onExport,
}: AuditLogViewerProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AuditFilters>({});

  const totalPages = Math.ceil(total / pageSize);

  const handleFilterChange = useCallback((newFilters: AuditFilters) => {
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  }, [onFilterChange]);

  const clearFilters = () => {
    handleFilterChange({});
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                <History className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-lg text-slate-900 dark:text-white">
                  Audit Logları
                </h2>
                <p className="text-sm text-slate-500">{total} kayıt bulundu</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  showFilters 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                )}
              >
                <Filter className="w-4 h-4" />
                Filtrele
              </button>
              {onExport && (
                <button
                  onClick={onExport}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Dışa Aktar
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">İşlem</label>
                  <select
                    value={filters.action || ''}
                    onChange={(e) => handleFilterChange({ ...filters, action: e.target.value || undefined })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  >
                    <option value="">Tümü</option>
                    {Object.entries(ACTION_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Varlık Türü</label>
                  <select
                    value={filters.entityType || ''}
                    onChange={(e) => handleFilterChange({ ...filters, entityType: e.target.value || undefined })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  >
                    <option value="">Tümü</option>
                    {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Başlangıç</label>
                  <input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => handleFilterChange({ ...filters, startDate: e.target.value || undefined })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bitiş</label>
                  <input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => handleFilterChange({ ...filters, endDate: e.target.value || undefined })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              {Object.keys(filters).length > 0 && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                >
                  Filtreleri Temizle
                </button>
              )}
            </div>
          )}
        </div>

        {/* Log List */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {logs.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500">Henüz kayıt bulunmuyor</p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium',
                      getActionColor(log.action)
                    )}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {ENTITY_LABELS[log.entityType] || log.entityType}
                        {log.entityId && (
                          <span className="ml-2 text-slate-500 font-mono text-xs">
                            {log.entityId.slice(0, 8)}...
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                        <User className="w-3 h-3" />
                        {log.userEmail || 'Sistem'}
                        <span className="text-slate-300">•</span>
                        <Calendar className="w-3 h-3" />
                        {formatDate(log.createdAt)}
                        {log.ipAddress && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="font-mono">{log.ipAddress}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <Eye className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Sayfa {page} / {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </>
  );
}

export default AuditLogViewer;
