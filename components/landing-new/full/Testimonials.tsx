'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

export const Testimonials: React.FC = () => {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white"
          >
            Müşterilerimiz Ne Diyor?
          </motion.h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between"
          >
            <p className="text-lg mb-6 text-slate-800 dark:text-slate-200">"Renkflow, ekibimizin proje teslim hızını iki katına çıkardı. Artık her şey daha organize ve şeffaf."</p>
            <div className="flex items-center mt-auto">
              <Image 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1S9jX-TdsC7AweEsQIAIlwd7SS9E9o8ELcswwsnm3NNYOLTgLryYuH7h7iuWtyDQtz-Qa-Uo3nlaooX4mhhTTaJaCkjsrEXbgQXMVzAwfOIX6rYVOBosMYeil7IUHXoqitL3tdS9cvMOa2hU_OQ0Ovz6eAWcWNTVhYhuSxu5fFS9cuOS5Irx0m1A0V0QX4nD8lkoymoZHxdkBdOw9LqVifeLHiOdCvwnEh0dOztSXUrTOOWfRt26cgksvcu4D9DUJOfkt9Rl5w9hy" 
                alt="Azse V." 
                width={48} 
                height={48} 
                className="rounded-full mr-4"
                unoptimized
              />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Azse V.</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Proje Müdürü, X97 Corp.</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.05 }}
            className="bg-blue-600 text-white p-8 rounded-3xl shadow-xl flex flex-col justify-between scale-100 md:scale-105"
          >
            <p className="text-lg mb-6">"Daha önce kullandığımız tüm araçları tek bir platformda birleştirdi. Verimliliğimizdeki artış inanılmaz."</p>
            <div className="flex items-center mt-auto">
              <Image 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCqWt0rPEBfw_OXnOP_ceUmb1vsqpQDOGRwCoHWs_RmALRQVnhPGYE1NzQk2UrKlthjXfFhYTWHtpYX7jHsVDe4w5hJCU9Z9Nxo2C0C0oOWYlVitZgsrUVo-QWMnzPCYkZ7_DXgZt6XMhYEBe8EJfIMjtfDT9zV5bPAyZrK-IdnWReWfpUmCZek-wZ55c1O-7kN4loPwWXC6y_N1qmTLuJWCopjjOXh-D_NvRDYzuL23t2e7s-L3aIWqxkUPpmXBa73XpqhpJSr4fHI" 
                alt="Soma N." 
                width={48} 
                height={48} 
                className="rounded-full mr-4 border-2 border-white/50"
                unoptimized
              />
              <div>
                <p className="font-bold">Soma N.</p>
                <p className="text-sm opacity-80">CEO, S12 Corp.</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between"
          >
            <p className="text-lg mb-6 text-slate-800 dark:text-slate-200">"Yaratıcı ekibimiz için mükemmel bir araç. Fikir paylaşımı ve geri bildirim süreci hiç bu kadar kolay olmamıştı."</p>
            <div className="flex items-center mt-auto">
              <Image 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAhGgQYzKp3TZ3okUTzmFtaeV-YhXEx4GFx_Ct6_F9C22mRIPihL-EHgOzuVW33pbHS0ZjserIxMOTCSiYNTcWgWLNLAbURckBEB7c9LjA8c4ox3xOx2tU95TbpRYsQhffridw1c4sG1C__qycg5rFffrm1Wvj69QVLavxN0Km7Wg2Gwoc9GF4nVdlQJLrs_DJyeesu-07_ak5OIId3GLs7f2X8hPrnbbhV9xYhQoDa2lUSP-UUXGEKCKyygYoGf-hsUAADm_xI9faO" 
                alt="Lama L." 
                width={48} 
                height={48} 
                className="rounded-full mr-4"
                unoptimized
              />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Lama L.</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Tasarım Lideri, 017 Companies</p>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
