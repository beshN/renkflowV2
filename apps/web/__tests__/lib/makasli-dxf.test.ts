import DxfParser, { type ILineEntity } from "dxf-parser";
import { makasliGeometry } from "@/lib/features/orders/makasli-drawing";
import { dxfText, makasliDxf } from "@/lib/features/orders/makasli-dxf";
const measures = {
  widthMm: 6137.5,
  projectionMm: 3123,
  mountingHeightMm: 2876,
}; // Synthetic only.
const sheet = (projectionMm: number | null = measures.projectionMm) => ({
  orderNumber: "TEST-Çığ",
  lines: [
    {
      productName: "Makaslı tente Şİ",
      ...makasliGeometry({ ...measures, projectionMm }),
    },
  ],
});
test("balanced sections, EOF, R12 and explicit mm units; independent parser round trip", () => {
  const dxf = makasliDxf(sheet());
  const tokens = dxf.trim().split(/\r?\n/);
  const sections: string[] = [];
  let open = false;
  for (let i = 0; i < tokens.length; i += 2) {
    if (tokens[i] !== "0") continue;
    if (tokens[i + 1] === "SECTION") {
      expect(open).toBe(false);
      open = true;
      sections.push(tokens[i + 3]);
    }
    if (tokens[i + 1] === "ENDSEC") {
      expect(open).toBe(true);
      open = false;
    }
  }
  expect(open).toBe(false);
  expect(sections).toEqual(["HEADER", "TABLES", "BLOCKS", "ENTITIES"]);
  expect(tokens.slice(-2)).toEqual(["0", "EOF"]);
  const parsed = new DxfParser().parseSync(dxf)!;
  expect(parsed.header.$ACADVER).toBe("AC1009");
  expect(parsed.header.$INSUNITS).toBe(4);
  expect(Object.keys(parsed.tables.layer.layers)).toEqual([
    "KONTUR",
    "OLCU_ETIKET",
  ]);
  const contours = parsed.entities.filter(
    (e) => e.type === "LINE" && e.layer === "KONTUR",
  ) as ILineEntity[];
  const lengths = contours.map(({ vertices: [a, b] }) =>
    Math.hypot(a.x - b.x, a.y - b.y),
  );
  expect(lengths.some((n) => Math.abs(n - measures.widthMm) < 1e-8)).toBe(true);
  expect(lengths.some((n) => Math.abs(n - measures.projectionMm) < 1e-8)).toBe(
    true,
  );
  expect(
    lengths.some((n) => Math.abs(n - measures.mountingHeightMm) < 1e-8),
  ).toBe(true);
  expect(
    parsed.entities
      .filter((e) => e.type === "TEXT")
      .every((e) => e.layer === "OLCU_ETIKET"),
  ).toBe(true);
});
test.each([null, 0, -1, NaN, Infinity])(
  "missing/invalid projection %s exports a note and no geometry",
  (value) => {
    const dxf = makasliDxf(sheet(value));
    const entities = new DxfParser().parseSync(dxf)!.entities;
    expect(entities.some((e) => e.type === "LINE")).toBe(false);
    expect(dxf).toContain("olcu eksik: acilim/cikma");
    expect(dxf).not.toContain("6137");
  },
);
test("Turkish labels are safe ASCII; newline and DXF formatting cannot inject entities", () => {
  const value = "Çığ Şİ öÖ üÜ çÇ ıİ şŞ ğĞ\n0\nLINE %%d";
  expect(dxfText(value)).toBe("Cig SI oO uU cC iI sS gG 0 LINE ??d");
  const dxf = makasliDxf({ ...sheet(), orderNumber: value });
  expect(dxf).toMatch(/^[\x20-\x7e\r\n]*$/);
  expect(dxf).toContain("Makasli tente SI");
  expect(dxf).toContain("Genislik: 6137,5 mm");
  expect(dxf).toContain("profil kesiti");
});
test("multiple sheets use separate layout offsets; missing line does not suppress valid line", () => {
  const good = sheet().lines[0];
  const mixed = {
    orderNumber: "TEST",
    lines: [good, sheet(null).lines[0], good],
  };
  const entities = new DxfParser().parseSync(makasliDxf(mixed))!.entities;
  const lines = entities.filter((e) => e.type === "LINE");
  expect(lines).toHaveLength(
    new DxfParser()
      .parseSync(makasliDxf(sheet()))!
      .entities.filter((e) => e.type === "LINE").length * 2,
  );
});
