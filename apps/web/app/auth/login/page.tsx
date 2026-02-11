'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { UnifiedNavbar } from '@/components/landing-new/UnifiedNavbar';
import { Button } from '@/components/shared/ui/Button';
import { Input } from '@/components/shared/ui/Input';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const CREDENTIALS_ERROR_MAP: Record<
  string,
  { field: 'email' | 'password' | 'general'; message: string }
> = {
  missing_credentials: {
    field: 'general',
    message: 'E-posta ve şifre gereklidir.',
  },
  user_not_found: {
    field: 'email',
    message: 'Bu e-posta adresiyle kayıtlı bir kullanıcı bulunamadı.',
  },
  invalid_password: {
    field: 'password',
    message: 'Şifre yanlış. Lütfen tekrar deneyin.',
  },
  email_not_verified: {
    field: 'email',
    message: 'E-posta adresiniz doğrulanmamış. Lütfen gelen kutunuzu kontrol edin.',
  },
  oauth_only: {
    field: 'general',
    message: 'Bu hesap sosyal giriş ile oluşturulmuş. Google veya Microsoft ile giriş yapın.',
  },
  db_unavailable: {
    field: 'general',
    message: 'Sisteme şu anda erişilemiyor. Lütfen daha sonra tekrar deneyin.',
  },
  auth_failed: {
    field: 'general',
    message: 'Giriş yapılamadı. Lütfen tekrar deneyin.',
  },
  credentials: {
    field: 'general',
    message: 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.',
  },
  invalid_credentials: {
    field: 'general',
    message: 'Giriş bilgileri hatalı. Lütfen tekrar deneyin.',
  },
};

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
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      
      if (result?.error) {
        if (result.error === 'CredentialsSignin') {
          const code = (result.code || 'credentials').toLowerCase();
          const mapped = CREDENTIALS_ERROR_MAP[code] || CREDENTIALS_ERROR_MAP.credentials;
          const nextErrors: { email?: string; password?: string; general?: string } = {};
          nextErrors[mapped.field] = mapped.message;
          setFormErrors(nextErrors);
          return;
        }

        if (result.error === 'Configuration') {
          setFormErrors({ general: 'Sistem yapılandırma hatası. Lütfen daha sonra tekrar deneyin.' });
          return;
        }

        if (result.error === 'OAuthAccountNotLinked') {
          setFormErrors({ general: 'Bu e-posta farklı bir giriş yöntemiyle kayıtlı. Lütfen doğru yöntemle giriş yapın.' });
          return;
        }

        if (result.error === 'AccessDenied') {
          setFormErrors({ general: 'Giriş izni reddedildi. Lütfen destek ile iletişime geçin.' });
          return;
        }

        setFormErrors({ general: 'Giriş yapılamadı. Lütfen tekrar deneyin.' });
        return;
      }

      if (result?.ok) {
        toast.success('Giriş başarılı! Yönlendiriliyorsunuz...');
        router.push('/orders');
        router.refresh();
      }
    } catch (error: unknown) {
      console.error('Login error:', error);
      setFormErrors({ general: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'azure-ad') => {
    try {
      await signIn(provider, { callbackUrl: '/orders' });
    } catch (error: unknown) {
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
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 p-8 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800">
          <header className="text-center lg:text-left mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-neutral-900 dark:text-white">Tekrar Hoş Geldiniz</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Hesabınıza giriş yaparak devam edin</p>
          </header>

          {/* Social Login */}
          <div className="space-y-3 mb-6">
            <button 
              onClick={() => handleSocialLogin('google')}
              className="group w-full h-12 border border-slate-200/50 dark:border-slate-700/50 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-all duration-300 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm hover:shadow-lg hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google ile devam et
            </button>
            
            <button 
              onClick={() => handleSocialLogin('azure-ad')}
              className="group w-full h-12 border border-slate-200/50 dark:border-slate-700/50 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-all duration-300 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm hover:shadow-lg hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 21 21">
                <path d="M1 1h9v9H1V1zm10 0h9v9h-9V1zM1 11h9v9H1v-9zm10 11h9v-9h-9v9z"/>
              </svg>
              Microsoft ile devam et
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
            <p className="text-sm font-medium text-slate-400">veya e-posta ile</p>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">E-posta Adresi</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
                }}
                className={formErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                placeholder="ornek@eposta.com"
                required
              />
              {formErrors.email && (
                <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                  {formErrors.email}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Şifre</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formErrors.password) setFormErrors({ ...formErrors, password: undefined });
                  }}
                  className={cn("pr-10", formErrors.password ? 'border-red-500 focus-visible:ring-red-500' : '')}
                  placeholder="Şifreniz"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {formErrors.password && (
                <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                  {formErrors.password}
                </p>
              )}
              <div className="text-right">
                <Link href="/auth/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline">
                  Şifremi Unuttum
                </Link>
              </div>
            </div>

            {formErrors.general && (
              <div className="p-3 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg text-sm font-medium text-center">
                {formErrors.general}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Giriş Yapılıyor...
                </>
              ) : (
                'Giriş Yap'
              )}
            </Button>
          </form>

          <div className="mt-8 text-center sm:hidden">
            <p className="text-sm text-slate-500 dark:text-slate-400">
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
        className="hidden lg:flex lg:flex-[0.5] items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-primary-700/10 via-transparent to-transparent"></div>
        
        <div className="max-w-md text-center relative z-10">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative h-24 w-full mx-auto mb-8"
          >
            <Image 
              src="/renkflow-logo-new.png" 
              alt="RenkFlow" 
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              className="object-contain"
              priority
            />
          </motion.div>
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-3xl font-black mb-4 bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent"
          >
            İş Akışınızı Dönüştürün
          </motion.h2>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed"
          >
            Renkflow ile siparişlerinizi, müşterilerinizi ve iş süreçlerinizi tek bir platformda yönetin.
          </motion.p>
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-12 p-6 glass-panel rounded-2xl border border-white/50 dark:border-white/5 bg-white/30 dark:bg-slate-800/30"
          >
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Henüz üye değil misiniz?</p>
            <Link href="/signup">
              <button className="mt-3 px-8 py-3 rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold shadow-sm hover:shadow-md transition-all hover:scale-105 border border-slate-200 dark:border-slate-700">
                Hemen Kayıt Olun
              </button>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default function AuthLogin() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark relative font-display">
      <UnifiedNavbar />

      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
