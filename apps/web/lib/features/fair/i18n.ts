import { CONFIGURATOR_TEXT_TR, type ConfiguratorText } from '@/lib/features/product-3d/text';
import type { FairKind } from './products';

export const LOCALES = ['en', 'de', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', de: 'Deutsch', tr: 'Türkçe' };
export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
export const INTL_LOCALE: Record<Locale, string> = { en: 'en-GB', de: 'de-DE', tr: 'tr-TR' };

const PRODUCT_NAMES: Record<Locale, Record<FairKind, string>> = {
  tr: {
    makasli: 'WINMAX Makaslı Tente', pergola: 'Pergola Tente', 'rolling-roof': 'Rolling Roof', zip: 'Zip Perde', giyotin: 'Motorlu Giyotin Cam',
    'wind-manual': 'Manuel Rüzgâr Kırıcı', 'wind-piston': 'Pistonlu Rüzgâr Kırıcı', 'glass-roof': 'Cam Tavan', 'sliding-glass': 'Sürme Cam',
    bioclimatic: 'Biyoklimatik Tavan', 'winter-garden': 'Kış Bahçesi', cassette: 'Kasetli Tente',
  },
  en: {
    makasli: 'WINMAX Folding-Arm Awning', pergola: 'Pergola Awning', 'rolling-roof': 'Rolling Roof', zip: 'Zip Screen', giyotin: 'Motorised Guillotine Glass',
    'wind-manual': 'Manual Wind Breaker', 'wind-piston': 'Piston Wind Breaker', 'glass-roof': 'Glass Roof', 'sliding-glass': 'Sliding Glass',
    bioclimatic: 'Bioclimatic Pergola', 'winter-garden': 'Winter Garden', cassette: 'Cassette Awning',
  },
  de: {
    makasli: 'WINMAX Gelenkarmmarkise', pergola: 'Pergola-Markise', 'rolling-roof': 'Rolling Roof', zip: 'Zip-Screen', giyotin: 'Motorisiertes Guillotine-Glas',
    'wind-manual': 'Manueller Windschutz', 'wind-piston': 'Windschutz mit Kolben', 'glass-roof': 'Glasdach', 'sliding-glass': 'Schiebeglas',
    bioclimatic: 'Bioklimatische Pergola', 'winter-garden': 'Wintergarten', cassette: 'Kassettenmarkise',
  },
};

/** One line on what each product is for, under its photo. Descriptive only: no technical claims. */
const PRODUCT_PITCH: Record<Locale, Record<FairKind, string>> = {
  tr: {
    makasli: 'Restoran ve kafe terasları için kumandalı makaslı tente', pergola: 'Katlanır kumaş tavanıyla dört mevsim teras', 'rolling-roof': 'Açılıp kapanan lamelli tavan',
    zip: 'Yan zip kanallı dikey perde', giyotin: 'Dikey açılan motorlu cam sistemi', 'wind-manual': 'Teraslar için yükseltilebilir cam rüzgâr kırıcı',
    'wind-piston': 'Teleskopik dikmeli, iki seviyeli cam rüzgâr kırıcı', 'glass-roof': 'Gün ışığını içeri alan cam tavan', 'sliding-glass': 'Ayrı kanallarda kayan cam paneller',
    bioclimatic: 'Döner lamellerle ışık ve hava kontrolü', 'winter-garden': 'Cam tavan ve sürme cepheyle kapalı yaşam alanı', cassette: 'Kapalı kasetli, şık duvar tentesi',
  },
  en: {
    makasli: 'Remote-controlled folding-arm awning for restaurant and café terraces', pergola: 'A four-season terrace under a retractable fabric roof', 'rolling-roof': 'Louvred roof that opens and closes',
    zip: 'Vertical screen running in side zip guides', giyotin: 'Motorised glass that opens vertically', 'wind-manual': 'Height-adjustable glass wind breaker for terraces',
    'wind-piston': 'Two-level glass wind breaker on telescopic posts', 'glass-roof': 'A glass roof that lets the daylight in', 'sliding-glass': 'Glass panels sliding on separate tracks',
    bioclimatic: 'Rotating louvres to control light and air', 'winter-garden': 'An enclosed living space with glass roof and sliding front', cassette: 'Elegant wall awning in a closed cassette',
  },
  de: {
    makasli: 'Fernbedienbare Gelenkarmmarkise für Restaurant- und Caféterrassen', pergola: 'Ganzjahresterrasse unter einem faltbaren Stoffdach', 'rolling-roof': 'Lamellendach, das sich öffnet und schließt',
    zip: 'Senkrechtscreen in seitlichen Zip-Führungen', giyotin: 'Motorisch senkrecht öffnende Verglasung', 'wind-manual': 'Höhenverstellbarer Glas-Windschutz für Terrassen',
    'wind-piston': 'Zweistufiger Glas-Windschutz mit Teleskopstützen', 'glass-roof': 'Ein Glasdach, das Tageslicht hereinlässt', 'sliding-glass': 'Glasschiebeelemente auf getrennten Schienen',
    bioclimatic: 'Drehbare Lamellen für Licht und Luft', 'winter-garden': 'Geschlossener Wohnraum mit Glasdach und Schiebefront', cassette: 'Elegante Wandmarkise in geschlossener Kassette',
  },
};

/** Colour names are stored in Turkish (the workspace's language); they are shown translated. */
const COLOR_NAMES: Record<Exclude<Locale, 'tr'>, Record<string, string>> = {
  en: { Antrasit: 'Anthracite', Beyaz: 'White', Gri: 'Grey', Siyah: 'Black', Kahverengi: 'Brown', 'Kırık beyaz': 'Off-white', 'Kum beji': 'Sand beige', Bordo: 'Burgundy', 'Orman yeşili': 'Forest green' },
  de: { Antrasit: 'Anthrazit', Beyaz: 'Weiß', Gri: 'Grau', Siyah: 'Schwarz', Kahverengi: 'Braun', 'Kırık beyaz': 'Cremeweiß', 'Kum beji': 'Sandbeige', Bordo: 'Bordeaux', 'Orman yeşili': 'Waldgrün' },
};

const CONFIGURATOR_EN: ConfiguratorText = {
  ...CONFIGURATOR_TEXT_TR,
  views: { perspective: 'Perspective', front: 'Front', top: 'Top', side: 'Side', under: 'Below', detail: 'Close-up', mechanism: 'Mechanism' },
  resetCamera: 'Reset camera', fullscreen: 'Open 3D view full screen', loading: 'Loading 3D view…', preparing: 'Preparing the product view…',
  sceneLost: '3D view was interrupted. Your selections are kept.', sceneFailed: '3D view could not start on this device. Your selections are kept.',
  loadFailed: 'The product view could not be loaded.', playToggle: 'Play or stop the opening animation', opening: 'Opening', tilt: 'Louvre angle',
  glassHeight: 'Glass height', open: 'Open', closed: 'Closed', high: 'High', low: 'Low', viewOptions: 'View options', angle: 'Angle', light: 'Light',
  dayNight: 'Day / night', day: 'Day', sunset: 'Sunset', night: 'Night', disclaimer: 'Illustrative 3D view; not an installation drawing.',
  sizeAndColor: 'Size and colour', features: 'Product features', millimetres: 'All dimensions in millimetres.', width: 'Width', projection: 'Projection',
  mountingHeight: 'Mounting height', height: 'Height', bodyColor: 'Frame colour', customBodyColor: 'Custom frame colour', fabricColor: 'Fabric colour',
  fabricType: 'Fabric type', screen: 'Screen', opaque: 'Opaque', glass: 'Glass', singleGlass: 'Single glazing', insulatedGlass: 'Double glazing',
  mounting: 'Mounting', freeStanding: 'Free-standing', wallMounted: 'Wall-mounted', floorFixed: 'Fixed to floor', planter: 'Planter on wheels',
  led: 'LED', ledOff: 'No LED', ledWarm: 'Warm white', ledWhite: 'Cool white', brightness: 'Brightness', motor: 'Motor and control',
  motorRemote: 'UBESER · remote control', motorRemoteWall: 'UBESER · remote + wall switch',
  colorName: (n) => COLOR_NAMES.en[n] ?? n,
  bodyAria: 'Frame colour', fabricAria: 'Fabric colour', openingAria: 'Opening', anglesAria: 'Camera angles', dayNightAria: 'Day / night', brightnessAria: 'LED brightness',
};
const CONFIGURATOR_DE: ConfiguratorText = {
  ...CONFIGURATOR_TEXT_TR,
  views: { perspective: 'Perspektive', front: 'Vorne', top: 'Oben', side: 'Seite', under: 'Unten', detail: 'Nahansicht', mechanism: 'Mechanik' },
  resetCamera: 'Kamera zurücksetzen', fullscreen: '3D-Ansicht im Vollbild öffnen', loading: '3D-Ansicht wird geladen…', preparing: 'Produktansicht wird vorbereitet…',
  sceneLost: 'Die 3D-Ansicht wurde unterbrochen. Ihre Auswahl bleibt erhalten.', sceneFailed: '3D-Ansicht kann auf diesem Gerät nicht starten. Ihre Auswahl bleibt erhalten.',
  loadFailed: 'Die Produktansicht konnte nicht geladen werden.', playToggle: 'Öffnungsanimation starten oder stoppen', opening: 'Öffnung', tilt: 'Lamellenwinkel',
  glassHeight: 'Glashöhe', open: 'Offen', closed: 'Geschlossen', high: 'Hoch', low: 'Niedrig', viewOptions: 'Ansichtsoptionen', angle: 'Winkel', light: 'Licht',
  dayNight: 'Tag / Nacht', day: 'Tag', sunset: 'Sonnenuntergang', night: 'Nacht', disclaimer: 'Illustrative 3D-Ansicht; keine Montagezeichnung.',
  sizeAndColor: 'Maße und Farbe', features: 'Produktmerkmale', millimetres: 'Alle Maße in Millimetern.', width: 'Breite', projection: 'Ausfall',
  mountingHeight: 'Montagehöhe', height: 'Höhe', bodyColor: 'Rahmenfarbe', customBodyColor: 'Eigene Rahmenfarbe', fabricColor: 'Stofffarbe',
  fabricType: 'Stoffart', screen: 'Screen', opaque: 'Blickdicht', glass: 'Verglasung', singleGlass: 'Einfachverglasung', insulatedGlass: 'Isolierverglasung',
  mounting: 'Montage', freeStanding: 'Freistehend', wallMounted: 'Wandmontage', floorFixed: 'Bodenbefestigt', planter: 'Pflanzkübel mit Rollen',
  led: 'LED', ledOff: 'Ohne LED', ledWarm: 'Warmweiß', ledWhite: 'Kaltweiß', brightness: 'Helligkeit', motor: 'Motor und Steuerung',
  motorRemote: 'UBESER · Fernbedienung', motorRemoteWall: 'UBESER · Fernbedienung + Wandtaster',
  colorName: (n) => COLOR_NAMES.de[n] ?? n,
  bodyAria: 'Rahmenfarbe', fabricAria: 'Stofffarbe', openingAria: 'Öffnung', anglesAria: 'Kamerawinkel', dayNightAria: 'Tag / Nacht', brightnessAria: 'LED-Helligkeit',
};
const CONFIGURATOR: Record<Locale, ConfiguratorText> = { tr: CONFIGURATOR_TEXT_TR, en: CONFIGURATOR_EN, de: CONFIGURATOR_DE };

const STATUS_EN = { new: 'New', reviewing: 'In review', quoted: 'Quote prepared', sent: 'Sent', accepted: 'Accepted', rejected: 'Rejected' };

const UI = {
  en: {
    tagline: 'Discover, customize and experience our products in 3D.',
    start: 'Start designing', chooseProduct: 'Choose a product', chooseProductHint: 'Select a product, then adjust its size, colours and features in 3D.',
    categories: { roof: 'Roofs and pergolas', glass: 'Glass systems', screen: 'Screens and awnings' },
    heroTitle: 'No need to collect business cards.', heroText: "Configure the product you want, in the size you want, right now. We'll send you a quote with special fair prices.", heroCta: 'Start configuring', heroSteps: ['Choose a product', 'Set size and colour in 3D', 'Get your fair-price quote'], stepLabels: ['Product', 'Design', 'Quote'],
    viewDesign: 'View my design', emailPending: 'Your design stays available under this page link. Keep it to come back any time.', notFoundHint: 'The link may be incomplete. Start a new design instead; it only takes a minute.', quoteFor: (n: number) => `${n} product${n === 1 ? '' : 's'} in your request`, scanSteps: ['Open your phone camera', 'Point it at the code', 'Request your fair-price quote'], kioskPrivacy: 'No personal details are asked for on this screen.', requiredHint: 'Fields marked * are required.',
    allProducts: 'All products', featured: 'Featured', designThis: 'Design this', touchToStart: 'Touch the screen to start', designIn3d: 'Design it in 3D',
    back: 'Back', quantity: 'Quantity', pieces: (n: number) => `${n} pc${n === 1 ? '' : 's'}`, addToList: 'Add to my list', saveChanges: 'Save changes',
    preparingPreview: 'Preparing the view…', otherRequests: 'Other requests for this product (optional)', control: 'Drive and control',
    myList: 'My list', listTitle: 'Your designs', listEmpty: 'Your list is empty. Choose a product to start.', addAnother: 'Add another product',
    edit: 'Edit', remove: 'Remove', maxItems: (n: number) => `Up to ${n} products per design.`,
    continueOnPhone: 'Continue on my phone', scanTitle: 'Continue on your phone', scanHint: 'Your design opens on your phone. Adjust it there and request your quote.',
    done: 'Finish', resetIn: (s: number) => `This screen resets in ${s} s.`, stillThere: 'Are you still there?', stillThereHint: (s: number) => `The screen will reset in ${s} seconds.`,
    keepGoing: 'Continue', startOver: 'Start over', fullscreen: 'Full screen',
    savedOnline: 'Design saved.', savedOffline: 'Offline: the design is inside the QR code. The phone needs its own internet connection to open it.',
    pendingSync: (n: number) => `${n} design(s) waiting to sync`, offlineBadge: 'Offline',
    loadingDesign: 'Opening your design…', designNotFound: 'This design link was not found.', designIntro: 'Your design', designIntroHint: 'Everything you selected is saved under this link. Keep it to come back later.',
    getQuote: 'Get a price quote', keepEditing: 'Continue editing', backToList: 'Back to my list', copyLink: 'Copy link', copied: 'Link copied',
    saving: 'Saving…', saveFailed: 'Could not save your changes. Check your connection and try again.', savedAt: 'Saved',
    quoteTitle: 'Request a price quote', quoteHint: 'Our sales team prepares your quote and sends it to you.',
    fields: { contactName: 'Full name', email: 'E-mail', phone: 'Phone', companyName: 'Company', location: 'Country / city', note: 'Additional note' },
    required: 'required', notePlaceholder: 'Installation site, timing, questions…',
    privacyTitle: 'Privacy notice (KVKK / GDPR)', privacyAck: 'I have read the privacy notice on how my details are used to prepare my quote.',
    marketing: 'I would like to receive news and offers by e-mail, phone or SMS (optional).', send: 'Send quote request', sending: 'Sending…',
    sendFailed: 'Your request could not be sent. Please try again.', invalid: 'Please check the highlighted fields.', offlineSend: 'You are offline. Connect to the internet to send your request.',
    thanksTitle: 'Thank you — your request has been received', requestNumber: 'Request number',
    emailSent: (e: string) => `We have sent a confirmation with your design link to ${e}.`,
    emailNotSent: 'We could not send the confirmation e-mail. Please keep this page link to reopen your design.',
    thanksHint: 'Our sales team will prepare your quote and contact you.', newDesign: 'Start a new design',
    sizeOutOfRange: 'This size is outside the configurable range for this product.', mm: 'mm', web: 'Product configurator',
    status: STATUS_EN,
  },
  de: {
    tagline: 'Entdecken, gestalten und erleben Sie unsere Produkte in 3D.',
    start: 'Jetzt gestalten', chooseProduct: 'Produkt wählen', chooseProductHint: 'Wählen Sie ein Produkt und passen Sie Maße, Farben und Ausstattung in 3D an.',
    categories: { roof: 'Dächer und Pergolen', glass: 'Glassysteme', screen: 'Screens und Markisen' },
    heroTitle: 'Visitenkarten sammeln? Nicht nötig.', heroText: 'Konfigurieren Sie jetzt das gewünschte Produkt in Ihrem Wunschmaß. Wir erstellen Ihnen ein Angebot zu Messepreisen.', heroCta: 'Jetzt konfigurieren', heroSteps: ['Produkt wählen', 'Maße und Farbe in 3D einstellen', 'Angebot zu Messepreisen erhalten'], stepLabels: ['Produkt', 'Gestaltung', 'Angebot'],
    viewDesign: 'Entwurf ansehen', emailPending: 'Ihr Entwurf bleibt unter dem Link dieser Seite verfügbar. Bewahren Sie ihn auf.', notFoundHint: 'Der Link ist möglicherweise unvollständig. Starten Sie einfach einen neuen Entwurf.', quoteFor: (n: number) => `${n} Produkt${n === 1 ? '' : 'e'} in Ihrer Anfrage`, scanSteps: ['Handykamera öffnen', 'Auf den Code richten', 'Angebot zu Messepreisen anfordern'], kioskPrivacy: 'Auf diesem Bildschirm werden keine persönlichen Daten abgefragt.', requiredHint: 'Mit * markierte Felder sind Pflichtfelder.',
    allProducts: 'Alle Produkte', featured: 'Empfohlen', designThis: 'Dieses gestalten', touchToStart: 'Bildschirm berühren und starten', designIn3d: 'In 3D gestalten',
    back: 'Zurück', quantity: 'Anzahl', pieces: (n: number) => `${n} Stk.`, addToList: 'Zu meiner Liste', saveChanges: 'Änderungen speichern',
    preparingPreview: 'Ansicht wird vorbereitet…', otherRequests: 'Weitere Wünsche zu diesem Produkt (optional)', control: 'Antrieb und Steuerung',
    myList: 'Meine Liste', listTitle: 'Ihre Entwürfe', listEmpty: 'Ihre Liste ist leer. Wählen Sie ein Produkt.', addAnother: 'Weiteres Produkt hinzufügen',
    edit: 'Bearbeiten', remove: 'Entfernen', maxItems: (n: number) => `Bis zu ${n} Produkte pro Entwurf.`,
    continueOnPhone: 'Auf meinem Handy weitermachen', scanTitle: 'Auf dem Handy weitermachen', scanHint: 'Ihr Entwurf öffnet sich auf Ihrem Handy. Dort anpassen und Angebot anfordern.',
    done: 'Fertig', resetIn: (s: number) => `Dieser Bildschirm wird in ${s} s zurückgesetzt.`, stillThere: 'Sind Sie noch da?', stillThereHint: (s: number) => `Der Bildschirm wird in ${s} Sekunden zurückgesetzt.`,
    keepGoing: 'Weiter', startOver: 'Neu beginnen', fullscreen: 'Vollbild',
    savedOnline: 'Entwurf gespeichert.', savedOffline: 'Offline: Der Entwurf steckt im QR-Code. Das Handy braucht eine eigene Internetverbindung zum Öffnen.',
    pendingSync: (n: number) => `${n} Entwurf/Entwürfe warten auf Synchronisierung`, offlineBadge: 'Offline',
    loadingDesign: 'Ihr Entwurf wird geöffnet…', designNotFound: 'Dieser Entwurfslink wurde nicht gefunden.', designIntro: 'Ihr Entwurf', designIntroHint: 'Ihre gesamte Auswahl ist unter diesem Link gespeichert. Bewahren Sie ihn auf.',
    getQuote: 'Preisangebot anfordern', keepEditing: 'Weiter bearbeiten', backToList: 'Zurück zur Liste', copyLink: 'Link kopieren', copied: 'Link kopiert',
    saving: 'Wird gespeichert…', saveFailed: 'Änderungen konnten nicht gespeichert werden. Bitte Verbindung prüfen.', savedAt: 'Gespeichert',
    quoteTitle: 'Preisangebot anfordern', quoteHint: 'Unser Vertriebsteam erstellt Ihr Angebot und sendet es Ihnen zu.',
    fields: { contactName: 'Vor- und Nachname', email: 'E-Mail', phone: 'Telefon', companyName: 'Firma', location: 'Land / Stadt', note: 'Zusätzliche Hinweise' },
    required: 'Pflichtfeld', notePlaceholder: 'Montageort, Zeitplan, Fragen…',
    privacyTitle: 'Datenschutzhinweis (KVKK / DSGVO)', privacyAck: 'Ich habe den Datenschutzhinweis zur Verwendung meiner Daten für das Angebot gelesen.',
    marketing: 'Ich möchte Neuigkeiten und Angebote per E-Mail, Telefon oder SMS erhalten (optional).', send: 'Angebotsanfrage senden', sending: 'Wird gesendet…',
    sendFailed: 'Ihre Anfrage konnte nicht gesendet werden. Bitte erneut versuchen.', invalid: 'Bitte prüfen Sie die markierten Felder.', offlineSend: 'Sie sind offline. Bitte mit dem Internet verbinden.',
    thanksTitle: 'Vielen Dank — Ihre Anfrage ist eingegangen', requestNumber: 'Anfragenummer',
    emailSent: (e: string) => `Wir haben eine Bestätigung mit Ihrem Entwurfslink an ${e} gesendet.`,
    emailNotSent: 'Die Bestätigungs-E-Mail konnte nicht gesendet werden. Bitte speichern Sie den Link dieser Seite.',
    thanksHint: 'Unser Vertriebsteam erstellt Ihr Angebot und meldet sich bei Ihnen.', newDesign: 'Neuen Entwurf beginnen',
    sizeOutOfRange: 'Dieses Maß liegt außerhalb des konfigurierbaren Bereichs.', mm: 'mm', web: 'Produktkonfigurator',
    status: { new: 'Neu', reviewing: 'In Prüfung', quoted: 'Angebot erstellt', sent: 'Gesendet', accepted: 'Angenommen', rejected: 'Abgelehnt' },
  },
  tr: {
    tagline: 'Ürünlerimizi 3D olarak keşfedin, tasarlayın ve deneyimleyin.',
    start: 'Tasarlamaya başla', chooseProduct: 'Ürün seçin', chooseProductHint: 'Ürünü seçin; ölçü, renk ve özelliklerini 3D olarak ayarlayın.',
    categories: { roof: 'Tavan ve pergola', glass: 'Cam sistemleri', screen: 'Perde ve tente' },
    heroTitle: 'Kartvizit biriktirmenize gerek yok.', heroText: 'Hemen istediğiniz ürünü, istediğiniz ölçülerde konfigüre edin. Fuara özel fiyatlarla size teklif yapalım.', heroCta: 'Konfigüre etmeye başla', heroSteps: ['Ürünü seçin', '3D olarak ölçü ve rengi ayarlayın', 'Fuara özel teklifinizi alın'], stepLabels: ['Ürün', 'Tasarım', 'Teklif'],
    viewDesign: 'Tasarımı görüntüle', emailPending: 'Tasarımınız bu sayfanın bağlantısında saklı. Dilediğiniz zaman dönmek için saklayın.', notFoundHint: 'Bağlantı eksik ya da hatalı olabilir. Yeni bir tasarıma başlayabilirsiniz; bir dakikanızı alır.', quoteFor: (n: number) => `Talebinizde ${n} ürün var`, scanSteps: ['Telefonunuzun kamerasını açın', 'Kodu okutun', 'Fuara özel teklifinizi isteyin'], kioskPrivacy: 'Bu ekranda kişisel bilgi istenmez.', requiredHint: '* ile işaretli alanlar zorunludur.',
    allProducts: 'Tüm ürünler', featured: 'Öne çıkan', designThis: 'Bunu tasarla', touchToStart: 'Başlamak için ekrana dokunun', designIn3d: '3D olarak tasarlayın',
    back: 'Geri', quantity: 'Adet', pieces: (n: number) => `${n} adet`, addToList: 'Listeme ekle', saveChanges: 'Değişiklikleri kaydet',
    preparingPreview: 'Görünüm hazırlanıyor…', otherRequests: 'Bu ürünle ilgili diğer istekleriniz (isteğe bağlı)', control: 'Tahrik ve kontrol',
    myList: 'Listem', listTitle: 'Tasarımlarınız', listEmpty: 'Listeniz boş. Bir ürün seçerek başlayın.', addAnother: 'Başka ürün ekle',
    edit: 'Düzenle', remove: 'Çıkar', maxItems: (n: number) => `Bir tasarımda en fazla ${n} ürün olabilir.`,
    continueOnPhone: 'Telefonumda devam et', scanTitle: 'Telefonunuzda devam edin', scanHint: 'Tasarımınız telefonunuzda açılır. Ölçüleri orada değiştirebilir, fiyat teklifinizi isteyebilirsiniz.',
    done: 'Bitir', resetIn: (s: number) => `Ekran ${s} sn sonra sıfırlanacak.`, stillThere: 'Hâlâ orada mısınız?', stillThereHint: (s: number) => `Ekran ${s} saniye sonra sıfırlanacak.`,
    keepGoing: 'Devam et', startOver: 'Baştan başla', fullscreen: 'Tam ekran',
    savedOnline: 'Tasarım kaydedildi.', savedOffline: 'Çevrimdışı: tasarım QR kodun içinde. Telefonun açabilmesi için kendi internet bağlantısı gerekir.',
    pendingSync: (n: number) => `${n} tasarım eşitlenmeyi bekliyor`, offlineBadge: 'Çevrimdışı',
    loadingDesign: 'Tasarımınız açılıyor…', designNotFound: 'Bu tasarım bağlantısı bulunamadı.', designIntro: 'Tasarımınız', designIntroHint: 'Seçtiğiniz her şey bu bağlantıda saklı. Daha sonra dönmek için saklayın.',
    getQuote: 'Fiyat teklifi al', keepEditing: 'Düzenlemeye devam et', backToList: 'Listeme dön', copyLink: 'Bağlantıyı kopyala', copied: 'Bağlantı kopyalandı',
    saving: 'Kaydediliyor…', saveFailed: 'Değişiklikler kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.', savedAt: 'Kaydedildi',
    quoteTitle: 'Fiyat teklifi isteyin', quoteHint: 'Satış ekibimiz teklifinizi hazırlayıp size iletir.',
    fields: { contactName: 'Ad soyad', email: 'E-posta', phone: 'Telefon', companyName: 'Firma adı', location: 'Ülke / şehir', note: 'Ek not' },
    required: 'zorunlu', notePlaceholder: 'Uygulama yeri, zaman planı, sorularınız…',
    privacyTitle: 'KVKK / GDPR aydınlatma metni', privacyAck: 'Bilgilerimin teklif hazırlamak için nasıl işleneceğine dair aydınlatma metnini okudum.',
    marketing: 'Kampanya ve yeniliklerden e-posta, telefon veya SMS ile haberdar olmak istiyorum (isteğe bağlı).', send: 'Teklif talebini gönder', sending: 'Gönderiliyor…',
    sendFailed: 'Talebiniz gönderilemedi. Lütfen tekrar deneyin.', invalid: 'Lütfen işaretli alanları kontrol edin.', offlineSend: 'Çevrimdışısınız. Talebi göndermek için internete bağlanın.',
    thanksTitle: 'Teşekkürler — talebiniz alındı', requestNumber: 'Talep numarası',
    emailSent: (e: string) => `Tasarım bağlantınızı içeren onay e-postasını ${e} adresine gönderdik.`,
    emailNotSent: 'Onay e-postası gönderilemedi. Tasarımınızı yeniden açmak için bu sayfanın bağlantısını saklayın.',
    thanksHint: 'Satış ekibimiz teklifinizi hazırlayıp sizinle iletişime geçecek.', newDesign: 'Yeni tasarım başlat',
    sizeOutOfRange: 'Bu ölçü, ürünün yapılandırılabilir aralığının dışında.', mm: 'mm', web: 'Ürün konfigüratörü',
    status: { new: 'Yeni', reviewing: 'İnceleniyor', quoted: 'Teklif hazırlandı', sent: 'Gönderildi', accepted: 'Kabul edildi', rejected: 'Reddedildi' },
  },
} satisfies Record<Locale, unknown>;
export type FairText = (typeof UI)['en'];

export function fairText(locale: Locale): FairText {
  return UI[locale] as FairText;
}
export function configuratorText(locale: Locale, kind: FairKind): Partial<ConfiguratorText> {
  const base = CONFIGURATOR[locale];
  return { ...base, productName: kind === 'makasli' && locale === 'tr' ? 'WINMAX / MAKASLI TENTE' : PRODUCT_NAMES[locale][kind] };
}
export const productName = (locale: Locale, kind: FairKind) => PRODUCT_NAMES[locale][kind];
export const productPitch = (locale: Locale, kind: FairKind) => PRODUCT_PITCH[locale][kind];
export const colorName = (locale: Locale, name: string) => CONFIGURATOR[locale].colorName(name);

/** The firm is the data controller; raise the version when the text changes. */
export const PRIVACY_VERSION = 'configurator-1.0';
export function privacyNotice(locale: Locale, firm: string): string[] {
  const who = firm || 'Renk Alüminyum';
  if (locale === 'de')
    return [
      `${who} verarbeitet als Verantwortlicher Ihren Namen, Ihre Kontaktdaten, Firma, Ort und Ihre Produktauswahl ausschließlich, um Ihr Preisangebot zu erstellen und Sie dazu zu kontaktieren (Art. 6 Abs. 1 lit. b DSGVO; KVKK Art. 5/2-c).`,
      'Ihre Daten werden nicht verkauft und nur an Dienstleister für Hosting und E-Mail-Versand im notwendigen Umfang weitergegeben. Nach Abschluss werden sie für die gesetzlichen Fristen aufbewahrt und danach gelöscht oder anonymisiert.',
      'Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Widerspruch. Die Einwilligung in Werbung ist freiwillig und jederzeit widerrufbar.',
    ];
  if (locale === 'tr')
    return [
      `${who}, veri sorumlusu olarak adınızı, iletişim bilgilerinizi, firma ve konum bilginizi ve ürün seçimlerinizi yalnızca fiyat teklifinizi hazırlamak ve bu konuda sizinle iletişim kurmak amacıyla işler (KVKK m. 5/2-c; GDPR m. 6/1-b).`,
      'Verileriniz satılmaz; yalnızca barındırma ve e-posta hizmeti aldığımız tedarikçilerle gerektiği ölçüde paylaşılır. Talep sonuçlandıktan sonra mevzuattaki süreler boyunca saklanır, ardından silinir veya anonimleştirilir.',
      'Bilgi talep etme, düzeltme, silme ve itiraz haklarınızı kullanabilirsiniz. Pazarlama izni isteğe bağlıdır ve istediğiniz zaman geri alınabilir.',
    ];
  return [
    `${who}, as data controller, processes your name, contact details, company, location and product selection only to prepare your price quote and to contact you about it (GDPR Art. 6(1)(b); KVKK Art. 5/2-c).`,
    'Your data is never sold and is shared only with our hosting and e-mail providers as far as needed. After your request is closed it is kept for the statutory periods, then deleted or anonymised.',
    'You have the right to access, rectify, erase and object. Marketing consent is optional and can be withdrawn at any time.',
  ];
}
