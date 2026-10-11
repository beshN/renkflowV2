import { lateOrderMessage, paymentReminderMessage, quoteFollowUpMessage, toneFor } from '@/lib/ai/detectors/messages';

describe('message drafts', () => {
  it('tone: formal for a firm or a first-timer, warm for a returning person', () => {
    expect(toneFor({ isCompany: true, pastOrders: 9 })).toBe('formal');
    expect(toneFor({ isCompany: false, pastOrders: 0 })).toBe('formal');
    expect(toneFor({ isCompany: false, pastOrders: 2 })).toBe('warm');
  });
  it('late order: old and new date, reason, no gendered address', () => {
    const m = lateOrderMessage({ customer: 'Ayşe Demir', firm: 'Örnek Tente', orderNumber: 'ORD-1', oldDate: '2026-10-12', newDate: '2026-10-19', reason: 'malzeme tedariki', tone: 'formal' });
    expect(m).toContain('Sayın Ayşe Demir,');
    expect(m).toContain('12.10.2026');
    expect(m).toContain('19.10.2026');
    expect(m).toContain('malzeme tedariki');
    expect(m).not.toMatch(/Bey|Hanım/);
  });
  it('quote follow-up: first and second step differ; validity is mentioned', () => {
    const a = quoteFollowUpMessage({ customer: 'Ali', firm: null, quoteNumber: 'TKL-7', days: 3, validUntil: '2026-10-20', step: 1, tone: 'warm' });
    const b = quoteFollowUpMessage({ customer: 'Ali', firm: null, quoteNumber: 'TKL-7', days: 7, validUntil: null, step: 2, tone: 'warm' });
    expect(a).toMatch(/^Merhaba Ali,/);
    expect(a).toContain('20.10.2026');
    expect(a).not.toEqual(b);
  });
  it('payment reminder: gentle first, payment plan offer when long overdue', () => {
    const soft = paymentReminderMessage({ customer: 'Demir Yapı', firm: 'X', invoiceNumber: 'FTR-000001', dueOn: '2026-10-01', openAmount: 4000, daysOverdue: 8, tone: 'formal' });
    const late = paymentReminderMessage({ customer: 'Demir Yapı', firm: 'X', invoiceNumber: 'FTR-000001', dueOn: '2026-08-01', openAmount: 4000, daysOverdue: 69, tone: 'formal' });
    expect(soft).toContain('4.000,00 TL');
    expect(soft).toContain('dikkate almayınız');
    expect(late).toContain('Ödeme planı');
    expect(late).toContain('69 gündür');
  });
});
