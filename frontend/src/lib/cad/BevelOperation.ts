import * as THREE from "three";
import { weldGeometry } from "./MeshTopology";

export interface BevelOptions {
  /** Bevel width in mesh-local meters. */
  width: number;
  /** Number of bulge segments along the round profile (1..8). */
  segments: number;
}

const BULGE_FACTOR = 0.65;
const MAX_SEGMENTS = 8;

/**
 * Local-space edge bevel for closed triangle meshes.
 *
 * Strategy (welded topology, all output non-indexed with accumulated normals):
 *  1. Inset each triangle's corners toward its centroid (clamped so corners
 *     never cross).
 *  2. For every shared edge, bridge side A's inset edge to side B's inset edge
 *     with a segmented round profile that bulges toward the original vertex.
 *  3. Boundary (open) edges get a flat sliver back to the original edge so
 *     open meshes stay closed.
 *  4. Each fully-surrounded vertex gets a cap fan from its inset ring.
 *
 * Returns null when the bevel width is degenerate.
 */
export function bevelGeometry(
  geometry: THREE.BufferGeometry,
  opts: BevelOptions
): THREE.BufferGeometry | null {
  const width = Math.max(0, opts.width);
  const segments = Math.max(1, Math.min(MAX_SEGMENTS, Math.floor(opts.segments)));
  if (width <= 0) return null;

  const { positions, triangles } = weldGeometry(geometry);
  const vertCount = positions.length / 3;
  const triCount = triangles.length / 3;
  if (vertCount === 0 || triCount === 0) return null;

  const vec = (i: number, out = new THREE.Vector3()): THREE.Vector3 =>
    out.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);

  // --- Per-face data: normal, centroid, inset corners -------------------
  const faceNormal: THREE.Vector3[] = [];
  const centroid: THREE.Vector3[] = [];
  const inset: THREE.Vector3[][] = [];

  for (let f = 0; f < triCount; f++) {
    const a = vec(triangles[f * 3]);
    const b = vec(triangles[f * 3 + 1]);
    const c = vec(triangles[f * 3 + 2]);
    centroid.push(new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3));

    const n = new THREE.Vector3()
      .crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a));
    if (n.lengthSq() > 1e-20) n.normalize();
    else n.set(0, 1, 0);
    faceNormal.push(n);

    const minEdge = Math.max(
      1e-9,
      Math.min(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a))
    );
    const corners = [a, b, c];
    const inTri: THREE.Vector3[] = [];
    for (let k = 0; k < 3; k++) {
      const corner = corners[k];
      const dir = new THREE.Vector3().subVectors(centroid[f], corner);
      const dist = dir.length();
      if (dist < 1e-12) {
        inTri.push(corner.clone());
        continue;
      }
      dir.multiplyScalar(1 / dist);
      const shift = Math.min(width, dist * 0.45, minEdge * 0.4);
      inTri.push(corner.clone().addScaledVector(dir, shift));
    }
    inset.push(inTri);
  }

  // --- Adjacency: edge -> incident faces, vertex -> incident faces ------
  const edgeKey = (u: number, v: number): number =>
    u < v ? u * vertCount + v : v * vertCount + u;

  interface EdgeEntry {
    face: number;
    /** +1 if this face traverses the edge in ascending vertex order. */
    dir: 1 | -1;
    u: number;
    v: number;
    /** Corner slots of u,v within the face. */
    slotU: number;
    slotV: number;
  }

  const edgeFaces = new Map<number, EdgeEntry[]>();
  const vertFaces = new Map<number, number[]>();
  /** Directed edge (u -> v) as seen in face f. */
  const outEdge = new Map<string, number>();

  for (let f = 0; f < triCount; f++) {
    for (let k = 0; k < 3; k++) {
      const u = triangles[f * 3 + k];
      const v = triangles[f * 3 + ((k + 1) % 3)];
      if (u === v) continue;

      const key = edgeKey(u, v);
      let list = edgeFaces.get(key);
      if (!list) {
        list = [];
        edgeFaces.set(key, list);
      }
      const sortedU = Math.min(u, v);
      const sortedV = Math.max(u, v);
      list.push({
        face: f,
        dir: (u === sortedU ? 1 : -1) as 1 | -1,
        u: sortedU,
        v: sortedV,
        slotU: u === sortedU ? k : (k + 1) % 3,
        slotV: u === sortedU ? (k + 1) % 3 : k,
      });
      outEdge.set(`${u}>${v}`, f);

      let fl = vertFaces.get(u);
      if (!fl) {
        fl = [];
        vertFaces.set(u, fl);
      }
      fl.push(f);
    }
  }

  const outPos: number[] = [];
  const pushTri = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3
  ): void => {
    if (a.distanceToSquared(b) < 1e-24) return;
    if (b.distanceToSquared(c) < 1e-24) return;
    if (c.distanceToSquared(a) < 1e-24) return;
    outPos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  // --- 1. Inset face triangles ----------------------------------------
  for (let f = 0; f < triCount; f++) {
    pushTri(inset[f][0], inset[f][1], inset[f][2]);
  }

  // --- 2. Edge strips ---------------------------------------------------
  interface StripLevels {
    /** Level 0 = side A inset, level S = side B inset. */
    levelsU: THREE.Vector3[];
    levelsV: THREE.Vector3[];
    faceA: number;
    faceB: number | null;
  }

  const buildLevels = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    orig: THREE.Vector3,
    s: number
  ): THREE.Vector3[] => {
    const levels: THREE.Vector3[] = [start.clone()];
    const span = new THREE.Vector3().subVectors(end, start);
    const bulgeDir = new THREE.Vector3().subVectors(orig, start.clone().add(end).multiplyScalar(0.5));
    const bulgeDist = bulgeDir.length();
    if (bulgeDist > 1e-12) bulgeDir.multiplyScalar(1 / bulgeDist);
    else bulgeDir.set(0, 1, 0);
    for (let i = 1; i < s; i++) {
      const t = i / s;
      const p = start.clone().addScaledVector(span, t);
      p.addScaledVector(bulgeDir, Math.sin(Math.PI * t) * BULGE_FACTOR * bulgeDist);
      levels.push(p);
    }
    levels.push(end.clone());
    return levels;
  };

  const strips = new Map<number, StripLevels>();

  for (const [, list] of edgeFaces) {
    const e0 = list[0];
    const key = edgeKey(e0.u, e0.v);
    const origU = vec(e0.u);
    const origV = vec(e0.v);

    if (list.length === 1) {
      // Open boundary edge: sliver from inset back to original edge.
      const f = e0.face;
      const inA = inset[f][e0.slotU];
      const inB = inset[f][e0.slotV];
      // Face traverses (u->v) or (v->u); reverse it for the bottom of the sliver.
      const directedU = e0.dir === 1; // face goes u -> v
      const levelU = [inA.clone(), origU.clone()];
      const levelV = [inB.clone(), origV.clone()];
      if (directedU) {
        // face: u -> v, sliver bottom must be v -> u
        pushTri(levelV[0], levelU[0], levelU[1]);
        pushTri(levelV[0], levelU[1], levelV[1]);
      } else {
        // face: v -> u, sliver bottom must be u -> v
        pushTri(levelU[0], levelV[0], levelV[1]);
        pushTri(levelU[0], levelV[1], levelU[1]);
      }
      strips.set(key, {
        levelsU: levelU,
        levelsV: levelV,
        faceA: f,
        faceB: null,
      });
      continue;
    }

    // Pair incident faces: (0,1), leftover faces (non-manifold) -> slivers.
    for (let i = 0; i + 1 < list.length; i += 2) {
      const ea = list[i];
      const eb = list[i + 1];
      const fA = ea.face;
      const fB = eb.face;
      if (fA === fB) {
        // Degenerate self-paired edge (repeated vertex in one triangle):
        // treat both entries as flat slivers instead of a zero-width band.
        for (const e of [ea, eb]) {
          const inA = inset[e.face][e.slotU];
          const inB = inset[e.face][e.slotV];
          if (e.dir === 1) {
            pushTri(inB, inA, origU.clone());
            pushTri(inB, origU.clone(), origV.clone());
          } else {
            pushTri(inA, inB, origV.clone());
            pushTri(inA, origV.clone(), origU.clone());
          }
        }
        continue;
      }

      // Level 0 uses side A's inset corners, level S side B's.
      const startU = inset[fA][ea.slotU];
      const endU = inset[fB][eb.slotU];
      const startV = inset[fA][ea.slotV];
      const endV = inset[fB][eb.slotV];

      const levelsU = buildLevels(startU, endU, origU, segments);
      const levelsV = buildLevels(startV, endV, origV, segments);

      // fA traverses u->v when dir === 1. Band bottom must reverse it.
      const uIsX = ea.dir === 1; // fA: u -> v  => x = u, y = v
      const Qx = uIsX ? levelsU : levelsV;
      const Qy = uIsX ? levelsV : levelsU;

      for (let s = 1; s <= segments; s++) {
        // (y_{s-1}, x_{s-1}, x_s) and (y_{s-1}, x_s, y_s)
        pushTri(Qy[s - 1], Qx[s - 1], Qx[s]);
        pushTri(Qy[s - 1], Qx[s], Qy[s]);
      }

      strips.set(key, { levelsU, levelsV, faceA: fA, faceB: fB });
    }

    // Non-manifold leftovers (3+ faces): flat sliver to original edge.
    for (let i = list.length - (list.length % 2); i < list.length; i++) {
      const e = list[i];
      const f = e.face;
      const inA = inset[f][e.slotU];
      const inB = inset[f][e.slotV];
      const directedU = e.dir === 1;
      const levelU = [inA.clone(), origU.clone()];
      const levelV = [inB.clone(), origV.clone()];
      if (directedU) {
        pushTri(levelV[0], levelU[0], levelU[1]);
        pushTri(levelV[0], levelU[1], levelV[1]);
      } else {
        pushTri(levelU[0], levelV[0], levelV[1]);
        pushTri(levelU[0], levelV[1], levelU[1]);
      }
    }
  }

  // --- 3. Vertex caps for fully-surrounded vertices ---------------------
  for (const [u, faces] of vertFaces) {
    if (faces.length < 3) continue;

    // Walk the fan: start face, repeatedly cross the face's outgoing
    // edge u->x into the face that owns x->u.
    const cycle: number[] = [faces[0]];
    let current = faces[0];
    let open = false;
    let guard = 0;

    while (guard++ < faces.length + 2) {
      // Find current face's directed edge u -> x
      let x = -1;
      for (let k = 0; k < 3; k++) {
        const a = triangles[current * 3 + k];
        const b = triangles[current * 3 + ((k + 1) % 3)];
        if (a === u && b !== u) {
          x = b;
          break;
        }
      }
      if (x < 0) {
        open = true;
        break;
      }
      const nextFace = outEdge.get(`${x}>${u}`);
      if (nextFace === undefined) {
        open = true;
        break;
      }
      if (nextFace === faces[0]) break; // closed
      if (cycle.includes(nextFace)) {
        open = true; // non-manifold vertex fan — skip cap
        break;
      }
      cycle.push(nextFace);
      current = nextFace;
    }

    if (open || cycle.length < 3) continue;

    // Build the inset ring: for each consecutive pair of cycle faces, walk
    // the shared edge's profile points at endpoint u. levelsU always runs
    // faceA -> faceB, so orient it to start at face f.
    const ring: THREE.Vector3[] = [];
    let ringOk = true;
    for (let i = 0; i < cycle.length && ringOk; i++) {
      const f = cycle[i];
      const fNext = cycle[(i + 1) % cycle.length];
      let slotU = -1;
      for (let k = 0; k < 3; k++) {
        if (triangles[f * 3 + k] === u) {
          slotU = k;
          break;
        }
      }
      if (slotU < 0) {
        ringOk = false;
        break;
      }
      const x = triangles[f * 3 + ((slotU + 1) % 3)];
      const strip = strips.get(edgeKey(u, x));
      const connects =
        strip &&
        ((strip.faceA === f && strip.faceB === fNext) ||
          (strip.faceA === fNext && strip.faceB === f));
      if (!connects || !strip) {
        ringOk = false;
        break;
      }
      const levels =
        strip.faceA === f ? strip.levelsU : strip.levelsU.slice().reverse();
      // Push [0 .. S-1]; the final level equals the next segment's [0].
      for (let s = 0; s < levels.length - 1; s++) ring.push(levels[s].clone());
    }

    if (!ringOk || ring.length < 3) continue;

    // Fan from ring centroid, oriented against the area-weighted vertex normal.
    const capCenter = new THREE.Vector3();
    for (const p of ring) capCenter.add(p);
    capCenter.multiplyScalar(1 / ring.length);

    const vNormal = new THREE.Vector3();
    for (const f of cycle) vNormal.add(faceNormal[f]);
    if (vNormal.lengthSq() < 1e-20) vNormal.set(0, 1, 0);
    else vNormal.normalize();

    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const triN = new THREE.Vector3()
        .crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(capCenter, a));
      if (triN.lengthSq() < 1e-24) continue;
      if (triN.dot(vNormal) >= 0) pushTri(a, b, capCenter);
      else pushTri(b, a, capCenter);
    }
  }

  if (outPos.length < 9) return null;

  // --- Smooth normals accumulated per unique position --------------------
  const normalMap = new Map<string, THREE.Vector3>();
  for (let i = 0; i < outPos.length; i += 9) {
    const a = new THREE.Vector3(outPos[i], outPos[i + 1], outPos[i + 2]);
    const b = new THREE.Vector3(outPos[i + 3], outPos[i + 4], outPos[i + 5]);
    const c = new THREE.Vector3(outPos[i + 6], outPos[i + 7], outPos[i + 8]);
    const n = new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(b, a),
      new THREE.Vector3().subVectors(c, a)
    );
    if (n.lengthSq() < 1e-24) continue;
    for (const p of [a, b, c]) {
      const key = `${p.x}|${p.y}|${p.z}`;
      let acc = normalMap.get(key);
      if (!acc) {
        acc = new THREE.Vector3();
        normalMap.set(key, acc);
      }
      acc.add(n);
    }
  }

  const outNormals = new Float32Array(outPos.length);
  for (let i = 0; i < outPos.length; i += 3) {
    const key = `${outPos[i]}|${outPos[i + 1]}|${outPos[i + 2]}`;
    const n = normalMap.get(key);
    if (n && n.lengthSq() > 1e-20) {
      n.normalize();
      outNormals[i] = n.x;
      outNormals[i + 1] = n.y;
      outNormals[i + 2] = n.z;
    } else {
      outNormals[i + 1] = 1;
    }
  }

  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.BufferAttribute(new Float32Array(outPos), 3));
  result.setAttribute("normal", new THREE.BufferAttribute(outNormals, 3));
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}
