import { z } from "zod";
import { COUNT_UNITS, STOCK_UNITS } from "../inventory/vocabulary";
import { QualityChecksSchema } from "./quality";
const Formula = z.string().trim().min(1).max(400);
export const RecipeRuleSchema = z
  .object({
    itemId: z.string().uuid(),
    kind: z.enum(["profile", "material"]),
    uom: z.enum(STOCK_UNITS),
    quantityFormula: Formula,
    conditionFormula: Formula.optional(),
    cutLengthFormula: Formula.optional(),
  })
  .superRefine((r, ctx) => {
    if (r.kind === "profile" && (!r.cutLengthFormula || r.uom !== "m"))
      ctx.addIssue({
        code: "custom",
        message: "Profil için metre birimi ve kesim formülü gerekli",
      });
  });
export const RecipeParametersSchema = z.object({
  widthMm: z.number().positive().finite(),
  projectionMm: z.number().nonnegative().finite(),
  mountingHeightMm: z.number().positive().finite(),
  quantity: z.number().int().positive().max(10000),
  motor: z.boolean().default(true),
  led: z.boolean().default(false),
  customParameters: z.record(z.string(),z.union([z.number().finite(),z.boolean()])).optional(),
});
export type RecipeParameters = z.infer<typeof RecipeParametersSchema>;
const reserved = new Set(["widthMm","heightMm","projectionMm","mountingHeightMm","quantity","motor","led","areaM2","ceil","floor","round","min","max","abs","if","constructor","prototype"]);
export const RecipeParameterDefinitionSchema = z.object({
  key:z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,59}$/).refine(k=>!reserved.has(k),"Parametre adı ayrılmış"),
  label:z.string().trim().min(1).max(100), type:z.enum(["number","boolean"]), unit:z.string().max(24).default(""),
  required:z.boolean().default(true), defaultValue:z.union([z.number().finite(),z.boolean()]).optional(),
  minimum:z.number().finite().optional(),maximum:z.number().finite().optional(),integer:z.boolean().default(false),
}).superRefine((p,c)=>{
  if(p.minimum !== undefined && p.maximum !== undefined && p.minimum>p.maximum)c.addIssue({code:"custom",message:"Parametre sınırları geçersiz"});
  if(p.defaultValue !== undefined && typeof p.defaultValue !== (p.type==="number"?"number":"boolean"))c.addIssue({code:"custom",message:"Varsayılan parametre türü geçersiz"});
});
export const RecipeSchema = z.object({
  geometry:z.enum(['roof','vertical']).optional(),
  verificationSource:z.string().trim().min(5).max(1000).optional(),
  editRevision:z.number().int().positive().optional(),
  parameterDefinitions:z.array(RecipeParameterDefinitionSchema).max(30).refine(v=>new Set(v.map(p=>p.key)).size===v.length,"Parametre kodları benzersiz olmalı").optional(),
  constraints:z.array(z.object({formula:Formula,message:z.string().trim().min(1).max(250)})).max(30).optional(),
  code: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(180),
  version: z.number().int().positive(),
  finishedItemId: z.string().uuid(),
  rules: z.array(RecipeRuleSchema).min(1).max(100),
  operations: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(100),
        workCenterCode: z.string().trim().min(2).max(60),
        minutesFormula: Formula,
        conditionFormula: Formula.optional(),
        setupMinutesFormula: Formula.optional(),
        qualityChecks: QualityChecksSchema,
      }),
    )
    .min(1)
    .max(20),
  limits: z.object({
    minWidthMm: z.number().positive(),
    maxWidthMm: z.number().positive(),
    minProjectionMm: z.number().nonnegative(),
    maxProjectionMm: z.number().nonnegative(),
    minMountingHeightMm: z.number().positive(),
    maxMountingHeightMm: z.number().positive(),
  }),
  examples: z
    .array(
      z.object({
        parameters: RecipeParametersSchema,
        expected: z
          .array(
            z.object({
              itemId: z.string().uuid(),
              quantity: z.number().nonnegative().finite(),
            }),
          )
          .min(1),
      }),
    )
    .max(20)
    .default([]),
});
export type RecipeDefinition = z.infer<typeof RecipeSchema>;
export function evaluateFormula(
  expression: string,
  variables: Record<string, number>,
): number {
  if (expression.length > 400) throw new Error("Formül çok uzun");
  const tokens =
    expression.match(
      /\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|<=|>=|==|!=|[+\-*/(),<>]/g,
    ) || [];
  if (tokens.join("") !== expression.replace(/\s/g, "") || tokens.length > 200)
    throw new Error("Geçersiz formül");
  let p = 0,
    depth = 0;
  const funcs: Record<string, (...n: number[]) => number> = {
    ceil: Math.ceil,
    floor: Math.floor,
    round: Math.round,
    min: Math.min,
    max: Math.max,
    abs: Math.abs,
    if: (c, a, b) => (c ? a : b),
  };
  const bounded = (v: number) => {
    if (!Number.isFinite(v) || Math.abs(v) > 1e12)
      throw new Error("Formül sonucu geçersiz");
    return v;
  };
  function primary(): number {
    if (++depth > 40) throw new Error("Formül fazla iç içe");
    let value: number;
    const token = tokens[p++];
    if (token === "+" || token === "-")
      value = (token === "-" ? -1 : 1) * primary();
    else if (token === "(") {
      value = compare();
      if (tokens[p++] !== ")") throw new Error("Parantez eksik");
    } else if (token && /^\d/.test(token)) value = Number(token);
    else if (token && funcs[token] && tokens[p] === "(") {
      p++;
      const args = [compare()];
      while (tokens[p] === ",") {
        p++;
        args.push(compare());
      }
      if (tokens[p++] !== ")") throw new Error("Parantez eksik");
      const unary = ["ceil", "floor", "round", "abs"].includes(token);
      if (
        (unary && args.length !== 1) ||
        (token === "if" && args.length !== 3) ||
        args.length > 30
      )
        throw new Error("Fonksiyon parametreleri geçersiz");
      value = funcs[token](...args);
    } else if (token && Object.prototype.hasOwnProperty.call(variables, token))
      value = variables[token];
    else throw new Error("Bilinmeyen parametre: " + token);
    depth--;
    return bounded(value);
  }
  function product(): number {
    let v = primary();
    while (tokens[p] === "*" || tokens[p] === "/") {
      const op = tokens[p++],
        n = primary();
      v = bounded(op === "*" ? v * n : v / n);
    }
    return v;
  }
  function sum(): number {
    let v = product();
    while (tokens[p] === "+" || tokens[p] === "-") {
      const op = tokens[p++],
        n = product();
      v = bounded(op === "+" ? v + n : v - n);
    }
    return v;
  }
  function compare(): number {
    const v = sum(),
      op = tokens[p];
    if (!["<", ">", "<=", ">=", "==", "!="].includes(op)) return v;
    p++;
    const n = sum();
    return Number(
      op === "<"
        ? v < n
        : op === ">"
          ? v > n
          : op === "<="
            ? v <= n
            : op === ">="
              ? v >= n
              : op === "=="
                ? v === n
                : v !== n,
    );
  }
  const result = compare();
  if (p !== tokens.length) throw new Error("Formül tamamlanmadı");
  return bounded(result);
}
export function calculateRecipe(
  raw: RecipeDefinition,
  input: RecipeParameters,
) {
  const recipe = RecipeSchema.parse(raw),
    params = RecipeParametersSchema.parse(input),
    l = recipe.limits;
  if(recipe.geometry==='vertical'){if(params.projectionMm!==0||l.minProjectionMm!==0||l.maxProjectionMm!==0)throw new Error('Dikey üründe açılım uygulanmaz; reçetede açılım sınırları 0 olmalı');}
  else if(params.projectionMm<=0||l.minProjectionMm<=0||l.maxProjectionMm<=0)throw new Error('Açılım pozitif olmalı');
  for (const [value, min, max, label] of [
    [params.widthMm, l.minWidthMm, l.maxWidthMm, "En"],
    [params.projectionMm, l.minProjectionMm, l.maxProjectionMm, "Açılım"],
    [
      params.mountingHeightMm,
      l.minMountingHeightMm,
      l.maxMountingHeightMm,
      "Montaj yüksekliği",
    ],
  ] as const)
    if (value < min || value > max || min > max)
      throw new Error(label + " reçete sınırları dışında");
  const custom: Record<string,number> = {};
  const definitions=recipe.parameterDefinitions || [];
  for(const key of Object.keys(params.customParameters || {}))if(!definitions.some(p=>p.key===key))throw new Error("Reçetede tanımlı olmayan parametre: "+key);
  for(const definition of definitions){
    const value=params.customParameters?.[definition.key] ?? definition.defaultValue;
    if(value===undefined){if(definition.required)throw new Error(definition.label+": parametre gerekli");continue;}
    if(typeof value !== (definition.type==="number"?"number":"boolean"))throw new Error(definition.label+": parametre türü geçersiz");
    if(typeof value === "number" && ((definition.minimum!==undefined && value<definition.minimum) || (definition.maximum!==undefined && value>definition.maximum) || (definition.integer && !Number.isInteger(value))))throw new Error(definition.label+": parametre sınırları dışında");
    custom[definition.key]=Number(value);
  }
  const variables = {
    ...custom,
    widthMm:params.widthMm, projectionMm:params.projectionMm,mountingHeightMm:params.mountingHeightMm,heightMm:params.mountingHeightMm,
    motor: Number(params.motor),
    led: Number(params.led),
    quantity: 1,
    areaM2: (params.widthMm * (recipe.geometry==='vertical'?params.mountingHeightMm:params.projectionMm)) / 1_000_000,
  };
  for(const constraint of recipe.constraints || [])if(!evaluateFormula(constraint.formula,variables))throw new Error(constraint.message);
  const cuts: Array<{ itemId: string; lengthMm: number; quantity: number }> =
    [];
  const amounts = new Map<
    string,
    { itemId: string; quantity: number; uom: string }
  >();
  for (const r of recipe.rules) {
    if(r.conditionFormula && !evaluateFormula(r.conditionFormula,variables))continue;
    const amount = evaluateFormula(r.quantityFormula, variables);
    if (amount < 0) throw new Error("Negatif malzeme ihtiyacı");
    if (amount === 0) continue;
    let quantity = amount * params.quantity;
    if (r.kind === "profile") {
      const lengthMm = evaluateFormula(r.cutLengthFormula!, variables);
      if (
        !Number.isInteger(amount) ||
        lengthMm <= 0 ||
        Math.abs(lengthMm * 1000 - Math.round(lengthMm * 1000)) > 0.001
      )
        throw new Error("Kesim adedi veya boyu geçersiz");
      cuts.push({ itemId: r.itemId, lengthMm, quantity });
      quantity = (quantity * lengthMm) / 1000;
    }
    if (COUNT_UNITS.has(r.uom) && !Number.isInteger(quantity))
      throw new Error("Adet tam sayı olmalı");
    const old = amounts.get(r.itemId);
    if (old && old.uom !== r.uom)
      throw new Error("Malzeme birimleri çakışıyor");
    amounts.set(r.itemId, {
      itemId: r.itemId,
      quantity: Number(((old?.quantity || 0) + quantity).toFixed(6)),
      uom: r.uom,
    });
  }
  const operations = recipe.operations.filter(op=>!op.conditionFormula || evaluateFormula(op.conditionFormula,variables)).map((op, position) => {
    const plannedMinutes = evaluateFormula(op.minutesFormula, {
      ...variables,
      quantity: params.quantity,
    });
    if (plannedMinutes <= 0) throw new Error("Operasyon süresi pozitif olmalı");
    const setupMinutes=op.setupMinutesFormula ? evaluateFormula(op.setupMinutesFormula,variables) : 0;
    if(setupMinutes<0)throw new Error("Hazırlık süresi negatif olamaz");
    return { ...op, position, plannedMinutes, setupMinutes };
  });
  if(!operations.length)throw new Error("Üretim rotasında en az bir operasyon gerekli");
  return {
    parameters: {...params,customParameters:Object.fromEntries(definitions.filter(d=>custom[d.key]!==undefined).map(d=>[d.key,d.type==="boolean"?Boolean(custom[d.key]):custom[d.key]]))},
    materials: [...amounts.values()],
    cuts,
    operations,
    recipeCode: recipe.code,
    recipeVersion: recipe.version,
  };
}
export function validateRecipeExamples(recipe: RecipeDefinition) {
  if (recipe.examples.length < 2)
    throw new Error("Yayınlamak için en az iki doğrulanmış örnek gerekli");
  if (
    new Set(recipe.examples.map((e) => JSON.stringify(e.parameters))).size < 2
  )
    throw new Error("Örnekler farklı ölçü veya opsiyonlar içermeli");
  for (const ex of recipe.examples) {
    const result = calculateRecipe(recipe, ex.parameters);
    const expectedIds=new Set(ex.expected.map(e=>e.itemId));
    if(expectedIds.size!==ex.expected.length)throw new Error("Örnek malzemeleri benzersiz olmalı");
    const expectedNonzero=ex.expected.filter(e=>e.quantity>0);
    if (expectedNonzero.length !== result.materials.length)
      throw new Error("Örnek tüm malzemeleri doğrulamalı");
    for (const m of result.materials) {
      const expected = ex.expected.find((e) => e.itemId === m.itemId);
      if (!expected || Math.abs(expected.quantity - m.quantity) > 0.000001)
        throw new Error("Örnek hesabı uyuşmuyor: " + m.itemId);
    }
  }
  return true;
}
