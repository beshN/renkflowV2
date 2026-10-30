import * as T from "three";

/**
 * The outdoor setting the 3D products stand in: sky, a paved terrace on a lawn, a plastered facade
 * (when the product mounts to a wall), garden backdrop, and a little furniture for scale. Shared by the
 * product stage and the WINMAX awning scene so every product is shown in the same light, and its glass
 * and metal reflect a real sky instead of an empty studio.
 */
const SKY = {
  day: { zenith: "#4c84c4", mid: "#8dbbe6", horizon: "#e4edf2" },
  night: { zenith: "#08111f", mid: "#16263c", horizon: "#33445c" },
};

const seeded = (seed: number) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void, repeat: [number, number], srgb = true) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d")!, size);
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Four by four stone pavers per tile (0.6 m each), every one slightly different, with grout between. */
function paverTile(ctx: CanvasRenderingContext2D, size: number, bump: boolean) {
  const rand = seeded(7),
    n = 4,
    cell = size / n,
    grout = 7;
  ctx.fillStyle = bump ? "#000" : "#5e5b55";
  ctx.fillRect(0, 0, size, size);
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++) {
      const x = col * cell + grout / 2,
        y = row * cell + grout / 2,
        s = cell - grout,
        light = rand();
      if (bump) {
        ctx.fillStyle = `rgb(${170 + light * 40},${170 + light * 40},${170 + light * 40})`;
      } else {
        const l = 48 + light * 9,
          hue = 30 + rand() * 10;
        ctx.fillStyle = `hsl(${hue} 9% ${l}%)`;
      }
      ctx.beginPath();
      ctx.roundRect(x, y, s, s, 5);
      ctx.fill();
      if (!bump) {
        const g = ctx.createLinearGradient(x, y, x + s, y + s);
        g.addColorStop(0, "rgba(255,255,255,0.04)");
        g.addColorStop(1, "rgba(0,0,0,0.09)");
        ctx.fillStyle = g;
        ctx.fill();
      }
      for (let i = 0; i < 900; i++) {
        const a = 0.05 + rand() * 0.12,
          dark = rand() > 0.5;
        ctx.fillStyle = bump ? `rgba(${dark ? 0 : 255},${dark ? 0 : 255},${dark ? 0 : 255},${a})` : `rgba(${dark ? "40,38,34" : "255,252,245"},${a})`;
        ctx.fillRect(x + rand() * s, y + rand() * s, 1 + rand() * 2, 1 + rand() * 2);
      }
    }
}

function lawnTile(ctx: CanvasRenderingContext2D, size: number) {
  const rand = seeded(11);
  ctx.fillStyle = "#4b6330";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `hsla(${78 + rand() * 24} ${22 + rand() * 12}% ${24 + rand() * 12}% / 0.26)`;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 12 + rand() * 46, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 9000; i++) {
    ctx.strokeStyle = `hsla(${76 + rand() * 30} ${24 + rand() * 18}% ${18 + rand() * 24}% / 0.6)`;
    ctx.lineWidth = 1;
    const x = rand() * size,
      y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 3, y - 2 - rand() * 5);
    ctx.stroke();
  }
}

/** Dense leaf clusters: the texture of hedges, tree crowns and shrubs. */
function foliageTile(ctx: CanvasRenderingContext2D, size: number) {
  const rand = seeded(31);
  ctx.fillStyle = "#2f4a24";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `hsla(${86 + rand() * 30} ${26 + rand() * 22}% ${16 + rand() * 30}% / ${0.5 + rand() * 0.45})`;
    ctx.beginPath();
    ctx.ellipse(rand() * size, rand() * size, 2 + rand() * 6, 1.5 + rand() * 3.5, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function plasterTile(ctx: CanvasRenderingContext2D, size: number) {
  const rand = seeded(23);
  ctx.fillStyle = "#e8e4db";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 5000; i++) {
    const dark = rand() > 0.5;
    ctx.fillStyle = `rgba(${dark ? "120,112,98" : "255,255,250"},${0.03 + rand() * 0.07})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 3, 1 + rand() * 3);
  }
  for (let i = 0; i < 26; i++) {
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, "rgba(90,82,70,0)");
    g.addColorStop(1, `rgba(90,82,70,${0.025 + rand() * 0.04})`);
    ctx.fillStyle = g;
    ctx.fillRect(rand() * size, 0, 2 + rand() * 6, size);
  }
}

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 zenith; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; uniform float night;
  varying vec3 vDir;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, 0.0, 1.0);
    vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
    col = mix(col, zenith, smoothstep(0.18, 0.85, h));
    // Below the horizon the sky continues as haze, so the lawn's far edge dissolves into it.
    col = mix(col, horizon, step(dir.y, 0.0));
    float sun = max(dot(dir, normalize(sunDir)), 0.0);
    vec3 sunCol = mix(vec3(1.0, 0.93, 0.80), vec3(1.0, 0.62, 0.35), night);
    col += sunCol * (pow(sun, 8.0) * 0.18 + pow(sun, 96.0) * 0.55 + smoothstep(0.9993, 0.9998, sun) * 40.0) * (1.0 - night * 0.9);
    if (dir.y > 0.02) {
      vec2 uv = dir.xz / (dir.y + 0.28) * 1.3 + vec2(3.7, 1.9);
      float cloud = smoothstep(0.52, 0.86, fbm(uv));
      cloud *= smoothstep(0.02, 0.3, dir.y);
      vec3 cloudCol = mix(vec3(1.0), vec3(0.18, 0.21, 0.28), night) ;
      col = mix(col, cloudCol, cloud * 0.72);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function skyMaterial(sunDir: T.Vector3) {
  return new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new T.Color(SKY.day.zenith) },
      mid: { value: new T.Color(SKY.day.mid) },
      horizon: { value: new T.Color(SKY.day.horizon) },
      sunDir: { value: sunDir.clone().normalize() },
      night: { value: 0 },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
  });
}

export type SceneDims = {
  /** Width, depth (projection) and height in metres. */
  w: number;
  d: number;
  h: number;
  /** Roofs and awnings are walked under; facades (screens, glass walls) are walked past. */
  roof: boolean;
  /** The product is fixed to the facade. */
  wall: boolean;
};

export function createOutdoorEnvironment(renderer: T.WebGLRenderer, scene: T.Scene, sunPosition: T.Vector3) {
  const disposables: Array<{ dispose(): void }> = [];
  const own = <X extends { dispose(): void }>(x: X) => (disposables.push(x), x);
  const sunDir = sunPosition.clone().normalize();

  // Sky dome and the reflection environment built from the same sky.
  const sky = new T.Mesh(own(new T.SphereGeometry(85, 48, 24)), own(skyMaterial(sunDir)));
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);
  const pmrem = own(new T.PMREMGenerator(renderer));
  const envScene = new T.Scene();
  const envSky = new T.Mesh(new T.SphereGeometry(60, 48, 24), skyMaterial(sunDir));
  const envGround = new T.Mesh(new T.CircleGeometry(80, 48), new T.MeshBasicMaterial({ color: "#8f8c82" }));
  envGround.rotation.x = -Math.PI / 2;
  envGround.position.y = -0.05;
  envScene.add(envSky, envGround);
  const environment = own(pmrem.fromScene(envScene, 0.02));
  envSky.geometry.dispose();
  (envSky.material as T.Material).dispose();
  envGround.geometry.dispose();
  (envGround.material as T.Material).dispose();
  scene.environment = environment.texture;
  scene.background = new T.Color(SKY.day.horizon);
  scene.fog = new T.Fog(SKY.day.horizon, 32, 95);

  // Terrace of stone pavers on a lawn.
  const paverMap = own(canvasTexture(1024, (c, s) => paverTile(c, s, false), [11, 9]));
  const paverBump = own(canvasTexture(1024, (c, s) => paverTile(c, s, true), [11, 9], false));
  const terrace = new T.Mesh(
    own(new T.PlaneGeometry(26.4, 21.6)),
    own(new T.MeshStandardMaterial({ map: paverMap, bumpMap: paverBump, bumpScale: 1.2, roughness: 0.88, metalness: 0 })),
  );
  terrace.rotation.x = -Math.PI / 2;
  terrace.position.set(0, 0.002, 6.8);
  terrace.receiveShadow = true;
  const kerb = new T.Mesh(own(new T.BoxGeometry(26.6, 0.16, 21.8)), own(new T.MeshStandardMaterial({ color: "#b9b5ab", roughness: 0.9 })));
  kerb.position.set(0, -0.08, 6.8);
  kerb.receiveShadow = true;
  const lawnMap = own(canvasTexture(512, lawnTile, [70, 70]));
  const lawn = new T.Mesh(own(new T.PlaneGeometry(260, 260)), own(new T.MeshStandardMaterial({ map: lawnMap, roughness: 1 })));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = -0.16;
  lawn.receiveShadow = true;
  scene.add(lawn, kerb, terrace);

  // Plastered facade with windows; shown only when the product is fixed to a wall.
  const wall = new T.Group();
  const plasterMap = own(canvasTexture(512, plasterTile, [7, 2]));
  const facade = new T.Mesh(own(new T.BoxGeometry(22, 7, 0.24)), own(new T.MeshStandardMaterial({ map: plasterMap, roughness: 0.95 })));
  facade.position.set(0, 3.5, -0.24);
  facade.receiveShadow = true;
  const skirting = new T.Mesh(own(new T.BoxGeometry(22, 0.22, 0.05)), own(new T.MeshStandardMaterial({ color: "#7d7a73", roughness: 0.9 })));
  skirting.position.set(0, 0.11, -0.095);
  skirting.receiveShadow = true;
  wall.add(facade, skirting);
  const frameMat = own(new T.MeshStandardMaterial({ color: "#2e3338", roughness: 0.5, metalness: 0.5 }));
  const glassMat = own(new T.MeshPhysicalMaterial({ color: "#26313b", roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, emissive: "#ffcf8a", emissiveIntensity: 0 }));
  const windowGeo = own(new T.BoxGeometry(1.5, 1.45, 0.05)),
    paneGeo = own(new T.BoxGeometry(1.38, 1.33, 0.02)),
    barGeo = own(new T.BoxGeometry(0.04, 1.4, 0.06));
  for (const x of [-8.6, -5.8, 5.8, 8.6]) {
    const casing = new T.Mesh(windowGeo, frameMat);
    casing.position.set(x, 1.5, -0.1);
    const pane = new T.Mesh(paneGeo, glassMat);
    pane.position.set(x, 1.5, -0.08);
    const bar = new T.Mesh(barGeo, frameMat);
    bar.position.set(x, 1.5, -0.07);
    for (const m of [casing, pane, bar]) m.castShadow = true;
    wall.add(casing, pane, bar);
  }
  scene.add(wall);

  // Garden backdrop for free-standing products: a hedge and a few trees, softened by the haze.
  const backdrop = new T.Group();
  const leafMap = own(canvasTexture(512, foliageTile, [3, 3]));
  const hedgeMap = own(canvasTexture(512, foliageTile, [18, 1.4]));
  const hedgeBump = own(canvasTexture(512, foliageTile, [18, 1.4], false));
  const hedge = new T.Mesh(
    own(new T.BoxGeometry(34, 1.7, 1.1)),
    own(new T.MeshStandardMaterial({ map: hedgeMap, bumpMap: hedgeBump, bumpScale: 6, roughness: 1 })),
  );
  hedge.position.set(0, 0.85, -6.5);
  hedge.castShadow = hedge.receiveShadow = true;
  backdrop.add(hedge);
  const trunkGeo = own(new T.CylinderGeometry(0.16, 0.25, 1, 10)),
    clumpGeo = own(new T.IcosahedronGeometry(1, 2)),
    trunkMat = own(new T.MeshStandardMaterial({ color: "#54402f", roughness: 1 })),
    leafMat = own(new T.MeshStandardMaterial({ map: leafMap, bumpMap: leafMap, bumpScale: 4, roughness: 1 }));
  const rand = seeded(5);
  const tint = new T.Color();
  for (const [x, z, s] of [
    [-11, -10, 1.15],
    [-5, -14, 1.4],
    [4, -12, 1.0],
    [10, -9, 1.25],
    [16, -14, 1.5],
    [-17, -8, 1.0],
  ] as const) {
    const tree = new T.Group();
    const trunk = new T.Mesh(trunkGeo, trunkMat);
    trunk.scale.set(s, 4.6 * s, s);
    trunk.position.y = 2.3 * s;
    trunk.castShadow = true;
    tree.add(trunk);
    // The crown is a cloud of overlapping leaf clumps, each a slightly different green.
    const clumps = new T.InstancedMesh(clumpGeo, leafMat, 26),
      m = new T.Matrix4(),
      q = new T.Quaternion();
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2,
        r = Math.sqrt(rand()) * 2.5 * s,
        size = (0.8 + rand() * 0.9) * s;
      m.compose(
        new T.Vector3(Math.cos(a) * r, (5.6 + rand() * 2.8 - (r / s) * 0.25) * s, Math.sin(a) * r),
        q.setFromEuler(new T.Euler(rand() * 3, rand() * 3, rand() * 3)),
        new T.Vector3(size, size * 0.82, size),
      );
      clumps.setMatrixAt(i, m);
      clumps.setColorAt(i, tint.setHSL(0.24 + rand() * 0.06, 0.34 + rand() * 0.12, 0.34 + rand() * 0.14));
    }
    clumps.castShadow = true;
    clumps.receiveShadow = true;
    tree.add(clumps);
    tree.position.set(x, 0, z);
    backdrop.add(tree);
  }
  scene.add(backdrop);

  // Furniture: gives the eye a scale and puts the product in use.
  const props = new T.Group();
  const wood = own(new T.MeshStandardMaterial({ color: "#8d6c49", roughness: 0.58 })),
    darkWood = own(new T.MeshStandardMaterial({ color: "#5e4430", roughness: 0.6 })),
    frame = own(new T.MeshStandardMaterial({ color: "#26292d", roughness: 0.42, metalness: 0.65 })),
    cushion = own(new T.MeshStandardMaterial({ color: "#c9c2b2", roughness: 0.95 })),
    pot = own(new T.MeshStandardMaterial({ color: "#2f3338", roughness: 0.55, metalness: 0.4 })),
    shrub = leafMat;
  const geo = {
    top: own(new T.CylinderGeometry(0.46, 0.46, 0.03, 40)),
    foot: own(new T.CylinderGeometry(0.03, 0.03, 0.72, 12)),
    base: own(new T.CylinderGeometry(0.22, 0.24, 0.025, 24)),
    seat: own(new T.BoxGeometry(0.44, 0.04, 0.44)),
    pad: own(new T.BoxGeometry(0.4, 0.04, 0.4)),
    leg: own(new T.CylinderGeometry(0.013, 0.013, 0.45, 8)),
    back: own(new T.BoxGeometry(0.44, 0.34, 0.03)),
    planter: own(new T.BoxGeometry(0.5, 0.62, 0.5)),
    clump: clumpGeo,
  };
  const add = (parent: T.Object3D, g: T.BufferGeometry, m: T.Material, x: number, y: number, z: number, shadow = true) => {
    const mesh = new T.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const tableSet = (x: number, z: number, turn: number, chairs = 4) => {
    const set = new T.Group();
    set.position.set(x, 0, z);
    add(set, geo.top, wood, 0, 0.75, 0);
    add(set, geo.foot, frame, 0, 0.375, 0);
    add(set, geo.base, frame, 0, 0.013, 0);
    for (let i = 0; i < chairs; i++) {
      const a = turn + (i / chairs) * Math.PI * 2,
        chair = new T.Group();
      chair.position.set(Math.sin(a) * 0.78, 0, Math.cos(a) * 0.78);
      chair.rotation.y = a + Math.PI;
      add(chair, geo.seat, frame, 0, 0.45, 0);
      add(chair, geo.pad, cushion, 0, 0.485, 0);
      add(chair, geo.back, darkWood, 0, 0.66, -0.2);
      for (const dx of [-0.18, 0.18])
        for (const dz of [-0.18, 0.18]) add(chair, geo.leg, frame, dx, 0.225, dz);
      set.add(chair);
    }
    props.add(set);
  };
  const planter = (x: number, z: number, scale = 1) => {
    const group = new T.Group();
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    add(group, geo.planter, pot, 0, 0.31, 0);
    // A shrub: a small dome of leaf clumps.
    const r = seeded(Math.round(x * 31 + z * 17 + 3));
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2,
        rad = r() * 0.2,
        size = 0.13 + r() * 0.11,
        clump = add(group, geo.clump, shrub, Math.cos(a) * rad, 0.76 + r() * 0.3 - rad * 0.8, Math.sin(a) * rad);
      clump.scale.setScalar(size);
      clump.rotation.set(r() * 3, r() * 3, 0);
    }
    props.add(group);
  };
  scene.add(props);

  function placeProps({ w, d, roof, wall: mounted }: SceneDims) {
    for (const child of [...props.children]) props.remove(child);
    if (roof) {
      // Under the roof: as many table sets as fit, with a planter at the open front corners.
      const cols = Math.max(1, Math.min(4, Math.floor((w - 1) / 2.4))),
        rows = Math.max(1, Math.min(3, Math.floor((d - 0.6) / 2.4)));
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const x = (c - (cols - 1) / 2) * 2.4,
            z = Math.min(d - 1.1, 1.2 + r * 2.4 + (rows === 1 ? Math.max(0, (d - 2.4) / 2 - 0.6) : 0));
          tableSet(x, z, 0.4 + (r + c) * 0.9);
        }
      for (const x of [-w / 2 - 0.45, w / 2 + 0.45]) planter(x, d + 0.3, 1);
    } else {
      // Facades: tables behind the glass or screen, so what the glass shows (and keeps out) is visible.
      const side = mounted ? 1 : -1,
        z = side * 1.7,
        count = Math.max(1, Math.min(3, Math.floor(w / 2.2)));
      for (let c = 0; c < count; c++) tableSet((c - (count - 1) / 2) * 2.2, z, 0.8 + c, 4);
      planter(-w / 2 - 0.6, side * 0.55, 1);
      planter(w / 2 + 0.6, side * 0.55, 1);
    }
  }

  function setWallVisible(visible: boolean) {
    wall.visible = visible;
    backdrop.visible = !visible;
  }

  /** `night` 0 (day) to 1 (dusk); the sun position drives the glow in the sky. */
  function setNight(night: number, sun: T.Vector3) {
    const mat = sky.material as T.ShaderMaterial,
      u = mat.uniforms;
    u.zenith.value.set(SKY.day.zenith).lerp(new T.Color(SKY.night.zenith), night);
    u.mid.value.set(SKY.day.mid).lerp(new T.Color(SKY.night.mid), night);
    u.horizon.value.set(SKY.day.horizon).lerp(new T.Color(SKY.night.horizon), night);
    u.night.value = night;
    u.sunDir.value.copy(sun).normalize();
    (scene.background as T.Color).copy(u.horizon.value);
    scene.fog!.color.copy(u.horizon.value);
    glassMat.emissiveIntensity = night * 0.9;
  }

  function dispose() {
    for (const child of [...props.children]) props.remove(child);
    disposables.forEach((d) => d.dispose());
    scene.remove(sky, lawn, kerb, terrace, wall, backdrop, props);
  }

  return { wall, setWallVisible, setNight, placeProps, dispose, environment };
}
export type OutdoorEnvironment = ReturnType<typeof createOutdoorEnvironment>;
