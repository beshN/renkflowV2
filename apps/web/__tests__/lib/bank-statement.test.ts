/**
 * Bank statement files (CSV as Turkish banks export it, MT940, OFX) → statement lines.
 */
import { detectFormat, parseAmount, parseBankStatement, parseDate } from '@/lib/features/accounting/bank-statement';

const CSV_SIGNED = [
  'Hesap Hareketleri;;;;',
  'Hesap: TR33 0006 1005 1978 6457 8413 26;;;;',
  'Dönem: 01.10.2026 - 13.10.2026;;;;',
  '',
  'Tarih;Açıklama;Tutar;Bakiye;Dekont No',
  '01.10.2026;"FAST GELEN - IŞIK İNŞAAT; RF-1042";12.000,00;12.000,00;D-0001',
  '03.10.2026;KİRA ÖDEMESİ EKİM;-3.400,50;8.599,50;D-0002',
  '05.10.2026;EFT GELEN AYŞE YILMAZ;1.250,00;9.849,50;',
  '05.10.2026;EFT GELEN AYŞE YILMAZ;1.250,00;11.099,50;',
  'Toplam;;;;',
].join('\r\n');

const CSV_DEBIT_CREDIT = [
  'İşlem Tarihi,Açıklama,Borç,Alacak,Referans',
  '07/10/2026,"Tedarikçi ödemesi, Alüm A.Ş.","2,500.00",,R-9',
  '08/10/2026,Havale gelen,,"7,800.25",R-10',
].join('\n');

const MT940 = [
  '{1:F01RENKTRISAXXX0000000000}{2:I940BANKTRISXXXXN}{4:',
  ':20:STMT20261013',
  ':25:TR330006100519786457841326',
  ':28C:193/1',
  ':60F:C261012TRY10000,00',
  ':61:2610131013C12000,00NTRFRF-1042//BNK0001',
  ':86:FAST GELEN ISIK INSAAT',
  'RF-1042 HAKEDIS',
  ':61:2610131013D3400,50NMSCNONREF//BNK0002',
  ':86:KIRA EKIM',
  ':61:2610141014RC100,00NTRFNONREF//BNK0003',
  ':86:IADE DUZELTME',
  ':62F:C261014TRY18499,50',
  '-}',
].join('\r\n');

const OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>TRY
<BANKACCTFROM><BANKID>0062<ACCTID>6457841326<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261013120000[+3:EET]<TRNAMT>12000.00<FITID>2026101300001<NAME>ISIK INSAAT<MEMO>RF-1042</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261013<TRNAMT>-3400.50<FITID>2026101300002<NAME>KIRA</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

describe('amounts and dates', () => {
  it.each([
    ['1.234,56', 1234.56], ['-3.400,50', -3400.5], ['1,234.56', 1234.56], ['2500', 2500], ['12,5', 12.5],
    ['1.250.000', 1250000], ['1234,50-', -1234.5], ['(12,00)', -12], ['₺ 1.000,00', 1000], ['abc', null], ['', null],
  ])('%s → %s', (raw, value) => expect(parseAmount(raw)).toBe(value));

  it.each([
    ['13.10.2026', '2026-10-13'], ['1/2/2026', '2026-02-01'], ['13-10-2026 14:05', '2026-10-13'], ['2026-10-13', '2026-10-13'], ['32.10.2026', null], ['Toplam', null],
  ])('%s → %s', (raw, value) => expect(parseDate(raw)).toBe(value));
});

describe('CSV', () => {
  it('finds the header under title rows and reads signed amounts and quoted cells', () => {
    const s = parseBankStatement(CSV_SIGNED);
    expect(s.format).toBe('csv');
    expect(s.lines.map((l) => [l.statementDate, l.amount, l.reference])).toEqual([
      ['2026-10-01', 12000, 'D-0001'], ['2026-10-03', -3400.5, 'D-0002'], ['2026-10-05', 1250, null], ['2026-10-05', 1250, null],
    ]);
    expect(s.lines[0].description).toBe('FAST GELEN - IŞIK İNŞAAT; RF-1042');
    expect(s.warnings).toEqual(['Satır 10: tarih okunamadı, atlandı']);
  });

  it('gives identical rows different ids, and the same ids on every parse', () => {
    const a = parseBankStatement(CSV_SIGNED).lines.map((l) => l.externalId);
    expect(new Set(a).size).toBe(4);
    expect(parseBankStatement(CSV_SIGNED).lines.map((l) => l.externalId)).toEqual(a);
  });

  it('reads separate debit and credit columns', () => {
    const s = parseBankStatement(CSV_DEBIT_CREDIT);
    expect(s.lines.map((l) => [l.statementDate, l.amount, l.description, l.reference])).toEqual([
      ['2026-10-07', -2500, 'Tedarikçi ödemesi, Alüm A.Ş.', 'R-9'],
      ['2026-10-08', 7800.25, 'Havale gelen', 'R-10'],
    ]);
  });

  it('explains a file it cannot read', () => {
    expect(() => parseBankStatement('a;b;c\n1;2;3')).toThrow('Başlık satırı bulunamadı');
  });
});

describe('MT940', () => {
  it('reads statement lines, multi-line information, reversals and bank ids', () => {
    const s = parseBankStatement(MT940);
    expect(s.format).toBe('mt940');
    expect(s.accountRef).toBe('TR330006100519786457841326');
    expect(s.lines.map((l) => [l.statementDate, l.amount, l.reference, l.externalId])).toEqual([
      ['2026-10-13', 12000, 'RF-1042', 'mt940:BNK0001'],
      ['2026-10-13', -3400.5, null, 'mt940:BNK0002'],
      ['2026-10-14', -100, null, 'mt940:BNK0003'],
    ]);
    expect(s.lines[0].description).toBe('FAST GELEN ISIK INSAAT RF-1042 HAKEDIS');
  });
});

describe('OFX', () => {
  it('reads SGML OFX with FITIDs as ids', () => {
    const s = parseBankStatement(OFX);
    expect(s.format).toBe('ofx');
    expect(s.accountRef).toBe('6457841326');
    expect(s.lines.map((l) => [l.statementDate, l.amount, l.description, l.externalId])).toEqual([
      ['2026-10-13', 12000, 'ISIK INSAAT · RF-1042', 'ofx:2026101300001'],
      ['2026-10-13', -3400.5, 'KIRA', 'ofx:2026101300002'],
    ]);
  });
});

describe('detection', () => {
  it('tells the formats apart', () => {
    expect([detectFormat(OFX), detectFormat(MT940), detectFormat(CSV_SIGNED)]).toEqual(['ofx', 'mt940', 'csv']);
  });
});
