'use client';

import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export const CTASection: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleSubscribe = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = email.trim();

      if (!trimmed) {
        toast.error('Please enter your email.');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        toast.error('Please enter a valid email address.');
        return;
      }

      setStatus('loading');

      try {
        const response = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
        });

        const data = await response.json();

        if (!response.ok) {
          setStatus('idle');
          toast.error(data.error || 'Something went wrong. Please try again.');
          return;
        }

        setStatus('success');
        setEmail('');
        toast.success(data.message || 'You joined the waitlist.');
      } catch {
        setStatus('idle');
        toast.error('Network error. Please try again.');
      }
    },
    [email]
  );

  return (
    <section
      id="waitlist"
      className="relative my-24 w-full overflow-hidden rounded-[36px] px-4 py-20 text-center sm:px-6 md:my-32 lg:px-8 xl:px-10 2xl:px-12"
    >
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-15 mix-blend-overlay" />

      <div className="relative z-10 mx-auto max-w-3xl">
        <motion.h2
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="text-4xl font-bold text-white drop-shadow-lg md:text-5xl"
        >
          Request Early Access
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08 }}
          className="mx-auto mt-5 max-w-2xl text-lg text-sky-100"
        >
          We are currently onboarding pilot manufacturers. Join the waitlist to get product updates and early access.
        </motion.p>

        <motion.form
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.14 }}
          onSubmit={handleSubscribe}
          className="mx-auto mt-10 max-w-2xl rounded-2xl border border-white/25 bg-white/10 p-2 backdrop-blur"
        >
          {status === 'success' ? (
            <div className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-4 text-sm font-semibold text-white">
              <CheckCircle2 size={18} />
              Thanks, we will contact you soon.
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Mail
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sky-100/80"
                />
                <Input
                  type="email"
                  placeholder="Work email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={status === 'loading'}
                  className="h-12 border-none bg-white/90 pl-10 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-sky-300/60"
                />
              </div>
              <Button
                type="submit"
                disabled={status === 'loading'}
                className="h-12 min-w-[180px] rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                {status === 'loading' ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <>
                    Subscribe <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </div>
          )}
        </motion.form>
      </div>
    </section>
  );
};
