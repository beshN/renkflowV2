'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Lock, ScanLine } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';
import { Swatch, T } from './primitives';

/**
 * Warehouse scanning as the factory does it: scan a package label (Code 128 / QR with the internal
 * RF-L code), scan the destination shelf (RF-R), confirm, and the move posts as two balanced ledger
 * lines. A physical bar lot moves whole; a reserved lot is refused. Labels are drawn with the same
 * JsBarcode and qrcode libraries the label centre prints with.
 */

type Lot = { code: string; profile: string; name: string; color: string; lengthMm: number; bars: number; from: string; reservedFor?: string };
const LOTS: Lot[] = [
  { code: 'RF-L-7C2A91E04B3F', profile: '6056', name: 'Lamel 200 mm', color: 'RAL 7016 Mat', lengthMm: 7000, bars: 12, from: 'Mal kabul' },
  { code: 'RF-L-1F08D3A5C6E2', profile: '6017', name: 'Taşıyıcı kiriş 100×150', color: 'RAL 9016 Mat', lengthMm: 7000, bars: 4, from: 'C2', reservedFor: 'RF-1041' },
];
const SHELVES = [
  { code: 'RF-R-B4A0C1D2E3F4', name: 'B4', fill: 0.45 },
  { code: 'RF-R-B3A0C1D2E3F5', name: 'B3', fill: 0.7 },
  { code: 'RF-R-A4A0C1D2E3F6', name: 'A4', fill: 0.2 },
];

type Step = 'lot' | 'shelf' | 'confirm' | 'posted';

export function Scanner() {
  const reduce = useReducedMotion();
  const [lotIndex, setLotIndex] = useState(0);
  const [step, setStep] = useState<Step>('lot');
  const [lot, setLot] = useState<Lot | null>(null);
  const [shelf, setShelf] = useState<(typeof SHELVES)[number] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [entry, setEntry] = useState('');
  const [ledger, setLedger] = useState<Array<{ id: number; text: string; qty: string; sign: '+' | '−' }>>([]);
  const [fills, setFills] = useState<Record<string, number>>(() => ({ A2: 0.8, A3: 0.55, B2: 0.35, ...Object.fromEntries(SHELVES.map((s) => [s.name, s.fill])) }));

  const target = step === 'lot' ? LOTS[lotIndex].code : step === 'shelf' ? SHELVES[0].code : '';
  useEffect(() => { setEntry(target); }, [target]);

  // A keyboard-wedge scanner types the code and sends Enter; the camera path resolves the same way.
  const resolve = (code: string) => {
    const c = code.trim().toUpperCase();
    setRefused(null);
    if (step === 'lot') {
      const found = LOTS.find((l) => l.code === c);
      if (!found) return setRefused('Bu kod bir paket etiketine ait değil.');
      if (found.reservedFor) return setRefused(`${found.code} ${found.reservedFor} için rezerve; rezerve lot taşınamaz.`);
      setLot(found);
      setStep('shelf');
    } else if (step === 'shelf') {
      const found = SHELVES.find((s) => s.code === c);
      if (!found) return setRefused('Bu kod bir raf etiketine ait değil.');
      setShelf(found);
      setStep('confirm');
    }
  };
  const scan = () => {
    if (scanning) return;
    setScanning(true);
    setTimeout(() => { setScanning(false); resolve(target); }, reduce ? 0 : 900);
  };
  const post = () => {
    if (!lot || !shelf) return;
    setFills((f) => ({ ...f, [shelf.name]: Math.min(1, (f[shelf.name] ?? 0) + 0.3) }));
    const id = Date.now();
    setLedger((l) => [{ id: id + 1, sign: '+' as const, qty: `${lot.bars} boy`, text: `${shelf.name} · ${lot.profile} ${lot.color}` }, { id, sign: '−' as const, qty: `${lot.bars} boy`, text: `${lot.from} · ${lot.profile} ${lot.color}` }, ...l].slice(0, 6));
    setStep('posted');
  };
  const again = (index: number) => { setLotIndex(index); setLot(null); setShelf(null); setRefused(null); setStep('lot'); };

  const label = step === 'lot' ? { kind: 'Paket', title: `${LOTS[lotIndex].profile} · ${LOTS[lotIndex].name}`, detail: `${LOTS[lotIndex].color} · ${LOTS[lotIndex].lengthMm.toLocaleString('tr-TR')} mm · ${LOTS[lotIndex].bars} boy`, code: LOTS[lotIndex].code }
    : { kind: 'Raf', title: `A blok · ${SHELVES[0].name}`, detail: 'Profil rafı, 3. kat', code: SHELVES[0].code };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[340px_1fr] lg:gap-10">
      {/* Phone */}
      <div className="mx-auto w-full max-w-[340px] rounded-[34px] bg-[var(--x-chrome)] p-2.5 shadow-[0_0_0_1px_rgb(0_0_0/0.25),0_40px_80px_-48px_rgb(10_14_16/0.7)]">
        <div className="flex min-h-[600px] flex-col overflow-hidden rounded-[26px] bg-[var(--x-surface)]">
          <div className="flex items-center justify-between bg-[var(--x-chrome-raised)] px-5 pb-3 pt-4 text-[var(--x-chrome-fg)]">
            <span className="text-[14px] font-medium">Depo · Okut</span>
            <span className="text-[11.5px] text-[var(--x-chrome-muted)]">{step === 'lot' ? '1/3 Paket' : step === 'shelf' ? '2/3 Hedef raf' : '3/3 Onay'}</span>
          </div>

          {/* Viewfinder */}
          <div className="relative mx-4 mt-4 aspect-[4/3] overflow-hidden rounded-[14px] bg-[#1b2124]">
            {(step === 'lot' || step === 'shelf') ? (
              <>
                <div className="absolute inset-0 grid place-items-center p-6">
                  <div className="w-[78%] rotate-[-2deg] opacity-90"><Label {...label} compact /></div>
                </div>
                <div aria-hidden className="pointer-events-none absolute inset-6 rounded-[10px] shadow-[0_0_0_999px_rgb(0_0_0/0.35)]" />
                {['left-5 top-5 border-l-2 border-t-2', 'right-5 top-5 border-r-2 border-t-2', 'left-5 bottom-5 border-b-2 border-l-2', 'right-5 bottom-5 border-b-2 border-r-2'].map((c) => <span key={c} aria-hidden className={cn('absolute h-5 w-5 rounded-[3px] border-white/85', c)} />)}
                <AnimatePresence>{scanning && <motion.span aria-hidden className="absolute inset-x-6 h-[2px] bg-[var(--x-bronze-fill)] shadow-[0_0_12px_var(--x-bronze-fill)]" initial={{ top: '18%' }} animate={{ top: ['18%', '82%', '18%'] }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: 'easeInOut' }} />}</AnimatePresence>
              </>
            ) : (
              <div className="grid h-full place-items-center text-center text-white/85">
                <div>
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--x-st-assembly)]"><Check size={22} strokeWidth={2.5} /></span>
                  <p className="mt-3 text-[13px]">{step === 'posted' ? 'Transfer kaydedildi' : 'İki etiket okundu'}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
            {(step === 'lot' || step === 'shelf') && (
              <>
                <form onSubmit={(e) => { e.preventDefault(); resolve(entry); }} className="flex gap-2">
                  <input aria-label="Kod (el terminali veya elle)" value={entry} onChange={(e) => setEntry(e.target.value)} className="x-mono h-10 min-w-0 flex-1 rounded-[8px] px-3 text-[12px] shadow-[inset_0_0_0_1px_var(--x-line)] outline-none focus:shadow-[inset_0_0_0_1px_var(--x-ink-2)] focus-visible:outline-none" />
                  <button type="submit" className="h-10 rounded-[8px] px-3 text-[12.5px] font-medium shadow-[inset_0_0_0_1px_var(--x-line-strong)] hover:bg-[var(--x-surface-hover)]">Gir</button>
                </form>
                <p className="mt-1.5 text-[11px] leading-4 text-[var(--x-faint)]">El terminali kodu yazıp Enter gönderir; kamera izin verilmezse elle girilir.</p>
                <AnimatePresence>{refused && <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={T.base} className="mt-3 flex items-start gap-2 rounded-[8px] bg-[rgb(180_67_47/0.08)] px-3 py-2 text-[12px] text-[var(--x-danger)]"><Lock size={13} className="mt-0.5 shrink-0" aria-hidden />{refused}</motion.p>}</AnimatePresence>
                {lot && step === 'shelf' && <LotCard lot={lot} />}
                <button type="button" onClick={scan} disabled={scanning} className="mt-auto flex h-12 items-center justify-center gap-2 rounded-[12px] bg-[var(--x-ink)] text-[15px] font-semibold text-[var(--x-surface)] transition-colors hover:bg-[var(--x-ink-2)] disabled:opacity-70">
                  <ScanLine size={17} aria-hidden />{scanning ? 'Okunuyor…' : step === 'lot' ? 'Paketi okut' : 'Rafı okut'}
                </button>
              </>
            )}
            {step === 'confirm' && lot && shelf && (
              <>
                <LotCard lot={lot} />
                <div className="mt-3 flex items-center justify-between rounded-[10px] px-3 py-3 text-[13px] shadow-[inset_0_0_0_1px_var(--x-line)]">
                  <span>{lot.from}</span><ArrowRight size={15} className="text-[var(--x-faint)]" aria-hidden /><span className="font-semibold">{shelf.name}</span>
                </div>
                <p className="mt-2 text-[11.5px] leading-4 text-[var(--x-muted)]">Fiziksel çubuklar tüm boyuyla taşınır: {lot.bars} boy × {lot.lengthMm.toLocaleString('tr-TR')} mm.</p>
                <button type="button" onClick={post} className="mt-auto h-12 rounded-[12px] bg-[var(--x-ink)] text-[15px] font-semibold text-[var(--x-surface)] hover:bg-[var(--x-ink-2)]">Transferi kaydet</button>
              </>
            )}
            {step === 'posted' && (
              <>
                <p className="text-[13px] text-[var(--x-ink-2)]">Raf bakiyesi güncellendi. Kayıt silinmez; geri almak için ters transfer yapılır.</p>
                <div className="mt-auto grid gap-2">
                  <button type="button" onClick={() => again(1)} className="h-11 rounded-[12px] text-[14px] font-medium shadow-[inset_0_0_0_1px_var(--x-line-strong)] hover:bg-[var(--x-surface-hover)]">Rezerve bir paketi deneyin</button>
                  <button type="button" onClick={() => again(0)} className="h-11 rounded-[12px] bg-[var(--x-ink)] text-[14px] font-semibold text-[var(--x-surface)] hover:bg-[var(--x-ink-2)]">Yeni okutma</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Label as printed, rack, ledger */}
      <div className="grid gap-6">
        <div className="grid gap-6 sm:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="mb-2 flex justify-between text-[12px]"><span className="font-medium">Etiket, 100 × 70 mm</span><span className="text-[var(--x-muted)]">Code 128 ve QR aynı kodu taşır</span></p>
            <Label {...label} />
          </div>
          <div>
            <p className="mb-2 text-[12px] font-medium">A blok · raf doluluğu</p>
            <div className="grid grid-cols-3 gap-1.5 rounded-[var(--x-r-panel)] bg-[var(--x-surface)] p-3 shadow-[var(--x-shadow-raise)]">
              {['A2', 'A3', 'A4', 'B2', 'B3', 'B4'].map((name) => {
                const f = fills[name] ?? 0;
                const hit = shelf?.name === name;
                return (
                  <div key={name} className={cn('relative aspect-[4/3] overflow-hidden rounded-[4px] bg-[var(--x-surface-sunk)] shadow-[inset_0_0_0_1px_var(--x-line)]', hit && 'shadow-[inset_0_0_0_2px_var(--x-bronze-fill)]')}>
                    <motion.span className="absolute inset-x-0 bottom-0 bg-[var(--x-ink-2)] opacity-[0.16]" initial={false} animate={{ height: `${f * 100}%` }} transition={T.slow} />
                    <span className="x-mono absolute left-1.5 top-1 text-[10px] text-[var(--x-ink-2)]">{name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div>
          <p className="mb-2 flex justify-between text-[12px]"><span className="font-medium">Konum hareketleri</span><span className="text-[var(--x-muted)]">her transfer iki dengeli satır</span></p>
          <ul className="overflow-hidden rounded-[var(--x-r-panel)] bg-[var(--x-surface)] text-[12.5px] shadow-[var(--x-shadow-raise)]" aria-live="polite">
            {ledger.length === 0 && <li className="px-4 py-4 text-[var(--x-muted)]">Henüz hareket yok. Telefonda paketi ve rafı okutun.</li>}
            <AnimatePresence initial={false}>
              {ledger.map((row) => (
                <motion.li key={row.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={T.base} className="grid grid-cols-[22px_1fr_auto] items-center gap-2 border-b border-[var(--x-line)] px-4 py-2.5 last:border-0">
                  <span className={cn('x-num font-semibold', row.sign === '+' ? 'text-[var(--x-ok)]' : 'text-[var(--x-muted)]')}>{row.sign}</span>
                  <span className="truncate">{row.text}</span>
                  <span className="x-num text-[var(--x-ink-2)]">{row.qty}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </div>
  );
}

function LotCard({ lot }: { lot: Lot }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={T.base} className="mt-3 rounded-[10px] px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--x-line)]">
      <p className="x-mono text-[11px] text-[var(--x-bronze)]">{lot.code}</p>
      <p className="mt-0.5 text-[13.5px] font-medium">{lot.profile} · {lot.name}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[12px] text-[var(--x-ink-2)]"><Swatch color={lot.color} /><span className="x-num">{lot.bars} boy · {lot.lengthMm.toLocaleString('tr-TR')} mm</span><span className="text-[var(--x-muted)]">{lot.from}</span></p>
    </motion.div>
  );
}

/** Black on white with quiet zones, human-readable code under the bars, as the label centre prints. */
function Label({ kind, title, detail, code, compact = false }: { kind: string; title: string; detail: string; code: string; compact?: boolean }) {
  const bars = useRef<SVGSVGElement>(null);
  const [qr, setQr] = useState('');
  useEffect(() => {
    let alive = true;
    try { if (bars.current) JsBarcode(bars.current, code, { format: 'CODE128', width: 1.4, height: compact ? 30 : 40, displayValue: false, margin: 10, background: '#ffffff', lineColor: '#000000' }); } catch { /* the code text stays readable */ }
    QRCode.toDataURL(`https://renkflow.com/production/worker?code=${encodeURIComponent(code)}`, { width: 240, margin: 4, errorCorrectionLevel: 'M' }).then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [code, compact]);
  return (
    <div className="aspect-[10/7] w-full rounded-[6px] bg-white p-[5%] text-black shadow-[0_0_0_1px_rgb(0_0_0/0.12),0_8px_20px_-12px_rgb(0_0_0/0.35)]" role="img" aria-label={`${kind} etiketi ${code}`}>
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={cn('font-medium text-black/60', compact ? 'text-[7px]' : 'text-[9px]')}>{kind} · Ege Alüminyum</p>
            <p className={cn('mt-0.5 truncate font-semibold leading-tight', compact ? 'text-[10px]' : 'text-[14px]')}>{title}</p>
            <p className={cn('mt-0.5 truncate text-black/70', compact ? 'text-[8px]' : 'text-[11px]')}>{detail}</p>
          </div>
          {qr ? <img src={qr} alt="" className={cn('shrink-0', compact ? 'h-10 w-10' : 'h-[72px] w-[72px]')} /> : <span className={cn('shrink-0 bg-black/5', compact ? 'h-10 w-10' : 'h-[72px] w-[72px]')} />}
        </div>
        <div className="mt-auto">
          <svg ref={bars} className="block h-auto w-full" />
          <p className={cn('x-mono text-center tracking-[0.08em]', compact ? 'text-[7.5px]' : 'text-[11px]')}>{code}</p>
        </div>
      </div>
    </div>
  );
}
