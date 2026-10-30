import * as T from "three";
import { createOutdoorEnvironment } from "../product-3d/environment";
import { createAwning } from "./model";
import { AwningConfiguration, toSceneState } from "./configuration";
export type AwningView =
  | "perspective"
  | "front"
  | "side"
  | "top"
  | "under"
  | "detail";
export function createAwningScene(
  canvas: HTMLCanvasElement,
  initial: AwningConfiguration,
  onOpening: (value: number) => void,
  onUnavailable: () => void = () => {},
) {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 1, 0.05, 100);
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  const hemi = new T.HemisphereLight("#cfe3ff", "#8d8a72", 2.2),
    sun = new T.DirectionalLight("#fff3e0", 3.4);
  sun.position.set(-3, 9, 6);
  const env = createOutdoorEnvironment(renderer, scene, sun.position);
  scene.environmentIntensity = 1;
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -12,
    right: 12,
    top: 10,
    bottom: -10,
    near: 0.1,
    far: 30,
  });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 4;
  scene.add(hemi, sun);
  // The awning always hangs on the building.
  env.setWallVisible(true);
  let state = toSceneState(initial),
    model = createAwning(state);
  scene.add(model.group);
  const furnish = () => env.placeProps({ w: state.width / 100, d: state.depth / 100, h: state.height / 100, roof: true, wall: true });
  furnish();
  let theta = -0.72,
    phi = 1.13,
    distance = 11,
    target = new T.Vector3(),
    view: AwningView = "perspective",
    visible = true,
    disposed = false,
    lost = false,
    raf = 0;
  let animation: null | { start: number; from: number; to: number } = null,
    lastNotify = 0;
  function selectView(v: AwningView) {
    view = v;
    const w = state.width / 100,
      h = state.height / 100,
      d = state.depth / 100;
    if (v === "detail") {
      target.set(-w / 2 + 0.12, h - 0.28, Math.min(d * 0.3, 0.95));
      theta = -1.1;
      phi = 1.4;
      distance = 3.15;
    } else if (v === "under") {
      target.set(0, h - 0.18, d * 0.38);
      theta = -0.32;
      phi = 2;
      distance = Math.max(4.7, w * 0.8);
    } else {
      target.set(0, h * 0.55, Math.min(1.6, d * 0.4));
      theta = v === "front" ? 0 : v === "side" ? -1.5 : -0.72;
      phi =
        v === "top" ? 0.08 : v === "side" ? 1.42 : v === "front" ? 1.35 : 1.13;
      distance = Math.max(10.5, w * 1.65);
    }
    render();
  }
  function render() {
    if (disposed || lost) return;
    camera.position.set(
      target.x + distance * Math.sin(phi) * Math.sin(theta),
      target.y + distance * Math.cos(phi),
      target.z + distance * Math.sin(phi) * Math.cos(theta),
    );
    camera.lookAt(target);
    renderer.render(scene, camera);
  }
  function setTime(time: number) {
    state.time = time;
    const t = time / 100,
      night = t * t;
    hemi.intensity = 2.2 * (1 - night) + 0.12;
    sun.intensity = 3.4 * (1 - night) + 0.07;
    sun.color.set(t > 0.3 && t < 0.85 ? "#ffbd80" : "#fff3e0");
    sun.position.set(-4, 9 - t * 7, 6);
    env.setNight(night, sun.position);
    scene.environmentIntensity = 1 - night * 0.7;
    renderer.toneMappingExposure = 1.05 + night * 0.15;
    render();
  }
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (r.width && r.height) {
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
      render();
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const pointers = new Map<number, [number, number]>();
  let lastPinch: number | null = null;
  const down = (e: PointerEvent) => {
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()],
        p = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (lastPinch && p > 0)
        distance = Math.max(3, Math.min(40, (distance * lastPinch) / p));
      lastPinch = p;
    } else {
      theta = Math.max(
        -1.53,
        Math.min(1.53, theta - (e.clientX - prev[0]) * 0.008),
      );
      phi = Math.max(0.08, Math.min(2.15, phi - (e.clientY - prev[1]) * 0.006));
    }
    render();
  };
  const release = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    lastPinch = null;
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    distance = Math.max(3, Math.min(40, distance + e.deltaY * 0.009));
    render();
  };
  const key = (e: KeyboardEvent) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-"].includes(
        e.key,
      )
    )
      return;
    e.preventDefault();
    if (e.key === "ArrowLeft") theta -= 0.1;
    if (e.key === "ArrowRight") theta += 0.1;
    if (e.key === "ArrowUp") phi = Math.max(0.08, phi - 0.1);
    if (e.key === "ArrowDown") phi = Math.min(2.15, phi + 0.1);
    if (e.key === "+") distance = Math.max(3, distance - 0.5);
    if (e.key === "-") distance = Math.min(40, distance + 0.5);
    render();
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("keydown", key);
  function frame(now: number) {
    if (disposed || !visible || document.hidden) {
      raf = 0;
      return;
    }
    if (animation) {
      const t = Math.min(1, (now - animation.start) / 8000),
        ease = t * t * (3 - 2 * t);
      state.opening = animation.from + (animation.to - animation.from) * ease;
      model.update(state);
      if (now - lastNotify > 100 || t === 1) {
        onOpening(state.opening);
        lastNotify = now;
      }
      if (t === 1) animation = null;
    }
    render();
    raf = animation ? requestAnimationFrame(frame) : 0;
  }
  function resume() {
    if (visible && !document.hidden && !disposed && !lost) {
      if (animation)
        animation = {
          start: performance.now(),
          from: state.opening,
          to: animation.to,
        };
      if (!raf) raf = requestAnimationFrame(frame);
    }
  }
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (!visible) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else resume();
  });
  intersection.observe(canvas);
  const visibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else resume();
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(raf);
    raf = 0;
    visible = false;
    onUnavailable();
  };
  canvas.addEventListener("webglcontextlost", contextLost);
  document.addEventListener("visibilitychange", visibility);
  selectView("perspective");
  setTime(0);
  resize();
  return {
    setConfiguration(c: AwningConfiguration) {
      const next = toSceneState(c, state.opening, state.time);
      const appearanceOnly = next.width === state.width && next.depth === state.depth && next.height === state.height && next.light === state.light;
      if (disposed || lost) return;
      const previous = state;
      state = next;
      if (appearanceOnly) { model.setAppearance(state); render(); return; }
      scene.remove(model.group);
      model.dispose();
      model = createAwning(state);
      scene.add(model.group);
      furnish();
      // Keep the camera angle during edits and gently fit growing dimensions.
      target.y += (state.height - previous.height) / 100 * 0.55;
      target.z += (state.depth - previous.depth) / 100 * 0.4;
      distance *= Math.max(1, state.width / previous.width, state.height / previous.height);
      render();
    },
    setOpening(value: number) {
      animation = null;
      state.opening = value;
      model.update(state);
      render();
    },
    selectView,
    setTime,
    toggleAnimation() {
      animation = animation
        ? null
        : {
            start: performance.now(),
            from: state.opening,
            to: state.opening > 50 ? 0 : 100,
          };
      resume();
    },
    capture() {
      render();
      const image = document.createElement("canvas");
      image.width = 900;
      image.height = Math.max(
        1,
        Math.round((900 * canvas.height) / canvas.width),
      );
      image
        .getContext("2d")!
        .drawImage(canvas, 0, 0, image.width, image.height);
      return image.toDataURL("image/jpeg", 0.7);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", release);
      canvas.removeEventListener("pointercancel", release);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("keydown", key);
      scene.remove(model.group);
      model.dispose();
      const geometries = new Set<T.BufferGeometry>(),
        materials = new Set<T.Material>();
      scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          geometries.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            materials.add(m);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      env.dispose();
      sun.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
export type AwningSceneController = ReturnType<typeof createAwningScene>;
