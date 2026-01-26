'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

export const Testimonials: React.FC = () => {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10 bg-slate-50/50 dark:bg-slate-900/20">
         <div className="absolute top-[10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[100px]" />
         <div className="absolute bottom-[0%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[100px]" />
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
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
            whileHover={{ y: -5 }}
            className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg p-8 rounded-3xl shadow-sm border border-white/20 dark:border-slate-700 flex flex-col justify-between"
          >
            <div className="mb-6">
                <div className="flex gap-1 mb-4 text-yellow-400 text-sm">
                    {'★★★★★'}
                </div>
                <p className="text-lg text-slate-800 dark:text-slate-200">"Renkflow, ekibimizin proje teslim hızını iki katına çıkardı. Artık her şey daha organize ve şeffaf."</p>
            </div>
            <div className="flex items-center mt-auto">
              <Image 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1S9jX-TdsC7AweEsQIAIlwd7SS9E9o8ELcswwsnm3NNYOLTgLryYuH7h7iuWtyDQtz-Qa-Uo3nlaooX4mhhTTaJaCkjsrEXbgQXMVzAwfOIX6rYVOBosMYeil7IUHXoqitL3tdS9cvMOa2hU_OQ0Ovz6eAWcWNTVhYhuSxu5fFS9cuOS5Irx0m1A0V0QX4nD8lkoymoZHxdkBdOw9LqVifeLHiOdCvwnEh0dOztSXUrTOOWfRt26cgksvcu4D9DUJOfkt9Rl5w9hy" 
                alt="Azse V." 
                width={48} 
                height={48} 
                className="rounded-full mr-4 object-cover border border-slate-200 dark:border-slate-700"
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
            className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-8 rounded-3xl shadow-2xl shadow-blue-500/20 flex flex-col justify-between scale-100 md:scale-105 relative overflow-hidden"
          >
             {/* Shine effect */}
             <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-white opacity-10 blur-3xl rounded-full pointer-events-none"></div>

            <div className="mb-6 relative z-10">
                <div className="flex gap-1 mb-4 text-yellow-300 text-sm">
                    {'★★★★★'}
                </div>
                <p className="text-lg">"Daha önce kullandığımız tüm araçları tek bir platformda birleştirdi. Verimliliğimizdeki artış inanılmaz."</p>
            </div>
            <div className="flex items-center mt-auto relative z-10">
              <Image 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCqWt0rPEBfw_OXnOP_ceUmb1vsqpQDOGRwCoHWs_RmALRQVnhPGYE1NzQk2UrKlthjXfFhYTWHtpYX7jHsVDe4w5hJCU9Z9Nxo2C0C0oOWYlVitZgsrUVo-QWMnzPCYkZ7_DXgZt6XMhYEBe8EJfIMjtfDT9zV5bPAyZrK-IdnWReWfpUmCZek-wZ55c1O-7kN4loPwWXC6y_N1qmTLuJWCopjjOXh-D_NvRDYzuL23t2e7s-L3aIWqxkUPpmXBa73XpqhpJSr4fHI" 
                alt="Soma N." 
                width={48} 
                height={48} 
                className="rounded-full mr-4 border-2 border-white/30 object-cover"
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
            whileHover={{ y: -5 }}
            className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg p-8 rounded-3xl shadow-sm border border-white/20 dark:border-slate-700 flex flex-col justify-between"
          >
             <div className="mb-6">
                <div className="flex gap-1 mb-4 text-yellow-400 text-sm">
                    {'★★★★★'}
                </div>
                <p className="text-lg text-slate-800 dark:text-slate-200">"Yaratıcı ekibimiz için mükemmel bir araç. Fikir paylaşımı ve geri bildirim süreci hiç bu kadar kolay olmamıştı."</p>
             </div>
            <div className="flex items-center mt-auto">
              <Image 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAhGgQYzKp3TZ3okUTzmFtaeV-YhXEx4GFx_Ct6_F9C22mRIPihL-EHgOzuVW33pbHS0ZjserIxMOTCSiYNTcWgWLNLAbURckBEB7c9LjA8c4ox3xOx2tU95TbpRYsQhffridw1c4sG1C__qycg5rFffrm1Wvj69QVLavxN0Km7Wg2Gwoc9GF4nVdlQJLrs_DJyeesu-07_ak5OIId3GLs7f2X8hPrnbbhV9xYhQoDa2lUSP-UUXGEKCKyygYoGf-hsUAADm_xI9faO" 
                alt="Lama L." 
                width={48} 
                height={48} 
                className="rounded-full mr-4 object-cover border border-slate-200 dark:border-slate-700"
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
