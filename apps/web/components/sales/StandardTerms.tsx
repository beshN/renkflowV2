import { standardTermsFor } from '@/lib/features/sales/standard-terms';
import styles from './StandardTerms.module.css';

/**
 * The firm's standard terms of sale and of cancellation / return, in the firm's own wording. On a
 * printed quotation (`variant="page"`) they start on a new page after the quote; on the customer's
 * approval page they are shown plainly. Nothing renders for a firm without standard terms.
 */
export function StandardTerms({ firmName, variant = 'page' }: { firmName: string | null | undefined; variant?: 'page' | 'plain' }) {
  const terms = standardTermsFor(firmName);
  if (!terms) return null;
  return (
    <section className={`${styles.terms} ${variant === 'page' ? styles.page : ''}`} aria-label="Satış, iptal ve iade koşulları">
      {terms.groups.map((group) => (
        <div key={group.title} className={styles.group}>
          <h2>{group.title}</h2>
          {group.clauses.map((clause) => (
            <div key={clause.no} className={styles.clause}>
              <h3>{clause.no}. {clause.title}</h3>
              {clause.text && <p>{clause.text}</p>}
              {clause.subs && (
                <ul className={styles.subs}>
                  {clause.subs.map((sub) => <li key={sub.no}><b>{sub.no}. {sub.label}:</b> {sub.text}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      ))}
      <p className={styles.signature}>{terms.signature}</p>
    </section>
  );
}
