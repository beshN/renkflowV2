"use client";
import { useEffect, useState } from "react";

export type PublicLocale = "tr" | "en";

/** Public pages deliberately bypass the global language detector and storage. */
export function usePublicLocale(titles: { tr: string; en: string }, initialLang?: string | string[]) {
  const [locale, setLocale] = useState<PublicLocale>(initialLang === "en" ? "en" : "tr");
  const title = titles[locale];
  useEffect(() => {
    const selectLanguage = () => {
      const requested = new URLSearchParams(window.location.search).get("lang");
      setLocale(requested === "en" || requested === "tr" ? requested : navigator.language?.toLowerCase().startsWith("en") ? "en" : "tr");
    };
    selectLanguage();
    window.addEventListener("popstate", selectLanguage);
    return () => window.removeEventListener("popstate", selectLanguage);
  }, []);
  useEffect(() => {
    const previous = document.documentElement.lang;
    const previousTitle = document.title;
    document.documentElement.lang = locale;
    document.title = `${title} | RenkFlow`;
    return () => { document.documentElement.lang = previous; document.title = previousTitle; };
  }, [locale, title]);
  const changeLanguage = (language: "tr" | "en") => {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", language);
    window.history.pushState(null, "", url);
    setLocale(language);
  };
  return { locale, changeLanguage };
}
