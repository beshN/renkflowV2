'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useInView } from 'react-intersection-observer';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  // Genel
  {
    category: 'Genel',
    question: 'Renkflow nedir?',
    answer: 'Renkflow, ekiplerin projelerini görsel olarak yönetmelerini sağlayan modern bir iş akışı ve proje yönetim platformudur. Kanban panoları, zaman çizelgeleri ve gelişmiş raporlama özellikleri ile ekibinizin verimliliğini artırır.'
  },
  {
    category: 'Genel',
    question: 'Renkflow\'u kimler kullanabilir?',
    answer: 'Renkflow, her büyüklükteki ekip için uygundur. Yazılım geliştirme, pazarlama, tasarım, operasyon ve daha birçok alanda kullanılabilir. Bireysel kullanıcılardan kurumsal şirketlere kadar geniş bir kullanıcı kitlesine hitap eder.'
  },
  {
    category: 'Genel',
    question: 'Ücretsiz deneme süresi var mı?',
    answer: 'Evet! Renkflow\'u 14 gün boyunca ücretsiz deneyebilirsiniz. Deneme süresinde tüm Pro özelliklere erişim sağlarsınız. Kredi kartı bilgisi gerekmez.'
  },
  // Fiyatlandırma
  {
    category: 'Fiyatlandırma',
    question: 'Hangi ödeme yöntemlerini kabul ediyorsunuz?',
    answer: 'Visa, Mastercard, American Express kredi kartları ve PayPal ile ödeme yapabilirsiniz. Kurumsal müşterilerimiz için banka havalesi seçeneği de mevcuttur.'
  },
  {
    category: 'Fiyatlandırma',
    question: 'Yıllık ödeme indirimi var mı?',
    answer: 'Evet, yıllık ödeme tercih ettiğinizde %15 indirim kazanırsınız. Bu, aylık ödemeye kıyasla önemli bir tasarruf sağlar.'
  },
  {
    category: 'Fiyatlandırma',
    question: 'Plan değişikliği yapabilir miyim?',
    answer: 'Evet, istediğiniz zaman planınızı yükseltebilir veya düşürebilirsiniz. Yükseltme anında geçerli olur, düşürme ise mevcut fatura döneminin sonunda uygulanır.'
  },
  // Güvenlik
  {
    category: 'Güvenlik',
    question: 'Verilerim güvende mi?',
    answer: 'Kesinlikle! Verileriniz AES-256 şifreleme ile korunur. SOC 2 Tip II sertifikamız ve GDPR/KVKK uyumluluğumuz ile en yüksek güvenlik standartlarını karşılıyoruz. Düzenli güvenlik denetimleri ve penetrasyon testleri yapılmaktadır.'
  },
  {
    category: 'Güvenlik',
    question: 'İki faktörlü kimlik doğrulama (2FA) var mı?',
    answer: 'Evet, hesabınızı korumak için iki faktörlü kimlik doğrulama özelliğini etkinleştirebilirsiniz. SMS ve authenticator uygulaması seçenekleri mevcuttur.'
  },
  // Teknik
  {
    category: 'Teknik',
    question: 'Mobil uygulama var mı?',
    answer: 'Evet, iOS ve Android için native mobil uygulamalarımız mevcuttur. App Store ve Google Play\'den ücretsiz indirebilirsiniz.'
  },
  {
    category: 'Teknik',
    question: 'API erişimi sağlıyor musunuz?',
    answer: 'Evet, Takım ve Kurumsal planlarda kapsamlı REST API erişimi sunuyoruz. API dokümantasyonumuz ile kolayca entegrasyon yapabilirsiniz.'
  },
  {
    category: 'Teknik',
    question: 'Hangi entegrasyonları destekliyorsunuz?',
    answer: 'Slack, Microsoft Teams, Google Workspace, Jira, GitHub, GitLab, Trello ve daha birçok popüler araçla entegrasyon sağlıyoruz. Zapier entegrasyonu ile 3000+ uygulama ile bağlantı kurabilirsiniz.'
  },
  // Destek
  {
    category: 'Destek',
    question: 'Nasıl destek alabilirim?',
    answer: 'E-posta, canlı sohbet ve yardım merkezi aracılığıyla destek alabilirsiniz. Kurumsal müşterilerimiz için 7/24 öncelikli destek hizmeti sunuyoruz.'
  },
];

function FAQAccordion({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-border-light dark:border-border-dark rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-5 flex items-center justify-between text-left bg-surface-light dark:bg-surface-dark hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className="font-semibold text-text-light dark:text-text-dark pr-4">{item.question}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="material-symbols-outlined text-primary flex-shrink-0"
        >
          expand_more
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="px-6 py-5 bg-white dark:bg-gray-900/50 border-t border-border-light dark:border-border-dark">
          <p className="text-subtle-light dark:text-subtle-dark leading-relaxed">{item.answer}</p>
        </div>
      </motion.div>
    </div>
  );
}

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string>('Tümü');
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const categories = ['Tümü', ...Array.from(new Set(faqData.map(item => item.category)))];
  
  const filteredFAQ = activeCategory === 'Tümü' 
    ? faqData 
    : faqData.filter(item => item.category === activeCategory);

  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index);
    } else {
      newOpenItems.add(index);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
      
      <main className="pt-32 pb-20 container mx-auto px-6 md:px-12 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-black mb-4 text-text-light dark:text-text-dark">
            Sıkça Sorulan Sorular
          </h1>
          <p className="text-lg text-subtle-light dark:text-subtle-dark max-w-2xl mx-auto">
            Renkflow hakkında merak ettiğiniz tüm soruların cevaplarını burada bulabilirsiniz.
          </p>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="flex flex-wrap justify-center gap-2 mb-10"
        >
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === category
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-surface-light dark:bg-surface-dark text-subtle-light dark:text-subtle-dark hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {category}
            </button>
          ))}
        </motion.div>

        {/* FAQ List */}
        <motion.div
          ref={ref}
          className="space-y-4"
        >
          {filteredFAQ.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.05, duration: 0.4 }}
            >
              <FAQAccordion
                item={item}
                isOpen={openItems.has(index)}
                onToggle={() => toggleItem(index)}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-16 text-center bg-primary/10 dark:bg-primary/20 rounded-2xl p-10"
        >
          <h2 className="text-2xl font-bold mb-3 text-text-light dark:text-text-dark">
            Sorunuzun cevabını bulamadınız mı?
          </h2>
          <p className="text-subtle-light dark:text-subtle-dark mb-6">
            Destek ekibimiz size yardımcı olmaktan mutluluk duyar.
          </p>
          <a href="/contact">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-primary text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition-shadow inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined">support_agent</span>
              Bize Ulaşın
            </motion.button>
          </a>
        </motion.div>
      </main>
      
    </div>
  );
}
