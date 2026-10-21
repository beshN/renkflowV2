/** @jest-environment node */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { createMasker } from '@/lib/ai/privacy';
import { unmaskFile } from '@/lib/features/office/unmask';

const masker = createMasker(['Ayşe & Oğulları']);
const name = masker.mask('Ayşe & Oğulları');

describe('putting real names back into delivered files', () => {
  it('rewrites Word, Excel and PowerPoint parts, escaped for XML', () => {
    const docx = Buffer.from(zipSync({
      '[Content_Types].xml': strToU8('<Types/>'),
      'word/document.xml': strToU8(`<w:t>Sayın ${name}</w:t>`),
      'word/media/logo.png': new Uint8Array([1, 2, 3]),
    }));
    const out = unzipSync(new Uint8Array(unmaskFile({ name: 'mektup.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: docx }, masker.restore)));
    expect(strFromU8(out['word/document.xml'])).toBe('<w:t>Sayın Ayşe &amp; Oğulları</w:t>');
    expect(Object.keys(out)).toEqual(['[Content_Types].xml', 'word/document.xml', 'word/media/logo.png']);
    expect([...out['word/media/logo.png']]).toEqual([1, 2, 3]);
  });

  it('rewrites text as is, and leaves files without placeholders and images untouched', () => {
    const letter = Buffer.from(`Değerli ${name},`);
    expect(unmaskFile({ name: 'a.txt', contentType: 'text/plain; charset=utf-8', bytes: letter }, masker.restore).toString()).toBe('Değerli Ayşe & Oğulları,');
    const plain = Buffer.from('Merhaba');
    expect(unmaskFile({ name: 'a.txt', contentType: 'text/plain', bytes: plain }, masker.restore)).toBe(plain);
    const png = Buffer.from(name);
    expect(unmaskFile({ name: 'a.png', contentType: 'image/png', bytes: png }, masker.restore)).toBe(png);
    // An unknown placeholder stays a placeholder.
    expect(unmaskFile({ name: 'b.md', contentType: 'text/markdown', bytes: Buffer.from('[KİŞİ_9]') }, masker.restore).toString()).toBe('[KİŞİ_9]');
  });

  it('stores a broken archive as delivered', () => {
    const broken = Buffer.from('not a zip');
    expect(unmaskFile({ name: 'x.xlsx', contentType: 'application/octet-stream', bytes: broken }, masker.restore)).toBe(broken);
  });
});
