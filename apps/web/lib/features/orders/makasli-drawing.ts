/** Read-only overall dimensions, not a cutting/drilling or mechanism specification. */
export type DrawingMeasures = {
  widthMm: number | null;
  projectionMm: number | null;
  mountingHeightMm: number | null;
};
const fields = {
  widthMm: "genişlik",
  projectionMm: "açılım/çıkma",
  mountingHeightMm: "montaj yüksekliği",
} as const;
const escapeXml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function makasliDrawing(measures: DrawingMeasures, title: string) {
  const missing = (Object.keys(fields) as Array<keyof DrawingMeasures>).filter(
    (k) =>
      typeof measures[k] !== "number" ||
      !Number.isFinite(measures[k]) ||
      measures[k]! <= 0,
  );
  if (missing.length)
    return {
      svg: null,
      message: `ölçü eksik: ${missing.map((k) => fields[k]).join(", ")}`,
    };
  const w = measures.widthMm!,
    p = measures.projectionMm!,
    h = measures.mountingHeightMm!;
  const mm = (value: number) =>
    value.toLocaleString("tr-TR", {
      useGrouping: false,
      maximumFractionDigits: 3,
    });
  // A common scale preserves the actual width/projection/height proportions in both views.
  const scale = Math.min(320 / w, 240 / p, 210 / h);
  const fw = w * scale,
    sp = p * scale,
    sh = h * scale;
  const text = (x: number, y: number, value: string) =>
    `<text x="${x}" y="${y}" fill="#111" stroke="none" text-anchor="middle">${escapeXml(value)}</text>`;
  const line = (x: number, y: number, x2: number, y2: number) =>
    `<path d="M${x} ${y} L${x2} ${y2}"/>`;
  const dimension = (x: number, y: number, x2: number, label: string) =>
    line(x, y, x2, y) +
    line(x, y - 5, x, y + 5) +
    line(x2, y - 5, x2, y + 5) +
    text((x + x2) / 2, y - 9, label);
  return {
    message: null,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><g fill="none" stroke="#111" stroke-width="1.5">${line(50, 300, 50 + fw, 300)}${line(50, 300 - sh, 50 + fw, 300 - sh)}${line(50, 300, 50, 300 - sh)}${line(50 + fw, 300, 50 + fw, 300 - sh)}${dimension(50, 65, 50 + fw, `Genişlik: ${mm(w)} mm`)}${line(455, 300, 455, 300 - sh)}${line(450, 300, 460, 300)}${line(450, 300 - sh, 460, 300 - sh)}${line(480, 300, 480, 300 - sh)}${line(480, 300 - sh, 480 + sp, 300 - sh)}${line(470, 300, 490 + sp, 300)}${dimension(480, 65, 480 + sp, `Açılım/çıkma: ${mm(p)} mm`)}</g><g fill="#111" font-family="sans-serif" font-size="13">${text(50 + fw / 2, 30, "Önden görünüş")}${text(480 + sp / 2, 30, "Yandan görünüş")}${text(50 + fw / 2, 330, `Montaj yüksekliği: ${mm(h)} mm`)}${text(480 + sp / 2, 330, `Montaj yüksekliği: ${mm(h)} mm`)}${text(400, 365, "Ölçü şeması · Eğim, kol yerleşimi ve profil kesiti tanımlamaz")}</g></svg>`,
  };
}
