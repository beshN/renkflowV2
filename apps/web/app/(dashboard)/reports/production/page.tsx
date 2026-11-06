import Link from 'next/link';
import { getServerUserContext, requirePermission } from '@/lib/features/auth/serverAuth';
import { productionHistory } from '@/lib/features/manufacturing/production-history.server';
import { historyRange } from '@/lib/features/manufacturing/production-history';
import { AppleCard } from '@/components/shared/ui/AppleCard';

export const dynamic = 'force-dynamic';
const fmt = (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
export default async function ProductionHistoryPage({ searchParams }: { searchParams: Promise<{ start?: string; end?: string }> }) {
  const context = await getServerUserContext();
  requirePermission(context, 'reports.view');
  const query = await searchParams;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const start = query.start ?? today.slice(0, 7) + '-01', end = query.end ?? today;
  let invalid = false;
  try { historyRange(start, end); } catch { invalid = true; }
  const data = invalid ? null : await productionHistory(context, start, end);
  return <main className="mx-auto max-w-[1440px] space-y-5 p-4 md:p-6">
    <Link href="/reports" className="text-sm underline">Raporlara dön</Link>
    <h1 className="text-xl font-semibold">Üretim analitiği · kayıtlı geçmiş</h1>
    <p className="text-sm text-muted-foreground">Salt okunur. Tarih aralığı tamamlanma tarihine göre, Türkiye saatiyle ve iki gün de dahil uygulanır. Tahmini çizelge ve üretim miktarı toplamı içermez.</p>
    <form className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Başlangıç<input className="mt-1 block rounded border bg-background p-2" type="date" name="start" defaultValue={start} required /></label>
      <label className="text-sm">Bitiş<input className="mt-1 block rounded border bg-background p-2" type="date" name="end" defaultValue={end} required /></label>
      <button className="rounded border px-3 py-2 text-sm" type="submit">Göster</button>
    </form>
    {invalid && <p role="alert">Geçerli başlangıç ve bitiş tarihi seçin.</p>}
    {data && <>
      <AppleCard><h2 className="font-semibold">İş merkezi başına tamamlanan operasyonlar</h2>
        <p className="mt-2 text-sm text-muted-foreground">n: tamamlanan operasyon; süre n: başlangıcı ve pozitif active_seconds kaydı olan operasyon. Medyan için en az 2 örnek gerekir. Süreler saniyedir; tahmin kullanılmaz. Eski varsayılan sıfırlardan ayırt edilemeyen 0 saniyelik kayıtlar süre örneğine alınmaz.</p>
        {!data.centers.length ? <p className="mt-3">Veri yok (n=0)</p> : <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th scope="col">İş merkezi</th><th scope="col">Tamamlanan (n)</th><th scope="col">Medyan aktif süre</th></tr></thead><tbody>{data.centers.map(c => <tr key={c.code} className="border-t"><th scope="row" className="py-3">{c.name} · {c.code}</th><td>{c.completed} (n={c.completed})</td><td>{c.active.median === null ? (c.active.n ? 'Yetersiz örnek' : 'Veri yok') : fmt(c.active.median) + ' sn'} (n={c.active.n})</td></tr>)}</tbody></table></div>}
      </AppleCard>
      <AppleCard><h2 className="font-semibold">İş emri termin uyumu</h2>
        <p className="mt-2 text-sm text-muted-foreground">Üretim iş emrinin kayıtlı due_at ve completed_at değerleri Türkiye takvim gününe göre karşılaştırılır; termin gününün tamamı zamanında sayılır. Sipariş termini varsayılmaz. Termini olmayan {data.completedJobs - data.deadlines.n} kayıt kapsam dışıdır.</p>
        <p className="mt-3">{data.deadlines.n ? `Zamanında: ${data.deadlines.onTime} · Gecikmiş: ${data.deadlines.late}` : 'Veri yok'} (n={data.deadlines.n})</p>
      </AppleCard>
      <AppleCard><h2 className="font-semibold">Kesim planı firesi · profil</h2>
        <p className="mt-3">Doğrulanmış ölçüm: veri yok (n={data.measuredLossSamples})</p>
        <p className="mt-2 text-sm text-muted-foreground">Mevcut kayıtlar ölçülen artık ile plan varsayımını ayırmıyor. Aşağıdaki kayıtlı hesaplanan fire gerçek ölçüm KPI’ı değildir. Yalnız tamamlanmış planlar; n kesim kaybı kaydıdır. Yerel mm birimi korunur; kg katsayıları ve maliyetler dahil edilmez.</p>
        {!data.calculatedLosses.length ? <p className="mt-3">Kayıtlı hesaplanan fire: veri yok (n=0)</p> : data.calculatedLosses.map(g => <p className="mt-3" key={g.unit}>Kayıtlı hesaplanan fire: {fmt(g.total)} {g.unit} (n={g.n}) · ölçüm doğrulanamıyor</p>)}
      </AppleCard>
    </>}
  </main>;
}
