/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { foldText } from '@/lib/shared/text/fold';

/**
 * Site copy may only claim what the product does today (docs/AUDIT.md, docs/PROGRESS.md "Sonra güçlendir").
 * Each phrase here was removed because the code contradicted it; bring one back only with the feature.
 * Text and phrases are compared after the Turkish fold, so "EN AZ ARTIK" and "en az artık" both match.
 */
const FILES = [
  'app/layout.tsx',
  'app/coming-soon/page.tsx',
  'lib/core/marketing-content.ts',
  'components/site/HomeLanding.tsx',
  'components/site/ProductMocks.tsx',
  'components/app-core/MarketingStandardPage.tsx',
  'lib/core/changelog.ts',
  'lib/core/legal-content.ts',
  'app/(landing)/docs/page.tsx',
];
const OVERCLAIMS: Array<[string, string]> = [
  ['en az artık', 'the cutting engine is a heuristic; it does not minimise remnants across bar lengths (K8)'],
  ['kesim optimizasyonu', 'the cutting engine is a heuristic (K8)'],
  ['boyları birlikte değerlendir', 'bar lengths are not optimised as a mix (K8)'],
  ['teklif → fatura', 'quotations convert to orders; there is no invoice step or e-Fatura (Faz 6)'],
  ['teklif faturaya', 'quotations convert to orders; there is no invoice step or e-Fatura (Faz 6)'],
  ['vadesi geçen', 'no overdue-payment view yet (Faz 6)'],
  ['sipariş kârlılığı', 'no order profitability yet (Faz 6)'],
  ['müşteri bazında açık bakiye', 'balances are per order, not per customer (Faz 6)'],
  ['tahsilat verisi csv', 'there is no payment CSV export'],
  ['her sorgu', 'tenant scoping is not proven for every query'],
  ['izolasyon', 'tenant scoping is not proven for every query'],
  ['delik listesi', 'there is no hole list for the worker'],
  ['değiştirilemez', 'activity_logs is not protected against UPDATE/DELETE yet'],
  ['silinemez', 'activity_logs is not protected against UPDATE/DELETE yet'],
];

it.each(FILES)('%s makes no claim the product contradicts', (file) => {
  const text = foldText(readFileSync(path.join(process.cwd(), file), 'utf8'));
  const found = OVERCLAIMS.filter(([phrase]) => text.includes(foldText(phrase))).map(([phrase, why]) => `"${phrase}": ${why}`);
  expect(found).toEqual([]);
});
