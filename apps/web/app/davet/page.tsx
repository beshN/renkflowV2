import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteAcceptForm } from "@/components/invite-accept-form";

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

  return (
    <main className="setup-page">
      <section className="setup-card">
        <span className="step-label">Ekip daveti</span>
        <h1>Çalışma alanına katılın.</h1>
        <p>Davet, oturum açtığınız <b>{user.email}</b> adresi için doğrulanacak.</p>
        <InviteAcceptForm token={token} />
      </section>
    </main>
  );
}
