import { createOrganizationAction } from "@/app/actions/auth";
import { getAuthContext } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Şirket kurulumu" };

export default async function SetupPage() {
  const { membership } = await getAuthContext();
  if (membership) redirect("/panel");

  return (
    <main className="setup-page">
      <section className="setup-card">
        <span className="step-label">1 / 1 · Çalışma alanı</span>
        <h1>Şirketinizi oluşturun.</h1>
        <p>Verileriniz bu şirket kimliği altında RLS ile diğer şirketlerden tamamen ayrılacak.</p>
        <form action={createOrganizationAction} className="auth-form">
          <label>Şirket adı<input name="name" placeholder="Örn. Renk Perde" minLength={2} maxLength={120} required /></label>
          <button className="button button-primary">Çalışma alanını oluştur</button>
        </form>
      </section>
    </main>
  );
}
