/** Display the recorded dimensions separately; never treat projection as a legacy height. */
export function measurementSummary(value: { widthMm?: number | null; heightMm?: number | null; projectionMm?: number | null; mountingHeightMm?: number | null }) {
  const fields: Array<[string, number | null | undefined]> = [
    ['En', value.widthMm], ['Açılım', value.projectionMm],
    ['Yükseklik', value.heightMm === value.mountingHeightMm ? undefined : value.heightMm],
    ['Montaj yüksekliği', value.mountingHeightMm],
  ];
  return fields.filter(([, n]) => typeof n === 'number' && Number.isFinite(n) && n > 0)
    .map(([label, n]) => `${label} ${n!.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} mm`).join(' · ');
}
