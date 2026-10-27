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
          className={`rounded-md border px-3 text-xs font-semibold uppercase ${large ? "min-h-12 min-w-14 text-sm" : "min-h-10 min-w-11"} ${locale === l ? "border-foreground bg-foreground text-background" : "border-border bg-card"}`}
          onClick={() => onChange(l)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
