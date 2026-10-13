import { annualLeave, employedRange, monthPay, monthlyBasisDays, payDate, shiftPeriod, tenure, tenureText, workingDays, type Attendance, type Employee, type Ledger } from '@/lib/features/personnel/payroll';

const emp = (p: Partial<Employee> = {}): Employee => ({ start_date: '2024-03-01', end_date: null, birth_date: '1990-05-10', pay_type: 'monthly', pay_amount: 30000, pay_day: 5, ...p });
const att = (day: string, kind: Attendance['kind'], deducted?: boolean): Attendance => ({ day, kind, deducted: deducted ?? ['absent', 'half_day', 'unpaid_leave'].includes(kind) });
const led = (kind: Ledger['kind'], amount: number, entry_date: string, period?: string): Ledger => ({ kind, amount, entry_date, period: period ?? null });

describe('ay hesabı (aylık maaş, 30 gün esası)', () => {
  it('tam ay: maaş aynen', () => {
    const r = monthPay(emp(), '2026-10', [], []);
    expect(r).toMatchObject({ basisDays: 30, dailyRate: 1000, base: 30000, earned: 30000, remaining: 30000 });
  });
  it('gelmediği gün, yarım gün ve ücretsiz izin kesilir; raporlu ve yıllık izin kesilmez', () => {
    const r = monthPay(emp(), '2026-10', [att('2026-10-06', 'absent'), att('2026-10-07', 'half_day'), att('2026-10-08', 'sick'), att('2026-10-09', 'annual_leave'), att('2026-10-12', 'unpaid_leave')], []);
    expect(r.days).toMatchObject({ absent: 1, half_day: 0.5, sick: 1, annual_leave: 1, unpaid_leave: 1 });
    expect(r).toMatchObject({ deductedDays: 2.5, absenceCut: 2500, earned: 27500 });
  });
  it('firma raporlu günü keserse kesilir', () => {
    expect(monthPay(emp(), '2026-10', [att('2026-10-08', 'sick', true)], []).absenceCut).toBe(1000);
  });
  it('avans, prim, kesinti ve ödemeler kalanı belirler; dönem alanı tarihten önce gelir', () => {
    const r = monthPay(emp(), '2026-10', [att('2026-10-06', 'absent')], [
      led('advance', 5000, '2026-10-15'),
      led('advance', 2000, '2026-09-28', '2026-10'), // ekim maaşından, eylülde verildi
      led('advance', 9999, '2026-10-30', '2026-11'), // kasım maaşından: bu aya girmez
      led('bonus', 1500, '2026-10-31'),
      led('deduction', 500, '2026-10-20'),
      led('salary', 10000, '2026-11-05', '2026-10'),
    ]);
    expect(r).toMatchObject({ advance: 7000, bonus: 1500, deduction: 500, paid: 10000, earned: 30000 - 1000 + 1500 - 500, remaining: 30000 - 1000 + 1500 - 500 - 7000 - 10000 });
  });
  it('ay ortasında işe giriş ve çıkış kıst hesaplanır', () => {
    expect(monthlyBasisDays(emp({ start_date: '2026-10-16' }), '2026-10')).toBe(15);
    expect(monthPay(emp({ start_date: '2026-10-16' }), '2026-10', [], []).base).toBe(15000);
    expect(monthlyBasisDays(emp({ end_date: '2026-10-10' }), '2026-10')).toBe(10);
    expect(monthlyBasisDays(emp({ start_date: '2026-02-01' }), '2026-02')).toBe(30); // şubat da 30 gün
    expect(monthlyBasisDays(emp({ start_date: '2026-11-01' }), '2026-10')).toBe(0);
    expect(employedRange(emp({ end_date: '2026-09-30' }), '2026-10')).toBeNull();
  });
  it('işten önceki devamsızlık kaydı sayılmaz', () => {
    expect(monthPay(emp({ start_date: '2026-10-16' }), '2026-10', [att('2026-10-06', 'absent')], []).deductedDays).toBe(0);
  });
  it('maaş girilmemişse tutarlar boş, avanslar yine görünür', () => {
    const r = monthPay(emp({ pay_amount: null }), '2026-10', [], [led('advance', 1000, '2026-10-02')]);
    expect(r).toMatchObject({ base: null, earned: null, remaining: null, advance: 1000 });
  });
});

describe('günlük ücret', () => {
  it('pazartesi–cumartesi çalışma günü üzerinden', () => {
    expect(workingDays(emp(), '2026-10')).toBe(27); // ekim 2026: 31 gün, 4 pazar
    const r = monthPay(emp({ pay_type: 'daily', pay_amount: 1200 }), '2026-10', [att('2026-10-06', 'absent')], []);
    expect(r).toMatchObject({ basisDays: 27, dailyRate: 1200, base: 32400, absenceCut: 1200, earned: 31200 });
  });
});

describe('kıdem ve yıllık izin (İş Kanunu md. 53)', () => {
  it('kıdem metni', () => {
    expect(tenureText(tenure('2024-03-01', '2026-10-13'))).toBe('2 yıl 7 ay');
    expect(tenureText(tenure('2026-10-01', '2026-10-13'))).toBe('12 gün');
    expect(tenure('2027-01-01', '2026-10-13')).toBeNull();
  });
  it('1 yıldan az: hak yok; 1–5 yıl 14; 5–15 yıl 20; 15+ 26', () => {
    expect(annualLeave(emp({ start_date: '2026-01-01' }), [], '2026-10-13')).toMatchObject({ entitled: 0, eligible: false });
    expect(annualLeave(emp({ start_date: '2024-03-01' }), [], '2026-10-13')).toMatchObject({ entitled: 14, yearStart: '2026-03-01', nextAnniversary: '2027-03-01' });
    expect(annualLeave(emp({ start_date: '2020-03-01' }), [], '2026-10-13')!.entitled).toBe(20);
    expect(annualLeave(emp({ start_date: '2010-03-01' }), [], '2026-10-13')!.entitled).toBe(26);
  });
  it('50 yaş ve üstü ile 18 yaş altı en az 20 gün', () => {
    expect(annualLeave(emp({ start_date: '2024-03-01', birth_date: '1970-01-01' }), [], '2026-10-13')!.entitled).toBe(20);
    expect(annualLeave(emp({ start_date: '2024-03-01', birth_date: '2009-01-01' }), [], '2026-10-13')!.entitled).toBe(20);
  });
  it('kullanılan izin yalnız bu izin yılından sayılır', () => {
    const r = annualLeave(emp(), [att('2026-02-10', 'annual_leave'), att('2026-04-01', 'annual_leave'), att('2026-04-02', 'annual_leave'), att('2026-04-03', 'sick')], '2026-10-13');
    expect(r).toMatchObject({ used: 2, remaining: 12 });
  });
  it('29 şubat girişte yıldönümü 28 şubat', () => {
    expect(annualLeave(emp({ start_date: '2024-02-29' }), [], '2026-10-13')!.yearStart).toBe('2026-02-28');
  });
});

describe('ödeme günü ve dönem', () => {
  it('ayın maaşı ertesi ayın ödeme gününde', () => {
    expect(payDate(emp({ pay_day: 5 }), '2026-10')).toBe('2026-11-05');
    expect(payDate(emp({ pay_day: 31 }), '2026-01')).toBe('2026-02-28');
    expect(payDate(emp({ pay_day: null }), '2026-10')).toBeNull();
  });
  it('dönem kaydırma yıl sınırını geçer', () => {
    expect(shiftPeriod('2026-12', 1)).toBe('2027-01');
    expect(shiftPeriod('2026-01', -1)).toBe('2025-12');
  });
});

import { formatIban, validIban } from '@/lib/features/personnel/iban';
describe('IBAN', () => {
  it('geçerli TR IBAN', () => {
    expect(validIban('TR33 0006 1005 1978 6457 8413 26')).toBe(true);
    expect(formatIban('tr330006100519786457841326')).toBe('TR33 0006 1005 1978 6457 8413 26');
  });
  it('kontrol hanesi ya da uzunluk yanlışsa geçersiz', () => {
    expect(validIban('TR34 0006 1005 1978 6457 8413 26')).toBe(false);
    expect(validIban('TR33 0006 1005 1978 6457 8413')).toBe(false);
    expect(validIban('DE89370400440532013000')).toBe(false);
  });
});
