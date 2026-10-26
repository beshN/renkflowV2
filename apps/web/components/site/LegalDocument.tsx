import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LegalBlock, LegalDocument as LegalDocumentData } from '@/lib/core/legal-content';

const DATE = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** E-mail addresses become mailto links and site paths (/status, /privacy …) internal links. */
const LINKABLE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\/(?:status|privacy|terms|cookies|docs|contact)\b)/g;

function linkify(text: string): ReactNode[] {
  return text.split(LINKABLE).map((part, index) => {
    if (index % 2 === 0) return part;
    const className = 'font-medium text-foreground underline underline-offset-4';
    return part.startsWith('/')
      ? <Link key={index} href={part} className={className}>{part}</Link>
      : <a key={index} href={`mailto:${part}`} className={className}>{part}</a>;
  });
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === 'string') return <p className="mt-3 text-[14.5px] leading-7 text-muted-foreground">{linkify(block)}</p>;
  if ('list' in block) {
    return (
      <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-muted-foreground/60">
        {block.list.map((item) => <li key={item} className="text-[14.5px] leading-7 text-muted-foreground">{linkify(item)}</li>)}
      </ul>
    );
  }
  const { caption, head, rows } = block.table;
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/60">
          <tr>{head.map((cell) => <th key={cell} scope="col" className="px-3.5 py-2.5 font-medium">{cell}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join('|')} className="border-t border-border align-top">
              {row.map((cell, index) => (
                <td key={index} className={index === 0 ? 'px-3.5 py-2.5 font-mono text-[12.5px] text-foreground [overflow-wrap:anywhere]' : 'px-3.5 py-2.5 leading-6 text-muted-foreground'}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A legal text with its version, last-updated date and a table of contents with anchors. */
export function LegalDocument({ document, children }: { document: LegalDocumentData; children?: ReactNode }) {
  return (
    <div className="grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="İçindekiler" className="lg:sticky lg:top-24 lg:self-start">
        <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">İçindekiler</p>
        <ol className="mt-3 space-y-1.5">
          {document.sections.map((section) => (
            <li key={section.id}><a href={`#${section.id}`} className="text-[13px] leading-5 text-muted-foreground hover:text-foreground">{section.title}</a></li>
          ))}
        </ol>
      </nav>
      <article className="max-w-3xl">
        <p className="text-[13px] text-muted-foreground">
          Sürüm {document.version} · Son güncelleme: <time dateTime={document.updatedAt}>{DATE.format(new Date(`${document.updatedAt}T00:00:00Z`))}</time>
        </p>
        <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.03em]">{document.title}</h2>
        {document.intro.map((line) => <p key={line} className="mt-4 text-[15px] leading-7 text-muted-foreground">{linkify(line)}</p>)}
        {document.sections.map((section) => (
          <section key={section.id} id={section.id} className="mt-10 scroll-mt-24">
            <h3 className="text-[17px] font-semibold tracking-[-0.02em]">{section.title}</h3>
            {section.blocks.map((block, index) => <Block key={index} block={block} />)}
          </section>
        ))}
        {children}
      </article>
    </div>
  );
}
