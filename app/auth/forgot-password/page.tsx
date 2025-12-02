'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/auth/supabase';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) throw error;

      setEmailSent(true);
      toast.success('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi!');
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      toast.error(error.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="bg-surface-light dark:bg-surface-dark p-8 rounded-2xl shadow-premium border border-border-light dark:border-border-dark text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 mb-6">
              <span className="material-symbols-outlined text-4xl">mark_email_read</span>
            </div>
            <h1 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">
              E-posta Gönderildi
            </h1>
            <p className="text-subtle-light dark:text-subtle-dark mb-6">
              Şifre sıfırlama bağlantısını içeren bir e-posta {email} adresine gönderdik. E-postanızı kontrol edin ve talimatları izleyin.
            </p>
            <Link href="/auth/login">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-primary text-white font-semibold py-3 px-6 rounded-md transition-all duration-300 hover:shadow-md"
              >
                Giriş Sayfasına Dön
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="bg-surface-light dark:bg-surface-dark p-8 rounded-2xl shadow-premium border border-border-light dark:border-border-dark">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black mb-2 text-text-light dark:text-text-dark">
              Şifremi Unuttum
            </h1>
            <p className="text-subtle-light dark:text-subtle-dark">
              E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                E-posta Adresi
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-professional w-full"
                placeholder="ornek@email.com"
                required
                disabled={isLoading}
              />
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-primary text-white font-semibold py-3 px-6 rounded-md transition-all duration-300 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin">refresh</span>
                  <span>Gönderiliyor...</span>
                </>
              ) : (
                <>
                  <span>Sıfırlama Bağlantısı Gönder</span>
                  <span className="material-symbols-outlined">send</span>
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <Link 
              href="/auth/login"
              className="text-sm text-primary hover:underline font-medium"
            >
              ← Giriş sayfasına dön
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
