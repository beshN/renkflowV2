import Link from 'next/link';

import { auth } from '@/auth';
import { resolveOrderQrToken, AuthorizationError } from '@/app/actions/order.qr.actions';
import { OrderQrActionScreen } from '@/components/features/orders/OrderQrActionScreen';

interface QOrderPageProps {
  searchParams?: Promise<{ token?: string }>;
}

export default async function QOrderPage({ searchParams }: QOrderPageProps) {
  const params = (await searchParams) ?? {};
  const token = params.token?.trim() || '';

  if (!token) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Geçersiz QR Bağlantısı</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Token bilgisi bulunamadı.</p>
        </div>
      </main>
    );
  }

  const session = await auth();
  if (!session?.user) {
    const callback = encodeURIComponent(`/q/order?token=${token}`);

    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Giriş Gerekli</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            QR işlemini tamamlamak için önce hesabınızla giriş yapmalısınız.
          </p>
          <Link
            href={`/auth/login?callbackUrl=${callback}`}
            className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-950"
          >
            Giriş Yap
          </Link>
        </div>
      </main>
    );
  }

  try {
    const resolved = await resolveOrderQrToken(token);
    return <OrderQrActionScreen token={token} resolved={resolved} />;
  } catch (error) {
    const isForbidden = error instanceof AuthorizationError;

    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {isForbidden ? 'Yetkiniz Bulunmuyor' : 'QR İşlemi Tamamlanamadı'}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {error instanceof Error ? error.message : 'İşlem sırasında beklenmeyen bir hata oluştu.'}
          </p>
          <Link href="/dashboard" className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">
            Dashboard'a dön
          </Link>
        </div>
      </main>
    );
  }
}
