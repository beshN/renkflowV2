/** @jest-environment node */
const stream = jest.fn(), retrieveMetadata = jest.fn(), download = jest.fn(), remove = jest.fn(), uploadFile = jest.fn(), deleteFile = jest.fn(async () => {});
let leaseHeld = true;
const statements: Array<{ text: string; values: unknown[] }> = [];
let taskRow: Record<string, unknown> | null;

jest.mock('server-only', () => ({}));
jest.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error { status?: number }
  const Anthropic = jest.fn().mockImplementation(() => ({
    beta: { messages: { stream: (...a: unknown[]) => ({ finalMessage: () => stream(...a) }) } },
    files: { retrieveMetadata: (...a: unknown[]) => retrieveMetadata(...a), download: (...a: unknown[]) => download(...a), delete: (...a: unknown[]) => remove(...a) },
  }));
  Object.assign(Anthropic, { APIError });
  return { __esModule: true, default: Anthropic };
});
const reviewDelivery = jest.fn();
jest.mock('@/lib/features/office/review.server', () => ({ reviewDelivery: (...a: unknown[]) => reviewDelivery(...a) }));
jest.mock('@/lib/db', () => ({
  sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?');
    statements.push({ text, values });
    if (text.includes("SET status='working'")) return Promise.resolve(taskRow ? [taskRow] : []);
    if (text.startsWith('INSERT INTO office_files')) return Promise.resolve(leaseHeld ? [{ id: 'file-1' }] : []);
    if (text.includes('RETURNING id')) return Promise.resolve([{ id: 'task-1' }]);
    if (text.includes('FROM tenants')) return Promise.resolve([{ name: 'Renk Alüminyum' }]);
    return Promise.resolve([]);
  }),
}));
jest.mock('@/lib/storage', () => ({ uploadFile: (...a: unknown[]) => uploadFile(...a), deleteFile: (...a: unknown[]) => deleteFile(...(a as [])) }));
jest.mock('@/lib/ai/gate.server', () => ({ assertModelAllowed: jest.fn(async () => {}) }));
jest.mock('@/lib/ai/known-names', () => ({ tenantPersonalNames: jest.fn(async () => ['Yılmaz Yapı']) }));
const lookUpRecords = jest.fn();
jest.mock('@/lib/features/office/data.server', () => ({
  companyProfile: jest.fn(async () => ({ name: 'Renk Alüminyum', city: 'Ankara', phone: '0312 555 00 00' })),
  taskActor: jest.fn(async () => ({ tenantId: 't1', userId: 'u1', role: 'office' })),
  lookUpRecords: (...a: unknown[]) => lookUpRecords(...a),
}));

import { sql } from '@/lib/db';
Object.assign(sql, { json: (value: unknown) => value });

import { runOfficeTask } from '@/lib/features/office/runner.server';
import { decide } from '@/lib/features/office/routing';

const usage = { input_tokens: 1000, output_tokens: 500 };
const lastUpdate = () => [...statements].reverse().find(s => s.text.startsWith('UPDATE office_tasks'))!;

beforeEach(() => {
  leaseHeld = true;
  jest.clearAllMocks();
  statements.length = 0;
  reviewDelivery.mockResolvedValue({ cost: 0, review: { status: 'approved', score: 9, note: 'Kontrol edildi.', issues: [], revision: 0, checkedAt: '2026-10-21T12:00:00Z' } });
  process.env.ANTHROPIC_API_KEY = 'test-office-key';
  taskRow = {
    started_at: new Date('2026-10-21T12:00:00Z'), id: 'task-1', tenant_id: 't1', category: 'spreadsheet', title: 'Gider tablosu', brief: 'Muhasebe: ali@renk.com.tr',
    agent_id: 'murat', answers: [], notes: [], revisions: 0, created_by: 'u1',
    decision: decide({ category: 'spreadsheet', title: 'Gider tablosu', brief: '', revisions: 0 }),
  };
  retrieveMetadata.mockResolvedValue({ filename: 'gider-tablosu.xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  remove.mockResolvedValue({});
  download.mockResolvedValue({ arrayBuffer: async () => new TextEncoder().encode('xlsx-bytes').buffer });
});

describe('running an AI office task', () => {
  it('builds the file on Sonnet 5.5 with the xlsx skill, stores it for the firm and asks for review', async () => {
    stream.mockResolvedValue({
      stop_reason: 'end_turn', usage,
      content: [
        { type: 'bash_code_execution_tool_result', content: { type: 'bash_code_execution_result', content: [{ type: 'bash_code_execution_output', file_id: 'file_x' }] } },
        { type: 'text', text: 'Tablo hazır, toplamlar formülle.' },
      ],
    });
    await runOfficeTask('t1', 'task-1');

    const request = stream.mock.calls[0][0];
    expect(request.model).toBe('claude-sonnet-5-5');
    expect(request.container).toEqual({ skills: [{ type: 'anthropic', skill_id: 'xlsx', version: 'latest' }] });
    expect(request.betas).toEqual(['code-execution-2025-08-25']);
    // Personal data leaves as a placeholder.
    expect(request.messages[0].content).not.toContain('ali@renk.com.tr');
    expect(request.messages[0].content).toContain('[E-POSTA_1]');

    expect(uploadFile).toHaveBeenCalledWith(expect.stringMatching(/^office\/t1\/task-1\/r0-.+-gider-tablosu\.xlsx$/), expect.any(Buffer), expect.stringContaining('spreadsheetml'));
    expect(statements.some(s => s.text.startsWith('INSERT INTO office_files') && s.values.includes('gider-tablosu.xlsx'))).toBe(true);
    expect(remove).toHaveBeenCalledWith('file_x', {}, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    const done = lastUpdate();
    expect(done.text).toContain("status='review'");
    expect(done.values).toContain('Tablo hazır, toplamlar formülle.');
    expect(Number(done.values.find(v => typeof v === 'number'))).toBeGreaterThan(0);
  });

  it('parks the task with the question when the person raises a hand', async () => {
    stream.mockResolvedValue({ stop_reason: 'tool_use', usage, content: [{ type: 'tool_use', name: 'soru_sor', input: { soru: 'Hangi ayların giderleri?' } }] });
    await runOfficeTask('t1', 'task-1');
    const parked = lastUpdate();
    expect(parked.text).toContain("status='needs_input'");
    expect(parked.values).toContain('Hangi ayların giderleri?');
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('fails the task when no file came back', async () => {
    stream.mockResolvedValue({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Bitti.' }] });
    await runOfficeTask('t1', 'task-1');
    expect(lastUpdate().text).toContain("status='failed'");
  });

  it('delivers plain writing as a text file without the sandbox', async () => {
    taskRow = { ...taskRow!, category: 'correspondence', title: 'Bayram duyurusu', agent_id: 'selin' };
    stream.mockResolvedValue({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Konu: Bayram tatili\n\nDeğerli müşterimiz…' }] });
    await runOfficeTask('t1', 'task-1');
    expect(stream.mock.calls[0][0].container).toBeUndefined();
    expect(uploadFile).toHaveBeenCalledWith(expect.stringMatching(/bayram-duyurusu\.txt$/), Buffer.from('Konu: Bayram tatili\n\nDeğerli müşterimiz…'), 'text/plain; charset=utf-8');
    expect(lastUpdate().text).toContain("status='review'");
  });

  it('checks actual delivered bytes before exposing a delivery for user approval', async () => {
    taskRow = { ...taskRow!, category: 'correspondence' };
    stream.mockResolvedValue({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'İncelenecek içerik' }] });
    await runOfficeTask('t1', 'task-1');
    expect(reviewDelivery.mock.calls[0][1][0].bytes.toString()).toBe('İncelenecek içerik');
    expect(lastUpdate().text).toContain('started_at=');
  });

  it('bounds automatic corrections and escalates persistent errors to the user', async () => {
    taskRow = { ...taskRow!, category: 'correspondence' };
    stream.mockResolvedValue({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Toplam yanlış' }] });
    reviewDelivery.mockResolvedValue({ cost: 0, review: { status: 'changes_requested', score: 4, note: 'Toplamı düzelt.', issues: ['Eksik kalem'], revision: 0, checkedAt: '2026-10-21T12:00:00Z' } });
    await runOfficeTask('t1', 'task-1');
    expect(stream).toHaveBeenCalledTimes(2);
    expect(lastUpdate().values).toContainEqual(expect.objectContaining({ review: expect.objectContaining({ status: 'needs_human' }) }));
    expect(lastUpdate().text).toContain("status='review'");
  });

  it('does nothing when another run already took the task', async () => {
    taskRow = null;
    await runOfficeTask('t1', 'task-1');
    expect(stream).not.toHaveBeenCalled();
  });

  it('records a model error as a failed task the person can retry', async () => {
    stream.mockRejectedValue(new Error('boom'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    await runOfficeTask('t1', 'task-1');
    expect(lastUpdate().text).toContain("status='failed'");
    log.mockRestore();
  });

  it('looks up the firm\'s records as the task giver and keeps names out of the model', async () => {
    taskRow = { ...taskRow!, category: 'correspondence', title: 'Teslim bilgisi', brief: 'RF-1024 siparişinin müşterisine teslim tarihini yaz', agent_id: 'selin' };
    lookUpRecords.mockResolvedValue([{ order_number: 'RF-1024', customer_name: 'Ayşe Demir', delivery_date: '2026-10-30' }]);
    stream
      .mockResolvedValueOnce({ stop_reason: 'tool_use', usage, container: { id: 'cnt_1' }, content: [{ type: 'tool_use', id: 'tu_1', name: 'firma_verisi', input: { category: 'orders', query: 'RF-1024' } }] })
      .mockResolvedValueOnce({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Sayın [KİŞİ_1], RF-1024 30 Ekim\'de teslim edilecek.' }] });
    await runOfficeTask('t1', 'task-1');

    expect(lookUpRecords).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }), 'orders', 'RF-1024');
    const second = stream.mock.calls[1][0];
    const result = JSON.stringify(second.messages.at(-1));
    expect(result).toContain('tool_result');
    expect(result).toContain('RF-1024');
    expect(result).not.toContain('Ayşe Demir');
    // The firm's own details reach the work, with its phone masked like any other.
    expect(second.system).toContain('Ankara');
    expect(second.system).not.toContain('0312 555 00 00');
    // The stored letter carries the real name; the manager checked the placeholder copy.
    expect(uploadFile.mock.calls[0][1].toString()).toBe('Sayın Ayşe Demir, RF-1024 30 Ekim\'de teslim edilecek.');
    expect(reviewDelivery.mock.calls[0][1][0].bytes.toString()).toContain('[KİŞİ_1]');
    expect(lastUpdate().text).toContain("status='review'");
  });

  it('masks the firm\'s known names in the task itself', async () => {
    taskRow = { ...taskRow!, category: 'correspondence', brief: 'Yılmaz Yapı için teşekkür yazısı', agent_id: 'selin' };
    stream.mockResolvedValue({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Değerli [KİŞİ_1],' }] });
    await runOfficeTask('t1', 'task-1');
    expect(stream.mock.calls[0][0].messages[0].content).not.toContain('Yılmaz Yapı');
    expect(uploadFile.mock.calls[0][1].toString()).toBe('Değerli Yılmaz Yapı,');
  });

  it('keeps no file from a run that lost the task to a retry', async () => {
    leaseHeld = false;
    taskRow = { ...taskRow!, category: 'correspondence', title: 'Bayram duyurusu', agent_id: 'selin' };
    stream.mockResolvedValue({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Konu: Bayram' }] });
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    await runOfficeTask('t1', 'task-1');
    expect(deleteFile).toHaveBeenCalledWith(uploadFile.mock.calls[0][0]);
    expect(reviewDelivery).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
