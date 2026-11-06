import Link from "next/link";
import { Card } from "@/components/ui/Card";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { stationWeeklyPlan } from "@/lib/features/manufacturing/station-weekly-plan.server";
import {
  FACTORY_TIMEZONE,
  type PlanOperation,
} from "@/lib/features/manufacturing/station-weekly-plan";
import { unitLabel } from "@/lib/features/inventory/vocabulary";

export const dynamic = "force-dynamic";
function Operation({ operation: p }: { operation: PlanOperation }) {
  return (
    <>
      <p className="font-medium">{p.title}</p>
      <p className="break-all text-xs">İş emri: {p.workOrderId}</p>
      <p>
        {p.product || "Ürün: veri yok"} · {p.name}
      </p>
      <p>
        {p.quantity ?? "veri yok"}{" "}
        {p.unit ? unitLabel(p.unit) : "birim: veri yok"}
      </p>
    </>
  );
}
export default async function WeeklyPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const actor = await requireWorkOrderActor();
  const { date } = await searchParams;
  let data: Awaited<ReturnType<typeof stationWeeklyPlan>>;
  try {
    data = await stationWeeklyPlan(actor, Array.isArray(date) ? date[0] : date);
  } catch (error) {
    if (error instanceof WorkOrderApiError && error.status === 403)
      return (
        <p role="alert">Haftalık üretim planını görüntüleme yetkiniz yok.</p>
      );
    if (
      (error instanceof Error &&
        error.message.startsWith("Geçerli bir tarih")) ||
      (error instanceof Error && error.message.startsWith("Plan tarihi"))
    )
      return (
        <p role="alert">
          Geçerli bir tarih seçin (2017 veya sonrası).{" "}
          <Link href="/production/weekly-plan">Bu hafta</Link>
        </p>
      );
    throw error;
  }
  return (
    <div className="space-y-5">
      <Link href="/production" className="rf-secondary-button">
        Üretime dön
      </Link>
      <Card>
        <h1 className="rf-section-title">
          İstasyon bazında haftalık üretim planı
        </h1>
        <p className="my-3 text-sm">
          Salt okunur · {FACTORY_TIMEZONE} · Pazartesi–Pazar
        </p>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label>
            Hafta içinden bir gün
            <input
              type="date"
              name="date"
              min="2017-01-01"
              defaultValue={data.week.days[0]}
              className="rf-input block"
              required
            />
          </label>
          <button className="rf-primary-button" type="submit">
            Haftayı göster
          </button>
          <Link
            className="rf-secondary-button"
            href={`?date=${data.week.previous}`}
          >
            Önceki hafta
          </Link>
          <Link
            className="rf-secondary-button"
            href={`?date=${data.week.next}`}
          >
            Sonraki hafta
          </Link>
        </form>
        <p className="mt-4 text-sm">
          {data.schedule
            ? `${data.schedule.status === "published" ? "Yayınlanan çizelge" : "Taslak öneri"} · ${new Date(data.schedule.createdAt).toLocaleString("tr-TR", { timeZone: FACTORY_TIMEZONE })}`
            : "Çizelge: veri yok"}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Plan süreleri mevcut çizelgedeki tahmini çalışma dilimleridir;
          gerçekleşen süre değildir. Kayıtlı başlangıç ayrı gösterilir. Çizelge
          sonradan değişen kayıtları yansıtmayabilir. Miktar her kartta
          operasyonun tamamına aittir; günler arasında bölünmez veya toplanmaz.
        </p>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-3 text-left">
              {data.week.days[0]} – {data.week.days[6]} · Açık üretim
              operasyonları
            </caption>
            <thead>
              <tr>
                <th scope="col" className="p-2">
                  İstasyon
                </th>
                {data.week.days.map((day) => (
                  <th scope="col" className="p-2" key={day}>
                    {new Date(`${day}T12:00:00+03:00`).toLocaleDateString(
                      "tr-TR",
                      {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        timeZone: FACTORY_TIMEZONE,
                      },
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map(({ center, days }) => (
                <tr key={center.code} className="border-t border-border">
                  <th scope="row" className="p-2 align-top">
                    {center.name}
                    <p className="text-xs font-normal">
                      {center.code}
                      {!center.active && " · pasif / kayıt yok"}
                    </p>
                  </th>
                  {days.map((entries, i) => (
                    <td
                      key={data.week.days[i]}
                      className="min-w-52 p-2 align-top"
                    >
                      <p className="mb-2 text-xs text-muted-foreground">
                        Kayıtlı paralel kapasite:{" "}
                        {center.parallelCapacity == null
                          ? "veri yok"
                          : `${center.parallelCapacity} eşzamanlı operasyon`}
                      </p>
                      {!entries.length && (
                        <p className="text-xs">Bu gün için operasyon yok.</p>
                      )}
                      {entries.map((entry) => (
                        <article
                          key={entry.operation.id}
                          className="mb-2 space-y-1 rounded border border-border p-2 text-xs"
                        >
                          <Operation operation={entry.operation} />
                          <p>
                            Tahmini plan süresi (bu gün):{" "}
                            {entry.plannedMinutes == null
                              ? "veri yok"
                              : `${entry.plannedMinutes.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} dk`}
                          </p>
                          {entry.recordedRunning && (
                            <p>
                              Devam ediyor · Kayıtlı başlangıç:{" "}
                              {new Date(
                                entry.operation.startedAt!,
                              ).toLocaleString("tr-TR", {
                                timeZone: FACTORY_TIMEZONE,
                              })}
                            </p>
                          )}
                        </article>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!data.rows.length && (
            <p className="mt-3">İstasyon / operasyon verisi yok.</p>
          )}
        </div>
      </Card>
      <Card>
        <h2 className="rf-section-title">Planlanmamış</h2>
        <p className="my-2 text-xs">
          Seçili çizelgede geçerli zaman dilimi bulunmayan açık operasyonlar.
          Hafta filtresinden bağımsızdır; devam edenler günlerde de görünebilir.
        </p>
        {!data.unscheduled.length && <p>Planlanmamış operasyon yok.</p>}
        <ul className="space-y-3">
          {data.unscheduled.map((p) => (
            <li key={p.id} className="rounded border border-border p-3 text-sm">
              <Operation operation={p} />
              <p>İstasyon: {p.center} · Çizelgede plan zamanı: veri yok</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
