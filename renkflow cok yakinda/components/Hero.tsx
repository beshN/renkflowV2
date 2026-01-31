import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, ShieldCheck, CheckCircle2, BellRing } from 'lucide-react';

export const Hero: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  // Cursor glow
  const glowRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const onMove = (e: MouseEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      if (rafRef.current) return;

      rafRef.current = window.requestAnimationFrame(function tick() {
        const dx = target.current.x - current.current.x;
        const dy = target.current.y - current.current.y;

        // smooth follow
        current.current.x += dx * 0.12;
        current.current.y += dy * 0.12;

        if (glowRef.current) {
          glowRef.current.style.transform = `translate(${current.current.x}px, ${current.current.y}px)`;
        }

        // keep animating while cursor is moving
        if (Math.abs(dx) + Math.abs(dy) > 0.5) {
          rafRef.current = window.requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
        }
      });
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [prefersReducedMotion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    setTimeout(() => {
      setStatus('success');
      setEmail('');
    }, 1500);
  };

  return (
    <section className="relative w-full overflow-hidden">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* aurora blobs - more visible */}
        <div className="absolute -top-24 -left-32 h-[520px] w-[520px] rounded-full bg-brand-primary/25 blur-3xl" />
        <div className="absolute top-10 -right-40 h-[560px] w-[560px] rounded-full bg-brand-accent/20 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-[520px] w-[520px] rounded-full bg-indigo-400/15 blur-3xl" />

        {/* subtle grid */}
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,rgba(2,6,23,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(2,6,23,0.12)_1px,transparent_1px)] [background-size:72px_72px]" />

        {/* noise (CSS-only-ish) */}
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(rgba(2,6,23,0.18)_1px,transparent_1px)] [background-size:18px_18px]" />
      </div>

      {/* Cursor glow */}
      {!prefersReducedMotion && (
        <div
          ref={glowRef}
          className="pointer-events-none absolute left-0 top-0 -z-10 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-[0.14]"
          style={{
            background:
              'radial-gradient(circle at center, rgba(99,102,241,0.35), rgba(56,189,248,0.18), transparent 60%)',
          }}
        />
      )}

      {/* Content wrapper (tighter spacing) */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-10 md:pt-10 md:pb-12">
        {/* Logo - top left, no hover scale */}
        <div className="flex justify-start">
          <img
            src="/renkflow_logo.svg"
            alt="RenkFlow"
            className="h-12 sm:h-14 md:h-16 w-auto drop-shadow-xl select-none"
            draggable={false}
          />
        </div>

        <div className="mt-10 md:mt-12 flex flex-col items-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/60 border border-brand-primary/20 backdrop-blur-md shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-70 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-accent" />
            </span>
            <span className="text-sm font-semibold tracking-widest text-gray-700 uppercase">
              Çok Yakında...
            </span>
          </div>

          {/* Headline (slightly smaller, better balance) */}
          <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-[1.08] tracking-tight max-w-4xl">
            Şirketiniz için ihtiyacınız olan <span className="text-brand-primary">tek yazılım.</span>
          </h1>

          <p className="mt-3 text-lg sm:text-xl text-gray-600 max-w-2xl">
            Planla. Takip et. Optimize et.
          </p>

          <p className="mt-6 text-base sm:text-lg text-gray-600/90 max-w-2xl">
            RenkFlow ile süreçlerinizi modernize edin, verimliliği artırın. Erken erişim listesine katılın.
          </p>

          {/* Action */}
          <div className="w-full max-w-xl mt-8">
            {status === 'success' ? (
              <div className="p-7 rounded-3xl bg-white/70 border border-green-200 flex flex-col items-center gap-3 shadow-xl backdrop-blur">
                <div className="p-3 bg-green-100 rounded-full text-green-700">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-xl">Harika!</h4>
                  <p className="text-gray-600 mt-1">Kaydınız alındı. Açılışta görüşürüz.</p>
                </div>
                <button
                  onClick={() => setStatus('idle')}
                  className="mt-2 text-sm text-gray-500 hover:text-gray-900 underline"
                >
                  Başka bir e-posta ekle
                </button>
              </div>
            ) : (
              <div className="bg-white/70 p-2 rounded-2xl shadow-2xl border border-white/60 backdrop-blur">
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      required
                      disabled={status === 'loading'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-12 pr-4 py-4 rounded-xl bg-white/70 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-brand-accent/25 focus:border-brand-accent/30 transition-shadow"
                      placeholder="E-posta adresiniz"
                    />
                  </div>

                  {/* Button with shine + hover lift (no scale) */}
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="relative overflow-hidden px-8 py-4 rounded-xl bg-gray-900 text-white font-bold text-base sm:text-lg transition-all duration-200 shadow-lg hover:-translate-y-[1px] hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2"
                  >
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shine_2.8s_ease-in-out_infinite]" />
                    <span className="relative z-10 flex items-center gap-2">
                      {status === 'loading' ? (
                        <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          Bana Haber Ver <BellRing className="w-5 h-5" />
                        </>
                      )}
                    </span>
                  </button>
                </form>

                <div className="px-4 py-3 bg-white/60 rounded-xl mt-2 flex items-center justify-center gap-2 text-sm text-gray-500">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Spam yok, sadece önemli güncellemeler.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* keyframes (keep local if you don't want globals.css) */}
      <style jsx global>{`
        @keyframes shine {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(120%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-ping,
          .animate-[shine_2.8s_ease-in-out_infinite] {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
};