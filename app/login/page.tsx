'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const [mode, setMode] = useState<'admin' | 'worker'>('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { loginAsAdmin, loginAsWorker } = useAuth();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'admin') {
      if (loginAsAdmin(password)) {
        router.push('/dashboard');
      } else {
        setError('Hatalı şifre. Lütfen tekrar deneyin.');
      }
    } else {
      loginAsWorker();
      router.push('/kanban');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4">
      <div className="w-full max-w-md">
        <div className="bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-8 shadow-lg">
          <div className="text-center mb-8">
            <div className="inline-flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary mb-4">
              <span className="material-symbols-outlined text-white text-2xl">
                construction
              </span>
            </div>
            <h1 className="text-2xl font-bold text-text-light dark:text-text-dark">
              RenkFlow Giriş
            </h1>
            <p className="text-subtle-light dark:text-subtle-dark mt-2">
              Lütfen giriş yönteminizi seçin
            </p>
          </div>

          {/* Tabs */}
          <div className="flex p-1 bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark mb-6">
            <button
              type="button"
              onClick={() => setMode('admin')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'admin'
                  ? 'bg-white dark:bg-card-dark text-primary shadow-sm'
                  : 'text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark'
              }`}
            >
              Yönetici
            </button>
            <button
              type="button"
              onClick={() => setMode('worker')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'worker'
                  ? 'bg-white dark:bg-card-dark text-primary shadow-sm'
                  : 'text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark'
              }`}
            >
              Fabrika Personeli
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'admin' ? (
              <div>
                <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                  Yönetici Şifresi
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 py-3 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="••••••"
                  autoFocus
                />
                {error && (
                  <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {error}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 text-center">
                <span className="material-symbols-outlined text-3xl text-primary mb-2">factory</span>
                <p className="text-sm text-text-light dark:text-text-dark font-medium">
                  Üretim Takip Panosu
                </p>
                <p className="text-xs text-subtle-light dark:text-subtle-dark mt-1">
                  Sipariş durumlarını görüntülemek ve güncellemek için giriş yapın.
                </p>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full">
              {mode === 'admin' ? 'Yönetici Girişi Yap' : 'Personel Girişi Yap'}
            </Button>

            <div className="text-center">
              <Link href="/" className="text-sm text-primary hover:underline">
                &larr; Ana Sayfaya Dön
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
