import { Check } from "lucide-react";
import { fairText, type Locale } from "@/lib/features/fair/i18n";

/** Where the visitor is on the way to a quote: product, design, quote (3: all done). */
export function StepBar({ locale, step }: { locale: Locale; step: 0 | 1 | 2 | 3 }) {
  const labels = fairText(locale).stepLabels;
  return (
    <ol className="mx-auto flex max-w-6xl items-center gap-2 px-4 pb-3 text-xs font-medium sm:text-sm" aria-label={labels.join(" / ")}>
      {labels.map((label, i) => (
        <li key={label} aria-current={i === step ? "step" : undefined} className={`flex items-center gap-2 ${i === step ? "text-primary" : i < step ? "text-foreground" : "text-muted-foreground"}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${i === step ? "border-primary bg-primary text-primary-foreground" : i < step ? "border-primary text-primary" : "border-border"}`}>
            {i < step ? <Check size={12} aria-hidden /> : i + 1}
          </span>
          <span>{label}</span>
          {i < labels.length - 1 && <span aria-hidden className="mx-1 h-px w-6 bg-border sm:w-12" />}
        </li>
      ))}
    </ol>
  );
}
