"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone } from "lucide-react";
import { designLink } from "@/lib/features/fair/client";
import { fairText, type Locale } from "@/lib/features/fair/i18n";

/** On a computer the quote form can be filled in on the phone instead: a QR code opens this design there at the form. */
export function QuoteHandoff({ locale, token }: { locale: Locale; token: string }) {
  const f = fairText(locale);
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    const url = `${designLink(token)}?step=quote`;
    void QRCode.toString(url, { type: "svg", margin: 1, width: 192, errorCorrectionLevel: "M" }).then((s) => alive && setSvg(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);
  if (!svg) return null;
  return (
    <aside className="fx-sheet hidden items-center gap-5 p-4 [@media(min-width:900px)_and_(hover:hover)_and_(pointer:fine)]:flex" aria-label={f.handoffTitle}>
      <div className="h-36 w-36 shrink-0 bg-white p-1 [&>svg]:h-full [&>svg]:w-full" role="img" aria-label="QR" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="min-w-0 space-y-2">
        <p className="fx-display flex items-center gap-2 text-xl"><Smartphone size={20} aria-hidden /> {f.handoffTitle}</p>
        <p className="text-sm text-muted-foreground">{f.handoffHint}</p>
        <p className="fx-note">{f.handoffOr}</p>
      </div>
    </aside>
  );
}
