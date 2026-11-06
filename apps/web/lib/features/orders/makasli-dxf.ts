import type { DrawingGeometry } from "./makasli-drawing";

/** R12 TEXT uses ASCII: Turkish transliteration, no codepage/font dependency.
 * Strip control characters and escape DXF's %% formatting introducer.
 */
export function dxfText(value: string): string {
  return value
    .replace(
      /[ıİşŞğĞçÇöÖüÜ]/g,
      (c) =>
        ({
          ı: "i",
          İ: "I",
          ş: "s",
          Ş: "S",
          ğ: "g",
          Ğ: "G",
          ç: "c",
          Ç: "C",
          ö: "o",
          Ö: "O",
          ü: "u",
          Ü: "U",
        })[c]!,
    )
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/%/g, "?");
}

type Sheet = {
  orderNumber: string;
  lines: ReadonlyArray<{
    productName: string;
    geometry: DrawingGeometry | null;
    message: string | null;
  }>;
};

/** Pure ASCII DXF export of the shared sheet model. Layout offsets are mm;
 * saved measurements are never combined with quantities or converted from another unit.
 */
export function makasliDxf(sheet: Sheet): string {
  const pairs: Array<string | number> = [];
  const pair = (code: number, value: string | number) => {
    pairs.push(code, value);
  };
  const text = (
    x: number,
    y: number,
    height: number,
    value: string,
    centered = false,
  ) => {
    // R12 TEXT has a 255-byte limit; split long user text rather than truncate it.
    const safe = dxfText(value);
    for (let i = 0; i < Math.max(1, safe.length); i += 250) {
      pair(0, "TEXT");
      pair(8, "OLCU_ETIKET");
      pair(10, x);
      pair(20, y - (i / 250) * height * 1.5);
      pair(30, 0);
      pair(40, height);
      pair(1, safe.slice(i, i + 250));
      if (centered) {
        pair(72, 1);
        pair(11, x);
        pair(21, y - (i / 250) * height * 1.5);
        pair(31, 0);
      }
    }
  };
  pair(0, "SECTION");
  pair(2, "HEADER");
  pair(9, "$ACADVER");
  pair(1, "AC1009");
  pair(9, "$INSUNITS");
  pair(70, 4);
  pair(9, "$MEASUREMENT");
  pair(70, 1);
  pair(0, "ENDSEC");
  pair(0, "SECTION");
  pair(2, "TABLES");
  pair(0, "TABLE");
  pair(2, "LAYER");
  pair(70, 2);
  for (const [name, color] of [
    ["KONTUR", 7],
    ["OLCU_ETIKET", 3],
  ] as const) {
    pair(0, "LAYER");
    pair(2, name);
    pair(70, 0);
    pair(62, color);
    pair(6, "CONTINUOUS");
  }
  pair(0, "ENDTAB");
  pair(0, "ENDSEC");
  pair(0, "SECTION");
  pair(2, "BLOCKS");
  pair(0, "ENDSEC");
  pair(0, "SECTION");
  pair(2, "ENTITIES");
  text(0, 500, 60, `Imalat olcu foyu: ${sheet.orderNumber}`);
  text(
    0,
    400,
    60,
    "Imalat oncesi insan onayi gerekir; onayli teknik plan yerine gecmez.",
  );
  let offset = 0;
  for (const [index, line] of sheet.lines.entries()) {
    const g = line.geometry;
    text(0, offset + 150, 60, `${index + 1}. ${line.productName}`);
    if (!g) {
      text(0, offset, 60, line.message || "olcu eksik");
      offset -= 500;
      continue;
    }
    const unit = g.mmPerUnit;
    if (!Number.isFinite(unit) || unit <= 0)
      throw new Error("Invalid drawing scale");
    for (const entity of g.entities) {
      if (entity.kind === "line") {
        pair(0, "LINE");
        pair(8, entity.layer);
        pair(10, entity.x * unit);
        pair(20, offset - entity.y * unit);
        pair(30, 0);
        pair(11, entity.x2 * unit);
        pair(21, offset - entity.y2 * unit);
        pair(31, 0);
      } else {
        text(
          entity.x * unit,
          offset - entity.y * unit,
          entity.height * unit,
          entity.value,
          true,
        );
      }
    }
    offset -= 420 * unit + 500;
  }
  if (!sheet.lines.length) text(0, 0, 60, "Makasli tente kalemi yok.");
  pair(0, "ENDSEC");
  pair(0, "EOF");
  return pairs.join("\r\n") + "\r\n";
}
