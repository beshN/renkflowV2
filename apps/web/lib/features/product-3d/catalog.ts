import { z } from "zod";
import { colorInfo } from "@/lib/features/colors/color-spec";

export const ProductKindSchema = z.enum([
  "pergola",
  "rolling-roof",
  "zip",
  "giyotin",
  "wind-manual",
  "wind-piston",
  "glass-roof",
  "sliding-glass",
  "bioclimatic",
  "winter-garden",
  "cassette",
]);
export type ProductKind = z.infer<typeof ProductKindSchema>;
export type ProductMeta = {
  kind: ProductKind;
  name: string;
  category: "roof" | "glass" | "screen";
  motion: "retract" | "lift" | "tilt" | "slide" | "none";
  defaults: [number, number, number];
  viewMax: [number, number, number];
  source: string;
  details: string[];
  uncertainty?: string;
};
/** Limits below are bounded visualization inputs, never recipe/structural approval. */
export const PRODUCT_CATALOG: readonly ProductMeta[] = [
  {
    kind: "pergola",
    name: "Pergola Tente",
    category: "roof",
    motion: "retract",
    defaults: [6000, 4000, 3000],
    viewMax: [7800, 9000, 4500],
    source: "/pergola-tente/",
    details: [
      "Triger kayışlı taşıyıcı arabalar",
      "Katlanarak arkada toplanan kumaş",
      "Ray kanalları, fitiller ve ön su oluğu",
    ],
  },
  {
    kind: "rolling-roof",
    name: "Rolling Roof",
    category: "roof",
    motion: "retract",
    defaults: [5000, 4000, 2800],
    viewMax: [7000, 7000, 4500],
    source: "/rolling-roof/",
    details: [
      "Kancalı 243,45 × 60,2 mm lamel kesiti",
      "Tekerlekli ray ve makas bağlantıları",
      "Dört taraflı dere ve 165 mm dikmeler",
    ],
    uncertainty:
      "Gizli bağlantı oranları kaynaklarda ölçülendirilmemiştir; hareket geometrisi görsel sunum için yaklaştırılır.",
  },
  {
    kind: "zip",
    name: "Zip Perde",
    category: "screen",
    motion: "lift",
    defaults: [3500, 1500, 2800],
    viewMax: [4500, 2000, 4000],
    source: "/zip-perde/",
    details: [
      "Yan zip kılavuzları",
      "Sarılma yarıçapı değişen kumaş rulosu",
      "Alt bar, fitiller ve kaset uç kapakları",
    ],
  },
  {
    kind: "giyotin",
    name: "Motorlu Giyotin Cam",
    category: "glass",
    motion: "lift",
    defaults: [3000, 1500, 2700],
    viewMax: [3500, 2000, 3000],
    source: "/giyotin-cam-sistemleri/",
    details: [
      "Üç ayrı derinlikte cam kanat",
      "Alt sabit kanat ve dikey hareket",
      "Cam kenarı, profil kanalları ve fitiller",
    ],
    uncertainty:
      "Alt kanat sabittir. Alt kanat önünde toplanma geometrisi, kaynak fotoğrafları ve kılavuzdan yapılan görsel çıkarımdır.",
  },
  {
    kind: "wind-manual",
    name: "Manuel Rüzgâr Kırıcı",
    category: "glass",
    motion: "lift",
    defaults: [1600, 1500, 1750],
    viewMax: [2000, 2000, 2050],
    source: "/ruzgar-kirici-cam-sistemi/",
    details: [
      "8 mm sabit, 6 mm hareketli cam",
      "Çerçeveli üst kanat",
      "Alt cam içinde ters yönde hareket eden denge demiri",
      "Taban plakaları veya tekerlekli saksı",
    ],
    uncertainty:
      "1750 ve 2050 mm yükseklikler farklı kaynaklarda geçiyor; görsel ölçü seçimi üretim limitini onaylamaz.",
  },
  {
    kind: "wind-piston",
    name: "Pistonlu Rüzgâr Kırıcı",
    category: "glass",
    motion: "lift",
    defaults: [1600, 1500, 1900],
    viewMax: [1800, 2000, 1950],
    source: "/pistonlu-ruzgar-kirici/",
    details: [
      "Üst yatay profili olmayan hareketli cam",
      "İç içe teleskopik dikmeler",
      "İki kararlı seviye: alçak / yüksek",
    ],
    uncertainty:
      "Cam kalınlığı ve iç piston ölçüleri yayımlanmamıştır; görünür oranlar fotoğraflardan çıkarılmıştır.",
  },
  {
    kind: "glass-roof",
    name: "Cam Tavan",
    category: "roof",
    motion: "none",
    defaults: [5000, 4000, 3000],
    viewMax: [9000, 9000, 4500],
    source: "/cam-tavan-5/",
    details: [
      "Eğimli cam çatı",
      "Mertek baskı kapakları ve contalar",
      "Ön dere ve su tahliyesi",
    ],
    uncertainty:
      "Mertek kesiti ve cam kalınlığı görsel yaklaşımdır. Hareketli seçenek için mekanizma kanıtı yok; bu görünüm sabittir.",
  },
  {
    kind: "sliding-glass",
    name: "Sürme Cam",
    category: "glass",
    motion: "slide",
    defaults: [4000, 1500, 2600],
    viewMax: [9000, 2000, 3500],
    source: "/gallery/",
    details: [
      "Ayrı kanallarda kayar cam paneller",
      "Alt ray, tekerler ve kıl fitiller",
      "İnce kanat çerçeveleri",
    ],
    uncertainty:
      "Broşür ve Romanya projesinin görünür detaylarına göre oluşturulur; ölçü ve kanal kesitleri yaklaşık değerlerdir.",
  },
  {
    kind: "bioclimatic",
    name: "Biyoklimatik Tavan",
    category: "roof",
    motion: "tilt",
    defaults: [5000, 4000, 2800],
    viewMax: [7000, 7000, 4500],
    source: "/uskudar-aluminyum-tavan-bioclimatic/",
    details: [
      "Döner lamelli tavan",
      "Yan pivotlar ve çevre oluğu",
      "Profil kapakları ve çevre LED",
    ],
    uncertainty:
      "Döner lamel seçeneği broşürde belirtilir; gizli tahrik bağlantısı ve döndürme limiti ölçülendirilmemiştir.",
  },
  {
    kind: "winter-garden",
    name: "Kış Bahçesi",
    category: "roof",
    motion: "slide",
    defaults: [6000, 4000, 3000],
    viewMax: [9000, 9000, 4500],
    source: "/cam-tavan-5/",
    details: [
      "Cam çatı ve yan camların birleşik sahnesi",
      "Ayrı kanallarda sürme cephe",
      "Mertekler, oluklar ve cam contaları",
    ],
    uncertainty:
      "Birleşik görsel sunumdur; modül bağlantıları ve taşıma hesabı onaylı proje gerektirir.",
  },
  {
    kind: "cassette",
    name: "Kasetli Tente",
    category: "screen",
    motion: "none",
    defaults: [4500, 3000, 3000],
    viewMax: [7000, 5000, 4500],
    source: "/belcika-kasetli-tente/",
    details: [
      "Duvara bağlı kapalı kaset",
      "Ön bar ve uç kapakları",
      "Montaj konsolları",
    ],
    uncertainty:
      "Kaynakta kapalı kaset görünümü var. Açık kol geometrisi doğrulanmadığı için açılma animasyonu sunulmaz.",
  },
];
export const productMeta = (kind: ProductKind) =>
  PRODUCT_CATALOG.find((p) => p.kind === kind)!;
export const VisualizationConfigurationSchema = z
  .object({
    version: z.literal(1),
    kind: ProductKindSchema,
    widthMm: z.number().finite().min(900).max(15000),
    projectionMm: z.number().finite().min(900).max(9000),
    heightMm: z.number().finite().min(1000).max(4500),
    bodyColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    fabricColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    led: z.enum(["off", "warm", "white"]),
    brightness: z.number().int().min(0).max(100),
    mounting: z.enum(["wall", "free", "planter"]),
    glass: z.enum(["single", "insulated"]),
    screen: z.enum(["screen", "opaque"]),
  })
  .superRefine((c, ctx) => {
    const max = productMeta(c.kind).viewMax;
    for (const [key, index] of [
      ["widthMm", 0],
      ["projectionMm", 1],
      ["heightMm", 2],
    ] as const)
      if (c[key] > max[index])
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Bu ürünün görsel ölçü aralığı aşıldı",
        });
  });
export type VisualizationConfiguration = z.infer<
  typeof VisualizationConfigurationSchema
>;
export const ProductVisualizationSchema = z.object({
  configuration: VisualizationConfigurationSchema,
  image: z
    .string()
    .max(1_000_000)
    .regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
});
export type ProductVisualization = z.infer<typeof ProductVisualizationSchema>;
export function defaultVisualization(
  kind: ProductKind,
): VisualizationConfiguration {
  const [widthMm, projectionMm, heightMm] = productMeta(kind).defaults;
  return {
    version: 1,
    kind,
    widthMm,
    projectionMm,
    heightMm,
    bodyColor: "#343a40",
    fabricColor: "#e8e3d5",
    led: "warm",
    brightness: 75,
    mounting: productMeta(kind).category === "roof" ? "free" : "wall",
    glass: "single",
    screen: "screen",
  };
}
/** A visual attachment does not change prices, a published recipe, BOM or commercial measures. */
export function attachVisualization<
  T extends {
    productName?: string;
    awningConfiguration?: unknown;
    awningPreview?: unknown;
  },
>(
  item: T,
  visualization: ProductVisualization,
): Omit<
  T,
  | "awningConfiguration"
  | "awningPreview"
  | "productVisualization"
  | "productName"
> & {
  productName: string;
  awningConfiguration: undefined;
  awningPreview: undefined;
  productVisualization: ProductVisualization;
} {
  const v = ProductVisualizationSchema.parse(visualization);
  return {
    ...item,
    productName: item.productName || productMeta(v.configuration.kind).name,
    awningConfiguration: undefined,
    awningPreview: undefined,
    productVisualization: v,
  };
}
export function visualizationSummary(v: ProductVisualization) {
  const c = v.configuration,
    m = productMeta(c.kind);
  return `${m.name} · ${c.widthMm} × ${m.category === "roof" ? c.projectionMm : c.heightMm} mm · 3D görünüm`;
}
/** Published recipe parameters supply the visual dimensions; the visual never supplies a BOM. */
export function visualizationForRecipe(
  c:
    | {
        family: string;
        parameters: {
          widthMm: number;
          projectionMm: number;
          mountingHeightMm: number;
          led?: boolean;
        };
        color: string;
      }
    | null
    | undefined,
): ProductVisualization | undefined {
  if (!c || c.family !== "pergola") return;
  const parsed = VisualizationConfigurationSchema.safeParse({
    ...defaultVisualization("pergola"),
    widthMm: c.parameters.widthMm,
    projectionMm: c.parameters.projectionMm,
    heightMm: c.parameters.mountingHeightMm,
    bodyColor:
      colorInfo(c.color)?.hex ?? defaultVisualization("pergola").bodyColor,
    led: c.parameters.led ? "warm" : "off",
  });
  return parsed.success ? { configuration: parsed.data } : undefined;
}

/** Colour and brightness edits reuse the existing GPU geometry and camera. */
export function sameGeometry(a: VisualizationConfiguration, b: VisualizationConfiguration) {
  return a.kind === b.kind && a.widthMm === b.widthMm && a.projectionMm === b.projectionMm && a.heightMm === b.heightMm && a.mounting === b.mounting && a.glass === b.glass && a.screen === b.screen && (a.led === 'off') === (b.led === 'off');
}
