'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { StatusBadge } from '@/components/shared/ui/StatusStepper';
import { SEARCH_MIN_LENGTH, type SearchHit, type WorkspaceSearchResult } from '@/lib/features/search/types';
import { foldText } from '@/lib/shared/text/fold';

const QUOTATION_STATUS: Record<string, string> = {
  draft: 'Taslak', sent: 'Gönderildi', accepted: 'Kabul Edildi', rejected: 'Reddedildi', expired: 'Süresi Doldu', converted: 'Siparişe Dönüştü',
};

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'done'; result: WorkspaceSearchResult };

/** Searches orders, customers, quotations and stock on the server, within what the role may open. */
export function WorkspaceSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const firstRun = useRef(true);
  const routerRef = useRef(router);
  routerRef.current = router;

  // The URL's ?q= also changes when the command palette navigates here (even back to an earlier value
  // after our own replaceState); the box follows it unless it already holds that text.
  const urlQuery = useSearchParams()?.get('q') ?? initialQuery;
  useEffect(() => { setQuery((current) => (current.trim() === urlQuery.trim() ? current : urlQuery)); }, [urlQuery]);
  const text = foldText(query).length >= SEARCH_MIN_LENGTH ? query.trim() : '';

  useEffect(() => {
    if (!text) { setState({ kind: 'idle' }); return; }
    const controller = new AbortController();
    setState({ kind: 'loading' });
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/v1/search/all?q=' + encodeURIComponent(text), { signal: controller.signal, cache: 'no-store' });
        if (response.status === 401) {
          setState({ kind: 'error' });
          routerRef.current.push('/auth/login?callbackUrl=' + encodeURIComponent('/search?q=' + text));
          return;
        }
        const body = response.ok ? await response.json() : null;
        if (controller.signal.aborted) return;
        setState(body && typeof body === 'object' && 'query' in body ? { kind: 'done', result: body as WorkspaceSearchResult } : { kind: 'error' });
      } catch {
        if (!controller.signal.aborted) setState({ kind: 'error' });
      }
    }, firstRun.current ? 0 : 250);
    firstRun.current = false;
    return () => { controller.abort(); clearTimeout(timer); };
  }, [text, attempt]);

  const onChange = useCallback((value: string) => {
    setQuery(value);
    window.history.replaceState(null, '', value.trim() ? '/search?q=' + encodeURIComponent(value.trim()) : '/search');
  }, []);

  const result = state.kind === 'done' ? state.result : null;
  const total = result ? [result.orders, result.customers, result.quotations, result.stock].reduce((sum, list) => sum + (list?.length ?? 0), 0) : 0;

  return <div className="min-h-screen">
    <AppleNavbar title="Arama" showSearch={false} />
    <main className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      <input type="search" aria-label="Ara" autoFocus placeholder="Sipariş no, müşteri, teklif no, malzeme adı veya SKU…" value={query} onChange={(event) => onChange(event.target.value)} className="rf-input w-full p-3 text-sm" />
      {state.kind === 'error'
        ? <div role="alert" className="rf-alert flex items-center justify-between gap-3 text-sm"><span>Arama yapılamadı. Bağlantınızı kontrol edip tekrar deneyin.</span><button type="button" className="rf-secondary-button" onClick={() => setAttempt((n) => n + 1)}>Tekrar dene</button></div>
        : <p role="status" className="text-sm text-muted-foreground">
            {state.kind === 'idle' ? `Aramak için en az ${SEARCH_MIN_LENGTH} karakter yazın.` : state.kind === 'loading' ? 'Aranıyor…' : total === 0 ? `“${result!.query}” için sonuç yok.` : `${total} sonuç`}
          </p>}
      {result && <>
        <Section title="Siparişler" hits={result.orders} note={result.ordersLimitedToAssigned ? 'Yalnız size atanmış iş emirlerine bağlı siparişlerde, sipariş no ve ürün adına göre aranır.' : undefined}
          render={(hit) => <><HitText hit={hit} /><StatusBadge status={hit.status || ''} /></>} />
        <Section title="Müşteriler" hits={result.customers} render={(hit) => <HitText hit={hit} />} />
        <Section title="Teklifler" hits={result.quotations} render={(hit) => <><HitText hit={hit} /><span className="text-xs text-muted-foreground">{QUOTATION_STATUS[hit.status || ''] || hit.status}</span></>} />
        <Section title="Stok" hits={result.stock} render={(hit) => <HitText hit={hit} />} />
      </>}
    </main>
  </div>;
}

function Section({ title, hits, note, render }: { title: string; hits: SearchHit[] | null; note?: string; render: (hit: SearchHit) => React.ReactNode }) {
  if (hits === null) return null;
  return <section aria-label={title} className="space-y-2">
    <h2 className="text-sm font-semibold">{title} <span className="font-normal text-muted-foreground">· {hits.length}</span></h2>
    {note && <p className="text-xs text-muted-foreground">{note}</p>}
    {hits.length === 0
      ? <p className="text-xs text-muted-foreground">Bu bölümde sonuç yok.</p>
      : hits.map((hit) => <Link key={hit.id} href={hit.href} className="rf-panel flex items-center justify-between gap-3 p-4">{render(hit)}</Link>)}
  </section>;
}

function HitText({ hit }: { hit: SearchHit }) {
  return <div className="min-w-0">
    <p className="truncate font-medium">{hit.title}</p>
    {hit.subtitle && <p className="truncate text-sm text-muted-foreground">{hit.subtitle}</p>}
    {hit.meta && <p className="truncate text-xs text-muted-foreground">{hit.meta}</p>}
  </div>;
}
