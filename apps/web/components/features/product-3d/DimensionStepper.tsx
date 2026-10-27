"use client";
import { Minus, Plus } from "lucide-react";

/** A dimension without a keyboard (kiosk touch screens): large − / + buttons and a slider. */
export function DimensionStepper({ label, value, min, max, step = 50, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / 10) * 10));
  return (
    <div className="space-y-2" role="group" aria-label={label}>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <output className="font-semibold tabular-nums">{value} mm</output>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`${label} −${step} mm`} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-card" onClick={() => onChange(clamp(value - step))}>
          <Minus size={18} />
        </button>
        <input type="range" aria-label={label} className="h-12 min-w-0 flex-1" min={min} max={max} step={10} value={value} onChange={(e) => onChange(clamp(+e.target.value))} />
        <button type="button" aria-label={`${label} +${step} mm`} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-card" onClick={() => onChange(clamp(value + step))}>
          <Plus size={18} />
        </button>
      </div>
      <p className="flex justify-between text-[11px] text-muted-foreground tabular-nums"><span>{min}</span><span>{max}</span></p>
    </div>
  );
}
