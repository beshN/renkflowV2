"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Keyboard, ScanLine, X } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
export default function BarcodeScanner({
  onScan,
  busy = false,
}: {
  onScan: (code: string) => void;
  busy?: boolean;
}) {
  const [code, setCode] = useState(""),
    [camera, setCamera] = useState(false),
    [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<IScannerControls | null>(null),
    onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  useEffect(() => {
    if (!camera) return;
    let cancelled = false,
      completed = false,
      stream: MediaStream | null = null;
    const stop = () => {
      controls.current?.stop();
      controls.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
    const visibility = () => {
      if (document.hidden) {
        stop();
        setCamera(false);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    void (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          throw Error(
            "Kamera için HTTPS bağlantısı gerekli. El terminali veya kod girişini kullanın.",
          );
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stop();
          return;
        }
        const reader = new BrowserMultiFormatReader();
        const result = await reader.decodeFromStream(
          stream,
          video.current!,
          (r, _e, c) => {
            if (r && !completed && !cancelled) {
              completed = true;
              c.stop();
              stop();
              setCamera(false);
              navigator.vibrate?.(70);
              onScanRef.current(r.getText());
            }
          },
        );
        if (cancelled || completed) result.stop();
        else controls.current = result;
      } catch (e) {
        stop();
        if (!cancelled) {
          const name = (e as Error).name;
          setError(
            name === "NotAllowedError"
              ? "Kamera izni verilmedi. Tarayıcı ayarlarından izin verin veya el terminalini kullanın."
              : name === "NotFoundError"
                ? "Kamera bulunamadı. El terminali veya kod girişini kullanın."
                : (e as Error).message || "Kamera açılamadı",
          );
          setCamera(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [camera]);
  return (
    <section className="rf-scanner-panel" aria-label="QR ve barkod okuyucu">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <span className="rf-eyebrow">SAHA TERMİNALİ</span>
          <h2 className="mt-2 text-xl font-semibold">Okut. Doğrula. İşle.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            QR, Code 128 veya malzeme kodu
          </p>
        </div>
        <ScanLine size={28} className="text-primary" />
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim() && !busy) {
            onScan(code);
            setCode("");
          }
        }}
      >
        <div className="relative min-w-0 flex-1 basis-48">
          <Keyboard
            size={18}
            className="absolute left-3 top-3.5 text-muted-foreground"
          />
          <input
            aria-label="Etiket veya barkod kodu"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="El terminaliyle okutun veya yazın"
            className="rf-input h-12 w-full pl-10"
            disabled={busy}
          />
        </div>
        <button
          className="rf-primary-button h-12"
          disabled={busy || !code.trim()}
        >
          {busy ? "Okunuyor…" : "Kaydı bul"}
        </button>
        <button
          type="button"
          className="rf-secondary-button h-12"
          disabled={busy}
          onClick={() => {
            setError("");
            setCamera(!camera);
          }}
        >
          <Camera size={18} />
          {camera ? "Kamerayı kapat" : "Kamerayla okut"}
        </button>
      </form>
      {error && (
        <p
          role="alert"
          className="mt-3 text-sm text-rose-600 dark:text-rose-400"
        >
          {error}
        </p>
      )}
      {camera && (
        <div className="relative mt-4 overflow-hidden rounded-xl bg-slate-950">
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            className="aspect-video w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-32 w-3/4 rounded-xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,.2)]" />
          </div>
          <button
            type="button"
            aria-label="Kamerayı kapat"
            className="absolute right-3 top-3 rounded-lg bg-black/60 p-3 text-white"
            onClick={() => setCamera(false)}
          >
            <X size={20} />
          </button>
          <p className="absolute bottom-3 left-0 w-full text-center text-xs text-white">
            Etiketi çerçevenin içine alın
          </p>
        </div>
      )}
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        USB/Bluetooth okuyucuda Enter sonlandırıcısını etkinleştirin. Okutma
        stok miktarını değiştirmez.
      </p>
    </section>
  );
}
