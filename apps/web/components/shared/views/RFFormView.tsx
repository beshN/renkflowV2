'use client';

import { ReactNode } from 'react';
import { ArrowLeft, Save, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export interface RFFormViewProps {
  title: string;
  subtitle?: string;
  backUrl?: string;
  isLoading?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  aside?: ReactNode; // For Chatter or StatusStepper
  children: ReactNode; // Form content
}

export function RFFormView({
  title,
  subtitle,
  backUrl,
  isLoading,
  isSaving,
  onSave,
  onCancel,
  onDelete,
  aside,
  children,
}: RFFormViewProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backUrl) router.push(backUrl);
    else router.back();
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-xl text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/20 px-4 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
            >
              <Trash2 size={16} />
              Sil
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-medium text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <X size={16} />
              İptal
            </button>
          )}
          {onSave && (
            <button
              onClick={onSave}
              disabled={isSaving || isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSaving ? (
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Kaydet
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-col xl:flex-row gap-6 pb-12">
        {/* Main form section */}
        <div className={cn("flex-1", aside ? "xl:w-2/3" : "w-full")}>
          {isLoading ? (
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
              <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-1/4"></div>
                <div className="h-10 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
                <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3 mt-6"></div>
                <div className="h-10 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
              </div>
            </div>
          ) : (
            children
          )}
        </div>

        {/* Aside section (Chatter, Stepper etc) */}
        {aside && (
          <div className="w-full xl:w-1/3 flex flex-col gap-6">
            {aside}
          </div>
        )}
      </div>
    </div>
  );
}
