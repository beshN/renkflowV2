import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';
import { changelog, type ChangeKind } from '@/lib/core/changelog';

export const metadata = marketingMetadata('changelog');

const DATE = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const KIND_STYLE: Record<ChangeKind, string> = {
  Yeni: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  İyileştirme: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  Düzeltme: 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
};

export default function Page() {
  return (
    <MarketingStandardPage pageKey="changelog" hideHighlights>
      <ol className="max-w-3xl space-y-14">
        {changelog.map((entry) => (
          <li key={entry.version} id={`v${entry.version}`} className="scroll-mt-24 border-l border-border pl-6">
            <p className="font-mono text-[12px] text-muted-foreground">
              <a href={`#v${entry.version}`} className="hover:text-foreground">{entry.version}</a> · <time dateTime={entry.date}>{DATE.format(new Date(`${entry.date}T00:00:00Z`))}</time>
            </p>
            <h2 className="mt-2 text-[21px] font-semibold tracking-[-0.03em]">{entry.title}</h2>
            {entry.summary && <p className="mt-2 text-[15px] leading-7 text-muted-foreground">{entry.summary}</p>}
            {entry.changes.map((group) => (
              <section key={group.kind} className="mt-5">
                <h3><span className={`rounded px-2 py-0.5 text-[12px] font-medium ${KIND_STYLE[group.kind]}`}>{group.kind}</span></h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-muted-foreground/60">
                  {group.items.map((item) => <li key={item} className="text-[14.5px] leading-7 text-muted-foreground">{item}</li>)}
                </ul>
              </section>
            ))}
          </li>
        ))}
      </ol>
    </MarketingStandardPage>
  );
}
