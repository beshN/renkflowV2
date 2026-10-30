"use client";
import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

/**
 * A dimension without a number field: the value as the control's headline, − / + buttons and a slider.
 * With `editable` the value can also be typed (phones and computers); the kiosk has no keyboard, so it
 * keeps buttons and slider only.
 */
export function DimensionStepper({
  label,
  value,
  min,
  max,
  step = 50,
  editable = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  editable?: boolean;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / 10) * 10));
  const [typed, setTyped] = useState(String(value));
  useEffect(() => setTyped(String(value)), [value]);
  const commit = () => {
    const n = Number(typed.replace(/\s/g, ""));
    if (Number.isFinite(n) && typed.trim() !== "") onChange(clamp(n));
    else setTyped(String(value));
  };
  return (
    <div className="fx-stepper space-y-2" role="group" aria-label={label}>
      <div className="fx-stepper-head flex items-baseline justify-between gap-3 text-sm">
        <span id={`dim-${label}`}>{label}</span>
        {editable ? (
          <span className="fx-stepper-value inline-flex items-baseline">
            <input
              className="rf-input fx-stepper-input"
              inputMode="numeric"
              aria-labelledby={`dim-${label}`}
              value={typed}
              onChange={(e) => setTyped(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
              onBlur={commit}
              onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur(), undefined)}
            />
            <small>mm</small>
          </span>
        ) : (
          <output className="fx-stepper-value font-semibold tabular-nums">
            {value}
            <small> mm</small>
          </output>
        )}
      </div>
      <div className="fx-stepper-bar flex items-center gap-2">
        <button type="button" aria-label={`${label} −${step} mm`} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-card" onClick={() => onChange(clamp(value - step))}>
          <Minus size={18} />
        </button>
        <input type="range" aria-label={label} className="h-12 min-w-0 flex-1" min={min} max={max} step={10} value={value} onChange={(e) => onChange(clamp(+e.target.value))} />
        <button type="button" aria-label={`${label} +${step} mm`} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-card" onClick={() => onChange(clamp(value + step))}>
          <Plus size={18} />
        </button>
      </div>
      <p className="fx-stepper-range flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{min}</span>
        <span>{max}</span>
      </p>
    </div>
  );
}
