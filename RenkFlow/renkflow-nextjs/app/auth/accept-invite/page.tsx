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

interface InvitationData {
  email: string;
  tenantName: string;
  role: string;
  inviterName?: string;
}

function AcceptInviteForm() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Geçersiz davet linki');
      setIsValidating(false);
      return;
    }

    const validateInvitation = async () => {
      try {
        const response = await fetch(`/api/tenant/invite/validate?token=${token}`);
        const data = await response.json();

        if (!response.ok || !data.valid) {
          setError(data.error || 'Bu davet linki geçersiz veya süresi dolmuş.');
          setIsValidating(false);
          return;
        }

        setInvitation({
          email: data.email,
          tenantName: data.tenantName,
          role: data.role,
          inviterName: data.inviterName,
        });
        setIsValidating(false);
      } catch (err) {
        setError('Davet doğrulanırken bir hata oluştu.');
        setIsValidating(false);
      }
    };

    validateInvitation();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    // Validate
    if (!name.trim() || name.length < 2) {
      setFormErrors({ name: 'Ad Soyad en az 2 karakter olmalıdır' });
      return;
    }

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
      const response = await fetch('/api/tenant/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: name.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormErrors({ general: data.error || 'Davet kabul edilirken bir hata oluştu.' });
        setIsLoading(false);
        return;
      }

      toast.success('Hesabınız oluşturuldu!');

      // Auto sign in
      const signInResult = await signIn('credentials', {
        email: invitation?.email,
        password,
        redirect: false,
      });

      if (signInResult?.ok) {
        router.push('/orders');
      } else {
        router.push('/auth/login');
      }
    } catch (err) {
      console.error('Accept invite error:', err);
      setFormErrors({ general: 'Beklenmeyen bir hata oluştu.' });
      setIsLoading(false);
    }
  };

  // Loading state
  if (isValidating) {
    return (
      <div className="flex min-h-screen w-full pt-20 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-subtle-light dark:text-subtle-dark">Davet doğrulanıyor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen w-full pt-20 items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-3xl text-red-600 dark:text-red-400">
              error
            </span>
          </div>
          <h1 className="text-3xl font-black mb-3">Geçersiz Davet</h1>
          <p className="text-subtle-light dark:text-subtle-dark mb-6">{error}</p>
          <Link href="/auth/login">
            <button className="w-full bg-primary text-white font-bold py-3 rounded-md hover:opacity-90 transition-opacity shadow-sm">
              Giriş Sayfasına Git
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full pt-20">
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="flex-1 lg:flex-[0.5] flex items-center justify-center p-4 sm:p-8"
      >
        <div className="w-full max-w-md">
          <header className="text-center lg:text-left mb-6">
            <h1 className="text-3xl sm:text-4xl font-black mb-3">Daveti Kabul Et</h1>
            <p className="text-subtle-light dark:text-subtle-dark">
              <strong>{invitation?.tenantName}</strong> ekibine <strong>{getRoleName(invitation?.role || 'member')}</strong> olarak davet edildiniz.
            </p>
          </header>

          <div className="p-4 bg-primary/10 rounded-lg mb-6">
            <p className="text-sm">
              <span className="font-medium">E-posta:</span> {invitation?.email}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Ad Soyad</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                }}
                className={`input-professional ${formErrors.name ? 'border-red-500' : ''}`}
                placeholder="Adınız Soyadınız"
                required
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Şifre</label>
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
                  <span className="material-symbols-outlined">{showPassword ? 'visibility' : 'visibility_off'}</span>
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
              {isLoading ? 'Hesap Oluşturuluyor...' : 'Daveti Kabul Et'}
            </motion.button>
          </form>
        </div>
      </motion.div>

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
          <h2 className="text-2xl font-black mb-4">Ekibe Katılın</h2>
          <p className="text-subtle-light dark:text-subtle-dark">
            Hesabınızı oluşturun ve hemen işbirliği yapmaya başlayın.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function getRoleName(role: string): string {
  const roleNames: Record<string, string> = {
    admin: 'Yönetici',
    office: 'Ofis Çalışanı',
    worker: 'İşçi',
    member: 'Üye',
  };
  return roleNames[role] || 'Üye';
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark relative font-display">
      <UnifiedNavbar />
      <Suspense fallback={
        <div className="flex min-h-screen w-full pt-20 items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
        </div>
      }>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
