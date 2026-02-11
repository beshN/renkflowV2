'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { UnifiedNavbar } from '@/components/landing-new/UnifiedNavbar';
import { AlertCircle, MailCheck } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error || 'Bir hata oluştu. Lütfen tekrar deneyin.');
        return;
      }

      setIsSuccess(true);
      toast.success('Şifre sıfırlama linki gönderildi!');
    } catch (error: unknown) {
      console.error('Forgot password error:', error);
      setFormError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark relative font-display">
      <UnifiedNavbar />


      <div className="flex min-h-screen w-full pt-20">
        {/* Left - Form */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex-1 lg:flex-[0.5] flex items-center justify-center p-4 sm:p-8"
        >
        <div className="w-full max-w-md glass-panel p-8 rounded-2xl overflow-hidden">
            {isSuccess ? (
              <div className="text-center">
                <div className="w-20 h-20 bg-emerald-100/50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-emerald-50 dark:ring-emerald-900/10">
                  <MailCheck className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-black mb-3 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">E-posta Gönderildi</h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                  Şifre sıfırlama linki <strong className="text-slate-900 dark:text-white font-semibold">{email}</strong> adresine gönderildi. 
                  Lütfen gelen kutunuzu kontrol edin.
                </p>
                <div className="p-4 bg-primary-50/60 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-900/30 mb-8">
                  <p className="text-sm text-primary-700 dark:text-primary-300">
                    E-posta gelmedi mi? Spam klasörünü kontrol edin veya birkaç dakika bekleyin.
                  </p>
                </div>
                <Link href="/auth/login">
                  <button className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-4 rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                    Giriş Sayfasına Dön
                  </button>
                </Link>
              </div>
            ) : (
              <>
                <header className="text-center lg:text-left mb-8">
                  <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">Şifremi Unuttum</h1>
                  <p className="text-base text-slate-500 dark:text-slate-400">
                    E-posta adresinizi girin, size şifre sıfırlama linki gönderelim.
                  </p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2 ml-1 text-slate-700 dark:text-slate-200">E-posta Adresi</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (formError) setFormError('');
                      }}
                      className={`w-full px-4 py-3.5 rounded-xl border bg-white/40 dark:bg-slate-900/40 backdrop-blur-md focus:ring-4 focus:ring-primary/10 transition-all outline-none ${
                        formError 
                          ? 'border-red-500 focus:border-red-500' 
                          : 'border-slate-200/50 dark:border-slate-700/50 focus:border-primary'
                      }`}
                      placeholder="ornek@eposta.com"
                      required
                    />
                    {formError && (
                      <p className="mt-2 text-sm text-red-500 font-medium flex items-center gap-2 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800">
                        <AlertCircle className="h-5 w-5" />
                        {formError}
                      </p>
                    )}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-primary to-primary-700 hover:from-primary/90 hover:to-primary-700/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed text-lg flex items-center justify-center gap-2 transition-all"
                  >
                    {isLoading ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      'Şifre Sıfırlama Linki Gönder'
                    )}
                  </motion.button>
                </form>

                <div className="mt-8 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Şifrenizi hatırladınız mı?{' '}
                    <Link href="/auth/login" className="text-primary font-bold hover:underline">
                      Giriş Yap
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Right - Hero Image */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden lg:flex lg:flex-[0.5] items-center justify-center p-8 bg-gradient-to-br from-primary/10 to-primary/5"
        >
          <div className="max-w-md text-center">
            <div className="mb-8">
              <Image
                src="/logo-full.png"
                alt="Renkflow Logo"
                width={1000}
                height={260}
                className="mx-auto"
                priority
              />
            </div>
            <h2 className="text-2xl font-black mb-4">Şifrenizi Sıfırlayın</h2>
            <p className="text-subtle-light dark:text-subtle-dark">
              Endişelenmeyin, hesabınıza tekrar erişim sağlamanıza yardımcı olacağız.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
