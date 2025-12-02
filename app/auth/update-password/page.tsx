'use client';

import { useState } from 'react';
import { supabase } from '@/lib/auth/supabase';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      toast.success('Şifreniz başarıyla güncellendi! Yönlendiriliyorsunuz...');
      setTimeout(() => router.push('/orders'), 2000);
    } catch (error: any) {
      console.error('Update password error:', error);
      toast.error('Şifre güncellenemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left - Visual */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="hidden md:flex items-center justify-center p-8 bg-background-light dark:bg-background-dark"
      >
        <div className="w-full h-full bg-center bg-no-repeat bg-cover rounded-xl shadow-2xl relative overflow-hidden">
          <Image
            src="/dashboard-preview.png"
            alt="Abstract graphic representing flowing tasks and collaboration"
            fill
            className="object-cover"
          />
        </div>
      </motion.div>

      {/* Right - Form */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="flex items-center justify-center p-4 sm:p-8 bg-surface-light dark:bg-surface-dark"
      >
        <div className="w-full max-w-md flex flex-col gap-8">
          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="relative w-32 h-10">
                <Image
                  src="/logo.png"
                  alt="Renkflow"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-text-light dark:text-text-dark">
                Yeni Şifre Belirle
              </h1>
              <p className="text-base font-normal text-text-muted-light dark:text-text-muted-dark">
                Lütfen hesabınız için yeni bir şifre girin.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
            <label className="flex flex-col min-w-40 flex-1">
              <p className="text-sm font-medium leading-normal pb-2 text-text-light dark:text-text-dark">
                Yeni Şifre
              </p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-professional"
                placeholder="En az 8 karakter"
                required
                minLength={8}
              />
            </label>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-md h-12 px-5 bg-primary text-white text-base font-bold leading-normal tracking-wide hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span className="truncate">{isLoading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}</span>
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
