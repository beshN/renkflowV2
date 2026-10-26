import Link from 'next/link';
import { connection } from 'next/server';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';
import { COMPANY, telHref } from '@/lib/core/company';

export const metadata = marketingMetadata('status');

type Check = { id: string; label: string; detail: string; source: string; ok: boolean; note: string };

const TIMEOUT_MS = 4000;
const TIME = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'medium', timeZone: 'Europe/Istanbul' });

function withTimeout<T>(work: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([work, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), TIMEOUT_MS))]);
}

/**
 * The same checks /api/health and /api/health/ready run, split per component. Every failure is
 * caught: the page always renders, and it never shows error messages or configuration names.
 */
async function runChecks(): Promise<Check[]> {
  const config = await (async () => {
    try {
      const { inspectDeploymentEnvironment } = await import('@/lib/config/deployment-env');
      return inspectDeploymentEnvironment(process.env).errors.length === 0;
    } catch {
      return false;
    }
  })();

  const started = Date.now();
  const database = await withTimeout((async () => {
    try {
      const { checkDatabaseHealth } = await import('@/lib/db');
      return await checkDatabaseHealth();
    } catch {
      return false;
    }
  })(), false);
  const latency = Date.now() - started;

  return [
    { id: 'web', label: 'Web uygulaması', detail: 'Site ve panel sayfaları', source: '/api/health', ok: true, note: 'Yanıt veriyor' },
    { id: 'config', label: 'Sunucu yapılandırması', detail: 'Oturum ve bağlantı ayarları', source: '/api/health/ready', ok: config, note: config ? 'Hazır' : 'Eksik veya hatalı ayar' },
    { id: 'database', label: 'Veritabanı', detail: 'Kayıtların okunması ve yazılması', source: '/api/health/ready', ok: database, note: database ? `Yanıt veriyor · ${latency} ms` : 'Yanıt vermiyor' },
  ];
}

export default async function Page() {
  await connection();
  const checks = await runChecks();
  const allOk = checks.every((check) => check.ok);
  const checkedAt = new Date();

  return (
    <MarketingStandardPage pageKey="status" hideHighlights>
      <div className="max-w-3xl">
        <div role="status" className={`flex items-start gap-4 rounded-xl border p-6 ${allOk ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
          {allOk
            ? <CheckCircle2 aria-hidden size={28} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            : <XCircle aria-hidden size={28} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />}
          <div>
            <h2 className="text-[21px] font-semibold tracking-[-0.03em]">{allOk ? 'Tüm sistemler çalışıyor' : 'Sorun var'}</h2>
            <p className="mt-1.5 text-[14.5px] leading-7 text-muted-foreground">
              {allOk
                ? 'Uygulama, sunucu yapılandırması ve veritabanı normal yanıt veriyor.'
                : <>Bazı bileşenler şu anda yanıt vermiyor; bu sürede bazı işlemler tamamlanamayabilir. Acil durumlar için {COMPANY.phone ? <a href={telHref(COMPANY.phone)} className="font-medium text-foreground underline underline-offset-4">{COMPANY.phone}</a> : null}{COMPANY.phone ? ' veya ' : ''}<a href={`mailto:${COMPANY.email}`} className="font-medium text-foreground underline underline-offset-4">{COMPANY.email}</a> adresinden bize ulaşın.</>}
            </p>
          </div>
        </div>

        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {checks.map((check) => (
            <li key={check.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-[15px] font-medium">{check.label}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{check.detail} · <span className="font-mono text-[12px]">{check.source}</span></p>
              </div>
              <p className={`inline-flex items-center gap-1.5 text-[13.5px] font-medium ${check.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                {check.ok ? <CheckCircle2 aria-hidden size={16} /> : <XCircle aria-hidden size={16} />}
                <span>{check.ok ? 'Çalışıyor' : 'Sorun var'}</span>
                <span className="font-normal text-muted-foreground">· {check.note}</span>
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted-foreground">
          <p>Kontrol zamanı: <time dateTime={checkedAt.toISOString()}>{TIME.format(checkedAt)}</time> (İstanbul)</p>
          <Link href="/status" prefetch={false} className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"><RefreshCw aria-hidden size={14} /> Yeniden kontrol et</Link>
        </div>

        <p className="mt-10 text-[14px] leading-7 text-muted-foreground">
          Bu sayfa her açılışta denetimleri yeniden çalıştırır; sonuçlar önbelleğe alınmaz. Planlı bakımlar mümkün olduğunca mesai saatleri dışında yapılır ve önceden duyurulur. İzleme araçları için aynı denetimler <span className="font-mono text-[12.5px]">/api/health</span> ve <span className="font-mono text-[12.5px]">/api/health/ready</span> adreslerinden JSON olarak alınabilir.
        </p>
      </div>
    </MarketingStandardPage>
  );
}
