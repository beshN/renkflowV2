'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import LandingNav from '@/components/landing/LandingNav';

function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});
  const router = useRouter();
  const searchParams = useSearchParams();

  // Show verification messages
  useEffect(() => {
    const verified = searchParams.get('verified');
    const error = searchParams.get('error');

    if (verified === 'true') {
      toast.success('E-posta adresiniz doğrulandı! Şimdi giriş yapabilirsiniz.');
    } else if (error === 'invalid_token') {
      toast.error('Geçersiz veya süresi dolmuş doğrulama linki.');
    } else if (error === 'verification_failed') {
      toast.error('E-posta doğrulama başarısız oldu. Lütfen tekrar deneyin.');
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormErrors({});

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        const errorMessage = result.error.toLowerCase();
        
        // Handle specific NextAuth errors
        if (errorMessage === 'configuration') {
          setFormErrors({ 
            general: 'Sistem yapılandırma hatası. Lütfen daha sonra tekrar deneyin veya e-posta/şifre ile giriş yapın.',
          });
        } else if (errorMessage.includes('doğrulanmamış') || errorMessage.includes('not confirmed')) {
          setFormErrors({ 
            email: 'E-posta adresiniz doğrulanmamış. Lütfen gelen kutunuzu kontrol edin.',
          });
        } else if (errorMessage.includes('hatalı') || errorMessage.includes('invalid') || errorMessage.includes('credentials')) {
          setFormErrors({ 
            password: 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.' 
          });
        } else if (errorMessage.includes('bulunamadı') || errorMessage.includes('not found')) {
          setFormErrors({ 
            email: 'Bu e-posta adresi kayıtlı değil. Lütfen kayıt olun.' 
          });
        } else if (errorMessage.includes('credentialssignin')) {
          setFormErrors({ 
            password: 'E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.' 
          });
        } else {
          setFormErrors({ general: 'Giriş yapılamadı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.' });
        }
        return;
      }

      if (result?.ok) {
        toast.success('Giriş başarılı! Yönlendiriliyorsunuz...');
        router.push('/orders');
        router.refresh();
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setFormErrors({ general: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'azure-ad') => {
    try {
      await signIn(provider, { callbackUrl: '/orders' });
    } catch (error: any) {
      console.error('Social login error:', error);
      toast.error('Sosyal medya girişi başarısız oldu.');
    }
  };

  return (
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
            <h1 className="text-3xl sm:text-4xl font-black mb-3">Tekrar Hoş Geldiniz</h1>
            <p className="text-subtle-light dark:text-subtle-dark">Hesabınıza giriş yapın</p>
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
              onClick={() => handleSocialLogin('azure-ad')}
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
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">E-posta Adresi</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
                }}
                className={`input-professional ${formErrors.email ? 'border-red-500' : ''}`}
                placeholder="ornek@eposta.com"
                required
              />
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-500">{formErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Şifre</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formErrors.password) setFormErrors({ ...formErrors, password: undefined });
                  }}
                  className={`input-professional pr-10 ${formErrors.password ? 'border-red-500' : ''}`}
                  placeholder="Şifreniz"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle-light dark:text-subtle-dark"
                >
                  <span className="material-symbols-outlined">{showPassword ? 'visibility' : 'visibility_off'}</span>
                </button>
              </div>
              {formErrors.password && (
                <p className="mt-1 text-sm text-red-500">{formErrors.password}</p>
              )}
              <div className="text-right">
                <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
                  Şifremi Unuttum
                </Link>
              </div>
            </div>

            {formErrors.general && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{formErrors.general}</p>
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white font-bold py-3 rounded-md hover:opacity-90 transition-opacity mt-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </motion.button>
          </form>

          <div className="mt-6 text-center sm:hidden">
            <p className="text-sm text-subtle-light dark:text-subtle-dark">
              Hesabınız yok mu?{' '}
              <Link href="/signup" className="text-primary font-bold hover:underline">
                Kayıt Ol
              </Link>
            </p>
          </div>
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
              width={300}
              height={80}
              className="mx-auto"
              priority
            />
          </div>
          <h2 className="text-2xl font-black mb-4">İş Akışınızı Dönüştürün</h2>
          <p className="text-subtle-light dark:text-subtle-dark">
            Renkflow ile siparişlerinizi, müşterilerinizi ve iş süreçlerinizi tek bir platformda yönetin.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function AuthLogin() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark relative font-display">
      <LandingNav />

      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

