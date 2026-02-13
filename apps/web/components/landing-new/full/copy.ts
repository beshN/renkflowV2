export type LandingLocale = 'tr' | 'en' | 'ar';

function normalizeLocale(locale: string | undefined): LandingLocale {
  if (locale === 'en' || locale === 'ar') {
    return locale;
  }
  return 'tr';
}

const LANDING_COPY = {
  tr: {
    hero: {
      badge: 'Özel Önizleme',
      titleTop: 'RenkFlow',
      titleAccent: 'Modern Üretim için Operasyon Sistemi',
      description:
        'Siparişten sevkiyata kadar üretim akışınızı tek merkezden yönetin. Darboğazları erken görün, stok risklerini azaltın, ekipleri aynı operasyonda hizalayın.',
      ctaPrimary: 'Dashboard Girişi',
      ctaSecondary: 'Erken Erişim Talebi',
      formPlaceholder: 'İş e-posta adresiniz',
      formSubmit: 'Talep Gönder',
      formSuccess: 'Talebiniz alındı. Uygun olduğunda ekibimiz sizinle iletişime geçecek.',
      formError: 'Lütfen geçerli bir e-posta adresi girin.',
      note: 'Lansman tarihi pilot doğrulama sürecine göre netleşecektir.',
      chips: ['Canlı üretim akışı', 'Çoklu tesis desteği', 'Rol bazlı yetkilendirme'],
    },
    features: {
      overline: 'Temel Modüller',
      title: 'Sahadaki gerçek üretim ihtiyacına göre tasarlandı',
      description:
        'RenkFlow, genel görev yönetim araçları yerine üretim işletmelerinin günlük operasyonuna odaklanır.',
      cards: [
        {
          title: 'Production Tracking',
          description:
            'Her siparişin hangi istasyonda, ne kadar süredir beklediğini gerçek zamanlı izleyin ve kritik gecikmeleri anında görün.',
        },
        {
          title: 'Inventory Management',
          description:
            'Hammadde ve yarı mamul stok seviyelerini üretim planı ile birlikte yönetin, kritik eşiklerde otomatik uyarı alın.',
        },
        {
          title: 'Team Collaboration',
          description:
            'Operatör, planlama ve ofis ekiplerini tek operasyon akışında birleştirip sorumluluk ve karar noktalarını netleştirin.',
        },
      ],
    },
    useCases: {
      overline: 'Operasyon Görünürlüğü',
      title: 'Yönetim kararlarını hızlandıran üç kritik görünüm',
      items: [
        {
          title: 'Canlı Üretim Akışı',
          description:
            'İş emirlerini aşama bazında görün, bekleme süresi uzayan işleri otomatik olarak riskli işaretleyin.',
          bullets: ['Aşama bazlı kuyruk süresi', 'On-time / At-risk / Delayed görünümü'],
        },
        {
          title: 'Gecikme Erken Uyarısı',
          description:
            'Basit hız ve kapasite kurallarıyla gecikmeleri oluşmadan yakalayın ve yöneticilere proaktif bildirim gönderin.',
          bullets: ['Tahmini teslim sapması', 'Yavaşlayan iş istasyonu uyarısı'],
        },
        {
          title: 'Kök Neden Yakalama',
          description:
            'Gecikmeler gerçekleşirken neden bilgisini zorunlu toplayın; malzeme, makine, planlama ve iş gücü bazında raporlayın.',
          bullets: ['Operatör için tek dokunuşlu giriş', 'Yönetim için dönemsel neden analizi'],
        },
      ],
    },
    timeline: {
      overline: 'Zaman Bazlı Analiz',
      title: 'Durum yerine gerçek çevrim süresini yönetin',
      description:
        'Planlanan ve gerçekleşen süreleri aynı çizgide izleyerek kaybın tam olarak hangi aşamada oluştuğunu görün.',
      rows: [
        { stage: 'Kesim', planned: '4s', actual: '5s', state: 'warning' },
        { stage: 'Montaj', planned: '6s', actual: '8s', state: 'critical' },
        { stage: 'Kalite Kontrol', planned: '2s', actual: '2s', state: 'ok' },
        { stage: 'Paketleme', planned: '3s', actual: '3s', state: 'ok' },
      ],
      footer:
        'Bu görünüm çalışan kıyaslamak için değil, süreç darboğazını ortadan kaldırmak için kullanılır.',
    },
    faq: {
      overline: 'Sık Sorulanlar',
      title: 'Satın alma öncesi en kritik sorular',
      items: [
        {
          question: 'RenkFlow kimler için uygundur?',
          answer:
            'Üretim hattı, atölye veya fabrika operasyonu yöneten ekipler için tasarlanmıştır. Genel görev takip kullanımından ziyade fiziksel süreç yönetimine odaklanır.',
        },
        {
          question: 'Mevcut Excel süreçleriyle birlikte kullanılabilir mi?',
          answer:
            'Evet. İlk geçişte Excel/CSV içe aktarma ile başlayabilir, kritik akışlarınızı kademeli olarak platforma taşıyabilirsiniz.',
        },
        {
          question: 'Çoklu tenant ve rol yönetimi nasıl çalışır?',
          answer:
            'Her şirket tenant bazında izole edilir. Rol bazlı yetkiler ve tenant üyeliği doğrulaması tüm kritik endpointlerde zorunludur.',
        },
        {
          question: 'Veriler nerede tutuluyor?',
          answer:
            'Üretim ortamında yalnızca Google Cloud Run + Cloud SQL + GCS mimarisi kullanılır. Gizli anahtarlar Secret Manager üzerinden yönetilir.',
        },
      ],
    },
    cta: {
      title: 'Üretim operasyonunuzu birlikte değerlendirelim',
      description:
        'Demo, pilot planı veya teknik mimari görüşmesi için ekibimize ulaşın. İletişim: info@renkflow.com',
      primary: 'Demo Talep Et',
      secondary: 'Giriş Yap',
    },
  },
  en: {
    hero: {
      badge: 'Private Preview',
      titleTop: 'RenkFlow',
      titleAccent: 'The Operating System for Modern Production',
      description:
        'Run your production flow from order intake to shipment in one control center. Detect bottlenecks early, reduce stock risk, and align teams around the same operation.',
      ctaPrimary: 'Go to Login',
      ctaSecondary: 'Request Early Access',
      formPlaceholder: 'Your work email',
      formSubmit: 'Request Access',
      formSuccess: 'Request received. Our team will contact you when a slot is available.',
      formError: 'Please enter a valid email address.',
      note: 'Launch date depends on pilot validation and rollout readiness.',
      chips: ['Live production flow', 'Multi-site support', 'Role-based authorization'],
    },
    features: {
      overline: 'Core Modules',
      title: 'Built for real factory operations',
      description:
        'RenkFlow is focused on manufacturing workflows, not generic task management.',
      cards: [
        {
          title: 'Production Tracking',
          description:
            'Track every order by workstation and waiting time, and highlight risky delays before they spread.',
        },
        {
          title: 'Inventory Management',
          description:
            'Manage raw material and WIP stock with production plans and receive threshold-based alerts.',
        },
        {
          title: 'Team Collaboration',
          description:
            'Align operators, planners, and office teams in one shared operational workflow with clear accountability.',
        },
      ],
    },
    useCases: {
      overline: 'Operational Visibility',
      title: 'Three views that speed up decisions',
      items: [
        {
          title: 'Live Production Flow',
          description:
            'Monitor work orders by stage and auto-flag jobs that exceed expected queue time.',
          bullets: ['Stage-level queue duration', 'On-time / At-risk / Delayed status'],
        },
        {
          title: 'Delay Early Warning',
          description:
            'Use practical speed and capacity heuristics to predict delays and alert managers proactively.',
          bullets: ['Estimated delivery drift', 'Slow workstation alerts'],
        },
        {
          title: 'Root Cause Capture',
          description:
            'Capture delay reasons in real time under material, machine, planning, and manpower categories.',
          bullets: ['One-tap operator input', 'Trend reporting for managers'],
        },
      ],
    },
    timeline: {
      overline: 'Time-Based Analysis',
      title: 'Manage actual cycle time, not just status',
      description:
        'Compare planned versus actual stage durations to identify exactly where time is lost.',
      rows: [
        { stage: 'Cutting', planned: '4h', actual: '5h', state: 'warning' },
        { stage: 'Assembly', planned: '6h', actual: '8h', state: 'critical' },
        { stage: 'Quality', planned: '2h', actual: '2h', state: 'ok' },
        { stage: 'Packaging', planned: '3h', actual: '3h', state: 'ok' },
      ],
      footer:
        'This view is designed to improve process quality, not to rank individual workers.',
    },
    faq: {
      overline: 'FAQ',
      title: 'Key questions before rollout',
      items: [
        {
          question: 'Who is RenkFlow for?',
          answer:
            'It is built for teams running physical production operations in workshops and factories, not generic office task flows.',
        },
        {
          question: 'Can we start with existing Excel files?',
          answer:
            'Yes. Teams can begin with CSV/Excel imports and migrate critical workflows step by step.',
        },
        {
          question: 'How does multi-tenant security work?',
          answer:
            'Every company is tenant-isolated and role-based authorization is enforced on critical data routes.',
        },
        {
          question: 'Where is production data hosted?',
          answer:
            'Production runs on Google Cloud Run + Cloud SQL + GCS, with secrets managed in Secret Manager.',
        },
      ],
    },
    cta: {
      title: 'Let us review your production operation together',
      description:
        'For demos, pilot planning, or technical architecture reviews, contact us at info@renkflow.com.',
      primary: 'Request Demo',
      secondary: 'Sign In',
    },
  },
  ar: {
    hero: {
      badge: 'معاينة خاصة',
      titleTop: 'RenkFlow',
      titleAccent: 'نظام التشغيل للإنتاج الحديث',
      description:
        'أدر تدفق الإنتاج من استلام الطلب حتى الشحن من مركز تحكم واحد. اكتشف الاختناقات مبكراً وقلّل مخاطر المخزون ونسّق الفرق على نفس العملية.',
      ctaPrimary: 'تسجيل الدخول',
      ctaSecondary: 'طلب وصول مبكر',
      formPlaceholder: 'بريد العمل الإلكتروني',
      formSubmit: 'إرسال الطلب',
      formSuccess: 'تم استلام طلبك. سيتواصل فريقنا معك عند توفر مقعد.',
      formError: 'يرجى إدخال بريد إلكتروني صالح.',
      note: 'موعد الإطلاق يعتمد على نتائج التحقق الميداني وجاهزية النشر.',
      chips: ['تدفق إنتاج مباشر', 'دعم متعدد المواقع', 'صلاحيات حسب الدور'],
    },
    features: {
      overline: 'الوحدات الأساسية',
      title: 'مصمم لواقع التشغيل في المصنع',
      description: 'يركز RenkFlow على عمليات التصنيع الفعلية وليس على إدارة المهام العامة.',
      cards: [
        {
          title: 'تتبع الإنتاج',
          description: 'تابع كل طلب حسب محطة العمل ومدة الانتظار مع إبراز التأخير المحتمل قبل تفاقمه.',
        },
        {
          title: 'إدارة المخزون',
          description: 'أدر المواد الخام والمخزون قيد التصنيع مع خطة الإنتاج وتنبيهات الحد الأدنى.',
        },
        {
          title: 'تعاون الفرق',
          description: 'وحّد فرق التشغيل والتخطيط والمكتب في تدفق تشغيلي واحد مع مسؤوليات واضحة.',
        },
      ],
    },
    useCases: {
      overline: 'رؤية تشغيلية',
      title: 'ثلاثة عروض تسرّع القرار',
      items: [
        {
          title: 'تدفق إنتاج مباشر',
          description: 'راقب أوامر العمل حسب المراحل وحدد الأعمال التي تجاوزت زمن الانتظار المتوقع.',
          bullets: ['زمن الانتظار لكل مرحلة', 'حالة في الموعد / معرض للخطر / متأخر'],
        },
        {
          title: 'إنذار مبكر للتأخير',
          description: 'استخدم قواعد سرعة وسعة عملية للتنبؤ بالتأخير وتنبيه المدراء بشكل استباقي.',
          bullets: ['انحراف التسليم المتوقع', 'تنبيه محطة عمل بطيئة'],
        },
        {
          title: 'التقاط السبب الجذري',
          description: 'سجّل أسباب التأخير لحظياً تحت فئات المواد والآلة والتخطيط والقوى العاملة.',
          bullets: ['إدخال سريع للمشغل', 'تقارير اتجاه للإدارة'],
        },
      ],
    },
    timeline: {
      overline: 'تحليل زمني',
      title: 'أدر الزمن الفعلي للدورة وليس الحالة فقط',
      description: 'قارن الزمن المخطط والفعلي لكل مرحلة لمعرفة مكان فقدان الوقت بدقة.',
      rows: [
        { stage: 'القص', planned: '4س', actual: '5س', state: 'warning' },
        { stage: 'التجميع', planned: '6س', actual: '8س', state: 'critical' },
        { stage: 'الجودة', planned: '2س', actual: '2س', state: 'ok' },
        { stage: 'التغليف', planned: '3س', actual: '3س', state: 'ok' },
      ],
      footer: 'هذا العرض لتحسين العملية وليس لمقارنة الأفراد.',
    },
    faq: {
      overline: 'الأسئلة الشائعة',
      title: 'أسئلة مهمة قبل التفعيل',
      items: [
        {
          question: 'لمن يناسب RenkFlow؟',
          answer: 'للشركات التي تدير عمليات إنتاج فعلية في الورش والمصانع وليس للمهام المكتبية العامة.',
        },
        {
          question: 'هل يمكن البدء بملفات Excel الحالية؟',
          answer: 'نعم. يمكن البدء بالاستيراد من CSV/Excel ثم نقل المسارات الحرجة تدريجياً.',
        },
        {
          question: 'كيف يعمل أمان متعدد المستأجرين؟',
          answer: 'كل شركة معزولة على مستوى المستأجر، مع تطبيق صلاحيات الدور على المسارات الحساسة.',
        },
        {
          question: 'أين تُستضاف بيانات الإنتاج؟',
          answer: 'بيئة الإنتاج تعمل على Cloud Run + Cloud SQL + GCS مع إدارة الأسرار عبر Secret Manager.',
        },
      ],
    },
    cta: {
      title: 'دعنا نراجع عملياتك الإنتاجية معاً',
      description: 'للعروض التجريبية أو تخطيط التشغيل أو المراجعة التقنية: info@renkflow.com',
      primary: 'طلب عرض',
      secondary: 'تسجيل الدخول',
    },
  },
};

export function getLandingCopy(locale: string | undefined) {
  return LANDING_COPY[normalizeLocale(locale)];
}

export function getLandingLocale(locale: string | undefined): LandingLocale {
  return normalizeLocale(locale);
}
