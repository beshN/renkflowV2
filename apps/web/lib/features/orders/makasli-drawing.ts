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
export type DrawingEntity =
  | {
      kind: "line";
      layer: "KONTUR" | "OLCU_ETIKET";
      x: number;
      y: number;
      x2: number;
      y2: number;
    }
  | {
      kind: "text";
      layer: "OLCU_ETIKET";
      x: number;
      y: number;
      value: string;
      height: number;
    };
export type DrawingGeometry = { entities: DrawingEntity[]; mmPerUnit: number };

/** Shared sheet geometry; coordinates use the existing SVG view, with an explicit mm scale. */
export function makasliGeometry(measures: DrawingMeasures) {
  const missing = (Object.keys(fields) as Array<keyof DrawingMeasures>).filter(
    (k) =>
      typeof measures[k] !== "number" ||
      !Number.isFinite(measures[k]) ||
      measures[k]! <= 0,
  );
  if (missing.length)
    return {
      geometry: null,
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
  const entities: DrawingEntity[] = [];
  const text = (x: number, y: number, value: string, height = 13) => {
    entities.push({ kind: "text", layer: "OLCU_ETIKET", x, y, value, height });
  };
  const line = (
    x: number,
    y: number,
    x2: number,
    y2: number,
    layer: "KONTUR" | "OLCU_ETIKET" = "KONTUR",
  ) => {
    entities.push({ kind: "line", layer, x, y, x2, y2 });
  };
  const dimension = (x: number, y: number, x2: number, label: string) => {
    line(x, y, x2, y, "OLCU_ETIKET");
    line(x, y - 5, x, y + 5, "OLCU_ETIKET");
    line(x2, y - 5, x2, y + 5, "OLCU_ETIKET");
    text((x + x2) / 2, y - 9, label, 16);
  };
  line(50, 300, 50 + fw, 300);
  line(50, 300 - sh, 50 + fw, 300 - sh);
  line(50, 300, 50, 300 - sh);
  line(50 + fw, 300, 50 + fw, 300 - sh);
  dimension(50, 65, 50 + fw, `Genişlik: ${mm(w)} mm`);
  line(455, 300, 455, 300 - sh);
  line(450, 300, 460, 300);
  line(450, 300 - sh, 460, 300 - sh);
  line(480, 300, 480, 300 - sh);
  line(480, 300 - sh, 480 + sp, 300 - sh);
  line(470, 300, 490 + sp, 300);
  dimension(480, 65, 480 + sp, `Açılım/çıkma: ${mm(p)} mm`);
  text(50 + fw / 2, 30, "Önden görünüş");
  text(480 + sp / 2, 30, "Yandan görünüş");
  text(50 + fw / 2, 330, `Montaj yüksekliği: ${mm(h)} mm`);
  text(480 + sp / 2, 330, `Montaj yüksekliği: ${mm(h)} mm`);
  text(
    400,
    365,
    "Ölçü şeması · Eğim, kol yerleşimi ve profil kesiti tanımlamaz",
  );
  return { message: null, geometry: { entities, mmPerUnit: 1 / scale } };
}

export function makasliDrawing(measures: DrawingMeasures, title: string) {
  const { geometry, message } = makasliGeometry(measures);
  if (!geometry) return { svg: null, message };
  return { message: null, svg: drawingSvg(geometry, title) };
}

export function drawingSvg(geometry: DrawingGeometry, title: string) {
  const render = (e: DrawingEntity) =>
    e.kind === "line"
      ? `<path d="M${e.x} ${e.y} L${e.x2} ${e.y2}"/>`
      : `<text x="${e.x}" y="${e.y}" fill="#111" stroke="none" text-anchor="middle">${escapeXml(e.value)}</text>`;
  // Preserve the existing SVG grouping, fonts and output.
  const content = geometry.entities.slice(0, -5).map(render).join("");
  const labels = geometry.entities.slice(-5).map(render).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><g fill="none" stroke="#111" stroke-width="1.5">${content}</g><g fill="#111" font-family="sans-serif" font-size="13">${labels}</g></svg>`;
}
