/**
 * Renk Alüminyum's standard terms of sale and of cancellation / return, as the firm wrote them. The
 * text is the firm's own legal wording: it is kept word for word and not edited by the program.
 *
 * It is appended to every quotation of the firm (print / PDF and the customer's approval page), so
 * what the customer approves includes these terms. Other firms do not get it: the terms belong to
 * the firm that wrote them (see `standardTermsFor`).
 */

export type TermClause = { no: string; title?: string; text?: string; subs?: Array<{ no: string; label: string; text: string }> };
export type TermGroup = { title: string; clauses: TermClause[] };
export type StandardTerms = { groups: TermGroup[]; signature: string };

export const RENK_TERMS: StandardTerms = {
  signature: 'RENK ALÜMİNYUM',
  groups: [
    {
      title: 'Genel satış koşulları',
      clauses: [
        { no: '1', title: 'Taraflar ve Konu', text: 'İşbu sözleşme, pergola tente, kış bahçesi ve benzeri dış mekan sistemlerinin satışı, üretimi ve (varsa) montajı ile ilgili şartları belirler.' },
        {
          no: '2', title: 'Ödeme Şartları',
          subs: [
            { no: '2.1', label: 'Fabrika Teslim (EXW) Satışlar', text: "Toplam tutarın %50'si siparişin onaylanmasıyla peşin olarak tahsil edilir. Kalan %50'lik kısım, üretim tamamlandığında ve mallar fabrikada teslime hazır hale geldiğinde (fabrika tesliminden önce) satıcının hesabına ödenir. Ödeme gerçekleşmeden sevkiyata izin verilmez." },
            { no: '2.2', label: 'Montaj Dahil Satışlar', text: "Toplam tutarın %50'si sipariş onayı ile peşin alınır. %35'lik ikinci kısım üretim bittiğinde, sevkiyat öncesi tahsil edilir. Kalan %15'lik son kısım ise montajın tamamlanıp alıcıya teslim edilmesi ile birlikte ödenir." },
            { no: '2.3', label: 'Gecikmeli Ödeme', text: 'Ödeme tarihlerinin gecikmesi durumunda, satıcı hiçbir ihbara gerek kalmaksızın yasal temerrüt faizi uygulama hakkına sahiptir. Ödeme yapılana kadar sevkiyat veya montaj durdurulur.' },
          ],
        },
        { no: '3', title: 'Ölçü Sorumluluğu ve Teknik Onay', text: 'Alıcının projelendirdiği işlerde alıcı, montaj yapılacak alanın nihai ölçülerini satıcıya yazılı olarak bildirmekle yükümlüdür. Ölçülerin alıcı tarafından hatalı alınmasından kaynaklanan uyumsuzluklarda tüm üretim, modifikasyon ve nakliye masrafları alıcıya aittir. Üretime başlanmadan önce satıcı tarafından hazırlanan teknik çizimler alıcıya onaylatılır; onaylanan çizimler üzerinden yapılan üretimlerde sonradan değişiklik yapılamaz.' },
        { no: '4', title: 'Renk, Kumaş ve Malzeme Toleransları', text: 'Kullanılan boyalı profiller ve kumaşlar uluslararası üretim ve boya toleranslarına tabidir. Farklı boya partilerinden veya ışık açılarından kaynaklanan ton farklılıkları, teknik şartname sınırları içerisinde kalması kaydıyla kusur sayılmaz. Onaylanan numune veya renk kodundan sonra yapılacak değişiklikler maliyetlendirilir ve süre uzatımına neden olur.' },
        {
          no: '5', title: 'Teslimat, Lojistik ve Hasar Sorumluluğu',
          subs: [
            { no: '5.1', label: 'Teslim Şekli', text: 'Sözleşmede belirtilen Incoterms 2020 kuralı (EXW, DAP vb.) geçerlidir.' },
            { no: '5.2', label: 'Nakliye Hasarları', text: 'Nakliye sırasında oluşabilecek hasarlar için sorumluluk ilgili Incoterms kuralına aittir. Malın teslimi sırasında ambalajda veya üründe hasar görülmesi durumunda, alıcı nakliyeci huzurunda tutanak tutmak ve aynı gün satıcıyı bilgilendirmek zorundadır. Tutanaksız bildirimler garanti kapsamı dışındadır.' },
          ],
        },
        { no: '6', title: 'Ambalajlama ve Konteyner Yükleme', text: 'Ürünlerin uluslararası nakliyeye uygun olarak ambalajlanması zorunludur. Alıcının özel paketleme talepleri ek maliyetlendirilir.' },
        { no: '7', title: 'Depolama ve Demuraj Ücretleri', text: "Üretimi tamamlanan ve alıcıya sevkiyata hazır bildirimi yapılan ürünler, azami 14 gün süreyle satıcının deposunda ücretsiz depolanır. Bu süreyi aşan gecikmelerde, alıcıdan toplam tutar üzerinden haftalık %0.5 depolama ve finansman bedeli tahsil edilir." },
        { no: '8', title: 'Montaj ve Saha Koşulları', text: 'Montaj hizmetinin dahil olduğu satışlarda, alıcı montaj sahasını (zemin, altyapı, elektrik beslemesi vb.) montaja uygun hale getirmekle yükümlüdür. Sahanın hazır olmaması veya alıcı kaynaklı engeller nedeniyle montajın gecikmesi durumunda, bekleyen ekibin masrafları alıcıya fatura edilir.' },
        { no: '9', title: 'Gümrükleme ve Mevzuat Uyumluluğu', text: 'Alıcı, ürünlerin kendi ülkesindeki ithalat mevzuatına, gümrük vergilerine, CE belgeleri ve yapı malzemeleri yönetmelikleri gibi standartlara uygunluğundan bizzat sorumludur. İthalat izninin çıkmaması veya gümrükte yaşanan süreçler siparişin iptaline veya ödemenin tamamlanmamasına gerekçe olamaz.' },
      ],
    },
    {
      title: 'İptal ve iade koşulları',
      clauses: [
        { no: '10', title: 'İade ve Değişim Yasağı', text: 'Özel ölçü ve projeye dayalı olarak üretilen sistemlerde cayma hakkı veya gerekçesiz iade söz konusu değildir. Ürünler ancak imalat hatalı olması durumunda garanti şartları çerçevesinde onarılır; komple ürün iadesi kabul edilmez.' },
        { no: '11', title: 'Garanti Şartları ve Sınırlamaları', text: 'Ürünler mekanik ve yapısal olarak 2 yıl imalat hatalarına karşı garantilidir. Alıcının veya üçüncü şahısların hatalı kullanımı, yetkisiz kişilerin müdahalesi, aşırı hava koşulları (fırtına, kar yükü sınırı aşımları) veya talimatlara aykırı bakım yapılmasından kaynaklanan arızalar garanti kapsamı dışındadır.' },
        { no: '12', title: 'Gizlilik ve Fikri Mülkiyet Hakları', text: 'Satıcı tarafından paylaşılan tüm teknik çizimler, özel tasarım detayları, fiyat teklifleri ve projeler satıcının mülkiyetindedir. Alıcı bu bilgileri üçüncü taraflarla ve rakiplerle paylaşamaz, kopyalayamaz.' },
        { no: '13', title: 'Mücbir Sebepler', text: 'Savaş, grev, doğal afetler, genel salgın hastalıklar ve gümrük rejimlerindeki yasal kısıtlamalar gibi tarafların iradesi dışında gerçekleşen öngörülemez durumlarda tarafların sözleşme yükümlülükleri askıya alınır.' },
        { no: '14', title: 'Elektronik İletişim ve Delil', text: 'Taraflar arasında e-posta, WhatsApp ve benzeri dijital kanallar üzerinden yapılan yazışmalar ve teknik onaylar geçerli yazılı delil olarak kabul edilir.' },
        { no: '15', title: 'Uyuşmazlıkların Çözümü', text: 'İşbu sözleşmeden doğacak uyuşmazlıklarda Satıcının merkezinin bulunduğu ülke/şehir mahkemeleri ve icra daireleri yetkilidir.' },
      ],
    },
  ],
};

/**
 * The standard terms that belong to a firm, or null. They are Renk Alüminyum's own wording, so only
 * that firm's quotations carry them (the same name convention that picks the firm's logo); another
 * firm's quotation is not given terms it never wrote.
 */
export function standardTermsFor(firmName: string | null | undefined): StandardTerms | null {
  const name = (firmName ?? '').toLocaleLowerCase('tr-TR');
  return name.includes('renk alüminyum') || name.includes('renk aluminyum') ? RENK_TERMS : null;
}
