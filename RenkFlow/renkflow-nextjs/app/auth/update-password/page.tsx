'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { UnifiedNavbar } from '@/components/landing-new/UnifiedNavbar';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

function UpdatePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [formErrors, setFormErrors] = useState<{
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    // Verify token on mount
    if (!token) {
      setIsValidToken(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/auth/verify-reset-token?token=${token}`);
        const data = await response.json();
        setIsValidToken(data.valid);
      } catch (error) {
        setIsValidToken(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    // Validate passwords
    if (password.length < 6) {
      setFormErrors({ password: 'Şifre en az 6 karakter olmalıdır' });
      return;
    }

    if (password !== confirmPassword) {
      setFormErrors({ confirmPassword: 'Şifreler eşleşmiyor' });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'token_expired') {
          setFormErrors({ general: 'Bu link süresi dolmuş. Lütfen yeni bir şifre sıfırlama talebi oluşturun.' });
        } else {
          setFormErrors({ general: data.error || 'Bir hata oluştu. Lütfen tekrar deneyin.' });
        }
        return;
      }

      setIsSuccess(true);
      toast.success('Şifreniz başarıyla güncellendi!');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (error: unknown) {
      console.error('Reset password error:', error);
      setFormErrors({ general: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while verifying token
  if (isValidToken === null) {
    return (
      <div className="flex min-h-screen w-full pt-20 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-subtle-light dark:text-subtle-dark">Link doğrulanıyor...</p>
        </div>
      </div>
    );
  }

  // Invalid or expired token
  if (isValidToken === false) {
    return (
      <div className="flex min-h-screen w-full pt-20 items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-3xl font-black mb-3">Geçersiz Link</h1>
          <p className="text-subtle-light dark:text-subtle-dark mb-6">
            Bu şifre sıfırlama linki geçersiz veya süresi dolmuş. 
            Lütfen yeni bir şifre sıfırlama talebi oluşturun.
          </p>
          <Link href="/auth/forgot-password">
            <button className="w-full bg-primary text-white font-bold py-3 rounded-md hover:opacity-90 transition-opacity shadow-sm">
              Yeni Talep Oluştur
            </button>
          </Link>
        </div>
      </div>
    );
  }

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
          {isSuccess ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black mb-3">Şifre Güncellendi</h1>
              <p className="text-subtle-light dark:text-subtle-dark mb-6">
                Şifreniz başarıyla güncellendi. Giriş sayfasına yönlendiriliyorsunuz...
              </p>
            </div>
          ) : (
            <>
              <header className="text-center lg:text-left mb-6">
                <h1 className="text-3xl sm:text-4xl font-black mb-3">Yeni Şifre Belirleyin</h1>
                <p className="text-subtle-light dark:text-subtle-dark">
                  Hesabınız için yeni bir şifre oluşturun.
                </p>
              </header>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Yeni Şifre</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (formErrors.password) setFormErrors({ ...formErrors, password: undefined });
                      }}
                      className={`input-professional pr-10 ${formErrors.password ? 'border-red-500' : ''}`}
                      placeholder="En az 6 karakter"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle-light dark:text-subtle-dark"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {formErrors.password && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Şifre Tekrar</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (formErrors.confirmPassword) setFormErrors({ ...formErrors, confirmPassword: undefined });
                    }}
                    className={`input-professional ${formErrors.confirmPassword ? 'border-red-500' : ''}`}
                    placeholder="Şifreyi tekrar girin"
                    required
                  />
                  {formErrors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.confirmPassword}</p>
                  )}
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
                  {isLoading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                </motion.button>
              </form>
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
          <h2 className="text-2xl font-black mb-4">Güvenliğiniz Önemli</h2>
          <p className="text-subtle-light dark:text-subtle-dark">
            Güçlü bir şifre seçerek hesabınızı koruyun. En az 6 karakter kullanın.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark relative font-display">
      <UnifiedNavbar />
      <Suspense fallback={
        <div className="flex min-h-screen w-full pt-20 items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
        </div>
      }>
        <UpdatePasswordForm />
      </Suspense>
    </div>
  );
}
