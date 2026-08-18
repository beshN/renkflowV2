import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/giris");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/davet?token=${token}`)}`);

  const { data, error } = await supabase.rpc("accept_organization_invite", { raw_token: token });
  if (error || !data) {
    return (
      <main className="setup-page">
        <section className="setup-card">
          <span className="step-label">Davet</span>
          <h1>Bağlantı geçersiz.</h1>
          <p>Davet süresi dolmuş, iptal edilmiş veya farklı bir e-posta adresine ait olabilir.</p>
        </section>
      </main>
    );
  }

  redirect("/panel");
}
