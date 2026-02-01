'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

interface PasswordDialogProps {
  isOpen: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
  error?: string | null;
  attempts?: number;
  maxAttempts?: number;
}

export const PasswordDialog: React.FC<PasswordDialogProps> = ({
  isOpen,
  onSubmit,
  onCancel,
  error,
  attempts = 0,
  maxAttempts = 3,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setShowPassword(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit(password);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const remainingAttempts = maxAttempts - attempts;
  const isMaxAttemptsReached = attempts >= maxAttempts;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 m-4"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Lock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Şifre Korumalı PDF
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Bu PDF şifre ile korunmaktadır
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-200">
                {error}
              </p>
              {!isMaxAttemptsReached && remainingAttempts > 0 && (
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                  Kalan deneme hakkı: {remainingAttempts}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Max Attempts Warning */}
        {isMaxAttemptsReached && (
          <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                Maksimum deneme sayısına ulaşıldı
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                Lütfen doğru şifreyi kontrol edin veya PDF sahibi ile iletişime geçin.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password Input */}
          <div>
            <label
              htmlFor="pdf-password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              PDF Şifresi
            </label>
            <div className="relative">
              <Input
                ref={inputRef}
                id="pdf-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifreyi girin..."
                disabled={isSubmitting || isMaxAttemptsReached}
                className="pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                disabled={isSubmitting || isMaxAttemptsReached}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-slate-500" />
                ) : (
                  <Eye className="h-4 w-4 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Şifre yalnızca bu PDF'yi açmak için kullanılır ve saklanmaz.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1"
            >
              İptal
            </Button>
            <Button
              type="submit"
              disabled={!password.trim() || isSubmitting || isMaxAttemptsReached}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Kontrol Ediliyor...
                </>
              ) : (
                'Aç'
              )}
            </Button>
          </div>
        </form>

        {/* Help Text */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Şifreyi hatırlamıyorsanız, PDF'yi oluşturan kişi ile iletişime geçin.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PasswordDialog;
