/**
 * @jest-environment node
 *
 * e-Belge core: GİB numbering, UBL-TR 1.2 XML and the checks that run before an invoice is sent.
 */
import { parseStringPromise } from 'xml2js';

import { EXEMPTION_CODES, VAT_RATES, WITHHOLDING_CODES } from '@/lib/features/einvoice/codes';
import { formatInvoiceNumber, isValidSeriesPrefix, parseInvoiceNumber } from '@/lib/features/einvoice/numbering';
import { buildUblInvoice, eBelgeProblems, escapeXml, isValidTckn, UNKNOWN_CONSUMER_TCKN, type UblInvoice } from '@/lib/features/einvoice/ubl';
import { invoiceTotals, lineTotals } from '@/lib/features/finance/engine';

const seller = {
  name: 'Renk Alüminyum San. ve Tic. Ltd. Şti.', taxNumber: '1234567890', taxOffice: 'Gebze', addressLine: 'Organize Sanayi Bölgesi 5. Cad. No: 12',
  district: 'Gebze', city: 'Kocaeli', postalCode: '41400', phone: '+90 262 000 00 00', email: 'fatura@renk.com.tr', mersisNo: '0123456789000015',
};
const companyBuyer = { name: 'Işık İnşaat A.Ş.', taxNumber: '9876543210', taxOffice: 'Kadıköy', addressLine: 'Moda Cad. 1', district: 'Kadıköy', city: 'İstanbul' };

function invoice(overrides: Partial<UblInvoice> = {}, lineOverrides: Partial<UblInvoice['lines'][number]>[] = [{}]): UblInvoice {
  const lines = lineOverrides.map((o, i) => {
    const base = { description: i === 0 ? 'Bioklimatik pergola 4x3 <RAL 7016> & montaj' : 'Nakliye', quantity: 1, unitCode: 'C62', unitPrice: 10000, vatPercent: 20, ...o };
    const t = lineTotals({ quantity: base.quantity, unitPrice: base.unitPrice, vatPercent: base.vatPercent, withholdingPercent: base.withholdingPercent });
    return { ...base, net: t.net, vat: t.vat, withholding: t.withholding };
  });
  const totals = invoiceTotals(lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, vatPercent: l.vatPercent, withholdingPercent: l.withholdingPercent })));
  return {
    number: 'RNK2026000000001', ettn: '3f1e2d4c-5b6a-4789-9abc-def012345678', issueDate: '2026-10-14', issueTime: '10:30:00',
    documentType: 'e_fatura', profile: 'TICARIFATURA', typeCode: 'SATIS', currency: 'TRY', seller, buyer: companyBuyer,
    lines, totals: { subtotal: totals.subtotal, vatTotal: totals.vatTotal, total: totals.total, withholdingTotal: totals.withholdingTotal, payable: totals.payable },
    ...overrides,
  };
}

const xml = async (inv: UblInvoice) => (await parseStringPromise(buildUblInvoice(inv))).Invoice;
const text = (node: any) => (typeof node === 'string' ? node : node?._);

describe('numbering', () => {
  it('formats GİB numbers: prefix, year, 9-digit sequence (16 characters)', () => {
    expect(formatInvoiceNumber('RNK', 2026, 1)).toBe('RNK2026000000001');
    expect(formatInvoiceNumber('RNA', 2027, 123456789)).toHaveLength(16);
    expect(parseInvoiceNumber('RNK2026000000042')).toEqual({ prefix: 'RNK', year: 2026, sequence: 42 });
    expect(parseInvoiceNumber('FTR-000001')).toBeNull();
  });
  it('refuses bad prefixes and a full series', () => {
    expect(isValidSeriesPrefix('RN1')).toBe(false);
    expect(isValidSeriesPrefix('rnk')).toBe(false);
    expect(() => formatInvoiceNumber('RNK', 2026, 1_000_000_000)).toThrow('doldu');
    expect(() => formatInvoiceNumber('RNK', 2026, 0)).toThrow();
  });
});

describe('code lists', () => {
  it('has the KDV rates in force and unique codes', () => {
    expect([...VAT_RATES]).toEqual([0, 1, 10, 20]);
    expect(new Set(WITHHOLDING_CODES.map((c) => c.code)).size).toBe(WITHHOLDING_CODES.length);
    expect(new Set(EXEMPTION_CODES.map((c) => c.code)).size).toBe(EXEMPTION_CODES.length);
    expect(WITHHOLDING_CODES.find((c) => c.code === '601')?.percent).toBe(40);
  });
});

describe('UBL-TR invoice XML', () => {
  it('is well-formed UBL-TR 1.2 with the header GİB reads', async () => {
    const doc = await xml(invoice());
    expect(doc.$.xmlns).toBe('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2');
    expect(text(doc['cbc:UBLVersionID'][0])).toBe('2.1');
    expect(text(doc['cbc:CustomizationID'][0])).toBe('TR1.2');
    expect(text(doc['cbc:ProfileID'][0])).toBe('TICARIFATURA');
    expect(text(doc['cbc:ID'][0])).toBe('RNK2026000000001');
    expect(text(doc['cbc:UUID'][0])).toBe('3f1e2d4c-5b6a-4789-9abc-def012345678');
    expect(text(doc['cbc:InvoiceTypeCode'][0])).toBe('SATIS');
    expect(text(doc['cbc:LineCountNumeric'][0])).toBe('1');
  });

  it('escapes text so customer input cannot break the document', async () => {
    const doc = await xml(invoice());
    expect(text(doc['cac:InvoiceLine'][0]['cac:Item'][0]['cbc:Name'][0])).toBe('Bioklimatik pergola 4x3 <RAL 7016> & montaj');
    expect(escapeXml(`a<b>&"'`)).toBe('a&lt;b&gt;&amp;&quot;&apos;');
  });

  it('writes the seller and a company buyer with VKN, MERSİS, tax office and address', async () => {
    const doc = await xml(invoice());
    const s = doc['cac:AccountingSupplierParty'][0]['cac:Party'][0];
    const ids = s['cac:PartyIdentification'].map((p: any) => [p['cbc:ID'][0].$.schemeID, text(p['cbc:ID'][0])]);
    expect(ids).toEqual([['VKN', '1234567890'], ['MERSISNO', '0123456789000015']]);
    expect(text(s['cac:PartyName'][0]['cbc:Name'][0])).toBe(seller.name);
    expect(text(s['cac:PartyTaxScheme'][0]['cac:TaxScheme'][0]['cbc:Name'][0])).toBe('Gebze');
    expect(text(s['cac:PostalAddress'][0]['cbc:CityName'][0])).toBe('Kocaeli');
    const b = doc['cac:AccountingCustomerParty'][0]['cac:Party'][0];
    expect(b['cac:PartyIdentification'][0]['cbc:ID'][0].$.schemeID).toBe('VKN');
    expect(b['cac:Person']).toBeUndefined();
  });

  it('writes a person buyer as a Person (never a company name at the same time)', async () => {
    const doc = await xml(invoice({ documentType: 'e_arsiv', profile: 'EARSIVFATURA', buyer: { name: 'Ayşe Nur Yılmaz', taxNumber: '10000000146', city: 'Bursa' } }));
    const b = doc['cac:AccountingCustomerParty'][0]['cac:Party'][0];
    expect(b['cac:PartyIdentification'][0]['cbc:ID'][0].$.schemeID).toBe('TCKN');
    expect(b['cac:PartyName']).toBeUndefined();
    expect(text(b['cac:Person'][0]['cbc:FirstName'][0])).toBe('Ayşe Nur');
    expect(text(b['cac:Person'][0]['cbc:FamilyName'][0])).toBe('Yılmaz');
    expect(text(doc['cac:AdditionalDocumentReference'][0]['cbc:DocumentTypeCode'][0])).toBe('SendingType');
  });

  it('uses the placeholder TCKN for an e-Arşiv consumer without an ID number', async () => {
    const doc = await xml(invoice({ documentType: 'e_arsiv', profile: 'EARSIVFATURA', buyer: { name: 'Mehmet Demir', taxNumber: null, city: 'İzmir' } }));
    expect(text(doc['cac:AccountingCustomerParty'][0]['cac:Party'][0]['cac:PartyIdentification'][0]['cbc:ID'][0])).toBe(UNKNOWN_CONSUMER_TCKN);
  });

  it('adds up VAT per rate and the monetary totals', async () => {
    const doc = await xml(invoice({}, [{ quantity: 2, unitPrice: 1000, vatPercent: 20 }, { quantity: 1, unitPrice: 500, vatPercent: 10 }]));
    const tax = doc['cac:TaxTotal'][0];
    expect(text(tax['cbc:TaxAmount'][0])).toBe('450.00');
    expect(tax['cbc:TaxAmount'][0].$.currencyID).toBe('TRY');
    const subs = tax['cac:TaxSubtotal'].map((t: any) => [text(t['cbc:Percent'][0]), text(t['cbc:TaxableAmount'][0]), text(t['cbc:TaxAmount'][0]), text(t['cac:TaxCategory'][0]['cac:TaxScheme'][0]['cbc:TaxTypeCode'][0])]);
    expect(subs).toEqual([['20', '2000.00', '400.00', '0015'], ['10', '500.00', '50.00', '0015']]);
    const m = doc['cac:LegalMonetaryTotal'][0];
    expect([m['cbc:LineExtensionAmount'], m['cbc:TaxExclusiveAmount'], m['cbc:TaxInclusiveAmount'], m['cbc:PayableAmount']].map((x: any) => text(x[0]))).toEqual(['2500.00', '2500.00', '2950.00', '2950.00']);
    expect(doc['cac:WithholdingTaxTotal']).toBeUndefined();
  });

  it('writes withholding (tevkifat) and pays the total less the withheld VAT', async () => {
    const doc = await xml(invoice({ typeCode: 'TEVKIFAT' }, [{ withholdingCode: '601', withholdingPercent: 40 }]));
    const w = doc['cac:WithholdingTaxTotal'][0];
    expect(text(w['cbc:TaxAmount'][0])).toBe('800.00');
    const sub = w['cac:TaxSubtotal'][0];
    expect(text(sub['cbc:TaxableAmount'][0])).toBe('2000.00');
    expect(text(sub['cbc:Percent'][0])).toBe('40');
    expect(text(sub['cac:TaxCategory'][0]['cac:TaxScheme'][0]['cbc:TaxTypeCode'][0])).toBe('601');
    expect(text(doc['cac:LegalMonetaryTotal'][0]['cbc:PayableAmount'][0])).toBe('11200.00');
    expect(doc['cac:InvoiceLine'][0]['cac:WithholdingTaxTotal']).toHaveLength(1);
  });

  it('writes the exemption code on a 0 % line', async () => {
    const doc = await xml(invoice({ typeCode: 'ISTISNA' }, [{ vatPercent: 0, exemptionCode: '301' }]));
    const cat = doc['cac:TaxTotal'][0]['cac:TaxSubtotal'][0]['cac:TaxCategory'][0];
    expect(text(cat['cbc:TaxExemptionReasonCode'][0])).toBe('301');
    expect(text(cat['cbc:TaxExemptionReason'][0])).toBe('11/1-a Mal ihracatı');
  });

  it('writes the exchange rate, IBAN and due date', async () => {
    const doc = await xml(invoice({ currency: 'EUR', exchangeRate: 38.4512, iban: 'TR33 0006 1005 1978 6457 8413 26', dueDate: '2026-11-13' }));
    const rate = doc['cac:PricingExchangeRate'][0];
    expect([text(rate['cbc:SourceCurrencyCode'][0]), text(rate['cbc:TargetCurrencyCode'][0]), text(rate['cbc:CalculationRate'][0])]).toEqual(['EUR', 'TRY', '38.4512']);
    expect(doc['cac:LegalMonetaryTotal'][0]['cbc:PayableAmount'][0].$.currencyID).toBe('EUR');
    const pay = doc['cac:PaymentMeans'][0];
    expect(text(pay['cbc:PaymentDueDate'][0])).toBe('2026-11-13');
    expect(text(pay['cac:PayeeFinancialAccount'][0]['cbc:ID'][0])).toBe('TR330006100519786457841326');
  });
});

describe('checks before sending', () => {
  it('passes a complete invoice', () => {
    expect(eBelgeProblems(invoice())).toEqual([]);
  });
  it('names the missing seller identity', () => {
    const problems = eBelgeProblems(invoice({ seller: { name: 'Renk', taxNumber: null, taxOffice: '', addressLine: '', district: '', city: '' } }));
    expect(problems).toEqual(expect.arrayContaining(['Firma VKN/TCKN eksik ya da hatalı', 'Firma vergi dairesi eksik', 'Firma adresi (açık adres, ilçe, il) eksik']));
  });
  it('needs the buyer ID for e-Fatura but not for e-Arşiv', () => {
    const buyer = { name: 'Mehmet Demir', taxNumber: null, city: 'İzmir' };
    expect(eBelgeProblems(invoice({ buyer }))).toContain('e-Fatura için müşterinin VKN/TCKN bilgisi gerekli');
    expect(eBelgeProblems(invoice({ buyer, documentType: 'e_arsiv', profile: 'EARSIVFATURA' }))).toEqual([]);
  });
  it('matches the invoice type to withholding and exemption lines', () => {
    expect(eBelgeProblems(invoice({}, [{ withholdingCode: '601', withholdingPercent: 40 }]))).toContain('Tevkifatlı satır varken fatura tipi TEVKIFAT olmalı');
    expect(eBelgeProblems(invoice({ typeCode: 'TEVKIFAT' }))).toContain('TEVKIFAT tipli faturada tevkifatlı satır yok');
    expect(eBelgeProblems(invoice({}, [{ vatPercent: 0 }]))).toContain("%0 KDV'li satır için istisna kodu gerekli: Bioklimatik pergola 4x3 <RAL 7016> & montaj");
    expect(eBelgeProblems(invoice({}, [{ vatPercent: 0, exemptionCode: '301' }]))).toContain('İstisna kodlu satır varken fatura tipi ISTISNA olmalı');
    // 351 marks a 0 % line on an ordinary sale.
    expect(eBelgeProblems(invoice({}, [{ vatPercent: 0, exemptionCode: '351' }]))).toEqual([]);
    expect(eBelgeProblems(invoice({}, [{ withholdingCode: '999', withholdingPercent: 40 }]))).toContain('Tanınmayan tevkifat kodu: 999');
  });
  it('needs a rate on foreign-currency invoices', () => {
    expect(eBelgeProblems(invoice({ currency: 'USD' }))).toContain('Dövizli fatura için kur gerekli');
  });
  it('checks TCKN digits with the published algorithm', () => {
    expect(isValidTckn('10000000146')).toBe(true);
    expect(isValidTckn('10000000147')).toBe(false);
    expect(isValidTckn('00000000146')).toBe(false);
  });
});
