import { cuttingListCsv } from '@/lib/features/manufacturing/cutting-list-csv';
const row = { barPosition: 1, piecePosition: 1 };
describe('cutting CSV synthetic fixtures', () => {
  it('empty plan includes UTF-8 BOM and header only', () => {
    const csv = cuttingListCsv([]);
    expect(Buffer.from(csv).subarray(0, 3)).toEqual(Buffer.from([239,187,191]));
    expect(csv.split('\r\n')).toHaveLength(1);
  });
  it('preserves Turkish and CSV escapes', () => {
    expect(cuttingListCsv([{...row, profileName: 'Ölçü; "İş"\nŞĞıç'}])).toContain('"Ölçü; ""İş""\nŞĞıç"');
  });
  it.each(['=SUM(A1)', '+cmd', '-cmd', '@cmd', '-123', '\t=cmd'])('escapes %s', profileCode => {
    expect(cuttingListCsv([{...row, profileCode}])).toContain("'" + profileCode);
  });
  it('missing fields stay blank, zero and decimals remain numeric', () => {
    expect(cuttingListCsv([{...row, pieceLengthMm: 1250.5, remainingMm: 0}]).split('\r\n')[1].split(';')).toEqual(['','','','','1','1','1250.5','1','','','0','','','']);
  });
  it.each(['default','unconfirmed'])('marks %s estimates', parameterSource => {
    expect(cuttingListCsv([{...row, parameterSource}])).toContain(';Evet;' + parameterSource);
  });
});
