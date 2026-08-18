import { Database, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/lib/auth";
import { updateProductionStages } from "@/app/actions/core";

export default async function SettingsPage() {
  const { supabase, membership } = await requireOrganization();
  const { data: organization } = await supabase.from("organizations").select("*").eq("id", membership.organization_id).single();
  const { data: stages } = await supabase.from("production_stages").select("*").eq("organization_id", membership.organization_id).order("position");

  return (
    <>
      <PageHeader eyebrow="Çalışma alanı" title="Ayarlar" description="Şirket ve analiz sınırlarının güncel görünümü." />
      <div className="settings-grid">
        <section className="content-card settings-card"><ShieldCheck size={22} /><span>Şirket</span><h2>{organization?.name}</h2><dl><div><dt>Rolünüz</dt><dd>{membership.role}</dd></div><div><dt>Organizasyon kimliği</dt><dd><code>{membership.organization_id}</code></dd></div></dl></section>
        <section className="content-card settings-card"><Database size={22} /><span>AI kullanım sınırı</span><h2>{organization?.analysis_limit_30d ?? 25} analiz / 30 gün</h2><dl><div><dt>Eşzamanlı analiz</dt><dd>{organization?.concurrent_analysis_limit ?? 2}</dd></div><div><dt>PDF sınırı</dt><dd>25 MB · 50 sayfa</dd></div></dl></section>
      </div>
      <section className="form-card stages-settings">
        <div className="card-heading"><div><span>Şirkete özel akış</span><h2>Üretim aşamaları</h2></div></div>
        <form action={updateProductionStages} className="record-form">
          <input type="hidden" name="organizationId" value={membership.organization_id} />
          <div className="stage-edit-list">{(stages ?? []).map((stage) => <label key={stage.id}><input type="hidden" name="stageId" value={stage.id} /><span>{stage.position}</span><input name="stageName" defaultValue={stage.name} required /><input name="stageColor" type="color" defaultValue={stage.color} /></label>)}</div>
          <button className="button button-primary">Aşamaları kaydet</button>
        </form>
      </section>
    </>
  );
}
