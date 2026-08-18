"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="setup-page"><section className="setup-card"><span className="step-label">Beklenmeyen hata</span><h1>İşlem tamamlanamadı.</h1><p>Güvenli biçimde yeniden deneyebilirsiniz. Sorun sürerse işlem günlüğünü kontrol edeceğiz.</p><button className="button button-primary" onClick={reset}>Yeniden dene</button></section></main>;
}
