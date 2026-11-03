import { redirect } from "next/navigation";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { pilotReadinessReport } from "@/lib/features/manufacturing/pilot-readiness.service";

export const dynamic = "force-dynamic";

export default async function PilotReadinessPage() {
  let report: Awaited<ReturnType<typeof pilotReadinessReport>> | undefined;
  try {
    const actor = await requireWorkOrderActor();
    report = await pilotReadinessReport(actor);
  } catch (error) {
    if (error instanceof WorkOrderApiError && error.status === 401)
      redirect("/auth/login");
    if (error instanceof WorkOrderApiError && error.status === 403)
      redirect("/dashboard");
    // Database errors may contain credentials or another tenant's server details.
  }

  return (
    <div className="rf-page space-y-4">
      <header className="space-y-2">
        <h1 className="rf-page-title">Makaslı tente pilot hazırlık raporu</h1>
        <p className="text-sm text-muted-foreground">
          Salt okunur · Yalnız mevcut firmanın kayıtları
        </p>
      </header>
      <section className="rf-panel space-y-3 p-4">
        <h2 className="rf-section-title">Kontrol sonucu</h2>
        <p className="text-sm text-muted-foreground">
          Engel olmaması pilota hazır olunduğu anlamına gelmez. Fiziksel pilot
          ve insan doğrulaması gerekir. AI çıktısı insan onayı gerektirir.
        </p>
        {!report ? (
          <p role="alert">
            Rapor okunamadı. Veri doğrulanamadığı için sonuç gösterilemiyor.
          </p>
        ) : (
          <>
            {report.empty && (
              <p>
                Bu firmada makaslı tente aile eşlemesi bulunamadı. Pilot
                hazırlığı değerlendirilemiyor; eksikler aşağıda listelenir.
              </p>
            )}
            {report.findings.length === 0 ? (
              <p>
                Gösterilecek bulgu yok. Bu sonuç pilot uygunluk onayı değildir.
              </p>
            ) : (
              <ul className="space-y-3">
                {report.findings.map((finding, index) => (
                  <li
                    key={`${finding.code}-${index}`}
                    className="rounded border border-border p-3 text-sm"
                  >
                    <p className="font-medium">
                      {
                        { blocker: "Engel", warning: "Uyarı", info: "Bilgi" }[
                          finding.severity
                        ]
                      }{" "}
                      · {finding.message}
                    </p>
                    <p className="mt-1 text-muted-foreground">{finding.hint}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
