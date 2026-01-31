import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes
 * Uses clsx for conditional classes and tailwind-merge to handle conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency
 */
export function formatCurrency(amount: number | null | undefined, currency: string = '₺'): string {
  if (amount === null || amount === undefined) return `${currency}0,00`;
  return `${currency}${amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format date
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch (e) {
    return '-';
  }
}

/**
 * Format file size
 */
export function formatFileSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '-';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

/**
 * Get order status label and color
 */
export function getOrderStatusInfo(status: string) {
  const statusMap: Record<string, { label: string; color: string; bgColor: string; className: string }> = {
    pending: {
      label: 'Beklemede',
      color: 'text-yellow-800 dark:text-yellow-300',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/50',
      className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border border-yellow-500/50',
    },
    in_production: {
      label: 'Üretimde',
      color: 'text-blue-800 dark:text-blue-300',
      bgColor: 'bg-blue-100 dark:bg-blue-900/50',
      className: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/50',
    },
    delivered: {
      label: 'Teslim Edildi',
      color: 'text-green-800 dark:text-green-300',
      bgColor: 'bg-green-100 dark:bg-green-900/50',
      className: 'bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/50',
    },
  };

  return statusMap[status] || statusMap.pending;
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;
}
