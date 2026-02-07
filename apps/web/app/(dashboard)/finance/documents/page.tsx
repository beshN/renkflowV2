'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { canAccessFinance, hasPermission, UserRole } from '@/lib/auth/permissions';
import { 
  ArrowLeft,
  FileText,
  Search,
  Filter,
  Download,
  Trash2,
  ExternalLink,
} from 'lucide-react';

import { listAllDocuments, deleteOrderDocument } from '@/app/actions/finance.documents.actions';
import { OrderDocument, OrderDocumentType, DOCUMENT_TYPE_LABELS } from '@/lib/types/finance';

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FinanceDocumentsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState<(OrderDocument & { orderNumber?: string; customerName?: string })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canDelete = user && hasPermission(user.role as UserRole, 'finance.documents.delete');

  useEffect(() => {
    if (!user) return;
    
    if (!canAccessFinance(user.role as UserRole)) {
      showToast('Finans modülüne erişim yetkiniz bulunmuyor', 'error');
      return;
    }

    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await listAllDocuments({ 
        type: typeFilter !== 'all' ? typeFilter as OrderDocumentType : undefined 
      });
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
      showToast('Belgeler yüklenirken hata oluştu', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && canAccessFinance(user.role as any)) {
      loadData();
    }
  }, [typeFilter]);

  const handleDelete = async (docId: string) => {
    if (!canDelete) return;
    
    if (!confirm('Bu belgeyi silmek istediğinizden emin misiniz?')) return;

    try {
      setDeletingId(docId);
      await deleteOrderDocument(docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      showToast('Belge silindi', 'success');
    } catch (error) {
      console.error('Error deleting document:', error);
      showToast('Belge silinirken hata oluştu', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.customerName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  if (!user || !canAccessFinance(user.role as UserRole)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500">Finans modülüne erişim yetkiniz bulunmuyor</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950/50 min-h-screen">
      <Navbar title="Belgeler" showSearch={false} />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* Breadcrumb */}
        <Link href="/finance" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors mb-6">
          <ArrowLeft size={16} />
          Finans
        </Link>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm mb-6">
          <div className="p-4 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Dosya adı, sipariş no veya müşteri ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tüm Türler</option>
                <option value="invoice">Fatura</option>
                <option value="delivery_note">İrsaliye</option>
                <option value="receipt">Makbuz</option>
                <option value="contract">Sözleşme</option>
                <option value="other">Diğer</option>
              </select>
            </div>
          </div>
        </div>

        {/* Documents Grid */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <FileText size={48} className="mb-4 opacity-30" />
              <p>Belge bulunamadı</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredDocuments.map((doc) => (
                <div 
                  key={doc.id}
                  className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 dark:text-white truncate" title={doc.fileName}>
                        {doc.fileName}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 mr-2">
                          {DOCUMENT_TYPE_LABELS[doc.type]}
                        </span>
                        {formatFileSize(doc.sizeBytes)}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        Sipariş: #{doc.orderNumber?.slice(0, 8)} • {doc.customerName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(doc.uploadedAt).toLocaleDateString('tr-TR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <ExternalLink size={16} />
                      Görüntüle
                    </a>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      >
                        {deletingId === doc.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
