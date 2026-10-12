import * as T from "three";
import { Parts } from "./parts";
import type { VisualizationConfiguration } from "./catalog";
import { guillotinePositions, slidingPositions, windPose } from "./mechanisms";
export function glassModel(c: VisualizationConfiguration) {
  const b = new Parts(c),
    g = b.group,
    w = c.widthMm / 1000,
    h = c.heightMm / 1000,
    sliding = c.kind === "sliding-glass",
    giyotin = c.kind === "giyotin",
    piston = c.kind === "wind-piston";
  const moving: T.Group[] = [],
    base = c.mounting === "planter" ? 0.33 : 0.025;
  let counterweight: T.Group | undefined;
  const balanceCables: Array<{
    mesh: T.Mesh;
    x: number;
    end: "pane" | "weight";
  }> = [];
  const post = piston ? 0.083 : giyotin ? 0.09 : 0.065;
  if (c.mounting === "planter") {
    b.box([w + 0.16, 0.025, 0.52], [0, 0.13, 0]);
    b.gutter(0.52, 0.27, 0.003, w + 0.16, [-w / 2 - 0.08, 0.275, 0], "x");
    for (const x of [-w / 2 - 0.08, w / 2 + 0.08])
      b.box([0.004, 0.27, 0.52], [x, 0.275, 0]);
    const soil = b.material("#504838", { roughness: 1 });
    b.box([w + 0.08, 0.02, 0.45], [0, 0.38, 0], soil);
    for (const x of [-w * 0.42, w * 0.42])
      for (const z of [-0.18, 0.18]) {
        b.box([0.025, 0.065, 0.018], [x, 0.1, z], b.steel);
        b.cylinder(0.04, 0.027, [x, 0.044, z], b.rubber, "x");
        b.bolt([x + 0.017, 0.044, z], "x");
      }
    // Quiet planting context: no plant masks obscure the moving glass and connections.
    const green = b.material("#647856", { roughness: 0.95 });
    for (let j = 0; j < Math.round(w / 0.13); j++) {
      const x = -w / 2 + 0.08 + j * 0.13;
      for (const dx of [-0.035, 0.035]) {
        const leaf = b.mesh(
          new T.ConeGeometry(0.024, 0.18 + (j % 3) * 0.015, 5),
          green,
        );
        leaf.position.set(x + dx, 0.49, 0.13);
        leaf.rotation.z = dx * 6;
      }
    }
  }
  const addFrame = (
    p: T.Group,
    width: number,
    height: number,
    thickness: number,
    full = true,
  ) => {
    if (full)
      b.framedPane(width, height, thickness, p, c.glass === "insulated");
    else {
      b.pane(width - 0.045, height, thickness, [0, 0, 0], p);
      for (const x of [-width / 2 + 0.008, width / 2 - 0.008])
        b.box([0.023, height, 0.027], [x, 0, 0], b.rubber, p);
      b.tube(0.039, 0.032, 0.002, width, [-width / 2, -height / 2, 0], "x", p);
    }
  };
  if (giyotin || sliding) {
    const channels = sliding ? 4 : 3;
    for (const x of [-w / 2 - post / 2, w / 2 + post / 2]) {
      b.tube(post, 0.19, 0.0025, h, [x, base, 0], "y");
      b.foot(x, 0, post + 0.055);
      for (let i = 0; i < channels; i++) {
        const z = -0.068 + i * 0.052;
        b.box(
          [0.008, h, 0.007],
          [x + (x > 0 ? -0.048 : 0.048), base + h / 2, z - 0.023],
          b.rubber,
        );
        b.box(
          [0.008, h, 0.007],
          [x + (x > 0 ? -0.048 : 0.048), base + h / 2, z + 0.023],
          b.rubber,
        );
      }
      for (const y of [base + 0.12, base + h - 0.15]) b.bolt([x, y, 0.1], "z");
    }
    b.tube(
      0.19,
      0.105,
      0.0025,
      w + 0.18,
      [-w / 2 - 0.09, h + base - 0.038, 0],
      "x",
    );
    b.tube(
      0.19,
      0.055,
      0.002,
      w + 0.15,
      [-w / 2 - 0.075, base + 0.023, 0],
      "x",
    );
    for (let i = 0; i < channels; i++) {
      const z = -0.068 + i * 0.052;
      b.box([w, 0.008, 0.007], [0, base + 0.054, z], b.steel);
      b.box([w, 0.007, 0.008], [0, base + h - 0.097, z], b.rubber);
    }
    const paneHeight = giyotin ? guillotinePositions(h, 0).pane : h - 0.16;
    const paneWidth = sliding ? slidingPositions(w, channels, 0).pane : w;
    for (let i = 0; i < channels; i++) {
      const p = new T.Group();
      g.add(p);
      moving.push(p);
      addFrame(p, paneWidth, paneHeight, 0.008);
      if (sliding) {
        for (const x of [-paneWidth * 0.36, paneWidth * 0.36]) {
          b.cylinder(
            0.018,
            0.013,
            [x, -paneHeight / 2 + 0.005, 0],
            b.rubber,
            "x",
            p,
          );
          b.bolt([x, -paneHeight / 2 + 0.006, 0.013], "z", p);
        }
        b.box(
          [0.012, 0.12, 0.028],
          [paneWidth / 2 - 0.022, 0, 0.04],
          b.steel,
          p,
        );
      }
    }
    if (giyotin) {
      // Motor is enclosed. The external maintenance/end covers are visible in the sources.
      for (const x of [-w / 2 - 0.02, w / 2 + 0.02]) {
        b.box([0.04, 0.11, 0.19], [x, h + base - 0.04, 0]);
        b.bolt([x, h + base - 0.04, 0.099], "z");
      }
    }
  } else {
    const pose = windPose(h - base, 0, piston),
      low = pose.low;
    const fixed = new T.Group();
    fixed.position.set(0, base + low / 2, -0.03);
    g.add(fixed);
    addFrame(fixed, w - 0.1, low - 0.08, 0.008, !piston);
    const p = new T.Group();
    g.add(p);
    moving.push(p);
    addFrame(p, w - 0.1, low - 0.09, piston ? 0.008 : 0.006, !piston);
    if (!piston) {
      // In the manufacturer's manual-lift video, the horizontal balance bar descends
      // inside the lower glass as the upper pane rises. Both side towers stop at the sill.
      counterweight = new T.Group();
      counterweight.name = "manual-counterweight";
      g.add(counterweight);
      b.box([w - 0.14, 0.055, 0.018], [0, 0, 0], b.metal, counterweight);
      for (const x of [-w / 2 + 0.072, w / 2 - 0.072]) {
        b.box([0.025, 0.068, 0.025], [x, 0, 0], b.rubber, counterweight);
        b.bolt([x, 0, 0.014], "z", counterweight);
      }
    }
    for (const x of [-w / 2, w / 2]) {
      b.foot(x, 0, post + 0.08);
      const fixedPost = b.tube(post, post, 0.0025, low, [x, base, 0], "y");
      fixedPost.name = piston ? "piston-outer-post" : "manual-low-fixed-post";
      b.box([post + 0.005, 0.009, post + 0.005], [x, base + low, 0], b.rubber);
      for (const y of [base + 0.11, base + low - 0.15])
        b.bolt([x, y, post / 2 + 0.004], "z");
      if (piston) {
        const inner = new T.Group();
        p.add(inner);
        inner.position.x = x;
        b.tube(
          post - 0.014,
          post - 0.014,
          0.0025,
          low - 0.065,
          [0, -low / 2 + 0.006, 0],
          "y",
          inner,
        );
        b.box(
          [post - 0.009, 0.01, post - 0.009],
          [0, low / 2 - 0.055, 0],
          b.rubber,
          inner,
        );
      } else {
        const pulleyX = x + (x > 0 ? -0.023 : 0.023);
        b.cylinder(
          0.017,
          0.012,
          [pulleyX, base + low - 0.035, 0],
          b.steel,
          "z",
        );
        b.bolt([pulleyX, base + low - 0.035, 0.01], "z");
        for (const end of ["pane", "weight"] as const) {
          const cable = b.cylinder(0.0011, 1, [0, 0, 0], b.steel);
          cable.name = `manual-balance-cable-${end}`;
          balanceCables.push({ mesh: cable, x: pulleyX, end });
        }
        for (const z of [-0.03, 0.027])
          b.box(
            [0.009, low, 0.006],
            [x + (x > 0 ? -0.032 : 0.032), base + low / 2, z],
            b.rubber,
          );
      }
    }
  }
  function update(opening: number) {
    if (giyotin) {
      const pose = guillotinePositions(h, opening);
      moving.forEach((p, i) =>
        p.position.set(0, base + pose.centers[i], -0.052 + i * 0.052),
      );
    } else if (sliding) {
      const pose = slidingPositions(w, moving.length, opening);
      moving.forEach((p, i) =>
        p.position.set(
          pose.centers[i],
          base + (h - 0.16) / 2 + 0.06,
          -0.068 + i * 0.052,
        ),
      );
    } else {
      const pose = windPose(h - base, opening, piston);
      moving[0].position.set(0, base + pose.low / 2 + pose.lift, 0.027);
      if (counterweight) {
        const weightY = base + pose.low - 0.09 - pose.lift,
          paneY = base + 0.045 + pose.lift,
          pulleyY = base + pose.low - 0.035;
        counterweight.position.set(0, weightY, -0.005);
        for (const cable of balanceCables) {
          const endY = cable.end === "pane" ? paneY : weightY;
          cable.mesh.scale.y = Math.max(0.001, pulleyY - endY);
          cable.mesh.position.set(
            cable.x,
            (pulleyY + endY) / 2,
            cable.end === "pane" ? 0.018 : -0.005,
          );
        }
      }
    }
    b.syncFasteners();
    g.userData = {
      product: c.kind,
      opening,
      panels: moving.map((p) => p.position.toArray()),
      ...(counterweight
        ? { counterweight: counterweight.position.toArray() }
        : {}),
      ...(giyotin ? { guillotine: guillotinePositions(h, opening) } : {}),
    };
  }
  update(0);
  return { group: g, update, dispose: () => b.dispose() };
}
