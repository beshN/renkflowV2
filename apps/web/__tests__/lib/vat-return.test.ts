import { buildVatReturn, carryInto, vatReturnCsv, type VatSaleLine } from '@/lib/features/accounting/vat-return';

const line = (over: Partial<VatSaleLine>): VatSaleLine => ({
  invoiceNumber: 'RNK2026000000001', sign: 1, rate: 1, vatPercent: 20, net: 1000, vat: 200,
  withholdingCode: null, withholdingPercent: 0, withholdingAmount: 0, exemptionCode: null, ...over,
});

describe('KDV dönem özeti', () => {
  it('groups fully taxed sales by rate and subtracts deductible VAT', () => {
    const v = buildVatReturn('2026-10', [line({}), line({ net: 500, vat: 100 }), line({ vatPercent: 10, net: 300, vat: 30 })], [
      { net: 400, vat: 80, vatPercent: 20, deductible: true, currency: 'TRY' },
    ]);
    expect(v.sales).toEqual([{ vatPercent: 20, base: 1500, vat: 300 }, { vatPercent: 10, base: 300, vat: 30 }]);
    expect(v.output).toEqual({ base: 1800, vat: 330, withheld: 0 });
    expect(v.input.vat).toBe(80);
    expect([v.net, v.payable, v.carryForward]).toEqual([250, 250, 0]);
  });

  it('declares only the unwithheld share of partial withholding (7/10 on 20%)', () => {
    const v = buildVatReturn('2026-10', [line({ withholdingCode: '603', withholdingPercent: 70, withholdingAmount: 140 })], []);
    expect(v.sales).toEqual([]);
    expect(v.withheld).toEqual([expect.objectContaining({ code: '603', vatPercent: 20, withholdingPercent: 70, base: 1000, vat: 200, withheld: 140, payable: 60 })]);
    expect(v.output).toEqual({ base: 1000, vat: 60, withheld: 140 });
    expect(v.withheld[0].name).toMatch(/bakım ve onarım/);
  });

  it('lists exempt sales by code and flags zero-rate lines without a code', () => {
    const v = buildVatReturn('2026-10', [line({ vatPercent: 0, vat: 0, exemptionCode: '301' }), line({ vatPercent: 0, vat: 0, net: 50 })], []);
    expect(v.exempt.map((r) => [r.code, r.base])).toEqual([['301', 1000], [null, 50]]);
    expect(v.output.vat).toBe(0);
    expect(v.notes.join(' ')).toMatch(/istisna kodu girilmemiş/);
  });

  it('converts foreign invoices at their rate and nets a same-month cancellation to nothing', () => {
    const eur = line({ rate: 35.5, net: 100, vat: 20 });
    expect(buildVatReturn('2026-10', [eur], []).sales).toEqual([{ vatPercent: 20, base: 3550, vat: 710 }]);
    const v = buildVatReturn('2026-10', [eur, { ...eur, sign: -1 }], []);
    expect(v.sales).toEqual([]);
    expect(v.output.vat).toBe(0);
  });

  it('a cancellation in a later month reduces that month', () => {
    const v = buildVatReturn('2026-11', [line({ sign: -1 })], []);
    expect(v.output.vat).toBe(-200);
  });

  it('skips non-deductible and foreign-currency purchases with a note', () => {
    const v = buildVatReturn('2026-10', [], [
      { net: 100, vat: 20, vatPercent: 20, deductible: false, currency: 'TRY' },
      { net: 100, vat: 20, vatPercent: 20, deductible: true, currency: 'EUR' },
      { net: 100, vat: 10, vatPercent: 10, deductible: true, currency: 'TRY' },
    ]);
    expect(v.input).toEqual({ byRate: [{ vatPercent: 10, base: 100, vat: 10 }], vat: 10, count: 1 });
    expect(v.notes).toHaveLength(2);
  });

  it('carries deductible VAT forward month to month', () => {
    const sep = buildVatReturn('2026-09', [line({ net: 100, vat: 20 })], [{ net: 1000, vat: 200, vatPercent: 20, deductible: true, currency: 'TRY' }]);
    expect(sep.carryForward).toBe(180);
    const oct = buildVatReturn('2026-10', [line({ net: 500, vat: 100 })], []);
    // October alone: 100 payable. With September's 180 carried in: 80 carries on.
    expect(carryInto([sep])).toBe(180);
    expect(carryInto([sep, oct])).toBe(80);
    const v = buildVatReturn('2026-10', [line({ net: 500, vat: 100 })], [], { carryIn: carryInto([sep]) });
    expect([v.carryIn, v.net, v.payable, v.carryForward]).toEqual([180, -80, 0, 80]);
  });

  it('exports a Turkish-locale CSV', () => {
    const csv = vatReturnCsv(buildVatReturn('2026-10', [line({ withholdingCode: '603', withholdingPercent: 70, withholdingAmount: 140 })], []));
    expect(csv).toContain('KDV dönem özeti;2026-10');
    expect(csv).toContain(';603;20;7/10;1000,00;200,00;140,00;60,00');
    expect(csv).toContain('Ödenecek KDV;60,00');
  });
});
