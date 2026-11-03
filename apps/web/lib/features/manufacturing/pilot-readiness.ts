import { RecipeSchema, validateRecipeExamples } from './recipe-engine';
import { requiredTables, requiredColumns } from './schema-requirements';

export type Finding = { code: string; severity: 'blocker' | 'warning' | 'info'; message: string; hint: string };
export type Row = Record<string, unknown>;
export type PilotRows = {
  tables: { table_name: string }[];
  columns: { table_name: string; column_name: string }[];
  families: Row[]; recipes: Row[]; items: Row[]; centers: Row[];
  members: Row[]; resources: Row[]; lots: Row[]; balances: Row[];
};
export const pilotColumns: Record<string, string[]> = {
  product_family_recipes: ['tenant_id', 'recipe_code', 'family'],
  production_recipes: ['tenant_id', 'code', 'name', 'version', 'status', 'finished_item_id', 'rules', 'operations', 'limits', 'examples', 'parameter_definitions', 'constraints'],
  inventory_items: ['tenant_id', 'id', 'name'],
  work_centers: ['tenant_id', 'code', 'active', 'parallel_capacity', 'machine_required', 'team_required'],
  tenant_members: ['tenant_id', 'user_id', 'role'],
  production_resources: ['tenant_id', 'kind', 'active', 'user_id', 'member_ids', 'work_center_codes', 'parallel_capacity'],
  stock_lots: ['tenant_id', 'item_id', 'remaining_qty', 'status'],
  stock_balances: ['tenant_id', 'item_id', 'on_hand_qty'],
};

/** Pure assessment of database rows; never connects, mutates, or fixes data. */
export function checkPilotReadiness(input: PilotRows): Finding[] {
  const findings: Finding[] = [];
  const add = (code: string, severity: Finding['severity'], message: string, hint: string) => findings.push({ code, severity, message, hint });
  const tables = new Set(input.tables.map(r => r.table_name));
  const columns = new Set(input.columns.map(r => `${r.table_name}.${r.column_name}`));
  for (const table of new Set([...requiredTables, ...Object.keys(pilotColumns)])) {
    if (!tables.has(table)) add('SCHEMA_TABLE', 'blocker', `Eksik tablo: ${table}`, 'Şemayı ayrı test ortamında doğrulayın.');
  }
  for (const requirements of [requiredColumns, pilotColumns]) for (const [table, names] of Object.entries(requirements)) {
    if (tables.has(table)) for (const name of names) if (!columns.has(`${table}.${name}`))
      add('SCHEMA_COLUMN', 'blocker', `Eksik kolon: ${table}.${name}`, 'Şemayı ayrı test ortamında doğrulayın.');
  }
  const families = input.families.filter(r => r.family === 'makasli');
  if (!families.length) add('RECIPE_MISSING', 'blocker', 'Makaslı tente aile eşlemesi yok.', 'Yayınlı reçete eşlemesini kontrol edin.');
  for (const family of families) {
    const recipes = input.recipes.filter(r => r.tenant_id === family.tenant_id && r.code === family.recipe_code);
    if (!recipes.some(r => r.status === 'published')) add('RECIPE_UNPUBLISHED', 'blocker', `${family.recipe_code}: yayınlı reçete yok.`, 'Taslak veya arşiv reçete pilot için yeterli değil.');
  }
  const recipes = input.recipes.filter(r => families.some(f => f.tenant_id === r.tenant_id && f.recipe_code === r.code) && r.status !== 'archived');
  for (const row of recipes) {
    const label = `${row.code} v${row.version}`;
    const parsed = RecipeSchema.safeParse({ ...row, finishedItemId: row.finished_item_id, parameterDefinitions: row.parameter_definitions, constraints: row.constraints });
    if (!parsed.success) { add('RECIPE_INVALID', 'blocker', `${label}: reçete tanımı geçersiz.`, 'Reçete alanlarını kontrol edin.'); continue; }
    const recipe = parsed.data;
    try {
      validateRecipeExamples(recipe);
      add('RECIPE_EXAMPLES', 'info', `${label}: validateRecipeExamples başarılı.`, 'Örnek hesabı fiziksel pilot doğrulaması değildir.');
    } catch {
      add('RECIPE_EXAMPLES', 'blocker', `${label}: validateRecipeExamples başarısız.`, 'En az iki farklı, tam ve doğru örneği kontrol edin.');
    }
    // 024/035/073 do not define a test/synthetic flag. Do not infer one from names or source prose.
    const sameTenant = (r: Row) => r.tenant_id === row.tenant_id;
    for (const rule of recipe.rules) {
      const item = input.items.find(r => sameTenant(r) && r.id === rule.itemId);
      const name = item?.name || rule.itemId;
      if (!item) add('MATERIAL_MISSING', 'blocker', `${label}: malzeme bulunamadı: ${name}`, 'Reçete malzeme eşlemesini kontrol edin.');
      if (rule.kind === 'profile') {
        const missing = ['weight_per_meter_kg', 'standard_length_m', 'profile_section'].filter(k => item?.[k] == null || String(item[k]).trim() === '');
        if (missing.length) add('PROFILE_FIELDS', 'blocker', `${label}: ${name}: eksik profil alanları: ${missing.join(', ')}`, 'Profil kartındaki teknik bilgileri doğrulayın.');
      }
      const lot = input.lots.some(r => sameTenant(r) && r.item_id === rule.itemId && r.status === 'available' && Number(r.remaining_qty) > 0);
      const balance = input.balances.some(r => sameTenant(r) && r.item_id === rule.itemId && Number(r.on_hand_qty) > 0);
      if (!lot || !balance) add('INITIAL_STOCK', 'warning', `${label}: ${name}: pozitif kullanılabilir lot veya bakiye yok.`, 'Başlangıç stoğunu kontrol edin; miktar yeterliliği hesaplanmaz.');
    }
    for (const operation of recipe.operations) {
      const code = operation.workCenterCode;
      const center = input.centers.find(r => sameTenant(r) && r.code === code && r.active === true && Number(r.parallel_capacity) > 0);
      if (!center) add('WORK_CENTER', 'blocker', `${label}: ${operation.name}: aktif iş merkezi yok (${code}).`, 'Kapasite tanımını kontrol edin.');
      const members = input.members.filter(r => sameTenant(r) && !r.deactivated_at && ['owner', 'admin', 'office', 'worker'].includes(String(r.role)));
      const resources = input.resources.filter(r => sameTenant(r) && r.active === true && Number(r.parallel_capacity) > 0 && Array.isArray(r.work_center_codes) && (!r.work_center_codes.length || r.work_center_codes.includes(code)));
      if (!members.some(m => {
        const employee = input.resources.find(r => sameTenant(r) && r.kind === 'employee' && r.user_id === m.user_id);
        return !employee || resources.includes(employee);
      })) add('EMPLOYEE', 'blocker', `${label}: ${operation.name}: atanabilir çalışan yok.`, 'Aktif üyeliği ve çalışan kaynak uygunluğunu kontrol edin.');
      for (const kind of ['machine', 'team']) if (center?.[`${kind}_required`] && !resources.some(r => r.kind === kind && (kind !== 'team' || (Array.isArray(r.member_ids) && members.some(m => (r.member_ids as unknown[]).includes(m.user_id))))))
        add('RESOURCE', 'blocker', `${label}: ${operation.name}: uygun ${kind === 'team' ? 'ekip' : 'makine'} yok.`, 'İş merkezinin zorunlu kaynaklarını kontrol edin.');
    }
    const l = recipe.limits;
    add('DIMENSION_LIMITS', 'info', `${label}: genişlik ${l.minWidthMm}–${l.maxWidthMm} mm; derinlik/açılım ${l.minProjectionMm}–${l.maxProjectionMm} mm.`, 'Reçetede kayıtlı sınırlar; uygunluk hükmü verilmez.');
    for (const p of recipe.parameterDefinitions || []) if (/width|projection|depth|genis|derin/i.test(p.key))
      add('PARAMETER_LIMITS', 'info', `${label}: ${p.key}: min ${p.minimum ?? 'tanımsız'}, max ${p.maximum ?? 'tanımsız'} ${p.unit}`, 'Kayıtlı parametre sınırları; uygunluk hükmü verilmez.');
  }
  return findings;
}
