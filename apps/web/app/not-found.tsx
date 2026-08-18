import Link from "next/link";

export default function NotFound() {
  return <main className="setup-page"><section className="setup-card"><span className="step-label">404</span><h1>Sayfa bulunamadı.</h1><p>Aradığınız kayıt silinmiş veya bu şirketin erişim alanında olmayabilir.</p><Link className="button button-primary" href="/panel">Genel bakışa dön</Link></section></main>;
}
