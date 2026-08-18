"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  Factory,
  FileSearch,
  KanbanSquare,
  LockKeyhole,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const previewOrders = [
  { no: "RF-2026-0148", customer: "Kuzey Cephe", status: "Üretimde", tone: "violet" },
  { no: "RF-2026-0147", customer: "Mira Yapı", status: "İnceleme", tone: "amber" },
  { no: "RF-2026-0146", customer: "Nova Mimarlık", status: "Hazır", tone: "blue" },
];

export function ComingSoonPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function submitWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    try {
      const response = await fetch("/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      if (!response.ok) {
        setState("error");
        return;
      }
      setEmail("");
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <main className="legacy-coming-soon">
      <nav className="legacy-nav shell">
        <Link href="/" aria-label="RenkFlow ana sayfa"><BrandLogo priority /></Link>
        <div><span><i /> Private beta geliştirme sürecinde</span><Link href="/giris">Sisteme giriş</Link></div>
      </nav>

      <section className="legacy-hero shell">
        <div className="legacy-hero-copy">
          <span className="legacy-badge"><Sparkles size={15} /> RenkFlow yeniden güçleniyor</span>
          <h1>Üretim operasyonunuz,<br /><em>tek akışta.</em></h1>
          <p>Eski RenkFlow’un kapsamlı paneli geri dönüyor. Siparişler, iş emirleri, Kanban, üretim, envanter ihtiyaçları, raporlar ve ekip yönetimi; PDF analizi ve güvenli Supabase altyapısıyla birlikte geliştiriliyor.</p>
          <ul><li><CheckCircle2 size={17} /> Eski özellikler korunuyor ve geliştiriliyor</li><li><CheckCircle2 size={17} /> AI okur, insan doğrular, kod hesaplar</li><li><CheckCircle2 size={17} /> Her şirketin verisi tamamen ayrılır</li></ul>
          <form className="waitlist-form" onSubmit={submitWaitlist}>
            <label><Mail size={17} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="İş e-posta adresiniz" aria-label="İş e-posta adresiniz" /></label>
            <button type="submit" disabled={state === "loading"}>{state === "loading" ? "Kaydediliyor…" : "Erken erişim talep et"}<ArrowRight size={17} /></button>
          </form>
          {state === "success" ? <p className="waitlist-message success">Talebiniz alındı. Açılış öncesinde size haber vereceğiz.</p> : null}
          {state === "error" ? <p className="waitlist-message error">Talep kaydedilemedi. Lütfen kısa süre sonra yeniden deneyin.</p> : null}
        </div>

        <div className="legacy-dashboard-preview" aria-label="RenkFlow panel önizlemesi">
          <aside><BrandLogo compact /><nav><span className="active"><BarChart3 size={14} /> Genel Bakış</span><span><Boxes size={14} /> Siparişler</span><span><KanbanSquare size={14} /> Kanban</span><span><Factory size={14} /> Üretim</span></nav></aside>
          <div className="preview-main">
            <header><label><Search size={13} /> Sipariş ara…</label><Bell size={15} /></header>
            <section>
              <div className="preview-title"><div><small>OPERASYON MERKEZİ</small><b>Günaydın, RenkFlow</b></div><button>+ Yeni sipariş</button></div>
              <div className="preview-metrics"><article><small>Toplam sipariş</small><b>148</b><em>+12 bu ay</em></article><article><small>Üretimde</small><b>24</b><em>8 aşama bugün</em></article><article><small>Verimlilik</small><b>%94</b><em>Canlı akış</em></article></div>
              <div className="preview-chart"><header><b>Haftalık üretim</b><span>Son 7 gün</span></header><div>{[38, 58, 45, 73, 64, 91, 78].map((height, index) => <i key={index}><em style={{ height: `${height}%` }} /></i>)}</div></div>
              <div className="preview-orders"><header><b>Son siparişler</b><span>Tümünü gör</span></header>{previewOrders.map((order) => <article key={order.no}><div><b>{order.no}</b><small>{order.customer}</small></div><span className={`tone-${order.tone}`}>{order.status}</span></article>)}</div>
            </section>
          </div>
        </div>
      </section>

      <section className="legacy-feature-section shell">
        <header><span>YENİ NESİL RENKFLOW</span><h2>Eski kapsam, daha sağlam bir temel.</h2><p>Görünen özellikleri kaldırmadan; veri güvenliği, PDF otomasyonu ve üretim doğruluğunu güçlendiriyoruz.</p></header>
        <div>
          <Feature icon={FileSearch} title="Akıllı PDF analizi" text="Ölçü, profil, motor, ışık rengi ve sipariş bilgilerini alan bazlı güven skoruyla çıkarır." />
          <Feature icon={KanbanSquare} title="Sipariş ve Kanban" text="Siparişleri tablo, iş emri, Kanban ve üretim akışı üzerinden takip eder." />
          <Feature icon={Boxes} title="Üretim ve ihtiyaç" text="Doğrulanmış satırlardan üretim aşamalarını ve malzeme ihtiyacını görünür kılar." />
          <Feature icon={ShieldCheck} title="Güvenli ekip çalışması" text="Rol tabanlı yetkiler, şirket bazlı veri ayrımı ve değişmez denetim kaydı sunar." />
        </div>
      </section>

      <section className="legacy-security shell"><div><LockKeyhole size={24} /><span>İnsan onaylı yapay zekâ</span><h2>AI hiçbir siparişi kendi başına üretime göndermez.</h2></div><p>RenkFlow PDF’yi okur ve alanları önerir. Ofis çalışanı doğruladıktan sonra deterministik hesap motoru devreye girer. Böylece hız kazanırken üretim kuralları sizin kontrolünüzde kalır.</p></section>

      <footer className="legacy-footer shell"><BrandLogo /><span>© 2026 RenkFlow · Üretim operasyon platformu</span><div><a href="mailto:info@renkflow.com">info@renkflow.com</a><Link href="/giris">Giriş</Link></div></footer>
    </main>
  );
}

function Feature({ icon: Icon, title, text }: { icon: typeof FileSearch; title: string; text: string }) {
  return <article><span><Icon size={21} /></span><h3>{title}</h3><p>{text}</p></article>;
}
