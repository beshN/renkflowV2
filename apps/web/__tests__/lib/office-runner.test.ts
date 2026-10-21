/** @jest-environment node */
const stream = jest.fn(), retrieveMetadata = jest.fn(), download = jest.fn(), remove = jest.fn(), uploadFile = jest.fn();
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
const chat = jest.fn();
jest.mock('openai', () => {
  class APIError extends Error { status?: number }
  const OpenAI = jest.fn().mockImplementation(() => ({ chat: { completions: { create: (...a: unknown[]) => chat(...a) } } }));
  Object.assign(OpenAI, { APIError });
  return { __esModule: true, default: OpenAI };
});
jest.mock('@/lib/db', () => ({
  sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?');
    statements.push({ text, values });
    if (text.includes("SET status='working'")) return Promise.resolve(taskRow ? [taskRow] : []);
    if (text.includes('FROM tenants')) return Promise.resolve([{ name: 'Renk Alüminyum' }]);
    return Promise.resolve([]);
  }),
}));
jest.mock('@/lib/storage', () => ({ uploadFile: (...a: unknown[]) => uploadFile(...a) }));
jest.mock('@/lib/ai/gate.server', () => ({ assertModelAllowed: jest.fn(async () => {}) }));

import { runOfficeTask } from '@/lib/features/office/runner.server';
import { decide } from '@/lib/features/office/routing';

const usage = { input_tokens: 1000, output_tokens: 500 };
const lastUpdate = () => [...statements].reverse().find(s => s.text.startsWith('UPDATE office_tasks'))!;

beforeEach(() => {
  jest.clearAllMocks();
  statements.length = 0;
  process.env.ANTHROPIC_API_KEY = 'test-office-key';
  taskRow = {
    id: 'task-1', tenant_id: 't1', category: 'spreadsheet', title: 'Gider tablosu', brief: 'Muhasebe: ali@renk.com.tr',
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
    expect(remove).toHaveBeenCalledWith('file_x');
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

  it('runs a free-family task on OpenRouter and stores the CSV it writes', async () => {
    process.env.OPENROUTER_API_KEY = 'or-test';
    taskRow = { ...taskRow!, decision: decide({ category: 'spreadsheet', title: 'Gider tablosu', brief: '', revisions: 0 }, 'free') };
    chat.mockResolvedValue({ usage: { prompt_tokens: 50, completion_tokens: 80 }, choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [{ type: 'function', function: { name: 'teslim_et', arguments: JSON.stringify({ dosya_adi: 'gider-tablosu', icerik: 'Kalem;Tutar\nKira;1000', not: 'Ekim giderleri.' }) } }] } }] });
    await runOfficeTask('t1', 'task-1');
    expect(stream).not.toHaveBeenCalled();
    expect(chat.mock.calls[0][0].model).toBe('nvidia/nemotron-3.5-super-vl:free');
    expect(chat.mock.calls[0][0].messages[1].content).not.toContain('ali@renk.com.tr');
    const [key, bytes, type] = uploadFile.mock.calls[0];
    expect(key).toMatch(/gider-tablosu\.csv$/);
    expect((bytes as Buffer).toString('utf8')).toBe('\uFEFFKalem;Tutar\nKira;1000');
    expect(type).toBe('text/csv; charset=utf-8');
    expect(lastUpdate().text).toContain("status='review'");
    delete process.env.OPENROUTER_API_KEY;
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
});
