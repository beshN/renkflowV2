"use client";
import { LayoutList } from "lucide-react";
import { fairText, type Locale } from "@/lib/features/fair/i18n";
import { BrandLogo } from "./BrandLogo";
import { LanguageSwitch } from "./LanguageSwitch";
import { StepBar } from "./StepBar";

/** The top of every phone and web screen: the logo, where you are in the quote, language and your list. */
export function FairHeader({
  locale,
  onLocale,
  fairName,
  step,
  listCount,
  onList,
}: {
  locale: Locale;
  onLocale: (l: Locale) => void;
  fairName: string | null;
  step: 0 | 1 | 2 | 3 | null;
  listCount: number;
  onList: (() => void) | null;
}) {
  const f = fairText(locale);
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <BrandLogo height={34} />
          {fairName && <span className="fx-note hidden border-l border-border pl-4 lg:inline">{fairName}</span>}
        </div>
        {step !== null && (
          <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1 sm:justify-self-center sm:[&>ol]:justify-center">
            <StepBar locale={locale} step={step} />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {onList && listCount > 0 && (
            <button type="button" aria-label={`${f.myList} (${listCount})`} className="fx-btn fx-btn-quiet !min-h-10 !gap-2 !px-3 text-sm" onClick={onList}>
              <LayoutList size={16} aria-hidden />
              <span className="hidden sm:inline">{f.myList}</span>
              <span className="fx-figure rounded-[3px] bg-primary px-1.5 text-xs font-semibold text-primary-foreground">{listCount}</span>
            </button>
          )}
          <LanguageSwitch locale={locale} onChange={onLocale} />
        </div>
      </div>
    </header>
  );
}
