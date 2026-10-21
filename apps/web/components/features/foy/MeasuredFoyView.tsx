"use client";
import { useEffect, useRef, useState } from "react";
import type { FoySystem } from "@/lib/features/foy/types";
import { FoySchema } from "./FoySchema";

/** Measured envelope only: no default height, section width, rail offset or mechanism capacity. */
function MeasuredEnvelope({
  widthMm,
  spanMm,
  vertical = false,
}: {
  widthMm: number;
  spanMm: number;
  vertical?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [active, setActive] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!active || !canvas.current) return;
    let cancelled = false,
      dispose = () => {};
    void Promise.all([
      import("three"),
      import("three/examples/jsm/controls/OrbitControls.js"),
    ])
      .then(([T, { OrbitControls }]) => {
        if (cancelled || !canvas.current) return;
        const element = canvas.current,
          renderer = new T.WebGLRenderer({
            canvas: element,
            antialias: true,
            alpha: true,
          });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        const scene = new T.Scene(),
          camera = new T.PerspectiveCamera(45, 1, 0.01, 1000),
          w = widthMm / 1000,
          p = spanMm / 1000,
          max = Math.max(w, p);
        const target = vertical
          ? new T.Vector3(w / 2, p / 2, 0)
          : new T.Vector3(w / 2, 0, p / 2);
        const control = new OrbitControls(camera, element);
        control.target.copy(target);
        control.enableDamping = false;
        control.enablePan = false;
        control.minDistance = max * 0.3;
        control.maxDistance = max * 10;
        const points = [
          [0, 0],
          [w, 0],
          [w, p],
          [0, p],
          [0, 0],
        ].map(([x, y]) =>
          vertical ? new T.Vector3(x, y, 0) : new T.Vector3(x, 0, y),
        );
        const geometry = new T.BufferGeometry().setFromPoints(points),
          material = new T.LineBasicMaterial({ color: 0x5599bb });
        scene.add(new T.Line(geometry, material));
        const labels: Array<{
          texture: InstanceType<typeof T.CanvasTexture>;
          material: InstanceType<typeof T.SpriteMaterial>;
        }> = [];
        const label = (
          text: string,
          position: InstanceType<typeof T.Vector3>,
        ) => {
          const board = document.createElement("canvas");
          board.width = 384;
          board.height = 96;
          const ctx = board.getContext("2d");
          if (!ctx) return;
          ctx.fillStyle = "#f6f7f5";
          ctx.fillRect(0, 0, 384, 96);
          ctx.fillStyle = "#193b4b";
          ctx.font = "600 40px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, 192, 48);
          const texture = new T.CanvasTexture(board),
            material = new T.SpriteMaterial({ map: texture, depthTest: false }),
            sprite = new T.Sprite(material);
          sprite.position.copy(position);
          sprite.scale.set(max * 0.65, max * 0.1625, 1);
          scene.add(sprite);
          labels.push({ texture, material });
        };
        label(
          `En ${widthMm} mm`,
          vertical
            ? new T.Vector3(w / 2, p + max * 0.12, 0)
            : new T.Vector3(w / 2, max * 0.08, -max * 0.12),
        );
        label(
          `${vertical ? "Yükseklik" : "Açılım"} ${spanMm} mm`,
          vertical
            ? new T.Vector3(w + max * 0.2, p / 2, 0)
            : new T.Vector3(w + max * 0.2, max * 0.08, p / 2),
        );
        const draw = () => renderer.render(scene, camera);
        control.addEventListener("change", draw);
        const resize = new ResizeObserver(() => {
          const rect = element.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          renderer.setSize(rect.width, rect.height, false);
          camera.aspect = rect.width / rect.height;
          camera.updateProjectionMatrix();
          const distance =
            Math.max(w + max * 0.8, p + max * 0.5) /
            (2 * Math.tan(Math.PI / 8) * Math.min(1, camera.aspect));
          camera.position
            .copy(target)
            .add(
              (vertical
                ? new T.Vector3(0.15, 0.1, 1)
                : new T.Vector3(0, 1, 1.1)
              )
                .normalize()
                .multiplyScalar(distance),
            );
          camera.lookAt(target);
          draw();
        });
        resize.observe(element);
        const lost = (e: Event) => {
          e.preventDefault();
          setError(
            "3D bağlantısı kesildi. Ölçülü çizim ve üretim bilgileri kullanılabilir.",
          );
        };
        element.addEventListener("webglcontextlost", lost);
        dispose = () => {
          element.removeEventListener("webglcontextlost", lost);
          resize.disconnect();
          control.dispose();
          geometry.dispose();
          material.dispose();
          labels.forEach((l) => {
            l.texture.dispose();
            l.material.dispose();
          });
          renderer.dispose();
        };
      })
      .catch(() => {
        if (!cancelled)
          setError("Bu cihazda 3D açılamadı. Ölçülü çizim kullanılabilir.");
      });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [active, widthMm, spanMm, vertical]);
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="rf-secondary-button"
        onClick={() => {
          setActive((v) => !v);
          setError("");
        }}
      >
        {active ? "3D görünümü kapat" : "3D görünümü aç"}
      </button>
      {active && (
        <>
          <canvas
            ref={canvas}
            className="h-64 w-full touch-none rounded bg-muted/30"
            aria-label="Gerçek ölçülerle döndürülebilir görünüm"
          />
          <p className="text-xs text-muted-foreground">
            Parmağınızla döndürün; iki parmakla yakınlaştırın. Doğrulanmamış
            kesit ve bağlantı ayrıntıları gösterilmez.
          </p>
        </>
      )}
      {error && (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
          {error}
        </p>
      )}
    </div>
  );
}
export function MeasuredFoyView({
  system,
  index,
  total,
}: {
  system: FoySystem;
  index: number;
  total: number;
}) {
  const width = system.railOuter,
    projection = system.projection;
  return (
    <section className="min-w-0 space-y-2 rounded-lg border border-border p-3">
      <p className="font-medium">
        {total > 1 ? `${index + 1}. ürün · ` : ""}
        {width == null ? "En bilinmiyor" : `${width * 10} mm`} ×{" "}
        {projection == null ? "Açılım bilinmiyor" : `${projection * 10} mm`}
      </p>
      {width && projection ? (
        <MeasuredEnvelope widthMm={width * 10} spanMm={projection * 10} />
      ) : null}
      <FoySchema system={system} index={index} total={total} />
    </section>
  );
}
export function MeasuredVerticalView({
  widthMm,
  heightMm,
  index,
  total,
}: {
  widthMm: number | null;
  heightMm: number | null;
  index: number;
  total: number;
}) {
  const scale =
    widthMm && heightMm ? Math.min(260 / widthMm, 180 / heightMm) : 0;
  return (
    <section className="min-w-0 space-y-3 rounded-lg border border-border p-3">
      <p className="font-medium">
        {total > 1 ? `${index + 1}. ürün · ` : ""}
        {widthMm == null ? "En bilinmiyor" : `${widthMm} mm`} ×{" "}
        {heightMm == null ? "Yükseklik bilinmiyor" : `${heightMm} mm`}
      </p>
      {widthMm && heightMm ? (
        <>
          <MeasuredEnvelope widthMm={widthMm} spanMm={heightMm} vertical />
          <svg
            viewBox="0 0 420 280"
            role="img"
            className="w-full"
            aria-label={`Ön görünüm: en ${widthMm} mm, ürün yüksekliği ${heightMm} mm`}
          >
            <rect
              x={80}
              y={40}
              width={widthMm * scale}
              height={heightMm * scale}
              fill="none"
              stroke="currentColor"
            />
            <text x={80} y={250} fontSize={14} fill="currentColor">
              En {widthMm} mm · Yükseklik {heightMm} mm
            </text>
          </svg>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ölçüler doğrulanmadan çizim tamamlanmaz.
        </p>
      )}
    </section>
  );
}
