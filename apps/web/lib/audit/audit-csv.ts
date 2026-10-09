/** CSV of audit rows (Excel-friendly: BOM, semicolons, formula-safe cells). */
export type AuditCsvRow = {
  created_at: string | Date; actor_name: string | null; action: string; entity_type: string; entity_id: string;
  note: string | null; changes: unknown; metadata: unknown;
};

/** A cell that a spreadsheet cannot run as a formula. */
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function auditCsv(rows: AuditCsvRow[], labels: { action: (a: string) => string; entity: (e: string) => string }) {
  const head = ['Zaman', 'Kim', 'Ne', 'Kayıt türü', 'Kayıt', 'Not', 'Değişiklik', 'Ayrıntı'];
  const lines = rows.map((r) => [
    new Date(r.created_at).toISOString(), r.actor_name ?? 'Sistem', labels.action(r.action), labels.entity(r.entity_type), r.entity_id, r.note, r.changes, r.metadata,
  ].map(csvCell).join(';'));
  return '﻿' + [head.join(';'), ...lines].join('\r\n');
}
