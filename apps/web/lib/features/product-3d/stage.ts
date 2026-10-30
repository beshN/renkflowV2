import * as T from "three";
import { createOutdoorEnvironment } from "./environment";
import { createProductModel, type ProductModel } from "./model";
import { sameGeometry, productMeta, type VisualizationConfiguration } from "./catalog";
const CAMERA_FLOOR = 0.35; // the camera stays above the terrace
export type ProductView =
  "perspective" | "front" | "side" | "top" | "under" | "detail";
export async function createProductStage(
  canvas: HTMLCanvasElement,
  initial: VisualizationConfiguration,
  onOpening: (value: number) => void,
  onUnavailable: () => void,
) {
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(40, 1, 0.025, 100);
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const hemi = new T.HemisphereLight("#cfe3ff", "#8d8a72", 1.5),
    sun = new T.DirectionalLight("#fff3e0", 3.4),
    fill = new T.DirectionalLight("#d6e9ff", 0.55);
  sun.position.set(-4, 8, 6);
  const env = createOutdoorEnvironment(renderer, scene, sun.position);
  fill.position.set(5, 3, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -12,
    right: 12,
    top: 10,
    bottom: -10,
    near: 0.1,
    far: 35,
  });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(hemi, sun, fill);
  const leds: Array<T.SpotLight> = [];
  for (const x of [-1, 1]) {
    const l = new T.SpotLight("#ffd8a0", 0, 10, Math.PI * 0.42, 0.85, 1.6);
    scene.add(l, l.target);
    leds.push(l);
  }
  let c = initial,
    model: ProductModel | undefined,
    disposed = false,
    lost = false,
    visible = true,
    version = 0,
    time = 0,
    opening = 0;
  let theta = -0.7,
    phi = 1.1,
    distance = 10,
    target = new T.Vector3(),
    view: ProductView = "perspective",
    raf = 0,
    lastNotify = 0;
  let animation: { start: number; from: number; to: number } | null = null;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  /** The product is fixed to the building: the facade shows behind it. */
  const onFacade = () =>
    c.mounting === "wall" &&
    (productMeta(c.kind).category === "roof" || c.kind === "zip" || c.kind === "cassette");
  const dimensions = () => ({
    w: c.widthMm / 1000,
    h: c.heightMm / 1000,
    d: c.projectionMm / 1000,
    roof: productMeta(c.kind).category === "roof",
  });
  function render() {
    if (disposed || lost) return;
    camera.position.set(
      target.x + distance * Math.sin(phi) * Math.sin(theta),
      Math.max(CAMERA_FLOOR, target.y + distance * Math.cos(phi)),
      target.z + distance * Math.sin(phi) * Math.cos(theta),
    );
    camera.lookAt(target);
    renderer.render(scene, camera);
    if (process.env.NODE_ENV === "development")
      canvas.dataset.diagnostics = JSON.stringify({
        kind: c.kind,
        opening,
        view,
        memory: renderer.info.memory,
        render: renderer.info.render,
        parts: model?.group.userData,
      });
  }
  function selectView(next: ProductView) {
    view = next;
    const { w, h, d, roof } = dimensions(),
      depth = roof ? d : 0;
    target.set(0, h * 0.57, depth * 0.48);
    distance = Math.max(4, w * 1.55, h * 1.8, depth * 1.55);
    theta = -0.7;
    phi = 1.2;
    if (next === "front") {
      theta = 0;
      phi = 1.36;
    }
    if (next === "side") {
      theta = -Math.PI / 2;
      phi = 1.38;
    }
    if (next === "top") {
      theta = 0;
      phi = 0.07;
    }
    if (next === "under") {
      target.set(0, roof ? h - 0.15 : h * 0.55, depth * 0.4);
      phi = 2.03;
      theta = -0.3;
      distance = Math.max(3.2, w * 0.95, depth * 1.02);
    }
    if (next === "detail") {
      target.set(
        -w / 2 + 0.07,
        roof ? h - 0.04 : c.kind === "zip" ? h : h * 0.56,
        roof ? 0.25 : 0.04,
      );
      theta = -0.7;
      phi = 1.35;
      distance = Math.max(0.85, Math.min(1.7, h * 0.5));
    }
    distance *= Math.max(1, 1 / camera.aspect);
    render();
  }
  function setTime(value: number) {
    time = value;
    const night = (value / 100) ** 2;
    hemi.intensity = 1.5 * (1 - night) + 0.15;
    sun.intensity = 3.4 * (1 - night) + 0.07;
    fill.intensity = 0.55 * (1 - night) + 0.12;
    sun.color.set(value > 25 && value < 80 ? "#ffc78e" : "#fff3e0");
    sun.position.y = 9 - (value / 100) * 7;
    env.setNight(night, sun.position);
    scene.environmentIntensity = 1 - night * 0.7;
    const { w, h, d, roof } = dimensions();
    env.setWallVisible(onFacade());
    leds.forEach((l, i) => {
      l.color.set(c.led === "white" ? "#e4f2ff" : "#ffd8a0");
      l.intensity = roof && c.led !== "off" ? (c.brightness / 100) * 18 : 0;
      l.position.set((i ? 1 : -1) * w * 0.25, h - 0.15, roof ? d * 0.52 : 0.05);
      l.target.position.set(l.position.x, 0, l.position.z);
    });
    render();
  }
  function setOpening(value: number) {
    animation = null;
    opening = Math.max(0, Math.min(100, value));
    model?.update(opening);
    render();
  }
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (r.width && r.height) {
      renderer.setSize(r.width, r.height, false);
      const aspect = r.width / r.height;
      distance *= Math.max(1, 1 / aspect) / Math.max(1, 1 / camera.aspect);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      render();
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const pointers = new Map<number, [number, number]>();
  let pinch: number | null = null;
  const down = (e: PointerEvent) => {
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    const previous = pointers.get(e.pointerId);
    if (!previous) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()],
        p = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch && p)
        distance = Math.max(0.45, Math.min(45, (distance * pinch) / p));
      pinch = p;
    } else {
      theta -= (e.clientX - previous[0]) * 0.008;
      phi = Math.max(
        0.05,
        Math.min(2.15, phi - (e.clientY - previous[1]) * 0.006),
      );
    }
    render();
  };
  const release = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinch = null;
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    distance = Math.max(0.45, Math.min(45, distance + e.deltaY * 0.008));
    render();
  };
  function toggle() {
    if (productMeta(c.kind).motion === "none") return;
    if (animation) {
      animation = null;
      return;
    }
    const to = opening > 50 ? 0 : 100;
    if (reduced.matches) {
      setOpening(to);
      onOpening(to);
      return;
    }
    animation = { start: performance.now(), from: opening, to };
    resume();
  }
  const key = (e: KeyboardEvent) => {
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "-",
        "Home",
        "PageUp",
        "PageDown",
        " ",
      ].includes(e.key)
    )
      return;
    e.preventDefault();
    if (e.key === "Home") {
      selectView("perspective");
      return;
    }
    if (e.key === " ") {
      toggle();
      return;
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      if (productMeta(c.kind).motion !== "none") {
        setOpening(opening + (e.key === "PageUp" ? 5 : -5));
        onOpening(opening);
      }
      return;
    }
    if (e.key === "ArrowLeft") theta -= 0.1;
    if (e.key === "ArrowRight") theta += 0.1;
    if (e.key === "ArrowUp") phi = Math.max(0.05, phi - 0.1);
    if (e.key === "ArrowDown") phi = Math.min(2.15, phi + 0.1);
    if (e.key === "+") distance = Math.max(0.45, distance - 0.4);
    if (e.key === "-") distance = Math.min(45, distance + 0.4);
    render();
  };
  function frame(now: number) {
    if (disposed || lost || !visible || document.hidden) {
      raf = 0;
      return;
    }
    if (animation) {
      const duration = c.kind === "wind-piston" ? 1800 : 8000,
        t = Math.min(1, (now - animation.start) / duration),
        ease = t * t * (3 - 2 * t);
      opening = animation.from + (animation.to - animation.from) * ease;
      model?.update(opening);
      if (now - lastNotify > 100 || t === 1) {
        onOpening(opening);
        lastNotify = now;
      }
      if (t === 1) animation = null;
    }
    render();
    raf = animation ? requestAnimationFrame(frame) : 0;
  }
  function resume() {
    if (disposed || lost || !visible || document.hidden) return;
    if (animation)
      animation = { start: performance.now(), from: opening, to: animation.to };
    if (!raf) raf = requestAnimationFrame(frame);
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
  const contextLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    animation = null;
    cancelAnimationFrame(raf);
    onUnavailable();
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("keydown", key);
  canvas.addEventListener("webglcontextlost", contextLost);
  document.addEventListener("visibilitychange", visibility);
  function dispose() {
    if (disposed) return;
    disposed = true;
    version++;
    cancelAnimationFrame(raf);
    observer.disconnect();
    intersection.disconnect();
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", release);
    canvas.removeEventListener("pointercancel", release);
    canvas.removeEventListener("wheel", wheel);
    canvas.removeEventListener("keydown", key);
    canvas.removeEventListener("webglcontextlost", contextLost);
    document.removeEventListener("visibilitychange", visibility);
    model?.dispose();
    env.dispose();
    sun.shadow.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
  async function setConfiguration(next: VisualizationConfiguration) {
    if (disposed || lost) return;
    const request = ++version;
    if (model && sameGeometry(c, next)) {
      c = next;
      model.setAppearance(next);
      setTime(time);
      return;
    }
    const built = await createProductModel(next);
    if (disposed || request !== version) {
      built.dispose();
      return;
    }
    const sameProduct = c.kind === next.kind;
    const previous = dimensions();
    if (model) {
      scene.remove(model.group);
      model.dispose();
    }
    c = next;
    model = built;
    scene.add(model.group);
    model.update(opening);
    {
      const dims = dimensions();
      env.placeProps({ w: dims.w, d: dims.d, h: dims.h, roof: dims.roof, wall: onFacade() });
    }
    if (!sameProduct || request === 1) selectView(view);
    else {
      const current = dimensions();
      target.y += (current.h - previous.h) * 0.57;
      target.z += (current.roof ? current.d - previous.d : 0) * 0.48;
      // Keep the framing proportional to the product, both when it grows and when it shrinks.
      const fit = (d: typeof current) => Math.max(4, d.w * 1.55, d.h * 1.8, (d.roof ? d.d : 0) * 1.55);
      if (view !== "detail") distance *= fit(current) / fit(previous);
    }
    setTime(time);
    resize();
  }
  try {
    await setConfiguration(initial);
  } catch (e) {
    dispose();
    throw e;
  }
  return {
    setConfiguration,
    setOpening,
    setTime,
    selectView,
    toggleAnimation: toggle,
    dispose,
    capture() {
      render();
      const out = document.createElement("canvas");
      out.width = 900;
      out.height = Math.round((900 * canvas.height) / canvas.width);
      out.getContext("2d")!.drawImage(canvas, 0, 0, out.width, out.height);
      return out.toDataURL("image/jpeg", 0.75);
    },
    inspect() {
      return {
        product: c.kind,
        opening,
        parts: model?.group.userData,
        memory: { ...renderer.info.memory },
        render: { ...renderer.info.render },
      };
    },
  };
}
export type ProductStage = Awaited<ReturnType<typeof createProductStage>>;
