import * as T from "three";
import { Parts } from "./parts";
import type { VisualizationConfiguration } from "./catalog";
import { rollerPose } from "./mechanisms";
export function screenModel(c: VisualizationConfiguration) {
  const b = new Parts(c),
    g = b.group,
    w = c.widthMm / 1000,
    h = c.heightMm / 1000,
    cassette = c.kind === "cassette";
  // Curved cassette shell, two independent end covers and mounting consoles.
  const outer: [number, number][] = [
    [-0.064, -0.053],
    [-0.064, 0.039],
    [-0.041, 0.065],
    [0.038, 0.065],
    [0.066, 0.04],
    [0.066, -0.037],
    [0.035, -0.062],
    [-0.043, -0.062],
  ];
  const inner: [number, number][] = [
    [-0.058, -0.047],
    [-0.058, 0.036],
    [-0.038, 0.059],
    [0.035, 0.059],
    [0.06, 0.036],
    [0.06, -0.034],
    [0.032, -0.056],
    [-0.039, -0.056],
  ].reverse() as [number, number][];
  b.profile(outer, [inner], w + 0.08, [-w / 2 - 0.04, h, 0], "x");
  for (const x of [-w / 2 - 0.045, w / 2 + 0.045]) {
    b.box([0.015, 0.112, 0.127], [x, h, 0], b.rubber);
    for (const y of [h - 0.034, h + 0.034]) b.bolt([x, y, 0.059], "z");
  }
  for (const x of [-w * 0.42, 0, w * 0.42]) {
    b.box([0.12, 0.13, 0.018], [x, h - 0.018, -0.084]);
    for (const y of [h - 0.065, h + 0.034]) b.bolt([x, y, -0.097], "z");
  }
  const bar = new T.Group();
  g.add(bar);
  b.tube(0.045, 0.044, 0.002, w, [-w / 2, 0, 0.008], "x", bar);
  b.box([w, 0.006, 0.031], [0, -0.027, 0.008], b.rubber, bar);
  for (const x of [-w / 2, w / 2])
    b.box([0.014, 0.045, 0.04], [x, 0, 0.008], b.rubber, bar);
  const roller = b.cylinder(0.036, w - 0.03, [0, h, 0], b.fabric, "x");
  for (const x of [-w / 2 + 0.012, w / 2 - 0.012]) {
    b.cylinder(0.039, 0.014, [x, h, 0], b.steel, "x");
    b.box([0.015, 0.03, 0.018], [x, h - 0.015, 0.022], b.rubber);
  }
  const textile = cassette
    ? undefined
    : b.mesh(new T.PlaneGeometry(w - 0.035, 1, 24, 32), b.fabric);
  if (textile) textile.receiveShadow = false;
  if (!cassette)
    for (const x of [-w / 2, w / 2]) {
      // Open channel lips + internal zip liner, rather than a solid vertical box.
      b.tube(0.035, 0.044, 0.002, h - 0.05, [x, 0.03, 0], "y");
      b.box(
        [0.007, h - 0.05, 0.006],
        [x + (x > 0 ? -0.021 : 0.021), (h - 0.05) / 2 + 0.03, 0.025],
        b.rubber,
      );
      b.box(
        [0.007, h - 0.05, 0.006],
        [x + (x > 0 ? -0.021 : 0.021), (h - 0.05) / 2 + 0.03, -0.012],
        b.rubber,
      );
      for (const y of [0.18, h - 0.18]) b.bolt([x, y, 0.027], "z");
      b.box([0.04, 0.012, 0.049], [x, 0.02, 0], b.rubber);
    }
  function update(opening: number) {
    if (!textile) {
      bar.position.set(0, h - 0.035, 0.067);
      g.userData = { product: c.kind, opening: 0 };
      b.syncFasteners();
      return;
    }
    const pose = rollerPose(h - 0.075, opening);
    roller.scale.set(pose.radius / 0.036, 1, pose.radius / 0.036);
    roller.rotation.x = pose.rotation;
    bar.position.set(0, h - 0.037 - pose.visible, pose.radius + 0.003);
    const attr = textile.geometry.getAttribute("position"),
      uv = textile.geometry.getAttribute("uv");
    for (let j = 0; j < attr.count; j++) {
      const u = Math.floor(j / 25) / 32;
      attr.setXYZ(
        j,
        -w / 2 + 0.0175 + ((j % 25) / 24) * (w - 0.035),
        h - 0.037 - u * pose.visible,
        pose.radius + 0.003,
      );
      uv.setY(j, (u * pose.visible) / (h - 0.075));
    }
    attr.needsUpdate = true;
    uv.needsUpdate = true;
    textile.visible = pose.visible > 0.003;
    textile.geometry.computeVertexNormals();
    textile.geometry.computeBoundingSphere();
    g.userData = { product: c.kind, opening, roller: pose };
    b.syncFasteners();
  }
  update(0);
  return { group: g, update, dispose: () => b.dispose() };
}
