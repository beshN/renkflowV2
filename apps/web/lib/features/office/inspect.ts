import { inflateRawSync } from 'node:zlib';

/**
 * What the office manager can read of a delivered file: the text of Word, Excel and PowerPoint
 * files (their XML inside the zip), plain-text formats as they are, and raster images for the
 * model to look at. Kept small: the manager checks the work, not every byte of it.
 */

export const REVIEW_TEXT_LIMIT = 30_000;

export type Inspected = { name: string; text?: string; image?: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }; note?: string };

/** The entries of a zip archive (Office files are zips); stored and deflated entries only. */
export function unzip(bytes: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) if (bytes.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) return files;
  const count = bytes.readUInt16LE(end + 10);
  let p = bytes.readUInt32LE(end + 16);
  for (let n = 0; n < count && p + 46 <= bytes.length && bytes.readUInt32LE(p) === 0x02014b50; n++) {
    const method = bytes.readUInt16LE(p + 10), size = bytes.readUInt32LE(p + 20);
    const nameLength = bytes.readUInt16LE(p + 28), extra = bytes.readUInt16LE(p + 30), comment = bytes.readUInt16LE(p + 32);
    const local = bytes.readUInt32LE(p + 42);
    const name = bytes.toString('utf8', p + 46, p + 46 + nameLength);
    p += 46 + nameLength + extra + comment;
    if (bytes.readUInt32LE(local) !== 0x04034b50) continue;
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const raw = bytes.subarray(start, start + size);
    try {
      if (method === 0) files.set(name, raw);
      else if (method === 8) files.set(name, inflateRawSync(raw));
    } catch { /* A damaged entry is skipped; the rest can still be read. */ }
  }
  return files;
}

const decode = (xml: string) => xml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
/** Text of an Office XML part: paragraphs and table cells become line breaks and tabs. */
const xmlText = (xml: string) => decode(xml.replace(/<\/(w:p|a:p|row)>/g, '\n').replace(/<\/(w:tc|c)>/g, '\t').replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const byNumber = (a: string, b: string) => Number(a.match(/(\d+)\.xml$/)?.[1] ?? 0) - Number(b.match(/(\d+)\.xml$/)?.[1] ?? 0);

function officeText(name: string, bytes: Buffer): string | undefined {
  const zip = unzip(bytes);
  if (/\.docx$/i.test(name)) return zip.has('word/document.xml') ? xmlText(zip.get('word/document.xml')!.toString('utf8')) : undefined;
  if (/\.pptx$/i.test(name)) {
    const slides = [...zip.keys()].filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort(byNumber);
    return slides.map((k, i) => `--- Slayt ${i + 1} ---\n${xmlText(zip.get(k)!.toString('utf8'))}`).join('\n');
  }
  if (/\.xlsx$/i.test(name)) {
    const shared = [...(zip.get('xl/sharedStrings.xml')?.toString('utf8') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => decode(m[1].replace(/<[^>]+>/g, '')));
    const sheets = [...zip.keys()].filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort(byNumber);
    return sheets.map((k, i) => {
      const rows = [...zip.get(k)!.toString('utf8').matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(row =>
        [...row[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(cell => {
          const formula = cell[2]?.match(/<f[^>]*>([\s\S]*?)<\/f>/)?.[1];
          const value = cell[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? cell[2]?.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '';
          const shown = /t="s"/.test(cell[1]) ? shared[Number(value)] ?? '' : decode(value);
          return formula ? `${shown} (=${decode(formula)})` : shown;
        }).join('\t'));
      return `--- Sayfa ${i + 1} ---\n${rows.join('\n')}`;
    }).join('\n');
  }
  return undefined;
}

export function inspectFile(name: string, contentType: string, bytes: Buffer): Inspected {
  const type = contentType.split(';')[0].trim();
  if (type === 'image/png' || type === 'image/jpeg' || type === 'image/webp') {
    return bytes.length <= 4_500_000 ? { name, image: { mediaType: type, data: bytes.toString('base64') } } : { name, note: 'görsel kontrol için çok büyük' };
  }
  let text: string | undefined;
  if (/\.(docx|pptx|xlsx)$/i.test(name)) text = officeText(name, bytes);
  else if (type.startsWith('text/') || type === 'image/svg+xml' || /\.(txt|csv|html?|svg|md|json)$/i.test(name)) text = bytes.toString('utf8').replace(/^﻿/, '');
  if (text === undefined) return { name, note: `${type} içeriği okunamıyor; yalnızca teslim notuna bakıldı` };
  return { name, text: text.length > REVIEW_TEXT_LIMIT ? `${text.slice(0, REVIEW_TEXT_LIMIT)}\n…(kısaltıldı)` : text };
}
