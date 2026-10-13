import * as THREE from 'three';
import { defaultVisualization, PRODUCT_CATALOG, sameGeometry, VisualizationConfigurationSchema } from '@/lib/features/product-3d/catalog';
import { applyInlineVisualization, selectedProduct } from '@/lib/features/product-3d/inline';
import { glassModel } from '@/lib/features/product-3d/glass-model';
import { roofModel } from '@/lib/features/product-3d/roof-model';
import { screenModel } from '@/lib/features/product-3d/screen-model';

test.each([1000, 1600, 1900, 1950])('piston glass reaches its selected %i mm height at 100%%, including planter mounting', heightMm => {
  for (const mounting of ['wall', 'planter'] as const) {
    const config = { ...defaultVisualization('wind-piston'), heightMm, mounting };
    const model = glassModel(config);
    const moving = model.group.getObjectByName('piston-moving-pane')!;
    expect(moving).toBeDefined();
    let previous = -Infinity;
    for (const opening of [0, 25, 50, 75, 100]) {
      model.update(opening); model.group.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(moving);
      expect(bounds.max.y).toBeGreaterThanOrEqual(previous);
      expect(bounds.max.y).toBeLessThanOrEqual(heightMm / 1000 + 0.001);
      expect(bounds.min.y).toBeGreaterThanOrEqual((mounting === 'planter' ? 0.33 : 0.025) - 1e-9);
      previous = bounds.max.y;
    }
    expect(previous).toBeCloseTo(heightMm / 1000, 3);
    model.dispose();
  }
});

test.each(PRODUCT_CATALOG.map(p => [p.kind] as const))('%s changes colours in place and retains geometry', kind => {
  const config = defaultVisualization(kind);
  const category = PRODUCT_CATALOG.find(p => p.kind === kind)!.category;
  const model = category === 'roof' ? roofModel(config) : category === 'glass' ? glassModel(config) : screenModel(config);
  const meshes: THREE.Mesh[] = [];
  model.group.traverse(part => { if (part instanceof THREE.Mesh) meshes.push(part); });
  const geometries = meshes.map(m => m.geometry);
  const disposed = jest.fn();
  geometries.forEach(g => g.addEventListener('dispose', disposed));
  const next = { ...config, bodyColor: '#ff0000', fabricColor: '#0000ff', brightness: 32 };
  expect(sameGeometry(config, next)).toBe(true);
  expect(sameGeometry(config, { ...next, led: config.led === 'warm' ? 'white' : config.led })).toBe(true);
  model.setAppearance(next);
  expect(meshes.map(m => m.geometry)).toEqual(geometries);
  expect(disposed).not.toHaveBeenCalled();
  expect(meshes.some(m => (m.material as THREE.MeshStandardMaterial).color?.getHexString() === 'ff0000')).toBe(true);
  expect(sameGeometry(config, { ...next, widthMm: next.widthMm + 10 })).toBe(false);
  model.dispose();
});

test.each(PRODUCT_CATALOG.map(p => [p.kind] as const))('%s stays finite at its minimum and maximum visual dimensions', kind => {
  const meta = PRODUCT_CATALOG.find(p => p.kind === kind)!;
  for (const sizes of [[900, 900, 1000], meta.viewMax]) {
    const config = { ...defaultVisualization(kind), widthMm: sizes[0], projectionMm: sizes[1], heightMm: sizes[2] };
    expect(VisualizationConfigurationSchema.safeParse(config).success).toBe(true);
    const model = meta.category === 'roof' ? roofModel(config) : meta.category === 'glass' ? glassModel(config) : screenModel(config);
    for (const opening of [0, 25, 50, 75, 100]) {
      model.update(opening); model.group.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model.group);
      expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
    }
    model.dispose();
  }
});

test('inline edits keep prices and quantities while matching the displayed measurements and clearing old awning data', () => {
  const line = { productName: 'Motorlu Giyotin Cam', widthMm: 1800, heightMm: 1200, projectionMm: 2500, unitPrice: 24000, quantity: 15, discountPercent: 2, totalPrice: 352800, awningConfiguration: { old: true }, awningPreview: 'old' };
  const result = applyInlineVisualization(line, { configuration: defaultVisualization('giyotin') });
  expect(result).toMatchObject({ widthMm: 3000, heightMm: 2700, unitPrice: 24000, quantity: 15, discountPercent: 2, totalPrice: 352800 });
  expect(result.projectionMm).toBeUndefined();
  expect(result.awningConfiguration).toBeUndefined();
  expect(result.awningPreview).toBeUndefined();
  expect(selectedProduct(result)).toBe('giyotin');
  expect(selectedProduct({ productName: 'Özel çerçeve' })).toBe('');
});

test('all product preset measurements validate and excessive visual heights are rejected', () => {
  for (const p of PRODUCT_CATALOG) expect(VisualizationConfigurationSchema.safeParse(defaultVisualization(p.kind)).success).toBe(true);
  expect(VisualizationConfigurationSchema.safeParse({ ...defaultVisualization('wind-piston'), heightMm: 3000 }).success).toBe(false);
});
