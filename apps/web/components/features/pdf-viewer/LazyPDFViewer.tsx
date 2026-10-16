"use client";
import dynamic from "next/dynamic";
/** Reuse the authenticated PDF.js viewer instead of browser-dependent PDF iframes. */
const LazyPDFViewer = dynamic(() => import("./PDFViewerV2"), {
  ssr: false,
  loading: () => (
    <p role="status" className="p-6 text-sm text-muted-foreground">
      PDF görüntüleyici hazırlanıyor…
    </p>
  ),
});
export default LazyPDFViewer;
