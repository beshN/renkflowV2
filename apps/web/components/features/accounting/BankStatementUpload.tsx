'use client';

import { ChangeEvent, useState } from 'react';
import { FileUp } from 'lucide-react';
import { importBankStatementLines } from '@/app/actions/accounting.actions';
import { parseBankStatement, type ParsedStatement } from '@/lib/features/accounting/bank-statement';
import { formatCurrency } from '@/lib/shared/utils';

const FORMAT_LABELS = { csv: 'CSV', mt940: 'MT940', ofx: 'OFX' } as const;
const CHUNK = 1000;
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Reads a bank statement file in the browser (CSV, MT940, OFX), shows what it found, and imports
 * it on confirmation. Re-uploading the same file adds nothing and keeps existing matches.
 */
export function BankStatementUpload({ disabled, onImported }: { disabled?: boolean; onImported: (message: string) => void | Promise<void> }) {
  const [parsed, setParsed] = useState<(ParsedStatement & { fileName: string }) | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setError('');
    setParsed(null);
    if (!file) return;
    if (file.size > MAX_BYTES) { setError('Dosya 5 MB sınırını aşıyor'); return; }
    const buffer = await file.arrayBuffer();
    // Turkish bank exports are UTF-8 or Windows-1254; the UTF-8 decode shows U+FFFD when it is the latter.
    let text = new TextDecoder('utf-8').decode(buffer);
    if (text.includes('�')) text = new TextDecoder('windows-1254').decode(buffer);
    try {
      setParsed({ ...parseBankStatement(text), fileName: file.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dosya okunamadı');
    }
  }

  async function importAll() {
    if (!parsed) return;
    setBusy(true);
    let imported = 0;
    let skipped = 0;
    try {
      for (let i = 0; i < parsed.lines.length; i += CHUNK) {
        const r = await importBankStatementLines({ lines: parsed.lines.slice(i, i + CHUNK).map((l) => ({ statementDate: l.statementDate, description: l.description, amount: l.amount, reference: l.reference ?? undefined, externalId: l.externalId })) });
        if (!r.success) { setError(r.error || 'İçe aktarılamadı'); return; }
        imported += r.importedCount;
        skipped += r.skippedCount ?? 0;
      }
      setParsed(null);
      await onImported(`${imported} banka hareketi aktarıldı${skipped ? `, ${skipped} hareket zaten vardı` : ''}`);
    } finally {
      setBusy(false);
    }
  }

  const total = parsed ? parsed.lines.reduce((s, l) => s + l.amount, 0) : 0;
  return (
    <div className="mb-4 space-y-2 rounded-lg border border-dashed border-slate-300 p-3 text-xs dark:border-slate-700">
      <label className="inline-flex cursor-pointer items-center gap-2 font-medium">
        <FileUp size={14} aria-hidden />
        <span>Ekstre dosyası yükle (CSV, MT940, OFX)</span>
        <input type="file" accept=".csv,.txt,.tsv,.sta,.mt940,.940,.ofx,.qfx" className="sr-only" disabled={disabled || busy} onChange={(e) => void pick(e)} />
      </label>
      {error && <p role="alert" className="text-rose-700 dark:text-rose-300">{error}</p>}
      {parsed && (
        <div className="space-y-2">
          <p>
            <strong>{parsed.fileName}</strong> · {FORMAT_LABELS[parsed.format]} · {parsed.lines.length} hareket · net {formatCurrency(total, 'TRY')}
            {parsed.accountRef ? ` · hesap ${parsed.accountRef}` : ''}
          </p>
          {parsed.warnings.length > 0 && (
            <details><summary className="cursor-pointer text-amber-700 dark:text-amber-300">{parsed.warnings.length} uyarı</summary>
              <ul className="list-disc pl-4">{parsed.warnings.slice(0, 20).map((w) => <li key={w}>{w}</li>)}</ul>
            </details>
          )}
          <table className="w-full">
            <tbody>
              {parsed.lines.slice(0, 8).map((l) => (
                <tr key={l.externalId} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-1 pr-2 tabular-nums">{l.statementDate.split('-').reverse().join('.')}</td>
                  <td className="py-1 pr-2">{l.description}</td>
                  <td className={`py-1 text-right tabular-nums ${l.amount < 0 ? 'text-rose-700 dark:text-rose-300' : ''}`}>{formatCurrency(l.amount, 'TRY')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {parsed.lines.length > 8 && <p className="text-slate-500">… ve {parsed.lines.length - 8} hareket daha</p>}
          <div className="flex gap-2">
            <button type="button" className="rf-primary-button text-xs" disabled={busy || disabled} onClick={() => void importAll()}>{busy ? 'Aktarılıyor…' : `${parsed.lines.length} hareketi aktar`}</button>
            <button type="button" className="rf-secondary-button text-xs" onClick={() => setParsed(null)}>Vazgeç</button>
          </div>
        </div>
      )}
    </div>
  );
}
