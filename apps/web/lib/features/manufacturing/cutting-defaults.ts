/**
 * Cutting values used until a workshop enters and confirms its own. These are the defaults that
 * were already in the schema (014_production_platform.sql: kerf 3 mm, trims 0 mm, shortest usable
 * remnant 500 mm) and the engine (standard bar 6000 mm). They are not measured on any machine, so a
 * plan made with them is labelled as an estimate everywhere it is shown or printed.
 */
export const CUTTING_DEFAULTS = Object.freeze({
  kerfMm: 3,
  trimStartMm: 0,
  trimEndMm: 0,
  minimumRemnantMm: 500,
  standardLengthMm: 6000,
});

/**
 * Where a plan's values came from: confirmed by a manager for this workshop, the built-in defaults,
 * or values someone entered but did not confirm.
 */
export type CuttingParameterSource = "confirmed" | "default" | "unconfirmed";

type PreferencesRow = {
  kerf_mm?: unknown;
  trim_start_mm?: unknown;
  trim_end_mm?: unknown;
  minimum_remnant_mm?: unknown;
  standard_length_mm?: unknown;
  cutting_confirmed?: unknown;
} | null | undefined;

const value = (raw: unknown, fallback: number) => {
  const n = Number(raw);
  return raw === null || raw === undefined || raw === "" || !Number.isFinite(n) ? fallback : n;
};

/** The firm's cutting values, falling back to the defaults, and where they came from. */
export function firmCuttingParameters(prefs: PreferencesRow) {
  const parameters = {
    kerfMm: value(prefs?.kerf_mm, CUTTING_DEFAULTS.kerfMm),
    trimStartMm: value(prefs?.trim_start_mm, CUTTING_DEFAULTS.trimStartMm),
    trimEndMm: value(prefs?.trim_end_mm, CUTTING_DEFAULTS.trimEndMm),
    minimumRemnantMm: value(prefs?.minimum_remnant_mm, CUTTING_DEFAULTS.minimumRemnantMm),
    standardLengthMm: value(prefs?.standard_length_mm, CUTTING_DEFAULTS.standardLengthMm),
  };
  const isDefault = (Object.keys(CUTTING_DEFAULTS) as Array<keyof typeof CUTTING_DEFAULTS>).every(
    (key) => parameters[key] === CUTTING_DEFAULTS[key],
  );
  const source: CuttingParameterSource = prefs?.cutting_confirmed === true ? "confirmed" : isDefault ? "default" : "unconfirmed";
  return { parameters, source };
}

/**
 * The warning a plan, settings screen or printed sheet carries; null when the values are confirmed.
 * Plans made before sources were recorded could only be made with confirmed values, so no source
 * also means confirmed.
 */
export function cuttingEstimateNotice(source: CuttingParameterSource | null | undefined): string | null {
  if (!source || source === "confirmed") return null;
  if (source === "unconfirmed") return "Doğrulanmamış kesim değerleri kullanıldı, atölyenize göre ayarlayın. Bu plan tahminidir.";
  return "Varsayılan değerler kullanıldı, atölyenize göre ayarlayın. Bu plan tahminidir.";
}
