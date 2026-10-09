'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Award, FileQuestion, Gauge, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { EmptyState, HintTip, Skeleton, Sparkline, StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { cn, formatCurrency } from '@/lib/utils';

type Tab = 'reorder' | 'rfq' | 'suppliers';
type ReorderRow = {
  itemId: string; sku: string; name: string; uom: string; minStock: number; onHand: number; reserved: number; available: number; incoming: number; drafted: number;
  policy: { maxStock: number | null; leadTimeDays: number | null; orderMultiple: number | null; dailyUsage: number } | null;
  levels: { reorderPoint: number; target: number; cover: number }; state: 'ok' | 'covered' | 'draftable' | 'unknown';
  suggested: { quantity: number; supplierName: string; lengthMm: number | null } | null; reason: string | null;
};
type Basics = { items: Array<{ id: string; name: string; stock_uom: string }>; warehouses: Array<{ id: string; name: string; warehouse_type: string }>; suppliers: Array<{ id: string; name: string; is_active: boolean }> };
type Rfq = {
  id: string; number: string; status: 'open' | 'awarded' | 'cancelled'; currency: string; dueOn: string | null; version: number;
  suppliers: Array<{ id: string; name: string }>; awardedSupplierId: string | null; purchaseOrderNumber: string | null;
  lines: Array<{ id: string; itemName: string; uom: string; quantity: number; lengthMm: number | null; color: string }>;
  responses: Array<{ supplierId: string; supplierName: string; leadTimeDays: number | null; validUntil: string | null; prices: Array<{ lineId: string; unitPrice: number }> }>;
  comparison: { rows: Array<{ supplierId: string; supplierName: string; total: number; complete: boolean; missing: number; expired: boolean; leadTimeDays: number | null }>; cheapest: Record<string, { supplierId: string; unitPrice: number } | null>; suggested: string | null };
};
type Cards = {
  suppliers: Array<{ supplierId: string; supplierName: string; received: number; onTimePct: number | null; rejectPct: number | null; avgDaysLate: number | null; avgLeadDays: number | null; score: number | null; grade: string | null; enoughData: boolean }>;
  prices: Array<{ itemId: string; itemName: string; supplierId: string; supplierName: string; currency: string; last: number; changePct: number | null; series: Array<{ unitPrice: number }> }>;
};

const STATE: Record<ReorderRow['state'], [Parameters<typeof StatusChip>[0]['tone'], string]> = {
  ok: ['success', 'Yeterli'], covered: ['info', 'Siparişte'], draftable: ['warning', 'Sipariş ver'], unknown: ['danger', 'Bilgi eksik'],
};
const num = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n);
const post = (url: string, body: unknown, method = 'POST') => requestJson<any>(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** Purchasing in depth: when to buy (reorder policy), whom to ask (RFQ), and how suppliers do (score, prices). */
export function PurchasingDepth() {
  const { data: session } = useSession();
  const writable = ['owner', 'admin', 'office'].includes(String((session?.user as any)?.role ?? ''));
  const [tab, setTab] = useState<Tab>('reorder');
  return (
    <section className="space-y-4" aria-label="Satın alma derinliği">
      <div className="flex gap-1 rounded-md border border-border p-1" role="tablist">
        {([['reorder', 'Yeniden sipariş', RefreshCw], ['rfq', 'Teklif isteme', FileQuestion], ['suppliers', 'Tedarikçi karnesi', Gauge]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn('flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-medium', tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <Icon size={14} aria-hidden /> <span className="hidden sm:inline">{label}</span><span className="sm:hidden">{label.split(' ')[0]}</span>
          </button>
        ))}
      </div>
      {tab === 'reorder' && <Reorder writable={writable} />}
      {tab === 'rfq' && <Rfqs writable={writable} />}
      {tab === 'suppliers' && <Suppliers />}
    </section>
  );
}

function Reorder({ writable }: { writable: boolean }) {
  const [data, setData] = useState<{ policyAvailable: boolean; rows: ReorderRow[] } | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [form, setForm] = useState({ minStock: '', maxStock: '', leadTimeDays: '', orderMultiple: '' });
  const [error, setError] = useState('');
  const load = useCallback(() => requestJson<{ policyAvailable: boolean; rows: ReorderRow[] }>('/api/v1/stock/reorder', { cache: 'no-store' }).then((r) => (r.ok && r.data ? setData(r.data) : setError(r.error || 'Alınamadı'))), []);
  useEffect(() => { void load(); }, [load]);
  if (!data) return error ? <p role="alert" className="rf-panel text-sm">{error}</p> : <Skeleton className="h-40" />;
  if (!data.rows.length) return <EmptyState title="Asgari stoğu tanımlı kalem yok" icon={RefreshCw} />;
  const open = (r: ReorderRow) => { setEdit(r.itemId); setForm({ minStock: String(r.minStock), maxStock: r.policy?.maxStock?.toString() ?? '', leadTimeDays: r.policy?.leadTimeDays?.toString() ?? '', orderMultiple: r.policy?.orderMultiple?.toString() ?? '' }); };
  async function save(itemId: string) {
    setError('');
    const r = await post(`/api/v1/stock/reorder/${itemId}`, { minStock: Number(form.minStock), maxStock: form.maxStock ? Number(form.maxStock) : null, leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : null, orderMultiple: form.orderMultiple ? Number(form.orderMultiple) : null }, 'PUT');
    if (r.ok && r.data) { setData(r.data); setEdit(null); } else setError(r.error || 'Kaydedilemedi');
  }
  return (
    <div className="rf-panel space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Yeniden sipariş</h3>
        <HintTip text="Sipariş noktası = asgari + son 90 günün günlük tüketimi × tedarik süresi. Kullanılabilir stok (eldeki − ayrılan) bunun altına inince azami stoğa kadar, paket katına yuvarlanarak alınır; satın alma taslağı yine onayla açılır." />
      </div>
      {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      <ul className="divide-y divide-border">
        {data.rows.map((r) => {
          const [tone, label] = STATE[r.state];
          const max = Math.max(r.levels.target, r.available, r.levels.reorderPoint, 1);
          return (
            <li key={r.itemId} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name} <span className="text-xs text-muted-foreground">{r.sku}</span></span>
                <StatusChip tone={tone} label={label} />
                {writable && data.policyAvailable && edit !== r.itemId && <button type="button" className="text-xs font-medium text-primary" onClick={() => open(r)}>Politika</button>}
              </div>
              {/* Stock bar: available (filled), reorder point (tick), target (end). */}
              <div className="relative h-2.5 rounded-full bg-muted" role="img" aria-label={`Kullanılabilir ${num(r.available)}, sipariş noktası ${num(r.levels.reorderPoint)}, hedef ${num(r.levels.target)} ${r.uom}`}>
                <span className={cn('absolute inset-y-0 left-0 rounded-full', r.available < r.levels.reorderPoint ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${Math.max(0, Math.min(100, (r.available / max) * 100))}%` }} />
                <span className="absolute inset-y-[-3px] w-0.5 bg-foreground" style={{ left: `${(r.levels.reorderPoint / max) * 100}%` }} />
              </div>
              <p className="flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
                <span>kullanılabilir {num(r.available)} {r.uom}</span>
                <span>nokta {num(r.levels.reorderPoint)}</span>
                <span>hedef {num(r.levels.target)}</span>
                {r.incoming > 0 && <span>yolda {num(r.incoming)}</span>}
                {r.policy?.dailyUsage ? <span>günlük {num(r.policy.dailyUsage)}</span> : null}
                {r.suggested && <span className="text-foreground">→ {num(r.suggested.quantity)}{r.suggested.lengthMm ? ` çubuk × ${r.suggested.lengthMm} mm` : ` ${r.uom}`} · {r.suggested.supplierName}</span>}
                {r.reason && <span className="text-rose-700 dark:text-rose-300">{r.reason}</span>}
              </p>
              {edit === r.itemId && (
                <form className="grid grid-cols-2 gap-2 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); void save(r.itemId); }}>
                  {([['minStock', 'Asgari'], ['maxStock', 'Azami'], ['leadTimeDays', 'Tedarik (gün)'], ['orderMultiple', 'Paket katı']] as const).map(([k, l]) => (
                    <label key={k} className="text-[11px] text-muted-foreground">{l}
                      <input type="number" min={0} step="any" required={k === 'minStock'} className="rf-input mt-1 w-full text-sm text-foreground" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
                    </label>
                  ))}
                  <span className="col-span-2 flex items-end gap-2 sm:col-span-1"><button className="rf-primary-button">Kaydet</button><button type="button" className="rf-input" onClick={() => setEdit(null)}>Vazgeç</button></span>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Rfqs({ writable }: { writable: boolean }) {
  const [data, setData] = useState<{ available: boolean; rfqs: Rfq[] } | null>(null);
  const [basics, setBasics] = useState<Basics | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => requestJson<{ available: boolean; rfqs: Rfq[] }>('/api/v1/purchases/rfqs', { cache: 'no-store' }).then((r) => (r.ok && r.data ? setData(r.data) : setError(r.error || 'Alınamadı'))), []);
  useEffect(() => {
    void load();
    requestJson<{ data: Basics }>('/api/v1/procurement/workspace', { cache: 'no-store' }).then((r) => { if (r.ok && r.data) setBasics(r.data.data); });
  }, [load]);
  async function act(id: string, body: unknown) {
    setError('');
    const r = await post(`/api/v1/purchases/rfqs/${id}`, body);
    if (r.ok && r.data) setData(r.data); else setError(r.error || 'İşlem tamamlanamadı');
  }
  if (!data) return error ? <p role="alert" className="rf-panel text-sm">{error}</p> : <Skeleton className="h-40" />;
  if (!data.available) return <EmptyState title="Teklif isteme veritabanı güncellemesinden (043) sonra açılır" icon={FileQuestion} />;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Teklif istekleri</h3>
        <HintTip text="Tedarikçilere aynı satırlar için fiyat sorulur; cevaplar elle girilir (e-posta gönderimi bağlanmadı). Seçilen cevap taslak satın alma siparişi olur ve her zamanki gibi kontrol edilip gönderilir." />
        {writable && !creating && <button type="button" className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary" onClick={() => setCreating(true)}><Plus size={13} /> Yeni istek</button>}
      </div>
      {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      {creating && basics && <RfqForm basics={basics} onCancel={() => setCreating(false)} onSave={async (body) => { const r = await post('/api/v1/purchases/rfqs', body); if (r.ok && r.data) { setData(r.data); setCreating(false); } else setError(r.error || 'Kaydedilemedi'); }} />}
      {data.rfqs.length === 0 && !creating && <EmptyState title="Teklif isteği yok" icon={FileQuestion} />}
      {data.rfqs.map((q) => <RfqCard key={q.id} rfq={q} writable={writable} onAct={(b) => act(q.id, b)} />)}
    </div>
  );
}

function RfqForm({ basics, onCancel, onSave }: { basics: Basics; onCancel: () => void; onSave: (b: unknown) => void }) {
  const raw = basics.warehouses.filter((w) => w.warehouse_type === 'RAW');
  const [lines, setLines] = useState([{ itemId: basics.items[0]?.id ?? '', quantity: '1', lengthMm: '', color: '' }]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [warehouseId, setWarehouseId] = useState(raw[0]?.id ?? '');
  const [currency, setCurrency] = useState('TRY');
  const [dueOn, setDueOn] = useState('');
  const uom = (id: string) => basics.items.find((i) => i.id === id)?.stock_uom;
  return (
    <form className="rf-panel space-y-3" onSubmit={(e) => { e.preventDefault(); onSave({ currency, dueOn: dueOn || undefined, supplierIds: suppliers, lines: lines.map((l) => ({ itemId: l.itemId, warehouseId, quantity: Number(l.quantity), ...(uom(l.itemId) === 'm' ? { lengthMm: Number(l.lengthMm), color: l.color } : {}) })) }); }}>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_auto] gap-2 sm:grid-cols-[1fr_90px_100px_120px_auto]">
          <select aria-label={`Satır ${i + 1} kalem`} className="rf-input" value={l.itemId} onChange={(e) => setLines((p) => p.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)))}>
            {basics.items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
          </select>
          <input type="number" min={0.001} step="any" required aria-label={`Satır ${i + 1} miktar`} placeholder={uom(l.itemId) === 'm' ? 'çubuk' : uom(l.itemId)} className="rf-input" value={l.quantity} onChange={(e) => setLines((p) => p.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
          {uom(l.itemId) === 'm' ? (
            <>
              <input type="number" min={100} required aria-label={`Satır ${i + 1} çubuk boyu`} placeholder="boy mm" className="rf-input" value={l.lengthMm} onChange={(e) => setLines((p) => p.map((x, j) => (j === i ? { ...x, lengthMm: e.target.value } : x)))} />
              <input required aria-label={`Satır ${i + 1} renk`} placeholder="renk" className="rf-input" value={l.color} onChange={(e) => setLines((p) => p.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} />
            </>
          ) : <span className="hidden sm:col-span-2 sm:block" />}
          <button type="button" className="rf-icon-button" aria-label={`Satır ${i + 1} sil`} disabled={lines.length === 1} onClick={() => setLines((p) => p.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" className="inline-flex items-center gap-1 text-xs text-primary" onClick={() => setLines((p) => [...p, { itemId: basics.items[0]?.id ?? '', quantity: '1', lengthMm: '', color: '' }])}><Plus size={13} /> Satır</button>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-xs text-muted-foreground">Tedarikçiler</legend>
        {basics.suppliers.filter((s) => s.is_active).map((s) => (
          <label key={s.id} className={cn('cursor-pointer rounded-full border px-3 py-1 text-xs', suppliers.includes(s.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
            <input type="checkbox" className="sr-only" checked={suppliers.includes(s.id)} onChange={(e) => setSuppliers((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))} />{s.name}
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="text-xs">Depo<select className="rf-input mt-1 w-full" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>{raw.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label className="text-xs">Para birimi<select className="rf-input mt-1 w-full" value={currency} onChange={(e) => setCurrency(e.target.value)}>{['TRY', 'EUR', 'USD', 'GBP'].map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="text-xs">Son cevap<input type="date" className="rf-input mt-1 w-full" value={dueOn} onChange={(e) => setDueOn(e.target.value)} /></label>
      </div>
      <span className="flex gap-2"><button disabled={!suppliers.length || !warehouseId} className="rf-primary-button">İsteği oluştur</button><button type="button" className="rf-input" onClick={onCancel}>Vazgeç</button></span>
    </form>
  );
}

function RfqCard({ rfq: q, writable, onAct }: { rfq: Rfq; writable: boolean; onAct: (b: unknown) => void }) {
  const [entry, setEntry] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [lead, setLead] = useState('');
  const [valid, setValid] = useState('');
  const open = q.status === 'open';
  return (
    <article className="rf-panel space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{q.number}</span>
        <StatusChip tone={q.status === 'awarded' ? 'success' : q.status === 'cancelled' ? 'muted' : 'info'} label={q.status === 'awarded' ? 'Verildi' : q.status === 'cancelled' ? 'İptal' : 'Açık'} />
        {q.purchaseOrderNumber && <span className="text-xs text-muted-foreground">→ {q.purchaseOrderNumber}</span>}
        {q.dueOn && <span className="ml-auto text-xs text-muted-foreground">son {new Date(q.dueOn + 'T12:00:00Z').toLocaleDateString('tr-TR')}</span>}
      </div>
      <ul className="text-xs text-muted-foreground">
        {q.lines.map((l) => <li key={l.id}>{l.itemName} · {num(l.quantity)} {l.uom === 'm' ? `çubuk × ${l.lengthMm} mm · ${l.color}` : l.uom}{q.comparison.cheapest[l.id] && <span className="text-foreground"> · en iyi {formatCurrency(q.comparison.cheapest[l.id]!.unitPrice, q.currency)}</span>}</li>)}
      </ul>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-xs">
          <thead><tr className="text-left text-muted-foreground"><th className="py-1 font-medium">Tedarikçi</th><th className="font-medium">Toplam</th><th className="font-medium">Süre</th><th /></tr></thead>
          <tbody>
            {q.suppliers.map((s) => {
              const row = q.comparison.rows.find((r) => r.supplierId === s.id);
              const best = q.comparison.suggested === s.id;
              return (
                <tr key={s.id} className={cn('border-t border-border', q.awardedSupplierId === s.id && 'bg-primary/5')}>
                  <td className="py-1.5 font-medium">{s.name}{best && open && <StatusChip className="ml-2" tone="success" icon={Award} label="Önerilen" />}</td>
                  <td className="tabular-nums">{row ? <>{formatCurrency(row.total, q.currency)}{!row.complete && <span className="text-amber-700 dark:text-amber-300"> · {row.missing} satır yok</span>}{row.expired && <span className="text-rose-700 dark:text-rose-300"> · süresi doldu</span>}</> : <span className="text-muted-foreground">cevap yok</span>}</td>
                  <td className="tabular-nums">{row?.leadTimeDays != null ? `${row.leadTimeDays} gün` : '—'}</td>
                  <td className="whitespace-nowrap pr-1 text-right">
                    {open && writable && <button type="button" className="text-primary" onClick={() => { setEntry(entry === s.id ? null : s.id); const old = q.responses.find((r) => r.supplierId === s.id); setPrices(Object.fromEntries((old?.prices ?? []).map((p) => [p.lineId, String(p.unitPrice)]))); setLead(old?.leadTimeDays?.toString() ?? ''); setValid(old?.validUntil ?? ''); }}>{row ? 'Düzelt' : 'Cevap gir'}</button>}
                    {open && writable && row?.complete && !row.expired && <button type="button" className="ml-3 font-medium text-primary" onClick={() => onAct({ action: 'award', supplierId: s.id, version: q.version })}>Seç</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {entry && (
        <form className="grid gap-2 rounded-md border border-border p-3" onSubmit={(e) => { e.preventDefault(); onAct({ action: 'response', supplierId: entry, leadTimeDays: lead ? Number(lead) : null, validUntil: valid || null, prices: Object.entries(prices).filter(([, v]) => v !== '').map(([lineId, v]) => ({ lineId, unitPrice: Number(v) })) }); setEntry(null); }}>
          {q.lines.map((l) => (
            <label key={l.id} className="flex items-center gap-2 text-xs"><span className="min-w-0 flex-1 truncate">{l.itemName}</span>
              <input type="number" min={0} step="any" aria-label={`${l.itemName} birim fiyat`} placeholder="birim fiyat" className="rf-input w-32 text-right" value={prices[l.id] ?? ''} onChange={(e) => setPrices((p) => ({ ...p, [l.id]: e.target.value }))} />
            </label>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">Teslim süresi (gün)<input type="number" min={0} className="rf-input mt-1 w-full" value={lead} onChange={(e) => setLead(e.target.value)} /></label>
            <label className="text-xs">Geçerlilik<input type="date" className="rf-input mt-1 w-full" value={valid} onChange={(e) => setValid(e.target.value)} /></label>
          </div>
          <button className="rf-primary-button justify-self-start">Cevabı kaydet</button>
        </form>
      )}
      {open && writable && <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => onAct({ action: 'cancel' })}>İsteği iptal et</button>}
    </article>
  );
}

function Suppliers() {
  const [data, setData] = useState<Cards | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { requestJson<Cards>('/api/v1/purchases/scorecards', { cache: 'no-store' }).then((r) => (r.ok && r.data ? setData(r.data) : setError(r.error || 'Alınamadı'))); }, []);
  if (!data) return error ? <p role="alert" className="rf-panel text-sm">{error}</p> : <Skeleton className="h-40" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rf-panel space-y-2" aria-label="Tedarikçi puanı">
        <div className="flex items-center gap-2"><h3 className="text-sm font-semibold">Tedarikçi puanı · 12 ay</h3><HintTip text="Zamanında teslim (ilk kabul beklenen günde ya da önce) %60, kalite (ret oranı) %40. Üç teslimattan azında harf verilmez." /></div>
        {data.suppliers.length === 0 ? <p className="text-xs text-muted-foreground">Teslim alınmış sipariş yok</p> : (
          <ul className="space-y-2">
            {data.suppliers.map((s) => (
              <li key={s.supplierId} className="flex flex-wrap items-center gap-2 text-sm">
                <span className={cn('grid h-8 w-8 place-items-center rounded-md text-sm font-bold', s.grade === 'A' ? 'bg-emerald-600 text-white' : s.grade === 'B' ? 'bg-primary text-primary-foreground' : s.grade === 'C' ? 'bg-amber-500 text-black' : s.grade === 'D' ? 'bg-rose-600 text-white' : 'bg-muted text-muted-foreground')} aria-label={s.grade ? `Not ${s.grade}` : 'Yeterli veri yok'}>{s.grade ?? '–'}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{s.supplierName}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{s.onTimePct ?? '—'}% zamanında · ret %{s.rejectPct ?? '—'} · {s.avgLeadDays ?? '—'} gün · {s.received} teslim</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rf-panel space-y-2" aria-label="Fiyat geçmişi">
        <h3 className="text-sm font-semibold">Fiyat geçmişi</h3>
        {data.prices.length === 0 ? <p className="text-xs text-muted-foreground">Fiyatlı sipariş yok</p> : (
          <ul className="space-y-1.5">
            {data.prices.slice(0, 30).map((p) => (
              <li key={p.itemId + p.supplierId + p.currency} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{p.itemName} <span className="text-xs text-muted-foreground">· {p.supplierName}</span></span>
                {p.series.length > 1 && <Sparkline values={p.series.map((x) => x.unitPrice)} label={`${p.itemName} fiyat eğrisi`} />}
                <span className="w-24 text-right tabular-nums">{formatCurrency(p.last, p.currency)}</span>
                {p.changePct != null && p.changePct !== 0 && (
                  <span className={cn('inline-flex w-16 items-center justify-end gap-0.5 text-xs tabular-nums', p.changePct > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300')}>
                    {p.changePct > 0 ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}{p.changePct > 0 ? '+' : ''}{p.changePct}%
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
