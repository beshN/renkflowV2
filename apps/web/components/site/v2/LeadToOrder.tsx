'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Mail, MapPin, Play, RotateCcw, Ruler, Send, UserRound } from 'lucide-react';
import { ProductDrawing } from '@/components/drawing/ProductDrawing';
import { cn } from '@/lib/utils';
import { barsByItem, fmt, hours, ITEMS, planOrder, STOCK, tl, type Spec } from './model';
import { StageStrip, Swatch, T } from './primitives';
import { BarRow } from './CutBars';

/**
 * Lead → quote → approval → order → cut list and stock, as one record moving through the product.
 * The office side and the customer's phone sit next to each other; the visitor sends the quote,
 * approves it on the phone, and the order computes its cut list, bars and stock with the real engines.
 */

const LEAD = {
  name: 'Mavi Butik Otel', city: 'Alaçatı', contact: 'Ece Yıldız', source: 'Web formu, 6 Kas',
  survey: '9 Kas keşif · Deniz Ö.', note: 'Havuz başı oturma alanı. Akşam kullanımı için LED istendi.',
};
const SPEC: Spec = { widthMm: 5000, projectionMm: 4000, heightMm: 2700, color: 'RAL 7016 Mat', motor: true, led: true };
const STEPS = ['Potansiyel müşteri', 'Teklif', 'Onay', 'Sipariş', 'Kesim ve stok'] as const;

type Sent = 'no' | 'sending' | 'sent' | 'opened';

export function LeadToOrder() {
  const reduce = useReducedMotion();
  const plan = useMemo(() => planOrder(SPEC, 'RF-1043'), []);
  const [step, setStep] = useState(0);
  const [seen, setSeen] = useState(0);
  const [sent, setSent] = useState<Sent>('no');
  const [approved, setApproved] = useState(false);
  const [rows, setRows] = useState(0);
  const [released, setReleased] = useState(false);
  const [auto, setAuto] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, reduce ? Math.min(ms, 250) : ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const go = (n: number) => { setStep(n); setSeen((s) => Math.max(s, n)); };
  const send = () => {
    if (sent !== 'no') return;
    setSent('sending');
    later(850, () => setSent('sent'));
    later(1900, () => setSent('opened'));
  };
  const approve = () => {
    if (sent !== 'opened' || approved) return;
    setApproved(true);
    go(2);
    later(1300, () => go(3));
  };
  const compute = () => {
    go(4);
    setRows(0);
    plan.cuts.forEach((_, i) => later(300 + i * 280, () => setRows(i + 1)));
  };
  const reset = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setStep(0); setSeen(0); setSent('no'); setApproved(false); setRows(0); setReleased(false); setAuto(false);
  };
  // Autoplay walks the same buttons a visitor would press, with time to read each screen.
  const play = () => {
    reset();
    setAuto(true);
    let t = 900;
    timers.current.push(setTimeout(() => go(1), t)); t += 1500;
    timers.current.push(setTimeout(() => { setSent('sending'); }, t)); t += 850;
    timers.current.push(setTimeout(() => setSent('sent'), t)); t += 1000;
    timers.current.push(setTimeout(() => setSent('opened'), t)); t += 1600;
    timers.current.push(setTimeout(() => { setApproved(true); go(2); }, t)); t += 1300;
    timers.current.push(setTimeout(() => go(3), t)); t += 2000;
    timers.current.push(setTimeout(() => { go(4); setRows(0); }, t));
    plan.cuts.forEach((_, i) => timers.current.push(setTimeout(() => setRows(i + 1), t + 300 + i * 280)));
    timers.current.push(setTimeout(() => setAuto(false), t + 300 + plan.cuts.length * 280));
  };

  const computed = rows >= plan.cuts.length;

  return (
    <div className="relative grid gap-6 lg:grid-cols-[1fr_300px] lg:gap-8">
      {/* Office */}
      <div className="x-window flex min-h-[540px] flex-col text-[var(--x-ink)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--x-line)] bg-[var(--x-surface-sunk)] px-4 py-2.5">
          <ol className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Akış">
            {STEPS.map((label, i) => {
              const reachable = i <= seen && !auto;
              return (
                <li key={label} className="flex items-center gap-1">
                  <button type="button" disabled={!reachable} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className={cn('relative flex h-7 items-center gap-1.5 rounded-[var(--x-r-control)] px-2 text-[12px] transition-colors duration-[120ms] disabled:cursor-default', i === step ? 'font-medium text-[var(--x-ink)]' : i <= seen ? 'text-[var(--x-ink-2)] hover:bg-[var(--x-surface-hover)]' : 'text-[var(--x-faint)]')}>
                    {i === step && <motion.span layoutId="l2o-step" transition={T.indicator} className="absolute inset-0 rounded-[var(--x-r-control)] bg-[var(--x-surface)] shadow-[0_1px_2px_rgb(20_26_28/0.08),0_0_0_1px_var(--x-line)]" />}
                    <span className={cn('relative grid h-4 w-4 place-items-center rounded-full text-[9.5px] font-semibold', i < seen || (i === 4 && released) ? 'bg-[var(--x-ink-2)] text-[var(--x-surface)]' : i === step ? 'bg-[var(--x-bronze-fill)] text-[var(--x-bronze-fg)]' : 'shadow-[inset_0_0_0_1px_var(--x-line-strong)]')}>
                      {i < seen || (i === 4 && released) ? <Check size={9} strokeWidth={3} aria-hidden /> : i + 1}
                    </span>
                    <span className="relative max-sm:hidden">{label}</span>
                  </button>
                  {i < STEPS.length - 1 && <span aria-hidden className="h-px w-3 bg-[var(--x-line-strong)] max-sm:w-1.5" />}
                </li>
              );
            })}
          </ol>
          <div className="flex shrink-0 gap-1.5">
            <button type="button" onClick={play} disabled={auto} className="x-ctl"><Play size={11} aria-hidden /> {auto ? 'Oynatılıyor' : 'Oynat'}</button>
            {seen > 0 && !auto && <button type="button" onClick={reset} aria-label="Baştan başlat" className="x-ctl px-2"><RotateCcw size={12} /></button>}
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step <= 2 ? (step === 0 ? 'lead' : 'quote') : step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={T.slow} className="h-full p-5">
              {step === 0 && <LeadView onNext={() => go(1)} auto={auto} />}
              {(step === 1 || step === 2) && <QuoteView plan={plan} sent={sent} approved={approved} onSend={send} auto={auto} />}
              {step === 3 && <OrderView plan={plan} onNext={compute} auto={auto} />}
              {step === 4 && <ComputeView plan={plan} rows={rows} computed={computed} released={released} onRelease={() => setReleased(true)} auto={auto} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* The quote on its way to the customer */}
      <AnimatePresence>
        {sent === 'sending' && (
          <motion.div aria-hidden className="pointer-events-none absolute z-10 hidden h-14 w-11 rounded-[4px] bg-[var(--x-surface)] shadow-[var(--x-shadow-pop)] lg:block" initial={{ left: '42%', top: '46%', scale: 1, rotate: 0, opacity: 1 }} animate={{ left: 'calc(100% - 190px)', top: '18%', scale: 0.55, rotate: 8, opacity: [1, 1, 0] }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.85, ease: [0.5, 0, 0.2, 1] }}>
            <span className="mx-2 mt-2 block h-1 rounded bg-[var(--x-line-strong)]" /><span className="mx-2 mt-1 block h-1 w-5 rounded bg-[var(--x-line)]" /><span className="mx-2 mt-3 block h-1 rounded bg-[var(--x-bronze-fill)]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer phone */}
      <Phone sent={sent} approved={approved} onApprove={approve} total={plan.totals.totalAmount} auto={auto} />
    </div>
  );
}

function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="x-ctl x-ctl-ink h-8 px-3 text-[12.5px]">{children}</button>;
}

function LeadView({ onNext, auto }: { onNext: () => void; auto: boolean }) {
  return (
    <div className="grid h-full gap-6 md:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col">
        <p className="text-[11.5px] text-[var(--x-muted)]">Potansiyel müşteri · LD-0207</p>
        <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.02em]">{LEAD.name} <span className="font-normal text-[var(--x-muted)]">{LEAD.city}</span></h3>
        <dl className="mt-4 space-y-2.5 text-[12.5px]">
          {[[UserRound, 'İlgili kişi', LEAD.contact], [Mail, 'Kaynak', LEAD.source], [MapPin, 'Keşif', LEAD.survey]].map(([Icon, k, v]) => {
            const I = Icon as typeof UserRound;
            return <div key={k as string} className="grid grid-cols-[18px_88px_1fr] items-center gap-2"><I size={13} className="text-[var(--x-faint)]" aria-hidden /><dt className="text-[var(--x-muted)]">{k as string}</dt><dd>{v as string}</dd></div>;
          })}
        </dl>
        <p className="mt-4 rounded-[var(--x-r-panel)] bg-[var(--x-surface-sunk)] px-3 py-2.5 text-[12.5px] leading-5 text-[var(--x-ink-2)] shadow-[inset_0_0_0_1px_var(--x-line)]">{LEAD.note}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="text-[11.5px] text-[var(--x-faint)]">Ölçüler keşifte telefondan girildi.</span>
          <Primary onClick={onNext} disabled={auto}>Teklif hazırla</Primary>
        </div>
      </div>
      <div className="rounded-[var(--x-r-panel)] p-4 shadow-[var(--x-shadow-raise)]">
        <p className="flex items-center justify-between text-[12px]"><span className="flex items-center gap-1.5 font-medium"><Ruler size={13} aria-hidden /> Keşif ölçüsü</span><Swatch color={SPEC.color} className="text-[var(--x-ink-2)]" /></p>
        <ProductDrawing family="pergola" widthMm={SPEC.widthMm} projectionMm={SPEC.projectionMm} heightMm={SPEC.heightMm} color={SPEC.color} compact className="x-drawing mt-3 h-auto w-full" />
        <p className="x-num mt-2 text-center text-[12px] text-[var(--x-ink-2)]">{fmt(SPEC.widthMm)} × {fmt(SPEC.projectionMm)} × {fmt(SPEC.heightMm)} mm · motorlu · LED</p>
      </div>
    </div>
  );
}

function QuoteView({ plan, sent, approved, onSend, auto }: { plan: ReturnType<typeof planOrder>; sent: Sent; approved: boolean; onSend: () => void; auto: boolean }) {
  return (
    <div className="grid h-full gap-6 md:grid-cols-[1.15fr_1fr]">
      {/* The quote as the customer receives it */}
      <motion.div animate={{ scale: sent === 'sending' ? 0.97 : 1 }} transition={T.base} className="relative self-start rounded-[4px] bg-white px-6 py-5 text-[#1d2326] shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_16px_32px_-20px_rgb(0_0_0/0.4)]">
        <div className="flex items-start justify-between text-[11px]">
          <div><p className="text-[13px] font-semibold">Ege Alüminyum</p><p className="text-black/55">Fiyat teklifi TK-0318</p></div>
          <p className="text-right text-black/55">10 Kas 2026<br />14 gün geçerli</p>
        </div>
        <p className="mt-4 text-[11px] text-black/55">Sayın {LEAD.contact}, {LEAD.name}</p>
        <table className="mt-2 w-full text-[11.5px]">
          <tbody>
            {plan.lines.map((l) => <tr key={l.label} className="border-b border-black/10"><td className="py-1.5 pr-3">{l.label}</td><td className="x-num py-1.5 text-right">{tl(l.unitPrice * l.quantity)}</td></tr>)}
            <tr className="text-black/60"><td className="pt-2">KDV %20</td><td className="x-num pt-2 text-right">{tl(plan.totals.taxAmount)}</td></tr>
            <tr className="font-semibold"><td className="pt-1">Genel toplam</td><td className="x-num pt-1 text-right">{tl(plan.totals.totalAmount)}</td></tr>
          </tbody>
        </table>
        <p className="mt-3 text-[10.5px] leading-4 text-black/50">Teslim: onaydan sonra 3 hafta. Montaj dahildir. Renk RAL 7016 mat elektrostatik boya.</p>
        <AnimatePresence>
          {approved && (
            <motion.span initial={{ scale: 1.6, opacity: 0, rotate: -14 }} animate={{ scale: 1, opacity: 1, rotate: -9 }} transition={{ type: 'spring', stiffness: 420, damping: 22 }} className="absolute right-6 top-[44%] rounded-[6px] border-2 border-[var(--x-ok)] px-3 py-1 text-[15px] font-semibold text-[var(--x-ok)]">
              Onaylandı
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
      <div className="flex flex-col">
        <p className="text-[12px] font-medium">Gönderim</p>
        <ul className="mt-2 space-y-2 text-[12.5px]">
          <Status on={sent !== 'no'} label="E-posta ve onay bağlantısı" detail={sent === 'no' ? 'Gönderilmedi' : sent === 'sending' ? 'Gönderiliyor…' : '10:42 · ece@mavibutik.com'} />
          <Status on={sent === 'opened'} label="Müşteri teklifi açtı" detail={sent === 'opened' ? '10:43 · telefondan' : 'Bekleniyor'} />
          <Status on={approved} label="Müşteri onayı" detail={approved ? '10:44 · bağlantıdan onaylandı' : sent === 'opened' ? 'Müşterinin telefonunda onaylayın' : 'Bekleniyor'} highlight={sent === 'opened' && !approved} />
        </ul>
        <p className="mt-4 text-[11.5px] leading-5 text-[var(--x-faint)]">İndirim firmanın eşiğini aşarsa teklif gönderilmeden önce yönetici onayı istenir.</p>
        <div className="mt-auto flex justify-end pt-5">
          {sent === 'no' ? <Primary onClick={onSend} disabled={auto}><Send size={12} aria-hidden /> Teklifi gönder</Primary> : approved ? <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--x-ok)]"><Check size={14} aria-hidden /> Siparişe dönüştürülüyor</span> : <span className="text-[12px] text-[var(--x-muted)]">Müşteri yanıtı bekleniyor</span>}
        </div>
      </div>
    </div>
  );
}

function Status({ on, label, detail, highlight }: { on: boolean; label: string; detail: string; highlight?: boolean }) {
  return (
    <li className={cn('flex items-start gap-2.5 rounded-[var(--x-r-control)] px-2 py-1.5 transition-colors duration-200', highlight && 'bg-[var(--x-bronze-soft)]')}>
      <span className={cn('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full transition-colors duration-200', on ? 'bg-[var(--x-ok)] text-white' : 'shadow-[inset_0_0_0_1px_var(--x-line-strong)]')}>{on && <Check size={9} strokeWidth={3} aria-hidden />}</span>
      <span><span className="block">{label}</span><span className="block text-[11.5px] text-[var(--x-muted)]">{detail}</span></span>
    </li>
  );
}

function OrderView({ plan, onNext, auto }: { plan: ReturnType<typeof planOrder>; onNext: () => void; auto: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[12px] text-[var(--x-muted)]"><span className="x-mono text-[var(--x-bronze)]">RF-1043</span>Tekliften dönüştürüldü · TK-0318</p>
          <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.02em]">{LEAD.name} <span className="font-normal text-[var(--x-muted)]">{LEAD.city}</span></h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[12px] text-[var(--x-ink-2)]"><span>Bioklimatik pergola</span><span className="x-num">{fmt(SPEC.widthMm)} × {fmt(SPEC.projectionMm)} × {fmt(SPEC.heightMm)}</span><Swatch color={SPEC.color} /></p>
        </div>
        <p className="text-right text-[12px] text-[var(--x-muted)]">Termin<br /><span className="text-[14px] font-semibold text-[var(--x-ink)]">1 Ara</span></p>
      </div>
      <StageStrip stage="approval" className="mt-5" />
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[var(--x-r-panel)] p-3.5 shadow-[var(--x-shadow-raise)]">
          <p className="text-[12px] font-medium">Kalemler</p>
          <ul className="mt-2 space-y-1.5 text-[12.5px]">{plan.lines.map((l) => <li key={l.label} className="flex justify-between gap-3"><span className="truncate text-[var(--x-ink-2)]">{l.label}</span><span className="x-num">{tl(l.unitPrice)}</span></li>)}</ul>
          <p className="mt-2.5 flex justify-between border-t border-[var(--x-line)] pt-2.5 text-[13px] font-semibold"><span>Toplam, KDV dahil</span><span className="x-num">{tl(plan.totals.totalAmount)}</span></p>
        </div>
        <div className="rounded-[var(--x-r-panel)] p-3.5 shadow-[var(--x-shadow-raise)]">
          <p className="text-[12px] font-medium">Tahsilat planı</p>
          <ul className="mt-2 space-y-1.5 text-[12.5px]">
            <li className="flex justify-between"><span className="text-[var(--x-ink-2)]">Kapora %40 · 12 Kas</span><span className="x-num">{tl(plan.totals.totalAmount * 0.4)}</span></li>
            <li className="flex justify-between"><span className="text-[var(--x-ink-2)]">Montajda %60 · 1 Ara</span><span className="x-num">{tl(plan.totals.totalAmount * 0.6)}</span></li>
          </ul>
          <p className="mt-2.5 border-t border-[var(--x-line)] pt-2.5 text-[11.5px] text-[var(--x-muted)]">Tahsilatlar siparişe bağlanır, kalan bakiye siparişte görünür.</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span className="text-[11.5px] text-[var(--x-faint)]">Ölçüler tekliften geldi; yeniden girilmez.</span>
        <Primary onClick={onNext} disabled={auto}>Kesim listesini çıkar</Primary>
      </div>
    </div>
  );
}

function ComputeView({ plan, rows, computed, released, onRelease, auto }: { plan: ReturnType<typeof planOrder>; rows: number; computed: boolean; released: boolean; onRelease: () => void; auto: boolean }) {
  const groups = barsByItem(plan.bars);
  const stock = groups.map(({ item, bars }) => {
    const whole = bars.filter((b) => !b.source.isRemnant).length;
    const s = STOCK.find((x) => ITEMS[x.item].id === item.id && x.color === SPEC.color);
    const free = s ? s.bars - s.reserved : 0;
    return { item, whole, remnants: bars.length - whole, short: Math.max(0, whole - free) };
  });
  const short = stock.reduce((n, r) => n + r.short, 0);
  return (
    <div className="grid h-full gap-6 md:grid-cols-[1fr_1fr]">
      <div className="flex flex-col">
        <p className="flex justify-between text-[12px]"><span className="font-medium">Kesim listesi · reçete PRG-BIO v3</span><span className="x-num text-[var(--x-muted)]">{rows}/{plan.cuts.length}</span></p>
        <ul className="mt-2 text-[12.5px]">
          {plan.cuts.map((c, i) => (
            <AnimatePresence key={c.itemId} initial={false}>
              {i < rows && (
                <motion.li initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={T.base} className="flex justify-between gap-3 border-b border-[var(--x-line)] py-2">
                  <span><span className="x-mono text-[var(--x-bronze)]">{c.item.code}</span> <span className="text-[var(--x-ink-2)]">{c.item.name}</span></span>
                  <span className="x-num">{fmt(c.lengthMm)} mm × {c.quantity}</span>
                </motion.li>
              )}
            </AnimatePresence>
          ))}
          {!computed && <li className="flex items-center gap-2 py-2 text-[12px] text-[var(--x-muted)]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--x-bronze-fill)] motion-reduce:animate-none" />Ölçülerden hesaplanıyor</li>}
        </ul>
        <AnimatePresence>
          {computed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={T.slow} className="mt-4 space-y-1.5">
              {groups.slice(0, 2).map(({ item, bars }) => <div key={item.id}><p className="mb-1 text-[11px] text-[var(--x-muted)]">{item.code} · {bars.length} çubuk</p><BarRow bar={bars[0]} scale={7000} dense /></div>)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {computed && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={T.slow} className="flex flex-col">
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[var(--x-r-panel)] bg-[var(--x-line)] shadow-[0_0_0_1px_var(--x-line)]">
              {[[String(plan.bars.length), 'çubuk'], [`%${fmt(plan.cut.wastePercent, 1)}`, 'fire'], [hours(plan.minutes), 'atölye']].map(([v, l]) => (
                <div key={l} className="bg-[var(--x-surface)] px-3 py-2.5"><p className="x-num text-[15px] font-semibold tracking-[-0.02em]">{v}</p><p className="text-[11px] text-[var(--x-muted)]">{l}</p></div>
              ))}
            </div>
            <p className="mt-4 text-[12px] font-medium">Stok, RAL 7016 Mat</p>
            <ul className="mt-1.5 space-y-1.5 text-[12.5px]">
              {stock.map((r) => <li key={r.item.id} className="flex justify-between gap-3"><span className="text-[var(--x-ink-2)]">{r.item.code} · {r.whole} çubuk{r.remnants ? ` + ${r.remnants} artık` : ''}</span><span className={r.short ? 'font-medium text-[var(--x-danger)]' : 'text-[var(--x-ok)]'}>{r.short ? `${r.short} eksik` : 'Rezerve edildi'}</span></li>)}
            </ul>
            {short > 0 && <p className="mt-3 rounded-[var(--x-r-control)] bg-[var(--x-surface-sunk)] px-3 py-2 text-[12px] text-[var(--x-ink-2)]">{short} çubuk için satın alma önerisi hazır.</p>}
            <div className="mt-auto flex items-center justify-end gap-3 pt-5">
              {released ? <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--x-ok)]"><Check size={14} aria-hidden /> 4 iş emri oluşturuldu: kesim, CNC, boya, montaj</span> : <Primary onClick={onRelease} disabled={auto}>Üretime gönder</Primary>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Phone({ sent, approved, onApprove, total, auto }: { sent: Sent; approved: boolean; onApprove: () => void; total: number; auto: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[300px] self-center rounded-[34px] bg-[var(--x-chrome)] p-2 shadow-[0_0_0_1px_rgb(0_0_0/0.25),0_32px_64px_-40px_rgb(10_14_16/0.7)]">
      <div className="relative flex h-[520px] flex-col overflow-hidden rounded-[27px] bg-[#e9ecec] text-[#1d2326]">
        <div className="flex justify-between px-6 pt-3 text-[11px] font-semibold"><span>10:4{sent === 'opened' ? (approved ? 4 : 3) : 2}</span><span>Müşteri telefonu</span></div>
        <AnimatePresence mode="wait" initial={false}>
          {sent !== 'opened' ? (
            <motion.div key="lock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={T.base} className="flex flex-1 flex-col px-4 pt-10">
              <p className="text-center text-[44px] font-light leading-none tracking-[-0.02em]">10:42</p>
              <p className="mt-1 text-center text-[12px] text-black/55">Salı, 10 Kasım</p>
              <AnimatePresence>
                {sent === 'sent' && (
                  <motion.div initial={{ y: -16, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} className="mt-8 rounded-[16px] bg-white/85 px-3.5 py-3 shadow-[0_4px_16px_-6px_rgb(0_0_0/0.25)] backdrop-blur">
                    <p className="flex justify-between text-[11px] text-black/50"><span className="font-semibold text-black/70">E-posta</span><span>şimdi</span></p>
                    <p className="mt-0.5 text-[12.5px] font-semibold">Ege Alüminyum: Fiyat teklifi TK-0318</p>
                    <p className="text-[12px] text-black/60">Teklifinizi görüntülemek ve onaylamak için…</p>
                  </motion.div>
                )}
              </AnimatePresence>
              {sent === 'no' && <p className="mt-auto pb-8 text-center text-[11.5px] text-black/40">Teklif gönderildiğinde burada görünür.</p>}
            </motion.div>
          ) : (
            <motion.div key="quote" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={T.slow} className="flex flex-1 flex-col bg-white px-5 pb-5 pt-5">
              <p className="text-[11px] text-black/50">Ege Alüminyum · TK-0318</p>
              <p className="mt-1 text-[17px] font-semibold leading-snug tracking-[-0.01em]">Bioklimatik pergola, 5 × 4 m</p>
              <p className="mt-1 text-[12px] text-black/60">Motorlu lamel, LED, RAL 7016 mat · montaj dahil</p>
              <div className="mt-5 rounded-[12px] bg-[#f3f5f5] px-4 py-3">
                <p className="text-[11px] text-black/50">Genel toplam, KDV dahil</p>
                <p className="x-num text-[24px] font-semibold tracking-[-0.02em]">{tl(total)}</p>
                <p className="mt-1 text-[11px] text-black/50">Teslim onaydan sonra 3 hafta</p>
              </div>
              <div className="mt-auto">
                <AnimatePresence mode="wait" initial={false}>
                  {approved ? (
                    <motion.p key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={T.base} className="flex flex-col items-center gap-2 py-2 text-center text-[13px]">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--x-ok)] text-white"><Check size={20} strokeWidth={2.5} /></span>
                      Teşekkürler. Montaj tarihi için sizi arayacağız.
                    </motion.p>
                  ) : (
                    <motion.div key="cta" exit={{ opacity: 0 }}>
                      <button type="button" onClick={onApprove} disabled={auto} className="relative h-12 w-full rounded-[12px] bg-[#1d2326] text-[15px] font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-80">
                        Teklifi onayla
                        {!auto && <span aria-hidden className="absolute -inset-1 animate-pulse rounded-[15px] shadow-[0_0_0_2px_var(--x-bronze-fill)] motion-reduce:animate-none" />}
                      </button>
                      <p className="mt-2 text-center text-[11px] text-black/45">Soru sormak için yanıtlayın</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
