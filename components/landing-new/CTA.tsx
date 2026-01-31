'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export const CTA = () => {
  return (
    <section className="w-full py-20 lg:py-32 bg-background-light dark:bg-background-dark">
      <div className="container mx-auto max-w-4xl px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="rounded-2xl bg-gradient-to-r from-primary to-secondary p-8 md:p-16 text-center shadow-xl"
        >
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
            Ekibinizin Potansiyelini Ortaya Çıkarın
          </h2>
          <p className="mt-6 mx-auto max-w-2xl text-lg text-white/90">
            Renkflow ile projelerinizi daha hızlı, daha akıllı ve daha işbirlikçi bir şekilde yönetin. 
            Bugün ücretsiz başlayın, kredi kartı gerekmez.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white text-primary font-bold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
              >
                Ücretsiz Başlayın
              </motion.button>
            </Link>
            <Link href="/contact">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-transparent border-2 border-white text-white font-bold py-3.5 px-8 rounded-full hover:bg-white/10 transition-colors w-full sm:w-auto"
              >
                Demo İsteyin
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
