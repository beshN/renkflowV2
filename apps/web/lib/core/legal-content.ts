import { COMPANY, companyLegalName, privacyEmail } from '@/lib/core/company';

/**
 * The three public legal texts: Kullanım Koşulları (/terms), Gizlilik ve KVKK Aydınlatma Metni
 * (/privacy) and Çerez Politikası (/cookies). Company facts come only from lib/core/company.ts;
 * an empty field there drops the sentence or falls back to a neutral wording, never a placeholder.
 *
 * When a text changes: raise its `version`, set `updatedAt`, and keep the cookie table in step
 * with the code (Auth.js cookie names, components/shared/ui/CookieConsent.tsx, localStorage keys).
 */
export type LegalBlock =
  | string
  | { list: string[] }
  | { table: { caption: string; head: string[]; rows: string[][] } };

export type LegalSection = { id: string; title: string; blocks: LegalBlock[] };

export type LegalDocumentKey = 'terms' | 'privacy' | 'cookies';

export type LegalDocument = {
  key: LegalDocumentKey;
  title: string;
  version: string;
  /** ISO date (YYYY-MM-DD). */
  updatedAt: string;
  intro: string[];
  sections: LegalSection[];
};

const legalName = companyLegalName();
const contactEmail = privacyEmail();
const join = (parts: Array<string | false | null | undefined>, separator = ', ') => parts.filter(Boolean).join(separator);

/** "Unvan, adres (MERSİS ..., vergi ...)" — only the facts the company file holds. */
const registry = join([
  COMPANY.mersisNo && `MERSİS No: ${COMPANY.mersisNo}`,
  COMPANY.tradeRegistry,
  COMPANY.taxOffice && COMPANY.taxNumber && `${COMPANY.taxOffice} Vergi Dairesi ${COMPANY.taxNumber}`,
]);
const identity = `${legalName}${COMPANY.address ? `, ${COMPANY.address}` : ''}${registry ? ` (${registry})` : ''}`;
const contactLines = [
  COMPANY.address && `Posta: ${COMPANY.address}`,
  `E-posta: ${contactEmail}`,
  COMPANY.kepAddress && `KEP: ${COMPANY.kepAddress}`,
  COMPANY.phone && `Telefon: ${COMPANY.phone}${COMPANY.hours ? ` (${COMPANY.hours})` : ''}`,
].filter(Boolean) as string[];
const courts = COMPANY.jurisdiction
  ? `${COMPANY.jurisdiction} mahkemeleri ve icra daireleri`
  : 'Hizmet Sağlayıcının kanuni merkezinin bulunduğu yer mahkemeleri ve icra daireleri';

export const LEGAL_UPDATED_AT = '2026-10-26';

export const termsDocument: LegalDocument = {
  key: 'terms',
  title: 'Kullanım Koşulları ve Hizmet Sözleşmesi',
  version: '1.0',
  updatedAt: LEGAL_UPDATED_AT,
  intro: [
    `Bu metin, ${COMPANY.brand} yazılım hizmetinin (“Hizmet”) kullanımına ilişkin koşulları düzenler. Hizmete erişen veya hesap açan firma, bu koşulları okuduğunu ve kabul ettiğini beyan eder.`,
  ],
  sections: [
    {
      id: 'taraflar',
      title: '1. Taraflar ve tanımlar',
      blocks: [
        `Hizmet Sağlayıcı: ${identity}. Bu metinde “${COMPANY.brand}” veya “Hizmet Sağlayıcı” olarak anılır.`,
        'Müşteri: Hizmeti kullanmak üzere hesap açan veya Hizmet Sağlayıcı ile teklif ya da sözleşme yoluyla anlaşan tüzel ya da gerçek kişi tacir.',
        'Kullanıcı: Müşterinin, Hizmeti kendi adına kullanması için yetkilendirdiği çalışan veya temsilci.',
        'Müşteri Verisi: Müşteri ve Kullanıcılarının Hizmete girdiği ya da yüklediği her türlü kayıt, belge ve dosya (müşteri, teklif, sipariş, stok, üretim, finans ve personel kayıtları dahil).',
        'Bu koşullar, Müşteri ile ayrıca imzalanan teklif veya sözleşmeyle birlikte uygulanır. Aralarında çelişki olması hâlinde, Müşteri ile yazılı olarak kararlaştırılan özel hükümler önceliklidir.',
      ],
    },
    {
      id: 'kapsam',
      title: '2. Hizmetin kapsamı',
      blocks: [
        `${COMPANY.brand}, pergola, cam ve benzeri ölçüye özel üretim yapan firmalar için teklif, sipariş, üretim, stok, sevkiyat, montaj ve finans süreçlerinin yönetildiği, internet üzerinden sunulan bir yazılımdır (SaaS).`,
        'Müşterinin kullanabileceği modüller, Kullanıcı sayısı, kurulum ve destek kapsamı teklifte veya sözleşmede belirtilir. Teklifte yer almayan modüller ayrıca anlaşılmadıkça kapsam dışındadır.',
        'Hizmet Sağlayıcı, Hizmeti geliştirmek amacıyla özellik ekleyebilir, değiştirebilir veya kaldırabilir. Müşterinin kullandığı temel bir işlevi kaldıran değişiklikler, makul bir süre önceden bildirilir.',
        'Yapay zekâ destekli özellikler (Asistan, AI ofis, belge okuma ve öneriler) yardımcı niteliktedir. Bu özelliklerin ürettiği taslak, öneri ve hesaplar Kullanıcı tarafından kontrol edilmeli; onaylanan işlemlerin sorumluluğu Müşteriye aittir.',
      ],
    },
    {
      id: 'hesap',
      title: '3. Hesap ve güvenlik',
      blocks: [
        'Hesabı açan kişi, Müşteriyi temsile yetkili olduğunu beyan eder. Hesap bilgileri doğru ve güncel tutulmalıdır.',
        'Kullanıcıların davet edilmesi, rollerinin ve yetkilerinin belirlenmesi, hesaplarının pasifleştirilmesi Müşterinin firma sahibi veya yöneticisi tarafından yapılır. Kullanıcıların işlemlerinden Müşteri sorumludur.',
        'Şifreler kişiye özeldir ve paylaşılmamalıdır. İki adımlı doğrulamanın açılması önerilir. Yetkisiz bir erişimden şüphelenildiğinde Müşteri, ilgili oturumları kapatmalı ve gecikmeksizin Hizmet Sağlayıcıya bildirmelidir.',
        'Hizmet Sağlayıcı, hesap güvenliğini tehdit eden durumlarda (ör. ele geçirilmiş hesap, olağan dışı giriş denemeleri) ilgili oturumu veya Kullanıcıyı geçici olarak durdurabilir ve Müşteriyi bilgilendirir.',
      ],
    },
    {
      id: 'kullanim',
      title: '4. Kullanım kuralları',
      blocks: [
        'Müşteri ve Kullanıcılar Hizmeti yürürlükteki mevzuata ve bu koşullara uygun kullanmayı kabul eder. Özellikle şunlar yasaktır:',
        {
          list: [
            'Hizmete, başka bir firmanın verisine veya Hizmet Sağlayıcının sistemlerine yetkisiz erişim girişiminde bulunmak, güvenlik önlemlerini aşmaya çalışmak.',
            'Hizmetin işleyişini bozacak yoğunlukta otomatik istek göndermek, zararlı yazılım veya içerik yüklemek.',
            'Hizmeti üçüncü kişilere kiralamak, yeniden satmak ya da Hizmet Sağlayıcının yazılı izni olmadan rakip bir ürün geliştirmek amacıyla incelemek.',
            'Hukuka aykırı, üçüncü kişilerin haklarını ihlal eden veya hukuka aykırı elde edilmiş kişisel veri içeren kayıtlar oluşturmak.',
          ],
        },
        'Bu kuralların ağır veya tekrarlanan ihlalinde Hizmet Sağlayıcı, ihlali gidermek için gerekli ölçüde erişimi askıya alabilir; durum Müşteriye gerekçesiyle bildirilir.',
      ],
    },
    {
      id: 'veri',
      title: '5. Müşteri Verisinin mülkiyeti ve kullanımı',
      blocks: [
        'Müşteri Verisi Müşteriye aittir. Hizmet Sağlayıcı bu veriler üzerinde mülkiyet iddia etmez; verileri yalnızca Hizmeti sunmak, desteklemek, güvenliğini sağlamak ve kanuni yükümlülüklerini yerine getirmek amacıyla işler.',
        'Müşteri Verisi içindeki kişisel veriler bakımından Müşteri veri sorumlusu, Hizmet Sağlayıcı veri işleyendir. Hizmet Sağlayıcı bu verileri Müşterinin talimatları doğrultusunda ve 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ile ilgili mevzuata uygun olarak işler. Ayrıntılar Gizlilik ve KVKK Aydınlatma Metninde yer alır.',
        'Müşteri, Hizmete girdiği kişisel veriler için ilgili kişileri aydınlatmak ve gerektiğinde açık rızalarını almakla yükümlüdür.',
        'Hizmet Sağlayıcı, Müşteri Verisini satmaz, reklam amacıyla kullanmaz ve yapay zekâ modellerinin eğitimi için üçüncü kişilere vermez. Yapay zekâ özelliklerinde model sağlayıcısına gönderilen metindeki kişisel veriler önceden maskelenir.',
        'Hizmetin iyileştirilmesi için kişiyi veya Müşteriyi tanımlamayan, toplu kullanım istatistikleri kullanılabilir.',
      ],
    },
    {
      id: 'ucret',
      title: '6. Ücretlendirme ve teklif usulü',
      blocks: [
        'Hizmet çevrim içi satın alınmaz; internet sitesi üzerinden ödeme alınmaz. Ücret; modüller, Kullanıcı sayısı, kurulum ve destek kapsamına göre Müşteriye özel hazırlanan yazılı teklifle belirlenir.',
        'Teklif, üzerinde yazan geçerlilik süresi içinde Müşterinin yazılı kabulüyle (e-posta dahil) kesinleşir. Kabul edilen teklifteki ücret, dönem ve ödeme koşulları taraflar için bağlayıcıdır.',
        'Faturalar teklifte belirtilen dönemlerde düzenlenir. Teklifte aksi yazmadıkça ücretlere KDV dahil değildir.',
        'Ödemenin vadesinde yapılmaması hâlinde Hizmet Sağlayıcı yazılı bildirimde bulunur; bildirimden itibaren makul bir süre içinde ödeme yapılmazsa Hizmeti askıya alabilir. Askı süresince Müşteri Verisi silinmez.',
        'Ücretlerde değişiklik, ancak yeni dönem için yapılabilir ve en az 30 gün önceden yazılı olarak bildirilir.',
      ],
    },
    {
      id: 'hizmet-seviyesi',
      title: '7. Hizmet seviyesi, bakım ve destek',
      blocks: [
        'Hizmet Sağlayıcı, Hizmetin kesintisiz ve hatasız çalışması için makul ticari özeni gösterir. Belirli bir erişilebilirlik oranı ancak teklifte veya sözleşmede yazılıysa taahhüt edilmiş sayılır.',
        'Planlı bakım çalışmaları mümkün olduğunca mesai saatleri dışında yapılır ve önceden duyurulur. Anlık servis durumu /status sayfasında yayımlanır.',
        `Destek talepleri ${COMPANY.email} adresine${COMPANY.phone ? ` veya ${COMPANY.phone} numarasına` : ''} iletilebilir${COMPANY.hours ? `; destek saatleri: ${COMPANY.hours}` : ''}.`,
        'Hizmet Sağlayıcının kontrolü dışındaki sebeplerden (mücbir sebep, altyapı veya barındırma sağlayıcısı kaynaklı geniş çaplı kesintiler, Müşterinin internet bağlantısı veya cihazı) doğan aksaklıklar hizmet seviyesi hesabına katılmaz.',
        'Veriler düzenli olarak yedeklenir. Yedekler, veri kaybına karşı bir güvence olup Müşterinin kendi kayıtlarını dışa aktarma imkânının yerine geçmez.',
      ],
    },
    {
      id: 'fikri-mulkiyet',
      title: '8. Fikri mülkiyet',
      blocks: [
        `${COMPANY.brand} yazılımı, arayüzü, markası, logosu, belgeleri ve bunlar üzerindeki tüm fikri ve sınai haklar Hizmet Sağlayıcıya aittir. Müşteriye, sözleşme süresince ve kendi iç işleri için, devredilemez ve münhasır olmayan bir kullanım hakkı tanınır.`,
        'Müşteri, yazılımı kopyalayamaz, kaynak koduna ulaşmaya çalışamaz, tersine mühendislik yapamaz ve türev eser oluşturamaz (kanunen izin verilen hâller saklıdır).',
        'Müşterinin ilettiği öneri ve geri bildirimler, Müşteriye ait gizli bilgi içermemek kaydıyla, Hizmetin geliştirilmesinde serbestçe kullanılabilir.',
      ],
    },
    {
      id: 'sorumluluk',
      title: '9. Sorumluluğun sınırlandırılması',
      blocks: [
        'Hizmet, teklifte ve bu koşullarda tanımlanan kapsamla sunulur. Hizmet Sağlayıcı, Hizmetin Müşterinin her özel ihtiyacına uygun olacağını garanti etmez.',
        'Hizmet Sağlayıcı; dolaylı zararlardan, kâr kaybından, iş kesintisinden ve Müşteri veya Kullanıcıların hatalı veri girişi ya da yapay zekâ önerilerinin kontrol edilmeden onaylanmasından doğan sonuçlardan sorumlu değildir.',
        'Hizmet Sağlayıcının bu sözleşmeden doğan toplam sorumluluğu, zarara yol açan olaydan önceki 12 ay içinde Müşterinin Hizmet için fiilen ödediği ücret tutarıyla sınırlıdır.',
        'Kasıt veya ağır ihmal hâlinde sorumluluk ile kanunen sınırlandırılamayan sorumluluklar bu sınırlamanın dışındadır (Türk Borçlar Kanunu m. 115).',
      ],
    },
    {
      id: 'fesih',
      title: '10. Süre, fesih ve verilerin iadesi veya silinmesi',
      blocks: [
        'Sözleşme teklifte belirtilen süre için geçerlidir; süre bitiminde taraflardan biri feshetmedikçe aynı koşullarla yenilenir. Taraflar, dönem sonundan en az 30 gün önce yazılı bildirimle sözleşmeyi feshedebilir.',
        'Taraflardan birinin esaslı bir yükümlülüğünü ihlal etmesi ve yazılı ihtara rağmen 15 gün içinde ihlali gidermemesi hâlinde diğer taraf sözleşmeyi derhâl feshedebilir.',
        'Sözleşmenin herhangi bir sebeple sona ermesinden itibaren 30 gün içinde Müşteri, verilerinin yaygın kullanılan, makine tarafından okunabilir bir biçimde (ör. CSV veya JSON) teslim edilmesini isteyebilir.',
        'Bu sürenin dolmasının ardından Müşteri Verisi, yedekler dahil en geç 90 gün içinde silinir veya anonim hâle getirilir. Kanunen saklanması zorunlu kayıtlar (ör. düzenlenmiş faturalar) ilgili süre boyunca saklanır ve süre sonunda imha edilir.',
      ],
    },
    {
      id: 'degisiklikler',
      title: '11. Değişiklikler',
      blocks: [
        'Hizmet Sağlayıcı bu koşulları güncelleyebilir. Müşterinin aleyhine olan esaslı değişiklikler, yürürlüğe girmeden en az 30 gün önce e-posta veya Hizmet içi bildirimle duyurulur. Müşteri bu değişikliği kabul etmezse, yürürlük tarihine kadar sözleşmeyi ek bir bedel ödemeden feshedebilir.',
        'Güncel sürüm ve son güncelleme tarihi bu sayfanın başında yer alır.',
      ],
    },
    {
      id: 'hukuk',
      title: '12. Uygulanacak hukuk ve yetkili mahkeme',
      blocks: [
        'Bu koşullar ve Müşteri ile yapılan sözleşme Türkiye Cumhuriyeti hukukuna tabidir.',
        `Uyuşmazlıkların çözümünde ${courts} yetkilidir.`,
        'Hizmet Sağlayıcının kayıtları (sistem ve işlem kayıtları dahil), Hukuk Muhakemeleri Kanunu m. 193 uyarınca kesin delil niteliğindedir; Müşterinin karşı delil sunma hakkı saklıdır.',
        `Bildirimler, tarafların sözleşmede veya hesapta kayıtlı e-posta adreslerine yapılır${COMPANY.kepAddress ? `; Hizmet Sağlayıcıya resmî bildirimler ${COMPANY.kepAddress} KEP adresine de yapılabilir` : ''}.`,
      ],
    },
  ],
};

export const privacyDocument: LegalDocument = {
  key: 'privacy',
  title: 'Gizlilik Politikası ve KVKK Aydınlatma Metni',
  version: '1.0',
  updatedAt: LEGAL_UPDATED_AT,
  intro: [
    `Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) m. 10 ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca, ${COMPANY.brand} internet sitesi ve platformu aracılığıyla işlenen kişisel verileriniz hakkında sizi bilgilendirmek için hazırlanmıştır.`,
  ],
  sections: [
    {
      id: 'veri-sorumlusu',
      title: '1. Veri sorumlusu',
      blocks: [
        `Veri sorumlusu: ${identity}.`,
        { list: contactLines },
      ],
    },
    {
      id: 'kapsam',
      title: '2. Kapsam ve rollerimiz',
      blocks: [
        'Bu metin şu kişilere ait verileri kapsar: internet sitemizi ziyaret edenler, demo veya teklif talebinde bulunanlar, bize e-posta ya da telefonla ulaşanlar ve platformu kullanan firmaların Kullanıcıları (hesap sahipleri ve davet edilen çalışanlar).',
        `Platformu kullanan firmalar, kendi müşteri, tedarikçi ve personel kayıtlarını ${COMPANY.brand}’a girer. Bu kayıtlar bakımından veri sorumlusu ilgili firmadır; biz bu verileri yalnızca o firmanın talimatıyla ve hizmeti sunmak amacıyla veri işleyen sıfatıyla işleriz. Bir firmanın müşterisi veya çalışanı olarak haklarınızı kullanmak istiyorsanız başvurunuzu öncelikle o firmaya iletmenizi öneririz; bize ulaşan başvuruları gecikmeksizin ilgili firmaya yönlendiririz.`,
      ],
    },
    {
      id: 'kategoriler',
      title: '3. İşlenen kişisel veri kategorileri',
      blocks: [
        {
          list: [
            'Kimlik: ad, soyad; firma yetkilisiyseniz unvanınız.',
            'İletişim: e-posta adresi, telefon numarası, firma adresi.',
            'Müşteri işlem: teklif ve sözleşme bilgileri, destek talepleri ve yazışmalar, fatura bilgileri (ticari unvan, vergi dairesi ve numarası).',
            'İşlem güvenliği: şifrenin geri döndürülemez özeti, iki adımlı doğrulama bilgisi, oturum kayıtları, IP adresi, tarayıcı ve cihaz bilgisi, giriş denemeleri ve önemli işlemlere ait denetim kayıtları.',
            'Kullanım ve teknik veriler: hata kayıtları, sayfa görüntüleme ve kullanım istatistikleri (analitik ölçüm yalnızca onay vermeniz hâlinde).',
            'Pazarlama: ürün duyurularını almak için açıkça onay verdiyseniz e-posta adresiniz ve tercihiniz.',
          ],
        },
        'Özel nitelikli kişisel veri (KVKK m. 6) işlenmesi amaçlanmamaktadır. Mobil uygulamadaki biyometrik kilit (Face ID, parmak izi) tamamen cihazınızda çalışır; biyometrik veriniz bize iletilmez. Platforma özel nitelikli veri girilmemesini öneririz.',
      ],
    },
    {
      id: 'toplama',
      title: '4. Toplama yöntemi',
      blocks: [
        'Kişisel verileriniz; internet sitesi ve platformdaki formlar, hesap oluşturma ve giriş ekranları, e-posta, telefon ve WhatsApp yazışmaları ile platformun kullanımı sırasında otomatik yollarla (sunucu kayıtları, çerezler ve benzeri teknolojiler) elektronik ortamda toplanır.',
      ],
    },
    {
      id: 'amaclar',
      title: '5. İşleme amaçları ve hukuki sebepler',
      blocks: [
        {
          table: {
            caption: 'Amaçlar ve dayandığımız hukuki sebepler',
            head: ['Amaç', 'Hukuki sebep'],
            rows: [
              ['Hesabınızı oluşturmak, platformu sunmak, teklif ve sözleşme süreçlerini yürütmek, destek vermek', 'Sözleşmenin kurulması veya ifası (KVKK m. 5/2-c)'],
              ['Faturalandırma, muhasebe ve vergi kayıtlarını tutmak, yetkili kurumların taleplerini karşılamak', 'Kanunlarda açıkça öngörülme ve hukuki yükümlülük (m. 5/2-a ve 5/2-ç)'],
              ['Hesap ve sistem güvenliğini sağlamak, kötüye kullanımı ve yetkisiz erişimi önlemek, hataları tespit etmek', 'Meşru menfaat (m. 5/2-f); 5651 sayılı Kanun kapsamındaki kayıtlar için hukuki yükümlülük (m. 5/2-ç)'],
              ['Demo, teklif ve iletişim taleplerinize yanıt vermek', 'Sözleşmenin kurulması (m. 5/2-c) ve meşru menfaat (m. 5/2-f)'],
              ['Olası uyuşmazlıklarda hakların tesisi, kullanılması veya korunması', 'Bir hakkın tesisi, kullanılması veya korunması (m. 5/2-e)'],
              ['Site kullanımını ölçmek (analitik çerezler), ürün duyurusu ve ticari ileti göndermek', 'Açık rıza (m. 5/1); ticari ileti için 6563 sayılı Kanun kapsamında onay'],
              ['Yurt dışında bulunan hizmet sağlayıcılarımıza aktarım', 'KVKK m. 9’daki şartlar (aşağıda 6. bölüm)'],
            ],
          },
        },
        'Açık rızanıza dayanan işlemlerde rızanızı dilediğiniz an geri alabilirsiniz. Geri alma, o tarihe kadar yapılan işlemleri etkilemez.',
      ],
    },
    {
      id: 'aktarim',
      title: '6. Kişisel verilerin aktarılması',
      blocks: [
        'Kişisel verileriniz yalnızca yukarıdaki amaçlar için gerekli olduğu ölçüde aktarılır. Yurt içinde; kanunen yetkili kamu kurum ve kuruluşlarına, mahkemelere ve icra dairelerine, mali müşavir, denetçi ve hukuk danışmanlarımıza aktarılabilir.',
        'Platformu sunmak için hizmet aldığımız ve sunucuları yurt dışında bulunan aşağıdaki sağlayıcılara aktarım yapılır. Bu aktarımlar, KVKK m. 9 ve Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik kapsamında, öncelikle uygun güvencelere (özellikle Kurulca ilan edilen standart sözleşmelere) dayanılarak, bunun mümkün olmadığı hâllerde m. 9/6’daki istisnai hâllere uygun olarak yapılır.',
        {
          table: {
            caption: 'Yurt dışındaki hizmet sağlayıcılar (alt işleyenler)',
            head: ['Sağlayıcı', 'Hizmet', 'Aktarılan veriler'],
            rows: [
              ['Vercel Inc. (ABD)', 'Uygulamanın barındırılması, içerik dağıtımı ve dosya depolama', 'Platformdaki tüm kayıtlar ve yüklenen dosyalar, bağlantı bilgileri (IP, tarayıcı)'],
              ['Neon (ABD)', 'Yönetilen PostgreSQL veritabanı', 'Platformdaki tüm kayıtlar'],
              ['Resend Inc. (ABD)', 'İşlem e-postaları (davet, şifre sıfırlama, bildirim)', 'Alıcının adı ve e-posta adresi, e-postanın içeriği'],
              ['Anthropic PBC (ABD)', 'Yapay zekâ özellikleri (Asistan, AI ofis, belge okuma)', 'İsteğin metni; kişisel veriler gönderilmeden önce maskelenir (aşağıya bakın)'],
              ['Functional Software Inc. – Sentry (ABD)', 'Hata izleme', 'Hata anındaki teknik bilgiler; kullanıcı kimliği ve IP adresi gibi bilgiler sınırlı olarak'],
              ['Google LLC (ABD)', 'Google Analytics (yalnız onayınızla); Google ile giriş seçerseniz kimlik doğrulama', 'Anonimleştirilmiş IP ile kullanım verisi; girişte ad ve e-posta adresi'],
              ['Microsoft Corporation (ABD)', 'Microsoft (Entra ID) ile giriş seçerseniz kimlik doğrulama', 'Ad ve e-posta adresi'],
            ],
          },
        },
        'Yapay zekâda kişisel verilerin maskelenmesi: Bir istek yapay zekâ modeline gönderilmeden önce sunucumuzda; e-posta adresleri, telefon numaraları, T.C. kimlik numaraları, IBAN’lar ve bilinen müşteri, kişi ve firma adları [KİŞİ_1] gibi yer tutucularla değiştirilir. Model yalnızca yer tutucuları görür; gerçek değerler yanıt geldikten sonra yine sunucumuzda yerine konur. Firmaların yapay zekâ kullanımı varsayılan olarak kapalıdır veya yalnız kurallarla çalışır; modelin devreye girmesi için firma yöneticisinin Ayarlar › Asistan bölümünden onay vermesi gerekir. Anthropic’in ticari API koşulları gereği, gönderilen veriler modellerin eğitiminde kullanılmaz. Platform varsayılan olarak Anthropic ile çalışır; ileride başka bir model sağlayıcısı devreye alınırsa aynı maskeleme uygulanır ve bu tablo önceden güncellenir.',
      ],
    },
    {
      id: 'saklama',
      title: '7. Saklama süreleri',
      blocks: [
        'Kişisel veriler, işleme amacının gerektirdiği süre ve aşağıdaki kanuni süreler boyunca saklanır; süre sonunda Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca silinir, yok edilir veya anonim hâle getirilir.',
        {
          table: {
            caption: 'Saklama süreleri',
            head: ['Veri', 'Süre'],
            rows: [
              ['Hesap ve Kullanıcı bilgileri', 'Hesap açık kaldığı sürece; sözleşmenin sona ermesinden sonra Kullanım Koşullarındaki veri iadesi ve silme süreleri'],
              ['Sözleşme, teklif ve yazışmalar', 'Sözleşme süresince ve sona ermesinden itibaren 10 yıl (Türk Borçlar Kanunu m. 146 genel zamanaşımı)'],
              ['Fatura ve muhasebe kayıtları', '10 yıl (Türk Ticaret Kanunu m. 82; Vergi Usul Kanunu m. 253)'],
              ['Erişim ve işlem güvenliği kayıtları', 'En az 1, en çok 2 yıl (5651 sayılı Kanun ve ilgili yönetmelik)'],
              ['Demo, teklif ve iletişim talepleri', 'Talep sonuçlandıktan sonra 2 yıl; sözleşmeye dönüşürse sözleşme kayıtlarıyla birlikte'],
              ['Analitik çerez verileri', 'Çerez Politikasında belirtilen süreler'],
              ['Araç konum kayıtları (firma verisi)', 'Firmanın ayarladığı süre; ayarlanmamışsa 365 gün'],
            ],
          },
        },
        'Platformu kullanan firmaların kayıtları, ilgili firmanın talimatına göre saklanır. Bir firma müşterisinin kaydını sildiğinde kişisel veriler anonimleştirilir; kanunen saklanması gereken faturalar ve muhasebe kayıtları değiştirilmeden saklanmaya devam eder.',
      ],
    },
    {
      id: 'guvenlik',
      title: '8. Veri güvenliği',
      blocks: [
        'KVKK m. 12 uyarınca verilerinizin güvenliği için şu teknik ve idari tedbirleri alırız: tüm trafiğin HTTPS üzerinden şifrelenmesi, şifrelerin geri döndürülemez biçimde saklanması, iki adımlı doğrulama seçeneği, rol bazlı yetkilendirme, her kaydın bir firmaya bağlı tutulması ve panelde yalnızca oturumdaki firmanın verisinin gösterilmesi, önemli işlemlerin denetim kaydına alınması, giriş denemelerinin sınırlandırılması ve düzenli yedekleme.',
      ],
    },
    {
      id: 'haklar',
      title: '9. İlgili kişi olarak haklarınız (KVKK m. 11)',
      blocks: [
        'Veri sorumlusuna başvurarak:',
        {
          list: [
            'kişisel verilerinizin işlenip işlenmediğini öğrenme,',
            'işlenmişse buna ilişkin bilgi talep etme,',
            'işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,',
            'yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,',
            'eksik veya yanlış işlenmişse düzeltilmesini isteme,',
            'KVKK m. 7’deki şartlar çerçevesinde silinmesini veya yok edilmesini isteme,',
            'düzeltme, silme veya yok etme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme,',
            'işlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,',
            'kanuna aykırı işleme sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme',
          ],
        },
        'haklarına sahipsiniz.',
      ],
    },
    {
      id: 'basvuru',
      title: '10. Başvuru yöntemi',
      blocks: [
        'Başvurunuzu, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ’e uygun olarak; adınız, soyadınız, T.C. kimlik numaranız (yabancıysanız uyruğunuz ve pasaport numaranız), tebligata esas adresiniz, varsa e-posta adresiniz ve telefon numaranız ile talebinizin konusunu belirterek aşağıdaki yollardan biriyle iletebilirsiniz:',
        {
          list: [
            COMPANY.address ? `Islak imzalı dilekçeyle ${COMPANY.address} adresine şahsen veya posta yoluyla,` : 'Islak imzalı dilekçeyle şirket adresimize şahsen veya posta yoluyla,',
            COMPANY.kepAddress ? `Kayıtlı elektronik posta (KEP) ile ${COMPANY.kepAddress} adresine,` : 'Kayıtlı elektronik posta (KEP), güvenli elektronik imza veya mobil imza ile,',
            `Daha önce bize bildirdiğiniz ve kayıtlarımızda bulunan e-posta adresinizden ${contactEmail} adresine (konu: “KVKK başvurusu”).`,
          ],
        },
        'Başvurular, talebin niteliğine göre en kısa sürede ve en geç 30 gün içinde ücretsiz olarak sonuçlandırılır. İşlemin ayrıca bir maliyet gerektirmesi hâlinde Kişisel Verileri Koruma Kurulunca belirlenen tarifedeki ücret alınabilir. Kimliğinizi doğrulamak için ek bilgi isteyebiliriz.',
        'Başvurunuzun reddedilmesi, verilen cevabı yetersiz bulmanız veya süresinde cevap verilmemesi hâllerinde, cevabı öğrendiğiniz tarihten itibaren 30 gün ve her hâlde başvuru tarihinden itibaren 60 gün içinde Kişisel Verileri Koruma Kuruluna şikâyette bulunabilirsiniz (KVKK m. 14).',
      ],
    },
    {
      id: 'degisiklikler',
      title: '11. Değişiklikler',
      blocks: [
        'Bu metin, mevzuattaki veya veri işleme faaliyetlerimizdeki değişikliklere göre güncellenebilir. Güncel sürüm ve son güncelleme tarihi bu sayfanın başında yer alır; esaslı değişiklikler platform Kullanıcılarına ayrıca duyurulur.',
      ],
    },
  ],
};

/**
 * Cookies and browser storage the site and the platform actually set. Auth.js v5 names its cookies
 * `__Secure-authjs.*` on HTTPS (the CSRF cookie `__Host-authjs.csrf-token`) and `authjs.*` on plain
 * HTTP in development; lib/core/auth.config.ts keeps the default names with a 30-day JWT session.
 */
export const cookieDocument: LegalDocument = {
  key: 'cookies',
  title: 'Çerez Politikası',
  version: '1.0',
  updatedAt: LEGAL_UPDATED_AT,
  intro: [
    `Bu politika, ${COMPANY.brand} internet sitesinde ve platformunda kullanılan çerezleri ve tarayıcıda saklanan benzeri verileri açıklar. Çerezler aracılığıyla işlenen kişisel veriler hakkında ayrıntılı bilgi Gizlilik ve KVKK Aydınlatma Metninde yer alır.`,
  ],
  sections: [
    {
      id: 'cerez-nedir',
      title: '1. Çerez nedir?',
      blocks: [
        'Çerez, ziyaret ettiğiniz internet sitesinin tarayıcınıza kaydettiği küçük bir metin dosyasıdır. Benzer şekilde, bazı ayarlar tarayıcının yerel depolama alanında (localStorage) tutulur. Yerel depolamadaki bilgiler sunucumuza gönderilmez; yalnızca sizin cihazınızda kalır.',
      ],
    },
    {
      id: 'turler',
      title: '2. Kullandığımız çerez türleri',
      blocks: [
        {
          list: [
            'Zorunlu çerezler: Giriş yapmanız, oturumunuzun güvenle sürmesi ve formların kötüye kullanıma karşı korunması için gereklidir. Bu çerezler olmadan platform çalışmaz; KVKK m. 5/2-c ve 5/2-f kapsamında onay aranmadan kullanılır.',
            'İşlevsel tercihler: Tema, dil veya menü düzeni gibi bir ayarı değiştirdiğinizde, yalnızca sizin isteğinizle ve yalnızca yerel depolamada tutulur.',
            'Analitik çerezler: Sitenin nasıl kullanıldığını anonim olarak ölçmek için Google Analytics çerezleridir. Yalnızca çerez bildiriminde “Tümünü kabul et” seçeneğini seçmeniz hâlinde yüklenir (açık rıza, KVKK m. 5/1). “Sadece gerekli” seçeneğinde hiçbir analitik çerez kurulmaz.',
          ],
        },
        'Reklam veya hedefleme çerezi kullanmıyoruz. Hata izleme hizmetimiz (Sentry) çerez kurmaz.',
      ],
    },
    {
      id: 'cerez-listesi',
      title: '3. Çerez listesi',
      blocks: [
        {
          table: {
            caption: 'Çerezler',
            head: ['Ad', 'Amaç', 'Tür', 'Süre'],
            rows: [
              ['__Secure-authjs.session-token', 'Giriş yaptığınızı doğrulayan şifreli oturum bilgisi. Uzun oturumlarda .0, .1 gibi parçalara bölünebilir.', 'Zorunlu', '30 gün; çıkış yapınca silinir'],
              ['__Host-authjs.csrf-token', 'Giriş ve oturum formlarını sahte isteklere (CSRF) karşı korur.', 'Zorunlu', 'Tarayıcı oturumu'],
              ['__Secure-authjs.callback-url', 'Girişten sonra dönülecek sayfayı hatırlar.', 'Zorunlu', 'Tarayıcı oturumu'],
              ['__Secure-authjs.pkce.code_verifier, __Secure-authjs.state', 'Google veya Microsoft ile girişte isteğin size ait olduğunu doğrular.', 'Zorunlu', '15 dakika'],
              ['__Host-rf-station', 'Atölyedeki istasyon tabletinin firmaya eşleşmesini tutar (yalnız eşleştirilen tabletlerde).', 'Zorunlu', '90 gün veya eşleşme kaldırılana kadar'],
              ['_ga', 'Google Analytics: ziyaretçileri anonim olarak ayırt eder.', 'Analitik (onayla)', '2 yıl'],
              ['_ga_<ölçüm kimliği>', 'Google Analytics: oturum durumunu tutar.', 'Analitik (onayla)', '2 yıl'],
            ],
          },
        },
        'Yerel geliştirme ortamında (HTTPS olmadan) oturum çerezleri ön ek olmadan, ör. authjs.session-token ve rf-station-local adıyla kurulur.',
      ],
    },
    {
      id: 'yerel-depolama',
      title: '4. Yerel depolamada tutulan bilgiler',
      blocks: [
        {
          table: {
            caption: 'Yerel depolama (localStorage)',
            head: ['Anahtar', 'Amaç', 'Tür', 'Süre'],
            rows: [
              ['cookie-consent', 'Çerez bildirimindeki seçiminiz ve seçim tarihi.', 'Zorunlu', 'Siz silene veya tercihinizi değiştirene kadar'],
              ['theme', 'Açık, koyu veya sistem teması tercihiniz.', 'İşlevsel tercih', 'Siz silene kadar'],
              ['i18nextLng', 'Arayüz dili tercihiniz.', 'İşlevsel tercih', 'Siz silene kadar'],
              ['rf.sidebar.pinned, menü grubu anahtarları', 'Yan menünün açık veya daraltılmış hâli ve menü gruplarının durumu.', 'İşlevsel tercih', 'Siz silene kadar'],
              ['rf-dashboard-layout', 'Genel bakış ekranındaki kart düzeniniz.', 'İşlevsel tercih', 'Siz silene kadar'],
              ['renkflow_ai_chat:…', 'Asistan sohbet penceresinin bu cihazdaki geçmişi; kullanıcıya ve firmaya özeldir.', 'İşlevsel tercih', 'Sohbeti temizleyene kadar'],
              ['renkflow.office.quality', 'AI ofis görünümü için performans veya kalite modu.', 'İşlevsel tercih', 'Siz silene kadar'],
              ['rf-factory-sound', 'Atölye ekranında sesli bildirimlerin açık veya kapalı olması.', 'İşlevsel tercih', 'Siz silene kadar'],
              ['pwa-install-dismissed', 'Uygulamayı yükleme önerisini kapattığınızı hatırlar.', 'İşlevsel tercih', 'Siz silene kadar'],
            ],
          },
        },
      ],
    },
    {
      id: 'yonetim',
      title: '5. Tercihlerinizi nasıl yönetirsiniz?',
      blocks: [
        'İnternet sitemizi ilk ziyaretinizde çıkan bildirimde “Sadece gerekli” veya “Tümünü kabul et” seçeneklerinden birini seçebilirsiniz. Seçiminizi bu sayfadaki “Çerez tercihlerini sıfırla” düğmesiyle dilediğiniz an değiştirebilirsiniz; bildirim bir sonraki sayfada yeniden gösterilir.',
        'Tarayıcınızın ayarlarından çerezleri ve site verilerini silebilir veya engelleyebilirsiniz. Zorunlu çerezleri engellerseniz platforma giriş yapamazsınız.',
        'Google Analytics ölçümünü tüm sitelerde engellemek için Google’ın tarayıcı eklentisini (tools.google.com/dlpage/gaoptout) kullanabilirsiniz.',
      ],
    },
    {
      id: 'iletisim',
      title: '6. İletişim',
      blocks: [
        `Çerezlerle ilgili sorularınız ve KVKK kapsamındaki talepleriniz için ${contactEmail} adresine yazabilirsiniz.`,
      ],
    },
  ],
};

export const legalDocuments: Record<LegalDocumentKey, LegalDocument> = {
  terms: termsDocument,
  privacy: privacyDocument,
  cookies: cookieDocument,
};
