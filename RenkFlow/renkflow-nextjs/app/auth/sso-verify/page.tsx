'use হুমকির';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function SSOVerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const email = searchParams.get('email');
    const ticket = searchParams.get('ticket');

    if (!email || !ticket) {
      toast.error('Giriş bilgileri eksik');
      router.push('/auth/login');
      return;
    }

    const performLogin = async () => {
      try {
        const result = await signIn('credentials', {
          email,
          ticket,
          redirect: false,
        });

        if (result?.error) {
          console.error('SSO Login Error:', result.error);
          toast.error('Giriş başarısız. Lütfen tekrar deneyin.');
          router.push('/auth/login');
        } else {
          toast.success('Giriş başarılı! Yönlendiriliyorsunuz...');
          router.push('/dashboard');
          router.refresh();
        }
      } catch (error) {
        console.error('SSO System Error:', error);
        toast.error('Sistem hatası oluştu');
        router.push('/auth/login');
      }
    };

    performLogin();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600 dark:text-indigo-400" />
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Giriş Yapılıyor</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            SSO doğrulamanız tamamlanıyor, lütfen bekleyin...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SSOVerifyPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    }>
      <SSOVerifyContent />
    </Suspense>
  );
}
