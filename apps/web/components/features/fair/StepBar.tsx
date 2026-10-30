import { Check } from "lucide-react";
import { fairText, type Locale } from "@/lib/features/fair/i18n";

/** Product, design, quote: a ruled line with a square marker per step (3 = all done). */
export function StepBar({ locale, step }: { locale: Locale; step: 0 | 1 | 2 | 3 }) {
  const labels = fairText(locale).stepLabels;
  return (
    <ol className="flex items-center" aria-label={labels.join(" / ")}>
      {labels.map((label, i) => {
        const done = i < step,
          now = i === step;
        return (
          <li key={label} aria-current={now ? "step" : undefined} className="flex items-center">
            {i > 0 && <span aria-hidden className={`mx-2 h-px w-5 sm:mx-3 sm:w-10 ${done || now ? "bg-primary" : "bg-border"}`} />}
            <span className={`flex h-[1.4rem] w-[1.4rem] items-center justify-center rounded-[3px] fx-figure text-[0.8rem] font-semibold ${done ? "bg-primary text-primary-foreground" : now ? "border-2 border-primary text-primary" : "border border-input text-muted-foreground"}`}>
              {done ? <Check size={13} strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span className={`ml-2 text-sm ${now ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground"} ${now ? "" : "hidden sm:inline"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
