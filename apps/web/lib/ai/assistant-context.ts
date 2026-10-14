import { PRODUCT_CATALOG } from "@/lib/features/product-3d/catalog";

/** Public product descriptions. Visual approximation limits are not manufacturing limits. */
export const PRODUCT_KNOWLEDGE = [
  {
    product: "WINMAX Makaslı Tente",
    kind: "makasli",
    features: [
      "Ön dikme ve taşıyıcı ray olmadan açılan makas mekanizması",
      "Black-out kumaş, ön su oluğu ve isteğe bağlı LED",
      "2026 katalog: tek sistemde 13 m en ve 5 m öne açılım",
    ],
    source: "https://www.renkaluminyum.com/makasli-tente-urun/",
    limitation:
      "Uygulama ölçüleri ve malzeme listesi yayımlanmış firma reçetesiyle doğrulanır.",
  },
  ...PRODUCT_CATALOG.map((p) => ({
    product: p.name,
    kind: p.kind,
    features: p.details,
    source: `https://www.renkaluminyum.com${p.source}`,
    limitation:
      p.uncertainty ??
      "Üretim ölçüsü ve malzeme listesi yayımlanmış firma reçetesiyle doğrulanır.",
  })),
];

/** Keep valid JSON and the currently open record when an unusually large workspace exceeds the budget. */
export function assistantContext(
  context: unknown,
  data: Record<string, unknown>,
  budget = 75000,
) {
  const clean = (value: unknown, depth = 0): unknown => {
    if (depth > 12) return "[içerik derinliği sınırı]";
    if (typeof value === "string")
      return value.startsWith("data:image/")
        ? "[3D görsel eki]"
        : value.length > 2500
          ? value.slice(0, 2500) + " [metin kısaltıldı]"
          : value;
    if (Array.isArray(value))
      return value.slice(0, 40).map((v) => clean(v, depth + 1));
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, clean(v, depth + 1)]),
      );
    return value;
  };
  const verified = clean(data) as Record<string, unknown>;
  const truncated: string[] = [];
  const payload = {
    context: clean(context),
    verifiedWorkspaceData: verified,
    publicProductReferences: PRODUCT_KNOWLEDGE,
    truncated,
  };
  const size = () => JSON.stringify(payload).length;
  const keys = Object.keys(verified)
    .filter(
      (k) => !/^current|generatedAt|scope|role|unavailable|access/.test(k),
    )
    .sort(
      (a, b) =>
        JSON.stringify(verified[b] ?? null).length -
        JSON.stringify(verified[a] ?? null).length,
    );
  for (const key of keys) {
    if (size() <= budget) break;
    const value = verified[key];
    if (Array.isArray(value) && value.length > 5)
      verified[key] = value.slice(0, 5);
    else
      verified[key] = {
        omitted: true,
        reason: "Özet sınırı; gerekiyorsa kayıt araması kullan.",
      };
    truncated.push(key);
  }
  if (size() > budget) {
    payload.verifiedWorkspaceData = {
      scope: data.scope,
      generatedAt: data.generatedAt,
      unavailable: data.unavailable,
      contextOmitted: true,
    };
    truncated.push("workspace");
  }
  return JSON.stringify(payload);
}

export const ASSISTANT_SEARCH_CATEGORIES = [
  "orders",
  "customers",
  "materials",
  "jobs",
  "quotations",
  "purchases",
  "suppliers",
  "shipments",
  "recipes",
  "employees",
  "warehouses",
  "order-detail",
  "quote-detail",
] as const;
