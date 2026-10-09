'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ScrollText, ShieldAlert } from 'lucide-react';
import { EmptyState, PageHeader, Skeleton, StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { auditActionLabel, auditEntityLabel } from '@/lib/audit/labels';

type Row = { id: string; entity_type: string; entity_id: string; action: string; actor_id: string | null; actor_name: string | null; changes: unknown; note: string | null; metadata: any; created_at: string };
type Facets = { entityTypes: string[]; actions: string[]; actors: Array<{ id: string; name: string }> };
const PAGE = 50;
const when = (iso: string) => new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(iso));

/** Short text for what changed: changed field names, or the refused path for a denied attempt. */
function detail(r: Row) {
  if (r.action === 'access_denied' && r.metadata) return `${r.metadata.method ?? ''} ${r.metadata.path ?? ''}`.trim();
  if (r.changes && typeof r.changes === 'object') return Object.keys(r.changes as object).join(', ');
  if (r.note) return r.note;
  if (r.metadata && typeof r.metadata === 'object') return Object.entries(r.metadata).filter(([, v]) => typeof v !== 'object').map(([k, v]) => `${k}: ${v}`).join(' · ').slice(0, 160);
  return '';
}

/** Who did what, when, to which record: filters, pages, CSV export. */
export function AuditViewer() {
  const [facets, setFacets] = useState<Facets | null>(null);
  const [filters, setFilters] = useState({ entityType: '', action: '', userId: '', startDate: '', endDate: '', entityId: '' });
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ items: Row[]; total: number } | null>(null);
  const [error, setError] = useState('');
  const query = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    return p;
  }, [filters]);

  useEffect(() => {
    void requestJson<Facets>('/api/audit?facets=1', { cache: 'no-store' }).then((r) => (r.ok && r.data ? setFacets(r.data) : setError(r.error || 'Denetim izi alınamadı')));
  }, []);
  const load = useCallback(async () => {
    const p = new URLSearchParams(query);
    p.set('limit', String(PAGE));
    p.set('offset', String(offset));
    const r = await requestJson<{ items: Row[]; total: number }>(`/api/audit?${p}`, { cache: 'no-store' });
    if (r.ok && r.data) { setData(r.data); setError(''); } else setError(r.error || 'Denetim izi alınamadı');
  }, [query, offset]);
  useEffect(() => { void load(); }, [load]);

  const set = (k: keyof typeof filters, v: string) => { setOffset(0); setFilters((f) => ({ ...f, [k]: v })); };
  const denied = data?.items.filter((r) => r.action === 'access_denied').length ?? 0;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Güvenlik" title="Denetim izi" hint="Kritik her değişiklik ve her yetkisiz deneme burada: kim, ne, ne zaman, hangi kayıt. Kayıtlar değiştirilemez."
        kpis={data ? [{ label: 'kayıt (filtreye göre)', value: data.total, icon: ScrollText }, { label: 'bu sayfada yetkisiz deneme', value: denied, icon: ShieldAlert, tone: denied ? 'warning' : 'neutral' }] : []}
        action={<a className="rf-secondary-button inline-flex items-center gap-1 text-sm" href={`/api/audit/export?${query}`}><Download size={14} aria-hidden /> CSV</a>} />
      <form className="rf-panel grid gap-2 p-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Filtreler" onSubmit={(e) => e.preventDefault()}>
        <label className="text-xs">Kim
          <select className="rf-input mt-1 w-full" value={filters.userId} onChange={(e) => set('userId', e.target.value)}>
            <option value="">Herkes</option>
            {facets?.actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="text-xs">Ne
          <select className="rf-input mt-1 w-full" value={filters.action} onChange={(e) => set('action', e.target.value)}>
            <option value="">Tümü</option>
            {facets?.actions.map((a) => <option key={a} value={a}>{auditActionLabel(a)}</option>)}
          </select>
        </label>
        <label className="text-xs">Kayıt türü
          <select className="rf-input mt-1 w-full" value={filters.entityType} onChange={(e) => set('entityType', e.target.value)}>
            <option value="">Tümü</option>
            {facets?.entityTypes.map((t) => <option key={t} value={t}>{auditEntityLabel(t)}</option>)}
          </select>
        </label>
        <label className="text-xs">Kayıt no (UUID)
          <input className="rf-input mt-1 w-full" value={filters.entityId} onChange={(e) => set('entityId', /^[0-9a-f-]{36}$/i.test(e.target.value) || !e.target.value ? e.target.value : filters.entityId)} placeholder="isteğe bağlı" />
        </label>
        <label className="text-xs">Başlangıç
          <input type="date" className="rf-input mt-1 w-full" value={filters.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </label>
        <label className="text-xs">Bitiş
          <input type="date" className="rf-input mt-1 w-full" value={filters.endDate} onChange={(e) => set('endDate', e.target.value)} />
        </label>
      </form>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {!data ? <Skeleton className="h-64" /> : data.items.length === 0 ? <EmptyState title="Bu filtreye uyan kayıt yok" icon={ScrollText} /> : (
        <>
          <ul className="divide-y divide-border rounded-md border border-border" aria-label="Denetim kayıtları">
            {data.items.map((r) => (
              <li key={r.id} className="grid gap-1 p-3 text-sm md:grid-cols-[150px_160px_1fr] md:items-center">
                <span className="text-xs tabular-nums text-muted-foreground">{when(r.created_at)}</span>
                <span className="font-medium">{r.actor_name ?? 'Sistem'}</span>
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <StatusChip tone={r.action === 'access_denied' ? 'warning' : 'neutral'} label={auditActionLabel(r.action)} />
                  <span className="text-xs text-muted-foreground">{auditEntityLabel(r.entity_type)} · {r.entity_id.slice(0, 8)}</span>
                  <span className="min-w-0 truncate text-xs">{detail(r)}</span>
                </span>
              </li>
            ))}
          </ul>
          <nav className="flex items-center justify-between text-sm" aria-label="Sayfalar">
            <button type="button" className="rf-secondary-button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Önceki</button>
            <span className="text-xs text-muted-foreground">{offset + 1}–{Math.min(offset + PAGE, data.total)} / {data.total}</span>
            <button type="button" className="rf-secondary-button" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Sonraki</button>
          </nav>
        </>
      )}
    </div>
  );
}
