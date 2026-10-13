import { canonicalColor } from '@/lib/features/colors/color-spec';
import { foyFeatures, type FoyCheck } from './rules';
import { checkedLabels, type FoyCutRow, type FoyDoc } from './types';

/**
 * A read föy as the order the workshop already agreed to: one line per system, sizes in mm on the
 * order line (the app's unit), the sheet's own cm values kept verbatim in the line's parameters and
 * the whole sheet (with its checks) on the order. Prices are not on a föy, so they stay 0.
 */
const cm = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1, useGrouping: false });
const mm = (n: number | null | undefined) => (n == null ? undefined : Math.round(n * 10));

export function cutListText(rows: FoyCutRow[]) {
  return rows
    .filter((r) => r.lengthCm !== null || r.quantity !== null)
    .map((r) => `${r.profile.replace(/\s+/g, '')} ${r.lengthCm === null ? '—' : cm(r.lengthCm)}${r.widthCm !== null ? `×${cm(r.widthCm)}` : ''}${r.quantity !== null ? ` ×${r.quantity}` : ''}`)
    .join('; ');
}

export function foyProductName(doc: FoyDoc) {
  if (doc.template === 'windbreaker') return 'Pistonlu rüzgâr kırıcı';
  const series = checkedLabels(doc.series)[0];
  return `Makaslı pergola${series ? ` · ${series}` : ''}`;
}

export function foyColor(doc: FoyDoc): string | undefined {
  if (!doc.ral) return undefined;
  return canonicalColor(`${doc.ral} ${doc.finish ?? ''}`.trim());
}

export function foyToOrder(doc: FoyDoc, checks: FoyCheck[], opts: { customerName: string; customerId?: string; fileName?: string }) {
  const f = foyFeatures(doc);
  const color = foyColor(doc);
  const lights = checkedLabels(doc.lights);
  const motor = [f.motor, f.motorControl].filter(Boolean).join(' + ') || undefined;
  const flags = [
    f.ledEveryProfile && 'Her profilde LED', f.dimmer && 'Dimmer', f.valance && `Saçak: ${f.valance}`, f.noSteel && 'Demir yok',
    f.noTopSheet && 'Üst sac yok', f.weldOnSite && 'Sahada kaynak', f.valanceAfterInstall && 'Saçak montajdan sonra ölçülecek',
  ].filter(Boolean) as string[];
  const items = doc.template === 'windbreaker' && doc.windbreaker
    ? [{
        productName: foyProductName(doc), quantity: doc.windbreaker.systemCount ?? 1, unitPrice: 0, totalPrice: 0, color,
        widthMm: mm(doc.windbreaker.widthCm), heightMm: mm(doc.windbreaker.heightCm), notes: doc.notes.join('\n') || undefined,
        customParameters: Object.fromEntries(Object.entries({
          teslim_tarihi: doc.windbreaker.deliveryDate, ciceklik: doc.windbreaker.planter, sandik: doc.windbreaker.crate,
          montaj: doc.assembly, toplam_kg: doc.windbreaker.totalKg,
        }).filter(([, v]) => v !== null && v !== undefined)) as Record<string, string | number>,
      }]
    : doc.systems.map((s, k) => ({
        productName: foyProductName(doc) + (doc.systems.length > 1 ? ` (${k + 1}. sistem)` : ''),
        quantity: 1, unitPrice: 0, totalPrice: 0, color,
        widthMm: mm(s.railOuter), projectionMm: mm(s.projection), heightMm: mm(s.height),
        motorType: motor, ledType: lights.join(', ') || undefined, fabricType: doc.fabric ?? undefined,
        notes: [...doc.notes, ...(flags.length ? [`— ${flags.join(' · ')}`] : [])].join('\n') || undefined,
        customParameters: Object.fromEntries(Object.entries({
          seri: checkedLabels(doc.series).join(', ') || null,
          bolme_sayisi: s.bays.length,
          demir_icten_ice: s.bays.map((b) => (b.ironInner === null ? '—' : cm(b.ironInner))).join(' / '),
          ray_icten_ice: s.bays.map((b) => (b.railInner === null ? '—' : cm(b.railInner))).join(' / '),
          ray_distan_disa_cm: s.railOuter,
          acilim_cm: s.projection,
          kumas_cm: doc.fabricSize?.widthCm != null ? `${cm(doc.fabricSize.widthCm)}×${cm(doc.fabricSize.lengthCm ?? 0)}` : null,
          sacak_cm: doc.valanceSize?.widthCm != null ? `${cm(doc.valanceSize.widthCm)}×${cm(doc.valanceSize.heightCm ?? 0)}` : null,
          montaj: doc.assembly, sandikli: doc.crated ?? null,
          kesim_listesi: cutListText(doc.cutList).slice(0, 500) || null,
        }).filter(([, v]) => v !== null && v !== undefined && v !== '')) as Record<string, string | number | boolean>,
      }));
  const warnings = checks.filter((c) => c.severity === 'warn');
  return {
    customerId: opts.customerId,
    customerName: opts.customerName,
    productName: foyProductName(doc),
    quantity: Math.max(1, items.reduce((s, i) => s + i.quantity, 0)),
    totalAmount: 0,
    currency: 'TRY' as const,
    deliveryDate: doc.windbreaker?.deliveryDate ?? undefined,
    notes: [
      `İmalat föyünden aktarıldı${opts.fileName ? ` (${opts.fileName})` : ''}${doc.date ? `, föy tarihi ${doc.date.split('-').reverse().join('.')}` : ''}.`,
      ...doc.notes,
      ...(warnings.length ? ['Kontrol uyarıları:', ...warnings.map((w) => `• ${w.title}: ${w.detail}`)] : []),
    ].join('\n'),
    items,
    // The whole sheet travels with the order so the production sheet can be printed again from it.
    customFields: { foy: JSON.stringify({ v: 1, doc, checks }) },
  };
}
