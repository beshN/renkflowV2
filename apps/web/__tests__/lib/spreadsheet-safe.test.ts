/** @jest-environment node */
import { csvLine, csvSafeLine, csvSafeValue, csvValue } from '@/lib/features/account/export-plan';
import { csvCell as auditCell } from '@/lib/audit/audit-csv';
import { generateCSVContent } from '@/lib/features/finance/utils';
import { looksLikeFormula, neutralizeFormula, restoreNeutralized, spreadsheetText } from '@/lib/security/spreadsheet-safe';

describe('formula neutralisation (S-07)', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+1+1', "'+1+1"],
    ['-1+1', "'-1+1"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\t=1', "'\t=1"],
    ['\r=1', "'\r=1"],
    ['=HYPERLINK("http://x","y")', "'=HYPERLINK(\"http://x\",\"y\")"],
    ['-cmd|calc', "'-cmd|calc"],
    ['+90 555 000 00 00', "'+90 555 000 00 00"],
    ['-', "'-"],
  ])('%j → %j', (input, expected) => expect(neutralizeFormula(input)).toBe(expected));

  it.each(['-12.5', '-3', '12', '0.25', '-.5', '1e-7', '-2E+3', 'Ayşe', '', ' =x', 'a=b', "'=already"])('%j stays as it is', (value) => {
    expect(neutralizeFormula(value)).toBe(value);
  });

  it('numbers, booleans and dates are never prefixed; other values are', () => {
    expect(spreadsheetText(-12.5)).toBe('-12.5');
    expect(spreadsheetText(BigInt(-7))).toBe('-7');
    expect(spreadsheetText(false)).toBe('false');
    expect(spreadsheetText(new Date('2026-10-28T00:00:00Z'))).toBe('2026-10-28T00:00:00.000Z');
    expect(spreadsheetText(null)).toBe('');
    expect(spreadsheetText('=x')).toBe("'=x");
    expect(spreadsheetText(['=x'])).toBe('["=x"]');
  });

  it('restoreNeutralized undoes exactly what neutralizeFormula added', () => {
    for (const v of ['=1+1', '-1+1', '@x', '+90 555', 'Ayşe', '-12.5', "'quoted", '']) expect(restoreNeutralized(neutralizeFormula(v))).toBe(v);
    expect(looksLikeFormula('-12.5')).toBe(false);
  });
});

describe('other CSV downloads use the same rule', () => {
  it('audit CSV: formula text neutralised, negative numbers kept, tab/CR covered', () => {
    expect(auditCell('=1+1')).toBe("'=1+1");
    expect(auditCell('\t=1')).toBe("'\t=1");
    expect(auditCell(-12.5)).toBe('-12.5');
    expect(auditCell('-12.5')).toBe('-12.5');
  });
  it('finance CSV: neutralised and correctly quoted', () => {
    expect(generateCSVContent([{ a: '=SUM(A1)', b: -3, c: 'x, "y"' }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }]))
      .toBe('A,B,C\n\'=SUM(A1),-3,"x, ""y"""');
  });
});

describe('firm export cells: safe copy vs raw copy', () => {
  it('the safe cell neutralises formula text and still quotes per RFC 4180', () => {
    expect(csvSafeValue('=1+1')).toBe("'=1+1");
    expect(csvSafeValue('=HYPERLINK("a","b")')).toBe(`"'=HYPERLINK(""a"",""b"")"`);
    expect(csvSafeValue('\r=1')).toBe(`"'\r=1"`);
    expect(csvSafeValue({ a: 1 })).toBe('"{""a"":1}"');
  });
  it('real numbers stay numbers, also when the driver gives numeric columns as text', () => {
    expect(csvSafeValue(-12.5)).toBe('-12.5');
    expect(csvSafeValue('-12.5')).toBe('-12.5');
    expect(csvSafeValue(BigInt(-3))).toBe('-3');
    expect(csvSafeLine([-1, '-1', '-1-1', null])).toBe("-1,-1,'-1-1,\r\n");
  });
  it('the raw cell is byte-exact', () => {
    for (const v of ['=1+1', '+1', '-1+1', '@x', '\t=1', 'Ayşe "Ltd"']) {
      const cell = csvValue(v);
      const unquoted = cell.startsWith('"') ? cell.slice(1, -1).replace(/""/g, '"') : cell;
      expect(unquoted).toBe(v);
    }
    expect(csvLine(['=1+1', -12.5])).toBe('=1+1,-12.5\r\n');
  });
});
