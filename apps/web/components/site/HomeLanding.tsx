'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Check, FileText, Lock, ScrollText, ShieldCheck, Users } from 'lucide-react';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { CuttingMock, FinanceMock, WarehouseMock, WorkspaceMock } from './ProductMocks';
import { ProfileDrawing } from '@/components/brand/ProfileDrawing';

const EASE = [0.2, 0.8, 0.2, 1] as const;

const MODULES = ['Sipariş yönetimi', 'Teklif ve fiyatlama', 'Kesim planı', 'İş emirleri', 'Usta ekranı', 'Depo ve raf', 'QR terminali', 'Satın alma', 'Mal kabul', 'Kalite kontrol', 'Sevkiyat', 'Finans', 'Raporlar'];

const FEATURES = [
  {
    eyebrow: 'Kesim ve üretim',
    title: 'Her profil boyu, planlanmış bir kesim.',
    body: 'Her proje kendi ölçüsüyle gelir. Siparişteki ölçülerden kesim listesi çıkar; parçalar stoktaki farklı boylara ve önceki işlerden kalan artıklara yerleştirilir. Kullanılabilir artık ölçüsüyle stoğa geri yazılır.',
    points: ['Farklı boylardan kesim planı', 'Artık parçaların ölçüsüyle takibi', 'Usta için kesim listesi'],
    mock: <CuttingMock />,
  },
  {
    eyebrow: 'Depo ve izlenebilirlik',
    title: 'Hangi profil, hangi renkte, kaç boy kaldı.',
    body: 'Stok profil kodu, renk ve boy bazında tutulur. Gelen paketler raf etiketiyle eşleşir; giriş ve sayım telefon kamerasından okutularak yapılır, bakiye anında güncellenir.',
    points: ['Kod, renk ve boy bazında stok', 'Paket ve raf etiketi', 'Rezerve ve serbest miktar ayrımı'],
    mock: <WarehouseMock />,
  },
  {
    eyebrow: 'Finans',
    title: 'Teklif, sipariş ve tahsilat aynı kayıtta.',
    body: 'Onaylanan teklif tek adımda siparişe dönüşür; tahsilatlar siparişe bağlanır ve kalan bakiye sipariş üzerinde görünür. Sipariş dökümü yazdırılır; e-Fatura ve e-Arşiv gönderimi bu sürümde yok.',
    points: ['Teklif → sipariş → tahsilat', 'Sipariş bazında kalan bakiye', 'CSV olarak dışa aktarım'],
    mock: <FinanceMock />,
  },
];

const STEPS = [
  { no: '01', title: 'Talep ve keşif', detail: 'Gelen talep, sahada alınan ölçülerle birlikte taslak siparişe dönüşür.' },
  { no: '02', title: 'Teklif ve onay', detail: 'Ölçü, renk ve aksesuar bilgileri teklifle birlikte müşteriye onaylatılır.' },
  { no: '03', title: 'Kesim ve üretim', detail: 'Kesim planı çıkar, usta hangi boydan nereden keseceğini görür.' },
  { no: '04', title: 'Boya ve kalite', detail: 'Boya ve kontrol adımları siparişe işlenir.' },
  { no: '05', title: 'Sevkiyat ve montaj', detail: 'Yükleme listesi hazırlanır, montaj ekibi ve müşteri bilgilendirilir.' },
];

const TRUST = [
  { icon: Users, title: 'Rol bazlı yetki', detail: 'Yönetici, ofis, muhasebe ve üretim ekipleri yalnızca kendi ekranlarını görür.' },
  { icon: ShieldCheck, title: 'Firma ayrımı', detail: 'Her kayıt bir firmaya aittir; panel ve API oturumdaki firmanın verisini okur.' },
  { icon: ScrollText, title: 'İşlem geçmişi', detail: 'Sipariş, teklif, müşteri ve tahsilat işlemleri kim, ne zaman ve neyin değiştiği bilgisiyle kaydedilir.' },
  { icon: Lock, title: 'Giriş koruması', detail: 'Başarısız denemeler sınırlandırılır, oturumlar güvenli çerezlerle tutulur.' },
];

const FAQ = [
  { q: 'Mevcut verilerimizi aktarabilir miyiz?', a: 'Müşteri, ürün ve stok listeleriniz Excel veya CSV dosyalarından içeri alınır. Aktarım sırasında ekibimiz yanınızda olur.' },
  { q: 'Standart ölçü olmayan projelerde nasıl çalışır?', a: 'RenkFlow ölçüye özel iş için tasarlandı. Her sipariş kendi ölçüleri, renk ve aksesuar bilgisiyle girilir; kesim listesi bu ölçülerden çıkar.' },
  { q: 'Atölyede kimler kullanabilir?', a: 'Usta ekranı tablet ve telefonda çalışır. Üretim rolündeki kullanıcı yalnızca kendisine atanan işleri görür.' },
  { q: 'Kurulum ne kadar sürer?', a: 'Listelerinizin hazır olma durumuna göre ekipler genellikle birkaç gün içinde günlük işini RenkFlow’da yapmaya başlar.' },
  { q: 'Muhasebe programımızla çalışır mı?', a: 'Sipariş listesi ve raporlar CSV olarak dışa aktarılır; sürümlenmiş API (v1) ile entegrasyon kurulabilir. e-Fatura ve e-Arşiv gönderimi bu sürümde yok.' },
];

const SHOWCASE = [
  { key: 'orders', label: 'Siparişler', caption: 'Her siparişin durumu, termini ve teknik bilgisi tek listede.', mock: <WorkspaceMock /> },
  { key: 'cutting', label: 'Kesim planı', caption: 'Parçalar farklı boylara ve artıklara yerleştirilir; kullanılabilir artık stoğa döner.', mock: <CuttingMock /> },
  { key: 'warehouse', label: 'Depo', caption: 'Kod, renk ve boy bazında stok; paket etiketiyle giriş.', mock: <WarehouseMock /> },
  { key: 'finance', label: 'Finans', caption: 'Teklif, sipariş ve tahsilat aynı kayıtta.', mock: <FinanceMock /> },
] as const;
const SHOWCASE_MS = 6500;

/** Auto-advancing tabbed product tour; any interaction pauses the timer. */
function Showcase() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (reduce || paused) return;
    const timer = setTimeout(() => setIndex((value) => (value + 1) % SHOWCASE.length), SHOWCASE_MS);
    return () => clearTimeout(timer);
  }, [index, paused, reduce]);
  const current = SHOWCASE[index];
  return (
    <div onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div role="tablist" aria-label="Ürün turu" className="grid grid-cols-2 border-t border-border sm:grid-cols-4">
        {SHOWCASE.map((item, i) => (
          <button key={item.key} role="tab" aria-selected={i === index} onClick={() => setIndex(i)} className="group relative border-b border-border py-4 pr-4 text-left sm:border-b-0">
            <span aria-hidden className="absolute inset-x-0 top-[-1px] h-px overflow-hidden">
              {i === index && <motion.span key={`${index}-${paused}`} className="block h-full bg-foreground" initial={{ width: reduce || paused ? '100%' : '0%' }} animate={{ width: '100%' }} transition={{ duration: reduce || paused ? 0 : SHOWCASE_MS / 1000, ease: 'linear' }} />}
            </span>
            <span className="text-[12px] tabular-nums text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
            <span className={`mt-1.5 block text-[14px] font-medium transition-colors ${i === index ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="relative mt-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={current.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: EASE }} className="mx-auto max-w-4xl">
            {current.mock}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mx-auto mt-6 max-w-4xl text-center text-[14px] text-muted-foreground" aria-live="polite">{current.caption}</p>
    </div>
  );
}

function Hero() {
  const reduce = useReducedMotion();
  const rise = (delay: number) => ({ initial: reduce ? false : { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: EASE } });
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-background to-muted/50">
      <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 sm:px-8 md:pb-28 md:pt-24">
        <motion.div {...rise(0)}>
          <Link href="/changelog" className="rf-chip transition-colors hover:text-foreground"><span className="rf-status-dot" aria-hidden /> Pergola ve cam sistemleri için geliştirildi <ArrowRight size={12} /></Link>
        </motion.div>
        <div className="mt-10 grid items-end gap-10 lg:grid-cols-[1.5fr_0.5fr]">
          <motion.h1 {...rise(0.06)} className="text-[clamp(38px,5.2vw,68px)] font-semibold leading-[1.04] tracking-[-0.045em] [text-wrap:balance]">
            <span className="block text-muted-foreground">Ölçüye özel her proje için</span><span className="block">tek operasyon altyapısı.</span>
          </motion.h1>
          <motion.div {...rise(0.14)} className="lg:pb-3">
            <p className="text-[16px] leading-7 text-muted-foreground">Pergola, giyotin cam, tente ve tavan projelerinde teklif, kesim planı, depo ve tahsilat aynı veride. Ofis ve atölye her an aynı tabloya bakar.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/contact" className="rf-ink-button group h-11 px-5 text-[14px]">Demo talep edin <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" /></Link>
              <Link href="/auth/login" className="rf-secondary-button h-11 px-5 text-[14px]">Giriş yap</Link>
            </div>
          </motion.div>
        </div>
        <motion.div {...rise(0.24)} className="mt-16"><Showcase /></motion.div>
      </div>
    </section>
  );
}

function ModuleStrip() {
  return (
    <section aria-label="Modüller" className="border-y border-border bg-muted/30 py-5">
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
        <div className="rf-marquee gap-10 pr-10">
          {[...MODULES, ...MODULES].map((module, index) => (
            <span key={index} className="flex shrink-0 items-center gap-10 whitespace-nowrap text-[14px] text-muted-foreground">{module}<span aria-hidden className="h-1 w-1 rounded-full bg-border" /></span>
          ))}
        </div>
      </div>
    </section>
  );
}

const LIVE = [
  ['09:41', 'RF-1042', 'Pergola kesimi tamamlandı'],
  ['09:42', 'RF-1041', 'Boya onayı · RAL 9016'],
  ['09:44', 'PKT-0942', 'Paket girişi · 24 boy'],
  ['09:46', 'RF-1038', 'Montaja hazır'],
  ['09:49', 'RF-1043', 'Yeni keşif · 4.500 × 3.200'],
] as const;
const FLOW = ['Keşif', 'Teklif', 'Kesim', 'Boya', 'Montaj', 'Tahsilat'];
const ROLES = {
  Usta: ['İş emirleri', 'Usta ekranı', 'QR terminali'],
  Ofis: ['Siparişler', 'Teklifler', 'Sevkiyat', 'Müşteriler'],
  Muhasebe: ['Faturalar', 'Tahsilatlar', 'Raporlar'],
} as const;

function useCycle(length: number, ms: number) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const timer = setInterval(() => setI((value) => (value + 1) % length), ms);
    return () => clearInterval(timer);
  }, [length, ms, reduce]);
  return i;
}

function Tile({ className, label, title, detail, children }: { className?: string; label: string; title: string; detail: string; children: React.ReactNode }) {
  return (
    <StaggerItem className={`flex flex-col overflow-hidden rounded-xl border border-border bg-card ${className || ''}`}>
      <div className="flex-1 p-6">{children}</div>
      <div className="border-t border-border p-6">
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
        <h3 className="mt-2 text-[16px] font-semibold tracking-[-0.02em]">{title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-6 text-muted-foreground">{detail}</p>
      </div>
    </StaggerItem>
  );
}

function LiveLog() {
  const head = useCycle(LIVE.length, 1900);
  const rows = [0, 1, 2, 3].map((offset) => LIVE[(head + offset) % LIVE.length]);
  return (
    <ul className="space-y-1 font-mono text-[11.5px]">
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map(([time, ref, text], index) => (
          <motion.li layout key={ref + time} initial={{ opacity: 0, y: -8 }} animate={{ opacity: index === 0 ? 1 : 1 - index * 0.22, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="grid grid-cols-[44px_70px_1fr] gap-3 rounded-md px-2 py-1.5 data-[first=true]:bg-muted" data-first={index === 0}>
            <span className="text-muted-foreground">{time}</span><span className="text-primary">{ref}</span><span className="truncate">{text}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function FlowChain() {
  const step = useCycle(FLOW.length, 900);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FLOW.map((name, index) => (
        <span key={name} className="flex items-center gap-1.5">
          <span className={`rounded-md border px-2 py-1 text-[12px] transition-colors duration-300 ${index === step ? 'border-foreground bg-foreground text-background' : index < step ? 'border-border text-foreground' : 'border-border text-muted-foreground'}`}>{name}</span>
          {index < FLOW.length - 1 && <span aria-hidden className="h-px w-3 bg-border" />}
        </span>
      ))}
    </div>
  );
}

function RoleSwitcher() {
  const [role, setRole] = useState<keyof typeof ROLES>('Usta');
  return (
    <div>
      <div role="tablist" aria-label="Rol" className="inline-flex rounded-lg border border-border bg-muted p-0.5">
        {(Object.keys(ROLES) as Array<keyof typeof ROLES>).map((name) => (
          <button key={name} role="tab" aria-selected={role === name} onClick={() => setRole(name)} className="relative rounded-md px-3 py-1 text-[12px] font-medium">
            {role === name && <motion.span layoutId="rf-role-pill" className="absolute inset-0 rounded-md bg-card shadow-[0_1px_2px_rgb(17_17_19/0.08),0_0_0_1px_hsl(var(--border))]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className={`relative ${role === name ? 'text-foreground' : 'text-muted-foreground'}`}>{name}</span>
          </button>
        ))}
      </div>
      <ul className="mt-4 space-y-1.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {ROLES[role].map((item, index) => (
            <motion.li key={role + item} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, delay: index * 0.04 }} className="flex items-center gap-2 text-[13px]"><span className="h-1 w-1 rounded-full bg-primary" />{item}</motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function ScanTile() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative h-28 w-28 overflow-hidden rounded-lg border border-border bg-background p-3">
        <div aria-hidden className="grid h-full w-full grid-cols-7 grid-rows-7 gap-[3px]">
          {Array.from({ length: 49 }, (_, i) => <span key={i} className={[0,1,2,7,9,14,15,16,4,5,6,11,13,18,19,20,28,29,30,35,37,42,43,44,24,26,32,38,40,46,22].includes(i) ? 'rounded-[1px] bg-foreground' : ''} />)}
        </div>
        <span className="rf-scanline" aria-hidden />
      </div>
    </div>
  );
}

function Bento() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
      <Reveal className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-[13px] font-medium text-primary">Neden RenkFlow</p>
          <h2 className="mt-3 text-[clamp(30px,4vw,52px)] font-semibold leading-[1.02] tracking-[-0.045em]">Defter, Excel ve mesaj gruplarında kaybolan bilgi <span className="text-muted-foreground">artık tek yerde.</span></h2>
        </div>
        <Link href="/features" className="inline-flex items-center gap-1.5 text-[14px] font-medium hover:underline">Tüm özellikler <ArrowUpRight size={15} /></Link>
      </Reveal>
      <Stagger className="mt-14 grid gap-4 md:grid-cols-6">
        <Tile className="md:col-span-4" label="Canlı" title="Atölyede olan, ofiste aynı anda görünür." detail="Ustanın tamamladığı kesim, depoya giren paket ve yeni keşif tek akışta toplanır."><LiveLog /></Tile>
        <Tile className="md:col-span-2" label="İzlenebilirlik" title="Her paket bir etiketle." detail="Raf, profil kodu ve renk aynı etiketle eşleşir."><ScanTile /></Tile>
        <Tile className="md:col-span-2" label="Teknik detay" title="Çizim siparişle birlikte." detail="Profil kodu, ölçü ve renk bilgisi kayıtta saklanır."><div className="text-foreground/80"><ProfileDrawing inView delay={0} /></div></Tile>
        <Tile className="md:col-span-2" label="Tek kayıt" title="Sipariş bir kez girilir." detail="Kesimden tahsilata kadar her adım aynı kaydı kullanır."><div className="flex h-full items-center"><FlowChain /></div></Tile>
        <Tile className="md:col-span-2" label="Rol bazlı" title="Herkes kendi işini görür." detail="Usta, ofis ve muhasebe için ayrı, sade ekranlar."><RoleSwitcher /></Tile>
      </Stagger>
    </section>
  );
}

function FeatureRows() {
  return (
    <section className="border-t border-border">
      {FEATURES.map((feature, index) => (
        <div key={feature.title} className="border-b border-border">
          <div className={`mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 md:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 ${index % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
            <Reveal>
              <p className="text-[13px] font-medium text-primary">{feature.eyebrow}</p>
              <h2 className="mt-3 text-[clamp(26px,3vw,38px)] font-semibold leading-[1.1] tracking-[-0.035em]">{feature.title}</h2>
              <p className="mt-5 text-[15.5px] leading-7 text-muted-foreground">{feature.body}</p>
              <ul className="mt-7 space-y-3">
                {feature.points.map((point) => (
                  <li key={point} className="flex items-center gap-3 text-[14.5px]"><span className="grid h-5 w-5 place-items-center rounded-full border border-border"><Check size={11} strokeWidth={2.5} /></span>{point}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.08} y={20}>{feature.mock}</Reveal>
          </div>
        </div>
      ))}
    </section>
  );
}

function Workflow() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 55%'] });
  const width = useTransform(scrollYProgress, [0, 1], reduce ? ['100%', '100%'] : ['0%', '100%']);
  return (
    <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
      <Reveal className="max-w-2xl">
        <p className="text-[13px] font-medium text-primary">İş akışı</p>
        <h2 className="mt-3 text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.08] tracking-[-0.04em]">Bir siparişin yolculuğu, beş adımda.</h2>
      </Reveal>
      <div ref={ref} className="relative mt-16">
        <div aria-hidden className="absolute left-0 right-0 top-[15px] hidden h-px bg-border md:block" />
        <motion.div aria-hidden style={{ width }} className="absolute left-0 top-[15px] hidden h-px bg-foreground md:block" />
        <ol className="grid gap-10 md:grid-cols-5 md:gap-6">
          {STEPS.map((step, index) => (
            <Reveal as="li" key={step.no} delay={index * 0.06} className="relative">
              <span className="relative z-10 grid h-[31px] w-[31px] place-items-center rounded-full border border-border bg-background font-mono text-[11px]">{step.no}</span>
              <h3 className="mt-6 text-[16px] font-semibold tracking-[-0.02em]">{step.title}</h3>
              <p className="mt-2 text-[14px] leading-6 text-muted-foreground">{step.detail}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="border-y border-border bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-14 px-5 py-24 sm:px-8 md:py-28 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <p className="text-[13px] font-medium text-primary">Güvenlik</p>
          <h2 className="mt-3 text-[clamp(26px,3vw,38px)] font-semibold leading-[1.1] tracking-[-0.035em]">Verileriniz yalnızca yetkili kişilere açık.</h2>
          <p className="mt-5 text-[15.5px] leading-7 text-muted-foreground">Teklif fiyatlarınız, müşteri listeniz ve teknik çizimleriniz firmanızın en değerli bilgileri. RenkFlow her erişimi rol ve firma kimliğiyle sınırlar.</p>
          <Link href="/security" className="mt-7 inline-flex items-center gap-1.5 text-[14px] font-medium hover:underline">Güvenlik yaklaşımımız <ArrowUpRight size={15} /></Link>
        </Reveal>
        <Stagger className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {TRUST.map(({ icon: Icon, title, detail }) => (
            <StaggerItem key={title} className="bg-card p-7">
              <Icon size={18} strokeWidth={1.75} />
              <h3 className="mt-6 text-[15.5px] font-semibold tracking-[-0.02em]">{title}</h3>
              <p className="mt-2 text-[14px] leading-6 text-muted-foreground">{detail}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-8 md:py-32 lg:grid-cols-[0.8fr_1.2fr]">
      <Reveal>
        <p className="text-[13px] font-medium text-primary">Sık sorulanlar</p>
        <h2 className="mt-3 text-[clamp(26px,3vw,38px)] font-semibold leading-[1.1] tracking-[-0.035em]">Aklınıza takılanlar.</h2>
        <p className="mt-5 text-[15.5px] leading-7 text-muted-foreground">Başka bir sorunuz mu var? <Link href="/contact" className="text-foreground underline underline-offset-4">Bize yazın</Link>.</p>
      </Reveal>
      <Reveal delay={0.06}>
        <div className="divide-y divide-border border-y border-border">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[15.5px] font-medium">
                {item.q}
                <span aria-hidden className="relative h-3.5 w-3.5 shrink-0 text-muted-foreground before:absolute before:left-0 before:top-1/2 before:h-px before:w-full before:bg-current after:absolute after:left-1/2 after:top-0 after:h-full after:w-px after:bg-current after:transition-transform group-open:after:scale-y-0" />
              </summary>
              <p className="mt-3 max-w-xl text-[14.5px] leading-7 text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Closing() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/50 px-8 py-14 md:px-16 md:py-20">
          <div className="relative max-w-2xl">
            <FileText size={20} strokeWidth={1.75} className="text-muted-foreground" />
            <h2 className="mt-6 text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.08] tracking-[-0.04em]">Kendi projelerinizle görmek ister misiniz?</h2>
            <p className="mt-4 text-[16px] leading-7 text-muted-foreground">30 dakikalık bir görüşmede örnek bir projenizi keşiften montaja RenkFlow’da birlikte takip edelim.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/contact" className="rf-ink-button group h-11 px-5 text-[14px]">Demo talep edin <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" /></Link>
              <Link href="/auth/login" className="rf-secondary-button h-11 px-5 text-[14px]">Panele giriş yap</Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function HomeLanding() {
  return (
    <>
      <Hero />
      <ModuleStrip />
      <Bento />
      <FeatureRows />
      <Workflow />
      <Trust />
      <Faq />
      <Closing />
    </>
  );
}
