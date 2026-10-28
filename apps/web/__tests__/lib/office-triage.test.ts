/** @jest-environment node */
const parse = jest.fn();
jest.mock('server-only', () => ({}));
jest.mock('@anthropic-ai/sdk', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({ messages: { parse: (...a: unknown[]) => parse(...a) } })) }));
jest.mock('@anthropic-ai/sdk/helpers/zod', () => ({ zodOutputFormat: () => ({ type: 'json_schema' }) }));
jest.mock('@/lib/db', () => ({ sql: jest.fn(() => Promise.resolve([])) }));
jest.mock('@/lib/ai/gate.server', () => ({ assertModelAllowed: jest.fn(async () => {}), reserveModelCall: jest.fn(async () => null), releaseModelReservation: jest.fn(async () => {}) }));

import { shortTitle, triageByRules } from '@/lib/features/office/triage';
import { triage } from '@/lib/features/office/triage.server';
import { OfficeSimulation } from '@/lib/features/office/simulation';

const meta = { tenantId: 't1', userId: 'u1' };

describe('office manager reading a plain-words task', () => {
  it.each([
    ['Yeni pergola serisi için Instagram gönderisi tasarla', 'design'],
    ['Tedarikçi fiyatlarını karşılaştıran bir Excel tablosu hazırla', 'spreadsheet'],
    ['Geciken teslimat için müşteriye özür e-postası yaz', 'correspondence'],
    ['Bayi toplantısı için 8 slaytlık sunum hazırla', 'presentation'],
    ['Ürün kataloğu metnini İngilizceye çevir', 'translation'],
    ['Bölgedeki cam balkon rakiplerini araştır', 'research'],
    ['İki tedarikçi listesini birleştir ve tekrarları temizle', 'data'],
    ['Montaj garanti belgesi hazırla', 'document'],
  ])('rules: %s → %s', (text, category) => {
    expect(triageByRules(text).category).toBe(category);
  });

  it('makes a short board title from the first sentence', () => {
    expect(shortTitle('Fuar için afiş tasarla. Renkler lacivert olsun.')).toBe('Fuar için afiş tasarla');
    expect(shortTitle('a '.repeat(100)).length).toBeLessThanOrEqual(81);
  });

  it('asks Sonnet 5.5 at low effort and uses its call, with personal data masked', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    parse.mockResolvedValue({ usage: { input_tokens: 300, output_tokens: 40 }, parsed_output: { category: 'correspondence', title: 'Özür e-postası', reason: 'müşteriye yazı isteniyor' } });
    const read = await triage('ali@renk.com.tr adresine özür yazısı hazırla', meta);
    expect(read).toMatchObject({ category: 'correspondence', title: 'Özür e-postası', by: 'model' });
    expect(read.costUsd).toBeGreaterThan(0);
    const request = parse.mock.calls[0][0];
    expect(request.model).toBe('claude-sonnet-5-5');
    expect(request.output_config.effort).toBe('low');
    expect(request.messages[0].content).not.toContain('ali@renk.com.tr');
  });

  it('falls back to the rules when the model call fails', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    parse.mockRejectedValue(new Error('down'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await triage('Excel tablosu hazırla', meta)).toMatchObject({ category: 'spreadsheet', by: 'rules', costUsd: 0 });
    warn.mockRestore();
  });

  it('lets the simulation take a plain-words task too', () => {
    const sim = new OfficeSimulation({ breaks: false });
    const task = sim.assignText('Kartvizit tasarımı yap');
    expect(task).toMatchObject({ category: 'design', agentId: 'deniz' });
    expect(task.decision?.triage?.by).toBe('rules');
    expect(sim.events.some(e => e.kind === 'technical' && e.text.includes('görevini okudu: Grafik tasarım'))).toBe(true);
  });
});
