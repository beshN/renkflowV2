import { parseColorWords, parseCommand, parseCustomer, parseDims, parseOrderRef } from '@/lib/ai/commands/parse';

describe('command parser (Turkish, deterministic)', () => {
  it('quote draft from a one-liner', () => {
    const p = parseCommand("Ahmet Bey'e 3x4 pergola teklif hazırla antrasit");
    expect(p.command).toEqual({ intent: 'quote_draft', customer: 'Ahmet', family: 'pergola', widthMm: 3000, projectionMm: 4000, quantity: 1, color: 'RAL 7016' });
    expect(p.confidence).toBe('high');
  });
  it('slang and abbreviations still parse; missing parts are named', () => {
    const p = parseCommand('demir yapıya 450x300 cm bioklimatik teklif, 2 adet 9016');
    expect(p.command).toMatchObject({ customer: 'Demir Yapı', family: 'pergola', widthMm: 4500, projectionMm: 3000, quantity: 2, color: 'RAL 9016' });
    const q = parseCommand('pergola teklifi hazırla');
    expect(q.missing).toEqual(['müşteri', 'ölçü', 'renk']);
    expect(q.confidence).toBe('low');
  });
  it('late jobs by period', () => {
    expect(parseCommand('bu hafta geciken işler').command).toEqual({ intent: 'list_late', period: 'this_week' });
    expect(parseCommand('termini geçen siparişler hangileri').command).toEqual({ intent: 'list_late', period: 'overdue' });
    expect(parseCommand('gelecek hafta gecikecek iş var mı').command).toEqual({ intent: 'list_late', period: 'next_week' });
  });
  it('stock by colour', () => {
    expect(parseCommand('7016 mat kaç çubuk var').command).toEqual({ intent: 'stock_query', color: 'RAL 7016 Mat', item: null });
    expect(parseCommand('antrasit parlak profil stok').command).toMatchObject({ intent: 'stock_query', color: 'RAL 7016 Parlak' });
  });
  it('what-if: expedite, delay N days, cancel; without an order number it asks', () => {
    expect(parseCommand("ORD-12'yi öne al").command).toEqual({ intent: 'what_if', scenario: 'expedite', order: 'ORD-12', days: null });
    expect(parseCommand("ORD-12'ye 2 gün ekle").command).toEqual({ intent: 'what_if', scenario: 'delay', order: 'ORD-12', days: 2 });
    expect(parseCommand('RF 1024 siparişini iptal etsek ne olur').command).toEqual({ intent: 'what_if', scenario: 'cancel', order: 'RF-1024', days: null });
    expect(parseCommand('şu işi öne al').missing).toEqual(['sipariş numarası']);
  });
  it('unknown stays unknown (the model or the person decides, nothing is guessed)', () => {
    expect(parseCommand('merhaba nasılsın').command).toEqual({ intent: 'unknown' });
  });
  it('pieces', () => {
    expect(parseDims('3,5x4 m')).toEqual({ widthMm: 3500, projectionMm: 4000 });
    expect(parseDims('3500 x 4000')).toEqual({ widthMm: 3500, projectionMm: 4000 });
    expect(parseColorWords('RAL-9005 parlak')).toBe('RAL 9005 Parlak');
    expect(parseColorWords('beyaz olsun')).toBe('RAL 9016');
    expect(parseCustomer("Ayşe Hanım'a pergola")).toBe('Ayşe');
    expect(parseOrderRef('sipariş no 445 ne durumda')).toBe('445');
  });
});

describe('command: weeks', () => {
  it('"1 hafta ertele" is a 7-day delay', () => {
    const { parseCommand } = jest.requireActual('@/lib/ai/commands/parse');
    expect(parseCommand("ORD-31'i 1 hafta ertele").command).toEqual({ intent: 'what_if', scenario: 'delay', order: 'ORD-31', days: 7 });
  });
});
