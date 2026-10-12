import { COMPANY, companyLegalName, privacyEmail } from '@/lib/core/company';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'İşlenen kişisel veriler',
    body: [
      'Kimlik ve iletişim: ad, soyad, e-posta adresi ve isteğe bağlı olarak telefon numarası.',
      'Hesap ve güvenlik: şifrenin geri döndürülemez özeti, oturum bilgileri, IP adresi, tarayıcı bilgisi ve önemli işlemlere ait denetim kayıtları.',
      'İletişim talepleri: bize e-posta veya bülten formu ile ilettiğiniz bilgiler.',
      'Çerezler: oturum ve tercih çerezleri; analitik çerezler yalnızca onay vermeniz halinde.',
    ],
  },
  {
    title: 'İşleme amaçları ve hukuki sebepler',
    body: [
      'Hesabınızı oluşturmak, platformu sunmak ve sözleşmeden doğan yükümlülüklerimizi yerine getirmek (KVKK m. 5/2-c).',
      'Hesap güvenliğini sağlamak, kötüye kullanımı önlemek ve yasal saklama yükümlülüklerine uymak (KVKK m. 5/2-ç ve 5/2-f).',
      'Taleplerinize yanıt vermek ve talep etmeniz halinde ürün duyurularını iletmek (KVKK m. 5/2-f; ticari ileti için açık onayınız).',
      'Site kullanımını anonim olarak ölçmek (KVKK m. 5/1, açık rıza; çerez tercihlerinizden dilediğiniz an geri alabilirsiniz).',
    ],
  },
  {
    title: 'Aktarım',
    body: [
      'Veriler yalnızca hizmetin sunulması için gerekli olduğu ölçüde barındırma, veritabanı ve e-posta gönderimi hizmeti aldığımız tedarikçilerle paylaşılır. Bu tedarikçilerin bir kısmının sunucuları yurt dışında bulunduğundan aktarım KVKK m. 9 kapsamındaki şartlara uygun olarak yapılır.',
      'Yasal bir zorunluluk olması halinde yetkili kamu kurum ve kuruluşlarıyla paylaşılabilir.',
    ],
  },
  {
    title: 'Firma verileri',
    body: [
      'Platformu kullanan firmaların kendi müşteri, sipariş ve personel kayıtları ilgili firmanın sorumluluğundadır; RenkFlow bu kayıtları yalnızca firmanın talimatıyla ve hizmetin sunulması amacıyla veri işleyen sıfatıyla işler.',
    ],
  },
  {
    title: 'Saklama süresi',
    body: [
      'Kişisel veriler, işleme amacının gerektirdiği süre ve ilgili mevzuatta öngörülen zamanaşımı süreleri boyunca saklanır; süre sonunda silinir, yok edilir veya anonim hale getirilir.',
    ],
  },
  {
    title: 'Haklarınız',
    body: [
      'KVKK m. 11 uyarınca kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, işleme amacını öğrenme, aktarıldığı kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini, silinmesini veya yok edilmesini isteme, bu işlemlerin aktarılan kişilere bildirilmesini isteme, otomatik analiz sonucuna itiraz etme ve kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme haklarına sahipsiniz.',
    ],
  },
];

/** KVKK aydınlatma metni (Law No. 6698, art. 10) rendered on the privacy page. */
export function KvkkNotice() {
  const email = privacyEmail();
  const registry = [
    COMPANY.mersisNo && `MERSİS No: ${COMPANY.mersisNo}`,
    COMPANY.taxOffice && COMPANY.taxNumber && `${COMPANY.taxOffice} V.D. ${COMPANY.taxNumber}`,
  ].filter(Boolean);

  return (
    <article className="mt-16 max-w-3xl">
      <h2 className="text-[22px] font-semibold tracking-[-0.03em]">KVKK aydınlatma metni</h2>
      <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
        6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu sıfatıyla{' '}
        <strong className="font-medium text-foreground">{companyLegalName()}</strong>
        {COMPANY.address ? ` (${COMPANY.address})` : ''}, RenkFlow web sitesi ve platformu aracılığıyla işlenen kişisel verileriniz hakkında sizi bilgilendirir.
      </p>
      {registry.length > 0 && <p className="mt-2 text-[13px] text-muted-foreground">{registry.join(' · ')}</p>}

      {SECTIONS.map((section) => (
        <section key={section.title} className="mt-10">
          <h3 className="text-[16px] font-semibold tracking-[-0.02em]">{section.title}</h3>
          <ul className="mt-3 space-y-2.5">
            {section.body.map((line) => (
              <li key={line} className="text-[14.5px] leading-7 text-muted-foreground">{line}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-10">
        <h3 className="text-[16px] font-semibold tracking-[-0.02em]">Başvuru</h3>
        <p className="mt-3 text-[14.5px] leading-7 text-muted-foreground">
          Haklarınıza ilişkin taleplerinizi{' '}
          <a href={`mailto:${email}?subject=KVKK%20ba%C5%9Fvurusu`} className="font-medium text-foreground underline underline-offset-4">{email}</a>{' '}
          adresine{COMPANY.address ? ' veya yukarıdaki adrese yazılı olarak' : ''} iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz olarak yanıtlanır.
        </p>
      </section>
    </article>
  );
}
