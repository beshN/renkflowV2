import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "../work-orders/security";

/** Apply the same worker assignment denial to every technical order reader. */
export function requireTechnicalAssignment(
  actor: WorkOrderActor,
  jobs: ReadonlyArray<{ assigned_to: string | null }>,
) {
  if (
    actor.role === "worker" &&
    !jobs.some((job) => job.assigned_to === actor.userId)
  )
    throw new WorkOrderApiError("Sipariş bulunamadı", 404);
}
