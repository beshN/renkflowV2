import Link from "next/link";
import { ArrowRight, CheckCircle2, FileSearch, Gauge, Layers3, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const capabilities = [
  {
    icon: FileSearch,
    title: "PDF'den sipariş verisine",
    text: "Dijital veya taranmış sipariş PDF'lerini alan bazlı güven skorlarıyla yapılandırılmış veriye dönüştürür.",
  },
  {
    icon: CheckCircle2,
    title: "İnsan onaylı doğruluk",
    text: "AI hiçbir siparişi kendiliğinden onaylamaz. Ofis ekibi kontrol eder, düzeltir ve üretime aktarır.",
  },
  {
    icon: Layers3,
    title: "Üretim tek ekranda",
    text: "Hazırlıktan teslimata kadar her aşama, zaman çizelgesi ve sorumlu ekip görünür kalır.",
  },
];

export default function LandingPage() {
  return (
    <main className="landing">
      <nav className="landing-nav shell">
        <Link className="brand" href="/" aria-label="RenkFlow ana sayfa">
          <BrandLogo priority />
        </Link>
        <div className="nav-actions">
          <span className="status-pill"><span /> Sistem yenileniyor</span>
          <Link className="button button-ghost" href="/giris">Giriş yap</Link>
        </div>
      </nav>

      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><ShieldCheck size={16} /> Üretim ekipleri için güvenli operasyon platformu</div>
          <h1>Sipariş PDF&apos;inden<br /><em>üretime</em> tek akış.</h1>
          <p>
            RenkFlow yeniden inşa ediliyor. Yeni sürüm yalnızca önemli olana odaklanıyor:
            siparişi doğru okumak, insanla doğrulamak ve üretimi hatasız ilerletmek.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/kayit">
              Erken erişim <ArrowRight size={18} />
            </Link>
            <a className="button button-secondary" href="#nasil-calisir">Nasıl çalışır?</a>
          </div>
          <div className="trust-row">
            <span><CheckCircle2 size={16} /> Şirket bazlı veri ayrımı</span>
            <span><CheckCircle2 size={16} /> İnsan onayı zorunlu</span>
            <span><CheckCircle2 size={16} /> Değişmez işlem kaydı</span>
          </div>
        </div>

        <div className="hero-panel" aria-label="RenkFlow ürün önizlemesi">
          <div className="panel-top">
            <div><span className="panel-kicker">Sipariş analizi</span><strong>RF-2026-0148</strong></div>
            <span className="analysis-state"><i /> İnceleniyor</span>
          </div>
          <div className="analysis-grid">
            <div className="pdf-preview">
              <div className="pdf-sheet">
                <span>SİPARİŞ FORMU</span>
                <b>Proje: Kuzey Cephe</b>
                <div className="pdf-lines" />
                <div className="dimension-box">2400 × 1800 mm</div>
                <div className="pdf-lines short" />
              </div>
              <span className="page-chip">Sayfa 1 / 3</span>
            </div>
            <div className="fields">
              <Field label="Proje" value="Kuzey Cephe" score="98%" />
              <Field label="Ölçü" value="2400 × 1800 mm" score="96%" />
              <Field label="Işık rengi" value="3000K Günışığı" score="91%" />
              <Field label="Motor tipi" value="Somfy Maestria" score="74%" review />
              <div className="review-note">Düşük güvenli alan ofis onayı bekliyor.</div>
            </div>
          </div>
          <div className="panel-footer">
            <span><Gauge size={17} /> 12 alan bulundu</span>
            <button type="button">Kontrolü tamamla</button>
          </div>
        </div>
      </section>

      <section className="capabilities shell" id="nasil-calisir">
        <div className="section-heading">
          <span>Yeni RenkFlow</span>
          <h2>Daha küçük kapsam.<br />Daha güçlü bir ürün.</h2>
        </div>
        <div className="capability-grid">
          {capabilities.map(({ icon: Icon, title, text }, index) => (
            <article key={title}>
              <div className="capability-number">0{index + 1}</div>
              <Icon size={24} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="landing-footer shell">
        <Link className="brand" href="/" aria-label="RenkFlow ana sayfa"><BrandLogo /></Link>
        <p>Yeni nesil sipariş ve üretim operasyonu.</p>
        <span>© 2026 RenkFlow</span>
      </footer>
    </main>
  );
}

function Field({ label, value, score, review = false }: { label: string; value: string; score: string; review?: boolean }) {
  return (
    <div className={`extracted-field ${review ? "needs-review" : ""}`}>
      <div><span>{label}</span><small>{score}</small></div>
      <strong>{value}</strong>
    </div>
  );
}
