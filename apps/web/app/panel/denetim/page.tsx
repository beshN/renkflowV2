import { Activity, Search, ShieldCheck, UserRoundCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/lib/auth";

const actionLabels: Record<string, string> = {
  "organization.created": "Şirket oluşturuldu",
  "organization.updated": "Şirket bilgileri güncellendi",
  "order.created": "Sipariş oluşturuldu",
  "order.updated": "Sipariş güncellendi",
  "order.cancelled": "Sipariş iptal edildi",
  "analysis.reviewed": "AI analizi doğrulandı",
  "rule_set.activated": "Hesap kuralı etkinleştirildi",
  "production.stage_event": "Üretim aşaması değişti",
  "inventory.movement_recorded": "Stok hareketi işlendi",
  "member.role_updated": "Üye rolü güncellendi",
  "member.removed": "Üye ekipten çıkarıldı",
  "invite.accepted": "Davet kabul edildi",
  "invite.revoked": "Davet iptal edildi",
  "crm_customers.insert": "Müşteri oluşturuldu",
  "crm_customers.update": "Müşteri güncellendi",
  "suppliers.insert": "Tedarikçi oluşturuldu",
  "suppliers.update": "Tedarikçi güncellendi",
  "inventory_items.insert": "Stok kartı oluşturuldu",
  "inventory_items.update": "Stok kartı güncellendi",
  "financial_records.insert": "Finans kaydı oluşturuldu",
  "financial_records.update": "Finans kaydı güncellendi",
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase, membership } = await requireOrganization();
  if (!["owner", "admin"].includes(membership.role)) redirect("/panel");
  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 120).toLocaleLowerCase("tr-TR");
  const { data: logs, error } = await supabase.from("audit_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at, profiles(full_name)")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw new Error("Denetim kayıtları yüklenemedi.", { cause: error });

  const filtered = (logs ?? []).filter((entry) => {
    if (!query) return true;
    const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
    return [entry.action, actionLabels[entry.action], entry.entity_type, entry.entity_id, profile?.full_name]
      .some((value) => value?.toLocaleLowerCase("tr-TR").includes(query));
  });
  const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
  const today = dayFormatter.format(new Date());
  const todayCount = (logs ?? []).filter((entry) => dayFormatter.format(new Date(entry.created_at)) === today).length;
  const accessCount = (logs ?? []).filter((entry) => entry.action.startsWith("member.") || entry.action.startsWith("invite.")).length;

  return (
    <>
      <PageHeader eyebrow="Kurumsal izlenebilirlik" title="Denetim Kayıtları" description="Sipariş, finans, stok ve yetki değişikliklerinin değişmez işlem geçmişi." />
      <section className="metrics-grid audit-metrics">
        <article className="metric-card"><div className="metric-icon tone-green"><Activity size={20} /></div><span>Son 250 işlem</span><strong>{logs?.length ?? 0}</strong><small>Şirket genelinde</small></article>
        <article className="metric-card"><div className="metric-icon tone-blue"><ShieldCheck size={20} /></div><span>Bugünkü işlem</span><strong>{todayCount}</strong><small>İzlenebilir olay</small></article>
        <article className="metric-card"><div className="metric-icon tone-violet"><UserRoundCheck size={20} /></div><span>Yetki olayı</span><strong>{accessCount}</strong><small>Üye ve davet değişikliği</small></article>
      </section>
      <section className="content-card">
        <form className="list-toolbar audit-toolbar" action="/panel/denetim" method="get">
          <label className="order-search"><Search size={17} aria-hidden="true" /><input name="q" defaultValue={q ?? ""} placeholder="İşlem, kullanıcı veya kayıt ara" aria-label="Denetim kayıtlarında ara" /></label>
          <button type="submit" className="small-action">Filtrele</button>
          <span>{filtered.length} kayıt</span>
        </form>
        <div className="audit-list">
          {filtered.map((entry) => {
            const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
            const metadata = entry.metadata && Object.keys(entry.metadata).length ? JSON.stringify(entry.metadata) : null;
            return <article key={entry.id}><i /><div><b>{actionLabels[entry.action] || entry.action}</b><small>{profile?.full_name || "Sistem"} · {entry.entity_type}{entry.entity_id ? ` #${entry.entity_id.slice(0, 12)}` : ""}</small>{metadata ? <code title={metadata}>{metadata}</code> : null}</div><time>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.created_at))}</time></article>;
          })}
          {!filtered.length ? <div className="compact-empty">Aramanızla eşleşen denetim kaydı bulunamadı.</div> : null}
        </div>
      </section>
    </>
  );
}
