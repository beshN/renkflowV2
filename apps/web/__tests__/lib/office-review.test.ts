/** @jest-environment node */
import { deflateRawSync } from 'node:zlib';

const parse = jest.fn(), chat = jest.fn(), deleteFile = jest.fn(async () => {});
const statements: Array<{ text: string; values: unknown[] }> = [];
let taskRow: Record<string, unknown> | null;
let fileRows: Array<Record<string, unknown>>;
const stored = new Map<string, Buffer>();

jest.mock('server-only', () => ({}));
jest.mock('@anthropic-ai/sdk', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({ messages: { parse: (...a: unknown[]) => parse(...a) } })) }));
jest.mock('@anthropic-ai/sdk/helpers/zod', () => ({ zodOutputFormat: () => ({ type: 'json_schema' }) }));
jest.mock('openai', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({ chat: { completions: { create: (...a: unknown[]) => chat(...a) } } })) }));
jest.mock('@/lib/db', () => {
  const sql = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?');
    statements.push({ text, values });
    if (text.includes("jsonb_build_object('state','running')")) return Promise.resolve(taskRow ? [taskRow] : []);
    if (text.includes('FROM office_files')) return Promise.resolve(fileRows);
    return Promise.resolve([]);
  });
  return { sql: Object.assign(sql, { json: (v: unknown) => v }) };
});
jest.mock('@/lib/storage', () => ({
  readFile: async (key: string) => ({ body: new Blob([new Uint8Array(stored.get(key)!)]).stream() }),
  deleteFile: (...a: unknown[]) => deleteFile(...(a as [])),
}));
jest.mock('@/lib/ai/gate.server', () => ({ assertModelAllowed: jest.fn(async () => {}) }));

import { inspectFile, unzip } from '@/lib/features/office/inspect';
import { MAX_AUTO_REVISIONS, reviewOfficeTask } from '@/lib/features/office/review.server';
import { decide } from '@/lib/features/office/routing';

/** A minimal zip writer, enough to build Office files for the tests. */
function zip(entries: Record<string, string>) {
  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const data = deflateRawSync(Buffer.from(text)), nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data); centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const dir = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

describe('what the manager can read of a delivery', () => {
  it('reads the text of a Word file', () => {
    const docx = zip({ 'word/document.xml': '<w:document><w:body><w:p><w:r><w:t>Garanti Belgesi</w:t></w:r></w:p><w:p><w:r><w:t>Süre: 2 yıl &amp; servis</w:t></w:r></w:p></w:body></w:document>' });
    expect(unzip(docx).size).toBe(1);
    expect(inspectFile('garanti.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', docx).text).toBe('Garanti Belgesi\nSüre: 2 yıl & servis');
  });

  it('reads Excel cells with shared strings and formulas', () => {
    const xlsx = zip({
      'xl/sharedStrings.xml': '<sst><si><t>Kira</t></si><si><t>Toplam</t></si></sst>',
      'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>25000</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><f>SUM(B1:B1)</f><v>25000</v></c></row></sheetData></worksheet>',
    });
    expect(inspectFile('gider.xlsx', 'x', xlsx).text).toBe('--- Sayfa 1 ---\nKira\t25000\nToplam\t25000 (=SUM(B1:B1))');
  });

  it('reads PowerPoint slides in order', () => {
    const pptx = zip({ 'ppt/slides/slide2.xml': '<p:sld><a:p><a:t>İkinci</a:t></a:p></p:sld>', 'ppt/slides/slide1.xml': '<p:sld><a:p><a:t>Kapak</a:t></a:p></p:sld>' });
    expect(inspectFile('sunum.pptx', 'x', pptx).text).toBe('--- Slayt 1 ---\nKapak\n--- Slayt 2 ---\nİkinci');
  });

  it('passes text formats as they are, images as pictures, and says what it cannot read', () => {
    expect(inspectFile('t.csv', 'text/csv; charset=utf-8', Buffer.from('﻿a;b')).text).toBe('a;b');
    expect(inspectFile('a.png', 'image/png', Buffer.from('png')).image).toEqual({ mediaType: 'image/png', data: Buffer.from('png').toString('base64') });
    expect(inspectFile('a.bin', 'application/octet-stream', Buffer.from('x')).note).toContain('okunamıyor');
  });
});

const verdict = (karar: 'onay' | 'duzelt') => ({ karar, puan: karar === 'onay' ? 8 : 4, sorunlar: karar === 'onay' ? [] : ['Toplam yanlış'], not: 'Kısa not', calisana: karar === 'onay' ? '' : 'Toplamı 29600 olarak düzelt.' });
const lastUpdate = () => [...statements].reverse().find(s => s.text.startsWith('UPDATE office_tasks') && !s.text.includes("'running'"))!;

beforeEach(() => {
  jest.clearAllMocks();
  statements.length = 0;
  process.env.ANTHROPIC_API_KEY = 'k';
  taskRow = {
    id: 'task-1', category: 'spreadsheet', title: 'Gider tablosu', brief: 'Ekim giderleri', agent_id: 'murat', answers: [], notes: [], revisions: 0,
    auto_revisions: 0, summary: 'Tablo hazır.', created_by: 'u1', decision: decide({ category: 'spreadsheet', title: 'Gider tablosu', brief: '', revisions: 0 }),
  };
  stored.set('k1', Buffer.from('Kalem;Tutar\nKira;25000'));
  fileRows = [{ id: 'f1', file_name: 'gider.csv', content_type: 'text/csv', storage_key: 'k1' }];
});

describe("the manager's check", () => {
  it('reads the file, and an approval sends the work to the person with the score', async () => {
    parse.mockResolvedValue({ usage: { input_tokens: 500, output_tokens: 60 }, parsed_output: verdict('onay') });
    expect(await reviewOfficeTask('t1', 'task-1')).toEqual({ sentBack: false });
    const request = parse.mock.calls[0][0];
    expect(request.model).toBe('claude-sonnet-5-5');
    expect(request.messages[0].content.at(-1).text).toContain('Kira;25000');
    const done = lastUpdate();
    expect(done.text).toContain("status='review'");
    expect(done.values[0]).toMatchObject({ verdict: 'approve', score: 8, note: 'Kısa not' });
  });

  it('sends a faulty delivery back once, removing its files and passing the notes on', async () => {
    parse.mockResolvedValue({ usage: { input_tokens: 500, output_tokens: 60 }, parsed_output: verdict('duzelt') });
    expect(await reviewOfficeTask('t1', 'task-1')).toEqual({ sentBack: true });
    expect(deleteFile).toHaveBeenCalledWith('k1');
    expect(statements.some(s => s.text.startsWith('DELETE FROM office_files'))).toBe(true);
    const back = lastUpdate();
    expect(back.text).toContain("status='queued'");
    expect(back.values).toContainEqual(['Müdür kontrolü: Toplamı 29600 olarak düzelt.']);
  });

  it('leaves the decision to the person once the manager has sent it back enough', async () => {
    taskRow = { ...taskRow!, auto_revisions: MAX_AUTO_REVISIONS };
    parse.mockResolvedValue({ usage: { input_tokens: 500, output_tokens: 60 }, parsed_output: verdict('duzelt') });
    expect(await reviewOfficeTask('t1', 'task-1')).toEqual({ sentBack: false });
    expect(lastUpdate().text).toContain("status='review'");
    expect(lastUpdate().values[0]).toMatchObject({ verdict: 'revise', issues: ['Toplam yanlış'] });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('checks free-model work on the strongest free model', async () => {
    process.env.OPENROUTER_API_KEY = 'or';
    taskRow = { ...taskRow!, decision: decide({ category: 'spreadsheet', title: 'Gider tablosu', brief: '', revisions: 0 }, 'free') };
    chat.mockResolvedValue({ usage: { prompt_tokens: 100, completion_tokens: 30 }, choices: [{ message: { tool_calls: [{ type: 'function', function: { name: 'degerlendir', arguments: JSON.stringify(verdict('onay')) } }] } }] });
    await reviewOfficeTask('t1', 'task-1');
    expect(parse).not.toHaveBeenCalled();
    expect(chat.mock.calls[0][0].model).toBe('nvidia/nemotron-3-ultra-550b-a55b:free');
    expect(lastUpdate().values[0]).toMatchObject({ verdict: 'approve', reviewer: 'NVIDIA Nemotron 3 Ultra (ücretsiz)' });
    delete process.env.OPENROUTER_API_KEY;
  });

  it('passes the work on unchecked, and says so, when the check fails', async () => {
    parse.mockRejectedValue(new Error('down'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await reviewOfficeTask('t1', 'task-1');
    expect(lastUpdate().text).toContain("status='review'");
    expect(lastUpdate().values[0]).toMatchObject({ verdict: 'skipped' });
    warn.mockRestore();
  });

  it('does nothing when another check already took the task', async () => {
    taskRow = null;
    expect(await reviewOfficeTask('t1', 'task-1')).toEqual({ sentBack: false });
    expect(parse).not.toHaveBeenCalled();
  });
});
