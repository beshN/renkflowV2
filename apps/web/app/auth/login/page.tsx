'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { AppleCard } from '@/components/shared/ui/AppleCard';
import { Button } from '@/components/shared/ui/Button';
import { Input } from '@/components/shared/ui/Input';
import { Lock, Mail } from 'lucide-react';

function sanitizeCallback(input: string | null): string {
  if (!input) return '/dashboard';
  if (!input.startsWith('/') || input.startsWith('//')) return '/dashboard';
  return input;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(() => sanitizeCallback(searchParams.get('callbackUrl')), [searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (!result || result.error) {
      setError('Giriş bilgileri doğrulanamadı.');
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F2F2F7] dark:bg-black relative overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-400/20 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-normal" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-400/20 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-normal" />
        </div>

        <AppleCard variant="glass" className="w-full max-w-md p-8 relative z-10 shadow-2xl">
            <div className="text-center mb-8">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/30 mx-auto mb-6">
                  R
                </div>
                <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">Tekrar Hoş Geldiniz</h1>
                <p className="text-sm text-muted-foreground mt-2">Hesabınıza erişmek için giriş yapın</p>
            </div>

            <div className="space-y-4 mb-6">
                 <button
                  type="button"
                  onClick={() => signIn('google', { callbackUrl })}
                  className="w-full relative flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-neutral-800 border border-input py-2.5 text-sm font-medium text-foreground transition hover:bg-neutral-50 dark:hover:bg-neutral-700"
                >
                  <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                    <path
                      d="M12.0003 20.45c4.656 0 8.556-3.213 9.77-7.6h-9.77v-3.8h13.84c.15 1.075.24 2.175.24 3.3 0 7.738-5.32 13.65-14.07 13.65-8.284 0-15-6.716-15-15s6.716-15 15-15c3.99 0 7.64 1.463 10.43 3.863l-4.16 3.425c-1.638-1.125-3.838-1.788-6.27-1.788-6.075 0-11.088 4.413-12.925 10.05h.01zm0 0"
                      fill="currentColor"
                      className="text-foreground"
                    />
                  </svg>
                  Google ile devam et
                </button>
            </div>

            <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-input" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground bg-white/50 dark:bg-black/50 backdrop-blur-md">veya e-posta ile</span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    type="email"
                    label="E-posta"
                    placeholder="ornek@sirket.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    leftIcon={<Mail size={18} />}
                    variant="default"
                />
                
                <div className="space-y-1">
                     <Input
                        type="password"
                        label="Şifre"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        leftIcon={<Lock size={18} />}
                        variant="default"
                    />
                     <div className="flex justify-end">
                        <Link href="/auth/forgot-password" className="text-xs font-medium text-primary hover:underline">
                            Şifremi unuttum
                        </Link>
                    </div>
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium">
                        {error}
                    </div>
                )}

                <Button 
                    type="submit" 
                    variant="primary" 
                    className="w-full h-11 text-base shadow-lg shadow-primary/25"
                    isLoading={loading}
                    loadingText="Giriş yapılıyor..."
                >
                    Giriş Yap
                </Button>
            </form>
            
             <p className="mt-8 text-center text-sm text-muted-foreground">
                Hesabınız yok mu?{' '}
                <Link href="/signup" className="font-semibold text-primary hover:underline transition-colors">
                  Kayıt Olun
                </Link>
              </p>
        </AppleCard>

        {/* Footer */}
        <div className="absolute bottom-6 text-center w-full">
            <p className="text-xs text-muted-foreground/60">
                &copy; 2024 RenkFlow. Tüm hakları saklıdır.
            </p>
        </div>
    </div>
  );
}
