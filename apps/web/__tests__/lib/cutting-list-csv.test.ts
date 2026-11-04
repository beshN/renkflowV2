import { cuttingListCsv, storedMillimetres } from '@/lib/features/manufacturing/cutting-list-csv';
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

it('writes each profile remainder only on its first piece row', () => {
  const csv = cuttingListCsv([
    {...row, remainingMm: 125},
    {...row, piecePosition: 2, remainingMm: 125},
    {...row, barPosition: 2, remainingMm: 0},
    {...row, barPosition: 2, piecePosition: 2, remainingMm: 0},
  ]).split('\r\n').map(line => line.split(';'));
  expect(csv[0][10]).toBe('Profil artığı (mm, profil başına)');
  expect(csv.slice(1).map(fields => fields[10])).toEqual(['125', '', '0', '']);
});
it.each([[6000,6000], ['6000',6000], [' 1250.5 ',1250.5], ['0',0],
  ['',null], [' ',null], ['6000mm',null], ['6,5',null], ['0x10',null],
  ['Infinity',null], [Infinity,null], [null,null], [true,null], [{},null],
])('reads stored millimetres %p as %p', (value, expected) => {
  expect(storedMillimetres(value)).toBe(expected);
});
