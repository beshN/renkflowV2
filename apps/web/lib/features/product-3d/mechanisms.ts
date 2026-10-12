/** Pure geometry, in metres. This is a visual model, not a manufacturing calculation. */
export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export function pergolaPositions(
  depth: number,
  count: number,
  opening: number,
) {
  const start = 0.18,
    pitch = (depth - 0.36) / count,
    packed = 0.082;
  const front =
    start +
    Math.max(count * packed, (depth - 0.36) * (1 - clamp01(opening / 100)));
  return Array.from({ length: count + 1 }, (_, i) =>
    Math.max(
      start + i * packed,
      Math.min(start + i * pitch, front - (count - i) * packed),
    ),
  );
}
/** Solve the sag of a fixed-length textile strip, including the roof slope. */
export function stripSag(span: number, dy: number, length: number) {
  if (Math.hypot(span, dy) >= length) return 0;
  const arc = (sag: number) => {
    let l = 0,
      py = 0,
      pz = 0;
    for (let i = 1; i <= 64; i++) {
      const u = i / 64,
        y = dy * u - 4 * sag * u * (1 - u),
        z = span * u;
      l += Math.hypot(y - py, z - pz);
      py = y;
      pz = z;
    }
    return l;
  };
  let lo = 0,
    hi = length / 2;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (arc(mid) > length) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
export function rollerPose(
  length: number,
  opening: number,
  thickness = 0.00065,
  core = 0.036,
) {
  const stored = length * clamp01(opening / 100),
    radius = Math.sqrt(core * core + (stored * thickness) / Math.PI);
  return {
    radius,
    stored,
    visible: length - stored,
    rotation: (2 * Math.PI * (radius - core)) / thickness,
  };
}
/** Video-matched tilt-then-stack presentation; exact hidden cam/link ratios are unpublished. */
export function rollingPose(depth: number, opening: number) {
  const n = Math.max(3, Math.ceil((depth - 0.36) / 0.235)),
    closedPitch = (depth - 0.36) / n,
    t = clamp01(opening / 100);
  const angle = Math.min(1, t / 0.22) * Math.PI * 0.445;
  // Reserve the complete panel silhouette, rather than dividing by sin(angle) at the flat endpoint.
  const silhouette =
    closedPitch * Math.cos(angle) +
    0.0602 * Math.sin(angle) +
    0.004 * Math.sin(angle);
  const requested =
    closedPitch + (0.112 - closedPitch) * Math.max(0, (t - 0.22) / 0.78);
  const pitch = Math.min(closedPitch, Math.max(silhouette, requested)),
    drop = Math.sqrt(Math.max(0, closedPitch * closedPitch - pitch * pitch));
  return {
    n,
    angle,
    pitch,
    drop,
    linkLength: closedPitch,
    centers: Array.from({ length: n }, (_, i) => 0.18 + pitch * (i + 0.5)),
  };
}
export function guillotinePositions(height: number, opening: number) {
  const pane = (height - 0.13) / 3,
    t = clamp01(opening / 100);
  return {
    pane,
    centers: [
      0.06 + pane / 2,
      0.06 + pane / 2 + pane * (1 - t),
      0.06 + pane / 2 + 2 * pane * (1 - t),
    ],
  };
}
export function windPose(height: number, opening: number, piston: boolean) {
  const low = piston ? 1.05 : height * 0.55,
    travel = Math.max(0, height - low),
    t = clamp01(opening / 100);
  return {
    low,
    travel,
    lift: travel * (1 - t),
    overlap: low - travel * (1 - t),
  };
}
export function slidingPositions(
  width: number,
  count: number,
  opening: number,
) {
  const overlap = 0.028,
    pane = (width + (count - 1) * overlap) / count,
    t = clamp01(opening / 100);
  return {
    pane,
    centers: Array.from(
      { length: count },
      (_, i) => -width / 2 + pane / 2 + i * (pane - overlap) * (1 - t),
    ),
  };
}
