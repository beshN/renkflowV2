'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

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
      className={`relative bg-white/90 dark:bg-slate-900/70 rounded-3xl p-6 border border-slate-200/70 dark:border-slate-800 overflow-hidden group shadow-[0_20px_45px_-35px_rgba(15,23,42,0.4)] ${
        integration.status === 'coming' ? 'opacity-75' : ''
      }`}
    >
      {/* Gradient Background */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${integration.color}`} />
      
      {/* Coming Soon Badge */}
      {integration.status === 'coming' && (
        <div className="absolute top-4 right-4 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold px-2 py-1 rounded-full">
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
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="mt-4">
          <Link href="/contact" className="block">
            <Button variant="outline" size="sm" className="w-full">
              Bağlan
            </Button>
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
}

export const dynamic = 'force-dynamic';

export default function IntegrationsPage() {
  const [activeCategory, setActiveCategory] = useState('Tümü');
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const filteredIntegrations = activeCategory === 'Tümü'
    ? integrations
    : integrations.filter(i => i.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#f7f8fb] dark:bg-slate-950 font-display relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(184,116,68,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_40%)]"
      />
      
      <main className="pt-32 pb-20 w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 relative z-10">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
            Entegrasyonlar
          </span>
          <h1 className="mt-6 text-4xl md:text-5xl font-black mb-4 text-text-light dark:text-text-dark">
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
                  : 'bg-white/70 dark:bg-slate-900/60 text-subtle-light dark:text-subtle-dark hover:bg-slate-100 dark:hover:bg-slate-800'
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
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="lg">Bize Ulaşın</Button>
              </motion.div>
            </Link>
            <Link href="/contact" className="flex items-center justify-center gap-2 font-semibold text-primary hover:underline">
              <span>API Dokümantasyonu Talep Et</span>
              <span className="material-symbols-outlined text-lg">arrow_outward</span>
            </Link>
          </div>
        </motion.div>
      </main>

      
    </div>
  );
}
