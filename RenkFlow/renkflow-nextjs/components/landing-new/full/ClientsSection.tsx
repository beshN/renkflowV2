'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

export const ClientsSection: React.FC = () => {
  const clients = [
    { name: 'Microsoft', src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCiw0VMSNb9yVK1KIGATSQH16FbdWQ594sjuduD9_GVMBfjYrve2xsIsx1nC_osoa4NDdeQFkmBMlf2LSUiJjUviZOMWgPqaak1WvN_RsRGYC1fheuqBVkL19hVEdQjcUyoHAmyFO8m9rkQHaYmQL4Al9AE9Y2vfNW-Bci1s8ZNXWLzWHdE5YSOAJ9GPOVuhSB7EwhY11luGPVWUh_-_bnF4qoGYUaAccZnQyoO7_5nIUQiHB6tsuW_U81_mB0qPHXCvBKfoOxOnBxs', height: 24 },
    { name: 'IBM', src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCCwWOG2v4gmAladMf3xDgdOUo3akAt3x0WSVoQoXi1OTKcV1V7nIOUQkosXZE7yVrXgvGL6BFdK0EI0PF26WxhOgJaPlZiF5zytp4Rk3wbO26QA6NwL_Jge4CQQchfZHsJRkPABUBwS1RLa0QEhXqkBJCT31gKIvNoAIxOWMGb6gq0HDzfSl-qwkjhrueCI9V6Ve-qZY1Y4V0NFLxDcjIhHuJKwmSom52IEgp6b3lGKmTIDvZooUJ3NiGBnyUD1rdDObM_Y8rrzmpq', height: 24 },
    { name: 'Spotify', src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCusWGvk2B2lh8n9WfBOnvOJIAjlzrv0NCLMVwkXlLypndIUyTPY90lPkuFonJbrCZT2oLKd38a1LWQh8aqBDlQeiXfI37IkY4ZEWdzdwpalDUKuPNYy_4pX0w-SNXYBVLDj2hZyLlJDmUUZGBzEEZQ-YZao8u33OtYws7sonopGkTNI7FonRyaO0vHYUGYVdoOXhoNF77Xu3puG4setR0hw0Dz7r4HEj0xH7rwy2-QXq2eVASCgBI9fr7EWbU6DMwjVBmSJAsGLKqm', height: 24 },
    { name: 'ACME', src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDQ0X23v0Wgfqys209SSQiiN3Yyg1q-Kerqk_PF43PrGHfOQa69xv6ferrw7rZ5j6pKrUQQNxpoZ11KK0GNa0sgdONGD_G-bxBtx36Oq3XrVAqA92MpuIM6odJJcuU0ilpN_aa63f70RaDmbC6ZHjSEVX4Cjdc8WmZZKqzFRKbUJxQsMTncGmEHpmFFv9fB6VpXERWYxEaZq6OT2CtJKPsVfQOCcfljoqM1Y2j_tB4_r8ZKhRcV5hrRZ295kd2gdLEJXwrxaJpGXH4N', height: 24 },
    { name: 'Samsung', src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBj_x4Okmf5Wg4kjpryZOlScD7eL3vBKLnVFa_SgQIygSJBTRnIpnnqbEd75uXZThtVnf_m4xDcBPd8BhfmAOknTA0tdo1yumEUI3HU7ZGc8gDMQoqCUqaXhuN6FWsIRGYmHny31BYyXOQXDISGzAVMFH206gs_416g7yiiyYPoIc3y15KBu5leR5zZnx4oBMZUNdiRsEnqnWYvQUzWxDmr7r2odhqivBnC5CkUsXeHToAWBngdOAzRpi-Mz9-4qFZIpEpaEJiuUAQV', height: 28 },
    { name: 'Sonegan', src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAs91PcHWGwRdWeaxfGahyE8p6bgVMdtNCqyhXk998dJU33DzyE5Wv3DIUraeqvra9BxvClqsEOv9xp8xtdf5Qr89gMwCJBJued-xobIDIBORELxaGoICMV5wpmfKO8siXeeaNl3OucK4ARFxQwdivoQp4AcEYaWF1vwnHErYqZFzcTnMbdeFCzAxgeFaBjJqWqrfVxL-MFgZZ0Qtkv-bJXwlJAQbPtsYiVdCFfXMkgtDhtYZ7TiCoVM1XgmjMTIA6TZygUOR_KBUoH', height: 24 },
  ];

  return (
    <section id="integrations" className="py-16 bg-white/80 dark:bg-slate-900/60 border-y border-slate-100 dark:border-slate-800 overflow-hidden relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(14,165,233,0.06),transparent_30%,rgba(16,185,129,0.06))]"
      />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:bg-slate-800/70 dark:text-slate-300"
          >
            Güven
          </motion.p>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-center text-slate-600 dark:text-slate-400 font-medium"
          >
              Sektör liderlerinin güvendiği platform:
          </motion.p>
        </div>
        
        <div className="relative flex overflow-hidden">
             {/* Gradient Masks */}
             <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white dark:from-slate-900 to-transparent z-10" />
             <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white dark:from-slate-900 to-transparent z-10" />

             {/* Marquee Track */}
             <div className="flex animate-marquee whitespace-nowrap gap-16 items-center">
                {/* Original Set */}
                {clients.map((client, i) => (
                    <div key={`original-${i}`} className="flex-shrink-0 w-32 flex justify-center">
                        <Image 
                            src={client.src} 
                            alt={`${client.name} logo`} 
                            height={client.height} 
                            width={120} 
                            className="h-auto w-auto max-h-8 opacity-50 dark:opacity-40 grayscale hover:grayscale-0 dark:invert hover:invert-0 hover:opacity-100 dark:hover:opacity-100 transition-all cursor-pointer"
                            unoptimized
                        />
                    </div>
                ))}
                
                {/* Duplicate Set for Loop */}
                {clients.map((client, i) => (
                    <div key={`duplicate-${i}`} className="flex-shrink-0 w-32 flex justify-center">
                        <Image 
                            src={client.src} 
                            alt={`${client.name} logo`} 
                            height={client.height} 
                            width={120} 
                            className="h-auto w-auto max-h-8 opacity-50 dark:opacity-40 grayscale hover:grayscale-0 dark:invert hover:invert-0 hover:opacity-100 dark:hover:opacity-100 transition-all cursor-pointer"
                            unoptimized
                        />
                    </div>
                ))}

                {/* Second Duplicate Set for Smoother Loop on large screens */}
                {clients.map((client, i) => (
                    <div key={`duplicate-2-${i}`} className="flex-shrink-0 w-32 flex justify-center">
                        <Image 
                            src={client.src} 
                            alt={`${client.name} logo`} 
                            height={client.height} 
                            width={120} 
                            className="h-auto w-auto max-h-8 opacity-50 dark:opacity-40 grayscale hover:grayscale-0 dark:invert hover:invert-0 hover:opacity-100 dark:hover:opacity-100 transition-all cursor-pointer"
                            unoptimized
                        />
                    </div>
                ))}
             </div>
        </div>
      </div>
    </section>
  );
};
