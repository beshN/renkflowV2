"use client";
import { useState } from "react";
import { RecipeQualityEditor } from "./RecipeQualityEditor";
import {
  calculateRecipe,
  RecipeDefinition,
} from "@/lib/features/manufacturing/recipe-engine";
const route = [
  ["Kesim", "CUT"],
  ["Delme", "DRILL"],
  ["Montaj", "ASSEMBLY"],
  ["Kalite kontrol", "QC"],
  ["Paketleme", "PACK"],
];
export function RecipeEditor({
  items,
  initial,
  onSave,
  busy,
}: {
  items: any[];
  initial?: any;
  onSave: (data: any) => Promise<any>;
  busy: boolean;
}) {
  const [form, setForm] = useState<any>(() =>
      initial
        ? {
            ...initial,
            editRevision: initial.editRevision || initial.edit_revision,
            finishedItemId: initial.finishedItemId || initial.finished_item_id,
            geometry: initial.geometry || "roof",
            verificationSource:
              initial.verificationSource || initial.verification_source || "",
          }
        : {
            code: "",
            geometry: "roof",
            verificationSource: "",
            name: "",
            version: 1,
            finishedItemId: "",
            rules: [
              {
                itemId: "",
                kind: "profile",
                uom: "m",
                quantityFormula: "",
                cutLengthFormula: "",
              },
            ],
            operations: route.map(([name, workCenterCode]) => ({
              name,
              workCenterCode,
              minutesFormula: "",
            })),
            limits: {
              minWidthMm: 0,
              maxWidthMm: 0,
              minProjectionMm: 0,
              maxProjectionMm: 0,
              minMountingHeightMm: 0,
              maxMountingHeightMm: 0,
            },
            examples: [
              {
                parameters: {
                  widthMm: 0,
                  projectionMm: 0,
                  mountingHeightMm: 0,
                  quantity: 1,
                  motor: true,
                  led: false,
                },
                expected: [],
              },
              {
                parameters: {
                  widthMm: 0,
                  projectionMm: 0,
                  mountingHeightMm: 0,
                  quantity: 1,
                  motor: true,
                  led: true,
                },
                expected: [],
              },
            ],
          },
    ),
    [error, setError] = useState(""),
    [calculated, setCalculated] = useState<any>(null);
  function patch(key: string, value: any) {
    setForm((p: any) => ({ ...p, [key]: value }));
  }
  function parameter(index: number, updates: Record<string, unknown>) {
    setForm((current: any) => ({
      ...current,
      parameterDefinitions: (
        current.parameterDefinitions ||
        current.parameter_definitions ||
        []
      ).map((p: any, n: number) => (n === index ? { ...p, ...updates } : p)),
    }));
  }
  function rule(index: number, key: string, value: any) {
    patch(
      "rules",
      form.rules.map((r: any, i: number) =>
        i === index ? { ...r, [key]: value } : r,
      ),
    );
  }
  const materialIds = [
    ...new Set<string>(form.rules.map((r: any) => r.itemId).filter(Boolean)),
  ];
  return (
    <form
      className="rf-panel space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await onSave({
            ...form,
            verificationSource: form.verificationSource?.trim() || undefined,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Kaydedilemedi");
        }
      }}
    >
      <div>
        <h2 className="rf-section-title">Reçete ve operasyon kuralları</h2>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          Formüller tek ürün içindir. Sistem sipariş adediyle çarpar. widthMm,
          projectionMm, mountingHeightMm, areaM2, motor, led kullanılabilir.
          ceil, floor, round, min, max, abs, if desteklenir. Operasyon süresinde
          quantity toplam adettir.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["code", "Kod"],
          ["name", "Reçete adı"],
          ["version", "Sürüm"],
        ].map(([key, label]) => (
          <label className="text-xs" key={key}>
            {label}
            <input
              required
              className="rf-input mt-2 w-full"
              type={key === "version" ? "number" : "text"}
              min={1}
              value={form[key]}
              onChange={(e) =>
                patch(key, key === "version" ? +e.target.value : e.target.value)
              }
            />
          </label>
        ))}
        <label className="text-xs">
          Mamul kartı
          <select
            required
            className="rf-input mt-2 w-full"
            value={form.finishedItemId}
            onChange={(e) => patch("finishedItemId", e.target.value)}
          >
            <option value="">Mamul seçin</option>
            {items
              .filter((i) => i.item_type === "finished_good")
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">
          Ölçü modeli
          <select
            className="rf-input mt-2 w-full"
            value={form.geometry}
            onChange={(e) => {
              const vertical = e.target.value === "vertical";
              setForm((p: any) => ({
                ...p,
                geometry: e.target.value,
                limits: {
                  ...p.limits,
                  ...(vertical
                    ? { minProjectionMm: 0, maxProjectionMm: 0 }
                    : {}),
                },
                examples: p.examples.map((x: any) => ({
                  ...x,
                  parameters: {
                    ...x.parameters,
                    ...(vertical ? { projectionMm: 0 } : {}),
                  },
                })),
              }));
            }}
          >
            <option value="roof">Tente / pergola · en ve açılım</option>
            <option value="vertical">Rüzgâr kırıcı · en ve yükseklik</option>
          </select>
        </label>
        <label className="text-xs">
          Doğrulanmış teknik kaynak
          <input
            required={form.geometry === "vertical"}
            className="rf-input mt-2 w-full"
            value={form.verificationSource}
            onChange={(e) => patch("verificationSource", e.target.value)}
            placeholder="Teknik çizim, katalog sürümü ve sayfa"
          />
        </label>
      </div>
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">
          Ürün parametreleri ve opsiyon koşulları
        </legend>
        {(form.parameterDefinitions || form.parameter_definitions || []).map(
          (p: any, index: number) => (
            <div key={index} className="grid gap-2 sm:grid-cols-4">
              {[
                ["key", "Formül parametresi"],
                ["label", "Parametre adı"],
                ["unit", "Birim"],
                ["minimum", "Alt sınır"],
                ["maximum", "Üst sınır"],
              ].map(([key, label]) => (
                <label className="text-xs" key={key}>
                  {label}
                  <input
                    className="rf-input mt-2 w-full"
                    type={
                      ["minimum", "maximum"].includes(key) ? "number" : "text"
                    }
                    step="any"
                    value={p[key] ?? ""}
                    onChange={(e) =>
                      parameter(index, {
                        [key]: ["minimum", "maximum"].includes(key)
                          ? e.target.value
                            ? Number(e.target.value)
                            : undefined
                          : e.target.value,
                      })
                    }
                  />
                </label>
              ))}
              <label className="text-xs">
                Tür
                <select
                  className="rf-input mt-2 w-full"
                  value={p.type}
                  onChange={(e) =>
                    parameter(index, {
                      type: e.target.value,
                      defaultValue: undefined,
                    })
                  }
                >
                  <option value="number">Sayı</option>
                  <option value="boolean">Evet / hayır</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={p.integer || false}
                  onChange={(e) =>
                    parameter(index, { integer: e.target.checked })
                  }
                />
                Tam sayı
              </label>
              <button
                type="button"
                className="text-xs text-destructive"
                onClick={() =>
                  patch(
                    "parameterDefinitions",
                    (
                      form.parameterDefinitions ||
                      form.parameter_definitions ||
                      []
                    ).filter((_: any, n: number) => n !== index),
                  )
                }
              >
                Parametreyi kaldır
              </button>
            </div>
          ),
        )}
        <button
          type="button"
          className="rf-input text-xs"
          onClick={() =>
            patch("parameterDefinitions", [
              ...(form.parameterDefinitions ||
                form.parameter_definitions ||
                []),
              {
                key: "",
                label: "",
                type: "number",
                unit: "",
                required: true,
                integer: false,
              },
            ])
          }
        >
          Parametre ekle
        </button>
        {(form.constraints || []).map((c: any, index: number) => (
          <div className="flex gap-2" key={index}>
            <input
              aria-label={`Opsiyon koşulu ${index + 1}`}
              placeholder="if(led,motor,1)"
              className="rf-input w-full"
              value={c.formula}
              onChange={(e) =>
                patch(
                  "constraints",
                  form.constraints.map((v: any, n: number) =>
                    n === index ? { ...v, formula: e.target.value } : v,
                  ),
                )
              }
            />
            <input
              aria-label={`Koşul açıklaması ${index + 1}`}
              placeholder="LED için motor seçilmelidir"
              className="rf-input w-full"
              value={c.message}
              onChange={(e) =>
                patch(
                  "constraints",
                  form.constraints.map((v: any, n: number) =>
                    n === index ? { ...v, message: e.target.value } : v,
                  ),
                )
              }
            />
            <button
              type="button"
              className="text-xs text-destructive"
              onClick={() =>
                patch(
                  "constraints",
                  form.constraints.filter((_: any, n: number) => n !== index),
                )
              }
            >
              Sil
            </button>
          </div>
        ))}
        <button
          type="button"
          className="rf-input text-xs"
          onClick={() =>
            patch("constraints", [
              ...(form.constraints || []),
              { formula: "", message: "" },
            ])
          }
        >
          Opsiyon koşulu ekle
        </button>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-medium">
          Doğrulanmış üretim sınırları · mm
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["WidthMm", "En"],
            ["ProjectionMm", "Açılım"],
            ["MountingHeightMm", "Montaj yüksekliği"],
          ]
            .filter(
              ([key]) => form.geometry !== "vertical" || key !== "ProjectionMm",
            )
            .map(([key, label]) => (
              <div key={key}>
                <p className="mb-2 text-xs">{label}</p>
                <div className="flex gap-2">
                  {["min", "max"].map((prefix) => (
                    <input
                      key={prefix}
                      aria-label={`${label} ${prefix === "min" ? "en az" : "en çok"}`}
                      type="number"
                      min={1}
                      required
                      className="rf-input w-full"
                      value={form.limits[prefix + key] || ""}
                      placeholder={prefix === "min" ? "En az" : "En çok"}
                      onChange={(e) =>
                        patch("limits", {
                          ...form.limits,
                          [prefix + key]: +e.target.value,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">Malzeme kuralları</legend>
        {form.rules.map((r: any, i: number) => (
          <div
            key={i}
            className="grid gap-2 rounded border border-border p-3 md:grid-cols-[2fr_1fr_2fr_2fr_auto]"
          >
            <select
              aria-label={`Malzeme ${i + 1}`}
              required
              className="rf-input"
              value={r.itemId}
              onChange={(e) => {
                const item = items.find((x) => x.id === e.target.value);
                patch(
                  "rules",
                  form.rules.map((v: any, n: number) =>
                    n === i
                      ? {
                          ...v,
                          itemId: e.target.value,
                          uom: item?.stock_uom || "adet",
                          kind:
                            item?.stock_uom === "m" ? "profile" : "material",
                        }
                      : v,
                  ),
                );
              }}
            >
              <option value="">Malzeme seçin</option>
              {items
                .filter((x) => x.item_type !== "finished_good")
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {x.stock_uom}
                  </option>
                ))}
            </select>
            <span className="self-center text-xs">
              {r.kind === "profile"
                ? "Profil · adet formülü"
                : r.uom + " formülü"}
            </span>
            <input
              required
              aria-label={`Miktar formülü ${i + 1}`}
              className="rf-input"
              placeholder="Miktar formülü"
              value={r.quantityFormula}
              onChange={(e) => rule(i, "quantityFormula", e.target.value)}
            />
            {r.kind === "profile" ? (
              <input
                required
                aria-label={`Kesim boyu ${i + 1}`}
                className="rf-input"
                placeholder="Kesim boyu · mm"
                value={r.cutLengthFormula || ""}
                onChange={(e) => rule(i, "cutLengthFormula", e.target.value)}
              />
            ) : (
              <span />
            )}
            <input
              aria-label={`Malzeme koşulu ${i + 1}`}
              className="rf-input"
              placeholder="Koşul · isteğe bağlı"
              value={r.conditionFormula || ""}
              onChange={(e) =>
                rule(i, "conditionFormula", e.target.value || undefined)
              }
            />
            <button
              type="button"
              className="text-xs text-destructive"
              onClick={() =>
                patch(
                  "rules",
                  form.rules.filter((_: any, n: number) => n !== i),
                )
              }
            >
              Sil
            </button>
          </div>
        ))}
        <button
          type="button"
          className="rf-input text-xs"
          onClick={() =>
            patch("rules", [
              ...form.rules,
              {
                itemId: "",
                kind: "material",
                uom: "adet",
                quantityFormula: "",
              },
            ])
          }
        >
          Malzeme kuralı ekle
        </button>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-3 text-sm font-medium">
          Düzenlenebilir üretim rotası
        </legend>
        {form.operations.map((o: any, i: number) => (
          <div key={i} className="grid gap-2 sm:grid-cols-4">
            <input
              required
              aria-label={`Operasyon ${i + 1}`}
              className="rf-input"
              value={o.name}
              onChange={(e) =>
                patch(
                  "operations",
                  form.operations.map((v: any, n: number) =>
                    n === i ? { ...v, name: e.target.value } : v,
                  ),
                )
              }
            />
            <input
              required
              aria-label={`İş merkezi ${i + 1}`}
              className="rf-input"
              value={o.workCenterCode}
              onChange={(e) =>
                patch(
                  "operations",
                  form.operations.map((v: any, n: number) =>
                    n === i ? { ...v, workCenterCode: e.target.value } : v,
                  ),
                )
              }
            />
            <input
              required
              aria-label={`Süre formülü ${i + 1}`}
              className="rf-input"
              placeholder="Dakika formülü"
              value={o.minutesFormula}
              onChange={(e) =>
                patch(
                  "operations",
                  form.operations.map((v: any, n: number) =>
                    n === i ? { ...v, minutesFormula: e.target.value } : v,
                  ),
                )
              }
            />
            <button
              type="button"
              className="text-xs text-destructive"
              onClick={() =>
                patch(
                  "operations",
                  form.operations.filter((_: any, n: number) => n !== i),
                )
              }
            >
              Operasyonu sil
            </button>
            {[
              ["setupMinutesFormula", "Hazırlık dakika formülü"],
              ["conditionFormula", "Operasyon koşulu"],
            ].map(([key, label]) => (
              <input
                key={key}
                aria-label={`${label} ${i + 1}`}
                className="rf-input"
                placeholder={label + " · isteğe bağlı"}
                value={o[key] || ""}
                onChange={(e) =>
                  patch(
                    "operations",
                    form.operations.map((v: any, n: number) =>
                      n === i
                        ? { ...v, [key]: e.target.value || undefined }
                        : v,
                    ),
                  )
                }
              />
            ))}
            <RecipeQualityEditor
              checks={o.qualityChecks || []}
              onChange={(checks) =>
                patch(
                  "operations",
                  form.operations.map((operation: any, index: number) =>
                    index === i
                      ? { ...operation, qualityChecks: checks }
                      : operation,
                  ),
                )
              }
            />
          </div>
        ))}
        <button
          type="button"
          className="rf-input text-xs"
          onClick={() =>
            patch("operations", [
              ...form.operations,
              { name: "", workCenterCode: "", minutesFormula: "" },
            ])
          }
        >
          Operasyon ekle
        </button>
      </fieldset>
      <fieldset className="space-y-5">
        <legend className="mb-3 text-sm font-medium">
          Yayın öncesi hesap doğrulaması
        </legend>
        <p className="text-xs text-muted-foreground">
          İki farklı gerçek ölçü örneği ve teknik olarak doğrulanmış beklenen
          miktarları girin.
        </p>
        {form.examples.map((ex: any, i: number) => (
          <div key={i} className="rounded border border-border p-4">
            <h3 className="mb-3 text-xs font-semibold">Örnek {i + 1}</h3>
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                ["widthMm", "En"],
                ["projectionMm", "Açılım"],
                ["mountingHeightMm", "Montaj yüksekliği"],
                ["quantity", "Adet"],
              ]
                .filter(
                  ([key]) =>
                    form.geometry !== "vertical" || key !== "projectionMm",
                )
                .map(([key, label]) => (
                  <label className="text-xs" key={key}>
                    {label}
                    <input
                      required
                      min={1}
                      type="number"
                      className="rf-input mt-2 w-full"
                      value={ex.parameters[key] || ""}
                      onChange={(e) =>
                        patch(
                          "examples",
                          form.examples.map((v: any, n: number) =>
                            n === i
                              ? {
                                  ...v,
                                  parameters: {
                                    ...v.parameters,
                                    [key]: +e.target.value,
                                  },
                                }
                              : v,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                form.parameterDefinitions ||
                form.parameter_definitions ||
                []
              ).map((p: any) => (
                <label key={p.key} className="text-xs">
                  {p.label || p.key} · {p.unit}
                  <input
                    className="rf-input mt-2 w-full"
                    type={p.type === "boolean" ? "checkbox" : "number"}
                    step={p.integer ? "1" : "any"}
                    {...(p.type === "boolean"
                      ? {
                          checked:
                            ex.parameters.customParameters?.[p.key] || false,
                        }
                      : {
                          value: ex.parameters.customParameters?.[p.key] ?? "",
                        })}
                    onChange={(e) =>
                      patch(
                        "examples",
                        form.examples.map((v: any, n: number) =>
                          n === i
                            ? {
                                ...v,
                                parameters: {
                                  ...v.parameters,
                                  customParameters: {
                                    ...v.parameters.customParameters,
                                    [p.key]:
                                      p.type === "boolean"
                                        ? e.target.checked
                                        : Number(e.target.value),
                                  },
                                },
                              }
                            : v,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <label className="my-3 flex gap-2 text-xs">
              <input
                type="checkbox"
                checked={ex.parameters.led}
                onChange={(e) =>
                  patch(
                    "examples",
                    form.examples.map((v: any, n: number) =>
                      n === i
                        ? {
                            ...v,
                            parameters: {
                              ...v.parameters,
                              led: e.target.checked,
                            },
                          }
                        : v,
                    ),
                  )
                }
              />{" "}
              LED var
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              {materialIds.map((id) => (
                <label key={id} className="text-xs">
                  {items.find((x) => x.id === id)?.name} · Beklenen toplam
                  <input
                    required
                    type="number"
                    min={0}
                    step="any"
                    className="rf-input mt-2 w-full"
                    value={
                      ex.expected.find((m: any) => m.itemId === id)?.quantity ??
                      ""
                    }
                    onChange={(e) =>
                      patch(
                        "examples",
                        form.examples.map((v: any, n: number) =>
                          n === i
                            ? {
                                ...v,
                                expected: [
                                  ...v.expected.filter(
                                    (m: any) => m.itemId !== id,
                                  ),
                                  { itemId: id, quantity: +e.target.value },
                                ],
                              }
                            : v,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 text-xs text-primary"
              onClick={() => {
                try {
                  setCalculated(
                    calculateRecipe(form as RecipeDefinition, ex.parameters),
                  );
                  setError("");
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Formülü kontrol edin",
                  );
                }
              }}
            >
              Hesap sonucunu incele
            </button>
          </div>
        ))}
      </fieldset>
      {calculated && (
        <div className="rounded bg-muted p-4 text-xs">
          <p className="mb-2 font-semibold">Hesaplanan BOM</p>
          {calculated.materials.map((m: any) => (
            <p key={m.itemId}>
              {items.find((i) => i.id === m.itemId)?.name}: {m.quantity} {m.uom}
            </p>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button disabled={busy} className="rf-primary-button" type="submit">
        Reçete taslağını kaydet
      </button>
    </form>
  );
}
