'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  Mail,
  CheckCircle2,
  ShieldCheck,
  Star,
  Zap,
  Users,
  BarChart3,
  Package,
  Layers,
  Github,
  Twitter,
  Linkedin,
  Rocket,
  TrendingUp,
  Plus,
  Minus,
  ArrowRight,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/lib/i18n/client';
import { WaitlistNavbar } from './WaitlistNavbar';
import { DashboardPreview } from './DashboardPreview';

// --- Sub-components (stateless, outside main component) ---

const FeatureCard = ({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="group relative p-6 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xl dark:hover:shadow-2xl dark:hover:shadow-blue-900/10 transition-all duration-300 h-full"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none" />
    <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform duration-300 relative z-10">
      <Icon size={20} />
    </div>
    <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2 relative z-10">
      {title}
    </h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed relative z-10">
      {description}
    </p>
  </motion.div>
);

const FAQItem = ({ question, answer, isOpen, onToggle }: {
  question: string; answer: string; isOpen: boolean; onToggle: () => void;
}) => (
  <div className="border-b border-slate-200 dark:border-slate-800 last:border-b-0">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-4 text-start group"
    >
      <span className="text-[15px] font-medium text-slate-800 dark:text-slate-200 [padding-inline-end:2rem] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{question}</span>
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-blue-600 text-white rotate-0' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
        {isOpen ? <Minus size={12} strokeWidth={2.5} /> : <Plus size={12} strokeWidth={2.5} />}
      </div>
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <p className="pb-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed [padding-inline-end:3rem]">
            {answer}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const TestimonialCard = ({ name, role, company, content, avatar, delay }: {
  name: string; role: string; company: string; content: string; avatar: string; delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
  >
    <div className="flex gap-1 mb-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
      ))}
    </div>
    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5 italic">"{content}"</p>
    <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
        {avatar}
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-white">{name}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{role}, {company}</div>
      </div>
    </div>
  </motion.div>
);

// --- Main Component ---

export const ComingSoonPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const { locale, isRtl } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  const uiLocale = mounted && (locale === 'en' || locale === 'ar') ? locale : 'tr';
  const localeIsRtl = mounted ? isRtl : false;

  const copy = {
    tr: {
      validation: {
        emailRequired: 'Lütfen e-posta adresinizi girin.',
        emailInvalid: 'Lütfen geçerli bir e-posta adresi girin.',
        genericError: 'Bir hata oluştu.',
        networkError: 'Bağlantı hatası. Lütfen tekrar deneyin.',
        waitlistSuccess: 'Bekleme listesine eklendiniz!',
      },
      hero: {
        badgePrimary: 'Erken Erişim',
        badgeSecondary: 'Sınırlı süre ücretsiz',
        titleStart: 'Üretim Süreçlerinizi',
        titleAccent: 'Optimize Edin.',
        titleEnd: 'Kârlılığınızı Artırın.',
        descriptionStart:
          'Karmaşık Excel tablolarıyla vakit kaybetmeyin. RenkFlow’un yapay zeka destekli üretim yönetim platformu ile verimliliği',
        descriptionHighlight: '%40 artırın.',
        formSuccess: 'Listeye eklendiniz! Haberleşeceğiz.',
        placeholder: 'E-posta adresiniz',
        cta: 'Ücretsiz Erken Erişim',
        launchTextStart: '* Lansmana özel',
        launchHighlight: '%50 indirim',
        launchTextEnd: 'fırsatını kaçırmayın.',
        ratingSuffix: 'ortalama puan',
        growthTitle: 'Haftalık Büyüme',
      },
      sections: {
        featuresTitle: 'İşletmenizi bir üst seviyeye taşıyın',
        featuresDescription:
          'Karmaşık süreçleri basitleştiren, verimliliği artıran ve ekibinizi güçlendiren araçlar. Hepsi tek bir platformda.',
        stepsTitle: '3 adımda dijital dönüşüm',
        stepsDescription: 'Karmaşık kurulum süreçleri yok. Dakikalar içinde çalışmaya başlayın.',
        testimonialsTitle: 'Sektör liderleri güveniyor',
        testimonialsDescription: 'Beta programımıza katılan üreticilerin deneyimleri.',
        faqTitle: 'Aklınıza takılabilecekler',
        faqDescription: 'Sık sorulan sorular ve cevapları.',
      },
      cta: {
        title: 'Üretimde yeni bir çağ başlıyor.',
        description:
          'Rakiplerinizin önüne geçmek, verimliliğinizi katlamak ve işletmenizi geleceğe taşımak için şimdi harekete geçin.',
        button: 'Hemen Başvurun',
        footnote: 'Kredi kartı gerekmez • İptal edilebilir',
      },
      footer: {
        about:
          'RenkFlow, modern üretim tesisleri için tasarlanmış yeni nesil bir yönetim platformudur.',
        product: 'Ürün',
        company: 'Şirket',
        contact: 'İletişim',
        aboutLink: 'Hakkımızda',
        careerLink: 'Kariyer',
        blogLink: 'Blog',
        city: 'İstanbul, Türkiye',
        rights: 'Tüm hakları saklıdır.',
        privacy: 'Gizlilik Politikası',
        terms: 'Kullanım Koşulları',
      },
      features: [
        { title: 'Akıllı Takip', description: 'Siparişlerinizi Kanban, Liste ve Takvim görünümleri ile 360° yönetin.' },
        { title: 'Canlı Analitik', description: 'Üretim darboğazlarını anlık tespit edin, veriye dayalı kararlar alın.' },
        { title: 'Tam Otomasyon', description: 'Yinelenen görevleri otopilota bağlayın, ekibinizin zamanını geri kazanın.' },
        { title: 'Senkronize Ekip', description: 'Görev atamaları, yorumlar ve bildirimler ile iletişim kopukluğunu bitirin.' },
        { title: 'Dinamik Stok', description: 'Kritik seviye uyarıları ve otomatik sipariş oluşturma ile stoksuz kalmayın.' },
        { title: 'Askeri Güvenlik', description: 'End-to-end şifreleme ve KVKK uyumlu altyapı ile verileriniz güvende.' },
      ],
      stats: [
        { value: '500+', label: 'Beta Kullanıcısı' },
        { value: '%40', label: 'Verimlilik Artışı' },
        { value: '10K+', label: 'İşlenen Sipariş' },
        { value: '4.9/5', label: 'Kullanıcı Puanı' },
      ],
      steps: [
        { step: '01', title: 'Hesap Oluştur', description: 'Kurumsal e-postanız ile saniyeler içinde kaydınızı tamamlayın.' },
        { step: '02', title: 'Ekibini Davet Et', description: 'Rolleri belirleyin, çalışma arkadaşlarınızı sisteme entegre edin.' },
        { step: '03', title: 'Yönetmeye Başla', description: 'Üretim, stok ve siparişlerinizi tek panelden yönetmenin keyfini çıkarın.' },
      ],
      testimonials: [
        {
          name: 'Ahmet Yılmaz',
          role: 'Üretim Müdürü',
          company: 'Tekno Mobilya',
          content:
            'Beta sürecinde sipariş takip süremiz %60 azaldı. Artık hangi siparişin hangi aşamada olduğunu anlık görebiliyoruz.',
          avatar: 'AY',
        },
        {
          name: 'Elif Demir',
          role: 'Genel Müdür',
          company: 'Demir Tekstil',
          content:
            'Stok yönetimi eskiden kabustu. RenkFlow ile hammadde siparişlerini otomatik uyarılarla yönetiyoruz, fire oranımız %35 düştü.',
          avatar: 'ED',
        },
        {
          name: 'Murat Kaya',
          role: 'Operasyon Direktörü',
          company: 'Kaya Metal',
          content:
            'Ekip koordinasyonu inanılmaz kolaylaştı. Gerçek zamanlı görev atamaları ile iletişim kopukluğu sona erdi.',
          avatar: 'MK',
        },
      ],
      faqs: [
        {
          question: 'RenkFlow ne zaman kullanıma açılacak?',
          answer:
            'RenkFlow şu anda aktif beta sürecinde. Bekleme listesine katılan kullanıcılarımıza öncelikli erişim sağlıyoruz. Genel lansmanımız çok yakında.',
        },
        {
          question: 'Hangi sektörlere uygun?',
          answer:
            'Mobilya, tekstil, metal, gıda ve plastik gibi üretim odaklı tüm KOBİ ve kurumsal firmalar için modüler olarak tasarlanmıştır.',
        },
        {
          question: 'Mevcut sistemlerimle entegre olabilir mi?',
          answer:
            'Kesinlikle. Modern REST API ve webhook altyapımız sayesinde mevcut ERP, muhasebe ve e-ticaret sistemlerinizle konuşabilir.',
        },
        {
          question: 'Verilerim güvende mi?',
          answer:
            'Veri güvenliği önceliğimizdir. 256-bit SSL şifreleme, düzenli yedekleme ve ISO 27001 standartlarında altyapı sunuyoruz.',
        },
        {
          question: 'Ücretsiz deneme süreci var mı?',
          answer:
            'Evet, bekleme listesi üyelerimize lansmana özel 3 ay tam sürüm ücretsiz kullanım hakkı tanımlıyoruz.',
        },
      ],
      quickLinks: [
        { label: 'Bekleme Listesi', href: '#waitlist' },
        { label: 'Özellikler', href: '#features' },
        { label: 'SSS', href: '#faq' },
      ],
    },
    en: {
      validation: {
        emailRequired: 'Please enter your email address.',
        emailInvalid: 'Please enter a valid email address.',
        genericError: 'Something went wrong.',
        networkError: 'Network error. Please try again.',
        waitlistSuccess: 'You are on the waitlist!',
      },
      hero: {
        badgePrimary: 'Early Access',
        badgeSecondary: 'Free for a limited time',
        titleStart: 'Optimize Your',
        titleAccent: 'Production Flow.',
        titleEnd: 'Increase Profitability.',
        descriptionStart:
          'Stop wasting time with complex spreadsheets. RenkFlow gives your factory a practical AI-assisted operating layer and helps you',
        descriptionHighlight: 'improve efficiency by 40%.',
        formSuccess: 'You are on the list. We will keep you updated.',
        placeholder: 'Your email address',
        cta: 'Get Early Access',
        launchTextStart: '* Launch offer with',
        launchHighlight: '50% discount',
        launchTextEnd: 'for early adopters.',
        ratingSuffix: 'average rating',
        growthTitle: 'Weekly Growth',
      },
      sections: {
        featuresTitle: 'Run your factory at a higher level',
        featuresDescription:
          'One platform to simplify complex operations, improve throughput, and keep every team aligned.',
        stepsTitle: 'Digital transformation in 3 steps',
        stepsDescription: 'No heavy setup. Start delivering value in minutes.',
        testimonialsTitle: 'Trusted by manufacturing leaders',
        testimonialsDescription: 'What early-access factories are saying.',
        faqTitle: 'Frequently asked questions',
        faqDescription: 'Answers to the most common questions.',
      },
      cta: {
        title: 'A new era in factory execution starts now.',
        description:
          'Move faster than competitors, unlock more throughput, and make your operation more predictable.',
        button: 'Apply Now',
        footnote: 'No credit card required • Cancel anytime',
      },
      footer: {
        about:
          'RenkFlow is a modern operating platform built for real manufacturing environments.',
        product: 'Product',
        company: 'Company',
        contact: 'Contact',
        aboutLink: 'About',
        careerLink: 'Careers',
        blogLink: 'Blog',
        city: 'Istanbul, Turkiye',
        rights: 'All rights reserved.',
        privacy: 'Privacy Policy',
        terms: 'Terms of Service',
      },
      features: [
        { title: 'Smart Tracking', description: 'Track every order in list, timeline, and stage views without losing context.' },
        { title: 'Live Analytics', description: 'Detect bottlenecks in real time and make data-backed production decisions.' },
        { title: 'Workflow Automation', description: 'Automate repetitive steps and keep teams focused on critical execution.' },
        { title: 'Aligned Teams', description: 'Assignments, comments, and alerts stay in one flow so nothing gets lost.' },
        { title: 'Dynamic Inventory', description: 'Get shortage alerts and trigger replenishment actions before delays start.' },
        { title: 'Secure by Design', description: 'Enterprise-grade security and compliance for your production data.' },
      ],
      stats: [
        { value: '500+', label: 'Beta Users' },
        { value: '40%', label: 'Efficiency Gain' },
        { value: '10K+', label: 'Processed Orders' },
        { value: '4.9/5', label: 'User Rating' },
      ],
      steps: [
        { step: '01', title: 'Create Account', description: 'Set up your workspace in seconds with your company email.' },
        { step: '02', title: 'Invite Team', description: 'Assign roles and onboard operators, planners, and managers.' },
        { step: '03', title: 'Run Operations', description: 'Manage production, inventory, and orders from one command center.' },
      ],
      testimonials: [
        {
          name: 'Ahmet Yilmaz',
          role: 'Production Manager',
          company: 'Tekno Furniture',
          content:
            'During beta, our order tracking cycle time dropped by 60%. We now see every stage in real time.',
          avatar: 'AY',
        },
        {
          name: 'Elif Demir',
          role: 'General Manager',
          company: 'Demir Textile',
          content:
            'Inventory used to be chaos. With proactive alerts in RenkFlow, our waste rate dropped by 35%.',
          avatar: 'ED',
        },
        {
          name: 'Murat Kaya',
          role: 'Operations Director',
          company: 'Kaya Metal',
          content:
            'Team coordination became radically simpler. Real-time assignments removed communication gaps.',
          avatar: 'MK',
        },
      ],
      faqs: [
        {
          question: 'When will RenkFlow be generally available?',
          answer:
            'RenkFlow is currently in active beta. Waitlist members receive prioritized access during rollout.',
        },
        {
          question: 'Which industries are supported?',
          answer:
            'Furniture, textile, metal, food, plastics, and other production-focused SMB and enterprise operations.',
        },
        {
          question: 'Can we integrate with existing systems?',
          answer:
            'Yes. Our API and webhook layer allows integration with ERP, accounting, and commerce systems.',
        },
        {
          question: 'Is our data secure?',
          answer:
            'Security is a core requirement. Data is encrypted and the platform follows modern infrastructure standards.',
        },
        {
          question: 'Is there a free trial?',
          answer:
            'Yes. Early-access members receive an extended trial during launch.',
        },
      ],
      quickLinks: [
        { label: 'Waitlist', href: '#waitlist' },
        { label: 'Features', href: '#features' },
        { label: 'FAQ', href: '#faq' },
      ],
    },
    ar: {
      validation: {
        emailRequired: 'يرجى إدخال بريدك الإلكتروني.',
        emailInvalid: 'يرجى إدخال بريد إلكتروني صحيح.',
        genericError: 'حدث خطأ غير متوقع.',
        networkError: 'خطأ في الشبكة. حاول مرة أخرى.',
        waitlistSuccess: 'تمت إضافتك إلى قائمة الانتظار.',
      },
      hero: {
        badgePrimary: 'وصول مبكر',
        badgeSecondary: 'مجاني لفترة محدودة',
        titleStart: 'حسّن تدفق',
        titleAccent: 'الإنتاج لديك.',
        titleEnd: 'وارفع الربحية.',
        descriptionStart:
          'تخلّص من تعقيد الجداول. يمنحك RenkFlow طبقة تشغيل عملية للمصنع ويساعدك على',
        descriptionHighlight: 'رفع الكفاءة بنسبة 40%.',
        formSuccess: 'تم التسجيل بنجاح. سنبقيك على اطلاع.',
        placeholder: 'بريدك الإلكتروني',
        cta: 'احصل على الوصول المبكر',
        launchTextStart: '* عرض الإطلاق مع',
        launchHighlight: 'خصم 50%',
        launchTextEnd: 'للمستخدمين الأوائل.',
        ratingSuffix: 'متوسط التقييم',
        growthTitle: 'النمو الأسبوعي',
      },
      sections: {
        featuresTitle: 'ارفع مستوى تشغيل مصنعك',
        featuresDescription:
          'منصة واحدة لتبسيط العمليات المعقدة، تحسين الإنتاجية، وتوحيد عمل الفرق.',
        stepsTitle: 'التحول الرقمي في 3 خطوات',
        stepsDescription: 'بدون إعداد معقد. ابدأ بسرعة وبنتائج واضحة.',
        testimonialsTitle: 'موثوق من قادة الصناعة',
        testimonialsDescription: 'تجارب المصانع المشاركة في الوصول المبكر.',
        faqTitle: 'الأسئلة الشائعة',
        faqDescription: 'إجابات لأكثر الأسئلة المتكررة.',
      },
      cta: {
        title: 'عصر جديد لتنفيذ الإنتاج يبدأ الآن.',
        description:
          'تقدّم على المنافسين، وارفع الإنتاجية، واجعل التشغيل أكثر قابلية للتنبؤ.',
        button: 'قدّم الآن',
        footnote: 'لا حاجة لبطاقة ائتمانية • يمكن الإلغاء في أي وقت',
      },
      footer: {
        about:
          'RenkFlow منصة تشغيل حديثة مصممة خصيصاً لبيئات التصنيع الواقعية.',
        product: 'المنتج',
        company: 'الشركة',
        contact: 'التواصل',
        aboutLink: 'من نحن',
        careerLink: 'الوظائف',
        blogLink: 'المدونة',
        city: 'اسطنبول، تركيا',
        rights: 'جميع الحقوق محفوظة.',
        privacy: 'سياسة الخصوصية',
        terms: 'شروط الاستخدام',
      },
      features: [
        { title: 'تتبع ذكي', description: 'تابع كل طلب عبر مراحل التنفيذ دون فقدان السياق التشغيلي.' },
        { title: 'تحليلات مباشرة', description: 'اكتشف الاختناقات لحظياً واتخذ قرارات إنتاج مبنية على البيانات.' },
        { title: 'أتمتة الإجراءات', description: 'أتمتة الأعمال المتكررة ليركز الفريق على العمل التشغيلي المهم.' },
        { title: 'فرق متزامنة', description: 'التكليفات والتعليقات والتنبيهات في مسار موحد وواضح.' },
        { title: 'مخزون ديناميكي', description: 'تنبيهات نقص المواد قبل التأخير مع إجراءات تعويض سريعة.' },
        { title: 'أمان موثوق', description: 'معايير أمان عالية لحماية بيانات الإنتاج والعمليات.' },
      ],
      stats: [
        { value: '+500', label: 'مستخدم تجريبي' },
        { value: '40%', label: 'تحسن الكفاءة' },
        { value: '+10K', label: 'طلبات معالجة' },
        { value: '4.9/5', label: 'تقييم المستخدمين' },
      ],
      steps: [
        { step: '01', title: 'أنشئ الحساب', description: 'ابدأ بسرعة باستخدام بريد الشركة.' },
        { step: '02', title: 'ادعُ الفريق', description: 'حدد الأدوار وابدأ العمل بشكل منظم.' },
        { step: '03', title: 'شغّل العمليات', description: 'أدر الإنتاج والمخزون والطلبات من منصة واحدة.' },
      ],
      testimonials: [
        {
          name: 'أحمد يلماز',
          role: 'مدير الإنتاج',
          company: 'Tekno Furniture',
          content:
            'خلال التجربة انخفض زمن متابعة الطلبات بشكل كبير وأصبحنا نرى كل مرحلة مباشرة.',
          avatar: 'AY',
        },
        {
          name: 'إليف دمير',
          role: 'المدير العام',
          company: 'Demir Textile',
          content:
            'إدارة المخزون أصبحت أسهل بكثير، ومع التنبيهات المبكرة انخفض الهدر بشكل واضح.',
          avatar: 'ED',
        },
        {
          name: 'مراد كايا',
          role: 'مدير العمليات',
          company: 'Kaya Metal',
          content:
            'تنسيق الفريق أصبح أبسط بكثير مع توزيع العمل الفوري والتنبيهات الموحدة.',
          avatar: 'MK',
        },
      ],
      faqs: [
        {
          question: 'متى سيتوفر RenkFlow بشكل عام؟',
          answer:
            'المنصة في مرحلة تجريبية نشطة حالياً، ويحصل المشتركون في قائمة الانتظار على أولوية الوصول.',
        },
        {
          question: 'ما القطاعات المناسبة للمنصة؟',
          answer:
            'المنصة مناسبة للأثاث والمنسوجات والمعادن والغذاء والبلاستيك وغيرها من قطاعات التصنيع.',
        },
        {
          question: 'هل يمكن الربط مع الأنظمة الحالية؟',
          answer:
            'نعم، يدعم النظام التكامل عبر API وWebhooks مع أنظمة ERP والمحاسبة وغيرها.',
        },
        {
          question: 'هل بياناتنا آمنة؟',
          answer:
            'الأمان أولوية أساسية، ويتم التعامل مع البيانات وفق ممارسات بنية تحتية حديثة.',
        },
        {
          question: 'هل توجد فترة تجريبية مجانية؟',
          answer:
            'نعم، يحصل مستخدمو الوصول المبكر على تجربة ممتدة عند الإطلاق.',
        },
      ],
      quickLinks: [
        { label: 'قائمة الانتظار', href: '#waitlist' },
        { label: 'المزايا', href: '#features' },
        { label: 'الأسئلة الشائعة', href: '#faq' },
      ],
    },
  } as const;
  const text = copy[uiLocale];
  const headingAlignClass = localeIsRtl ? 'lg:text-right' : 'lg:text-left';
  const featureIcons = [Layers, BarChart3, Zap, Users, Package, ShieldCheck];
  const features = text.features.map((feature, index) => ({
    icon: featureIcons[index] ?? Layers,
    title: feature.title,
    description: feature.description,
  }));
  const stats = text.stats;
  const testimonials = text.testimonials;
  const faqs = text.faqs;
  const footerQuickLinks = text.quickLinks;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error(text.validation.emailRequired);
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error(text.validation.emailInvalid);
      return;
    }
    setStatus('loading');
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        setStatus('success');
        toast.success(data.message || text.validation.waitlistSuccess);
        setEmail('');
      } else {
        setStatus('idle');
        toast.error(data.error || text.validation.genericError);
      }
    } catch {
      setStatus('idle');
      toast.error(text.validation.networkError);
    }
  }, [email, text.validation]);

  const footerSocialLinks = [
    { icon: Twitter, href: 'https://twitter.com/renkflow', label: 'Twitter' },
    { icon: Linkedin, href: 'https://linkedin.com/company/renkflow', label: 'LinkedIn' },
    { icon: Github, href: 'https://github.com/renkflow', label: 'GitHub' },
  ];

  return (
    <div className="rf-app-shell min-h-[100svh] relative selection:bg-blue-100 dark:selection:bg-blue-900/40">

      {/* Improved Background - More subtle, "Deep Glass" feel */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/20 via-slate-50/20 to-transparent dark:from-blue-900/10 dark:via-slate-900/10" />
        <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] bg-gradient-to-bl from-blue-200/30 dark:from-blue-800/10 to-transparent rounded-full blur-[120px] animate-blob" />
        <div className="absolute top-[30%] -left-[10%] w-[50%] h-[50%] bg-gradient-to-tr from-indigo-200/30 dark:from-indigo-800/10 to-transparent rounded-full blur-[100px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 right-[20%] w-[40%] h-[40%] bg-gradient-to-t from-cyan-100/30 dark:from-cyan-900/10 to-transparent rounded-full blur-[100px] animate-blob animation-delay-4000" />
      </div>

      <WaitlistNavbar />

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden pt-24 md:pt-28 lg:pt-32 pb-14 lg:pb-16 min-h-[calc(100svh-4.5rem)] flex items-center">
        <div className="rf-page-wrap relative z-10">
          <div className="rf-hero-grid">

            {/* Left Content */}
            <div className={`text-center ${headingAlignClass} w-full`}>
                <motion.div
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 transition={{ duration: 0.5 }}
                 className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-200/50 dark:border-blue-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-xs font-medium text-slate-700 dark:text-slate-300 shadow-sm mb-10 hover:shadow-md transition-all duration-300"
               >
                 <span className="relative flex h-2.5 w-2.5">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                 </span>
                 <span className="font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                   {text.hero.badgePrimary}
                 </span> 
                 <span className="w-px h-3 bg-slate-200 dark:bg-slate-700 mx-1"></span>
                 <span>{text.hero.badgeSecondary}</span>
               </motion.div>

               <motion.h1
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ duration: 0.5, delay: 0.1 }}
                 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.1] mb-8 text-slate-900 dark:text-white"
               >
                 {text.hero.titleStart} <br className="hidden lg:block"/>
                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 animate-gradient-xy">
                    {text.hero.titleAccent}
                 </span>
                 <br />
                 {text.hero.titleEnd}
               </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 mb-12 lg:max-w-[38rem] leading-relaxed font-light"
              >
                {text.hero.descriptionStart}{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  {text.hero.descriptionHighlight}
                </span>
              </motion.p>

              {/* Email Form */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                id="waitlist"
                className={`w-full max-w-xl mx-auto ${localeIsRtl ? 'lg:mr-0 lg:ml-auto' : 'lg:mx-0'} bg-white/55 dark:bg-slate-900/55 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-none`}
              >
                <AnimatePresence mode="wait">
                  {status === 'success' ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 p-3 text-emerald-600 dark:text-emerald-400 font-medium"
                    >
                      <CheckCircle2 size={20} />
                      <p>{text.hero.formSuccess}</p>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleSubmit}
                      className="flex flex-col sm:flex-row gap-2"
                    >
                       <div className="relative flex-1">
                          <Mail
                            className="absolute top-1/2 -translate-y-1/2 text-slate-400"
                            style={localeIsRtl ? { right: '0.875rem' } : { left: '0.875rem' }}
                            size={18}
                          />
                          <Input
                            type="email"
                            placeholder={text.hero.placeholder}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={status === 'loading'}
                            className={`h-12 rounded-lg bg-transparent border-none focus-visible:ring-0 text-slate-900 dark:text-white placeholder:text-slate-400 shadow-none ${localeIsRtl ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4 text-left'}`}
                          />
                        </div>
                        <Button
                          type="submit"
                          disabled={status === 'loading'}
                          className="h-12 px-8 rounded-lg font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 w-full sm:w-auto text-[15px]"
                        >
                          {status === 'loading' ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <span className={localeIsRtl ? 'ml-2' : 'mr-2'}>{text.hero.cta}</span>
                              <ArrowRight size={18} className={localeIsRtl ? 'rotate-180' : ''} />
                            </>
                          )}
                        </Button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </motion.div>
             <p className={`text-center ${headingAlignClass} text-xs text-slate-400 mt-4 px-2`}>
                {text.hero.launchTextStart}{' '}
                <span className="text-slate-600 dark:text-slate-300 font-medium">{text.hero.launchHighlight}</span>{' '}
                {text.hero.launchTextEnd}
              </p>


              {/* Social Proof */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-12 flex flex-col sm:flex-row items-center gap-6 lg:gap-8"
              >
                  {/* New user avatars group */}
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-3">
                         {['AY', 'ED', 'MK', 'SK', 'BT'].map((initials, i) => (
                        <div
                          key={i}
                          className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border-[2.5px] border-white dark:border-[#0B0B0F] flex items-center justify-center text-[10px] font-extrabold text-slate-600 dark:text-slate-300 shadow-sm"
                        >
                          {initials}
                        </div>
                      ))}
                      <div className="w-9 h-9 rounded-full bg-blue-600 border-[2.5px] border-white dark:border-[#0B0B0F] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                        +500
                      </div>
                    </div>
                  </div>
                  
                  {/* Rating / Trust statement */}
                  <div className="flex flex-col gap-0.5">
                     <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                         <Star key={i} size={16} fill="#FACC15" className="text-yellow-400" />
                       ))}
                     </div>
                     <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                       <strong className="text-slate-900 dark:text-white">4.9/5</strong>{' '}
                       {text.hero.ratingSuffix}
                     </p>
                  </div>
              </motion.div>
            </div>

            {/* Right — Dashboard Preview */}
            <motion.div
              initial={{ opacity: 0, x: 20, rotateY: -10 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 0.8, delay: 0.2, type: "spring", stiffness: 100 }}
              style={{ perspective: 1000 }}
              className="hidden lg:flex justify-end relative lg:-mr-[3vw] 2xl:-mr-[4vw]"
            >
               <div className="w-[min(62vw,980px)]">
                 <div className="relative rounded-2xl p-2 bg-slate-900/5 dark:bg-white/5 ring-1 ring-slate-900/10 dark:ring-white/10 backdrop-blur-md shadow-2xl dark:shadow-blue-900/20 overflow-hidden group transition-all duration-500 hover:scale-[1.01]">
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    <DashboardPreview isDark={isDark} locale={uiLocale} />
                     {/* Reflection effect */}
                     <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-2xl mix-blend-overlay" />
                 </div>
               </div>

               {/* Decorative floating elements */}
               <motion.div
                 animate={{ y: [0, -10, 0] }}
                 transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                 className="absolute -top-12 -right-8 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 hidden xl:block"
               >
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{text.hero.growthTitle}</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white text-green-600 dark:text-green-400">+%24.5</div>
                    </div>
                 </div>
               </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="relative py-20 lg:py-28 bg-slate-50/50 dark:bg-slate-900/20">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-6">
              {text.sections.featuresTitle}
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              {text.sections.featuresDescription}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, i) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={i * 0.05}
              />
            ))}
          </div>
        </div>
      </section>

       {/* ─── STATS ─── */}
       <section className="py-20 border-y border-slate-200 dark:border-slate-800/60 bg-white dark:bg-[#0B0B0F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1, type: "spring" }}
              >
                <div className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 mb-2">{stat.value}</div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="relative py-24">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
           <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              {text.sections.stepsTitle}
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              {text.sections.stepsDescription}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative max-w-5xl mx-auto">
             {/* Connector Line */}
            <div className="hidden md:block absolute top-[2.5rem] left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-transparent via-blue-200 dark:via-blue-800 to-transparent" />

            {text.steps.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                className="relative text-center group"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white dark:bg-slate-800 shadow-lg border border-slate-100 dark:border-slate-700 flex items-center justify-center relative z-10 group-hover:scale-110 transition-transform duration-300">
                   <div className="absolute inset-0 bg-blue-50 dark:bg-blue-900/20 rounded-2xl transform rotate-6 group-hover:rotate-12 transition-transform duration-300" />
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 relative z-10">{item.step}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{item.title}</h3>
                <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="relative py-24 bg-slate-50/50 dark:bg-slate-900/40 border-y border-slate-200 dark:border-slate-800">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              {text.sections.testimonialsTitle}
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              {text.sections.testimonialsDescription}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((t, i) => (
              <TestimonialCard key={t.name} {...t} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="relative py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
           <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              {text.sections.faqTitle}
            </h2>
             <p className="text-lg text-slate-600 dark:text-slate-400">
              {text.sections.faqDescription}
            </p>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {faqs.map((faq, i) => (
              <FAQItem
                key={i}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === i}
                onToggle={() => setOpenFAQ(openFAQ === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-24">
        <div className="w-full px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative p-10 sm:p-20 rounded-3xl bg-slate-900 dark:bg-blue-950 overflow-hidden text-center shadow-2xl"
          >
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
               <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
               <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto">
               <div className="inline-flex items-center justify-center p-3 mb-8 bg-white/10 rounded-2xl backdrop-blur-md">
                 <Rocket className="text-white" size={32} />
               </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
                {text.cta.title}
              </h2>
              <p className="text-lg text-blue-100 mb-10 leading-relaxed">
                {text.cta.description}
              </p>

              <Button
                size="lg"
                className="h-14 px-8 rounded-full bg-white text-slate-900 hover:bg-white/90 text-lg font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
              >
                {text.cta.button}
                <ArrowRight size={20} className={localeIsRtl ? 'mr-2 rotate-180' : 'ml-2'} />
              </Button>
               <p className="mt-6 text-sm text-blue-200/60">{text.cta.footnote}</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-slate-200 dark:border-slate-800 pt-16 pb-8 bg-slate-50 dark:bg-[#0B0B0F]">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="lg:col-span-1">
               <div className="flex items-center gap-2 mb-6">
                 <div className="relative h-6 w-24">
                   <Image
                    src="/renkflow-logo-new.png"
                    alt="RenkFlow"
                    fill
                    className="object-contain object-left"
                   />
                 </div>
               </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                {text.footer.about}
              </p>
               <div className="flex items-center gap-3">
                {footerSocialLinks.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            </div>

             <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-6">{text.footer.product}</h4>
                <ul className="space-y-3">
                   {footerQuickLinks.map((link) => (
                    <li key={link.href}>
                      <a href={link.href} className="text-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
                        {link.label}
                      </a>
                    </li>
                   ))}
                </ul>
             </div>

              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-6">{text.footer.company}</h4>
                <ul className="space-y-3">
                   <li><a href="#" className="text-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">{text.footer.aboutLink}</a></li>
                   <li><a href="#" className="text-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">{text.footer.careerLink}</a></li>
                   <li><a href="#" className="text-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">{text.footer.blogLink}</a></li>
                </ul>
             </div>

             <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-6">{text.footer.contact}</h4>
                 <div className="space-y-3">
                   <a href="mailto:info@renkflow.com" className="block text-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
                    info@renkflow.com
                   </a>
                   <p className="text-sm text-slate-400 dark:text-slate-500">
                    {text.footer.city}
                   </p>
                 </div>
             </div>
          </div>

          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-400">© {new Date().getFullYear()} RenkFlow Teknoloji A.Ş. {text.footer.rights}</p>
            <div className="flex items-center gap-6">
               <a href="#" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">{text.footer.privacy}</a>
               <a href="#" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">{text.footer.terms}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
