"use client";
import type { PublicLocale } from "@/lib/i18n/public-locale";
import { cn } from "@/lib/utils";

export function PublicLanguageSwitch({ locale, onChange, label }: {
  locale: PublicLocale;
  onChange: (language: PublicLocale) => void;
  label: string;
}) {
  return <div className="flex gap-2 text-xs" role="group" aria-label={label}>
    {(["tr", "en"] as const).map((language) => <button key={language} type="button" lang={language} className={cn(locale === language ? "rf-primary-button" : "rf-secondary-button", "h-8 !px-2 !py-1 !text-xs")} aria-pressed={locale === language} onClick={() => onChange(language)}>{language.toUpperCase()}</button>)}
  </div>;
}
