/**
 * @jest-environment node
 *
 * Every kind of invoice RenkFlow builds validates against the official OASIS UBL 2.1 Invoice schema
 * (fixtures/ubl-2.1-xsd, copied from docs.oasis-open.org/ubl/os-UBL-2.1). GİB's schematron rules come
 * on top of this at the provider; structure, order and data types are checked here.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildUblInvoice, type UblInvoice } from '@/lib/features/einvoice/ubl';
import { invoiceTotals, lineTotals, type LineInput } from '@/lib/features/finance/engine';

const SCHEMA = join(__dirname, '..', 'fixtures', 'ubl-2.1-xsd', 'maindoc', 'UBL-Invoice-2.1.xsd');
const seller = { name: 'Renk Alüminyum Ltd. Şti.', taxNumber: '1234567890', taxOffice: 'Gebze', addressLine: 'OSB 5. Cad. 12', district: 'Gebze', city: 'Kocaeli', postalCode: '41400', phone: '+90 262 000 00 00', email: 'fatura@renk.com.tr', mersisNo: '0123456789000015', tradeRegistryNo: '12345' };
const company = { name: 'Işık İnşaat A.Ş.', taxNumber: '9876543210', taxOffice: 'Kadıköy', addressLine: 'Moda 1', district: 'Kadıköy', city: 'İstanbul' };

type Line = LineInput & { withholdingCode?: string; exemptionCode?: string };
function invoice(overrides: Partial<UblInvoice>, lines: Line[]): UblInvoice {
  const t = invoiceTotals(lines);
  return {
    number: 'RNK2026000000001', ettn: '3f1e2d4c-5b6a-4789-9abc-def012345678', issueDate: '2026-10-14', issueTime: '10:30:00', documentType: 'e_fatura',
    profile: 'TEMELFATURA', typeCode: 'SATIS', currency: 'TRY', iban: 'TR330006100519786457841326', dueDate: '2026-11-13', notes: ['Teslim: Kadıköy'],
    seller, buyer: company,
    lines: lines.map((l) => { const x = lineTotals(l); return { description: 'Pergola & montaj <özel>', unitCode: 'C62', ...l, net: x.net, vat: x.vat, withholding: x.withholding }; }),
    totals: { subtotal: t.subtotal, vatTotal: t.vatTotal, total: t.total, withholdingTotal: t.withholdingTotal, payable: t.payable },
    ...overrides,
  };
}

const CASES: Array<[string, UblInvoice]> = [
  ['e-Fatura, two VAT rates', invoice({}, [{ quantity: 2, unitPrice: 1000, vatPercent: 20 }, { quantity: 1, unitPrice: 500, vatPercent: 10 }])],
  ['e-Arşiv to a person (TCKN)', invoice({ documentType: 'e_arsiv', profile: 'EARSIVFATURA', number: 'RNA2026000000001', buyer: { name: 'Ayşe Nur Yılmaz', taxNumber: '10000000146', city: 'Bursa' } }, [{ quantity: 1, unitPrice: 10000, vatPercent: 20 }])],
  ['e-Arşiv to a consumer without an ID', invoice({ documentType: 'e_arsiv', profile: 'EARSIVFATURA', number: 'RNA2026000000002', buyer: { name: 'Mehmet Demir', taxNumber: null, city: 'İzmir' } }, [{ quantity: 3, unitPrice: 33.335, vatPercent: 20 }])],
  ['withholding (TEVKIFAT 601)', invoice({ typeCode: 'TEVKIFAT' }, [{ quantity: 1, unitPrice: 10000, vatPercent: 20, withholdingPercent: 40, withholdingCode: '601' }])],
  ['exemption (ISTISNA 301)', invoice({ typeCode: 'ISTISNA' }, [{ quantity: 1, unitPrice: 5000, vatPercent: 0, exemptionCode: '301' }])],
  ['foreign currency with a rate', invoice({ currency: 'EUR', exchangeRate: 55.1128 }, [{ quantity: 1, unitPrice: 1000, vatPercent: 20 }])],
];

describe('UBL-TR XML against the OASIS UBL 2.1 schema', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ubl-xsd-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('has xmllint available (libxml2)', () => {
    expect(() => execFileSync('xmllint', ['--version'], { stdio: 'pipe' })).not.toThrow();
  });

  it.each(CASES)('%s is schema-valid', (name, doc) => {
    const file = join(dir, `${name.replace(/\W+/g, '-')}.xml`);
    writeFileSync(file, buildUblInvoice(doc));
    let output = '';
    try {
      output = execFileSync('xmllint', ['--noout', '--schema', SCHEMA, file], { stdio: 'pipe', encoding: 'utf8' });
    } catch (error) {
      output = String((error as { stderr?: string }).stderr ?? error);
      throw new Error(`schema validation failed:\n${output}`);
    }
    expect(output).toBe('');
  });
});
