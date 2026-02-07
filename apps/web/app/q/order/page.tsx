import Link from 'next/link';
import { auth } from '@/auth';
import { resolveOrderQrToken, AuthorizationError } from '@/app/actions/order.qr.actions';
import { OrderQrActionScreen } from '@/components/features/orders/OrderQrActionScreen';

interface QOrderPageProps {
  searchParams?: {
    token?: string;
  };
}

export default async function QOrderPage({ searchParams }: QOrderPageProps) {
  const token = searchParams?.token?.trim() || '';

  if (!token) {
    return (
      <main className="min-h-screen grid place-items-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Geçersiz QR Link</h1>
          <p className="text-sm text-slate-500 mt-2">Token bulunamadı.</p>
        </div>
      </main>
    );
  }

  const session = await auth();
  if (!session?.user) {
    const callbackUrl = encodeURIComponent(`/q/order?token=${token}`);

    return (
      <main className="min-h-screen grid place-items-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Giriş Gerekli</h1>
          <p className="text-sm text-slate-500 mt-2">
            QR aksiyonlarını kullanmak için önce giriş yapmalısınız.
          </p>
          <Link
            href={`/auth/login?callbackUrl=${callbackUrl}`}
            className="inline-flex mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
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
    const message = error instanceof Error ? error.message : 'QR token kullanılamadı';

    return (
      <main className="min-h-screen grid place-items-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {isForbidden ? 'Yetki Yok' : 'QR Kullanılamıyor'}
          </h1>
          <p className="text-sm text-slate-500 mt-2">{message}</p>
          <Link href="/dashboard" className="inline-flex mt-4 text-sm text-blue-600 hover:underline">
            Dashboard'a dön
          </Link>
        </div>
      </main>
    );
  }
}
