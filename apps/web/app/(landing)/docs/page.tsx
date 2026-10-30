import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';
import { COMPANY, privacyEmail, telHref, whatsappHref } from '@/lib/core/company';

export const metadata = marketingMetadata('docs');

type Guide = { id: string; title: string; intro: string; steps?: string[]; notes?: string[] };

/**
 * Getting-started guide. Every menu path here exists in lib/core/dashboard-nav.ts and every
 * button name on its screen; update this page when a screen or a menu label changes.
 */
const GUIDES: Guide[] = [
  {
    id: 'hesap',
    title: 'Hesap ve firma kurulumu',
    intro: 'Hesabınızı kurulum görüşmesinde birlikte açabiliriz ya da kayıt sayfasından kendiniz oluşturabilirsiniz. Hesabı açan kişi firmanın sahibi olur.',
    steps: [
      'Kayıt sayfasında şirket adınızı, adınızı soyadınızı, e-posta adresinizi ve şifrenizi girin; ardından giriş yapın.',
      'Yönetim › Ayarlar › Firma: firma bilgilerini ve adreslerini girin. Bu bilgiler teklif ve belgelerde kullanılır.',
      'Ayarlar › Üretim ve renkler: üretim ayarlarını, firma renk kataloğunu (RAL renkleri) ve fire/gecikme neden kodlarını tanımlayın.',
      'Ayarlar › Teklif: teklif kurallarını (ör. yönetici onayı gerektiren indirim eşiği) ve kayıt numaralandırmasını belirleyin.',
      'Yönetim › Hesabım: iki adımlı doğrulamayı açın, kurtarma kodlarınızı güvenli bir yerde saklayın. Açık oturumlarınızı ve bildirim tercihlerinizi buradan yönetirsiniz.',
    ],
  },
  {
    id: 'musteriler',
    title: 'Müşterileri eklemek',
    intro: 'Müşteri kartları teklif, sipariş, fatura ve tahsilatların bağlandığı kayıttır.',
    steps: [
      'Satış › Müşteriler › “Müşteri ekle” ile tek tek kayıt açın.',
      'Mevcut listeniz varsa Müşteriler ekranındaki “Listeden içe aktar” ile CSV dosyası yükleyin. Kayıtlar önce önizlenir; aynı müşteri ikinci kez oluşturulmaz.',
      'Henüz teklif aşamasına gelmemiş talepleri Satış › Müşteri adayları ekranında izleyin.',
    ],
  },
  {
    id: 'is-akisi',
    title: 'Tekliften sevkiyata iş akışı',
    intro: 'Bir pergola veya cam projesi teklifle başlar ve aynı kayıt üzerinden sevkiyat ve faturaya kadar ilerler.',
    steps: [
      'Teklif — Satış › Teklifler › “Yeni teklif”: müşteriyi seçin, ürünü ölçüleriyle yapılandırın, rengi katalogdan seçin. KDV, döviz (gerekirse “TCMB’den al”) ve indirimleri girin. Firma eşiğini aşan indirim yönetici onayı ister.',
      'Gönderim — Teklifi PDF olarak yazdırın, WhatsApp ile gönderin veya müşteriye onay bağlantısı verin. Durumu “Gönderildi”, “Müşteri onayladı”, “Kabul edildi” ya da “Reddedildi” olarak işaretleyin.',
      'Sipariş — Kabul edilen teklifte “Sipariş dosyasını aç” düğmesine basın. Sipariş açılır; reçetesi olan kalemlerin iş emri kendiliğinden oluşur ve kesim havuzuna girer. Teklifsiz işler için Siparişler ekranındaki “Yeni sipariş” ile doğrudan sipariş de açabilirsiniz.',
      'Teknik plan — Siparişe imalat föyünü yükleyin (Üretim › Kesim listesi). Föy okunur, kesim planı depodaki profil boylarına ve artık parçalara göre çıkarılır. Gerçek engeller düzeltilmeden onay açılmaz; stok eksikliği gibi uyarıları “Uyarıları gördüm” ile kabul edebilirsiniz.',
      'Üretim — Üretim › İş emirleri ve Üretim ekranlarından ilerlemeyi izleyin. Ustalar işlerini Usta ekranından veya Ayarlar › İstasyon tabletleri ile eşlenen atölye tabletlerinden görür; fire ve gecikmeyi nedeniyle kaydeder.',
      'Sevkiyat ve montaj — Üretim › Sevkiyat ekranında teslimatı planlayın; montajlı işleri Üretim › Montaj ekranından ekibe atayın. Müşteri teslimi kendisine gönderilen sayfadan imzalar.',
      'Fatura ve tahsilat — Siparişin “Fatura & tahsilat” sekmesinden fatura kesin ve tahsilatları işleyin. Açık bakiyeler Finans › Alacaklar ekranında görünür.',
    ],
    notes: ['Siparişin teknik dosyaları “Dosyalar”, montaj ve servis kayıtları “Montaj & servis” sekmesinde tutulur.'],
  },
  {
    id: 'ekip',
    title: 'Kullanıcılar ve roller',
    intro: 'Ekip arkadaşlarınızı davet edin; her kişi yalnızca rolünün izin verdiği ekranları ve işlemleri görür.',
    steps: [
      'Yönetim › Ekip › Davetler: e-posta adresini ve rolü seçerek davet gönderin. Davet edilen kişi e-postadaki bağlantıyla şifresini belirler.',
      'Temel roller: Firma sahibi, Yönetici, Ofis, Muhasebe, Atölye ve Ekip üyesi. Atölye rolü yalnızca usta ekranını kullanır.',
      'Ekip › Roller: bir temel rolü daraltan özel roller oluşturun (ör. fiyatları görmeyen ofis çalışanı). Menü, kişinin yetkisine göre kendiliğinden süzülür.',
      'Ayrılan bir çalışanı Ekip › Üyeler ekranından pasifleştirin; hesabı artık panele erişemez.',
      'Yönetim › İşlem geçmişi (firma sahibi ve yönetici): sipariş, teklif, müşteri, tahsilat ve ayar değişikliklerinin kim tarafından ve ne zaman yapıldığını görün.',
    ],
  },
  {
    id: 'asistan',
    title: 'Asistan ve AI ofis',
    intro: 'Yapay zekâ özellikleri firma yöneticisi açmadan modele bağlanmaz. Kişisel veriler (ad, e-posta, telefon, T.C. kimlik no, IBAN) modele gönderilmeden önce maskelenir.',
    steps: [
      'Ayarlar › Asistan: çalışma modunu seçin (kapalı, yalnız kurallar veya yapay zekâ), KVKK onayını verin ve isterseniz günlük bütçe tanımlayın.',
      'Genel › Asistan: “geciken işler”, “profil stoğu”, “şu müşteriye teklif taslağı hazırla” gibi komutlar yazın. Kayıt değiştiren her komut önce önizleme olarak gelir ve sizin onayınızla uygulanır.',
      'Her ekrandan Cmd+K (Windows’ta Ctrl+K) ile arama açın ve “Asistana sor” seçeneğini kullanın.',
      'Asistanın öneri kartları geciken işler, eksik malzeme ve benzeri durumları dayanağıyla gösterir; kartı onaylayabilir, erteleyebilir veya bir daha önermemesini isteyebilirsiniz.',
      'Genel › AI ofis: görevi kendi cümlelerinizle yazın. Ofis müdürü görevin türüne ve zorluğuna karar verip uygun çalışana verir; iş yönetici kontrolünden geçtikten sonra dosya olarak teslim edilir. Firma sahibi, yönetici, ofis ve muhasebe rolleri kullanabilir.',
    ],
    notes: ['Yapay zekânın hazırladığı taslak ve öneriler yardımcı niteliktedir; onaylamadan önce kontrol edin.'],
  },
  {
    id: 'e-fatura',
    title: 'e-Fatura ve muhasebe ayarları',
    intro: 'Faturalarda satıcı olarak yazılacak bilgiler ve e-Belge numaralandırması firma ayarlarından yönetilir.',
    steps: [
      'Ayarlar › Fatura: ticari unvan, vergi dairesi, vergi numarası, açık adres, ticaret sicil no ve fatura e-postasını girin. e-Fatura ve e-Arşiv için zorunlu alanlar işaretlidir.',
      'e-Fatura ve e-Arşiv seri öneklerini belirleyin: üç büyük harf; numara önek + yıl + 9 haneden oluşur.',
      'Faturalar UBL-TR 1.2 biçiminde hazırlanır. GİB’e gönderim, firmanız için özel entegratör bağlantısı kurulduğunda açılır; kurulum için bizimle iletişime geçin.',
      'Finans › Muhasebe: faturalar ve tahsilatlar yevmiyeye kendiliğinden işlenir; mizanı, banka ekstresi içe aktarmayı (CSV, MT940, OFX) ve KDV dönem özetini buradan kullanırsınız.',
    ],
  },
  {
    id: 'veri',
    title: 'Verilerinizi dışa aktarma ve KVKK talepleri',
    intro: 'Verileriniz size aittir; ihtiyaç duyduğunuzda dışarı alabilirsiniz.',
    steps: [
      'Siparişler ekranında listeyi veya seçtiğiniz siparişleri CSV olarak indirin; Yönetim › Raporlar ekranında “CSV indir” kullanın.',
      'Bir müşteriniz KVKK başvurusu yaptığında Ayarlar › KVKK ekranına kaydedin; başvurular en geç 30 gün içinde yanıtlanmalıdır.',
      'Müşteri kartından o kişinin “Veri dökümü (JSON)” dosyasını indirin veya kaydını silin. Silmede kişisel veriler anonimleştirilir; kanunen saklanması gereken faturalar ve muhasebe kayıtları korunur.',
      `Hesabınızın tüm verilerinin teslimi veya silinmesi için ${privacyEmail()} adresine yazın.`,
    ],
  },
];

export default function Page() {
  return (
    <MarketingStandardPage pageKey="docs" hideHighlights>
      <div className="grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Rehber bölümleri" className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Bu rehberde</p>
          <ol className="mt-3 space-y-1.5">
            {[...GUIDES, { id: 'destek', title: 'Destek' }].map((guide) => (
              <li key={guide.id}><a href={`#${guide.id}`} className="text-[13px] leading-5 text-muted-foreground hover:text-foreground">{guide.title}</a></li>
            ))}
          </ol>
        </nav>
        <article className="max-w-3xl">
          {GUIDES.map((guide, index) => (
            <section key={guide.id} id={guide.id} className={`scroll-mt-24 ${index ? 'mt-14' : ''}`}>
              <h2 className="text-[21px] font-semibold tracking-[-0.03em]">
                <a href={`#${guide.id}`} className="hover:underline">{guide.title}</a>
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-muted-foreground">{guide.intro}</p>
              {guide.steps && (
                <ol className="mt-4 list-decimal space-y-2.5 pl-5 marker:text-muted-foreground">
                  {guide.steps.map((step) => <li key={step} className="text-[14.5px] leading-7 text-muted-foreground">{step}</li>)}
                </ol>
              )}
              {guide.notes?.map((note) => <p key={note} className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-[13.5px] leading-6 text-muted-foreground">{note}</p>)}
            </section>
          ))}
          <section id="destek" className="mt-14 scroll-mt-24">
            <h2 className="text-[21px] font-semibold tracking-[-0.03em]"><a href="#destek" className="hover:underline">Destek</a></h2>
            <p className="mt-3 text-[15px] leading-7 text-muted-foreground">Takıldığınız bir adım olursa bize ulaşın{COMPANY.hours ? ` (${COMPANY.hours})` : ''}.</p>
            <ul className="mt-4 space-y-2 text-[14.5px] leading-7 text-muted-foreground">
              <li>E-posta: <a href={`mailto:${COMPANY.email}`} className="font-medium text-foreground underline underline-offset-4">{COMPANY.email}</a></li>
              {COMPANY.phone && <li>Telefon: <a href={telHref(COMPANY.phone)} className="font-medium text-foreground underline underline-offset-4">{COMPANY.phone}</a></li>}
              {COMPANY.whatsapp && <li>WhatsApp: <a href={whatsappHref(COMPANY.whatsapp)} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-4">{COMPANY.whatsapp}</a></li>}
              <li>Servis durumu: <a href="/status" className="font-medium text-foreground underline underline-offset-4">Sistem durumu</a> · Son değişiklikler: <a href="/changelog" className="font-medium text-foreground underline underline-offset-4">Sürüm notları</a></li>
            </ul>
          </section>
        </article>
      </div>
    </MarketingStandardPage>
  );
}
