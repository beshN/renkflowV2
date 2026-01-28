'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import LandingNav from '@/components/landing/LandingNav';

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
    } catch (error: any) {
      console.error('Forgot password error:', error);
      setFormError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark relative font-display">
      <LandingNav />

      {/* Top Right Login Link */}
      <div className="absolute top-6 right-6 z-10 hidden sm:block">
        <div className="flex items-center gap-4">
          <p className="text-sm text-subtle-light dark:text-subtle-dark">Şifrenizi hatırladınız mı?</p>
          <Link href="/auth/login">
            <button className="px-4 py-2 border border-border-light dark:border-border-dark rounded-md font-bold text-sm hover:bg-white dark:hover:bg-surface-dark transition-colors shadow-sm">
              Giriş Yap
            </button>
          </Link>
        </div>
      </div>

      <div className="flex min-h-screen w-full pt-20">
        {/* Left - Form */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex-1 lg:flex-[0.5] flex items-center justify-center p-4 sm:p-8"
        >
          <div className="w-full max-w-md">
            {isSuccess ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-3xl text-green-600 dark:text-green-400">
                    mark_email_read
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black mb-3">E-posta Gönderildi</h1>
                <p className="text-subtle-light dark:text-subtle-dark mb-6">
                  Şifre sıfırlama linki <strong>{email}</strong> adresine gönderildi. 
                  Lütfen gelen kutunuzu kontrol edin.
                </p>
                <p className="text-sm text-subtle-light dark:text-subtle-dark mb-6">
                  E-posta gelmedi mi? Spam klasörünü kontrol edin veya birkaç dakika bekleyin.
                </p>
                <Link href="/auth/login">
                  <button className="w-full bg-primary text-white font-bold py-3 rounded-md hover:opacity-90 transition-opacity shadow-sm">
                    Giriş Sayfasına Dön
                  </button>
                </Link>
              </div>
            ) : (
              <>
                <header className="text-center lg:text-left mb-6">
                  <h1 className="text-3xl sm:text-4xl font-black mb-3">Şifremi Unuttum</h1>
                  <p className="text-subtle-light dark:text-subtle-dark">
                    E-posta adresinizi girin, size şifre sıfırlama linki gönderelim.
                  </p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">E-posta Adresi</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (formError) setFormError('');
                      }}
                      className={`input-professional ${formError ? 'border-red-500' : ''}`}
                      placeholder="ornek@eposta.com"
                      required
                    />
                    {formError && (
                      <p className="mt-1 text-sm text-red-500">{formError}</p>
                    )}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-primary text-white font-bold py-3 rounded-md hover:opacity-90 transition-opacity mt-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Gönderiliyor...' : 'Şifre Sıfırlama Linki Gönder'}
                  </motion.button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-subtle-light dark:text-subtle-dark">
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
