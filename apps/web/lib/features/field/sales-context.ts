import { z } from "zod";
export const CUSTOMER_TYPES = [
  "unknown",
  "dealer",
  "installer",
  "applicator",
  "project_company",
  "corporate",
  "individual",
] as const;
export const CUSTOMER_TYPE_LABELS: Record<
  (typeof CUSTOMER_TYPES)[number],
  string
> = {
  unknown: "Belirtilmedi",
  dealer: "Bayi",
  installer: "Montajcı",
  applicator: "Uygulamacı",
  project_company: "Proje firması",
  corporate: "Kurumsal müşteri",
  individual: "Bireysel müşteri",
};
export const SalesProfileSchema = z
  .object({
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$|^$/, "Ülke için iki harfli kod girin (TR, DE gibi)")
      .default(""),
    city: z.string().trim().max(100).default(""),
    customerType: z.enum(CUSTOMER_TYPES).default("unknown"),
    interests: z
      .array(
        z.object({
          product: z.string().trim().min(1).max(80),
          quantity: z.number().int().positive().max(1000000).nullable(),
        }),
      )
      .max(30)
      .default([]),
    dealerPotential: z.boolean().nullable().default(null),
    recurringPotential: z.boolean().nullable().default(null),
  })
  .strict();
export type SalesProfile = z.infer<typeof SalesProfileSchema>;
export const PRIORITY_LEVELS = ["very_high", "high", "medium", "low"] as const;
export const PRIORITY_LABELS: Record<(typeof PRIORITY_LEVELS)[number], string> =
  { very_high: "Çok yüksek", high: "Yüksek", medium: "Orta", low: "Düşük" };
export const PriorityOverrideSchema = z
  .object({
    level: z.enum(PRIORITY_LEVELS),
    reason: z.string().trim().min(5, "Önceliğin gerekçesini yazın").max(1000),
  })
  .strict();
/** Brand, urgency and research availability do not create dealership or repeat-buying intent. */
export function salesPriority(raw: unknown, override?: unknown) {
  const p = SalesProfileSchema.parse(raw || {}),
    manual = PriorityOverrideSchema.safeParse(override),
    foreign = !!p.country && p.country !== "TR";
  let level: (typeof PRIORITY_LEVELS)[number], reason: string;
  if (manual.success) {
    level = manual.data.level;
    reason = manual.data.reason;
  } else if (
    p.customerType === "dealer" ||
    p.dealerPotential === true ||
    p.recurringPotential === true
  ) {
    level = "very_high";
    reason =
      "Bayi olma veya düzenli toplu alım potansiyeli kaydedildi" +
      (foreign ? "; yurt dışı önceliği var" : "");
  } else if (p.customerType === "individual") {
    level = "low";
    reason =
      "Bireysel talep; adet, konum ve işin niteliğiyle yetkili tarafından yükseltilebilir";
  } else if (foreign && p.customerType !== "unknown") {
    level = "high";
    reason = "Yurt dışındaki firmanın proje veya ürün talebi";
  } else {
    level = "medium";
    reason =
      p.country === "TR"
        ? "Yurt içi veya henüz sürekliliği doğrulanmamış talep"
        : "Firma türü veya konumu tamamlanmalı; öncelik geçici";
  }
  return {
    level,
    label: PRIORITY_LABELS[level],
    reason,
    manual: manual.success,
    rank: PRIORITY_LEVELS.indexOf(level),
    foreign,
    quantity: p.interests.reduce((n, i) => n + (i.quantity || 0), 0),
    needsContext: !p.country || p.customerType === "unknown",
  };
}
export const RESEARCH_CATEGORIES = [
  "activity",
  "product_fit",
  "location",
  "projects",
  "branches",
  "contact",
  "buying_signal",
] as const;
export const RESEARCH_LABELS: Record<
  (typeof RESEARCH_CATEGORIES)[number],
  string
> = {
  activity: "Faaliyet alanı",
  product_fit: "Ürün uyumu",
  location: "Konum / hizmet uygunluğu",
  projects: "Projeler",
  branches: "Şubeler",
  contact: "İletişim",
  buying_signal: "Satın alma sinyali",
};
export const ResearchSourceSchema = z
  .object({
    category: z.enum(RESEARCH_CATEGORIES),
    url: z
      .url()
      .max(2000)
      .refine(
        (s) => ["http:", "https:"].includes(new URL(s).protocol),
        "HTTP veya HTTPS kaynak bağlantısı gerekli",
      ),
    title: z.string().trim().min(2).max(200),
    findings: z.string().trim().min(5).max(4000),
    status: z.enum(["reported", "verified", "rejected"]).default("reported"),
    checkedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
