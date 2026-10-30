import { isQuoteDraftRequest, parseColorWords, parseCommand, parseCustomer, parseDims, parseOrderRef } from '@/lib/ai/commands/parse';

it('routes quotation creation to review while keeping quotation analysis in the model conversation', () => {
  expect(isQuoteDraftRequest('Açık teklifleri durum ve geçerliliklerine göre özetle')).toBe(false);
  expect(isQuoteDraftRequest('Teklifleri karşılaştır')).toBe(false);
  expect(isQuoteDraftRequest("Ahmet Yılmaz'a pergola teklif")).toBe(true);
  expect(isQuoteDraftRequest("Romanya'ya 10x5 tente teklif 300.000tl yüzde 5 iskonto 0 kdv")).toBe(true);
  expect(isQuoteDraftRequest('Bir müşteri için teklif hazırlamak istiyorum')).toBe(true);
});

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
    expect(parseCommand('7016 mat kaç profil var').command).toEqual({ intent: 'stock_query', color: 'RAL 7016 Mat', item: null });
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

describe('measures without a unit', () => {
  it('one unit for the pair, from the larger number', () => {
    const { parseDims } = jest.requireActual('@/lib/ai/commands/parse');
    expect(parseDims('3000x4000')).toEqual({ widthMm: 3000, projectionMm: 4000 });
    expect(parseDims('2500x3000')).toEqual({ widthMm: 2500, projectionMm: 3000 });
    expect(parseDims('1200x2500')).toEqual({ widthMm: 1200, projectionMm: 2500 });
    expect(parseDims('450x350')).toEqual({ widthMm: 4500, projectionMm: 3500 });
    expect(parseDims('3x4')).toEqual({ widthMm: 3000, projectionMm: 4000 });
    expect(parseDims('2,5x2')).toEqual({ widthMm: 2500, projectionMm: 2000 });
  });

  describe('read-only questions', () => {
    it('order status', () => {
      expect(parseCommand('RF-1042 nerede').command).toEqual({ intent: 'order_status', order: 'RF-1042' });
      expect(parseCommand('RF 1042 ne durumda').command).toEqual({ intent: 'order_status', order: 'RF-1042' });
      expect(parseCommand('ORD-12 ne zaman teslim').command).toEqual({ intent: 'order_status', order: 'ORD-12' });
    });
    it('a change to an order is still a what-if, not a status question', () => {
      expect(parseCommand("ORD-12'yi öne al").command).toMatchObject({ intent: 'what_if', scenario: 'expedite' });
      expect(parseCommand("ORD-12'ye 2 gün ekle").command).toMatchObject({ intent: 'what_if', scenario: 'delay' });
    });
    it("a customer's orders", () => {
      expect(parseCommand("Kaya İnşaat'ın siparişleri").command).toEqual({ intent: 'customer_orders', customer: 'Kaya İnşaat' });
      expect(parseCommand('Ahmet Yılmaz siparişleri neler').command).toEqual({ intent: 'customer_orders', customer: 'Ahmet Yılmaz' });
      expect(parseCommand("Ayşe Hanım'ın siparişlerini listele").command).toEqual({ intent: 'customer_orders', customer: 'Ayşe' });
      expect(parseCommand('demir yapının işleri').command).toEqual({ intent: 'customer_orders', customer: 'Demir Yapı' });
    });
    it('a name ending in -in keeps its n, and generic words are not customers', () => {
      expect(parseCommand('Berkin siparişleri').command).toEqual({ intent: 'customer_orders', customer: 'Berkin' });
      for (const t of ['bugünkü siparişler', 'tüm siparişler', 'açık siparişleri göster']) expect(parseCommand(t).command.intent).not.toBe('customer_orders');
    });
    it('deliveries by day', () => {
      expect(parseCommand('bugün teslimatlar').command).toEqual({ intent: 'deliveries', period: 'today' });
      expect(parseCommand('yarın teslimatlar').command).toEqual({ intent: 'deliveries', period: 'tomorrow' });
      expect(parseCommand('bu hafta sevkiyat').command).toEqual({ intent: 'deliveries', period: 'this_week' });
    });
    it('late work stays a late list, not a delivery list', () => {
      expect(parseCommand('bu hafta geciken işler').command.intent).toBe('list_late');
    });
    it('low stock is not a bar-count question', () => {
      expect(parseCommand('kritik stok').command).toEqual({ intent: 'low_stock' });
      expect(parseCommand('stok azalan malzemeler').command).toEqual({ intent: 'low_stock' });
      expect(parseCommand('7016 mat kaç profil var').command.intent).toBe('stock_query');
    });
    it('overdue invoices and open purchases', () => {
      expect(parseCommand('vadesi geçen faturalar').command).toEqual({ intent: 'overdue_invoices' });
      expect(parseCommand('kim ödemedi').command).toEqual({ intent: 'overdue_invoices' });
      expect(parseCommand('yoldaki malzemeler').command).toEqual({ intent: 'open_purchases' });
      expect(parseCommand('bekleyen satın almalar').command).toEqual({ intent: 'open_purchases' });
    });
    it('a quote request that mentions purchasing words stays a quote', () => {
      expect(parseCommand("Ahmet Bey'e 3x4 pergola teklif hazırla antrasit").command.intent).toBe('quote_draft');
    });
  });
});
