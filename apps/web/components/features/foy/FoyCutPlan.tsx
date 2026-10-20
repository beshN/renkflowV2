'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Paintbrush, Recycle, Scissors, ShoppingCart } from 'lucide-react';
import { StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import type { CutListPlan, CutRow, PlannedBar, RowProblem } from '@/lib/features/manufacturing/cut-list';
import type { FoyDoc } from '@/lib/features/foy/types';

type Result = {
  color: string;
  rows: CutRow[];
  problems: RowProblem[];
  plan: CutListPlan;
  estimateNotice: string | null;
  stock: { items: number; bars: number };
  stockProblems?: Array<{ lotNumber: string; itemName: string; reason: string }>;
};

const cm = (mm: number) => (mm / 10).toLocaleString('tr-TR', { maximumFractionDigits: 1, useGrouping: false });
const SOURCE: Record<PlannedBar['sourceKind'], { label: string; cls: string }> = {
  new: { label: 'Stok', cls: 'bg-muted text-muted-foreground' },
  remnant: { label: 'Artık', cls: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' },
  scrap: { label: 'Hurdadan', cls: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' },
};

/**
 * What to cut from where, for one read order sheet: leftovers and scrap bars are used first when a
 * piece fits, the rest comes from whole bars, and what stock cannot cover is listed as bars to buy.
 * Nothing is reserved; it is a plan to read, with the numbers the workshop needs at the saw.
 */
export function FoyCutPlan({ doc,family,onReview }: { doc: FoyDoc;family?:string;onReview?:(doc:FoyDoc,choices:Record<string,string>)=>void }) {
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  // Steel lengths the sheet's drawing did not give are typed here and join the sheet before planning.
  const planned = useMemo<FoyDoc>(() => ({
    ...doc,
    ironCuts: doc.ironCuts.map((c) => (c.lengthCm === null && Number(typed[c.page]?.replace(',', '.')) > 0 ? { ...c, lengthCm: Number(typed[c.page].replace(',', '.')) } : c)),
  }), [doc, typed]);

  useEffect(() => {
    let live = true;
    setBusy(true);
    const timer = setTimeout(async () => {
      const r = await requestJson<Result>('/api/v1/production/cut-list', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ doc: planned, choices, family }) }, { timeoutMs: 60_000 });
      if (!live) return;
      setBusy(false);
      if (r.ok && r.data) { setResult(r.data); setError(''); } else setError(r.error || 'Kesim planı hazırlanamadı');
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [planned, choices, family]);

  if (!doc.cutList.length && !doc.ironCuts.length) return null;
  const s = result?.plan.summary;
  const unreadIron = doc.ironCuts.filter((c) => c.lengthCm === null);

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3" aria-labelledby="cut-plan-title" aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="cut-plan-title" className="flex items-center gap-1.5 text-sm font-semibold"><Scissors size={15} aria-hidden /> Kesim planı</h3>
        {busy && <Loader2 size={14} className="animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="Hesaplanıyor" />}
        {s && <>
          <StatusChip tone="neutral" label={`${s.pieces} parça`} />
          {s.remnantsUsed > 0 && <StatusChip tone="success" icon={Recycle} label={`${s.remnantsUsed} artık kullanılıyor`} />}
          {s.scrapUsed > 0 && <StatusChip tone="warning" icon={Recycle} label={`${s.scrapUsed} hurda boy kullanılıyor`} />}
          {s.toPaint > 0 && <StatusChip tone="warning" icon={Paintbrush} label={`${s.toPaint} boyasız çubuktan kesilip boyanacak`} />}
          {s.toBuy > 0 ? <StatusChip tone={result?.stockProblems?.length ? 'warning' : 'danger'} icon={ShoppingCart} label={`${s.toBuy} çubuk${result?.stockProblems?.length ? ' eksik görünüyor' : ' satın alma önerisi'}`} /> : s.pieces > 0 && !result?.stockProblems?.length && !result?.plan.unmatched.length && !result?.plan.groups.some((g) => g.tooLong.length || g.missing.length) && <StatusChip tone="success" label="Stok yetiyor" />}
          {s.wastePercent !== null && <StatusChip tone="neutral" label={`Fire %${s.wastePercent.toLocaleString('tr-TR')}`} />}
        </>}
      </div>

      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {result?.estimateNotice && <p className="text-xs text-muted-foreground">{result.estimateNotice}</p>}
      <p className="text-xs text-muted-foreground">Önce uygun renkli stok, eksik parçalar için boyasız stok değerlendirilir. Boyasız parçalar kesildikten sonra istenen renge boyaya gönderilir. Plan stok ayırmaz.</p>
      {!!result?.stockProblems?.length && <div className="rounded-md border border-amber-600/30 bg-amber-500/5 p-2.5 text-xs" role="status">
        <p className="font-medium">Bazı stokların fiziksel boyları eksik. Bu malzemelerin kesin satın alma hesabı, boy bilgisi tamamlanana kadar gösterilmez.</p>
        <details className="mt-1"><summary className="cursor-pointer">Kontrol edilecek {result.stockProblems.length} stok kaydı</summary>
          <ul className="mt-1 space-y-1">{result.stockProblems.slice(0, 20).map((p) => <li key={p.lotNumber}>{p.itemName} · {p.lotNumber}: {p.reason}.</li>)}</ul>
          {result.stockProblems.length > 20 && <p className="mt-1">Diğer kayıtların fiziksel boylarını da Stok → Depo'dan kontrol edin.</p>}
        </details>
      </div>}

      {unreadIron.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-amber-600/30 bg-amber-500/5 p-2.5 text-xs">
          <p className="flex items-start gap-1.5 font-medium text-amber-900 dark:text-amber-200"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />Çizimden okunamayan demir boyu: yazın, plana eklensin.</p>
          {unreadIron.map((c) => (
            <label key={c.page} className="flex flex-wrap items-center gap-2">
              <span>Demir {c.profile}{c.orientation ? ` (${c.orientation})` : ''} · {c.quantity ?? '?'} adet · sayfa {c.page}</span>
              <input inputMode="decimal" aria-label={`Sayfa ${c.page} demir boyu (cm)`} placeholder="boy, cm" value={typed[c.page] ?? ''} onChange={(e) => { const next={...typed,[c.page]:e.target.value};setTyped(next);onReview?.({...doc,ironCuts:doc.ironCuts.map(v=>v.lengthCm===null&&Number(next[v.page]?.replace(',','.'))>0?{...v,lengthCm:Number(next[v.page].replace(',','.'))}:v)},choices); }} className="h-8 w-24 rounded-md border border-border bg-background px-2 text-[13px]" />
            </label>
          ))}
        </div>
      )}

      {result?.plan.unmatched.map((u) => (
        <div key={u.rowId} className="flex flex-wrap items-center gap-2 rounded-md border border-amber-600/30 bg-amber-500/5 p-2.5 text-xs">
          <AlertTriangle size={14} className="shrink-0 text-amber-700" aria-hidden />
          {family==='makasli'&&result.rows.find(row=>row.id===u.rowId)?.requiredProfileCode==='170'?<span><b>170 Makaslı Dere</b>: {u.candidates.length?'Stok kartlarının kesit ve işlem özellikleri çelişiyor; teknik kartlar kontrol edilmeli.':'Stok kartı bulunamadı. 170 Makaslı Dere kartı gerekli.'}</span>:u.candidates.length ? (
            <label className="flex flex-wrap items-center gap-2">
              <span><b>{u.label}</b>: stokta birden fazla uygun profil var, hangisi?</span>
              <select className="h-8 rounded-md border border-border bg-background px-2 text-[13px]" value={choices[u.rowId] ?? ''} onChange={(e) => {const next={...choices,[u.rowId]:e.target.value};setChoices(next);onReview?.(planned,next);}}>
                <option value="">Seçin</option>
                {u.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          ) : <span><b>{u.label}</b>: stokta bu profil bulunamadı; Stok → Ürünler'den ekleyin.</span>}
        </div>
      ))}

      {result && result.problems.some((p) => !p.ironPage) && (
        <p className="text-xs text-muted-foreground">Plana girmeyenler: {result.problems.filter((p) => !p.ironPage).map((p) => `${p.label} (${p.reason.toLocaleLowerCase('tr-TR')})`).join(' · ')}.</p>
      )}

      {result?.plan.groups.map((g) => (
        <div key={`${g.itemId}-${g.color}`} className="overflow-hidden rounded-md border border-border">
          <div className="flex flex-wrap items-baseline justify-between gap-2 bg-muted/50 px-3 py-1.5">
            <p className="text-[13px] font-semibold">{g.itemName}{g.color ? <span className="font-normal text-muted-foreground"> · {g.color}</span> : null}</p>
            <p className="text-xs text-muted-foreground">{g.pieces} parça</p>
          </div>
          {g.bars.length > 0 && (
            <ul className="divide-y divide-border/60 text-[13px]">
              {g.bars.map((b) => (
                <li key={b.lotId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${SOURCE[b.sourceKind].cls}`}>{SOURCE[b.sourceKind].label}</span>
                  <span className="tabular-nums"><b>{cm(b.sourceLengthMm)} cm</b> <span className="text-xs text-muted-foreground">{b.lotNumber}</span></span>
                  <span className="min-w-0 flex-1 tabular-nums">{b.cuts.map((c) => `${cm(c.lengthMm)}${c.count > 1 ? ` × ${c.count}` : ''}`).join(' + ')}</span>
                  {b.paintTo && <span className="flex w-full items-center gap-1 text-xs text-amber-800 dark:text-amber-300"><Paintbrush size={13} aria-hidden />{b.sourceItemName}: boyasız stoktan kes → {b.paintTo} boyaya gönder. Kalan parça boyasız stokta kalır.</span>}
                  <span className={`text-xs tabular-nums ${b.leftover === 'keep' ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {b.leftover === 'none' ? 'kalan yok' : b.leftover === 'keep' ? `${cm(b.leftoverMm)} cm artık olarak kalır` : `${cm(b.leftoverMm)} cm fire`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {g.buy && (
            <p className="flex items-center gap-1.5 border-t border-border/60 bg-rose-500/5 px-3 py-1.5 text-[13px] text-rose-800 dark:text-rose-300">
              <ShoppingCart size={14} aria-hidden /> {result.stockProblems?.length ? 'Boyları bilinen stoktan karşılanamadı:' : 'Uygun stok yetersiz; satın alma önerisi:'} <b>{g.buy.bars} çubuk × {cm(g.buy.lengthMm)} cm</b>
              <span className="text-xs">({g.missing.map((m) => `${cm(m.lengthMm)} × ${m.count}`).join(', ')} karşılanamadı)</span>
            </p>
          )}
          {g.tooLong.length > 0 && <p className="border-t border-border/60 px-3 py-1.5 text-xs text-rose-700">Standart çubuktan uzun parça var ({g.tooLong.map((m) => `${cm(m.lengthMm)} cm × ${m.count}`).join(', ')}); özel boy sipariş edin.</p>}
        </div>
      ))}
      {result && !result.plan.groups.length && !result.plan.unmatched.length && <p className="text-sm text-muted-foreground">Bu föyde profil kesim listesi bulunamadı.</p>}
      {result && result.stock.bars === 0 && !result.stockProblems?.length && <p className="text-xs text-muted-foreground">Bu listeye uygun kullanılabilir çubuk kaydı yok. Fiziksel boyları ve adetleri Stok → Depo'dan kontrol edin.</p>}
    </section>
  );
}
