/** @jest-environment node */
import { escapeZpl, generateZpl, labelDots, type ZplLabel } from '../zpl';
const code = 'RF-R-012345ABCDEF';
export const fixtures: ZplLabel[] = [
  { kind: 'cut', orderNumber: 'TEST-001', profileCode: 'P-108', lengthMm: 1250, quantity: 1, workOrder: '00000000-0000-4000-8000-000000000001', code: '00000000-0000-4000-8000-000000000001' },
  { kind: 'shipment', customer: 'Test Çığ Şirketi', orderNumber: 'TEST-001', packageNumber: '', packageTotal: '', summary: 'Test ürün · 2 adet' },
  { kind: 'location', locationCode: 'RAF-A1', code },
];
describe('ZPL labels', () => {
  it('escapes Turkish UTF-8 and all command/hex introducers', () => {
    expect(escapeZpl('çğıİöşü')).toBe('_C3_A7_C4_9F_C4_B1_C4_B0_C3_B6_C5_9F_C3_BC');
    expect(escapeZpl('^XZ~JA_\n')).toBe('_5E_58_5A_7E_4A_41_5F_20');
    const zpl = generateZpl({ kind: 'location', locationCode: '^XZ~JA_', code });
    expect(zpl.match(/\^XZ/g)).toHaveLength(1);
    expect(zpl).not.toContain('~JA');
  });
  it('uses mm and dpi for dimensions and bounds invalid/too-small sizes', () => {
    expect(labelDots()).toEqual({ width: 799, height: 400 });
    expect(generateZpl(fixtures[2], { widthMm: 80, heightMm: 50, dpi: 300 })).toContain('^PW945^LL591');
    for (const size of [{ widthMm: NaN }, { heightMm: 20 }, { dpi: Infinity }]) expect(() => labelDots(size)).toThrow();
  });
  it.each(fixtures)('renders $kind with UTF-8 mode and bounded fields', (label) => {
    const output = generateZpl(label);
    expect(output).toMatch(/^\^XA\^CI28\^PW799\^LL400/);
    expect(output).toMatch(/\^XZ$/);
    if (label.kind !== 'shipment') expect(output).toContain(`^FH_^FDLA,${escapeZpl(label.code)}^FS`);
    else expect(output).toContain(escapeZpl('Paket:  / '));
  });
  it('refuses overflowing text and invalid quantities rather than losing identifiers', () => {
    expect(() => generateZpl({ kind: 'location', locationCode: 'x'.repeat(51), code })).toThrow();
    expect(() => generateZpl({ ...fixtures[0], kind: 'cut', orderNumber: '', profileCode: '', workOrder: '', code, lengthMm: 12, quantity: 1.5 })).toThrow();
  });
});
