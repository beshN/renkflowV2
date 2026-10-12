import * as T from "three";
import { Parts, type Point } from "./parts";
import type { VisualizationConfiguration } from "./catalog";
import {
  pergolaPositions,
  rollingPose,
  stripSag,
  slidingPositions,
} from "./mechanisms";

// ROLLING-ROOF.pdf: 243.45 × 60.2 mm, 2.2 mm wall. Digitized envelope,
// interlocking lips and main cavity; small die radii are a visual approximation.
const LAMEL: Point[] = [
  [-0.121725, 0.028],
  [-0.113, 0.0322],
  [-0.075, 0.0322],
  [-0.063, 0.024],
  [-0.042, -0.013],
  [-0.022, -0.015],
  [0.104, -0.015],
  [0.112, -0.009],
  [0.096, 0.03],
  [0.101, 0.0322],
  [0.119, -0.004],
  [0.121725, -0.022],
  [0.113, -0.028],
  [-0.06, -0.028],
  [-0.069, -0.021],
  [-0.094, 0.023],
  [-0.112, 0.025],
  [-0.117, 0.019],
];
const CAVITY: Point[] = [
  [-0.086, 0.023],
  [-0.066, -0.021],
  [-0.058, -0.025],
  [0.111, -0.025],
  [0.117, -0.02],
  [0.103, -0.017],
  [-0.023, -0.017],
  [-0.044, -0.015],
  [-0.065, 0.024],
].reverse() as Point[];

export function roofModel(c: VisualizationConfiguration) {
  const b = new Parts(c),
    g = b.group,
    w = c.widthMm / 1000,
    d = c.projectionMm / 1000,
    h = c.heightMm / 1000;
  const pergola = c.kind === "pergola",
    glass = c.kind === "glass-roof" || c.kind === "winter-garden";
  const slope = pergola || glass ? 0.08 : 0,
    post = pergola || glass ? 0.1 : 0.165;
  const top = (z: number) => h - slope * z,
    front = top(d),
    columns = pergola ? Math.max(2, Math.ceil(w / 3) + 1) : 2;
  const xs = Array.from(
    { length: columns },
    (_, i) => -w / 2 + (i * w) / (columns - 1),
  );
  // Actual hollow extrusions remain open at the ends, with separate caps and fasteners.
  for (const x of xs)
    for (const z of c.mounting === "wall" ? [d] : [0, d]) {
      const height = top(z) - 0.09;
      b.tube(post, post, 0.0025, height, [x, 0.023, z], "y");
      b.foot(x, z, post + 0.065);
      b.box([post + 0.016, 0.007, post + 0.016], [x, height + 0.025, z]);
      const plate = b.box([post + 0.05, 0.016, 0.2], [x, top(z) - 0.08, z]);
      plate.name = "ray-dikme-connection";
      for (const dx of [-post * 0.35, post * 0.35])
        for (const dz of [-0.065, 0.065])
          b.bolt([x + dx, top(z) - 0.065, z + dz]);
    }
  if (c.mounting === "wall") {
    b.tube(0.1, 0.15, 0.0025, w + 0.15, [-w / 2 - 0.075, h - 0.03, 0], "x");
    for (const x of xs)
      for (const y of [h - 0.1, h + 0.02]) b.bolt([x, y, -0.055], "z");
  }
  const gutterHeight = pergola ? 0.15 : 0.087,
    gutterWidth = pergola ? 0.16 : 0.14;
  for (const z of [0, d]) {
    b.gutter(
      gutterWidth,
      gutterHeight,
      0.0025,
      w + 0.18,
      [-w / 2 - 0.09, top(z) - gutterHeight / 2, z],
      "x",
    );
    b.box([w + 0.18, 0.007, 0.016], [0, top(z) + 0.004, z + 0.07], b.rubber);
    for (const x of [-w / 2 - 0.09, w / 2 + 0.09])
      b.box(
        [0.004, gutterHeight, gutterWidth],
        [x, top(z) - gutterHeight / 2, z],
      );
  }
  for (const x of xs) {
    const rail = b.rail(
      pergola ? 0.1 : 0.07519,
      pergola ? 0.14 : 0.13996,
      pergola ? 0.0025 : 0.0015,
      d,
      [x, h - 0.11, 0],
    );
    rail.rotation.x = Math.atan(slope);
    rail.scale.z = Math.hypot(1, slope);
    for (const sign of [-1, 1])
      b.box(
        [0.004, 0.008, d],
        [x + sign * 0.036, h - 0.059 - (slope * d) / 2, d / 2],
        b.rubber,
      ).rotation.x = Math.atan(slope);
    for (const z of [0, d]) {
      b.box([pergola ? 0.115 : 0.085, 0.16, 0.014], [x, top(z) - 0.11, z]);
      b.bolt([x, top(z) - 0.11, z + 0.01], "z");
    }
  }
  // Side fascia, U-shaped four-sided drainage and integrated diffuser strip.
  if (!pergola)
    for (const x of [-w / 2, w / 2]) {
      b.tube(0.05, 0.218, 0.0025, d, [x, h - 0.105, 0], "z");
      b.gutter(
        0.14,
        0.087,
        0.0025,
        d,
        [x + (x > 0 ? -0.067 : 0.067), h - 0.11, 0],
        "z",
      );
      if (c.led !== "off")
        b.box(
          [0.012, 0.007, d - 0.16],
          [x + (x > 0 ? -0.083 : 0.083), h - 0.16, d / 2],
          b.led,
        );
    }
  for (const x of [-w / 2, w / 2]) {
    const pipe = b.cylinder(
      0.012,
      front - 0.18,
      [x, front / 2, d - 0.025],
      b.rubber,
    );
    pipe.name = "water-drain";
    b.cylinder(0.018, 0.008, [x, front - 0.025, d - 0.025], b.rubber);
  }
  const moving: Array<T.Group> = [],
    carriages: Array<T.Group> = [],
    cloth: Array<T.Mesh> = [],
    links: Array<{
      mesh: T.Mesh;
      i: number;
      x: number;
      reverse: boolean;
      pins: T.Group[];
    }> = [];
  const count = pergola
    ? Math.max(4, Math.round((d - 0.36) / 0.55))
    : rollingPose(d, 0).n;
  const wheel = (parent: T.Group, x: number) => {
    for (const z of [-0.022, 0.022])
      for (const dx of [-0.018, 0.018])
        b.cylinder(0.016, 0.01, [x + dx, -0.073, z], b.rubber, "x", parent);
    b.box([0.05, 0.052, 0.075], [x, -0.062, 0], b.steel, parent);
    b.bolt([x, -0.025, 0], "y", parent);
  };
  if (pergola) {
    const motor = b.cylinder(
      0.035,
      w - 0.14,
      [0, h - 0.11, 0.018],
      b.steel,
      "x",
    );
    motor.name = "tubular-motor";
    for (const x of xs) {
      b.cylinder(0.028, 0.012, [x, h - 0.09, 0.016], b.rubber, "x");
      b.cylinder(0.028, 0.012, [x, front - 0.09, d - 0.05], b.rubber, "x");
      const belt = b.box(
        [0.018, 0.006, d - 0.08],
        [x, h - 0.09 - (slope * d) / 2, d / 2],
        b.rubber,
      );
      belt.rotation.x = Math.atan(slope);
      b.boxes(
        [0.018, 0.004, 0.006],
        Array.from(
          { length: Math.floor(d / 0.022) },
          (_, j) =>
            [x, top(j * 0.022) - 0.092, j * 0.022] as [number, number, number],
        ),
        b.rubber,
      );
    }
    b.box([w + 0.15, 0.009, 0.32], [0, h + 0.022, 0.08]);
    for (let i = 0; i <= count; i++) {
      const p = new T.Group();
      g.add(p);
      moving.push(p);
      b.tube(0.065, 0.06, 0.002, w, [-w / 2, -0.032, 0], "x", p);
      for (const x of [-w / 2, w / 2])
        b.box([0.009, 0.061, 0.066], [x, -0.032, 0], b.rubber, p);
      for (const x of xs) wheel(p, x);
      if (c.led !== "off" && i > 0 && i < count)
        for (let j = 0; j < Math.max(2, Math.round(w / 1.3)); j++) {
          const x = -w / 2 + (w * (j + 0.5)) / Math.max(2, Math.round(w / 1.3));
          b.box([0.29, 0.021, 0.047], [x, -0.068, 0], b.rubber, p);
          b.box([0.245, 0.007, 0.021], [x, -0.081, 0], b.led, p);
        }
      if (i < count) {
        const m = b.mesh(new T.PlaneGeometry(w - 0.05, 1, 16, 48), b.fabric);
        m.receiveShadow = false;
        cloth.push(m);
      }
    }
  } else if (!glass) {
    for (let i = 0; i < count; i++) {
      const p = new T.Group();
      g.add(p);
      moving.push(p);
      const m = b.profile(
        LAMEL,
        [CAVITY],
        w - 0.17,
        [-w / 2 + 0.085, 0, 0],
        "x",
        p,
      );
      m.name = "measured-interlocking-lamel";
      for (const x of [-w / 2 + 0.077, w / 2 - 0.077]) {
        b.box([0.009, 0.057, 0.223], [x, 0, 0], b.rubber, p);
        for (const z of [-0.08, 0.08]) b.bolt([x, 0, z], "x", p);
      }
      if (c.kind === "rolling-roof") {
        const carriage = new T.Group();
        g.add(carriage);
        carriages.push(carriage);
        for (const x of [-w / 2 + 0.018, w / 2 - 0.018]) {
          b.cylinder(0.021, 0.02, [x, -0.085, 0], b.rubber, "x", carriage);
          b.box([0.018, 0.06, 0.028], [x, -0.052, 0], b.steel, carriage);
          b.cylinder(0.01, 0.08, [x, 0, 0], b.steel, "x", carriage);
          if (i < count - 1)
            for (const reverse of [false, true]) {
              const plane = x + (reverse ? 0.004 : -0.004),
                pins = [
                  b.bolt([plane, 0, 0], "x"),
                  b.bolt([plane, 0, 0], "x"),
                  b.bolt([plane, 0, 0], "x"),
                ];
              links.push({
                mesh: b.link([plane, 0, 0], [plane, 0.01, 0.2]),
                i,
                x: plane,
                reverse,
                pins,
              });
            }
        }
      } else
        for (const x of [-w / 2 + 0.035, w / 2 - 0.035])
          b.cylinder(0.012, 0.08, [x, 0, 0], b.steel, "x", p);
    }
    b.box([0.16, 0.12, 0.32], [-w / 2 - 0.015, h - 0.085, 0.25]);
    b.bolt([-w / 2 - 0.1, h - 0.09, 0.25], "x");
  } else {
    const bays = Math.max(2, Math.round(w / 0.8));
    for (let i = 0; i <= bays; i++) {
      const x = -w / 2 + (i * w) / bays,
        rafter = b.tube(0.06, 0.12, 0.0025, d, [x, h - 0.043, 0], "z");
      rafter.rotation.x = Math.atan(slope);
      rafter.scale.z = Math.hypot(1, slope);
      const cap = b.box(
        [0.072, 0.018, d],
        [x, h + 0.025 - (slope * d) / 2, d / 2],
      );
      cap.rotation.x = Math.atan(slope);
      for (const dx of [-0.025, 0.025])
        b.box(
          [0.008, 0.005, d],
          [x + dx, h + 0.014 - (slope * d) / 2, d / 2],
          b.rubber,
        ).rotation.x = Math.atan(slope);
      for (let j = 0; j < Math.ceil(d / 0.6); j++)
        b.bolt([x, top(j * 0.6) + 0.036, j * 0.6]);
      if (i < bays) {
        const pane = b.pane(
          w / bays - 0.065,
          d - 0.09,
          0.01,
          [x + w / bays / 2, h + 0.008 - (slope * d) / 2, d / 2],
          g,
          c.glass === "insulated",
        );
        pane.rotation.x = -Math.PI / 2 + Math.atan(slope);
      }
    }
  }
  const facade: T.Group[] = [];
  if (c.kind === "winter-garden") {
    const n = 4,
      { pane } = slidingPositions(w - 0.14, n, 0);
    for (let i = 0; i < n; i++) {
      const p = new T.Group();
      g.add(p);
      facade.push(p);
      b.framedPane(pane, front - 0.18, 0.008, p, c.glass === "insulated");
    }
    for (let i = 0; i < n; i++)
      b.box([w, 0.012, 0.008], [0, 0.042, d - 0.05 + i * 0.05], b.steel);
    for (const x of [-w / 2, w / 2]) {
      const p = b.pane(d - 0.1, front - 0.24, 0.008, [x, front / 2, d / 2]);
      p.rotation.y = Math.PI / 2;
    }
  }
  function update(opening: number) {
    if (pergola) {
      const positions = pergolaPositions(d, count, opening),
        length = ((d - 0.36) / count) * Math.hypot(1, slope) + 0.025;
      moving.forEach((p, i) =>
        p.position.set(0, top(positions[i]), positions[i]),
      );
      cloth.forEach((m, i) => {
        const a = positions[i],
          z = positions[i + 1],
          span = z - a,
          dy = -slope * span,
          sag = stripSag(span, dy, length),
          attr = m.geometry.getAttribute("position");
        for (let j = 0; j < attr.count; j++) {
          const row = Math.floor(j / 17),
            u = row / 48,
            x = -w / 2 + 0.025 + ((j % 17) / 16) * (w - 0.05);
          attr.setXYZ(
            j,
            x,
            top(a) + 0.006 + dy * u - 4 * sag * u * (1 - u),
            a + span * u,
          );
        }
        attr.needsUpdate = true;
        m.geometry.computeVertexNormals();
        m.geometry.computeBoundingSphere();
      });
    } else if (c.kind === "rolling-roof") {
      const pose = rollingPose(d, opening);
      moving.forEach((p, i) => {
        p.position.set(0, h + 0.01, pose.centers[i]);
        p.rotation.x = -pose.angle;
      });
      carriages.forEach((p, i) => p.position.set(0, h + 0.01, pose.centers[i]));
      for (const { mesh, i, x, reverse, pins } of links) {
        const a = pose.centers[i],
          z = pose.centers[i + 1],
          drop = pose.drop;
        b.poseLink(
          mesh,
          [x, h - 0.045 - (reverse ? drop : 0), a],
          [x, h - 0.045 - (reverse ? 0 : drop), z],
        );
        pins[0].position.set(x, h - 0.045 - (reverse ? drop : 0), a);
        pins[1].position.set(x, h - 0.045 - (reverse ? 0 : drop), z);
        pins[2].position.set(x, h - 0.045 - drop / 2, (a + z) / 2);
      }
    } else if (c.kind === "bioclimatic") {
      moving.forEach((p, i) => {
        p.position.set(0, h + 0.01, 0.18 + ((d - 0.36) / count) * (i + 0.5));
        p.rotation.x = (-opening / 100) * Math.PI * 0.42;
      });
    } else if (c.kind === "winter-garden") {
      const pose = slidingPositions(w - 0.14, facade.length, opening);
      facade.forEach((p, i) =>
        p.position.set(pose.centers[i], front / 2, d - 0.06 + i * 0.05),
      );
    }
    b.syncFasteners();
    g.userData = {
      product: c.kind,
      opening,
      partCount: 0,
      ...(pergola
        ? { carrierPositions: pergolaPositions(d, count, opening) }
        : {}),
      ...(c.kind === "rolling-roof"
        ? { rolling: rollingPose(d, opening) }
        : {}),
    };
  }
  update(0);
  return { group: g, update, dispose: () => b.dispose() };
}
