import { z } from 'zod';

/**
 * A Renk imalat föyü (production sheet) as structured data. Lengths are centimetres, exactly as the
 * sheet writes them. Every value is either read from the sheet (text layer or, for image pages, the
 * vision model) or null; nothing is computed here. Checks live in rules.ts.
 */
const cm = z.number().finite().nonnegative().nullable();

export const FoyOptionSchema = z.object({ label: z.string(), checked: z.boolean().nullable() });

export const FoyBaySchema = z.object({
  /** "DEMİR İÇTEN İÇE": clear span between the steel posts. */
  ironInner: cm,
  /** "RAY İÇTEN İÇE": clear span between the rails. */
  railInner: cm,
});

export const FoySystemSchema = z.object({
  bays: z.array(FoyBaySchema).max(20),
  /** "RAY DIŞTAN DIŞA": overall width over the rails. */
  railOuter: cm,
  /** Açılım (projection) from the side view. */
  projection: cm,
  /** Height written on the side view (e.g. 102), when there is one. */
  height: cm,
});

export const FOY_PART_KINDS = ['demir', 'dere', 'led', 'boru', 'kumas', 'sac', 'diger'] as const;
export type FoyPartKind = (typeof FOY_PART_KINDS)[number];

export const FoyCutRowSchema = z.object({
  /** As written: "50*100", "Dere", "40 * 60", "Boru", "Kumaş", "Sac". */
  profile: z.string().max(60),
  kind: z.enum(FOY_PART_KINDS),
  lengthCm: cm,
  /** Second dimension of sheet goods ("991X400 cm" → 991 × 400; lengthCm holds the 991). */
  widthCm: cm,
  quantity: z.number().int().nonnegative().nullable(),
});

/** A steel piece from a drawing page ("50*100 DEMİR · 3 ADET · 280 cm DİKEY"): the length is the dimension drawn largest. */
export const FoyIronCutSchema = z.object({
  profile: z.string().max(60),
  lengthCm: cm,
  quantity: z.number().int().nonnegative().nullable(),
  orientation: z.enum(['dikey', 'yatay']).nullable(),
  page: z.number().int().positive(),
});

export const FoyWindbreakerSchema = z.object({
  orderDate: z.string().nullable(),
  deliveryDate: z.string().nullable(),
  systemCount: z.number().int().positive().nullable(),
  planter: z.string().nullable(),
  crate: z.string().nullable(),
  widthCm: cm,
  heightCm: cm,
  frameCm: cm,
  frameQty: z.number().int().nonnegative().nullable(),
  sashCm: cm,
  sashQty: z.number().int().nonnegative().nullable(),
  sashGlass: z.object({ thicknessMm: cm, widthCm: cm, heightCm: cm, quantity: z.number().int().nonnegative().nullable() }).nullable(),
  frameGlass: z.object({ thicknessMm: cm, widthCm: cm, heightCm: cm, quantity: z.number().int().nonnegative().nullable() }).nullable(),
  totalKg: cm,
  /** "100 cm = 11 kg" rows printed on the sheet. */
  pistonTable: z.array(z.object({ widthCm: z.number(), kg: z.number() })).max(20),
});

export const FoyDocSchema = z.object({
  template: z.enum(['pergola', 'windbreaker', 'unknown']),
  date: z.string().nullable(),
  customer: z.string().nullable(),
  address: z.string().nullable(),
  ral: z.string().nullable(),
  finish: z.string().nullable(),
  fabric: z.string().nullable(),
  series: z.array(FoyOptionSchema).max(6),
  lights: z.array(FoyOptionSchema).max(6),
  assembly: z.enum(['montajli', 'demonte']).nullable(),
  crated: z.boolean().nullable(),
  notes: z.array(z.string().max(300)).max(30),
  systems: z.array(FoySystemSchema).max(10),
  cutList: z.array(FoyCutRowSchema).max(60),
  fabricSize: z.object({ widthCm: cm, lengthCm: cm }).nullable(),
  valanceSize: z.object({ widthCm: cm, heightCm: cm }).nullable(),
  /** Free text of the steel drawings (later pages), e.g. "4 ADET 50*100 DEMİR DİKEY DEMİRLER". */
  ironNotes: z.array(z.string().max(300)).max(40),
  /** The steel pieces with their lengths, read from the same drawing pages. */
  ironCuts: z.array(FoyIronCutSchema).max(40).default([]),
  windbreaker: FoyWindbreakerSchema.nullable(),
  /** Pages whose content is an image the text layer cannot read. */
  unreadPages: z.array(z.number().int().positive()).max(20),
});

export type FoyOption = z.infer<typeof FoyOptionSchema>;
export type FoyBay = z.infer<typeof FoyBaySchema>;
export type FoySystem = z.infer<typeof FoySystemSchema>;
export type FoyCutRow = z.infer<typeof FoyCutRowSchema>;
export type FoyIronCut = z.infer<typeof FoyIronCutSchema>;
export type FoyWindbreaker = z.infer<typeof FoyWindbreakerSchema>;
export type FoyDoc = z.infer<typeof FoyDocSchema>;

export function emptyFoy(template: FoyDoc['template'] = 'unknown'): FoyDoc {
  return {
    template, date: null, customer: null, address: null, ral: null, finish: null, fabric: null,
    series: [], lights: [], assembly: null, crated: null, notes: [], systems: [], cutList: [],
    fabricSize: null, valanceSize: null, ironNotes: [], ironCuts: [], windbreaker: null, unreadPages: [],
  };
}

export const checkedLabels = (options: FoyOption[]) => options.filter((o) => o.checked).map((o) => o.label);
