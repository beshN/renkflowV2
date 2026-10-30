"use client";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { fairText, type Locale } from "@/lib/features/fair/i18n";
import { ATTRACT_SLIDES } from "@/lib/features/fair/media";
import { BrandLogo } from "./BrandLogo";
import { LanguageSwitch } from "./LanguageSwitch";

/**
 * First screen of web and phone mode: the fair's promise over a real installation, with the logo's
 * own crop marks framing the sheet, and the three steps as a ruled strip. The product list comes
 * after the visitor decides to start.
 */
export function Landing({ locale, onLocale, campaign, onStart }: { locale: Locale; onLocale: (l: Locale) => void; campaign: string | null; onStart: () => void }) {
  const f = fairText(locale);
  return (
    <div className="fx-dark relative isolate flex min-h-dvh flex-col overflow-hidden bg-[hsl(var(--fx-deep))] text-white">
      <Image src={ATTRACT_SLIDES[1].src} alt="" fill priority unoptimized sizes="100vw" className="-z-20 object-cover object-[62%_50%]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[hsl(241_62%_11%/0.94)] via-[hsl(241_62%_11%/0.7)] to-[hsl(241_62%_11%/0.15)] max-sm:from-[hsl(241_62%_11%/0.8)] max-sm:via-[hsl(241_62%_11%/0.75)]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-[hsl(241_62%_9%/0.85)] via-transparent to-transparent" />
      <div aria-hidden className="fx-corners pointer-events-none absolute inset-5 text-white/50 sm:inset-8" />

      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-7 pt-9 sm:px-12 sm:pt-12">
        <BrandLogo variant="full" white height="clamp(64px, 8vw, 104px)" />
        <LanguageSwitch locale={locale} onChange={onLocale} tone="dark" />
      </header>

      <main className="relative mx-auto flex w-full max-w-7xl flex-1 items-center px-7 py-10 sm:px-12">
        <div className="max-w-4xl">
          <h1 className="fx-display text-[clamp(2.6rem,7.4vw,6rem)] text-white">{f.heroTitle}</h1>
          <p className="fx-copy mt-6 text-lg leading-relaxed text-white/90 sm:text-2xl sm:leading-snug">{f.heroText}</p>
          {campaign && <p className="fx-note mt-5 !text-white/75">{campaign}</p>}
          <button type="button" className="fx-btn fx-btn-light mt-9 !min-h-14 !px-8 text-lg sm:!min-h-16 sm:text-xl" onClick={onStart}>
            {f.heroCta} <ArrowRight size={22} aria-hidden />
          </button>
        </div>
      </main>

      <ol className="relative mx-auto mb-9 grid w-full max-w-7xl gap-0 px-7 sm:mb-12 sm:grid-cols-3 sm:px-12">
        {f.heroSteps.map((step, i) => (
          <li key={step} className="flex items-center gap-4 border-t border-white/30 py-4 sm:pr-8">
            <span className="fx-figure flex h-7 w-7 flex-none items-center justify-center rounded-[3px] border border-white/70 text-sm font-semibold">{i + 1}</span>
            <span className="text-base leading-snug text-white/95 sm:text-lg">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
