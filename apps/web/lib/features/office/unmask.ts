import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

/**
 * Puts the real names and contact details back into a delivered file. The model only ever saw
 * placeholders such as [KİŞİ_1] (KVKK); Word, Excel and PowerPoint files are zip archives of XML,
 * so each part has its placeholders replaced, escaped for XML. Images and PDFs cannot be rewritten
 * and come back as they are; the work instructions keep placeholders out of them.
 */

const PLACEHOLDERS = /\[(?:E-POSTA|IBAN|TELEFON|KİMLİK|KİŞİ)_\d+\]/g;
/** Unpacked size this rewrite works on; a larger archive is stored as delivered. */
const MAX_UNPACKED = 64 * 1024 * 1024;

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function replaceIn(text: string, restore: (placeholder: string) => string, escape: boolean) {
  return text.replace(PLACEHOLDERS, placeholder => {
    const value = restore(placeholder);
    return value === placeholder ? placeholder : escape ? escapeXml(value) : value;
  });
}

export function unmaskFile(file: { name: string; contentType: string; bytes: Buffer }, restore: (placeholder: string) => string): Buffer {
  if (/\.(docx|xlsx|pptx)$/i.test(file.name)) {
    let total = 0;
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(new Uint8Array(file.bytes), { filter: entry => (total += entry.originalSize) <= MAX_UNPACKED });
    } catch {
      return file.bytes;
    }
    if (total > MAX_UNPACKED) return file.bytes;
    let changed = false;
    for (const [name, data] of Object.entries(entries)) {
      if (!/\.(xml|rels)$/i.test(name)) continue;
      const xml = strFromU8(data);
      const next = replaceIn(xml, restore, true);
      if (next !== xml) { entries[name] = strToU8(next); changed = true; }
    }
    return changed ? Buffer.from(zipSync(entries)) : file.bytes;
  }
  const markup = /svg|html|xml/i.test(file.contentType) || /\.(svg|html?|xml)$/i.test(file.name);
  if (/^text\//i.test(file.contentType) || markup || /\.(txt|md|csv|json)$/i.test(file.name)) {
    const text = file.bytes.toString('utf8');
    const next = replaceIn(text, restore, markup);
    return next === text ? file.bytes : Buffer.from(next, 'utf8');
  }
  return file.bytes;
}
