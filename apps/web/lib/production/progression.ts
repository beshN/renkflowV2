export type ProductionStageSummary = {
  id: string;
  name: string;
  position: number;
};

export type ProductionEventSummary = {
  stage_id: string;
  event_type: "started" | "completed" | "reopened" | "note" | string;
  created_at: string;
};

export type ProductionProgress = {
  action: {
    stageId: string;
    eventType: "started" | "completed";
    label: string;
  } | null;
  activeStageId: string | null;
  completedStageIds: string[];
  message: string;
};

export function deriveProductionProgress(
  stages: ProductionStageSummary[],
  events: ProductionEventSummary[],
): ProductionProgress {
  const orderedStages = stages.toSorted((left, right) => left.position - right.position);
  const stageById = new Map(orderedStages.map((stage) => [stage.id, stage]));
  const completedStageIds = new Set<string>();

  for (const event of events) {
    if (event.event_type === "completed" && stageById.has(event.stage_id)) {
      completedStageIds.add(event.stage_id);
    }
  }

  const latestEvent = events
    .filter((event) => event.event_type !== "note" && stageById.has(event.stage_id))
    .toSorted((left, right) => right.created_at.localeCompare(left.created_at))[0];

  if (!latestEvent) {
    const firstStage = orderedStages[0];
    return {
      action: firstStage ? {
        stageId: firstStage.id,
        eventType: "started",
        label: `${firstStage.name} aşamasını başlat`,
      } : null,
      activeStageId: null,
      completedStageIds: [...completedStageIds],
      message: firstStage ? `${firstStage.name} başlamayı bekliyor.` : "Etkin üretim aşaması bulunmuyor.",
    };
  }

  const latestStage = stageById.get(latestEvent.stage_id);
  if (!latestStage) {
    return {
      action: null,
      activeStageId: null,
      completedStageIds: [...completedStageIds],
      message: "Üretim zaman çizelgesi kontrol edilmeli.",
    };
  }

  if (latestEvent.event_type === "started" || latestEvent.event_type === "reopened") {
    return {
      action: {
        stageId: latestStage.id,
        eventType: "completed",
        label: `${latestStage.name} aşamasını tamamla`,
      },
      activeStageId: latestStage.id,
      completedStageIds: [...completedStageIds],
      message: `${latestStage.name} devam ediyor.`,
    };
  }

  const nextStage = orderedStages.find((stage) => stage.position > latestStage.position);
  return {
    action: nextStage ? {
      stageId: nextStage.id,
      eventType: "started",
      label: `${nextStage.name} aşamasını başlat`,
    } : null,
    activeStageId: null,
    completedStageIds: [...completedStageIds],
    message: nextStage ? `${nextStage.name} başlamayı bekliyor.` : "Üretim süreci tamamlandı.",
  };
}
