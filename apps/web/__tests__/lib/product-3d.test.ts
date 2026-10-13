import {
  PRODUCT_CATALOG,
  defaultVisualization,
  VisualizationConfigurationSchema,
  ProductVisualizationSchema,
  attachVisualization,
  visualizationForRecipe,
} from "@/lib/features/product-3d/catalog";
import {
  pergolaPositions,
  stripSag,
  rollingPose,
  rollerPose,
  guillotinePositions,
  slidingPositions,
} from "@/lib/features/product-3d/mechanisms";
import { roofModel } from "@/lib/features/product-3d/roof-model";
import { glassModel } from "@/lib/features/product-3d/glass-model";
import { screenModel } from "@/lib/features/product-3d/screen-model";
import * as THREE from "three";

test("every product has a valid default; reject oversized dimensions and untrusted images", () => {
  for (const p of PRODUCT_CATALOG) {
    expect(
      VisualizationConfigurationSchema.safeParse(defaultVisualization(p.kind))
        .success,
    ).toBe(true);
    expect(
      VisualizationConfigurationSchema.safeParse({
        ...defaultVisualization(p.kind),
        widthMm: p.viewMax[0] + 1,
      }).success,
    ).toBe(false);
  }
  expect(
    ProductVisualizationSchema.safeParse({
      configuration: defaultVisualization("pergola"),
      image: "https://example.com/tracking.png",
    }).success,
  ).toBe(false);
});
test("pergola carriers gather sequentially without changing textile length", () => {
  for (const depth of [1.5, 4, 9])
    for (const opening of [0, 25, 50, 75, 100]) {
      const count = Math.max(4, Math.round((depth - 0.36) / 0.55)),
        p = pergolaPositions(depth, count, opening),
        length = ((depth - 0.36) / count) * Math.hypot(1, 0.08) + 0.025;
      expect(p[0]).toBeCloseTo(0.18);
      expect(p.at(-1)!).toBeLessThanOrEqual(depth - 0.18 + 1e-9);
      for (let i = 0; i < count; i++) {
        const span = p[i + 1] - p[i],
          dy = -0.08 * span,
          sag = stripSag(span, dy, length);
        expect(span).toBeGreaterThanOrEqual(0.082 - 1e-9);
        let measured = 0,
          y = 0,
          z = 0;
        for (let j = 1; j <= 64; j++) {
          const u = j / 64,
            ny = dy * u - 4 * sag * u * (1 - u),
            nz = span * u;
          measured += Math.hypot(ny - y, nz - z);
          y = ny;
          z = nz;
        }
        expect(measured).toBeCloseTo(length, 5);
      }
    }
  const p = pergolaPositions(4, 7, 50);
  expect(p[1] - p[0]).toBeGreaterThan(0.082);
  expect(p.at(-1)! - p.at(-2)!).toBeCloseTo(0.082);
});
test("Rolling Roof reaches finite flat and gathered endpoints with constant scissor length", () => {
  for (const depth of [0.9, 1.5, 4, 7])
    for (let opening = 0; opening <= 100; opening++) {
      const p = rollingPose(depth, opening);
      expect(Number.isFinite(p.angle + p.pitch + p.drop)).toBe(true);
      expect(Math.hypot(p.pitch, p.drop)).toBeCloseTo(p.linkLength, 10);
      expect(p.centers.at(-1)! + 0.12).toBeLessThanOrEqual(depth + 0.01);
    }
  expect(rollingPose(4, 0).angle).toBe(0);
  expect(rollingPose(4, 100).pitch).toBeLessThan(rollingPose(4, 0).pitch);
});
test("zip roll conserves fabric volume and leaves no hanging fabric when open", () => {
  for (const opening of [0, 25, 50, 75, 100]) {
    const p = rollerPose(2.725, opening);
    expect(p.stored + p.visible).toBeCloseTo(2.725, 10);
    expect(Math.PI * (p.radius ** 2 - 0.036 ** 2)).toBeCloseTo(
      p.stored * 0.00065,
      10,
    );
  }
  expect(rollerPose(2.725, 100).visible).toBe(0);
});
test("guillotine has a stationary bottom; sliding glass gathers on separate tracks", () => {
  expect(guillotinePositions(2.7, 100).centers).toEqual(
    Array(3).fill(guillotinePositions(2.7, 0).centers[0]),
  );
  expect(guillotinePositions(2.7, 0).centers[0]).toBe(
    guillotinePositions(2.7, 50).centers[0],
  );
  expect(new Set(slidingPositions(4, 4, 0).centers).size).toBe(4);
  expect(new Set(slidingPositions(4, 4, 100).centers).size).toBe(1);
});
test.each(PRODUCT_CATALOG.map((p) => [p.kind] as const))(
  "%s generates finite geometry in five motion positions and releases resources",
  (kind) => {
    const c = defaultVisualization(kind),
      meta = PRODUCT_CATALOG.find((p) => p.kind === kind)!;
    const model =
      meta.category === "roof"
        ? roofModel(c)
        : meta.category === "glass"
          ? glassModel(c)
          : screenModel(c);
    const disposed = new Set<THREE.BufferGeometry>(),
      geometries = new Set<THREE.BufferGeometry>();
    model.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        geometries.add(o.geometry);
        o.geometry.addEventListener("dispose", () => disposed.add(o.geometry));
      }
    });
    for (const opening of [0, 25, 50, 75, 100]) {
      model.update(opening);
      model.group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model.group);
      expect(
        [...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite),
      ).toBe(true);
      expect(box.min.y).toBeGreaterThan(-0.01);
      expect(box.max.y).toBeLessThan(c.heightMm / 1000 + 0.35);
      for (const geometry of geometries) {
        const p = geometry.getAttribute("position");
        for (let i = 0; i < p.count; i++)
          expect(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))).toBe(true);
      }
    }
    model.dispose();
    expect(disposed.size).toBe(geometries.size);
  },
);
test('manual windbreaker has low fixed posts and an opposing horizontal counterweight',()=>{
  const c=defaultVisualization('wind-manual'),model=glassModel(c),posts:THREE.Object3D[]=[];
  model.group.traverse(part=>{if(part.name==='manual-low-fixed-post')posts.push(part);});
  expect(posts).toHaveLength(2);model.group.updateMatrixWorld(true);
  for(const post of posts)expect(new THREE.Box3().setFromObject(post).max.y).toBeLessThan(1.05);
  let sum:number|undefined,previousPaneY=Infinity,previousWeightY=-Infinity;
  for(const opening of [0,25,50,75,100]){
    model.update(opening);const data=model.group.userData,paneY=data.panels[0][1],weightY=data.counterweight[1];
    expect(paneY).toBeLessThanOrEqual(previousPaneY);expect(weightY).toBeGreaterThanOrEqual(previousWeightY);
    if(sum!==undefined)expect(paneY+weightY).toBeCloseTo(sum,10);sum=paneY+weightY;previousPaneY=paneY;previousWeightY=weightY;
  }
  model.dispose();
});

test("a visual attachment preserves commercial measurements, price, recipe and BOM", () => {
  const item = {
    productName: "Published pergola",
    widthMm: 3400,
    unitPrice: 1234,
    quantity: 2,
    productConfiguration: {
      recipeId: "published",
      materials: [{ id: "stock", quantity: 4 }],
    },
    awningConfiguration: { version: 1 },
    awningPreview: "old",
  };
  const next = attachVisualization(item, {
    configuration: defaultVisualization("zip"),
  });
  expect(next.widthMm).toBe(3400);
  expect(next.unitPrice).toBe(1234);
  expect(next.quantity).toBe(2);
  expect(next.productConfiguration).toBe(item.productConfiguration);
  expect(next.productName).toBe(item.productName);
  expect(next.awningConfiguration).toBeUndefined();
  expect(next.awningPreview).toBeUndefined();
  const v = visualizationForRecipe({
    family: "pergola",
    parameters: {
      widthMm: 3400,
      projectionMm: 2500,
      mountingHeightMm: 2800,
      led: false,
    },
    color: "RAL 9016",
  });
  expect(v?.configuration.widthMm).toBe(3400);
  expect(v?.configuration.led).toBe("off");
  expect(v?.configuration.bodyColor).not.toBe(
    defaultVisualization("pergola").bodyColor,
  );
});
