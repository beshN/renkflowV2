/**
 * Enterprise Export Helpers
 * Excel (XLSX) and CSV export with Turkish headers and formatting
 */

import { Payment, OrderDocument, Employee, EmployeeLedgerEntry } from '@/lib/types/finance';
import { PAYMENT_METHOD_LABELS, DOCUMENT_TYPE_LABELS, LEDGER_KIND_LABELS } from '@/lib/types/finance';

// ============================================
// Types
// ============================================

export interface ExportColumn<T> {
  key: keyof T | string;
  header: string;
  width?: number;
  transform?: (value: unknown, row: T) => string | number;
}

export interface ExportOptions {
  filename: string;
  sheetName?: string;
  includeTimestamp?: boolean;
}

export interface MultiSheetExportOptions {
  filename: string;
  sheets: {
    name: string;
    data: Record<string, unknown>[];
    columns: ExportColumn<any>[];
  }[];
  includeTimestamp?: boolean;
}

// ============================================
// Column Definitions
// ============================================

export const PAYMENT_EXPORT_COLUMNS: ExportColumn<Payment>[] = [
  { key: 'id', header: 'ID', width: 36 },
  { key: 'orderId', header: 'Sipariş ID', width: 36 },
  { 
    key: 'amount', 
    header: 'Tutar', 
    width: 15,
    transform: (v) => typeof v === 'number' ? v : parseFloat(v as string) || 0
  },
  { key: 'currency', header: 'Para Birimi', width: 10 },
  { 
    key: 'method', 
    header: 'Ödeme Yöntemi', 
    width: 20,
    transform: (v) => PAYMENT_METHOD_LABELS[v as keyof typeof PAYMENT_METHOD_LABELS] || v as string
  },
  { 
    key: 'paidAt', 
    header: 'Ödeme Tarihi', 
    width: 20,
    transform: (v) => formatDateForExport(v as string)
  },
  { key: 'note', header: 'Not', width: 30 },
  { 
    key: 'createdAt', 
    header: 'Oluşturulma', 
    width: 20,
    transform: (v) => formatDateForExport(v as string)
  },
];

export const DOCUMENT_EXPORT_COLUMNS: ExportColumn<OrderDocument & { orderNumber?: string }>[] = [
  { key: 'id', header: 'ID', width: 36 },
  { key: 'orderId', header: 'Sipariş ID', width: 36 },
  { key: 'orderNumber', header: 'Sipariş No', width: 15 },
  { 
    key: 'type', 
    header: 'Belge Türü', 
    width: 15,
    transform: (v) => DOCUMENT_TYPE_LABELS[v as keyof typeof DOCUMENT_TYPE_LABELS] || v as string
  },
  { key: 'fileName', header: 'Dosya Adı', width: 40 },
  { 
    key: 'sizeBytes', 
    header: 'Boyut (KB)', 
    width: 12,
    transform: (v) => v ? Math.round((v as number) / 1024) : 0
  },
  { 
    key: 'uploadedAt', 
    header: 'Yükleme Tarihi', 
    width: 20,
    transform: (v) => formatDateForExport(v as string)
  },
];

export const EMPLOYEE_EXPORT_COLUMNS: ExportColumn<Employee>[] = [
  { key: 'id', header: 'ID', width: 36 },
  { key: 'fullName', header: 'Ad Soyad', width: 25 },
  { key: 'title', header: 'Unvan', width: 20 },
  { key: 'email', header: 'Email', width: 30 },
  { key: 'phone', header: 'Telefon', width: 15 },
  { 
    key: 'active', 
    header: 'Durum', 
    width: 10,
    transform: (v) => v ? 'Aktif' : 'Pasif'
  },
  { 
    key: 'createdAt', 
    header: 'Eklenme Tarihi', 
    width: 20,
    transform: (v) => formatDateForExport(v as string)
  },
];

export const LEDGER_EXPORT_COLUMNS: ExportColumn<EmployeeLedgerEntry & { employeeName?: string }>[] = [
  { key: 'id', header: 'ID', width: 36 },
  { key: 'employeeId', header: 'Çalışan ID', width: 36 },
  { key: 'employeeName', header: 'Çalışan', width: 25 },
  { 
    key: 'kind', 
    header: 'Tür', 
    width: 12,
    transform: (v) => LEDGER_KIND_LABELS[v as keyof typeof LEDGER_KIND_LABELS] || v as string
  },
  { 
    key: 'amount', 
    header: 'Tutar', 
    width: 15,
    transform: (v) => typeof v === 'number' ? v : parseFloat(v as string) || 0
  },
  { key: 'currency', header: 'Para Birimi', width: 10 },
  { 
    key: 'entryDate', 
    header: 'Kayıt Tarihi', 
    width: 15,
    transform: (v) => v as string
  },
  { key: 'note', header: 'Not', width: 30 },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Format date for export
 */
function formatDateForExport(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Generate filename with timestamp
 */
export function generateExportFilename(baseName: string, extension: string, includeTimestamp: boolean = true): string {
  if (!includeTimestamp) {
    return `${baseName}.${extension}`;
  }
  const timestamp = new Date().toISOString().split('T')[0];
  return `${baseName}_${timestamp}.${extension}`;
}

/**
 * Transform row data using column definitions
 */
function transformRow<T extends Record<string, unknown>>(
  row: T,
  columns: ExportColumn<T>[]
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  
  for (const col of columns) {
    const value = (row as any)[col.key];
    if (col.transform) {
      result[col.header] = col.transform(value, row);
    } else {
      result[col.header] = value ?? '';
    }
  }
  
  return result;
}

// ============================================
// CSV Export
// ============================================

/**
 * Generate CSV content from data
 */
export function generateCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[]
): string {
  // Header row
  const headers = columns.map(col => `"${col.header}"`).join(',');
  
  // Data rows
  const rows = data.map(row => {
    return columns.map(col => {
      const value = (row as any)[col.key];
      const transformed = col.transform ? col.transform(value, row) : value;
      
      // Escape quotes and wrap in quotes
      const stringValue = String(transformed ?? '').replace(/"/g, '""');
      return `"${stringValue}"`;
    }).join(',');
  });
  
  // Add BOM for Excel Turkish character support
  return '\ufeff' + [headers, ...rows].join('\r\n');
}

/**
 * Download CSV file in browser
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// Excel Export (using xlsx library)
// ============================================

/**
 * Generate Excel workbook data (to be used with xlsx library)
 * Returns array of arrays format compatible with xlsx
 */
export function generateExcelData<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[]
): (string | number)[][] {
  // Header row
  const headers = columns.map(col => col.header);
  
  // Data rows
  const rows = data.map(row => {
    return columns.map(col => {
      const value = (row as any)[col.key];
      const transformed = col.transform ? col.transform(value, row) : value;
      return transformed ?? '';
    });
  });
  
  return [headers, ...rows];
}

/**
 * Get column widths for Excel
 */
export function getColumnWidths<T>(columns: ExportColumn<T>[]): { wch: number }[] {
  return columns.map(col => ({ wch: col.width || 15 }));
}

// ============================================
// Export Functions
// ============================================

/**
 * Export payments to CSV
 */
export function exportPaymentsToCSV(payments: Payment[], filename: string = 'odemeler'): void {
  const csv = generateCSV(payments, PAYMENT_EXPORT_COLUMNS);
  downloadCSV(csv, generateExportFilename(filename, 'csv'));
}

/**
 * Export documents to CSV
 */
export function exportDocumentsToCSV(
  documents: (OrderDocument & { orderNumber?: string })[],
  filename: string = 'belgeler'
): void {
  const csv = generateCSV(documents, DOCUMENT_EXPORT_COLUMNS);
  downloadCSV(csv, generateExportFilename(filename, 'csv'));
}

/**
 * Export employees to CSV
 */
export function exportEmployeesToCSV(employees: Employee[], filename: string = 'calisanlar'): void {
  const csv = generateCSV(employees, EMPLOYEE_EXPORT_COLUMNS);
  downloadCSV(csv, generateExportFilename(filename, 'csv'));
}

/**
 * Export ledger entries to CSV
 */
export function exportLedgerToCSV(
  entries: (EmployeeLedgerEntry & { employeeName?: string })[],
  filename: string = 'bordro'
): void {
  const csv = generateCSV(entries, LEDGER_EXPORT_COLUMNS);
  downloadCSV(csv, generateExportFilename(filename, 'csv'));
}

// ============================================
// Excel Export with xlsx library
// Note: Requires `npm install xlsx` and dynamic import
// ============================================

/**
 * Export to Excel using xlsx library
 * This is a client-side function
 */
export async function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions
): Promise<void> {
  // Dynamically import xlsx to avoid SSR issues
  const XLSX = await import('xlsx');
  
  // Generate workbook data
  const wsData = generateExcelData(data, columns);
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  ws['!cols'] = getColumnWidths(columns);
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, options.sheetName || 'Data');
  
  // Generate filename
  const filename = generateExportFilename(
    options.filename,
    'xlsx',
    options.includeTimestamp ?? true
  );
  
  // Download file
  XLSX.writeFile(wb, filename);
}

/**
 * Export to Excel with multiple sheets
 */
export async function exportToExcelMultiSheet(options: MultiSheetExportOptions): Promise<void> {
  const XLSX = await import('xlsx');
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Add each sheet
  for (const sheet of options.sheets) {
    const wsData = generateExcelData(sheet.data, sheet.columns);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = getColumnWidths(sheet.columns);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  
  // Generate filename
  const filename = generateExportFilename(
    options.filename,
    'xlsx',
    options.includeTimestamp ?? true
  );
  
  // Download file
  XLSX.writeFile(wb, filename);
}

/**
 * Export payments to Excel
 */
export async function exportPaymentsToExcel(
  payments: Payment[],
  filename: string = 'odemeler'
): Promise<void> {
  await exportToExcel(payments, PAYMENT_EXPORT_COLUMNS, {
    filename,
    sheetName: 'Ödemeler',
  });
}

/**
 * Export documents to Excel
 */
export async function exportDocumentsToExcel(
  documents: (OrderDocument & { orderNumber?: string })[],
  filename: string = 'belgeler'
): Promise<void> {
  await exportToExcel(documents, DOCUMENT_EXPORT_COLUMNS, {
    filename,
    sheetName: 'Belgeler',
  });
}

/**
 * Export employees to Excel
 */
export async function exportEmployeesToExcel(
  employees: Employee[],
  filename: string = 'calisanlar'
): Promise<void> {
  await exportToExcel(employees, EMPLOYEE_EXPORT_COLUMNS, {
    filename,
    sheetName: 'Çalışanlar',
  });
}

/**
 * Export ledger entries to Excel
 */
export async function exportLedgerToExcel(
  entries: (EmployeeLedgerEntry & { employeeName?: string })[],
  filename: string = 'bordro'
): Promise<void> {
  await exportToExcel(entries, LEDGER_EXPORT_COLUMNS, {
    filename,
    sheetName: 'Bordro Kayıtları',
  });
}

/**
 * Export complete finance report to Excel
 */
export async function exportFinanceReportToExcel(
  data: {
    payments: Payment[];
    documents: (OrderDocument & { orderNumber?: string })[];
    employees: Employee[];
    ledgerEntries: (EmployeeLedgerEntry & { employeeName?: string })[];
  },
  filename: string = 'finans_raporu'
): Promise<void> {
  await exportToExcelMultiSheet({
    filename,
    sheets: [
      { name: 'Ödemeler', data: data.payments, columns: PAYMENT_EXPORT_COLUMNS },
      { name: 'Belgeler', data: data.documents, columns: DOCUMENT_EXPORT_COLUMNS },
      { name: 'Çalışanlar', data: data.employees, columns: EMPLOYEE_EXPORT_COLUMNS },
      { name: 'Bordro', data: data.ledgerEntries, columns: LEDGER_EXPORT_COLUMNS },
    ],
  });
}
