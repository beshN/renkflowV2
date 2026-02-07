'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { 
  CreditCard, 
  FileText, 
  Users, 
  Wallet,
  TrendingUp,
  Receipt,
  Plus,
} from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 transition-all"
        >
          <Plus size={16} />
          {action.label}
        </button>
      )}
    </div>
  );
}

export function NoPaymentsState({ onAddPayment }: { onAddPayment?: () => void }) {
  return (
    <EmptyState
      icon={<CreditCard size={32} />}
      title="Henüz ödeme kaydı yok"
      description="İlk ödemeyi ekleyerek bu siparişin tahsilat takibini başlatın."
      action={onAddPayment ? { label: 'Ödeme Ekle', onClick: onAddPayment } : undefined}
    />
  );
}

export function NoDocumentsState({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyState
      icon={<FileText size={32} />}
      title="Henüz belge yüklenmemiş"
      description="Fatura, irsaliye veya sözleşme gibi belgeleri buraya yükleyebilirsiniz."
      action={onUpload ? { label: 'Belge Yükle', onClick: onUpload } : undefined}
    />
  );
}

export function NoEmployeesState({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<Users size={32} />}
      title="Henüz çalışan eklenmemiş"
      description="Personel bordro takibini başlatmak için ilk çalışanı ekleyin."
      action={onCreate ? { label: 'Çalışan Ekle', onClick: onCreate } : undefined}
    />
  );
}

export function NoLedgerEntriesState({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={<Wallet size={32} />}
      title="Bu dönemde kayıt bulunmuyor"
      description="Maaş, avans veya ödeme kaydı ekleyerek bordro takibini başlatın."
      action={onAdd ? { label: 'Kayıt Ekle', onClick: onAdd } : undefined}
    />
  );
}

export function NoOrdersState() {
  return (
    <EmptyState
      icon={<Receipt size={32} />}
      title="Sipariş bulunamadı"
      description="Filtreleri değiştirerek veya yeni sipariş oluşturarak başlayabilirsiniz."
    />
  );
}

export function NoDataState({ title = 'Veri bulunamadı' }: { title?: string }) {
  return (
    <EmptyState
      icon={<TrendingUp size={32} />}
      title={title}
      description="Bu zaman aralığında görüntülenecek veri bulunmuyor."
    />
  );
}

// Inline mini empty state for cards
export function MiniEmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-slate-400 text-center py-8">{message}</p>
  );
}
