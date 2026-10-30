import * as T from "three";
import type { VisualizationConfiguration } from "./catalog";
export type Point = [number, number];
const Y = new T.Vector3(0, 1, 0);
export class Parts {
  readonly group = new T.Group();
  readonly metal: T.MeshPhysicalMaterial;
  readonly steel: T.MeshStandardMaterial;
  readonly rubber: T.MeshStandardMaterial;
  readonly fabric: T.MeshPhysicalMaterial;
  readonly glass: T.MeshPhysicalMaterial;
  readonly glassEdge: T.MeshPhysicalMaterial;
  readonly led: T.MeshStandardMaterial;
  readonly textures: T.Texture[] = [];
  readonly geometries = new Set<T.BufferGeometry>();
  readonly materials = new Set<T.Material>();
  readonly instances = new Set<T.InstancedMesh>();
  private bolts: T.Group[] = [];
  private boltInstances: Array<{ mesh: T.InstancedMesh; offset: T.Matrix4 }> =
    [];
  private cache = new Map<string, T.BufferGeometry>();
  constructor(readonly config: VisualizationConfiguration) {
    // Satin powder coat on aluminium: it reflects the sky softly instead of shining like plastic.
    this.metal = new T.MeshPhysicalMaterial({ color: config.bodyColor, metalness: 0.55, roughness: 0.4, clearcoat: 0.12, clearcoatRoughness: 0.5, envMapIntensity: 1.1 });
    this.materials.add(this.metal);
    this.steel = this.material("#c8c9c7", { metalness: 0.8, roughness: 0.23 });
    this.rubber = this.material("#252b2a", { roughness: 0.88 });
    const weave = new Uint8Array(64 * 64 * 4),
      alpha = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const k = (y * 64 + x) * 4,
          v = x % 8 < 4 === y % 8 < 4 ? 190 : 240;
        weave.set([v, v, v, 255], k);
        const a = x % 8 < 2 || y % 8 < 2 ? 255 : 0;
        alpha.set([a, a, a, 255], k);
      }
    const texture = (data: Uint8Array<ArrayBuffer>) => {
      const t = new T.DataTexture(data, 64, 64);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set((config.widthMm / 1000) * 26, (config.heightMm / 1000) * 26);
      // Mipmapped, so the fine weave averages out at a distance instead of shimmering (moiré).
      t.generateMipmaps = true;
      t.minFilter = T.LinearMipmapLinearFilter;
      t.magFilter = T.LinearFilter;
      t.anisotropy = 8;
      t.needsUpdate = true;
      this.textures.push(t);
      return t;
    };
    this.fabric = new T.MeshPhysicalMaterial({
      color: config.fabricColor,
      roughness: 0.92,
      side: T.DoubleSide,
      bumpMap: texture(weave),
      bumpScale: 0.0009,
      // Cloth scatters light at grazing angles: a soft rim instead of a hard plastic highlight.
      sheen: 0.9,
      sheenRoughness: 0.55,
      sheenColor: new T.Color(config.fabricColor).lerp(new T.Color("#ffffff"), 0.5),
      envMapIntensity: 0.8,
      ...(config.kind === "zip" && config.screen === "screen" ? { alphaMap: texture(alpha), alphaTest: 0.4 } : {}),
    });
    this.materials.add(this.fabric);
    // Clear float glass: sharp reflections of the sky and a faint green edge, nothing milky.
    this.glass = new T.MeshPhysicalMaterial({
      color: "#e9f4f1",
      metalness: 0,
      roughness: 0.015,
      transmission: 0.96,
      thickness: 0.012,
      ior: 1.52,
      attenuationColor: new T.Color("#bfe0d6"),
      attenuationDistance: 0.5,
      specularIntensity: 1,
      envMapIntensity: 1.5,
      side: T.FrontSide,
    });
    this.materials.add(this.glass);
    this.glassEdge = new T.MeshPhysicalMaterial({
      color: "#7fb09b",
      roughness: 0.12,
      transmission: 0.55,
      thickness: 0.012,
      ior: 1.52,
    });
    this.materials.add(this.glassEdge);
    const color = config.led === "white" ? "#e4f2ff" : "#ffd8a0";
    this.led = this.material(config.led === "off" ? "#dddcd1" : color, {
      emissive: color,
      emissiveIntensity:
        config.led === "off" ? 0 : (config.brightness / 100) * 3.5,
      roughness: 0.28,
    });
  }
  material(color: string, extra: T.MeshStandardMaterialParameters = {}) {
    const m = new T.MeshStandardMaterial({ color, roughness: 0.55, ...extra });
    this.materials.add(m);
    return m;
  }
  setAppearance(config: VisualizationConfiguration) {
    this.metal.color.set(config.bodyColor);
    this.fabric.color.set(config.fabricColor);
    this.fabric.sheenColor.set(config.fabricColor).lerp(new T.Color("#ffffff"), 0.5);
    const light = config.led === 'white' ? '#e4f2ff' : '#ffd8a0';
    this.led.color.set(config.led === 'off' ? '#dddcd1' : light);
    this.led.emissive.set(light);
    this.led.emissiveIntensity = config.led === 'off' ? 0 : config.brightness / 100 * 3.5;
  }
  mesh(
    geometry: T.BufferGeometry,
    material: T.Material = this.metal,
    parent: T.Object3D = this.group,
  ) {
    this.geometries.add(geometry);
    const m = new T.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  geometry(key: string, create: () => T.BufferGeometry) {
    let g = this.cache.get(key);
    if (!g) {
      g = create();
      this.cache.set(key, g);
      this.geometries.add(g);
    }
    return g;
  }
  box(
    size: [number, number, number],
    position: [number, number, number],
    material: T.Material = this.metal,
    parent: T.Object3D = this.group,
  ) {
    const m = this.mesh(
      this.geometry("box", () => new T.BoxGeometry(1, 1, 1)),
      material,
      parent,
    );
    m.scale.set(...size);
    m.position.set(...position);
    return m;
  }
  boxes(
    size: [number, number, number],
    positions: Array<[number, number, number]>,
    material: T.Material = this.metal,
  ) {
    const mesh = new T.InstancedMesh(
        this.geometry("box", () => new T.BoxGeometry(1, 1, 1)),
        material,
        positions.length,
      ),
      object = new T.Object3D();
    object.scale.set(...size);
    positions.forEach((position, index) => {
      object.position.set(...position);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.instances.add(mesh);
    this.group.add(mesh);
    return mesh;
  }
  cylinder(
    radius: number,
    length: number,
    position: [number, number, number],
    material: T.Material = this.steel,
    axis: "x" | "y" | "z" = "y",
    parent: T.Object3D = this.group,
  ) {
    const m = this.mesh(
      this.geometry(
        `cyl-${radius}-${length}`,
        () => new T.CylinderGeometry(radius, radius, length, 24),
      ),
      material,
      parent,
    );
    m.position.set(...position);
    if (axis === "x") m.rotation.z = Math.PI / 2;
    if (axis === "z") m.rotation.x = Math.PI / 2;
    return m;
  }
  bolt(
    position: [number, number, number],
    axis: "x" | "y" | "z" = "y",
    parent: T.Object3D = this.group,
  ) {
    const g = new T.Group();
    g.position.set(...position);
    if (axis === "x") g.rotation.z = -Math.PI / 2;
    if (axis === "z") g.rotation.x = Math.PI / 2;
    parent.add(g);
    this.bolts.push(g);
    return g;
  }
  /** Preserve every washer, hex head and moving pin, sharing three GPU draws. */
  syncFasteners() {
    if (!this.bolts.length) return;
    if (!this.boltInstances.length) {
      for (const [key, radius, height, sides, y] of [
        ["washer", 0.012, 0.002, 24, 0],
        ["hex", 0.008, 0.007, 6, 0.005],
        ["shaft", 0.005, 0.025, 24, -0.012],
      ] as const) {
        const mesh = new T.InstancedMesh(
          this.geometry(
            key,
            () => new T.CylinderGeometry(radius, radius, height, sides),
          ),
          this.steel,
          this.bolts.length,
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.instances.add(mesh);
        this.boltInstances.push({
          mesh,
          offset: new T.Matrix4().makeTranslation(0, y, 0),
        });
      }
    }
    this.group.updateMatrixWorld(true);
    const inverse = new T.Matrix4().copy(this.group.matrixWorld).invert(),
      matrix = new T.Matrix4();
    for (const { mesh, offset } of this.boltInstances) {
      this.bolts.forEach((bolt, index) => {
        matrix.copy(inverse).multiply(bolt.matrixWorld).multiply(offset);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    }
  }
  /** A measured section is extruded without filling its internal cavities. Coordinates in metres. */
  profile(
    points: Point[],
    holes: Point[][],
    length: number,
    position: [number, number, number],
    axis: "x" | "y" | "z",
    parent: T.Object3D = this.group,
  ) {
    const key = JSON.stringify([points, holes, length]);
    const geo = this.geometry(key, () => {
      const shape = new T.Shape(points.map((p) => new T.Vector2(...p)));
      for (const h of holes)
        shape.holes.push(new T.Path(h.map((p) => new T.Vector2(...p))));
      return new T.ExtrudeGeometry(shape, {
        depth: length,
        bevelEnabled: false,
        curveSegments: 8,
        steps: 1,
      });
    });
    const m = this.mesh(geo, this.metal, parent);
    m.position.set(...position);
    if (axis === "x") m.rotation.y = Math.PI / 2;
    if (axis === "y") m.rotation.x = -Math.PI / 2;
    return m;
  }
  tube(
    width: number,
    height: number,
    wall: number,
    length: number,
    position: [number, number, number],
    axis: "x" | "y" | "z",
    parent: T.Object3D = this.group,
  ) {
    const rect = (x: number, y: number): Point[] => [
      [-x / 2, -y / 2],
      [x / 2, -y / 2],
      [x / 2, y / 2],
      [-x / 2, y / 2],
    ];
    return this.profile(
      rect(width, height),
      [rect(width - 2 * wall, height - 2 * wall).reverse()],
      length,
      position,
      axis,
      parent,
    );
  }
  gutter(
    width: number,
    height: number,
    wall: number,
    length: number,
    position: [number, number, number],
    axis: "x" | "z",
    parent: T.Object3D = this.group,
  ) {
    return this.profile(
      [
        [-width / 2, height / 2],
        [-width / 2, -height / 2],
        [width / 2, -height / 2],
        [width / 2, height / 2],
        [width / 2 - wall, height / 2],
        [width / 2 - wall, -height / 2 + wall],
        [-width / 2 + wall, -height / 2 + wall],
        [-width / 2 + wall, height / 2],
      ],
      [],
      length,
      position,
      axis,
      parent,
    );
  }
  rail(
    width: number,
    height: number,
    wall: number,
    length: number,
    position: [number, number, number],
    parent: T.Object3D = this.group,
  ) {
    // Lower wheel channel, upper closed carrier chamber and open T-slot lips.
    const outer: Point[] = [
      [-width / 2, -height / 2],
      [-width / 2, height / 2],
      [width / 2, height / 2],
      [width / 2, -height / 2],
      [width * 0.23, -height / 2],
      [width * 0.23, -height * 0.29],
      [width * 0.23 - wall, -height * 0.29],
      [width * 0.23 - wall, -height * 0.2],
      [-width * 0.23 + wall, -height * 0.2],
      [-width * 0.23 + wall, -height * 0.29],
      [-width * 0.23, -height * 0.29],
      [-width * 0.23, -height / 2],
    ];
    const hole: Point[] = [
      [-width / 2 + wall, 0],
      [width / 2 - wall, 0],
      [width / 2 - wall, height / 2 - wall],
      [-width / 2 + wall, height / 2 - wall],
    ];
    return this.profile(outer, [hole.reverse()], length, position, "z", parent);
  }
  link(
    a: [number, number, number],
    b: [number, number, number],
    parent: T.Object3D = this.group,
  ) {
    const shape = new T.Shape(),
      r = 0.014;
    shape.moveTo(-r, -0.5 + r);
    shape.lineTo(-r, 0.5 - r);
    shape.absarc(0, 0.5 - r, r, Math.PI, 0, true);
    shape.lineTo(r, -0.5 + r);
    shape.absarc(0, -0.5 + r, r, 0, -Math.PI, true);
    const geo = this.geometry(
      "link",
      () =>
        new T.ExtrudeGeometry(shape, {
          depth: 0.006,
          bevelEnabled: true,
          bevelSize: 0.001,
          bevelThickness: 0.001,
          bevelSegments: 2,
          curveSegments: 8,
        }),
    );
    const m = this.mesh(geo, this.metal, parent);
    this.poseLink(m, a, b);
    return m;
  }
  poseLink(
    m: T.Mesh,
    a: [number, number, number],
    b: [number, number, number],
  ) {
    const av = new T.Vector3(...a),
      bv = new T.Vector3(...b);
    m.position.copy(av).add(bv).multiplyScalar(0.5);
    m.scale.y = av.distanceTo(bv);
    m.quaternion.setFromUnitVectors(Y, bv.sub(av).normalize());
  }
  pane(
    width: number,
    height: number,
    thickness: number,
    position: [number, number, number],
    parent: T.Object3D = this.group,
    insulated = false,
  ) {
    const g = new T.Group();
    g.position.set(...position);
    parent.add(g);
    const sheet = (z: number) => {
      const mesh = this.box(
        [width, height, thickness],
        [0, 0, z],
        this.glass,
        g,
      );
      mesh.castShadow = false;
      this.box(
        [width, 0.002, thickness],
        [0, height / 2 - 0.001, z],
        this.glassEdge,
        g,
      );
      this.box(
        [width, 0.002, thickness],
        [0, -height / 2 + 0.001, z],
        this.glassEdge,
        g,
      );
      for (const x of [-width / 2 + 0.001, width / 2 - 0.001])
        this.box([0.002, height, thickness], [x, 0, z], this.glassEdge, g);
    };
    sheet(0);
    if (insulated) {
      sheet(0.02);
      for (const x of [-width / 2 + 0.006, width / 2 - 0.006])
        this.box([0.01, height - 0.012, 0.012], [x, 0, 0.01], this.rubber, g);
      for (const y of [-height / 2 + 0.006, height / 2 - 0.006])
        this.box([width - 0.012, 0.01, 0.012], [0, y, 0.01], this.rubber, g);
    }
    return g;
  }
  framedPane(
    width: number,
    height: number,
    thickness: number,
    parent: T.Object3D,
    insulated = false,
  ) {
    this.pane(
      width - 0.075,
      height - 0.09,
      thickness,
      [0, 0, 0],
      parent,
      insulated,
    );
    for (const y of [-height / 2 + 0.022, height / 2 - 0.022]) {
      this.tube(0.047, 0.045, 0.002, width, [-width / 2, y, 0], "x", parent);
      this.box(
        [width, 0.006, 0.018],
        [0, y + (y > 0 ? -0.026 : 0.026), 0],
        this.rubber,
        parent,
      );
    }
    for (const x of [-width / 2 + 0.017, width / 2 - 0.017])
      this.tube(
        0.033,
        0.044,
        0.002,
        height - 0.09,
        [x, -height / 2 + 0.045, 0],
        "y",
        parent,
      );
    for (const x of [-width / 2 + 0.016, width / 2 - 0.016])
      for (const y of [-height / 2 + 0.022, height / 2 - 0.022])
        this.bolt([x, y, 0.024], "z", parent);
  }
  foot(x: number, z: number, width = 0.16, parent: T.Object3D = this.group) {
    this.box([width, 0.014, width], [x, 0.012, z], this.steel, parent);
    for (const dx of [-width * 0.34, width * 0.34])
      for (const dz of [-width * 0.34, width * 0.34])
        this.bolt([x + dx, 0.023, z + dz], "y", parent);
  }
  dispose() {
    this.instances.forEach((mesh) => mesh.dispose());
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}
