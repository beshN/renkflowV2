'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { AIOffice } from './AIOffice';
import { Assistant } from './Assistant';
import { LeadToOrder } from './LeadToOrder';
import { OwnCutList } from './OwnCutList';
import { Floor } from './Floor';
import { ProductWindow } from './ProductWindow';
import { Scanner } from './Scanner';
import { EASE } from './primitives';
import './landing-v2.css';

const OFFICE_FACTS = [
  ['Teslim kontrolü', 'Müdür, Word, Excel ve PowerPoint içeriğini, PDF metnini ve görselleri görevle karşılaştırır. Yanlış hesap, eksik kalem ya da uydurma bilgi işi geri gönderir; küçük öneriler teslim kartında kalır.'],
  ['Kişisel veriler', 'Müşteri, tedarikçi ve çalışan adları, telefon, e-posta, IBAN ve TC numaraları modele yer tutucuyla gider. Teslimde gerçek değerler dosyaya geri konur.'],
  ['Kayıtlara erişim', 'Çalışan siparişleri, müşterileri, stok ve teklifleri görevi veren kişinin rolüyle arar ve yalnız okur; hiçbir kaydı değiştirmez. Firmanızın unvanı ve adresi antet ve imzaya otomatik girer.'],
] as const;

const ASSISTANT_FACTS = [
  ['Taslak, onay sizde', 'Sipariş taslağı ve sipariş notu hazırlayabilir. Taslak inceleme akışına girer; onaylı sipariş yalnız bir kişi onaylayınca oluşur.'],
  ['Rolle sınırlı', 'Asistan yalnız rolünüzün açabildiği kayıtları okur: ofis finansı görmez, muhasebe sipariş oluşturamaz. Kaydın olmamasıyla yetkinizin olmamasını ayrı söyler.'],
  ['Föy okuma', 'PDF sipariş föyü okunur; ölçüler ve teknik kurallar denetlenip kontrolünüze sunulur. Onayladığınız föy siparişe dönüşür.'],
] as const;

function Facts({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  return (
    <dl className="mt-10 grid gap-px overflow-hidden rounded-[var(--x-r-panel)] bg-[var(--x-chrome-line)] md:grid-cols-3">
      {items.map(([term, detail]) => (
        <div key={term} className="bg-[var(--x-chrome)] p-5 pr-7">
          <dt className="text-[14px] font-medium">{term}</dt>
          <dd className="mt-1.5 text-[13.5px] leading-[1.65] text-[var(--x-chrome-muted)]">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

const FACTS = [
  ['Veri aktarımı', 'Müşteri, ürün ve stok listeleri Excel veya CSV dosyasından alınır. Aktarım sırasında ekibimiz yanınızda olur.'],
  ['Rol bazlı yetki', 'Yönetici, ofis, muhasebe ve üretim yalnızca kendi ekranlarını görür. Usta, kendisine atanan işi ve kesim listesini görür.'],
  ['Firma ayrımı', 'Her kayıt bir firmaya aittir; panel ve API oturumdaki firmanın verisini okur.'],
  ['İşlem geçmişi', 'Sipariş, teklif, müşteri ve tahsilat değişiklikleri kim, ne zaman ve ne değişti bilgisiyle saklanır.'],
  ['Entegrasyon', 'Listeler ve raporlar CSV olarak dışa aktarılır, sürümlü API (v1) ile bağlantı kurulur. e-Fatura ve e-Arşiv gönderimi bu sürümde yok.'],
  ['Kurulum', 'Listeleriniz hazırsa ekipler genellikle birkaç gün içinde günlük işini RenkFlow’da yapmaya başlar.'],
] as const;

function SectionHead({ title, children, id, dark = false }: { title: string; children: React.ReactNode; id?: string; dark?: boolean }) {
  return (
    <div id={id} className="grid scroll-mt-24 gap-4 md:grid-cols-[1fr_minmax(0,420px)] md:items-end md:gap-12">
      <h2 className="x-display max-w-[17ch] text-[clamp(30px,3.6vw,44px)] leading-[1.06] [text-wrap:balance]">{title}</h2>
      <p className={`text-[15px] leading-[1.65] ${dark ? 'text-[var(--x-chrome-muted)]' : 'text-[var(--x-muted)]'}`}>{children}</p>
    </div>
  );
}

/** Rises into place once, the first time an interactive surface scrolls into view. */
function Surface({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -12% 0px' }} transition={reduce ? { duration: 0 } : { duration: 0.6, ease: EASE }}>
      {children}
    </motion.div>
  );
}

export function LandingV2({ signedIn = false }: { signedIn?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="rfx">
      {/* Hero: the product is the picture */}
      <section className="x-light relative overflow-hidden text-[var(--x-chrome-fg)]">
        <div className="mx-auto max-w-6xl px-5 pb-12 pt-14 sm:px-8 md:pb-14 md:pt-20">
          <p className="text-[14px] text-[var(--x-chrome-muted)]">Pergola, giyotin cam ve tente üreticileri için</p>
          <h1 className="x-display mt-4 text-[clamp(36px,4.9vw,62px)] leading-[1.03] [text-wrap:balance]">Ölçü bir kez girilir.<br className="max-md:hidden" /> Teklif, kesim ve sevkiyat ondan çıkar.</h1>
          <p className="mt-6 max-w-[58ch] text-[16px] leading-[1.65] text-[var(--x-chrome-muted)]">RenkFlow, ölçüye özel üretim yapan firmaların sipariş, kesim planı, depo ve sevkiyat yazılımı. Yazışma ve tablo işlerini AI ofisine devredersiniz. Aşağıdaki ekran uygulamanın çalışan bir kesiti.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/contact" className="x-btn x-btn-primary">Demo talep edin</Link>
            <Link href={signedIn ? '/dashboard' : '/auth/login'} className="x-btn x-btn-ghost-dark">{signedIn ? 'Panele git' : 'Giriş yap'}</Link>
          </div>
        </div>
        <div className="mx-auto max-w-[1240px] px-3 pb-16 sm:px-6 [perspective:1800px]">
          <motion.div
            initial={{ y: 36, rotateX: 9, scale: 0.985 }}
            animate={{ y: 0, rotateX: 0, scale: 1 }}
            transition={reduce ? { duration: 0 } : { duration: 1.1, ease: EASE, delay: 0.1 }}
            style={{ transformOrigin: '50% 0%' }}
            className="text-[var(--x-ink)]"
          >
            <ProductWindow />
          </motion.div>
          <p className="mt-4 text-center text-[12.5px] text-[var(--x-muted)]">Siparişe tıklayın, <kbd className="x-kbd">⌘</kbd> <kbd className="x-kbd">K</kbd> ile arayın, panoda bir işi sonraki aşamaya alın.</p>
        </div>
      </section>

      {/* Lead to order */}
      <section className="mx-auto max-w-6xl px-5 pb-24 pt-16 sm:px-8 md:pb-32 md:pt-24">
        <SectionHead id="tekliften-siparise" title="Potansiyel müşteriden siparişe, ölçüler yeniden girilmeden.">
          Keşifteki ölçüyle teklif hazırlanır ve müşteriye onay bağlantısıyla gider. Müşteri onaylayınca teklif siparişe döner; kesim listesi, çubuk ihtiyacı ve stok o anda hesaplanır. Teklifi gönderin, müşterinin telefonunda onaylayın.
        </SectionHead>
        <Surface className="mt-12"><LeadToOrder /></Surface>
        <details className="group mt-8 rounded-[var(--x-r-window)] bg-[var(--x-surface)] shadow-[0_0_0_1px_var(--x-line)] [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
            <span><span className="block text-[14px] font-medium">Kendi kesim listenizi deneyin</span><span className="block text-[13px] text-[var(--x-muted)]">Parça boylarını yazın; atölyedeki kesim motoru artıkları önce kullanarak planı çıkarır.</span></span>
            <span aria-hidden className="relative h-3.5 w-3.5 shrink-0 text-[var(--x-muted)] before:absolute before:left-0 before:top-1/2 before:h-px before:w-full before:bg-current after:absolute after:left-1/2 after:top-0 after:h-full after:w-px after:bg-current after:transition-transform group-open:after:scale-y-0" />
          </summary>
          <div className="border-t border-[var(--x-line)] px-5 py-5"><OwnCutList /></div>
        </details>
      </section>

      {/* AI office and assistant */}
      <section className="x-chrome">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
          <SectionHead dark title="Ofis işini AI ofisine verin, son onay sizde kalsın.">
            Teklif e-postası, fiyat tablosu, çeviri, sunum, rapor ya da katalog görseli. Görevi kendi cümlenizle yazarsınız; ofis müdürü işin türünü okuyup doğru çalışana verir ve teslim edilen dosyayı görevle karşılaştırarak puanlar. Bir görev verip izleyin.
          </SectionHead>
          <Surface className="mt-12"><AIOffice /></Surface>
          <Facts items={OFFICE_FACTS} />

          <div className="mt-24 md:mt-32">
            <SectionHead dark title="Asistan her ekranda, rolünüzün gördüğü kadarını bilir.">
              Panelin sağ alt köşesinden açılır. Açılışta geciken siparişleri, takılan operasyonları ve bekleyen sayımları kendisi kontrol eder; sorularınızı firmanızın kayıtlarından yanıtlar. Rolü değiştirip aynı soruyu sorun.
            </SectionHead>
            <Surface className="mt-12"><Assistant /></Surface>
            <Facts items={ASSISTANT_FACTS} />
          </div>
        </div>
      </section>

      {/* Warehouse scanning */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
        <SectionHead title="Paketi okutun, rafı okutun, stok yerini bilir.">
          Her paket ve raf, Code 128 ve QR taşıyan bir etiketle tanınır. Telefon kamerası ya da el terminaliyle okutulur; transfer iki dengeli hareket olarak kaydedilir. Rezerve bir paket taşınamaz.
        </SectionHead>
        <Surface className="mt-12"><Scanner /></Surface>
      </section>

      {/* Workshop and office on one record */}
      <section className="border-y border-[var(--x-line)] bg-[var(--x-canvas-deep)]">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
          <SectionHead title="Usta tablette işaretler, ofis aynı anda görür.">
            Kesim istasyonundaki tablet yalnızca o ustaya atanan işi gösterir. Her işaret siparişin kaydına düşer; ofis telefon açmadan nerede kalındığını bilir. Profilleri işaretleyip kesimi bitirin.
          </SectionHead>
          <Surface className="mt-12"><Floor /></Surface>
        </div>
      </section>

      {/* Plain facts */}
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-24 sm:px-8 md:grid-cols-[minmax(0,360px)_1fr] md:gap-16 md:py-32">
        <div>
          <h2 className="x-display text-[clamp(26px,2.8vw,34px)] leading-[1.1]">Kurulum, yetki ve kayıt</h2>
          <p className="mt-4 text-[15px] leading-[1.65] text-[var(--x-muted)]">Teklif fiyatlarınız, müşteri listeniz ve teknik çizimleriniz firmanızın en değerli bilgisi. <Link href="/security" className="text-[var(--x-ink)] underline decoration-[var(--x-line-strong)] underline-offset-4 transition-colors hover:decoration-[var(--x-ink)]">Güvenlik yaklaşımımız</Link></p>
        </div>
        <dl className="border-t border-[var(--x-line)]">
          {FACTS.map(([term, detail]) => (
            <div key={term} className="grid gap-1 border-b border-[var(--x-line)] py-5 sm:grid-cols-[180px_1fr] sm:gap-8">
              <dt className="text-[14px] font-medium">{term}</dt>
              <dd className="text-[14px] leading-[1.65] text-[var(--x-muted)]">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Close */}
      <section className="x-chrome">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-end md:justify-between md:py-24">
          <div className="max-w-[560px]">
            <h2 className="x-display text-[clamp(28px,3.4vw,42px)] leading-[1.06]">Kendi bir projenizle görmek ister misiniz?</h2>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--x-chrome-muted)]">30 dakikalık görüşmede örnek bir siparişinizi keşiften montaja RenkFlow’da birlikte takip ederiz.</p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Link href="/contact" className="x-btn x-btn-primary">Demo talep edin</Link>
            <Link href={signedIn ? '/dashboard' : '/auth/login'} className="x-btn x-btn-ghost-dark">{signedIn ? 'Panele git' : 'Giriş yap'}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
