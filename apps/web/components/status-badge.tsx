const orderLabels: Record<string, string> = {
  draft: "Taslak", awaiting_review: "İnceleme bekliyor", approved: "Onaylandı",
  in_production: "Üretimde", ready: "Hazır", delivered: "Teslim edildi", cancelled: "İptal",
};
const analysisLabels: Record<string, string> = {
  queued: "Sırada", running: "Analiz ediliyor", needs_review: "Ofis onayı bekliyor",
  completed: "Doğrulandı", failed: "Başarısız",
};

export function StatusBadge({ value, kind = "order" }: { value: string; kind?: "order" | "analysis" }) {
  const label = kind === "order" ? orderLabels[value] : analysisLabels[value];
  return <span className={`status-badge status-${value}`}><i />{label ?? value}</span>;
}
