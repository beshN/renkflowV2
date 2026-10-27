import { z } from 'zod';
import { productMeta, VisualizationConfigurationSchema, type ProductKind, type VisualizationConfiguration } from '@/lib/features/product-3d/catalog';

export const FAIR_MAX_ITEMS = 8;

/** The firm is the data controller for fair visitors; raise the version when the text changes. */
export const FAIR_PRIVACY_VERSION = 'fuar-1.0';
export function fairPrivacyNotice(firm: string) {
  const who = firm || 'Firmamız';
  return [
    `${who}, 6698 sayılı KVKK kapsamında veri sorumlusu olarak; bu formda paylaştığınız ad soyad, firma, telefon, e-posta, şehir ve ürün tercihlerinizi yalnızca talep ettiğiniz ürünler için fiyat teklifi hazırlamak ve bu konuda sizinle iletişim kurmak amacıyla işler.`,
    'Hukuki sebep, bir sözleşmenin kurulmasıyla doğrudan ilgili olarak işlemenin gerekli olmasıdır (KVKK m. 5/2-c). Verileriniz bu amaç dışında kullanılmaz ve üçüncü kişilere satılmaz; yalnızca barındırma ve iletişim hizmeti aldığımız tedarikçilerle, hizmetin gerektirdiği ölçüde paylaşılır.',
    'Talebiniz sonuçlandıktan sonra kayıtlar mevzuattaki saklama süreleri boyunca tutulur, ardından silinir veya anonim hâle getirilir. KVKK m. 11 kapsamındaki haklarınız (bilgi talep etme, düzeltme, silme, itiraz) için bizimle iletişime geçebilirsiniz.',
  ];
}

/** A small preview: the page scales the 3D capture down before sending it. */
const PreviewImage = z
  .string()
  .max(300_000)
  .regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/);

export const FairItemSchema = z
  .object({
    configuration: VisualizationConfigurationSchema,
    image: PreviewImage.optional(),
    quantity: z.coerce.number().int().min(1).max(99).default(1),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
export type FairItem = z.infer<typeof FairItemSchema>;

export const FairRequestSchema = z
  .object({
    items: z.array(FairItemSchema).min(1, 'En az bir ürün ekleyin').max(FAIR_MAX_ITEMS),
    contactName: z.string().trim().min(2, 'Ad soyad gerekli').max(200),
    companyName: z.string().trim().max(200).nullish(),
    phone: z
      .string()
      .trim()
      .max(40)
      .refine((v) => v.replace(/\D/g, '').length >= 10, 'Geçerli bir telefon numarası yazın'),
    email: z.string().trim().toLowerCase().email('Geçerli bir e-posta yazın').max(200).nullish().or(z.literal('')),
    city: z.string().trim().max(120).nullish(),
    note: z.string().trim().max(1000).nullish(),
    privacyAccepted: z.literal(true, { message: 'Aydınlatma metnini onaylayın' }),
    marketingConsent: z.boolean().default(false),
    event: z.string().trim().max(120).nullish(),
    /** Honeypot: people never see or fill it. */
    website: z.string().max(200).optional(),
  })
  .strict();
export type FairRequestInput = z.input<typeof FairRequestSchema>;

/** The lead's product family when the fair product has one in the sales catalogue. */
const FAMILY_FOR_KIND: Partial<Record<ProductKind, string>> = {
  pergola: 'pergola',
  'wind-manual': 'wind-manual',
  'wind-piston': 'wind-piston',
  giyotin: 'giyotin',
};
export function leadFamilyFor(items: Array<{ configuration: { kind: ProductKind } }>): string | null {
  const families = new Set(items.map((i) => FAMILY_FOR_KIND[i.configuration.kind] ?? null));
  return families.size === 1 ? [...families][0] : null;
}

const dimensions = (c: VisualizationConfiguration) =>
  productMeta(c.kind).category === 'roof' ? `${c.widthMm} × ${c.projectionMm} mm` : `${c.widthMm} × ${c.heightMm} mm`;

/** "2 × Pergola Tente 6000 × 4000 mm" */
export const itemSummary = (i: { configuration: VisualizationConfiguration; quantity: number }) =>
  `${i.quantity > 1 ? `${i.quantity} × ` : ''}${productMeta(i.configuration.kind).name} ${dimensions(i.configuration)}`;
