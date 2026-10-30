"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Hand } from "lucide-react";
import { fairText, productName, productPitch, type Locale } from "@/lib/features/fair/i18n";
import { ATTRACT_SLIDES } from "@/lib/features/fair/media";
import type { FairKind } from "@/lib/features/fair/products";
import { BrandLogo } from "./BrandLogo";
import { LanguageSwitch } from "./LanguageSwitch";

const SLIDE_SECONDS = 7;

/**
 * The kiosk's idle screen: full-screen photos of real installations, slowly zooming and crossfading,
 * so the stand draws people in from across the aisle. A touch anywhere starts; the caption's button
 * opens the product on the current photo straight away.
 */
export function AttractScreen({ locale, onLocale, campaign, onStart, onPick }: {
  locale: Locale;
  onLocale: (locale: Locale) => void;
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
    <div role="presentation" className="fx-dark fixed inset-0 z-40 cursor-pointer overflow-hidden bg-[hsl(var(--fx-deep))] text-white" onClick={onStart}>
      <style>{`@keyframes rf-kenburns{from{transform:scale(1)}to{transform:scale(1.1)}}.rf-kenburns{animation:rf-kenburns ${SLIDE_SECONDS + 2}s ease-out forwards}@media (prefers-reduced-motion:reduce){.rf-kenburns{animation:none}}`}</style>
      {ATTRACT_SLIDES.map((s, i) => (
        <div key={s.src} aria-hidden className={`absolute inset-0 transition-opacity [transition-duration:1500ms] motion-reduce:transition-none ${i === index ? "opacity-100" : "opacity-0"}`}>
          <Image key={i === index ? `${s.src}-on` : s.src} src={s.src} alt="" fill unoptimized priority={i < 2} sizes="100vw" className={`object-cover ${i === index ? "rf-kenburns" : ""}`} />
        </div>
      ))}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[hsl(241_62%_10%/0.9)] via-[hsl(241_62%_10%/0.55)] to-transparent portrait:from-[hsl(241_62%_10%/0.3)] portrait:via-[hsl(241_62%_10%/0.35)]" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[hsl(241_62%_8%/0.9)] via-transparent to-[hsl(241_62%_8%/0.35)]" />
      <div aria-hidden className="fx-corners pointer-events-none absolute inset-9 text-white/45" />

      <div className="relative flex h-full flex-col justify-between px-16 py-16 portrait:px-12">
        <div className="flex items-start justify-between gap-6">
          <BrandLogo variant="full" white height="8.5rem" />
          <div onClick={(e) => e.stopPropagation()}>
            <LanguageSwitch locale={locale} onChange={onLocale} large tone="dark" />
          </div>
        </div>

        <div className="flex flex-col gap-10">
          <div className="max-w-5xl">
            <h1 className="fx-display text-[clamp(4rem,6.4vw,7.5rem)] text-white portrait:text-[clamp(4.5rem,11vw,8rem)]">{f.heroTitle}</h1>
            <p className="fx-copy mt-7 text-[2rem] leading-snug text-white/92 portrait:text-[2.4rem]">{f.heroText}</p>
            {campaign && <p className="fx-note mt-6 !text-[1.35rem] !text-white/80">{campaign}</p>}
            <div className="mt-10 flex flex-wrap items-center gap-8">
              <button type="button" autoFocus className="fx-btn fx-btn-light !min-h-[5.5rem] !gap-4 !px-12 text-[1.75rem]" onClick={(e) => { e.stopPropagation(); onStart(); }}>
                {f.heroCta} <ArrowRight size={32} aria-hidden />
              </button>
              <span className="inline-flex items-center gap-3 text-[1.35rem] text-white/80">
                <Hand size={26} aria-hidden className="animate-pulse motion-reduce:animate-none" /> {f.touchToStart}
              </span>
            </div>
          </div>

          <div key={index} className="flex items-end justify-between gap-10 border-t border-white/30 pt-6 animate-in fade-in duration-700">
            <div>
              <p className="fx-note !text-[1.1rem] !text-white/70">{f.designIn3d}</p>
              <p className="fx-title mt-1 text-[2rem] text-white">{productName(locale, slide.kind)}</p>
              <p className="mt-1 text-[1.25rem] text-white/80">{productPitch(locale, slide.kind)}</p>
            </div>
            <div className="flex items-center gap-8">
              <div className="flex gap-2" aria-hidden>
                {ATTRACT_SLIDES.map((s, i) => <span key={s.src} className={`h-[3px] w-10 ${i === index ? "bg-white" : "bg-white/30"}`} />)}
              </div>
              <button type="button" className="fx-btn !min-h-16 !border-white/70 !bg-transparent !px-8 text-[1.35rem] hover:!bg-white hover:!text-primary" onClick={(e) => { e.stopPropagation(); onPick(slide.kind); }}>
                {f.designThis} <ArrowRight size={24} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
