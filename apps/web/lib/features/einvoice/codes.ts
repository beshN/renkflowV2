// GİB UBL-TR code lists used by RenkFlow invoices.
//
// Deliberately short: only the codes an aluminium systems manufacturer and installer is likely to
// need. GİB revises these lists several times a year (UBL-TR Kod Listeleri V1.39 Sep 2025, V1.43
// 2026, rules effective 14 Sep 2026), so each entry is checked against the current list before it
// is added, and choosing a code for a sale is the accountant's decision. The provider validates
// every document again before it reaches GİB.
//
// Sources checked 14 Oct 2026: KDV Genel Uygulama Tebliği I/C-2.1.3 (tevkifat), GİB UBL-TR Kod
// Listeleri (TaxExemptionReasonCodeType), and the GİB e-Fatura package notes for 14 Sep 2026.

/** KDV rates in force since 10 July 2023. */
export const VAT_RATES = [0, 1, 10, 20] as const;

export type WithholdingCode = { code: string; name: string; /** Share of the VAT withheld, in percent (4/10 → 40). */ percent: number };

/** KDV tevkifat (WithholdingTaxTotal TaxTypeCode). */
export const WITHHOLDING_CODES: readonly WithholdingCode[] = [
  { code: '601', name: 'Yapım işleri ile bu işlerle birlikte ifa edilen mühendislik-mimarlık ve etüt-proje hizmetleri', percent: 40 },
  { code: '602', name: 'Etüt, plan-proje, danışmanlık, denetim ve benzeri hizmetler', percent: 90 },
  { code: '603', name: 'Makine, teçhizat, demirbaş ve taşıtlara ait tadil, bakım ve onarım hizmetleri', percent: 70 },
];

export type ExemptionCode = { code: string; name: string; /** Invoice type the code may appear on. */ invoiceType: 'ISTISNA' | 'SATIS' };

/** KDV istisna / muafiyet (TaxExemptionReasonCode). */
export const EXEMPTION_CODES: readonly ExemptionCode[] = [
  { code: '301', name: '11/1-a Mal ihracatı', invoiceType: 'ISTISNA' },
  { code: '350', name: 'Diğer istisnalar', invoiceType: 'ISTISNA' },
  // Not an exemption: marks a 0 % VAT line that is outside the exemption list.
  { code: '351', name: 'KDV - İstisna olmayan diğer', invoiceType: 'SATIS' },
];

export const withholdingCode = (code: string | null | undefined) => WITHHOLDING_CODES.find((c) => c.code === code) ?? null;
export const exemptionCode = (code: string | null | undefined) => EXEMPTION_CODES.find((c) => c.code === code) ?? null;

/** UN/ECE Rec. 20 unit codes accepted by UBL-TR, the ones used for profiles, panels and service. */
export const UNIT_CODES = {
  C62: 'Adet',
  MTR: 'Metre',
  MTK: 'Metrekare',
  KGM: 'Kilogram',
  SET: 'Set',
  HUR: 'Saat',
} as const;
export type UnitCode = keyof typeof UNIT_CODES;
