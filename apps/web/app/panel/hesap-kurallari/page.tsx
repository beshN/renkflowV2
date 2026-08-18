import { Calculator, LockKeyhole } from "lucide-react";
import { createRuleSet } from "@/app/actions/core";
import { ActivateRuleAction } from "@/components/stage-action";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/lib/auth";

const sampleAst = "{\n  \"version\": 1,\n  \"rules\": [\n    {\n      \"key\": \"ornekSonuc\",\n      \"label\": \"Örnek sonuç\",\n      \"expression\": {\n        \"type\": \"round\",\n        \"mode\": \"up\",\n        \"digits\": 0,\n        \"value\": {\n          \"type\": \"binary\",\n          \"op\": \"divide\",\n          \"left\": {\n            \"type\": \"input\",\n            \"path\": \"widthMm\"\n          },\n          \"right\": {\n            \"type\": \"literal\",\n            \"value\": 100\n          }\n        }\n      }\n    }\n  ]\n}";

export default async function RulesPage() {
  const { supabase, membership } = await requireOrganization();
  const orgId = membership.organization_id;
  const { data: ruleSets } = await supabase.from("calculation_rule_sets").select("*")
    .eq("organization_id", orgId).order("created_at", { ascending: false });

  return (
    <>
      <PageHeader eyebrow="Deterministik hesap" title="Hesap Kuralları" description="AI yalnızca veriyi okur. Delik, LED ve kesim hesabı sürümlü kurallarla yapılır." />
      <div className="rules-intro"><LockKeyhole size={22} /><div><b>Başlangıçta etkin üretim formülü yok</b><p>Gerçek formüller verilene kadar motor hazır kalır fakat üretim sonucu üretmez. Kurallar `eval` kullanmayan JSON AST biçimindedir.</p></div></div>
      <div className="rules-layout">
        <section className="content-card">
          <div className="card-heading"><div><span>Sürümler</span><h2>Kural setleri</h2></div><Calculator size={20} /></div>
          <div className="rule-list">
            {(ruleSets ?? []).map((rule) => <article key={rule.id}><div><b>{rule.name}</b><span>v{rule.version} · {rule.status}</span></div>{rule.status === "draft" && <ActivateRuleAction organizationId={orgId} ruleSetId={rule.id} />}</article>)}
            {!ruleSets?.length && <div className="compact-empty"><p>Henüz kural seti yok.</p></div>}
          </div>
        </section>
        <section className="form-card">
          <div className="card-heading"><div><span>Yeni sürüm</span><h2>Kural taslağı</h2></div></div>
          <form action={createRuleSet} className="record-form">
            <input type="hidden" name="organizationId" value={orgId} />
            <label>Set adı<input name="name" placeholder="Örn. Standart Zip Perde" required /></label>
            <label>JSON AST<textarea name="rulesAst" defaultValue={sampleAst} rows={18} required /></label>
            <button className="button button-primary">Taslağı kaydet</button>
          </form>
        </section>
      </div>
    </>
  );
}
