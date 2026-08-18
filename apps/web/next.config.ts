import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      bodySizeLimit: "26mb",
    },
  },
  async redirects() {
    return [
      ["/dashboard", "/panel"],
      ["/orders", "/panel/siparisler"],
      ["/new-order", "/panel/siparisler/yeni"],
      ["/work-orders", "/panel/is-emirleri"],
      ["/kanban", "/panel/kanban"],
      ["/calendar", "/panel/takvim"],
      ["/inventory", "/panel/envanter"],
      ["/finance", "/panel/finans"],
      ["/accounting", "/panel/finans"],
      ["/crm", "/panel/crm"],
      ["/suppliers", "/panel/tedarikciler"],
      ["/reports", "/panel/raporlar"],
      ["/analytics", "/panel/analitik"],
      ["/team", "/panel/ekip"],
      ["/members", "/panel/ekip"],
      ["/settings", "/panel/ayarlar"],
      ["/search", "/panel/arama"],
      ["/notifications", "/panel/bildirimler"],
    ].map(([source, destination]) => ({ source, destination, permanent: false }));
  },
  async headers() {
    const scriptPolicy = process.env.NODE_ENV === "development"
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";
    const contentSecurityPolicy = [
      "default-src 'self'",
      scriptPolicy,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-src 'self' https://*.supabase.co blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default withWorkflow(nextConfig);
