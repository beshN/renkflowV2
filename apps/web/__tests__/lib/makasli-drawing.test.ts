import { makasliDrawing } from "@/lib/features/orders/makasli-drawing";
const measures = { widthMm: 6137, projectionMm: 3123, mountingHeightMm: 2876 }; // Synthetic fixture.
test("uses exact saved mm labels and proportional views without mechanism assumptions", () => {
  const { svg } = makasliDrawing(measures, "Çığ Şirketi");
  expect(svg).toContain("Genişlik: 6137 mm");
  expect(svg).toContain("Açılım/çıkma: 3123 mm");
  expect(svg).toContain("Montaj yüksekliği: 2876 mm");
  expect(svg).toContain("Önden görünüş");
  expect(svg).toContain("Yandan görünüş");
  expect(svg).not.toContain("170");
});
test.each([null, 0, -1, NaN, Infinity])(
  "missing/invalid dimension %s produces no SVG",
  (value) => {
    expect(
      makasliDrawing({ ...measures, projectionMm: value }, "Test"),
    ).toEqual({ svg: null, message: "ölçü eksik: açılım/çıkma" });
  },
);
test("reports every missing field", () => {
  expect(
    makasliDrawing(
      { widthMm: null, projectionMm: null, mountingHeightMm: null },
      "Test",
    ).message,
  ).toBe("ölçü eksik: genişlik, açılım/çıkma, montaj yüksekliği");
});
test("preserves Turkish and escapes XML in text and attribute context", () => {
  const { svg } = makasliDrawing(measures, "Çığ Şİ <script> & \"'");
  expect(svg).toContain("Çığ Şİ &lt;script&gt; &amp; &quot;&apos;");
  expect(svg).not.toContain("<script>");
  expect(
    new DOMParser()
      .parseFromString(svg!, "image/svg+xml")
      .querySelector("parsererror"),
  ).toBeNull();
});

test("formats decimal mm with Turkish comma without losing saved precision", () => {
  const { svg } = makasliDrawing({ ...measures, widthMm: 5000.5 }, "Test");
  expect(svg).toContain("Genişlik: 5000,5 mm");
});
