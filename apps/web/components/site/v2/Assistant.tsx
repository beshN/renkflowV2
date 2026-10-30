'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowUpRight, Check, ClipboardList, PackageX, Search, Send, Sparkles, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmt, ORDERS, planOrder, tl } from './model';
import { T, Tabs } from './primitives';

/**
 * The workspace assistant: checks it runs on its own when a screen opens, and a chat that answers
 * from the company's records within the asker's role. A draft order goes to human review; the model
 * never creates a confirmed order. Answers here are computed from the page's sample data.
 */

type Role = 'manager' | 'office' | 'accountant';
type Msg = { id: number; from: 'me' | 'ai'; text: string; tool?: string; draft?: boolean; links?: string[]; denied?: boolean };

const OVERDUE = { icon: Timer, tone: 'warn' as const, title: 'RF-1038 termini geçti', detail: 'Çam Konutları · termin 11 Kas, montaj aşamasında', link: 'Siparişe git' };
const BLOCKED = { icon: PackageX, tone: 'warn' as const, title: 'RF-1041 kesime geçemiyor', detail: '6056 lamel, RAL 9016 Mat: 24 profil eksik', link: 'Satın almaya git' };
const COUNT = { icon: ClipboardList, tone: 'info' as const, title: 'B4 rafında bekleyen sayım', detail: 'Gönderildi, yönetici onayı bekliyor', link: 'Sayıma git' };
const UNPLACED = { icon: AlertTriangle, tone: 'info' as const, title: '3 paket yerleştirilmemiş', detail: 'Mal kabulde bekliyor, raf atanmadı', link: 'Depoya git' };
const SHIPMENTS = { icon: ClipboardList, tone: 'info' as const, title: 'Bu hafta 3 sevkiyat', detail: 'RF-1042, RF-1041, RF-1040 · araç planı hazır', link: 'Sevkiyata git' };
const CHECKS: Record<Role, Array<typeof OVERDUE | typeof COUNT>> = {
  manager: [OVERDUE, BLOCKED, COUNT, UNPLACED],
  office: [OVERDUE, BLOCKED, UNPLACED, SHIPMENTS],
  accountant: [OVERDUE, SHIPMENTS],
};
const ROLE_LABEL: Record<Role, string> = { manager: 'yönetici', office: 'ofis', accountant: 'muhasebe' };
const QUESTIONS = ['Bu hafta hangi siparişler sevk edilecek?', 'Kasım tahsilatı ne durumda?', 'Liman Otel için 6 × 5 m iki pergolalık sipariş taslağı hazırla.'];

function answer(q: string, role: Role): Omit<Msg, 'id' | 'from'> {
  if (/sevk/i.test(q)) {
    const week = ORDERS.filter((o) => ['14 Kas', '16 Kas', '18 Kas'].includes(o.due));
    return { tool: 'search_workspace · siparişler, termin 12–18 Kas', links: week.map((o) => o.id), text: `Bu hafta termini olan ${week.length} sipariş var: ${week.map((o) => `${o.id} ${o.customer} (${o.due})`).join(', ')}. RF-1041 için 6056 lamel eksik olduğundan 16 Kas sevki risk altında; satın alma talebi henüz açılmadı.` };
  }
  if (/tahsilat/i.test(q)) {
    if (role === 'office') return { denied: true, text: 'Finans bilgileri ofis rolüyle görünmüyor. Bu bir yetki sınırı; kayıtların olmadığı anlamına gelmez.' };
    return { tool: 'search_workspace · tahsilatlar, Kasım', text: 'Kasım’da açılan siparişlerin toplamı ₺1.183.243, bugüne kadar tahsil edilen ₺412.800. Sipariş tutarı tahsil edilmiş nakit değildir; kalan bakiye siparişlerin üzerinde. En büyük açık bakiye RF-1041 Yalı Restoran’da.' };
  }
  if (/tasla[kğ]/i.test(q)) {
    if (role === 'accountant') return { denied: true, text: 'Muhasebe rolü siparişleri görüntüleyebilir ama oluşturamaz; taslak hazırlayamam. Ofisten birinden isteyebilirsiniz.' };
    return { tool: 'search_workspace · müşteriler “Liman Otel”', draft: true, text: 'Liman Otel (Kuşadası) için taslağı hazırladım. Fiyatı ürün kartındaki m² fiyatından hesapladım; renk belirtilmediği için müşterinin son siparişindeki RAL 7037 Mat’ı yazdım. İnceleyip onaylarsanız taslak insan incelemesine gider.' };
  }
  return { text: 'Bu sayfadaki örnek yalnız önerilen sorulara yanıt veriyor. Uygulamada asistan firmanızın kayıtlarında arama yapar.' };
}

export function Assistant() {
  const reduce = useReducedMotion();
  const [role, setRole] = useState<Role>('manager');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState<{ id: number; shown: number } | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [draftState, setDraftState] = useState<'open' | 'sent' | 'dropped'>('open');
  const list = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { list.current?.scrollTo?.({ top: list.current.scrollHeight, behavior: reduce ? 'auto' : 'smooth' }); }, [msgs, typing, thinking, reduce]);
  const draft = useMemo(() => planOrder({ widthMm: 6000, projectionMm: 5000, heightMm: 2800, color: 'RAL 7037 Mat', motor: true, led: false, quantity: 2 }, 'draft'), []);

  const ask = (q: string) => {
    if (!q.trim() || thinking || typing) return;
    const id = Date.now();
    const a = answer(q, role);
    setMsgs((m) => [...m, { id, from: 'me', text: q }]);
    setInput('');
    setThinking(a.tool ?? (a.denied ? 'yetki kontrolü' : null));
    const start = () => {
      setThinking(null);
      setMsgs((m) => [...m, { id: id + 1, from: 'ai', ...a }]);
      if (a.draft) setDraftState('open');
      if (reduce) return;
      setTyping({ id: id + 1, shown: 0 });
      const step = (n: number) => {
        if (n >= a.text.length) { setTyping(null); return; }
        setTyping({ id: id + 1, shown: n });
        timers.current.push(setTimeout(() => step(n + 3), 12));
      };
      step(0);
    };
    timers.current.push(setTimeout(start, reduce ? 0 : 900));
  };
  const switchRole = (r: Role) => { timers.current.forEach(clearTimeout); setRole(r); setMsgs([]); setTyping(null); setThinking(null); };

  return (
    <div className="x-window grid text-[var(--x-ink)] lg:grid-cols-[320px_1fr]">
      {/* Checks it runs by itself */}
      <div className="border-b border-[var(--x-line)] bg-[var(--x-surface-sunk)] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--x-line)] px-4 py-2.5">
          <span className="text-[12px] font-medium">Soran</span>
          <Tabs id="as-role" label="Rol" variant="segmented" size="sm" value={role} onChange={switchRole} items={[{ key: 'manager', label: 'Yönetici' }, { key: 'office', label: 'Ofis' }, { key: 'accountant', label: 'Muhasebe' }]} />
        </div>
        <div className="px-4 py-4">
          <p className="flex items-center justify-between text-[12px]"><span className="flex items-center gap-1.5 font-medium"><Sparkles size={13} aria-hidden /> Günün kontrolleri</span><span className="text-[var(--x-faint)]">12 Kas, 08:30</span></p>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.ul key={role} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={T.base} className="mt-3 space-y-2">
              {CHECKS[role].map((c) => (
                <li key={c.title} className="group rounded-[var(--x-r-panel)] bg-[var(--x-surface)] px-3 py-2.5 shadow-[var(--x-shadow-raise)]">
                  <p className="flex items-start gap-2 text-[12.5px] font-medium"><c.icon size={13} className={cn('mt-0.5 shrink-0', c.tone === 'warn' ? 'text-[var(--x-danger)]' : 'text-[var(--x-muted)]')} aria-hidden />{c.title}</p>
                  <p className="mt-0.5 pl-[21px] text-[11.5px] text-[var(--x-muted)]">{c.detail}</p>
                  <p className="mt-1.5 flex items-center gap-1 pl-[21px] text-[11.5px] font-medium text-[var(--x-ink-2)]">{c.link}<ArrowUpRight size={11} className="transition-transform duration-[120ms] group-hover:-translate-y-px group-hover:translate-x-px" aria-hidden /></p>
                </li>
              ))}
            </motion.ul>
          </AnimatePresence>
          <p className="mt-3 text-[11px] leading-4 text-[var(--x-faint)]">Kontroller model olmadan da çalışır; bağlantılar yalnız rolün açabildiği ekranlara gider.</p>
        </div>
      </div>

      {/* Chat */}
      <div className="flex h-[520px] flex-col bg-[var(--x-surface)]">
        <div ref={list} className="flex-1 space-y-3 overflow-y-auto px-5 py-4 [scrollbar-width:thin]" aria-live="polite">
          {msgs.length === 0 && (
            <div className="pt-6 text-center">
              <p className="text-[13px] font-medium">Siparişler, üretim, stok ve finans hakkında sorun.</p>
              <p className="mt-1 text-[12px] text-[var(--x-muted)]">Yanıtlar {ROLE_LABEL[role]} rolünün görebildiği kayıtlardan gelir.</p>
            </div>
          )}
          {msgs.map((m) => {
            const shown = typing?.id === m.id ? m.text.slice(0, typing.shown) : m.text;
            const done = typing?.id !== m.id;
            return m.from === 'me' ? (
              <motion.p key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={T.base} className="ml-auto w-fit max-w-[80%] rounded-[12px] rounded-br-[4px] bg-[var(--x-ink)] px-3.5 py-2 text-[13px] text-[var(--x-surface)]">{m.text}</motion.p>
            ) : (
              <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={T.base} className="max-w-[88%]">
                {m.tool && <p className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--x-faint)]"><Search size={11} aria-hidden />{m.tool}</p>}
                <div className={cn('rounded-[12px] rounded-bl-[4px] px-3.5 py-2.5 text-[13px] leading-[1.55]', m.denied ? 'bg-[rgb(180_67_47/0.07)] text-[var(--x-ink-2)]' : 'bg-[var(--x-surface-sunk)] shadow-[inset_0_0_0_1px_var(--x-line)]')}>{shown}</div>
                {done && m.links && <div className="mt-1.5 flex flex-wrap gap-1.5">{m.links.map((l) => <span key={l} className="x-mono rounded-[4px] px-1.5 py-0.5 text-[11px] text-[var(--x-bronze)] shadow-[inset_0_0_0_1px_var(--x-line)]">{l}</span>)}</div>}
                {done && m.draft && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={T.slow} className="mt-2 rounded-[var(--x-r-panel)] p-3 shadow-[var(--x-shadow-raise)]">
                    <p className="flex justify-between text-[12px]"><span className="font-medium">Sipariş taslağı · Liman Otel</span><span className="text-[var(--x-muted)]">onayınızla oluşur</span></p>
                    <ul className="mt-2 space-y-1 text-[12px]">
                      <li className="flex justify-between"><span className="text-[var(--x-ink-2)]">2 × Bioklimatik pergola, 6.000 × 5.000 · RAL 7037 Mat</span></li>
                      <li className="flex justify-between"><span className="text-[var(--x-ink-2)]">Lamel motoru dahil · montaj yüksekliği {fmt(2800)} mm</span></li>
                      <li className="flex justify-between border-t border-[var(--x-line)] pt-1.5 font-semibold"><span>Toplam, KDV dahil</span><span className="x-num">{tl(draft.totals.totalAmount)}</span></li>
                    </ul>
                    <div className="mt-2.5 flex items-center justify-end gap-2">
                      {draftState === 'open' ? (
                        <>
                          <button type="button" className="x-ctl" onClick={() => setDraftState('dropped')}>Vazgeç</button>
                          <button type="button" className="x-ctl x-ctl-ink" onClick={() => setDraftState('sent')}>İncelemeye gönder</button>
                        </>
                      ) : (
                        <span className={cn('flex items-center gap-1.5 text-[12px] font-medium', draftState === 'sent' ? 'text-[var(--x-ok)]' : 'text-[var(--x-muted)]')}>{draftState === 'sent' ? <><Check size={13} aria-hidden /> Taslak SD-0412 incelemede; onaylı sipariş yalnız bir kişi onaylayınca oluşur.</> : 'Taslak kaydedilmedi.'}</span>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
          {thinking && <p className="flex items-center gap-2 text-[12px] text-[var(--x-muted)]"><span className="flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 animate-bounce rounded-full bg-[var(--x-faint)] motion-reduce:animate-none" style={{ animationDelay: `${i * 120}ms` }} />)}</span>{thinking}</p>}
        </div>
        <div className="border-t border-[var(--x-line)] px-4 pb-4 pt-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUESTIONS.map((q) => (
              <button key={q} type="button" onClick={() => ask(q)} disabled={Boolean(thinking || typing)} className="rounded-full px-2.5 py-1 text-left text-[11.5px] text-[var(--x-ink-2)] shadow-[inset_0_0_0_1px_var(--x-line)] transition-colors duration-[120ms] hover:bg-[var(--x-surface-hover)] disabled:opacity-50">{q}</button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Asistana sorun" aria-label="Asistana sorun" className="h-9 min-w-0 flex-1 rounded-[var(--x-r-control)] px-3 text-[13px] shadow-[inset_0_0_0_1px_var(--x-line)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--x-ink-2)] focus-visible:outline-none" />
            <button type="submit" aria-label="Gönder" disabled={!input.trim()} className="grid h-9 w-9 place-items-center rounded-[var(--x-r-control)] bg-[var(--x-ink)] text-[var(--x-surface)] disabled:opacity-40"><Send size={14} /></button>
          </form>
        </div>
      </div>
    </div>
  );
}
