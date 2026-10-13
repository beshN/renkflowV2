import 'server-only';

import type { FoyItem, FoyLayout, FoySegment } from './layout';

type Matrix = [number, number, number, number, number, number];
const mul = (m: number[], n: number[]): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

/**
 * Text runs and short drawn lines of a föy PDF in viewport space (rotation applied). No OCR: a
 * scanned or photographed sheet yields no items and its pages are reported as image pages.
 */
export async function foyLayout(bytes: Uint8Array, maxPages = 8): Promise<FoyLayout> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const OPS = pdfjs.OPS;
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  try {
    if (doc.numPages > maxPages) throw new Error(`Föy en fazla ${maxPages} sayfa olabilir (${doc.numPages} sayfa).`);
    const items: FoyItem[] = [];
    const segments: FoySegment[] = [];
    const imagePages: number[] = [];
    for (let page = 1; page <= doc.numPages; page++) {
      const p = await doc.getPage(page);
      const V = p.getViewport({ scale: 1 }).transform;
      const content = await p.getTextContent();
      let textCount = 0;
      for (const it of content.items) {
        if (!('str' in it) || !it.str.trim()) continue;
        const m = mul(V, it.transform);
        textCount++;
        items.push({
          page, x: Math.round(m[4] * 10) / 10, y: Math.round(m[5] * 10) / 10,
          size: Math.round(Math.hypot(m[0], m[1]) * 10) / 10,
          angle: Math.round((Math.atan2(m[1], m[0]) * 180) / Math.PI),
          text: it.str,
        });
      }
      const ops = await p.getOperatorList();
      let ctm: number[] = [1, 0, 0, 1, 0, 0];
      const stack: number[][] = [];
      let images = 0;
      const at = (x: number, y: number) => {
        const m = mul(V, ctm);
        return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] as const;
      };
      const keep = (a: readonly number[], b: readonly number[]) => {
        // Only short lines matter (check boxes and their crosses); the long ones are the drawing.
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 25) segments.push({ page, s: [a[0], a[1], b[0], b[1]].map((v) => Math.round(v * 10) / 10) as FoySegment['s'] });
      };
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i];
        if (fn === OPS.save) stack.push(ctm);
        else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
        else if (fn === OPS.transform) ctm = mul(ctm, args);
        else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) images++;
        else if (fn === OPS.constructPath && page === 1) {
          const [kinds, data] = args as [number[], ArrayLike<number>];
          let k = 0;
          let cur: readonly number[] | null = null;
          let start: readonly number[] | null = null;
          for (const op of kinds) {
            if (op === OPS.moveTo) { cur = at(data[k], data[k + 1]); start = cur; k += 2; }
            else if (op === OPS.lineTo) { const nxt = at(data[k], data[k + 1]); k += 2; if (cur) keep(cur, nxt); cur = nxt; }
            else if (op === OPS.curveTo) k += 6;
            else if (op === OPS.curveTo2 || op === OPS.curveTo3) k += 4;
            else if (op === OPS.rectangle) {
              const [x, y, w, h] = [data[k], data[k + 1], data[k + 2], data[k + 3]];
              k += 4;
              const c = [at(x, y), at(x + w, y), at(x + w, y + h), at(x, y + h)];
              for (let j = 0; j < 4; j++) keep(c[j], c[(j + 1) % 4]);
            } else if (op === OPS.closePath) { if (cur && start) keep(cur, start); cur = start; }
          }
        }
      }
      if (images > 0 && textCount <= 3) imagePages.push(page);
      p.cleanup();
    }
    return { pageCount: doc.numPages, items, segments, imagePages };
  } finally {
    await doc.destroy();
  }
}
