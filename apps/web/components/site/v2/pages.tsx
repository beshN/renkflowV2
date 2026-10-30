'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Check, Mail, Minus, Plus } from 'lucide-react';
import { ACTIONS, ACTION_LABELS, BASE_CAPS, BASE_HIDDEN, FIELD_LABELS, MODULES, MODULE_LABELS } from '@/lib/security/access-matrix';
import type { ChangeKind, ChangelogEntry } from '@/lib/core/changelog';
import { ProfileDrawing } from '@/components/brand/ProfileDrawing';
import { cn } from '@/lib/utils';
import { barsByItem, fmt, hours, ITEMS, ORDERS, planOrder, STOCK, tl } from './model';
import { BarRow } from './CutBars';
import { StageLabel, StageStrip, Swatch, T, Tabs } from './primitives';
import { CopyButton } from './blocks';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/* ------------------------------------------------------------------ Features */

const FEATURE_KEYS = ['orders', 'cutting', 'production', 'warehouse', 'purchasing', 'finance'] as const;
type FeatureKey = (typeof FEATURE_KEYS)[number];

/**
 * Module explorer: the six modules on the left, a working preview of each on the right, computed
 * with the same engines and sample data as the home page. Arrow keys move between modules.
 */
export function FeatureExplorer({ items }: { items: ReadonlyArray<{ title: string; detail: string }> }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<FeatureKey>('orders');
  const index = FEATURE_KEYS.indexOf(active);
  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + FEATURE_KEYS.length) % FEATURE_KEYS.length;
    setActive(FEATURE_KEYS[next]);
    document.getElementById(`feat-tab-${FEATURE_KEYS[next]}`)?.focus();
  };
  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr] lg:gap-12">
      <LayoutGroup id="features">
        <div role="tablist" aria-label="Modüller" aria-orientation="vertical" className="border-t border-[var(--x-line)]">
          {items.slice(0, 6).map((item, i) => {
            const on = i === index;
            return (
              <button key={item.title} id={`feat-tab-${FEATURE_KEYS[i]}`} role="tab" type="button" aria-selected={on} aria-controls="feat-panel" tabIndex={on ? 0 : -1} onClick={() => setActive(FEATURE_KEYS[i])} onKeyDown={(e) => onKey(e, i)} className="relative block w-full border-b border-[var(--x-line)] py-4 pl-5 pr-3 text-left">
                {on && <motion.span layoutId="feat-mark" transition={reduce ? { duration: 0 } : T.indicator} className="absolute inset-y-3 left-0 w-[2px] rounded-full bg-[var(--x-bronze-fill)]" />}
                <span className={cn('block text-[16px] font-medium transition-colors', on ? 'text-[var(--x-ink)]' : 'text-[var(--x-muted)] hover:text-[var(--x-ink)]')}>{item.title}</span>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.span initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }} className="block overflow-hidden">
                      <span className="block pt-1.5 text-[14px] leading-[1.65] text-[var(--x-muted)]">{item.detail}</span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
      <div id="feat-panel" role="tabpanel" aria-labelledby={`feat-tab-${active}`} className="x-window min-h-[420px] self-start text-[var(--x-ink)]">
        <div className="flex items-center justify-between border-b border-[var(--x-line)] bg-[var(--x-surface-sunk)] px-4 py-2.5 text-[12px]">
          <span className="font-medium">{items[index]?.title}</span>
          <span className="text-[var(--x-faint)]">Örnek veri</span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={reduce ? { duration: 0 } : T.slow} className="p-5">
            <FeaturePreview kind={active} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function FeaturePreview({ kind }: { kind: FeatureKey }) {
  const order = ORDERS[0];
  const plan = useMemo(() => planOrder(order.spec, order.id), [order]);
  if (kind === 'orders') {
    return (
      <div>
        <ul className="text-[13px]">
          {ORDERS.slice(0, 5).map((o) => (
            <li key={o.id} className="grid grid-cols-[72px_1fr_auto] items-center gap-3 border-b border-[var(--x-line)] py-2.5 last:border-0">
              <span className="x-mono text-[var(--x-bronze)]">{o.id}</span>
              <span className="min-w-0"><span className="block truncate font-medium">{o.customer}</span><span className="flex items-center gap-2 text-[11.5px] text-[var(--x-muted)]"><span className="x-num whitespace-nowrap">{fmt(o.spec.widthMm)} × {fmt(o.spec.projectionMm)}</span><Swatch color={o.spec.color} className="max-sm:[&>span:last-child]:hidden" /></span></span>
              <StageLabel stage={o.stage} />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12px] text-[var(--x-muted)]">RF-1042 · aşama</p>
        <StageStrip stage={order.stage} className="mt-2" />
      </div>
    );
  }
  if (kind === 'cutting') {
    const groups = barsByItem(plan.bars);
    return (
      <div>
        <p className="flex justify-between text-[12.5px]"><span className="font-medium">RF-1042 · {fmt(order.spec.widthMm)} × {fmt(order.spec.projectionMm)}</span><span className="x-num text-[var(--x-muted)]">{plan.bars.length} profil · %{fmt(plan.cut.wastePercent, 1)} fire</span></p>
        <div className="mt-4 space-y-4">
          {groups.map(({ item, bars }) => (
            <div key={item.id}>
              <p className="mb-1.5 flex justify-between text-[12px]"><span>{item.code} · {item.name}</span><span className="x-num text-[var(--x-muted)]">{bars.length} profil</span></p>
              <BarRow bar={bars[0]} scale={7000} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === 'production') {
    return (
      <div>
        <ol>
          {plan.recipe.operations.map((op, i) => (
            <li key={op.name} className="grid grid-cols-[20px_1fr_auto] items-center gap-3 border-b border-[var(--x-line)] py-3 last:border-0">
              <span className={cn('grid h-4 w-4 place-items-center rounded-full', i === 0 ? 'shadow-[inset_0_0_0_1.5px_var(--x-bronze-fill)]' : 'shadow-[inset_0_0_0_1px_var(--x-line-strong)]')}>{i === 0 && <span className="h-1.5 w-1.5 rounded-full bg-[var(--x-bronze-fill)]" />}</span>
              <span><span className="block text-[13.5px] font-medium">{op.name}</span><span className="text-[11.5px] text-[var(--x-muted)]">{op.workCenterCode} · {i === 0 ? 'Kesim istasyonu 1 · Hakan T.' : 'Sırada'}</span></span>
              <span className="x-num text-[12.5px] text-[var(--x-ink-2)]">{Math.round(op.plannedMinutes)} dk</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex justify-between border-t border-[var(--x-line)] pt-3 text-[12.5px]"><span className="text-[var(--x-muted)]">Planlanan süre · reçete {plan.recipe.recipeCode}</span><span className="x-num font-medium">{hours(plan.minutes)}</span></p>
      </div>
    );
  }
  if (kind === 'warehouse') {
    return (
      <table className="w-full text-[13px]">
        <thead className="text-[11.5px] text-[var(--x-muted)]"><tr className="[&>th]:pb-2 [&>th]:text-left [&>th]:font-normal"><th>Profil</th><th>Renk</th><th>Raf</th><th className="!text-right">Serbest</th></tr></thead>
        <tbody>
          {STOCK.slice(0, 6).map((s) => (
            <tr key={`${s.item}-${s.color}`} className="border-t border-[var(--x-line)] [&>td]:py-2.5">
              <td><span className="x-mono text-[var(--x-bronze)]">{ITEMS[s.item].code}</span> <span className="text-[var(--x-ink-2)] max-sm:hidden">{ITEMS[s.item].name}</span></td>
              <td><Swatch color={s.color} /></td>
              <td className="x-mono text-[var(--x-ink-2)]">{s.rack}</td>
              <td className={cn('x-num text-right', s.bars - s.reserved === 0 && 'text-[var(--x-danger)]')}>{s.bars - s.reserved} / {s.bars}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (kind === 'purchasing') {
    return (
      <div className="space-y-4 text-[13px]">
        <div className="rounded-[var(--x-r-panel)] p-3.5 shadow-[var(--x-shadow-raise)]">
          <p className="flex justify-between"><span className="font-medium">Satın alma önerisi</span><span className="text-[var(--x-danger)]">24 profil eksik</span></p>
          <p className="mt-1 text-[12px] text-[var(--x-muted)]">RF-1041 Yalı Restoran · 6056 Lamel 200 mm · RAL 9016 Mat</p>
        </div>
        <div className="rounded-[var(--x-r-panel)] p-3.5 shadow-[var(--x-shadow-raise)]">
          <p className="flex justify-between"><span className="font-medium"><span className="x-mono text-[var(--x-bronze)]">SA-0318</span> · Ege Profil</span><span className="text-[var(--x-muted)]">kısmi teslim</span></p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--x-line)]"><motion.span className="block h-full rounded-full bg-[var(--x-ink-2)]" initial={{ width: 0 }} animate={{ width: '50%' }} transition={{ duration: 0.6, ease: EASE }} /></div>
          <p className="mt-2 flex justify-between text-[12px] text-[var(--x-muted)]"><span>Mal kabul: 12 / 24 profil</span><span>Kalan 12 · 18 Kas</span></p>
        </div>
        <p className="text-[12px] text-[var(--x-muted)]">Gelen paketler mal kabulde okutulur, stoğa ve siparişin rezervine yazılır.</p>
      </div>
    );
  }
  const paid = plan.totals.totalAmount * 0.4;
  return (
    <div className="text-[13px]">
      {plan.lines.map((l) => <p key={l.label} className="flex justify-between border-b border-[var(--x-line)] py-2"><span className="text-[var(--x-ink-2)]">{l.label}</span><span className="x-num">{tl(l.unitPrice * l.quantity)}</span></p>)}
      <p className="flex justify-between py-2 font-semibold"><span>Toplam, KDV dahil</span><span className="x-num">{tl(plan.totals.totalAmount)}</span></p>
      <div className="mt-3 rounded-[var(--x-r-panel)] p-3.5 shadow-[var(--x-shadow-raise)]">
        <p className="flex justify-between"><span>Tahsil edilen · kapora</span><span className="x-num text-[var(--x-ok)]">{tl(paid)}</span></p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--x-line)]"><motion.span className="block h-full rounded-full bg-[var(--x-ok)]" initial={{ width: 0 }} animate={{ width: '40%' }} transition={{ duration: 0.6, ease: EASE }} /></div>
        <p className="mt-2 flex justify-between text-[12px] text-[var(--x-muted)]"><span>Kalan bakiye</span><span className="x-num">{tl(plan.totals.totalAmount - paid)}</span></p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Pricing */

const SCOPE_MODULES = ['Sipariş ve teklif', 'Kesim planı', 'Üretim ve usta ekranı', 'Depo ve barkod', 'Satın alma ve mal kabul', 'Finans ve tahsilat', 'AI ofis', 'Asistan'] as const;

/**
 * Builds a quote request: modules, office and workshop users, help with the switch. Prices are not
 * shown (every quote is prepared by hand); the summary goes out as an e-mail the visitor reviews.
 */
export function ScopeBuilder({ email }: { email: string }) {
  const reduce = useReducedMotion();
  const [mods, setMods] = useState<string[]>(['Sipariş ve teklif', 'Kesim planı', 'Depo ve barkod']);
  const [office, setOffice] = useState(4);
  const [shop, setShop] = useState(6);
  const [migration, setMigration] = useState(true);
  const [training, setTraining] = useState(true);
  const toggle = (m: string) => setMods((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]));
  const summary = [
    `Modüller: ${mods.length ? mods.join(', ') : 'henüz seçilmedi'}`,
    `Ofis kullanıcısı: ${office}`,
    `Atölye kullanıcısı: ${shop}`,
    `Veri aktarımı: ${migration ? 'istiyorum' : 'gerek yok'}`,
    `Ekip eğitimi: ${training ? 'istiyorum' : 'gerek yok'}`,
  ];
  const href = `mailto:${email}?subject=${encodeURIComponent('RenkFlow teklif talebi')}&body=${encodeURIComponent(`Merhaba,\n\nAşağıdaki kapsam için teklif rica ediyorum.\n\n${summary.join('\n')}\n\nFirma:\nTelefon:\n`)}`;
  const Stepper = ({ label, value, set, max }: { label: string; value: number; set: (n: number) => void; max: number }) => (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-[14px]">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={`${label} azalt`} disabled={value <= 0} onClick={() => set(Math.max(0, value - 1))} className="grid h-8 w-8 place-items-center rounded-[var(--x-r-control)] shadow-[inset_0_0_0_1px_var(--x-line-strong)] hover:bg-[var(--x-surface-hover)] disabled:opacity-40"><Minus size={13} /></button>
        <span className="relative w-10 overflow-hidden text-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={value} initial={{ y: reduce ? 0 : 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: reduce ? 0 : -12, opacity: 0 }} transition={{ duration: 0.16 }} className="x-num block text-[15px] font-semibold" aria-live="polite">{value}</motion.span>
          </AnimatePresence>
        </span>
        <button type="button" aria-label={`${label} artır`} disabled={value >= max} onClick={() => set(Math.min(max, value + 1))} className="grid h-8 w-8 place-items-center rounded-[var(--x-r-control)] shadow-[inset_0_0_0_1px_var(--x-line-strong)] hover:bg-[var(--x-surface-hover)] disabled:opacity-40"><Plus size={13} /></button>
      </span>
    </div>
  );
  const Toggle = ({ label, detail, on, set }: { label: string; detail: string; on: boolean; set: (v: boolean) => void }) => (
    <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className="flex w-full items-center justify-between gap-4 py-3 text-left">
      <span><span className="block text-[14px]">{label}</span><span className="block text-[12.5px] text-[var(--x-muted)]">{detail}</span></span>
      <span className={cn('relative h-[20px] w-9 shrink-0 rounded-full transition-colors duration-200', on ? 'bg-[var(--x-ink-2)]' : 'bg-[var(--x-line-strong)]')}><motion.span className="absolute top-[3px] h-[14px] w-[14px] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]" initial={false} animate={{ left: on ? 19 : 3 }} transition={T.indicator} /></span>
    </button>
  );
  return (
    <div className="grid gap-px overflow-hidden rounded-[var(--x-r-window)] bg-[var(--x-line)] shadow-[0_0_0_1px_var(--x-line),0_32px_64px_-48px_rgb(20_26_28/0.35)] lg:grid-cols-[1.3fr_1fr]">
      <div className="bg-[var(--x-surface)] p-6">
        <fieldset>
          <legend className="text-[13px] font-medium">Hangi modüller?</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {SCOPE_MODULES.map((m) => {
              const on = mods.includes(m);
              return (
                <button key={m} type="button" aria-pressed={on} onClick={() => toggle(m)} className={cn('inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-[background-color,color,box-shadow] duration-200', on ? 'bg-[var(--x-ink)] text-[var(--x-surface)]' : 'text-[var(--x-ink-2)] shadow-[inset_0_0_0_1px_var(--x-line-strong)] hover:bg-[var(--x-surface-hover)]')}>
                  <AnimatePresence initial={false}>{on && <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: 14, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden"><Check size={13} strokeWidth={2.5} /></motion.span>}</AnimatePresence>
                  {m}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="mt-6 divide-y divide-[var(--x-line)] border-y border-[var(--x-line)]">
          <Stepper label="Ofis kullanıcısı" value={office} set={setOffice} max={50} />
          <Stepper label="Atölye kullanıcısı" value={shop} set={setShop} max={80} />
          <Toggle label="Veri aktarımı" detail="Müşteri, ürün ve stok listelerinizi biz aktaralım." on={migration} set={setMigration} />
          <Toggle label="Ekip eğitimi" detail="Ofis ve atölye için kurulumda yerinde ya da çevrimiçi." on={training} set={setTraining} />
        </div>
      </div>
      <div className="flex flex-col bg-[var(--x-surface-sunk)] p-6">
        <p className="text-[13px] font-medium">Talep özetiniz</p>
        <ul className="mt-3 space-y-2 text-[13.5px]">
          {summary.map((line) => {
            const [k, v] = line.split(': ');
            return <li key={k} className="flex justify-between gap-4 border-b border-[var(--x-line)] pb-2"><span className="text-[var(--x-muted)]">{k}</span><motion.span key={v} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="text-right">{v}</motion.span></li>;
          })}
        </ul>
        <p className="mt-4 text-[12.5px] leading-5 text-[var(--x-muted)]">Fiyat, bu kapsama göre elle hazırlanır ve teklifte modüller, kullanıcı sayısı ve destek ayrı ayrı yazar.</p>
        <a href={href} className="x-btn x-btn-primary mt-auto w-full !mt-6"><Mail size={15} aria-hidden /> Bu kapsamla teklif isteyin</a>
        <p className="mt-2 text-center text-[11.5px] text-[var(--x-faint)]">E-posta uygulamanızda özetle birlikte açılır.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Security */

const ROLES = [
  { key: 'owner', label: 'Firma sahibi' },
  { key: 'admin', label: 'Yönetici' },
  { key: 'office', label: 'Ofis' },
  { key: 'accountant', label: 'Muhasebe' },
  { key: 'worker', label: 'Atölye' },
  { key: 'member', label: 'Ekip üyesi' },
] as const;
type RoleKey = (typeof ROLES)[number]['key'];

/** The base role matrix the server enforces (lib/security/access-matrix), one role at a time. */
export function RoleMatrix() {
  const reduce = useReducedMotion();
  const [role, setRole] = useState<RoleKey>('office');
  const caps = BASE_CAPS[role];
  const hidden = BASE_HIDDEN[role];
  return (
    <div className="x-window text-[var(--x-ink)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--x-line)] bg-[var(--x-surface-sunk)] px-4 py-3">
        <Tabs id="roles" label="Rol" variant="segmented" size="sm" value={role} onChange={setRole} items={ROLES.map((r) => ({ key: r.key, label: r.label }))} />
        <span className="text-[12px] text-[var(--x-muted)]">Sunucunun uyguladığı temel yetkiler</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead className="text-[11.5px] text-[var(--x-muted)]">
            <tr className="[&>th]:py-2.5 [&>th]:font-normal"><th className="pl-4 text-left">Modül</th>{ACTIONS.map((a) => <th key={a} className="text-center">{ACTION_LABELS[a]}</th>)}</tr>
          </thead>
          <tbody>
            {MODULES.map((m) => {
              const allowed = caps[m] ?? [];
              return (
                <tr key={m} className={cn('border-t border-[var(--x-line)] transition-colors duration-200', !allowed.length && 'text-[var(--x-faint)]')}>
                  <td className="py-2 pl-4">{MODULE_LABELS[m]}</td>
                  {ACTIONS.map((a) => {
                    const on = allowed.includes(a);
                    return (
                      <td key={a} className="text-center">
                        <motion.span role="img" aria-label={on ? 'izinli' : 'izin yok'} initial={false} animate={{ scale: on ? 1 : 0.55, opacity: on ? 1 : 0.35 }} transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }} className={cn('mx-auto block h-2.5 w-2.5 rounded-full', on ? 'bg-[var(--x-ink-2)]' : 'bg-[var(--x-line-strong)]')} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--x-line)] px-4 py-3 text-[12.5px]">
        <span className="text-[var(--x-muted)]">Hiç görmediği alanlar: <span className="text-[var(--x-ink)]">{hidden.length ? hidden.map((f) => FIELD_LABELS[f]).join(', ') : 'yok'}</span></span>
        <span className="text-[var(--x-faint)]">Özel roller bu sınırların içinde daha da daraltılabilir.</span>
      </div>
    </div>
  );
}

/** Audit trail sample beside the security title. */
export function AuditCard() {
  const rows = [
    ['10:42', 'Selin A.', 'RF-1042', 'Termin', '12 Kas → 14 Kas'],
    ['10:38', 'Murat K.', 'TK-0318', 'İndirim', '%0 → %5 · onay istendi'],
    ['10:21', 'Ayşe D.', 'Tahsilat', 'RF-1041', '₺104.640 kaydedildi'],
    ['09:57', 'Kaan Y.', 'Ekip', 'Hakan T.', 'Rol: Atölye'],
  ];
  return (
    <div className="x-window text-[var(--x-ink)]">
      <div className="flex items-center justify-between border-b border-[var(--x-line)] bg-[var(--x-surface-sunk)] px-4 py-2.5 text-[12px]"><span className="font-medium">İşlem geçmişi</span><span className="text-[var(--x-faint)]">Örnek veri</span></div>
      <ul className="text-[12.5px]">
        {rows.map(([time, who, ref, field, change], i) => (
          <li key={time} className="x-rise grid grid-cols-[44px_1fr] gap-3 border-b border-[var(--x-line)] px-4 py-3 last:border-0" style={{ animationDelay: `${300 + i * 90}ms` }}>
            <span className="x-num text-[var(--x-faint)]">{time}</span>
            <span><span className="font-medium">{who}</span> <span className="text-[var(--x-muted)]">· {ref} · {field}</span><span className="block text-[var(--x-ink-2)]">{change}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ Integrations */

const SAMPLES = {
  curl: `# 1. Oturum açın, erişim anahtarını alın
curl -s https://renkflow.com/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"ofis@firma.com","password":"••••••••"}'
# → { "success": true, "data": { "accessToken": "…", "tokenType": "Bearer", … } }

# 2. Siparişleri okuyun
curl -s https://renkflow.com/api/v1/orders \\
  -H "Authorization: Bearer $TOKEN"`,
  js: `const login = await fetch('https://renkflow.com/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'ofis@firma.com', password }),
}).then((r) => r.json());

const orders = await fetch('https://renkflow.com/api/v1/orders', {
  headers: { Authorization: \`Bearer \${login.data.accessToken}\` },
}).then((r) => r.json());

console.log(orders.data.length, 'sipariş');`,
} as const;

/** Two-step API sample with a copy button, as a dark code window. */
export function ApiSample() {
  const [lang, setLang] = useState<keyof typeof SAMPLES>('curl');
  return (
    <div className="overflow-hidden rounded-[var(--x-r-window)] bg-[#1a2023] text-[#e3e8ea] shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_40px_80px_-40px_rgb(0_0_0/0.7)]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div role="tablist" aria-label="Örnek dili" className="flex gap-1">
          {(['curl', 'js'] as const).map((k) => (
            <button key={k} role="tab" type="button" aria-selected={lang === k} onClick={() => setLang(k)} className={cn('relative rounded-[5px] px-2.5 py-1 text-[12px] font-medium transition-colors', lang === k ? 'text-white' : 'text-white/55 hover:text-white')}>
              {lang === k && <motion.span layoutId="api-tab" transition={T.indicator} className="absolute inset-0 rounded-[5px] bg-white/10" />}
              <span className="relative">{k === 'curl' ? 'cURL' : 'JavaScript'}</span>
            </button>
          ))}
        </div>
        <CopyButton value={SAMPLES[lang]} dark />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.pre key={lang} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="x-code overflow-x-auto px-4 py-4 text-[12px] [tab-size:2]">
          {SAMPLES[lang].split('\n').map((line, i) => <div key={i} className={line.trim().startsWith('#') || line.trim().startsWith('//') ? 'text-white/45' : ''}>{line || ' '}</div>)}
        </motion.pre>
      </AnimatePresence>
      <p className="border-t border-white/10 px-4 py-2.5 text-[11.5px] text-white/50">İki adımlı doğrulaması açık hesaplar bu anahtarı alamaz; entegrasyon için ayrı bir kullanıcı açın.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ Changelog */

const KIND_DOT: Record<ChangeKind, string> = { Yeni: 'var(--x-ok)', İyileştirme: 'var(--x-st-production)', Düzeltme: 'var(--x-st-approval)' };
const DATE = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Release notes as a timeline, filtered by kind of change. */
export function ChangelogList({ entries }: { entries: ChangelogEntry[] }) {
  const reduce = useReducedMotion();
  const [kind, setKind] = useState<'all' | ChangeKind>('all');
  const count = (k: ChangeKind) => entries.reduce((n, e) => n + (e.changes.find((g) => g.kind === k)?.items.length ?? 0), 0);
  const shown = entries.map((e) => ({ ...e, changes: kind === 'all' ? e.changes : e.changes.filter((g) => g.kind === kind) })).filter((e) => e.changes.length);
  return (
    <div className="max-w-3xl">
      <Tabs id="changelog" label="Değişiklik türü" variant="segmented" value={kind} onChange={setKind} items={[
        { key: 'all', label: 'Tümü' },
        { key: 'Yeni', label: 'Yeni', count: count('Yeni') },
        { key: 'İyileştirme', label: 'İyileştirme', count: count('İyileştirme') },
        { key: 'Düzeltme', label: 'Düzeltme', count: count('Düzeltme') },
      ]} />
      <ol className="relative mt-10 border-l border-[var(--x-line)]">
        <AnimatePresence initial={false}>
          {shown.map((entry) => (
            <motion.li key={entry.version} id={`v${entry.version}`} layout={!reduce} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="relative scroll-mt-24 pb-14 pl-7 last:pb-0">
              <span aria-hidden className="absolute -left-[5px] top-1.5 h-[9px] w-[9px] rounded-full bg-[var(--x-canvas)] shadow-[inset_0_0_0_2px_var(--x-ink-2)]" />
              <p className="text-[12.5px] text-[var(--x-muted)]"><a href={`#v${entry.version}`} className="x-mono x-link">{entry.version}</a> · <time dateTime={entry.date}>{DATE.format(new Date(`${entry.date}T00:00:00Z`))}</time></p>
              <h2 className="mt-1.5 text-[21px] font-semibold tracking-[-0.02em]">{entry.title}</h2>
              {entry.summary && <p className="mt-2 text-[15px] leading-[1.7] text-[var(--x-muted)]">{entry.summary}</p>}
              {entry.changes.map((group) => (
                <section key={group.kind} className="mt-5">
                  <h3 className="flex items-center gap-2 text-[12.5px] font-medium"><span className="h-2 w-2 rounded-full" style={{ background: KIND_DOT[group.kind] }} />{group.kind}</h3>
                  <ul className="mt-2.5 space-y-2">
                    {group.items.map((item) => <li key={item} className="relative pl-4 text-[14.5px] leading-[1.7] text-[var(--x-ink-2)] before:absolute before:left-0 before:top-[0.8em] before:h-px before:w-2 before:bg-[var(--x-line-strong)]">{item}</li>)}
                  </ul>
                </section>
              ))}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ About */

/** The brand's profile section as a drawing sheet with a title block. */
export function DrawingSheet() {
  return (
    <div className="overflow-hidden rounded-[var(--x-r-window)] bg-[var(--x-surface)] text-[var(--x-ink)] shadow-[var(--x-shadow-window)]">
      <div className="px-10 pb-4 pt-8 text-[var(--x-ink-2)] [--rf-drawing-accent:var(--x-bronze-fill)]"><ProfileDrawing delay={0.5} /></div>
      <div className="grid grid-cols-4 border-t border-[var(--x-line)] text-[12px]">
        {[['Profil', '6017 · 100×150'], ['Kesit', 'A–A'], ['Ölçek', '1:1'], ['Renk', 'RAL 7016']].map(([k, v]) => (
          <div key={k} className="border-r border-[var(--x-line)] px-3.5 py-2.5 last:border-r-0"><p className="text-[11px] text-[var(--x-muted)]">{k}</p><p className="x-mono mt-0.5 whitespace-nowrap text-[11.5px] font-medium">{v}</p></div>
        ))}
      </div>
    </div>
  );
}
