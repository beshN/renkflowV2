/** @jest-environment node */
jest.mock('server-only', () => ({}));
import { zipSync, strToU8 } from 'fflate';
import { inspectDelivery } from '@/lib/features/office/inspect.server';

it.each([
  ['rapor.docx', 'word/document.xml', '<w:document><w:p><w:t>Türkçe içerik</w:t></w:p></w:document>'],
  ['tablo.xlsx', 'xl/worksheets/sheet1.xml', '<worksheet><row><c r="A1"><v>29600</v></c></row></worksheet>'],
  ['sunum.pptx', 'ppt/slides/slide1.xml', '<p:sld><a:t>Türkçe içerik</a:t></p:sld>'],
])('reads actual Office content: %s', async (name, entry, xml) => {
  const bytes = Buffer.from(zipSync({ [entry]: strToU8(xml) }));
  expect(await inspectDelivery({ name, bytes, contentType: 'application/octet-stream' })).toContain(name.endsWith('xlsx') ? '29600' : 'Türkçe içerik');
});
it('refuses oversized expanded archives', async () => {
  const bytes = Buffer.from(zipSync({ 'word/document.xml': strToU8('x'.repeat(9 * 1024 * 1024)) }));
  await expect(inspectDelivery({ name: 'x.docx', bytes, contentType: 'application/octet-stream' })).rejects.toThrow('çok büyük');
});
it('does not claim to inspect unsupported binary formats', async () => {
  await expect(inspectDelivery({ name: 'x.bin', bytes: Buffer.from('data'), contentType: 'application/octet-stream' })).rejects.toThrow();
});
it('rejects XML entity definitions', async () => {
  const bytes = Buffer.from(zipSync({ 'word/document.xml': strToU8('<!DOCTYPE x><x>abc</x>') }));
  await expect(inspectDelivery({ name: 'x.docx', bytes, contentType: 'application/octet-stream' })).rejects.toThrow('XML');
});
