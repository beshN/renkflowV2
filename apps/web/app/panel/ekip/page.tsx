import { Users } from "lucide-react";
import { inviteMember } from "@/app/actions/core";
import { PageHeader } from "@/components/page-header";
import { ActionForm } from "@/components/action-form";
import { requireOrganization } from "@/lib/auth";
import { redirect } from "next/navigation";

const roleNames: Record<string, string> = { owner: "Kurucu", admin: "Yönetici", office: "Ofis", production: "Üretim" };

export default async function TeamPage() {
  const { supabase, membership } = await requireOrganization();
  if (membership.role !== "owner" && membership.role !== "admin") redirect("/panel");
  const orgId = membership.organization_id;
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("organization_members").select("user_id, role, joined_at, profiles(full_name)").eq("organization_id", orgId).order("joined_at"),
    supabase.from("organization_invites").select("id, email, role, expires_at, accepted_at, revoked_at").eq("organization_id", orgId).order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <PageHeader eyebrow="Yetki yönetimi" title="Ekip" description="Çalışanları davet edin ve şirket rollerini görün." />
      <div className="team-layout">
        <section className="content-card">
          <div className="card-heading"><div><span>Aktif kullanıcılar</span><h2>Ekip üyeleri</h2></div><Users size={20} /></div>
          <div className="member-list">{(members ?? []).map((member) => {
            const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
            return <article key={member.user_id}><span>{(profile?.full_name || "?").slice(0,1).toUpperCase()}</span><div><b>{profile?.full_name || "İsimsiz kullanıcı"}</b><small>{roleNames[member.role]}</small></div></article>;
          })}</div>
        </section>
        <section className="form-card">
          <div className="card-heading"><div><span>Yeni kullanıcı</span><h2>Çalışan daveti</h2></div></div>
          <ActionForm action={inviteMember} className="record-form" submitLabel="7 günlük davet gönder" pendingLabel="Davet gönderiliyor…">
            <input type="hidden" name="organizationId" value={orgId} />
            <label>E-posta<input name="email" type="email" required /></label>
            <label>Rol<select name="role" defaultValue="office"><option value="admin">Yönetici</option><option value="office">Ofis</option><option value="production">Üretim</option></select></label>
          </ActionForm>
          {!!invites?.length && <div className="pending-invites"><b>Son davetler</b>{invites.slice(0,5).map((invite) => <span key={invite.id}>{invite.email}<small>{invite.accepted_at ? "Kabul edildi" : invite.revoked_at ? "İptal" : new Date(invite.expires_at) <= new Date() ? "Süresi doldu" : "Bekliyor"}</small></span>)}</div>}
        </section>
      </div>
    </>
  );
}
