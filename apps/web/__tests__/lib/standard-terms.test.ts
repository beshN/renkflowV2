import { RENK_TERMS, standardTermsFor } from '@/lib/features/sales/standard-terms';

describe('standard terms', () => {
  it('belong to Renk Alüminyum only', () => {
    expect(standardTermsFor('Renk Alüminyum')).toBe(RENK_TERMS);
    expect(standardTermsFor('RENK ALÜMİNYUM San. Tic. Ltd.')).toBe(RENK_TERMS);
    expect(standardTermsFor('Renk Aluminyum')).toBe(RENK_TERMS);
    expect(standardTermsFor('Başka Firma')).toBeNull();
    expect(standardTermsFor(undefined)).toBeNull();
    expect(standardTermsFor('')).toBeNull();
  });
  it('have the 15 clauses in order, nine of sale and six of cancellation / return', () => {
    const [sale, ret] = RENK_TERMS.groups;
    expect(sale.clauses.map((c) => c.no)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(ret.clauses.map((c) => c.no)).toEqual(['10', '11', '12', '13', '14', '15']);
    expect(sale.clauses.find((c) => c.no === '2')?.subs?.map((s) => s.no)).toEqual(['2.1', '2.2', '2.3']);
    expect(sale.clauses.find((c) => c.no === '5')?.subs?.map((s) => s.no)).toEqual(['5.1', '5.2']);
  });
  it('keep the payment percentages as written', () => {
    const pay = RENK_TERMS.groups[0].clauses[1].subs!;
    expect(pay[0].text).toContain("%50'si");
    expect(pay[1].text).toMatch(/%50.*%35.*%15/);
  });
});
