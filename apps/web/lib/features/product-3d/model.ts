import type { VisualizationConfiguration } from "./catalog";
export async function createProductModel(c: VisualizationConfiguration) {
  if (c.kind === "zip" || c.kind === "cassette")
    return (await import("./screen-model")).screenModel(c);
  if (
    c.kind === "giyotin" ||
    c.kind === "wind-manual" ||
    c.kind === "wind-piston" ||
    c.kind === "sliding-glass"
  )
    return (await import("./glass-model")).glassModel(c);
  return (await import("./roof-model")).roofModel(c);
}
export type ProductModel = Awaited<ReturnType<typeof createProductModel>>;
