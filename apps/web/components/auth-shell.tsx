import Link from "next/link";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/"><span className="brand-mark">R</span><span>RenkFlow</span></Link>
      <section className="auth-card">
        <span className="auth-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
        <div className="auth-footer">{footer}</div>
      </section>
      <aside className="auth-aside">
        <span>Yeni odak</span>
        <blockquote>“Sipariş PDF&apos;inden üretime; her kritik karar insan kontrolünde.”</blockquote>
        <div className="auth-flow"><i>01</i><b>PDF analizi</b><i>02</i><b>Ofis onayı</b><i>03</i><b>Üretim akışı</b></div>
      </aside>
    </main>
  );
}
