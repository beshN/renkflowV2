"use client";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import FocusLock from "react-focus-lock";
/** Reuse the authenticated viewer and escape animated workspace containing blocks. */
const PDFViewer = dynamic(() => import("./PDFViewerV2"), {
  ssr: false,
  loading: () => (
    <p
      role="status"
      className="fixed inset-0 z-[100] grid place-items-center bg-background text-sm text-muted-foreground"
    >
      PDF görüntüleyici hazırlanıyor…
    </p>
  ),
});
export default function LazyPDFViewer(props: {
  fileUrl: string;
  fileName: string;
  initialPage?: number;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <FocusLock returnFocus>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={props.fileName}
        onKeyDown={(event) => {
          if (event.key === "Escape") props.onClose();
        }}
      >
        <PDFViewer {...props} />
      </div>
    </FocusLock>,
    document.body,
  );
}
