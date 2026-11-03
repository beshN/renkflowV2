import { checkPilotReadiness, pilotColumns, type PilotRows } from '@/lib/features/manufacturing/pilot-readiness';
import { requiredTables, requiredColumns } from '@/lib/features/manufacturing/schema-requirements';
const itemId = '10000000-0000-4000-8000-000000000001';
function fixture(): PilotRows {
  const parameters = { widthMm: 3000, projectionMm: 2000, mountingHeightMm: 3000, quantity: 1, motor: true, led: false };
  return {
    tables: [...new Set([...requiredTables, ...Object.keys(pilotColumns)])].map(table_name => ({ table_name })),
    columns: [requiredColumns, pilotColumns].flatMap(list => Object.entries(list).flatMap(([table_name, names]) => names.map(column_name => ({ table_name, column_name })))),
    families: [{ tenant_id: 't', recipe_code: 'MAK', family: 'makasli' }],
    recipes: [{ tenant_id: 't', code: 'MAK', name: 'Makaslı tente', version: 1, status: 'published', finished_item_id: itemId,
      rules: [{ itemId, kind: 'profile', uom: 'm', quantityFormula: '2', cutLengthFormula: '1000' }],
      operations: [{ name: 'Kesim', workCenterCode: 'CUT', minutesFormula: '10' }],
      limits: { minWidthMm: 1, maxWidthMm: 5000, minProjectionMm: 1, maxProjectionMm: 5000, minMountingHeightMm: 1, maxMountingHeightMm: 5000 },
      examples: [parameters, { ...parameters, widthMm: 4000 }].map(parameters => ({ parameters, expected: [{ itemId, quantity: 2 }] })) }],
    items: [{ tenant_id: 't', id: itemId, name: 'Taşıyıcı profil', weight_per_meter_kg: '1', standard_length_m: '6', profile_section: '170' }],
    centers: [{ tenant_id: 't', code: 'CUT', active: true, parallel_capacity: 1 }],
    members: [{ tenant_id: 't', user_id: 'u', role: 'worker' }], resources: [],
    lots: [{ tenant_id: 't', item_id: itemId, remaining_qty: 5, status: 'available' }],
    balances: [{ tenant_id: 't', item_id: itemId, on_hand_qty: 5 }],
  };
}
const codes = (input: PilotRows) => checkPilotReadiness(input).map(f => f.code);
it('reports an empty database without throwing', () => {
  const input = { tables: [], columns: [], families: [], recipes: [], items: [], centers: [], members: [], resources: [], lots: [], balances: [] };
  expect(codes(input)).toEqual(expect.arrayContaining(['SCHEMA_TABLE', 'RECIPE_MISSING']));
});
it('accepts complete rows, reports examples and informational limits without mutation', () => {
  const input = fixture(), before = JSON.stringify(input);
  expect(checkPilotReadiness(input).every(f => f.severity === 'info')).toBe(true);
  expect(codes(input)).toEqual(['RECIPE_EXAMPLES', 'DIMENSION_LIMITS']);
  expect(JSON.stringify(input)).toBe(before);
});
it('reports missing schema columns', () => {
  const input = fixture(); input.columns = [];
  expect(codes(input)).toContain('SCHEMA_COLUMN');
});
it('blocks draft-only and archived-only recipes', () => {
  for (const status of ['draft', 'archived']) { const input = fixture(); input.recipes[0].status = status; expect(codes(input)).toContain('RECIPE_UNPUBLISHED'); }
});
it('reports invalid definitions and failed example validation', () => {
  const input = fixture(); input.recipes[0].examples = [];
  expect(checkPilotReadiness(input)).toContainEqual(expect.objectContaining({ code: 'RECIPE_EXAMPLES', severity: 'blocker' }));
  input.recipes[0].rules = null; expect(codes(input)).toContain('RECIPE_INVALID');
});
it.each(['weight_per_meter_kg', 'standard_length_m', 'profile_section'])('names missing profile field %s and item', key => {
  const input = fixture(); input.items[0][key] = null;
  expect(checkPilotReadiness(input)).toContainEqual(expect.objectContaining({ code: 'PROFILE_FIELDS', severity: 'blocker', message: expect.stringContaining('Taşıyıcı profil') }));
});
it('blocks absent material cards', () => { const input = fixture(); input.items = []; expect(codes(input)).toContain('MATERIAL_MISSING'); });
it('requires active centers and assignable members', () => {
  const input = fixture(); input.centers[0].active = false; input.members[0].deactivated_at = '2026-01-01';
  expect(codes(input)).toEqual(expect.arrayContaining(['WORK_CENTER', 'EMPLOYEE']));
});
it('checks employee resource eligibility and required team/machine', () => {
  const input = fixture(); input.resources = [{ tenant_id: 't', kind: 'employee', user_id: 'u', active: false }];
  input.centers[0].machine_required = true; input.centers[0].team_required = true;
  expect(codes(input)).toContain('EMPLOYEE'); expect(codes(input).filter(c => c === 'RESOURCE')).toHaveLength(2);
});
it.each(['lots', 'balances'] as const)('warns for missing or zero %s', key => {
  const input = fixture(); input[key] = [];
  expect(checkPilotReadiness(input)).toContainEqual(expect.objectContaining({ code: 'INITIAL_STOCK', severity: 'warning' }));
});
it('does not borrow another tenant data or infer synthetic flags from names', () => {
  const input = fixture(); input.members[0].tenant_id = 'other'; input.recipes[0].name = 'Synthetic test';
  expect(codes(input)).toContain('EMPLOYEE'); expect(codes(input)).not.toContain('SYNTHETIC');
});
it('shows parameter bounds as information only', () => {
  const input = fixture();
  input.recipes[0].parameter_definitions = [{ key: 'depthLimit', label: 'Derinlik', type: 'number', minimum: 10, maximum: 20, required: false }];
  expect(checkPilotReadiness(input)).toContainEqual(expect.objectContaining({ code: 'PARAMETER_LIMITS', severity: 'info', message: expect.stringContaining('min 10, max 20') }));
});
it('warns for depleted lots and zero balances', () => {
  const input = fixture(); input.lots[0].remaining_qty = 0; input.balances[0].on_hand_qty = 0;
  expect(codes(input)).toContain('INITIAL_STOCK');
});
it('never borrows another tenant recipe, card, center or stock', () => {
  const input = fixture();
  for (const rows of [input.items, input.centers, input.lots, input.balances]) rows[0].tenant_id = 'other';
  expect(codes(input)).toEqual(expect.arrayContaining(['MATERIAL_MISSING', 'WORK_CENTER', 'INITIAL_STOCK']));
  input.recipes[0].tenant_id = 'other'; expect(codes(input)).toContain('RECIPE_UNPUBLISHED');
});
it('accepts eligible employee, machine and team resources', () => {
  const input = fixture(); input.centers[0].team_required = true; input.centers[0].machine_required = true;
  input.resources = ['employee', 'machine', 'team'].map(kind => ({ tenant_id: 't', kind, active: true, parallel_capacity: 1, work_center_codes: ['CUT'], user_id: kind === 'employee' ? 'u' : null, member_ids: kind === 'team' ? ['u'] : [] }));
  expect(checkPilotReadiness(input).every(f => f.severity === 'info')).toBe(true);
});
