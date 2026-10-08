import 'server-only';

import type { TextItem } from './parse';

/** Positioned text of a PDF (no OCR): what the deterministic count parser reads. */
export async function pdfTextItems(bytes: Uint8Array, maxPages = 20): Promise<TextItem[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  try {
    if (doc.numPages > maxPages) throw new Error(`Sayım listesi en fazla ${maxPages} sayfa olabilir (${doc.numPages} sayfa).`);
    const items: TextItem[] = [];
    for (let page = 1; page <= doc.numPages; page++) {
      const content = await (await doc.getPage(page)).getTextContent();
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        items.push({ page, x: Math.round(item.transform[4]), y: Math.round(item.transform[5]), text: item.str });
      }
    }
    return items;
  } finally {
    await doc.destroy();
  }
}
