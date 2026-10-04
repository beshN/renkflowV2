import { z } from "zod";
import { QualityResultsSchema } from "./quality";
export const OperationCommandSchema = z.object({
  operationId: z.string().uuid(),
  version: z.number().int().positive(),
  action: z.enum(["start", "pause", "complete", "note", "rework"]),
  qualityResults: QualityResultsSchema,
  quantity: z.number().int().positive().optional(),
  reason: z.string().trim().max(2000).optional(),
  rootCause:z.string().trim().max(2000).optional(),inspectionId:z.string().uuid().optional(),
  reasonCode: z
    .enum(["measurement", "material", "assembly", "quality", "other"])
    .optional(),
  targetOperationId: z.string().uuid().optional(),
  photos: z.array(z.string().max(500)).max(6).default([]),
  additionalMaterials: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        quantity: z.number().positive(),
        scrapQty: z.number().nonnegative().default(0),
        cutLengthMm: z.number().positive().max(100000).optional(),
      }),
    )
    .max(30)
    .default([]),
});
export const OperationStateSchema = z.object({
  status: z.enum([
    "waiting",
    "ready",
    "running",
    "paused",
    "blocked",
    "done",
    "cancelled",
  ]),
  plannedQty: z.number().positive(),
  completedQty: z.number().nonnegative(),
  activeSeconds: z.number().nonnegative(),
  activeSince: z.string().nullable(),
});
export function transitionOperation(
  state: z.infer<typeof OperationStateSchema>,
  command: z.infer<typeof OperationCommandSchema>,
  now: Date,
) {
  const status = state.status,
    seconds =
      state.activeSeconds +
      (state.activeSince
        ? Math.max(
            0,
            (now.getTime() - new Date(state.activeSince).getTime()) / 1000,
          )
        : 0);
  const result = {
    ...state,
    activeSeconds: seconds,
    activeSince: null as string | null,
  };
  if (command.action === "start") {
    if (!["ready", "paused", "blocked"].includes(status))
      throw new Error("İş başlatılamaz");
    result.status = "running";
    result.activeSince = now.toISOString();
  } else if (command.action === "pause") {
    if (status !== "running")
      throw new Error("Yalnız çalışan iş duraklatılabilir");
    result.status = "paused";
  } else if (command.action === "complete") {
    if (status !== "running") throw new Error("Tamamlamadan önce işi başlatın");
    if (
      !command.quantity ||
      state.completedQty + command.quantity > state.plannedQty
    )
      throw new Error("Tamamlanan miktar iş miktarını aşamaz");
    result.completedQty += command.quantity;
    result.status =
      result.completedQty === state.plannedQty ? "done" : "paused";
  } else if (command.action === "note") {
    if (!command.reason && !command.photos.length)
      throw new Error("Not veya fotoğraf gerekli");
    result.activeSince = state.activeSince;
    result.activeSeconds = state.activeSeconds;
  } else if (command.action === "rework") {
    if (
      !command.reason ||
      !command.reasonCode ||
      !command.targetOperationId ||
      !command.quantity
    )
      throw new Error("Rework için gerekçe, hedef aşama ve miktar gerekli");
  }
  return result;
}
export const CenterSchema = z
  .object({
    code: z.string().trim().min(2).max(60),
    name: z.string().min(2).max(180),
    parallelCapacity: z.number().int().min(1).max(100),
    revision:z.number().int().positive().optional(),
    machineRequired:z.boolean().default(false),teamRequired:z.boolean().default(false),
    shiftStart: z.string().regex(/^\d{2}:\d{2}$/),
    shiftEnd: z.string().regex(/^\d{2}:\d{2}$/),
    workDays: z.array(z.number().int().min(0).max(6)).min(1),
    maintenance: z
      .array(
        z.object({ start: z.string().datetime(), end: z.string().datetime() }),
      )
      .max(100)
      .default([]),
  })
  .superRefine((v, c) => {
    if (v.shiftEnd <= v.shiftStart || v.shiftEnd > "23:59" || v.shiftStart > "23:59" || Number(v.shiftStart.split(":")[1])>59 || Number(v.shiftEnd.split(":")[1])>59)
      c.addIssue({
        code: "custom",
        message: "Vardiya saatlerini kontrol edin",
      });
    for (const b of v.maintenance)
      if (b.end <= b.start)
        c.addIssue({ code: "custom", message: "Bakım aralığı geçersiz" });
  });

export const ResourceSchema=CenterSchema.safeExtend({kind:z.enum(["machine","team","employee"]),userId:z.string().uuid().optional(),memberIds:z.array(z.string().uuid()).max(100).refine(ids=>new Set(ids).size===ids.length,"Ekip çalışanları benzersiz olmalı").default([]),workCenterCodes:z.array(z.string().min(2).max(60)).max(100).default([])}).superRefine((d,c)=>{if((d.kind==="employee")!==Boolean(d.userId) || (d.kind==="employee" && d.parallelCapacity!==1))c.addIssue({code:"custom",message:"Çalışan kaynağı tek kullanıcı ve tek kapasite gerektirir"});if(d.kind==="machine" && !d.workCenterCodes.length)c.addIssue({code:"custom",message:"Makinenin iş merkezlerini seçin"});if(d.kind==="team" && d.memberIds.length<d.parallelCapacity)c.addIssue({code:"custom",message:"Ekip kapasitesine yetecek çalışan seçin"});});
