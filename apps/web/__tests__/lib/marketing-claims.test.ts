/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Site copy may only claim what the product does today (docs/AUDIT.md, docs/PROGRESS.md "Sonra güçlendir").
 * Each phrase here was removed because the code contradicted it; bring one back only with the feature.
 */
const FILES = ['lib/core/marketing-content.ts', 'components/site/HomeLanding.tsx', 'components/site/ProductMocks.tsx', 'components/app-core/MarketingStandardPage.tsx'];
const OVERCLAIMS: Array<[RegExp, string]> = [
  [/en az artık/i, 'the cutting engine is a heuristic; it does not minimise remnants across bar lengths (K8)'],
  [/teklif\s*→\s*fatura/i, 'quotations convert to orders; there is no invoice step or e-Fatura (Faz 6)'],
  [/teklif faturaya/i, 'quotations convert to orders; there is no invoice step or e-Fatura (Faz 6)'],
  [/vadesi geçen|sipariş kârlılığı|müşteri bazında açık bakiye/i, 'no overdue, profitability or per-customer balance view yet (Faz 6)'],
  [/her sorgu firma/i, 'tenant scoping is enforced for sensitive tables by a guard, not proven for every query'],
  [/delik listesi/i, 'there is no hole list for the worker'],
  [/değiştirilemez|silinemez/i, 'activity_logs is not protected against UPDATE/DELETE yet'],
  [/6–10 metrelik boylar ve .*birlikte değerlendirilir/i, 'bar lengths are not optimised as a mix (K8)'],
];

it.each(FILES)('%s makes no claim the product contradicts', (file) => {
  const text = readFileSync(path.join(process.cwd(), file), 'utf8');
  const found = OVERCLAIMS.filter(([pattern]) => pattern.test(text)).map(([pattern, why]) => `${pattern}: ${why}`);
  expect(found).toEqual([]);
});

it('labels every product preview as sample data', () => {
  const mocks = readFileSync(path.join(process.cwd(), 'components/site/ProductMocks.tsx'), 'utf8');
  const frame = mocks.slice(mocks.indexOf('export function Frame'), mocks.indexOf('const STATUS'));
  expect(frame).toContain('Örnek veri');
});
