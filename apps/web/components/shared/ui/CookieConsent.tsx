"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { COOKIE_CONSENT_EVENT } from "@/components/features/analytics/GoogleAnalytics";
import { useWorkspaceShellMounted } from "@/lib/shared/hooks/useWorkspacePresence";

/** App screens with their own layout (sign-in, customer links, kiosk): not the public site. */
const STANDALONE_APP_PREFIXES = ["/auth", "/track", "/teklif", "/teslim", "/q", "/station", "/coming-soon"];

export default function CookieConsent() {
  const pathname = usePathname();
  const workspaceShell = useWorkspaceShellMounted();
  // In-app screens never show the banner: everything under the workspace layout says so itself,
  // and the few signed-in or token screens outside that layout are listed here.
  const operationalPage = workspaceShell || STANDALONE_APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
  const [showBanner, setShowBanner] = useState(false);
  // The banner only appears on the public site, which is Turkish-only, so it
  // must not follow the browser language like the in-app i18n does.
  const text = {
    title: "Çerez kullanımı",
    short: "Oturumunuzu sürdürmek ve deneyimi iyileştirmek için çerez kullanıyoruz.",
    policy: "Çerez politikası",
    necessary: "Sadece gerekli",
    acceptAll: "Tümünü kabul et",
  };

  useEffect(() => {
    setShowBanner(false);
    if (operationalPage) { setShowBanner(false); return; }
    // Check if user has already accepted/rejected cookies
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      // Small delay to avoid hydration issues and improve UX
      const timer = setTimeout(() => setShowBanner(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [operationalPage]);

  const acceptAll = () => {
    localStorage.setItem(
      "cookie-consent",
      JSON.stringify({
        necessary: true,
        analytics: true,
        marketing: true,
        timestamp: new Date().toISOString(),
      }),
    );
    window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
    setShowBanner(false);
  };

  const acceptNecessary = () => {
    localStorage.setItem(
      "cookie-consent",
      JSON.stringify({
        necessary: true,
        analytics: false,
        marketing: false,
        timestamp: new Date().toISOString(),
      }),
    );
    window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
    setShowBanner(false);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          role="dialog"
          aria-label={text.title}
          // Slides in from below the viewport instead of fading, so text never sits at low contrast.
          initial={{ y: 'calc(100% + 1rem)' }}
          animate={{ y: 0 }}
          exit={{ y: 'calc(100% + 1rem)' }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          className="fixed bottom-4 left-4 z-50 w-[calc(100vw-2rem)] max-w-[380px] print:hidden"
        >
          <div className="rf-chrome rounded-[6px] border border-[var(--chrome-line)] p-4 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.55)]">
            <div className="flex items-center gap-2 text-[13.5px] font-medium"><Cookie className="h-4 w-4 text-[var(--chrome-muted)]" />{text.title}</div>
            <p className="mt-2 text-[12.5px] leading-5 text-[var(--chrome-muted)]">
              {text.short}{" "}
              <Link href="/cookies" className="text-[var(--chrome-fg)] underline underline-offset-2">{text.policy}</Link>
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={acceptNecessary} className="rf-chrome-button h-8 flex-1 px-3 text-[12.5px]">{text.necessary}</button>
              <button onClick={acceptAll} className="rf-accent-button h-8 flex-1 px-3 text-[12.5px]">{text.acceptAll}</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
