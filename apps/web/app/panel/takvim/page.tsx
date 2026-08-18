import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganization } from "@/lib/auth";

const weekdays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function monthValue(value?: string) {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ ay?: string }> }) {
  const { ay } = await searchParams;
  const selectedMonth = monthValue(ay);
  const [year, month] = selectedMonth.split("-").map(Number);
  const { supabase, membership } = await requireOrganization();
  const { data: orders, error } = await supabase.from("orders")
    .select("id, order_number, customer_name, project_name, status, planned_delivery_date")
    .eq("organization_id", membership.organization_id)
    .neq("status", "cancelled")
    .order("planned_delivery_date", { ascending: true, nullsFirst: false })
    .limit(1000);
  if (error) throw new Error("Teslim takvimi yüklenemedi.", { cause: error });

  const first = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(1 - startOffset);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date;
  });
  const datedOrders = (orders ?? []).filter((order) => order.planned_delivery_date);
  const unscheduled = (orders ?? []).filter((order) => !order.planned_delivery_date);
  const monthCount = datedOrders.filter((order) => order.planned_delivery_date?.startsWith(selectedMonth)).length;
  const monthTitle = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);

  return (
    <>
      <PageHeader eyebrow="Planlama görünümü" title="Teslim Takvimi" description="Siparişlerin planlanan teslim tarihlerini aylık görünümde izleyin." />
      <section className="calendar-shell content-card">
        <header className="calendar-toolbar">
          <div><b>{monthTitle}</b><span>{monthCount} planlı teslim · {unscheduled.length} tarihsiz sipariş</span></div>
          <nav aria-label="Takvim ayı">
            <Link href={`/panel/takvim?ay=${shiftMonth(selectedMonth, -1)}`} aria-label="Önceki ay"><ChevronLeft size={18} /></Link>
            <Link href="/panel/takvim">Bugün</Link>
            <Link href={`/panel/takvim?ay=${shiftMonth(selectedMonth, 1)}`} aria-label="Sonraki ay"><ChevronRight size={18} /></Link>
          </nav>
        </header>
        <div className="calendar-grid calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid calendar-days">
          {cells.map((date) => {
            const iso = date.toISOString().slice(0, 10);
            const dayOrders = datedOrders.filter((order) => order.planned_delivery_date === iso);
            const outside = date.getUTCMonth() !== month - 1;
            return (
              <div className={outside ? "outside" : ""} key={iso}>
                <time dateTime={iso}>{date.getUTCDate()}</time>
                <div>{dayOrders.map((order) => (
                  <Link href={`/panel/siparisler/${order.id}`} key={order.id} title={`${order.order_number} · ${order.customer_name || "Müşteri bekliyor"}`}>
                    <b>{order.order_number}</b><span>{order.customer_name || order.project_name || "Müşteri bekliyor"}</span><StatusBadge value={order.status} />
                  </Link>
                ))}</div>
              </div>
            );
          })}
        </div>
      </section>
      {unscheduled.length ? <section className="content-card calendar-unscheduled"><div className="card-heading"><div><span>Planlama kuyruğu</span><h2>Teslim tarihi bekleyenler</h2></div><CalendarDays size={20} /></div><div>{unscheduled.slice(0, 12).map((order) => <Link href={`/panel/siparisler/${order.id}`} key={order.id}><b>{order.order_number}</b><span>{order.customer_name || order.project_name || "Müşteri bekliyor"}</span><StatusBadge value={order.status} /></Link>)}</div></section> : null}
    </>
  );
}
