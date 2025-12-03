'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/auth/supabase';
import { toast } from 'sonner';
import LandingNav from '@/components/landing/LandingNav';

export default function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        toast.success('Hesabınız başarıyla oluşturuldu! Giriş sayfasına yönlendiriliyorsunuz...');
        setTimeout(() => router.push('/auth/login'), 2000);
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Kayıt olurken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'azure') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Social login error:', error);
      toast.error(error.message || 'Sosyal medya girişi başarısız oldu.');
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark relative font-display">
      <LandingNav />
      
      <div className="flex min-h-screen w-full pt-20">
        {/* Left - Form */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex-1 lg:flex-[0.5] flex items-center justify-center p-4 sm:p-8"
        >
          <div className="w-full max-w-md">
            <header className="text-center lg:text-left mb-6">
              <h1 className="text-3xl sm:text-4xl font-black mb-3">Renkflow&apos;a Hoş Geldiniz</h1>
              <p className="text-subtle-light dark:text-subtle-dark">Projelerinizi organize etmeye başlayın</p>
            </header>

            {/* Social Login */}
            <div className="space-y-3 mb-6">
              <button 
                onClick={() => handleSocialLogin('google')}
                className="w-full h-12 border border-border-light dark:border-border-dark rounded-md font-bold flex items-center justify-center gap-3 hover:bg-white dark:hover:bg-surface-dark transition-colors bg-surface-light dark:bg-surface-dark shadow-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google ile devam et
              </button>
              
              <button 
                onClick={() => handleSocialLogin('azure')}
                className="w-full h-12 border border-border-light dark:border-border-dark rounded-md font-bold flex items-center justify-center gap-3 hover:bg-white dark:hover:bg-surface-dark transition-colors bg-surface-light dark:bg-surface-dark shadow-sm"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 21 21">
                  <path d="M1 1h9v9H1V1zm10 0h9v9h-9V1zM1 11h9v9H1v-9zm10 11h9v-9h-9v9z"/>
                </svg>
                Microsoft ile devam et
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2 mb-6">
              <hr className="flex-1 border-border-light dark:border-border-dark"/>
              <p className="text-sm text-subtle-light dark:text-subtle-dark">veya</p>
              <hr className="flex-1 border-border-light dark:border-border-dark"/>
            </div>

            {/* Form */}
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Ad Soyad</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-professional"
                  placeholder="Adınızı ve soyadınızı girin"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">E-posta Adresi</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-professional"
                  placeholder="ornek@eposta.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Şifre</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-professional pr-10"
                    placeholder="En az 8 karakter"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle-light dark:text-subtle-dark"
                  >
                    <span className="material-symbols-outlined">{showPassword ? 'visibility' : 'visibility_off'}</span>
                  </button>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-white font-bold py-3 rounded-md hover:opacity-90 transition-opacity mt-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Hesap Oluşturuluyor...' : 'Hesap Oluştur'}
              </motion.button>
            </form>

            <p className="text-xs text-center text-subtle-light dark:text-subtle-dark mt-4">
              Kaydol&apos;a tıklayarak Renkflow&apos;un{' '}
              <Link href="/terms" className="underline hover:text-primary">Kullanıcı Sözleşmesini</Link> ve{' '}
              <Link href="/privacy" className="underline hover:text-primary">Gizlilik Politikasını</Link> kabul etmiş olursunuz.
            </p>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-subtle-light dark:text-subtle-dark">
                Zaten bir hesabın var mı?{' '}
                <Link href="/auth/login" className="text-primary font-bold hover:underline">
                  Giriş Yap
                </Link>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Right - Visual */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden lg:flex flex-1 items-center justify-center bg-primary/10 dark:bg-primary/20 p-8"
        >
          <div className="w-full max-w-lg aspect-square rounded-2xl bg-gradient-to-br from-primary/70 to-primary/40 dark:from-primary/50 dark:to-primary/30 p-8 shadow-2xl flex items-center justify-center">
            <div className="relative w-48 h-16">
              <Image
                src="/logo.png"
                alt="Renkflow"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
