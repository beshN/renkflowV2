"use client";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { fairText, type Locale } from "@/lib/features/fair/i18n";
import { ATTRACT_SLIDES } from "@/lib/features/fair/media";
import { BrandLogo } from "./BrandLogo";
import { LanguageSwitch } from "./LanguageSwitch";

/**
 * First screen of web and phone mode: the fair's promise in a big headline over a real installation,
 * then the three steps. The product list comes after the visitor decides to start.
 */
export function Landing({ locale, onLocale, campaign, onStart }: { locale: Locale; onLocale: (l: Locale) => void; campaign: string | null; onStart: () => void }) {
  const f = fairText(locale);
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#13134d] text-white">
      <Image src={ATTRACT_SLIDES[1].src} alt="" fill priority unoptimized sizes="100vw" className="-z-20 object-cover object-[35%_50%]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-[#13134d]/85 via-[#13134d]/55 to-[#13134d]/95" />

      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
        <BrandLogo variant="full" white height="clamp(64px, 8.5vw, 120px)" />
        <div className="rounded-lg bg-white/95 p-1 text-neutral-900"><LanguageSwitch locale={locale} onChange={onLocale} /></div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-8 px-5 pb-10 pt-4 sm:pb-16">
        <div className="max-w-3xl space-y-5">
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight drop-shadow-lg sm:text-6xl lg:text-7xl">{f.heroTitle}</h1>
          <p className="max-w-2xl text-lg leading-relaxed text-white/90 sm:text-2xl">{f.heroText}</p>
          {campaign && <p className="inline-block rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur">{campaign}</p>}
          <div className="pt-2">
            <button type="button" className="inline-flex min-h-14 items-center gap-3 rounded-full bg-white px-8 text-lg font-semibold text-[#13134d] shadow-2xl transition active:scale-95 motion-reduce:transition-none sm:min-h-16 sm:px-10 sm:text-xl" onClick={onStart}>
              {f.heroCta} <ArrowRight size={22} aria-hidden />
            </button>
          </div>
        </div>

        <ol className="grid gap-3 sm:grid-cols-3">
          {f.heroSteps.map((step, i) => (
            <li key={step} className="flex items-center gap-4 rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white font-display text-lg font-semibold text-[#13134d]">{i + 1}</span>
              <span className="text-base font-medium">{step}</span>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
