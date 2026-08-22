import { ShieldCheck, UserMinus, Users } from "lucide-react";
import { inviteMember, removeMember, revokeInvite, updateMemberRole } from "@/app/actions/core";
import { PageHeader } from "@/components/page-header";
import { ActionForm } from "@/components/action-form";
import { requireOrganization } from "@/lib/auth";
import { redirect } from "next/navigation";

const roleNames: Record<string, string> = { owner: "Kurucu", admin: "Yönetici", office: "Ofis", production: "Üretim" };

export default async function TeamPage() {
  const { supabase, membership, user } = await requireOrganization();
  if (membership.role !== "owner" && membership.role !== "admin") redirect("/panel");
  const orgId = membership.organization_id;
  const [{ data: members, error: membersError }, { data: invites, error: invitesError }] = await Promise.all([
    supabase.from("organization_members").select("user_id, role, joined_at, profiles(full_name)").eq("organization_id", orgId).order("joined_at"),
    supabase.from("organization_invites").select("id, email, role, expires_at, accepted_at, revoked_at").eq("organization_id", orgId).order("created_at", { ascending: false }),
  ]);
  if (membersError || invitesError) throw new Error("Ekip bilgileri yüklenemedi.");

  return (
    <>
      <PageHeader eyebrow="Yetki yönetimi" title="Ekip" description="Çalışanları davet edin, rollerini yönetin ve açık davetleri güvenle iptal edin." />
      <div className="team-layout">
        <section className="content-card">
          <div className="card-heading"><div><span>Aktif kullanıcılar</span><h2>Ekip üyeleri</h2></div><Users size={20} /></div>
          <div className="member-list">{(members ?? []).map((member) => {
            const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
            const isSelf = member.user_id === user.id;
            const canManage = member.role !== "owner" && !isSelf && (membership.role === "owner" || member.role !== "admin");
            return <article key={member.user_id}>
              <span>{(profile?.full_name || "?").slice(0,1).toUpperCase()}</span>
              <div><b>{profile?.full_name || "İsimsiz kullanıcı"}</b><small>{roleNames[member.role]}{isSelf ? " · Siz" : ""}</small></div>
              {canManage ? <div className="member-actions">
                <ActionForm action={updateMemberRole} className="inline-status-form" submitLabel="Rolü kaydet" pendingLabel="Kaydediliyor…">
                  <input type="hidden" name="organizationId" value={orgId} />
                  <input type="hidden" name="userId" value={member.user_id} />
                  <select name="role" defaultValue={member.role} aria-label={`${profile?.full_name || "Üye"} rolü`}>
                    {membership.role === "owner" ? <option value="admin">Yönetici</option> : null}
                    <option value="office">Ofis</option>
                    <option value="production">Üretim</option>
                  </select>
                </ActionForm>
                <ActionForm action={removeMember} className="inline-danger-form" submitLabel="Ekipten çıkar" pendingLabel="Çıkarılıyor…">
                  <input type="hidden" name="organizationId" value={orgId} />
                  <input type="hidden" name="userId" value={member.user_id} />
                </ActionForm>
              </div> : <i className="member-protected"><ShieldCheck size={14} /> Korumalı üyelik</i>}
            </article>;
          })}</div>
        </section>
        <section className="form-card">
          <div className="card-heading"><div><span>Yeni kullanıcı</span><h2>Çalışan daveti</h2></div></div>
          <ActionForm action={inviteMember} className="record-form" submitLabel="7 günlük davet gönder" pendingLabel="Davet gönderiliyor…">
            <input type="hidden" name="organizationId" value={orgId} />
            <label>E-posta<input name="email" type="email" required /></label>
            <label>Rol<select name="role" defaultValue="office"><option value="admin">Yönetici</option><option value="office">Ofis</option><option value="production">Üretim</option></select></label>
          </ActionForm>
          {!!invites?.length && <div className="pending-invites"><b>Son davetler</b>{invites.slice(0,8).map((invite) => {
            const active = !invite.accepted_at && !invite.revoked_at && new Date(invite.expires_at) > new Date();
            return <span key={invite.id}><span>{invite.email}<small>{invite.accepted_at ? "Kabul edildi" : invite.revoked_at ? "İptal" : active ? "Bekliyor" : "Süresi doldu"}</small></span>{active ? <ActionForm action={revokeInvite} className="invite-revoke-form" submitLabel="İptal et" pendingLabel="İptal…"><input type="hidden" name="organizationId" value={orgId} /><input type="hidden" name="inviteId" value={invite.id} /></ActionForm> : null}</span>;
          })}</div>}
        </section>
      </div>
      <div className="module-note"><UserMinus size={20} /><div><b>Kurucu ve kendi üyeliğiniz korunur</b><p>Yöneticiler yalnızca ofis ve üretim rollerini yönetebilir; yönetici atama ve yönetici çıkarma yetkisi kurucudadır.</p></div></div>
    </>
  );
}
