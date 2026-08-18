import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RenkFlow — Siparişten üretime tek akış", template: "%s | RenkFlow" },
  description: "PDF siparişlerini analiz eden, doğrulayan ve üretime aktaran operasyon platformu.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://renkflow.com"),
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
