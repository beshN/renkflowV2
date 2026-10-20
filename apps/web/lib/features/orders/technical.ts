import { z } from "zod";
import type { FoyDoc } from "../foy/types";

export const TECHNICAL_FAMILIES = [
  "makasli",
  "pergola",
  "wind-manual",
  "wind-piston",
  "giyotin",
  "other",
] as const;
export type TechnicalFamily = (typeof TECHNICAL_FAMILIES)[number];
export const FAMILY_LABELS: Record<TechnicalFamily, string> = {
  makasli: "Makaslı tente",
  pergola: "Pergola",
  "wind-manual": "Manuel rüzgâr kırıcı",
  "wind-piston": "Pistonlu rüzgâr kırıcı",
  giyotin: "Motorlu giyotin",
  other: "Ortak işler",
};
export function technicalFamily(name: string): TechnicalFamily {
  const n = name.toLocaleLowerCase("tr-TR");
  return /makas|winmax/.test(n)
    ? "makasli"
    : /pergola/.test(n)
      ? "pergola"
      : /giyotin/.test(n)
        ? "giyotin"
        : /piston/.test(n)
          ? "wind-piston"
          : /rüzg|ruzgar/.test(n)
            ? "wind-manual"
            : "other";
}
export const MAIN_PROCESS = [
  "Teklif",
  "Müşteri onayı",
  "Liste bekleniyor",
  "Teknik planlama",
  "İmalat",
  "Teslimata hazır",
  "Araca yüklendi",
  "Teslim edildi",
];
export function mainProcessIndex(input: {
  quoteStatus?: string | null;
  provisional?: boolean;
  status: string;
  hasDocument: boolean;
  released: boolean;
}) {
  if (input.provisional) return input.quoteStatus === "draft" ? 0 : 1;
  if (["completed", "delivered"].includes(input.status)) return 7;
  if (input.status === "shipped") return 6;
  if (["ready", "ready_for_shipment"].includes(input.status)) return 5;
  if (input.released) return 4;
  return input.hasDocument ? 3 : 2;
}
const DrillCoordinates = z
  .object({
    reference: z.enum(["start", "end"]),
    face: z.string().trim().min(1).max(80),
    diameterMm: z.number().positive().max(100),
    edgeDistanceMm: z.number().nonnegative(),
    offsetsMm: z.array(z.number().finite().nonnegative()).min(1).max(100),
  })
  .strict();
export const DrillRuleSchema = z.union([
  DrillCoordinates,
  z
    .object({
      mode: z.literal("none"),
      reason: z.string().trim().min(5).max(500),
    })
    .strict(),
]);
export function drillPositions(lengthMm: number, raw: unknown) {
  const rule = DrillRuleSchema.parse(raw);
  if ("mode" in rule)
    return {
      ...rule,
      positionsMm: [],
      reference: null,
      face: null,
      diameterMm: null,
      edgeDistanceMm: null,
    };
  const positions = rule.offsetsMm
    .map((n) => (rule.reference === "start" ? n : lengthMm - n))
    .sort((a, b) => a - b);
  if (
    new Set(positions).size !== positions.length ||
    positions.some(
      (n) =>
        n - rule.diameterMm / 2 < rule.edgeDistanceMm ||
        n + rule.diameterMm / 2 > lengthMm - rule.edgeDistanceMm,
    )
  )
    throw new Error(
      "Delik konumu veya kenar mesafesi parça boyuna uygun değil",
    );
  return { ...rule, positionsMm: positions };
}
/** Sheet values remain separate from mounting height: the side view is not its proof. */
export function sheetMeasures(doc: FoyDoc) {
  if (doc.template === "windbreaker" && doc.windbreaker) {
    const w = doc.windbreaker;
    return Array.from({ length: Math.min(w.systemCount || 0, 1000) }, () => ({
      widthMm: w.widthCm == null ? null : w.widthCm * 10,
      projectionMm: null,
      heightMm: w.heightCm == null ? null : w.heightCm * 10,
      bays: [] as Array<{
        ironInnerMm: number | null;
        railInnerMm: number | null;
      }>,
      source: "document" as const,
    }));
  }
  return doc.systems.map((s) => ({
    widthMm: s.railOuter == null ? null : s.railOuter * 10,
    projectionMm: s.projection == null ? null : s.projection * 10,
    heightMm: null as number | null,
    bays: s.bays.map((b) => ({
      ironInnerMm: b.ironInner == null ? null : b.ironInner * 10,
      railInnerMm: b.railInner == null ? null : b.railInner * 10,
    })),
    source: "document" as const,
  }));
}
