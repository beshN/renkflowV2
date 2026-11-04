import { csvCell } from '@/lib/audit/audit-csv';

export type CuttingCsvRow = {
  orderNumber?: string | null; profileCode?: string | null; profileName?: string | null;
  profileLengthMm?: number | null; barPosition: number; piecePosition: number;
  pieceLengthMm?: number | null; remainingMm?: number | null;
  parameterSource?: string | null; status?: string | null;
};

/** One row per physical piece in the stored plan, so quantity is always one.
 * Angles and labels are absent from the current stored piece contract; never infer them.
 */
export function cuttingListCsv(rows: CuttingCsvRow[]): string {
  const head = ['Sipariş no', 'Profil kodu', 'Profil adı', 'Profil boyu (mm)', 'Profil sıra no',
    'Parça sıra no', 'Parça uzunluğu (mm)', 'Adet', 'Açı', 'Etiket / parça kodu', 'Artık (mm)',
    'Tahmini', 'Kesim parametresi kaynağı', 'Plan durumu'];
  return '\uFEFF' + [head.join(';'), ...rows.map(r => [
    r.orderNumber, r.profileCode, r.profileName, r.profileLengthMm, r.barPosition,
    r.piecePosition, r.pieceLengthMm, 1, null, null, r.remainingMm,
    r.parameterSource === 'default' || r.parameterSource === 'unconfirmed' ? 'Evet' : r.parameterSource === 'confirmed' ? 'Hayır' : null,
    r.parameterSource, r.status,
  ].map(value => {
    // Codes such as "-123" are text too; the shared helper otherwise treats them as numbers.
    if (typeof value === 'string' && /^[=+\-@]/.test(value)) value = "'" + value;
    return csvCell(value);
  }).join(';'))].join('\r\n');
}
