import { describe, expect, it } from "vitest";
import { deriveProductionProgress } from "@/lib/production/progression";

const stages = [
  { id: "cut", name: "Kesim", position: 2 },
  { id: "prepare", name: "Hazırlık", position: 1 },
  { id: "delivery", name: "Teslim", position: 3 },
];

describe("production progression", () => {
  it("starts from the first stage by position", () => {
    const progress = deriveProductionProgress(stages, []);

    expect(progress.action).toEqual({
      stageId: "prepare",
      eventType: "started",
      label: "Hazırlık aşamasını başlat",
    });
  });

  it("requires an open stage to be completed before advancing", () => {
    const progress = deriveProductionProgress(stages, [
      { stage_id: "prepare", event_type: "started", created_at: "2026-08-18T10:00:00Z" },
    ]);

    expect(progress.activeStageId).toBe("prepare");
    expect(progress.action?.eventType).toBe("completed");
    expect(progress.action?.stageId).toBe("prepare");
  });

  it("offers the next stage after completion", () => {
    const progress = deriveProductionProgress(stages, [
      { stage_id: "prepare", event_type: "started", created_at: "2026-08-18T10:00:00Z" },
      { stage_id: "prepare", event_type: "completed", created_at: "2026-08-18T10:05:00Z" },
    ]);

    expect(progress.completedStageIds).toContain("prepare");
    expect(progress.action).toMatchObject({ stageId: "cut", eventType: "started" });
  });

  it("ignores notes when finding the current action", () => {
    const progress = deriveProductionProgress(stages, [
      { stage_id: "prepare", event_type: "started", created_at: "2026-08-18T10:00:00Z" },
      { stage_id: "prepare", event_type: "note", created_at: "2026-08-18T10:10:00Z" },
    ]);

    expect(progress.action).toMatchObject({ stageId: "prepare", eventType: "completed" });
  });

  it("finishes after the final stage is completed", () => {
    const progress = deriveProductionProgress(stages, [
      { stage_id: "delivery", event_type: "completed", created_at: "2026-08-18T12:00:00Z" },
      { stage_id: "cut", event_type: "completed", created_at: "2026-08-18T11:00:00Z" },
      { stage_id: "prepare", event_type: "completed", created_at: "2026-08-18T10:00:00Z" },
    ]);

    expect(progress.action).toBeNull();
    expect(progress.message).toBe("Üretim süreci tamamlandı.");
  });
});
