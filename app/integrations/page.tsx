'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import LandingNav from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing-new/Footer';

interface Integration {
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  status: 'available' | 'coming';
}

const integrations: Integration[] = [
  // Communication
  { name: 'Slack', description: 'Bildirimler ve görev güncellemelerini Slack kanallarına gönderin.', category: 'İletişim', icon: '💬', color: 'from-purple-500 to-pink-500', status: 'available' },
  { name: 'Microsoft Teams', description: 'Teams ile sorunsuz iletişim ve dosya paylaşımı.', category: 'İletişim', icon: '👥', color: 'from-blue-500 to-indigo-500', status: 'available' },
  { name: 'Discord', description: 'Discord sunucunuzla entegre edin.', category: 'İletişim', icon: '🎮', color: 'from-indigo-500 to-purple-600', status: 'coming' },
  
  // Productivity
  { name: 'Google Workspace', description: 'Drive, Docs, Sheets ve Calendar entegrasyonu.', category: 'Verimlilik', icon: '📊', color: 'from-blue-400 to-green-400', status: 'available' },
  { name: 'Notion', description: 'Notion sayfalarını Renkflow kartlarına bağlayın.', category: 'Verimlilik', icon: '📝', color: 'from-gray-600 to-gray-800', status: 'available' },
  { name: 'Dropbox', description: 'Dosyalarınızı Dropbox ile senkronize edin.', category: 'Verimlilik', icon: '📦', color: 'from-blue-500 to-blue-600', status: 'available' },
  
  // Development
  { name: 'GitHub', description: 'PR ve issue\'ları kartlarla otomatik bağlayın.', category: 'Geliştirme', icon: '🐙', color: 'from-gray-700 to-gray-900', status: 'available' },
  { name: 'GitLab', description: 'GitLab CI/CD ve issue takibi entegrasyonu.', category: 'Geliştirme', icon: '🦊', color: 'from-orange-500 to-red-500', status: 'available' },
  { name: 'Jira', description: 'Jira ticketlarını Renkflow ile senkronize edin.', category: 'Geliştirme', icon: '🎫', color: 'from-blue-600 to-blue-700', status: 'available' },
  { name: 'Bitbucket', description: 'Bitbucket repo ve pipeline entegrasyonu.', category: 'Geliştirme', icon: '🪣', color: 'from-blue-500 to-blue-600', status: 'coming' },
  
  // Automation
  { name: 'Zapier', description: '3000+ uygulama ile otomatik iş akışları oluşturun.', category: 'Otomasyon', icon: '⚡', color: 'from-orange-400 to-orange-600', status: 'available' },
  { name: 'Make (Integromat)', description: 'Görsel otomasyon senaryoları oluşturun.', category: 'Otomasyon', icon: '🔧', color: 'from-purple-500 to-purple-700', status: 'available' },
  
  // Design
  { name: 'Figma', description: 'Tasarım dosyalarını doğrudan kartlara ekleyin.', category: 'Tasarım', icon: '🎨', color: 'from-pink-500 to-purple-500', status: 'available' },
  { name: 'Adobe Creative Cloud', description: 'Adobe dosyalarını görüntüleyin ve yorumlayın.', category: 'Tasarım', icon: '🖌️', color: 'from-red-500 to-red-600', status: 'coming' },
];

const categories = ['Tümü', 'İletişim', 'Verimlilik', 'Geliştirme', 'Otomasyon', 'Tasarım'];

function IntegrationCard({ integration, index }: { integration: Integration; index: number }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.05, duration: 0.5 }}
      whileHover={{ y: -5, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)' }}
      className={`relative bg-white dark:bg-gray-800/50 rounded-2xl p-6 border border-border-light dark:border-border-dark overflow-hidden group ${
        integration.status === 'coming' ? 'opacity-75' : ''
      }`}
    >
      {/* Gradient Background */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${integration.color}`} />
      
      {/* Coming Soon Badge */}
      {integration.status === 'coming' && (
        <div className="absolute top-4 right-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold px-2 py-1 rounded-full">
          Yakında
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${integration.color} flex items-center justify-center text-2xl shadow-lg`}>
          {integration.icon}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg text-text-light dark:text-text-dark mb-1">
            {integration.name}
          </h3>
          <p className="text-sm text-subtle-light dark:text-subtle-dark leading-relaxed">
            {integration.description}
          </p>
        </div>
      </div>

      {integration.status === 'available' && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-4 w-full py-2.5 rounded-lg bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-colors"
        >
          Bağlan
        </motion.button>
      )}
    </motion.div>
  );
}

export default function IntegrationsPage() {
  const [activeCategory, setActiveCategory] = useState('Tümü');
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const filteredIntegrations = activeCategory === 'Tümü'
    ? integrations
    : integrations.filter(i => i.category === activeCategory);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
      <LandingNav />
      
      <main className="pt-32 pb-20 container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-black mb-4 text-text-light dark:text-text-dark">
            Entegrasyonlar
          </h1>
          <p className="text-lg text-subtle-light dark:text-subtle-dark max-w-2xl mx-auto">
            Favori araçlarınızı Renkflow ile bağlayın ve iş akışınızı güçlendirin.
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

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-12"
        >
          {[
            { value: '25+', label: 'Entegrasyon' },
            { value: '3000+', label: 'Zapier Uygulama' },
            { value: '99.9%', label: 'Uptime' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl md:text-3xl font-black text-primary">{stat.value}</div>
              <div className="text-sm text-subtle-light dark:text-subtle-dark">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Integration Grid */}
        <div ref={ref} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIntegrations.map((integration, index) => (
            <IntegrationCard key={integration.name} integration={integration} index={index} />
          ))}
        </div>

        {/* Custom Integration CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-16 text-center bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-2xl p-10"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 text-primary mb-4">
            <span className="material-symbols-outlined text-3xl">api</span>
          </div>
          <h2 className="text-2xl font-bold mb-3 text-text-light dark:text-text-dark">
            Özel Entegrasyon mu Gerekiyor?
          </h2>
          <p className="text-subtle-light dark:text-subtle-dark mb-6 max-w-lg mx-auto">
            REST API ile kendi entegrasyonlarınızı oluşturabilir veya bizimle iletişime geçerek özel çözümler talep edebilirsiniz.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-primary text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              >
                Bize Ulaşın
              </motion.button>
            </Link>
            <a href="#" className="flex items-center justify-center gap-2 font-semibold text-primary hover:underline">
              <span>API Dokümantasyonu</span>
              <span className="material-symbols-outlined text-lg">arrow_outward</span>
            </a>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
