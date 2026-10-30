"use client";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/features/fair/i18n";

/** Three languages as one ruled segment. `tone="dark"` is for photos and the idle screen. */
export function LanguageSwitch({ locale, onChange, large = false, tone = "light" }: { locale: Locale; onChange: (l: Locale) => void; large?: boolean; tone?: "light" | "dark" }) {
  const frame = tone === "dark" ? "border-white/45 divide-white/25" : "border-input divide-border bg-card";
  return (
    <div role="group" aria-label="Language" className={`inline-flex divide-x overflow-hidden rounded-md border ${frame}`}>
      {LOCALES.map((l) => {
        const on = locale === l;
        const color = tone === "dark" ? (on ? "bg-white text-primary" : "text-white hover:bg-white/15") : on ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted";
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={on}
            title={LOCALE_NAMES[l]}
            className={`font-semibold uppercase tracking-wide transition-colors ${large ? "min-h-12 min-w-[3.6rem] px-3 text-sm" : "min-h-10 min-w-11 px-2.5 text-xs"} ${color}`}
            onClick={() => onChange(l)}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
