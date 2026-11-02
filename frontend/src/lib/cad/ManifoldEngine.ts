import * as THREE from "three";
import Module, { ManifoldToplevel } from "manifold-3d";
import type { Manifold as ManifoldInstance, Mesh as ManifoldMeshData } from "manifold-3d";

let wasmPromise: Promise<ManifoldToplevel> | null = null;

export async function getManifold(): Promise<ManifoldToplevel> {
  if (typeof window === "undefined") {
    throw new Error("ManifoldEngine can only run in the browser");
  }
  if (!wasmPromise) {
    wasmPromise = Module({ locateFile: () => "/manifold.wasm" }).then((wasm) => {
      wasm.setup();
      return wasm;
    });
  }
  return wasmPromise;
}

function manifoldToBufferGeometry(wasm: ManifoldToplevel, manifold: ManifoldInstance): THREE.BufferGeometry {
  const mesh = manifold.getMesh();
  const numProp = mesh.numProp;
  const source = mesh.vertProperties;
  const triangles = mesh.triVerts;
  const vertexCount = Math.floor(source.length / numProp);

  let positions: Float32Array;
  if (numProp === 3) {
    positions = new Float32Array(source);
  } else {
    positions = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      positions[i * 3] = source[i * numProp];
      positions[i * 3 + 1] = source[i * numProp + 1];
      positions[i * 3 + 2] = source[i * numProp + 2];
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(triangles), 1));
  geometry.computeVertexNormals();
  return geometry;
}

function bufferGeometryToMeshData(wasm: ManifoldToplevel, geometry: THREE.BufferGeometry): ManifoldMeshData {
  const position = geometry.attributes.position;
  if (!position) {
    throw new Error("BufferGeometry must contain a position attribute for CSG");
  }

  const positions = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    positions[i * 3] = position.getX(i);
    positions[i * 3 + 1] = position.getY(i);
    positions[i * 3 + 2] = position.getZ(i);
  }

  let triangles: Uint32Array;
  const index = geometry.index;
  if (index) {
    triangles = new Uint32Array(index.count);
    for (let i = 0; i < index.count; i++) {
      triangles[i] = index.getX(i);
    }
  } else {
    triangles = new Uint32Array(position.count);
    for (let i = 0; i < position.count; i++) {
      triangles[i] = i;
    }
  }

  return new wasm.Mesh({ numProp: 3, vertProperties: positions, triVerts: triangles });
}

export async function executeWasmCSG(
  baseGeometry: THREE.BufferGeometry,
  cutterGeometry: THREE.BufferGeometry,
  op: "DIFFERENCE" | "UNION" | "INTERSECT"
): Promise<THREE.BufferGeometry> {
  const wasm = await getManifold();
  const base = new wasm.Manifold(bufferGeometryToMeshData(wasm, baseGeometry));
  const cutter = new wasm.Manifold(bufferGeometryToMeshData(wasm, cutterGeometry));

  let result: ManifoldInstance;
  if (op === "DIFFERENCE") {
    result = base.subtract(cutter);
  } else if (op === "UNION") {
    result = base.add(cutter);
  } else {
    result = base.intersect(cutter);
  }

  const geometry = manifoldToBufferGeometry(wasm, result);
  result.delete();
  cutter.delete();
  base.delete();
  return geometry;
}

function toManifold(
  wasm: ManifoldToplevel,
  shape: string,
  dimensions: number[],
  circularSegments = 48
): ManifoldInstance {
  if (shape === "cylinder") {
    const radius = dimensions.length > 0 ? dimensions[0] : 0.5;
    const depth = dimensions.length > 1 ? dimensions[1] : 1.0;
    return wasm.Manifold.cylinder(depth, radius, radius, circularSegments, true);
  }
  if (shape === "sphere") {
    const radius = dimensions.length > 0 ? dimensions[0] : 0.5;
    return wasm.Manifold.sphere(radius, circularSegments);
  }
  const width = dimensions.length > 0 ? dimensions[0] : 1.0;
  const height = dimensions.length > 1 ? dimensions[1] : 1.0;
  const depth = dimensions.length > 2 ? dimensions[2] : 1.0;
  return wasm.Manifold.cube([width, height, depth], true);
}

export async function buildBatchCsgGeometry(args: Record<string, unknown>): Promise<THREE.BufferGeometry> {
  const wasm = await getManifold();

  const baseShape = String(args.baseShape ?? "box").toLowerCase();
  const baseDimensions = Array.isArray(args.baseDimensions)
    ? (args.baseDimensions as number[]).map(Number)
    : [];
  const operations = Array.isArray(args.operations) ? (args.operations as Record<string, unknown>[]) : [];
  if (operations.length === 0) {
    throw new Error("Invalid params: 'operations' must be a non-empty array for cad_batch_csg");
  }

  const validOps = new Set(["DIFFERENCE", "UNION", "INTERSECT"]);
  const validShapes = new Set(["cylinder", "box", "slot", "chamfer"]);
  let base = toManifold(wasm, baseShape, baseDimensions, 64);

  for (const operation of operations) {
    const op = String(operation.op ?? "").toUpperCase();
    const shape = String(operation.shape ?? "").toLowerCase();
    if (!validOps.has(op)) {
      base.delete();
      throw new Error(`Invalid CSG op: ${op}. Valid: DIFFERENCE, UNION, INTERSECT`);
    }
    if (!validShapes.has(shape)) {
      base.delete();
      throw new Error(`Invalid cutter shape: ${shape}. Valid: cylinder, box, slot, chamfer`);
    }

    const transform = Array.isArray(operation.transform)
      ? (operation.transform as number[]).map(Number)
      : [0, 0, 0];
    const cutterScale = Array.isArray(operation.scale) ? (operation.scale as number[]).map(Number) : [];

    let cutter: ManifoldInstance;
    if (shape === "cylinder") {
      const radius = cutterScale.length > 0 ? cutterScale[0] : 0.15;
      const depth = cutterScale.length > 1 ? cutterScale[1] : 2.0;
      cutter = wasm.Manifold.cylinder(depth, radius, radius, 48, true);
    } else if (shape === "chamfer") {
      const size: [number, number, number] =
        cutterScale.length >= 3 ? [cutterScale[0], cutterScale[1], cutterScale[2]] : [0.3, 0.3, 0.3];
      cutter = wasm.Manifold.cube(size, true).rotate([0, 45, 0]);
    } else {
      const size: [number, number, number] =
        cutterScale.length >= 3
          ? [cutterScale[0], cutterScale[1], cutterScale[2]]
          : cutterScale.length === 1
            ? [cutterScale[0], cutterScale[0], cutterScale[0]]
            : [0.4, 0.1, 0.5];
      cutter = wasm.Manifold.cube(size, true);
    }
    cutter = cutter.translate([transform[0] ?? 0, transform[1] ?? 0, transform[2] ?? 0]);

    const previous = base;
    if (op === "DIFFERENCE") {
      base = previous.subtract(cutter);
    } else if (op === "UNION") {
      base = previous.add(cutter);
    } else {
      base = previous.intersect(cutter);
    }
    previous.delete();
    cutter.delete();
  }

  const geometry = manifoldToBufferGeometry(wasm, base);
  base.delete();
  return geometry;
}

export async function buildKitGeometry(args: Record<string, unknown>): Promise<THREE.BufferGeometry> {
  const wasm = await getManifold();

  const category = String(args.kitCategory ?? "industrial_flange").trim().toLowerCase();
  const validCategories = new Set([
    "industrial_flange",
    "quadcopter_frame",
    "scifi_panel",
    "structural_truss",
    "lowpoly_tree",
  ]);
  if (!validCategories.has(category)) {
    throw new Error(`Unknown kitCategory: ${category}. Valid categories: ${[...validCategories].join(", ")}`);
  }

  const params =
    args.parameters && typeof args.parameters === "object" ? (args.parameters as Record<string, unknown>) : {};
  let scale = Number(params.scale);
  if (!Number.isFinite(scale) || scale <= 0) scale = 1.0;
  let boltCount = Math.round(Number(params.boltCount));
  if (!Number.isFinite(boltCount)) boltCount = 6;
  boltCount = Math.max(2, Math.min(16, boltCount));
  const hollow = params.hollow !== false;
  const position = Array.isArray(args.targetPosition)
    ? (args.targetPosition as number[]).map(Number)
    : [0, 0, 0];
  const px = position[0] ?? 0;
  const py = position[1] ?? 0;
  const pz = position[2] ?? 0;

  let kit: ManifoldInstance;

  if (category === "industrial_flange") {
    const radius = 0.5 * scale;
    const height = 0.12 * scale;
    const bore = hollow ? 0.3 * scale : 0.16 * scale;

    let flange = wasm.Manifold.cylinder(height, radius, radius, 64, true);
    const boreCutter = wasm.Manifold.cylinder(height * 4, bore, bore, 48, true);
    flange = flange.subtract(boreCutter);
    boreCutter.delete();

    const ringRadius = (radius + bore) / 2;
    for (let i = 0; i < boltCount; i++) {
      const angle = (2 * Math.PI * i) / boltCount;
      const hole = wasm.Manifold
        .cylinder(height * 4, 0.045 * scale, 0.045 * scale, 16, true)
        .translate([ringRadius * Math.cos(angle), ringRadius * Math.sin(angle), 0]);
      const next = flange.subtract(hole);
      hole.delete();
      flange.delete();
      flange = next;
    }
    kit = flange.translate([px, py, pz + height / 2]);
    flange.delete();
  } else if (category === "quadcopter_frame") {
    const s = scale;
    let plate = wasm.Manifold.cube([0.26 * s, 0.26 * s, 0.03 * s], true);
    const centerHole = wasm.Manifold.cylinder(0.4 * s, 0.05 * s, 0.05 * s, 24, true);
    const nextPlate = plate.subtract(centerHole);
    centerHole.delete();
    plate.delete();
    plate = nextPlate;

    if (hollow) {
      for (const side of [-1, 1]) {
        const pocket = wasm.Manifold
          .cube([0.05 * s, 0.14 * s, 0.4 * s], true)
          .translate([side * 0.09 * s, 0, 0]);
        const cut = plate.subtract(pocket);
        pocket.delete();
        plate.delete();
        plate = cut;
      }
    }

    const parts: ManifoldInstance[] = [plate];
    const armLength = 0.3 * s;
    for (const angleDeg of [45, 135, 225, 315]) {
      const angle = (angleDeg * Math.PI) / 180;
      const arm = wasm.Manifold
        .cube([armLength, 0.045 * s, 0.025 * s], true)
        .rotate([0, 0, angleDeg])
        .translate([(Math.cos(angle) * armLength) / 2, (Math.sin(angle) * armLength) / 2, 0]);
      const mountX = Math.cos(angle) * armLength;
      const mountY = Math.sin(angle) * armLength;
      const mount = wasm.Manifold
        .cylinder(0.03 * s, 0.055 * s, 0.055 * s, 24, true)
        .translate([mountX, mountY, 0]);
      const boreCut = wasm.Manifold
        .cylinder(0.4 * s, 0.035 * s, 0.035 * s, 16, true)
        .translate([mountX, mountY, 0]);
      const tube = mount.subtract(boreCut);
      boreCut.delete();
      mount.delete();
      parts.push(arm, tube);
    }

    kit = wasm.Manifold.union(parts).translate([px, py, pz + 0.015 * s]);
    for (const part of parts) part.delete();
  } else if (category === "scifi_panel") {
    const s = scale;
    let panel = wasm.Manifold.cube([0.6 * s, 0.4 * s, 0.05 * s], true);
    for (let i = 0; i < 4; i++) {
      const slot = wasm.Manifold
        .cube([0.05 * s, 0.26 * s, 0.1 * s], true)
        .translate([-0.18 * s + i * 0.12 * s, 0, 0.025 * s]);
      const cut = panel.subtract(slot);
      slot.delete();
      panel.delete();
      panel = cut;
    }
    if (hollow) {
      const cavity = wasm.Manifold.cube([0.54 * s, 0.34 * s, 0.06 * s], true).translate([0, 0, -0.013 * s]);
      const cut = panel.subtract(cavity);
      cavity.delete();
      panel.delete();
      panel = cut;
    }

    const greebles: ManifoldInstance[] = [];
    const greebleSpecs = [
      [-0.22, 0.16, 0.14, 0.05],
      [0.0, -0.17, 0.2, 0.045],
      [0.22, 0.15, 0.1, 0.06],
    ];
    for (const [gx, gy, gw, gh] of greebleSpecs) {
      greebles.push(
        wasm.Manifold.cube([gw * s, gh * s, 0.02 * s], true).translate([gx * s, gy * s, 0.03 * s])
      );
    }

    kit = wasm.Manifold.union([panel, ...greebles]).translate([px, py, pz + 0.025 * s]);
    panel.delete();
    for (const greeble of greebles) greeble.delete();
  } else if (category === "structural_truss") {
    const s = scale;
    const bays = Math.max(2, Math.min(8, boltCount));
    const bayWidth = 0.12 * s;
    const totalLength = bays * bayWidth;
    const depth = 0.28 * s;
    const zBottom = 0.015 * s;
    const zTop = depth;
    const midZ = (zBottom + zTop) / 2;

    const parts: ManifoldInstance[] = [
      wasm.Manifold.cube([totalLength, 0.035 * s, 0.03 * s], true).translate([0, 0, zBottom]),
      wasm.Manifold.cube([totalLength, 0.035 * s, 0.03 * s], true).translate([0, 0, zTop]),
    ];

    for (let i = 0; i <= bays; i++) {
      const vx = -totalLength / 2 + i * bayWidth;
      parts.push(
        wasm.Manifold.cube([0.025 * s, 0.025 * s, depth], true).translate([vx, 0, midZ])
      );
    }

    const diagonalLength = Math.sqrt(bayWidth * bayWidth + depth * depth);
    const slopeDeg = (Math.atan2(depth, bayWidth) * 180) / Math.PI;
    for (let i = 0; i < bays; i++) {
      const mx = -totalLength / 2 + i * bayWidth + bayWidth / 2;
      const tilt = i % 2 === 0 ? -slopeDeg : slopeDeg;
      parts.push(
        wasm.Manifold
          .cube([diagonalLength, 0.022 * s, 0.022 * s], true)
          .rotate([0, tilt, 0])
          .translate([mx, 0, midZ])
      );
    }

    if (!hollow) {
      parts.push(
        wasm.Manifold.cube([totalLength, 0.26 * s, 0.015 * s], true).translate([0, 0, zBottom + 0.0225 * s])
      );
    }

    kit = wasm.Manifold.union(parts).translate([px, py, pz]);
    for (const part of parts) part.delete();
  } else {
    const s = scale;
    const trunk = wasm.Manifold.cylinder(0.4 * s, 0.06 * s, 0.06 * s, 8, true).translate([0, 0, 0.2 * s]);
    const tiers: Array<[number, number, number]> = [
      [0.34, 0.42, 0.48],
      [0.26, 0.38, 0.74],
      [0.17, 0.34, 0.98],
    ];
    const foliage: ManifoldInstance[] = [];
    for (const [radius, height, centerZ] of tiers) {
      foliage.push(
        wasm.Manifold.cylinder(height * s, radius * s, 0, 7, true).translate([0, 0, centerZ * s])
      );
    }
    kit = wasm.Manifold.union([trunk, ...foliage]).translate([px, py, pz]);
    trunk.delete();
    for (const cone of foliage) cone.delete();
  }

  const geometry = manifoldToBufferGeometry(wasm, kit);
  kit.delete();
  return geometry;
}
