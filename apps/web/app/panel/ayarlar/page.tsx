import { Database, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/lib/auth";
import { updateOrganizationSettings, updateProductionStages } from "@/app/actions/core";
import { ActionForm } from "@/components/action-form";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const { supabase, membership } = await requireOrganization();
  if (membership.role !== "owner" && membership.role !== "admin") redirect("/panel");
  const [organizationResult, stagesResult] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", membership.organization_id).single(),
    supabase.from("production_stages").select("*").eq("organization_id", membership.organization_id).order("position"),
  ]);
  if (organizationResult.error) throw new Error("Şirket bilgileri yüklenemedi.", { cause: organizationResult.error });
  if (stagesResult.error) throw new Error("Üretim aşamaları yüklenemedi.", { cause: stagesResult.error });
  const organization = organizationResult.data;
  const stages = stagesResult.data;

  return (
    <>
      <PageHeader eyebrow="Çalışma alanı" title="Ayarlar" description="Şirket ve analiz sınırlarının güncel görünümü." />
      <div className="settings-grid">
        <section className="content-card settings-card"><ShieldCheck size={22} /><span>Şirket</span><h2>{organization?.name}</h2><dl><div><dt>Rolünüz</dt><dd>{membership.role}</dd></div><div><dt>Organizasyon kimliği</dt><dd><code>{membership.organization_id}</code></dd></div></dl></section>
        <section className="content-card settings-card"><Database size={22} /><span>AI kullanım sınırı</span><h2>{organization?.analysis_limit_30d ?? 25} analiz / 30 gün</h2><dl><div><dt>Eşzamanlı analiz</dt><dd>{organization?.concurrent_analysis_limit ?? 2}</dd></div><div><dt>PDF sınırı</dt><dd>25 MB · 50 sayfa</dd></div></dl></section>
      </div>
      <section className="form-card organization-settings-card">
        <div className="card-heading"><div><span>Kurumsal kimlik</span><h2>Şirket bilgileri</h2></div></div>
        <ActionForm action={updateOrganizationSettings} className="record-form" submitLabel="Şirket bilgilerini kaydet" pendingLabel="Kaydediliyor…">
          <input type="hidden" name="organizationId" value={membership.organization_id} />
          <label>Şirket adı<input name="name" defaultValue={organization?.name ?? ""} minLength={2} maxLength={120} required /></label>
        </ActionForm>
      </section>
      <section className="form-card stages-settings">
        <div className="card-heading"><div><span>Şirkete özel akış</span><h2>Üretim aşamaları</h2></div></div>
        <ActionForm action={updateProductionStages} className="record-form" submitLabel="Aşamaları kaydet" pendingLabel="Aşamalar kaydediliyor…">
          <input type="hidden" name="organizationId" value={membership.organization_id} />
          <div className="stage-edit-list">{(stages ?? []).map((stage) => <label key={stage.id}><input type="hidden" name="stageId" value={stage.id} /><span>{stage.position}</span><input name="stageName" defaultValue={stage.name} required /><input name="stageColor" type="color" defaultValue={stage.color} /></label>)}</div>
        </ActionForm>
      </section>
    </>
  );
}
