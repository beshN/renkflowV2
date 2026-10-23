/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
import { spreadsheetCsvCell } from '@/lib/security/csv';
import { exportOrdersToCSV, exportCustomersToCSV } from '@/lib/export/service';
import { exportToCSV } from '@/lib/analytics/reporting';
import { csvCell as auditCell } from '@/lib/audit/audit-csv';
import { sql } from '@/lib/db';
const attack = '=HYPERLINK("https://attacker.invalid","Aç")';
it.each([attack, '+cmd', '-cmd', '@SUM(A1)', '\t=SUM(A1)', '\r=1', '\n=1', '   =1+2', '\u0000=1', '＝1+2', '＠SUM(A1)'])('neutralizes unsafe spreadsheet text %j', value => {
  expect(spreadsheetCsvCell(value)).toBe(`"'${value.replace(/"/g, '""')}"`);
});
it('keeps commas, delimiters, quotes, CR and LF within their original cell', () => {
  expect(spreadsheetCsvCell('a,"b"\r\nc')).toBe('"a,""b""\r\nc"');
  expect(spreadsheetCsvCell('a;b', ';')).toBe('"a;b"');
  expect(spreadsheetCsvCell('customer\r=1')).toBe('"customer\r=1"');
});
it('retains numeric quantities and negative amounts while text phone numbers remain text', () => {
  expect(spreadsheetCsvCell(-123.45)).toBe('-123.45'); expect(spreadsheetCsvCell(0)).toBe('0');
  expect(spreadsheetCsvCell('+905320000000')).toBe('"\'+905320000000"');
  expect(spreadsheetCsvCell(null)).toBe('');
});
it('guards real order/customer exports as well as analytics headers and audit notes', async () => {
  jest.mocked(sql).mockResolvedValue([{ customer_name: attack, total_amount: -100 }] as never);
  for (const exporter of [exportOrdersToCSV, exportCustomersToCSV]) {
    const csv = await exporter('tenant', { columns: ['customer_name', 'total_amount'] });
    expect(csv).toBe(`customer_name,total_amount\n${spreadsheetCsvCell(attack)},-100`);
  }
  expect(exportToCSV([{ [attack]: attack }])).toBe(`${spreadsheetCsvCell(attack)}\n${spreadsheetCsvCell(attack)}`);
  expect(auditCell('   =1+2')).toBe('"\'   =1+2"');
});
