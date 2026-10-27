"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Hand } from "lucide-react";
import { fairText, productName, productPitch, type Locale } from "@/lib/features/fair/i18n";
import { ATTRACT_SLIDES } from "@/lib/features/fair/media";
import type { FairKind } from "@/lib/features/fair/products";
import { LanguageSwitch } from "./LanguageSwitch";

const SLIDE_SECONDS = 7;

/**
 * The kiosk's idle screen: full-screen photos of real installations, slowly zooming and crossfading,
 * so the stand draws people in from across the aisle. A touch anywhere starts; the caption's button
 * opens the product on the current photo straight away.
 */
export function AttractScreen({ locale, onLocale, firm, campaign, onStart, onPick }: {
  locale: Locale;
  onLocale: (locale: Locale) => void;
  firm: string;
  campaign: string | null;
  onStart: () => void;
  onPick: (kind: FairKind) => void;
}) {
  const f = fairText(locale);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % ATTRACT_SLIDES.length), SLIDE_SECONDS * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const slide = ATTRACT_SLIDES[index];

  return (
    <div role="presentation" className="fixed inset-0 z-40 cursor-pointer overflow-hidden bg-black text-white" onClick={onStart}>
      <style>{`@keyframes rf-kenburns{from{transform:scale(1)}to{transform:scale(1.12)}}.rf-kenburns{animation:rf-kenburns ${SLIDE_SECONDS + 2}s ease-out forwards}@media (prefers-reduced-motion:reduce){.rf-kenburns{animation:none}}`}</style>
      {ATTRACT_SLIDES.map((s, i) => (
        <div key={s.src} aria-hidden className={`absolute inset-0 transition-opacity duration-[1500ms] motion-reduce:transition-none ${i === index ? "opacity-100" : "opacity-0"}`}>
          <Image key={i === index ? `${s.src}-on` : s.src} src={s.src} alt="" fill unoptimized priority={i < 2} sizes="100vw" className={`object-cover ${i === index ? "rf-kenburns" : ""}`} />
        </div>
      ))}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/60" />

      <div className="relative flex h-full flex-col justify-between p-8 xl:p-12">
        <div className="flex items-start justify-between gap-6">
          <p className="font-display text-xl font-semibold uppercase tracking-[.3em] text-white/90">{firm || "Renk Alüminyum"}</p>
          <div className="rounded-lg bg-white/95 p-1 text-neutral-900" onClick={(e) => e.stopPropagation()}>
            <LanguageSwitch locale={locale} onChange={onLocale} large />
          </div>
        </div>

        <div className="grid items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div className="max-w-4xl space-y-5">
            <h1 className="font-display text-5xl font-semibold leading-[1.05] drop-shadow-lg xl:text-7xl">{f.tagline}</h1>
            {campaign && <p className="max-w-2xl text-xl text-white/85 xl:text-2xl">{campaign}</p>}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button type="button" className="inline-flex min-h-20 items-center gap-3 rounded-full bg-white px-10 text-2xl font-semibold text-neutral-900 shadow-2xl transition active:scale-95 motion-reduce:transition-none" onClick={(e) => { e.stopPropagation(); onStart(); }}>
                {f.start} <ArrowRight size={28} aria-hidden />
              </button>
              <span className="inline-flex items-center gap-2 text-lg text-white/80">
                <Hand size={22} aria-hidden className="animate-pulse motion-reduce:animate-none" /> {f.touchToStart}
              </span>
            </div>
          </div>

          <div key={index} className="w-full max-w-sm rounded-2xl border border-white/20 bg-black/40 p-5 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-white/60">{f.designIn3d}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{productName(locale, slide.kind)}</p>
            <p className="mt-1 text-sm text-white/80">{productPitch(locale, slide.kind)}</p>
            <button type="button" className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full border border-white/60 px-5 text-base font-semibold transition hover:bg-white hover:text-neutral-900 active:scale-95" onClick={(e) => { e.stopPropagation(); onPick(slide.kind); }}>
              {f.designThis} <ArrowRight size={18} aria-hidden />
            </button>
            <div className="mt-4 flex gap-1.5" aria-hidden>
              {ATTRACT_SLIDES.map((s, i) => <span key={s.src} className={`h-1 flex-1 rounded-full ${i === index ? "bg-white" : "bg-white/25"}`} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
