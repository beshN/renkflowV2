import { z } from "zod";

const confidence = z.number().min(0).max(1).describe("0 ile 1 arasında alan güveni");
const page = z.number().int().min(1).max(50).nullable().describe("Bilginin bulunduğu PDF sayfası");

function field<T extends z.ZodTypeAny>(valueSchema: T, description: string) {
  return z.object({
    value: valueSchema.nullable().describe(description),
    confidence,
    sourcePage: page,
    sourceText: z.string().max(500).nullable().optional().describe("PDF'deki kısa kaynak ifade"),
  });
}

export const extractedOrderFieldsSchema = z.object({
  customerName: field(z.string().max(200), "Müşteri veya firma adı"),
  projectName: field(z.string().max(200), "Proje adı"),
  orderReference: field(z.string().max(120), "Müşteri sipariş veya teklif referansı"),
  notes: field(z.string().max(5000), "Sipariş geneli notları"),
  items: z.array(z.object({
    quantity: field(z.number().int().positive(), "Ürün adedi"),
    widthMm: field(z.number().positive(), "Milimetre cinsinden net genişlik"),
    heightMm: field(z.number().positive(), "Milimetre cinsinden net yükseklik"),
    lightColor: field(z.string().max(120), "Işık rengi veya Kelvin değeri"),
    profileType: field(z.string().max(160), "Profil tipi veya kodu"),
    motorType: field(z.string().max(160), "Motor tipi, marka veya kodu"),
    notes: field(z.string().max(2000), "Satır notları"),
  })).min(1).max(250),
  documentLanguage: z.string().max(20).default("tr"),
  warnings: z.array(z.string().max(500)).max(50).default([]),
});

export type ExtractedOrderFieldsOutput = z.infer<typeof extractedOrderFieldsSchema>;

export const EXTRACTION_SCHEMA_VERSION = "order-extraction-v1";
export const EXTRACTION_PROMPT_VERSION = "tr-production-v1";

export const extractionInstructions = `Sen üretim sipariş PDF'lerinden veri çıkaran bir sistem bileşenisin.
Belgedeki veriyi aynen oku; hesaplama, tahmin, delik/LED/kesim hesabı veya sipariş onayı yapma.
Her alan için 0-1 güven skoru ve kaynak sayfayı ver.
Ölçüleri milimetreye normalize et. Birim belirsizse değeri null yap ve uyarı ekle.
Aynı belgede birden fazla ürün/ölçü varsa ayrı items satırları üret.
Taranmış belgelerde görünmeyen veya kuşkulu alanları uydurma; null ve düşük güven kullan.
Türkçe karakterleri koru. Kaynak metni en fazla kısa bir ifade olarak ekle.`;
