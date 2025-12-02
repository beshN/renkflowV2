'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

export default function AuthLogin() {
  const [showPassword, setShowPassword] = useState(false);

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
                Hesabınıza Giriş Yapın
              </h1>
              <p className="text-base font-normal text-text-muted-light dark:text-text-muted-dark">
                Hoş geldiniz! Lütfen bilgilerinizi girin.
              </p>
            </div>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-4">
            <label className="flex flex-col min-w-40 flex-1">
              <p className="text-sm font-medium leading-normal pb-2 text-text-light dark:text-text-dark">
                E-posta Adresi
              </p>
              <input
                type="email"
                className="input-professional"
                placeholder="ornek@eposta.com"
              />
            </label>

            <label className="flex flex-col min-w-40 flex-1">
              <p className="text-sm font-medium leading-normal pb-2 text-text-light dark:text-text-dark">
                Şifre
              </p>
              <div className="flex w-full flex-1 items-stretch rounded-md">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-professional rounded-r-none border-r-0"
                  placeholder="Şifrenizi girin"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex items-center justify-center rounded-r-md border border-l-0 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800/50 pr-4 pl-2 text-gray-500 dark:text-gray-400"
                >
                  <span className="material-symbols-outlined cursor-pointer text-xl">
                    {showPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </label>

            <div className="flex items-center justify-end">
              <Link href="#" className="text-sm font-medium text-primary hover:underline">
                Şifremi Unuttum?
              </Link>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-md h-12 px-5 bg-primary text-white text-base font-bold leading-normal tracking-wide hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark transition-colors duration-200"
            >
              <span className="truncate">Giriş Yap</span>
            </motion.button>

            <button
              type="button"
              className="flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-md h-12 px-5 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-base font-bold leading-normal tracking-wide hover:bg-background-light dark:hover:bg-background-dark transition-colors duration-200"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="truncate">Google ile Giriş Yap</span>
              </div>
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="text-center">
            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
              Hesabın yok mu? <Link href="/signup" className="font-medium text-primary hover:underline">Kayıt Ol</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
