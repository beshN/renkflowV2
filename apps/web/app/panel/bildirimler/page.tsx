import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2, Clock3, Factory } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/lib/auth";

export default async function NotificationsPage() {
  const { supabase, membership } = await requireOrganization();
  const orgId = membership.organization_id;
  const [{ data: analyses }, { data: orders }] = await Promise.all([
    supabase.from("document_analyses").select("id, order_id, status, error_message, created_at, updated_at").eq("organization_id", orgId).in("status", ["needs_review", "failed", "running", "queued"]).order("updated_at", { ascending: false }).limit(100),
    supabase.from("orders").select("id, order_number, customer_name, status, updated_at").eq("organization_id", orgId).in("status", ["in_production", "ready"]).order("updated_at", { ascending: false }).limit(100),
  ]);
  const orderIds = [...new Set([...(analyses ?? []).map((analysis) => analysis.order_id), ...(orders ?? []).map((order) => order.id)])];
  const { data: orderReferences } = orderIds.length ? await supabase.from("orders").select("id, order_number").eq("organization_id", orgId).in("id", orderIds) : { data: [] as Array<{ id: string; order_number: string }> };
  const orderNumbers = new Map((orderReferences ?? []).map((order) => [order.id, order.order_number]));
  const notices = [
    ...(analyses ?? []).map((analysis) => ({
      id: `analysis-${analysis.id}`,
      href: `/panel/siparisler/${analysis.order_id}`,
      tone: analysis.status === "failed" ? "danger" : analysis.status === "needs_review" ? "warning" : "info",
      icon: analysis.status === "failed" ? AlertTriangle : analysis.status === "needs_review" ? Clock3 : Bell,
      title: analysis.status === "failed" ? "PDF analizi başarısız" : analysis.status === "needs_review" ? "Ofis kontrolü bekleniyor" : "PDF analizi devam ediyor",
      text: `${orderNumbers.get(analysis.order_id) || "Sipariş"}${analysis.error_message ? ` · ${analysis.error_message}` : ""}`,
      date: analysis.updated_at,
    })),
    ...(orders ?? []).map((order) => ({
      id: `order-${order.id}`,
      href: `/panel/siparisler/${order.id}`,
      tone: order.status === "ready" ? "success" : "info",
      icon: order.status === "ready" ? CheckCircle2 : Factory,
      title: order.status === "ready" ? "Sipariş sevkiyata hazır" : "Üretim devam ediyor",
      text: `${order.order_number} · ${order.customer_name || "Müşteri"}`,
      date: order.updated_at,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <PageHeader eyebrow="Canlı uyarılar" title="Bildirim Merkezi" description="İnsan kontrolü, analiz hataları, üretim ve sevkiyat aksiyonları tek yerde." />
      <section className="notification-feed content-card">
        {notices.map((notice) => { const Icon = notice.icon; return <Link className={`notice notice-${notice.tone}`} href={notice.href} key={notice.id}><span><Icon size={19} /></span><div><b>{notice.title}</b><p>{notice.text}</p></div><time>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notice.date))}</time></Link>; })}
        {!notices.length && <div className="empty-state"><Bell size={30} /><b>Bekleyen bildirim yok</b><p>Operasyon akışı şu anda temiz görünüyor.</p></div>}
      </section>
    </>
  );
}
