import { z } from "zod";
export const LabelKindSchema = z.enum([
  "item",
  "location",
  "lot",
  "job",
  "cut",
  "product",
]);
export type LabelKind = z.infer<typeof LabelKindSchema>;
export const LABEL_NAMES: Record<LabelKind, string> = {
  item: "Malzeme",
  location: "Raf / konum",
  lot: "Fiziksel lot",
  job: "Üretim emri",
  cut: "Kesim paketi",
  product: "Mamul",
};
export const FactoryCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("location.create"),
    data: z.object({
      warehouseId: z.string().uuid(),
      code: z
        .string()
        .trim()
        .min(2)
        .max(40)
        .regex(
          /^[A-Za-z0-9ÇĞİÖŞÜçğıöşü._-]+$/,
          "Raf kodunda boşluk kullanmayın",
        ),
      name: z.string().trim().min(2).max(100),
      type: z.enum(["shelf", "receiving", "packing"]).default("shelf"),
    }),
  }),
  z.object({
    action: z.literal("label.issue"),
    data: z.object({ kind: LabelKindSchema, id: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("label.print"),
    data: z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }),
  }),
  z.object({
    action: z.literal("transfer"),
    data: z
      .object({
        itemId: z.string().uuid(),
        sourceId: z.string().uuid(),
        targetId: z.string().uuid(),
        lotId: z.string().uuid().optional(),
        quantity: z.number().positive().finite().max(1000000),
        version: z.number().int().positive(),
        note: z.string().trim().max(1000).default(""),
      })
      .refine((d) => d.sourceId !== d.targetId, "Kaynak ve hedef aynı olamaz"),
  }),
  z.object({
    action: z.literal("count.submit"),
    data: z.object({
      itemId: z.string().uuid(),
      locationId: z.string().uuid(),
      quantity: z.number().nonnegative().finite().max(1000000),
      version: z.number().int().positive(),
      reason: z.string().trim().min(5).max(1000),
    }),
  }),
  z.object({
    action: z.literal("count.review"),
    data: z.object({
      id: z.string().uuid(),
      approve: z.boolean(),
      note: z.string().trim().min(5).max(1000),
    }),
  }),
]);
export function parseScanCode(raw: string) {
  let code = raw.trim();
  if (!code || code.length > 1000)
    throw new Error("Geçerli bir etiket kodu okutun");
  if (/^https?:\/\//i.test(code)) {
    const url = new URL(code);
    code =
      url.searchParams.get("code") ||
      url.searchParams.get("unit") ||
      url.searchParams.get("lot") ||
      url.searchParams.get("cut") ||
      url.searchParams.get("job") ||
      "";
  }
  if (/^RF-[ILJCPR]-[A-F0-9]{12}$/i.test(code)) return code.toUpperCase();
  if (z.string().uuid().safeParse(code).success) return code.toLowerCase();
  // Exact SKU/lot/location codes are resolved in the tenant, never used as navigation URLs.
  if (/^[\p{L}\p{N}._:/ -]{1,180}$/u.test(code)) return code;
  throw new Error("Etiket biçimi desteklenmiyor");
}
export function assertQuantityPrecision(q: number, uom: string) {
  if (uom === "adet" && !Number.isInteger(q))
    throw new Error("Adet biriminde tam sayı girin");
  if (Math.abs(q * 1e6 - Math.round(q * 1e6)) > 0.0001)
    throw new Error("En fazla altı ondalık basamak kullanın");
}
