/**
 * Export Utilities
 * CSV, Excel, PDF, JSON export functionality
 */

import { Order } from '@/lib/types';
import { formatCurrency, formatDate, getOrderStatusInfo } from '@/lib/utils';

// ============================================
// Types
// ============================================

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';

export interface ExportOptions {
  filename?: string;
  columns?: string[];
  includeHeaders?: boolean;
}

// ============================================
// Guards & Limits
// ============================================

const MAX_EXPORT_ROWS = 10_000;

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_\-\sçğıöşüÇĞİÖŞÜ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 100) || 'export';
}

function guardExport(orders: Order[]): { ok: true } | { ok: false; message: string } {
  if (!orders || orders.length === 0) {
    return { ok: false, message: 'Dışa aktarılacak veri bulunamadı.' };
  }
  if (orders.length > MAX_EXPORT_ROWS) {
    return { ok: false, message: `Maksimum ${MAX_EXPORT_ROWS.toLocaleString('tr-TR')} satır dışa aktarılabilir. Lütfen filtreleri daraltın.` };
  }
  return { ok: true };
}

// ============================================
// Column Definitions
// ============================================

const columnDefinitions: Record<string, { label: string; getValue: (order: Order) => string }> = {
  id: { label: 'Sipariş ID', getValue: (o) => o.id },
  orderNumber: { label: 'Sipariş No', getValue: (o) => o.orderNumber || o.id },
  customerName: { label: 'Müşteri', getValue: (o) => o.customerName || '' },
  email: { label: 'E-posta', getValue: (o) => o.email || '' },
  phone: { label: 'Telefon', getValue: (o) => o.phone || '' },
  productName: { label: 'Ürün', getValue: (o) => o.productName || '' },
  quantity: { label: 'Miktar', getValue: (o) => String(o.quantity || 0) },
  totalAmount: { label: 'Tutar', getValue: (o) => formatCurrency(o.totalAmount || 0, o.currency) },
  status: { label: 'Durum', getValue: (o) => getOrderStatusInfo(o.status)?.label || o.status },
  deliveryDate: { label: 'Teslim Tarihi', getValue: (o) => formatDate(o.deliveryDate) },
  date: { label: 'Sipariş Tarihi', getValue: (o) => formatDate(o.date) },
  createdAt: { label: 'Oluşturulma', getValue: (o) => formatDate(o.createdAt) },
  notes: { label: 'Açıklama', getValue: (o) => o.notes || '' },
};

const defaultColumns = ['orderNumber', 'customerName', 'productName', 'quantity', 'totalAmount', 'status', 'deliveryDate'];

// ============================================
// CSV Export
// ============================================

export function exportToCSV(orders: Order[], options: ExportOptions = {}): void {
  const guard = guardExport(orders);
  if (!guard.ok) { alert(guard.message); return; }

  const {
    filename = `siparisler_${new Date().toISOString().split('T')[0]}`,
    columns = defaultColumns,
    includeHeaders = true,
  } = options;
  const safeFilename = sanitizeFilename(filename);

  const rows: string[][] = [];

  // Add headers
  if (includeHeaders) {
    rows.push(columns.map((col) => columnDefinitions[col]?.label || col));
  }

  // Add data rows
  orders.forEach((order) => {
    rows.push(columns.map((col) => {
      const def = columnDefinitions[col];
      const value = def ? def.getValue(order) : '';
      // Escape quotes and wrap in quotes if contains comma
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }));
  });

  // Create CSV content
  const csvContent = rows.map((row) => row.join(',')).join('\n');
  
  // Add BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

  downloadBlob(blob, `${safeFilename}.csv`);
}

// ============================================
// Excel Export (using CSV with Excel-friendly formatting)
// ============================================

export function exportToExcel(orders: Order[], options: ExportOptions = {}): void {
  const guard = guardExport(orders);
  if (!guard.ok) { alert(guard.message); return; }

  const {
    filename = `siparisler_${new Date().toISOString().split('T')[0]}`,
    columns = defaultColumns,
  } = options;
  const safeFilename = sanitizeFilename(filename);

  // Excel-friendly CSV with BOM and numeric columns preserved
  const rows: string[][] = [];

  // Header row
  rows.push(columns.map((col) => columnDefinitions[col]?.label || col));

  // Data rows
  orders.forEach((order) => {
    rows.push(columns.map((col) => {
      const def = columnDefinitions[col];
      if (!def) return '';
      
      // For amount, keep as number for Excel calculations
      if (col === 'totalAmount') {
        return String(order.totalAmount || 0);
      }
      if (col === 'quantity') {
        return String(order.quantity || 0);
      }
      
      return def.getValue(order);
    }));
  });

  // Add totals row
  const amountColIndex = columns.indexOf('totalAmount');
  const quantityColIndex = columns.indexOf('quantity');
  
  const totalsRow = columns.map((col, idx) => {
    if (idx === 0) return 'TOPLAM';
    if (idx === amountColIndex) {
      const total = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      return String(total);
    }
    if (idx === quantityColIndex) {
      const total = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
      return String(total);
    }
    return '';
  });
  rows.push(totalsRow);

  // Create CSV content
  const csvContent = rows.map((row) => {
    return row.map((cell) => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',');
  }).join('\n');

  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });

  downloadBlob(blob, `${safeFilename}.xls`);
}

// ============================================
// JSON Export
// ============================================

export function exportToJSON(orders: Order[], options: ExportOptions = {}): void {
  const guard = guardExport(orders);
  if (!guard.ok) { alert(guard.message); return; }

  const {
    filename = `siparisler_${new Date().toISOString().split('T')[0]}`,
    columns = defaultColumns,
  } = options;
  const safeFilename = sanitizeFilename(filename);

  // Filter order properties based on columns
  const exportData = orders.map((order) => {
    const filtered: Record<string, unknown> = {};
    columns.forEach((col) => {
      if (col in order) {
        filtered[col] = (order as Record<string, unknown>)[col];
      }
    });
    return filtered;
  });

  const jsonContent = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });

  downloadBlob(blob, `${safeFilename}.json`);
}

// ============================================
// PDF Export (Basic HTML to Print)
// ============================================

export function exportToPDF(orders: Order[], options: ExportOptions = {}): void {
  const guard = guardExport(orders);
  if (!guard.ok) { alert(guard.message); return; }

  const {
    filename = `siparisler_${new Date().toISOString().split('T')[0]}`,
    columns = defaultColumns,
  } = options;

  // Create printable HTML
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${filename}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
        h1 { font-size: 18px; margin-bottom: 10px; }
        .meta { color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: bold; }
        tr:nth-child(even) { background-color: #fafafa; }
        .total { font-weight: bold; background-color: #f0f0f0; }
        @media print {
          body { margin: 0; }
          @page { margin: 1cm; }
        }
      </style>
    </head>
    <body>
      <h1>Sipariş Raporu</h1>
      <div class="meta">
        Oluşturulma: ${new Date().toLocaleString('tr-TR')}<br>
        Toplam: ${orders.length} sipariş
      </div>
      <table>
        <thead>
          <tr>
            ${columns.map((col) => `<th>${columnDefinitions[col]?.label || col}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${orders.map((order) => `
            <tr>
              ${columns.map((col) => {
                const def = columnDefinitions[col];
                return `<td>${def ? def.getValue(order) : ''}</td>`;
              }).join('')}
            </tr>
          `).join('')}
          <tr class="total">
            <td>TOPLAM</td>
            ${columns.slice(1).map((col) => {
              if (col === 'totalAmount') {
                const total = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                const currency = orders[0]?.currency || 'TRY';
                return `<td>${formatCurrency(total, currency)}</td>`;
              }
              if (col === 'quantity') {
                const total = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
                return `<td>${total}</td>`;
              }
              return '<td></td>';
            }).join('')}
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;

  // Open in new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    // Trigger print dialog
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}

// ============================================
// Direct Print
// ============================================

export function printOrders(orders: Order[], options: ExportOptions = {}): void {
  exportToPDF(orders, options);
}

// ============================================
// Helper Functions
// ============================================

function downloadBlob(blob: Blob, filename: string): void {
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
// Export Handler
// ============================================

export function exportOrders(
  orders: Order[],
  format: ExportFormat,
  options: ExportOptions = {}
): void {
  switch (format) {
    case 'csv':
      exportToCSV(orders, options);
      break;
    case 'excel':
      exportToExcel(orders, options);
      break;
    case 'json':
      exportToJSON(orders, options);
      break;
    case 'pdf':
      exportToPDF(orders, options);
      break;
    default:
      console.error('Unsupported export format:', format);
  }
}
