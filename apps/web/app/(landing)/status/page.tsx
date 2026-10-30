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
        <div role="status" className="flex items-start gap-4 rounded-[var(--x-r-window)] bg-[var(--x-surface)] p-6 shadow-[var(--x-shadow-window)]">
          {allOk
            ? <span aria-hidden className="relative mt-1.5 flex h-3 w-3 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--x-ok)] opacity-40 motion-reduce:hidden" /><span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--x-ok)]" /></span>
            : <XCircle aria-hidden size={24} className="mt-0.5 shrink-0 text-[var(--x-danger)]" />}
          <div>
            <h2 className="x-display text-[24px] leading-tight">{allOk ? 'Tüm sistemler çalışıyor' : 'Sorun var'}</h2>
            <p className="mt-1.5 text-[14.5px] leading-7 text-[var(--x-muted)]">
              {allOk
                ? 'Uygulama, sunucu yapılandırması ve veritabanı normal yanıt veriyor.'
                : <>Bazı bileşenler şu anda yanıt vermiyor; bu sürede bazı işlemler tamamlanamayabilir. Acil durumlar için {COMPANY.phone ? <a href={telHref(COMPANY.phone)} className="x-link font-medium text-[var(--x-ink)]">{COMPANY.phone}</a> : null}{COMPANY.phone ? ' veya ' : ''}<a href={`mailto:${COMPANY.email}`} className="x-link font-medium text-[var(--x-ink)]">{COMPANY.email}</a> adresinden bize ulaşın.</>}
            </p>
          </div>
        </div>

        <ul className="mt-6 divide-y divide-[var(--x-line)] overflow-hidden rounded-[var(--x-r-panel)] bg-[var(--x-surface)] shadow-[var(--x-shadow-raise)]">
          {checks.map((check) => (
            <li key={check.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-[15px] font-medium">{check.label}</p>
                <p className="mt-0.5 text-[13px] text-[var(--x-muted)]">{check.detail} · <span className="x-mono text-[12px]">{check.source}</span></p>
              </div>
              <p className={`inline-flex items-center gap-1.5 text-[13.5px] font-medium ${check.ok ? 'text-[var(--x-ok)]' : 'text-[var(--x-danger)]'}`}>
                {check.ok ? <CheckCircle2 aria-hidden size={16} /> : <XCircle aria-hidden size={16} />}
                <span>{check.ok ? 'Çalışıyor' : 'Sorun var'}</span>
                <span className="font-normal text-[var(--x-muted)]">· {check.note}</span>
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--x-muted)]">
          <p>Kontrol zamanı: <time dateTime={checkedAt.toISOString()}>{TIME.format(checkedAt)}</time> (İstanbul)</p>
          <Link href="/status" prefetch={false} className="x-btn x-btn-quiet !h-8 !text-[13px]"><RefreshCw aria-hidden size={14} /> Yeniden kontrol et</Link>
        </div>

        <p className="mt-10 text-[14px] leading-7 text-[var(--x-muted)]">
          Bu sayfa her açılışta denetimleri yeniden çalıştırır; sonuçlar önbelleğe alınmaz. Planlı bakımlar mümkün olduğunca mesai saatleri dışında yapılır ve önceden duyurulur. İzleme araçları için aynı denetimler <span className="x-mono text-[12.5px]">/api/health</span> ve <span className="x-mono text-[12.5px]">/api/health/ready</span> adreslerinden JSON olarak alınabilir.
        </p>
      </div>
    </MarketingStandardPage>
  );
}
