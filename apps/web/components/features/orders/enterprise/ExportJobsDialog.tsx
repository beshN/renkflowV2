'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ExportJob, ExportJobFormat } from '@/lib/hooks/useExportJobs';
import { Download, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExportJobsDialogProps {
  isOpen: boolean;
  jobs: ExportJob[];
  isLoading?: boolean;
  error?: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onCreate: (format: ExportJobFormat) => void;
  onDownload: (job: ExportJob) => void;
}

function formatTimestamp(value: string | Date | undefined): string {
  if (!value) return '';
  try {
    const d = typeof value === 'string' ? new Date(value) : value;
    return d.toLocaleString('tr-TR');
  } catch {
    return String(value);
  }
}

function statusLabel(status: ExportJob['status']): string {
  switch (status) {
    case 'pending':
      return 'Beklemede';
    case 'processing':
      return 'Hazırlanıyor';
    case 'completed':
      return 'Hazır';
    case 'failed':
      return 'Hata';
    default:
      return status;
  }
}

export const ExportJobsDialog: React.FC<ExportJobsDialogProps> = ({
  isOpen,
  jobs,
  isLoading,
  error,
  onClose,
  onRefresh,
  onCreate,
  onDownload,
}) => {
  const sorted = useMemo(() => {
    return [...jobs].sort((a, b) => {
      const at = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt.getTime();
      const bt = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : b.createdAt.getTime();
      return bt - at;
    });
  }, [jobs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        className="relative w-full max-w-2xl rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Dışa aktarım merkezi"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Dışa Aktarım Merkezi
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sunucu tarafında oluşturulan export dosyalarını buradan takip edebilirsin.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onCreate('csv')}
            className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            CSV Oluştur
          </button>
          <button
            onClick={() => onCreate('pdf')}
            className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            PDF Oluştur
          </button>

          <div className="flex-1" />

          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading ? 'animate-spin' : '')} />
            Yenile
          </button>
        </div>

        <div className="px-5 pb-4">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
              <div className="col-span-4">İş</div>
              <div className="col-span-2">Format</div>
              <div className="col-span-2">Durum</div>
              <div className="col-span-2">Tarih</div>
              <div className="col-span-2 text-right">İndir</div>
            </div>

            <div className="max-h-[360px] overflow-auto">
              {sorted.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Henüz export işi yok.
                </div>
              ) : (
                sorted.map((job) => (
                  <div
                    key={job.id}
                    className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-800"
                  >
                    <div className="col-span-4">
                      <div className="text-sm text-gray-900 dark:text-white truncate">{job.id}</div>
                      {job.error && (
                        <div className="text-xs text-red-600 dark:text-red-300 truncate">{job.error}</div>
                      )}
                    </div>
                    <div className="col-span-2 text-sm text-gray-700 dark:text-gray-300 uppercase">
                      {job.format}
                    </div>
                    <div className="col-span-2">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs',
                          job.status === 'completed' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200',
                          job.status === 'processing' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
                          job.status === 'pending' && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
                          job.status === 'failed' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                        )}
                      >
                        {statusLabel(job.status)}
                      </span>
                    </div>
                    <div className="col-span-2 text-xs text-gray-500 dark:text-gray-400">
                      {formatTimestamp(job.createdAt)}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <button
                        onClick={() => onDownload(job)}
                        disabled={job.status !== 'completed' || !job.fileUrl}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:hover:bg-gray-700"
                      >
                        <Download className="w-3.5 h-3.5" />
                        İndir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ExportJobsDialog;
