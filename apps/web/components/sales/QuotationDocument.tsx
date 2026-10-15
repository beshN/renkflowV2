import Image from 'next/image';
import type { Quotation } from '@/lib/features/quotations/types';
import { formatCurrency } from '@/lib/utils';
import { awningSummary } from '@/lib/features/awning/configuration';
import { productMeta } from '@/lib/features/product-3d/catalog';
import { configurationSummary, type ProductConfiguration } from '@/lib/features/products/configuration';
import { ProductDrawing } from '@/components/drawing/ProductDrawing';
import styles from './QuotationDocument.module.css';
import { visualColorName } from '@/lib/features/product-3d/inline';
import { StandardTerms } from './StandardTerms';

const date = (value: string | Date) => new Date(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value).toLocaleDateString('tr-TR');

/** A document contains only persisted, customer-facing quotation values. */
export function QuotationDocument({ quote: q, firmName, logoUrl }: { quote: Quotation; firmName?: string; logoUrl?: string }) {
  const name = firmName || 'Renk Alüminyum';
  const logo = logoUrl || (name.toLocaleLowerCase('tr-TR').includes('renk alüminyum') ? '/images/winmax/renk-logo.webp' : undefined);
  return <div className={`quotation-print ${styles.document}`}>
    <div className={styles.heading}>
      <div>{logo ? <Image src={logo} alt={name} width={160} height={74} unoptimized className={styles.logo} /> : <p className={styles.firm}>{name}</p>}</div>
      <div className={styles.title}>
        <h1>Fiyat teklifi</h1>
        <p className={styles.number}>{q.quotationNumber}{(q.revision ?? 1) > 1 ? ` · Rev. ${q.revision}` : ''}</p>
        <p className={styles.date}>{date(q.createdAt)}</p>
      </div>
    </div>
    <div className={styles.customer}>
      <div><p className={styles.label}>Müşteri</p><h2>{q.customerName}</h2></div>
      <dl className={styles.meta}>
        {q.validUntil && <div><dt>Geçerlilik</dt><dd>{date(q.validUntil)}</dd></div>}
        <div><dt>Para birimi</dt><dd>{q.currency}</dd></div>
      </dl>
    </div>
    {q.items.map((item, index) => {
      const image = item.productVisualization?.image || item.awningPreview;
      const visual = item.productVisualization?.configuration;
      const color = item.color?.startsWith('#') ? visualColorName(item.color) : item.color;
      const dimensions = visual ? `${visual.widthMm} × ${productMeta(visual.kind).category === 'roof' ? visual.projectionMm : visual.heightMm} mm` : [item.widthMm, item.heightMm].filter(Boolean).join(' × ');
      return <section key={item.id || index} className={styles.item}>
        <h3><span>{String(index + 1).padStart(2, '0')}</span>{item.productName}</h3>
        {image ? <Image src={image} alt={`${item.productName} ürün görünümü`} width={900} height={600} unoptimized className={styles.preview} />
          : item.productConfiguration?.parameters ? <ProductDrawing family={item.productConfiguration.family} widthMm={item.productConfiguration.parameters.widthMm} projectionMm={item.productConfiguration.parameters.projectionMm} heightMm={item.productConfiguration.parameters.mountingHeightMm} color={item.productConfiguration.color} className={styles.drawing} /> : null}
        {item.productConfiguration?.recipe ? <p className={styles.specification}>{configurationSummary(item.productConfiguration as ProductConfiguration)}</p>
          : item.awningConfiguration ? <p className={styles.specification}>{awningSummary(item.awningConfiguration)}</p>
          : (dimensions || color) ? <p className={styles.specification}>{dimensions}{!visual && dimensions ? ' mm' : ''}{color ? ` · ${color}` : ''}</p> : null}
        <table className={styles.prices} aria-label={`${item.productName} fiyatları`}>
          <thead><tr><th scope="col">Miktar</th><th scope="col">Birim fiyat</th><th scope="col">İndirim</th><th scope="col">Tutar</th></tr></thead>
          <tbody><tr><td>{item.quantity} adet</td><td>{formatCurrency(item.unitPrice, q.currency)}</td><td>{item.discountPercent > 0 ? `%${item.discountPercent}` : '—'}</td><td>{formatCurrency(item.totalPrice, q.currency)}</td></tr></tbody>
        </table>
        {item.notes && <p className={styles.note}>{item.notes}</p>}
      </section>;
    })}
    <div className={styles.closing}>
      <div className={styles.conditions}>
        {q.notes && <div><h2>Notlar</h2><p>{q.notes}</p></div>}
        {q.termsAndConditions && <div><h2>Koşullar</h2><p>{q.termsAndConditions}</p></div>}
      </div>
      <dl className={styles.totals}>
        <div><dt>Ara toplam</dt><dd>{formatCurrency(q.subtotal, q.currency)}</dd></div>
        {q.discountAmount > 0 && <div><dt>İndirim</dt><dd>−{formatCurrency(q.discountAmount, q.currency)}</dd></div>}
        <div><dt>KDV %{q.vatPercent ?? 20}</dt><dd>{formatCurrency(q.taxAmount, q.currency)}</dd></div>
        <div className={styles.total}><dt>Genel toplam</dt><dd>{formatCurrency(q.totalAmount, q.currency)}</dd></div>
        {q.currency !== 'TRY' && q.fxRate ? <div className={styles.exchange}><dt>1 {q.currency} = {q.fxRate} TL</dt><dd>≈ {formatCurrency(q.totalAmount * q.fxRate, 'TRY')}</dd></div> : null}
      </dl>
    </div>
    {q.customerDecidedAt && q.status === 'accepted' && <p className={styles.note}>Müşteri onayı: {q.customerDecisionName} · {date(q.customerDecidedAt)}</p>}
    {q.items.some(i => i.productVisualization || i.awningConfiguration) && <p className={styles.footnote}>Ürün görselleri temsili olup uygulama çizimi yerine geçmez.</p>}
    <StandardTerms firmName={name} />
  </div>;
}
