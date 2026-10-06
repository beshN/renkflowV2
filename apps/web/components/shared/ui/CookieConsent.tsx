"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { useTranslation } from "@/lib/i18n/client";

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
    "/scrap", "/finance", "/accounting", "/settings", "/team", "/members",
    "/reports", "/analytics", "/crm", "/shipments", "/work-orders", "/kanban",
    "/notifications", "/search", "/auth/",
  ].some((prefix) => pathname.startsWith(prefix));
  const [showBanner, setShowBanner] = useState(false);
  const { locale } = useTranslation();
  const isRtl = locale === "ar";

  const labels = {
    tr: {
      title: "Çerez Kullanımı",
      short: "Deneyimi iyileştirmek için çerez kullanıyoruz.",
      description:
        "Web sitemizde deneyiminizi iyileştirmek için çerezler kullanıyoruz. Gerekli çerezler sitenin çalışması için zorunludur. Analitik ve pazarlama çerezleri ise size daha iyi hizmet vermemize yardımcı olur. Daha fazla bilgi için",
      policy: "Gizlilik Politikamızı",
      necessary: "Sadece Gerekli",
      acceptAll: "Tümünü Kabul Et",
    },
    en: {
      title: "Cookie Usage",
      short: "We use cookies to improve your experience.",
      description:
        "We use cookies to improve your experience. Essential cookies are required for the site to work. Analytics and marketing cookies help us serve you better. For more details, see our",
      policy: "Privacy Policy",
      necessary: "Necessary Only",
      acceptAll: "Accept All",
    },
    ar: {
      title: "استخدام ملفات الارتباط",
      short: "نستخدم ملفات الارتباط لتحسين تجربتك.",
      description:
        "نستخدم ملفات الارتباط لتحسين تجربتك. الملفات الضرورية مطلوبة لعمل الموقع. ملفات التحليلات والتسويق تساعدنا على تقديم خدمة أفضل. لمزيد من التفاصيل راجع",
      policy: "سياسة الخصوصية",
      necessary: "الضروري فقط",
      acceptAll: "قبول الكل",
    },
  } as const;
  const text = labels[locale as keyof typeof labels] ?? labels.tr;

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
          className={`fixed bottom-4 z-50 w-[calc(100vw-2rem)] max-w-[380px] print:hidden ${isRtl ? "right-4" : "left-4"}`}
        >
          <div className={`rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-[0_16px_40px_-16px_rgb(17_17_19/0.25)] ${isRtl ? "text-right" : "text-left"}`}>
            <div className="flex items-center gap-2 text-[13.5px] font-medium"><Cookie className="h-4 w-4 text-muted-foreground" />{text.title}</div>
            <p className="mt-2 text-[12.5px] leading-5 text-muted-foreground">
              {text.short}{" "}
              <Link href="/cookies" className="text-foreground underline underline-offset-2">{text.policy}</Link>
            </p>
            <div className={`mt-4 flex gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <button onClick={acceptNecessary} className="rf-secondary-button h-8 flex-1 px-3 text-[12.5px]">{text.necessary}</button>
              <button onClick={acceptAll} className="rf-ink-button h-8 flex-1 px-3 text-[12.5px]">{text.acceptAll}</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
