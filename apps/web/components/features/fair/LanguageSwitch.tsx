"use client";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/features/fair/i18n";

export function LanguageSwitch({ locale, onChange, large = false }: { locale: Locale; onChange: (l: Locale) => void; large?: boolean }) {
  return (
    <div role="group" aria-label="Language" className="flex gap-1">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={locale === l}
          title={LOCALE_NAMES[l]}
          className={`rounded-lg border text-xs font-semibold uppercase transition-colors ${large ? "min-h-12 min-w-14 px-3 text-sm" : "min-h-9 min-w-9 px-2 sm:min-h-10 sm:min-w-11 sm:px-3"} ${locale === l ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"}`}
          onClick={() => onChange(l)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
