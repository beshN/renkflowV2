"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { COOKIE_CONSENT_EVENT } from "@/components/features/analytics/GoogleAnalytics";

export default function CookieConsent() {
  const pathname = usePathname();
  const operationalPage = [
    "/warehouse",
    "/factory",
    "/production",
    "/track/",
    "/quotations",
    "/orders",
    "/new-order",
    "/dashboard", "/purchases", "/receipts", "/suppliers", "/inventory",
    "/scrap", "/finance", "/accounting", "/settings", "/team",
    "/reports", "/crm", "/shipments", "/work-orders", "/kanban",
    "/notifications", "/search", "/auth/",
  ].some((prefix) => pathname.startsWith(prefix));
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
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          className="fixed bottom-4 left-4 z-50 w-[calc(100vw-2rem)] max-w-[380px] print:hidden"
        >
          <div className="rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-[0_16px_40px_-16px_rgb(17_17_19/0.25)]">
            <div className="flex items-center gap-2 text-[13.5px] font-medium"><Cookie className="h-4 w-4 text-muted-foreground" />{text.title}</div>
            <p className="mt-2 text-[12.5px] leading-5 text-muted-foreground">
              {text.short}{" "}
              <Link href="/cookies" className="text-foreground underline underline-offset-2">{text.policy}</Link>
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={acceptNecessary} className="rf-secondary-button h-8 flex-1 px-3 text-[12.5px]">{text.necessary}</button>
              <button onClick={acceptAll} className="rf-ink-button h-8 flex-1 px-3 text-[12.5px]">{text.acceptAll}</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
