"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, Smartphone } from "lucide-react";
import { designLink } from "@/lib/features/fair/client";
import { fairText, type Locale } from "@/lib/features/fair/i18n";

/** True on a computer (a mouse or trackpad and no touch screen), whatever the window's width: nobody types a form on a big screen. */
export function useComputer() {
  const [computer, setComputer] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setComputer(query.matches && navigator.maxTouchPoints === 0);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return computer;
}

/** The quote step on a computer: only a QR code that opens this design at the form on the phone. */
export function QuoteHandoff({ locale, token, onBack, onContinue }: { locale: Locale; token: string; onBack: () => void; onContinue: () => void }) {
  const f = fairText(locale);
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    const url = `${designLink(token)}?step=quote`;
    void QRCode.toString(url, { type: "svg", margin: 1, width: 360, errorCorrectionLevel: "M" }).then((s) => alive && setSvg(s)).catch(() => alive && onContinue());
    return () => {
      alive = false;
    };
  }, [token, onContinue]);
  return (
    <section aria-labelledby="handoff-title" className="mx-auto max-w-3xl space-y-8 py-6">
      <button type="button" aria-label={f.back} className="fx-btn fx-btn-quiet !min-h-12 w-12 !px-0" onClick={onBack}>
        <ArrowLeft size={20} aria-hidden />
      </button>
      <div className="grid items-center gap-8 sm:grid-cols-[auto_1fr] sm:gap-12">
        <div className="fx-sheet mx-auto h-72 w-72 shrink-0 bg-white p-4 sm:h-80 sm:w-80 [&>svg]:h-full [&>svg]:w-full" role="img" aria-label="QR" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="space-y-4">
          <h1 id="handoff-title" className="fx-display flex items-center gap-3 text-3xl sm:text-4xl">
            <Smartphone size={30} aria-hidden className="shrink-0" /> {f.handoffTitle}
          </h1>
          <p className="fx-copy text-lg text-muted-foreground">{f.handoffHint}</p>
          <button type="button" className="fx-note underline-offset-4 hover:underline" onClick={onContinue}>{f.handoffOr}</button>
        </div>
      </div>
    </section>
  );
}
