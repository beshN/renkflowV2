import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LegalBlock, LegalDocument as LegalDocumentData } from '@/lib/core/legal-content';
import { TocNav } from '@/components/site/v2/blocks';

const DATE = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** E-mail addresses become mailto links and site paths (/status, /privacy …) internal links. */
const LINKABLE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\/(?:status|privacy|terms|cookies|docs|contact)\b)/g;

function linkify(text: string): ReactNode[] {
  return text.split(LINKABLE).map((part, index) => {
    if (index % 2 === 0) return part;
    const className = 'font-medium text-[var(--x-ink)] underline decoration-[var(--x-line-strong)] underline-offset-4 transition-colors hover:decoration-[var(--x-ink)]';
    return part.startsWith('/')
      ? <Link key={index} href={part} className={className}>{part}</Link>
      : <a key={index} href={`mailto:${part}`} className={className}>{part}</a>;
  });
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === 'string') return <p className="mt-3">{linkify(block)}</p>;
  if ('list' in block) {
    return (
      <ul className="mt-3 space-y-2">
        {block.list.map((item) => <li key={item} className="relative pl-4 before:absolute before:left-0 before:top-[0.85em] before:h-px before:w-2 before:bg-[var(--x-line-strong)]">{linkify(item)}</li>)}
      </ul>
    );
  }
  const { caption, head, rows } = block.table;
  return (
    <div className="mt-4 overflow-x-auto rounded-[var(--x-r-panel)] bg-[var(--x-surface)] shadow-[var(--x-shadow-raise)]">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-[var(--x-surface-sunk)] text-[var(--x-muted)]">
          <tr>{head.map((cell) => <th key={cell} scope="col" className="px-3.5 py-2.5 font-medium">{cell}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join('|')} className="border-t border-[var(--x-line)] align-top">
              {row.map((cell, index) => (
                <td key={index} className={index === 0 ? 'x-mono px-3.5 py-2.5 text-[12.5px] text-[var(--x-ink)] [overflow-wrap:anywhere]' : 'px-3.5 py-2.5 leading-6 text-[var(--x-ink-2)]'}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A legal text with its version, last-updated date and a table of contents that follows the reading. */
export function LegalDocument({ document, children }: { document: LegalDocumentData; children?: ReactNode }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
      <TocNav items={document.sections} articleId="legal-article" />
      <article id="legal-article" className="x-prose max-w-[68ch]">
        <p className="!text-[13px] !text-[var(--x-muted)]">
          Sürüm {document.version} · Son güncelleme: <time dateTime={document.updatedAt}>{DATE.format(new Date(`${document.updatedAt}T00:00:00Z`))}</time>
        </p>
        <h2 className="x-display mt-3 text-[28px] leading-tight">{document.title}</h2>
        {document.intro.map((line) => <p key={line} className="mt-4">{linkify(line)}</p>)}
        {document.sections.map((section) => (
          <section key={section.id} id={section.id} className="mt-12 scroll-mt-24">
            <h3 className="text-[18px] font-semibold tracking-[-0.015em]"><a href={`#${section.id}`} className="x-link">{section.title}</a></h3>
            {section.blocks.map((block, index) => <Block key={index} block={block} />)}
          </section>
        ))}
        {children}
      </article>
    </div>
  );
}
