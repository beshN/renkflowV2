import 'server-only';
import { unzipSync, strFromU8 } from 'fflate';
import { parseStringPromise } from 'xml2js';
import { pdfTextItems } from '@/lib/features/warehouse/count-import/extract';

export type DeliveryFile = { name: string; contentType: string; bytes: Buffer };
const MAX_BYTES = 8 * 1024 * 1024;

/** Reads the actual bytes being stored, never a model's claim about what the file contains. */
export async function inspectDelivery(file: DeliveryFile): Promise<string> {
  if (!file.bytes.length || file.bytes.length > MAX_BYTES) throw new Error('Dosya inceleme boyut sınırı dışında.');
  if (/\.(docx|xlsx|pptx)$/i.test(file.name)) {
    let total = 0;
    const entries = unzipSync(file.bytes, { filter: entry => {
      const wanted = /^(word\/(document|header\d+|footer\d+)|xl\/(sharedStrings|worksheets\/sheet\d+)|ppt\/slides\/slide\d+)\.xml$/.test(entry.name);
      if (!wanted) return false;
      total += entry.originalSize;
      if (total > MAX_BYTES) throw new Error('Belgenin açılmış içeriği çok büyük.');
      return true;
    } });
    const parsed = new Map<string, any>();
    for (const [name, data] of Object.entries(entries)) {
      const xml = strFromU8(data);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Belge XML tanımı desteklenmiyor.');
      parsed.set(name, await parseStringPromise(xml));
    }
    const lines: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === 'string') { if (v.trim()) lines.push(v); return; }
      if (Array.isArray(v)) { v.forEach(walk); return; }
      if (v && typeof v === 'object') for (const [key, value] of Object.entries(v)) if (key !== '$') walk(value);
    };
    for (const name of Object.keys(entries).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
      lines.push(`\n${name}\n`);
      const document = parsed.get(name);
      if (name.startsWith('xl/worksheets/')) {
        const strings = parsed.get('xl/sharedStrings.xml')?.sst?.si ?? [];
        const sharedText = (value: any): string => typeof value === 'string' ? value : value?._ ?? (value?.t ?? value?.r ?? []).map(sharedText).join('');
        const rows = document?.worksheet?.sheetData?.[0]?.row ?? document?.worksheet?.row ?? [];
        for (const row of rows) {
          lines.push((row.c ?? []).map((cell: any) => {
            const raw = cell.v?.[0] ?? '';
            const value = cell.$?.t === 's' ? sharedText(strings[Number(raw)]) : cell.$?.t === 'inlineStr' ? sharedText(cell.is?.[0]) : raw;
            return `${cell.$?.r ?? '?'}: ${value}${cell.f?.length ? ` (formül: ${cell.f[0]}, kayıtlı sonuç; yeniden hesaplanmadı)` : ''}`;
          }).join(' | '));
        }
      } else if (name !== 'xl/sharedStrings.xml') walk(document);
    }
    const text = lines.join('\n');
    if (!text.trim() || text.length > 60000) throw new Error('Belge tam olarak incelenemiyor.');
    return text;
  }
  if (file.contentType === 'application/pdf') return (await pdfTextItems(new Uint8Array(file.bytes), 30)).map(v => v.text).join('\n');
  if (/^(text\/|image\/svg\+xml)/.test(file.contentType)) {
    const text = file.bytes.toString('utf8');
    if (text.length > 60000) throw new Error('Metin tam olarak incelenemiyor.');
    return text;
  }
  throw new Error('Dosya türü metin incelemesini desteklemiyor.');
}
