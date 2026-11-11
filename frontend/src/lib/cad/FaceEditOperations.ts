import * as THREE from "three";

/**
 * Working copy of a triangle soup with per-triangle mutability, preserving
 * original per-vertex normals for untouched triangles so shading doesn't pop
 * after a face edit.
 */
interface Soup {
  /** xyz per corner, 9 per triangle. */
  verts: number[];
  /** xyz per corner, 9 per triangle; null when source had no normals. */
  normals: number[] | null;
  triCount: number;
}

function toSoup(geometry: THREE.BufferGeometry): Soup | null {
  const pos = geometry.getAttribute("position");
  if (!pos) return null;
  const index = geometry.getIndex();
  const triCount = Math.floor((index ? index.count : pos.count) / 3);
  if (triCount <= 0) return null;

  const nrm = geometry.getAttribute("normal");
  const verts: number[] = new Array(triCount * 9);
  const normals: number[] | null = nrm ? new Array(triCount * 9) : null;

  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const src = index ? index.getX(t * 3 + k) : t * 3 + k;
      const o = t * 9 + k * 3;
      verts[o] = pos.getX(src);
      verts[o + 1] = pos.getY(src);
      verts[o + 2] = pos.getZ(src);
      if (normals && nrm) {
        normals[o] = nrm.getX(src);
        normals[o + 1] = nrm.getY(src);
        normals[o + 2] = nrm.getZ(src);
      }
    }
  }
  return { verts, normals, triCount };
}

function triangleNormal(
  verts: number[],
  t: number
): THREE.Vector3 {
  const o = t * 9;
  const a = new THREE.Vector3(verts[o], verts[o + 1], verts[o + 2]);
  const b = new THREE.Vector3(verts[o + 3], verts[o + 4], verts[o + 5]);
  const c = new THREE.Vector3(verts[o + 6], verts[o + 7], verts[o + 8]);
  return new THREE.Vector3().crossVectors(
    new THREE.Vector3().subVectors(b, a),
    new THREE.Vector3().subVectors(c, a)
  );
}

function finalize(soup: Soup): THREE.BufferGeometry {
  // New triangles (normals null per corner group) get a flat normal.
  // We regenerate everything with computeVertexNormals only when the source
  // had no normals at all; otherwise keep source normals and flat-fill the
  // newly created triangles.
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(soup.verts, 3)
  );
  if (soup.normals) {
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(soup.normals, 3));
  } else {
    geo.computeVertexNormals();
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/** Flat normal for a triangle given 3 corner vectors. */
function faceN(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3().crossVectors(
    new THREE.Vector3().subVectors(b, a),
    new THREE.Vector3().subVectors(c, a)
  );
}

/**
 * Extrudes a triangle along its normal (positive depth = outward), replacing
 * the source triangle with the extrusion's top face and three side walls.
 * The bottom is left open because the original triangle still bounds the
 * solid from below — output stays closed/watertight.
 */
export function extrudeFace(
  geometry: THREE.BufferGeometry,
  faceIndex: number,
  depth: number
): THREE.BufferGeometry | null {
  const soup = toSoup(geometry);
  if (!soup || faceIndex < 0 || faceIndex >= soup.triCount || depth === 0) return null;

  const o = faceIndex * 9;
  const a = new THREE.Vector3(soup.verts[o], soup.verts[o + 1], soup.verts[o + 2]);
  const b = new THREE.Vector3(soup.verts[o + 3], soup.verts[o + 4], soup.verts[o + 5]);
  const c = new THREE.Vector3(soup.verts[o + 6], soup.verts[o + 7], soup.verts[o + 8]);

  const n = faceN(a, b, c);
  if (n.lengthSq() < 1e-24) return null;
  n.normalize();

  const off = n.clone().multiplyScalar(depth);
  const a2 = a.clone().add(off);
  const b2 = b.clone().add(off);
  const c2 = c.clone().add(off);

  const outVerts: number[] = [];
  const outNormals: number[] = [];

  const tri = (
    p: THREE.Vector3,
    q: THREE.Vector3,
    r: THREE.Vector3,
    normal?: THREE.Vector3
  ): void => {
    if (p.distanceToSquared(q) < 1e-24) return;
    if (q.distanceToSquared(r) < 1e-24) return;
    if (r.distanceToSquared(p) < 1e-24) return;
    const fn = normal ?? faceN(p, q, r);
    for (const v of [p, q, r]) {
      outVerts.push(v.x, v.y, v.z);
      outNormals.push(fn.x, fn.y, fn.z);
    }
  };

  for (let t = 0; t < soup.triCount; t++) {
    if (t === faceIndex) continue;
    const to = t * 9;
    const p = new THREE.Vector3(soup.verts[to], soup.verts[to + 1], soup.verts[to + 2]);
    const q = new THREE.Vector3(soup.verts[to + 3], soup.verts[to + 4], soup.verts[to + 5]);
    const r = new THREE.Vector3(soup.verts[to + 6], soup.verts[to + 7], soup.verts[to + 8]);
    if (soup.normals) {
      // Source winding is trusted; keep the first corner's source normal for
      // each corner individually to preserve smooth shading.
      const pushCorner = (v: THREE.Vector3, co: number): void => {
        outVerts.push(v.x, v.y, v.z);
        outNormals.push(soup.normals![to + co], soup.normals![to + co + 1], soup.normals![to + co + 2]);
      };
      pushCorner(p, 0);
      pushCorner(q, 3);
      pushCorner(r, 6);
    } else {
      tri(p, q, r);
    }
  }

  // Top face (same winding as original so the normal matches).
  tri(a2, b2, c2, n);

  // Side walls: (x, y, y'), (x, y', x') for each original edge x->y.
  const walls: [THREE.Vector3, THREE.Vector3][] = [
    [a, b],
    [b, c],
    [c, a],
  ];
  for (const [x, y] of walls) {
    const x2 = x.clone().add(off);
    const y2 = y.clone().add(off);
    const wallN = faceN(x, y, y2);
    if (wallN.lengthSq() > 1e-24) wallN.normalize();
    else wallN.copy(n);
    tri(x, y, y2, wallN);
    tri(x, y2, x2, wallN);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(outVerts, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(outNormals, 3));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Insets a triangle toward its centroid by `factor` (0..0.9), replacing it
 * with the inner triangle plus a rim of six triangles connecting inner and
 * original edges — topology stays closed.
 */
export function insetFace(
  geometry: THREE.BufferGeometry,
  faceIndex: number,
  factor: number
): THREE.BufferGeometry | null {
  const soup = toSoup(geometry);
  if (!soup || faceIndex < 0 || faceIndex >= soup.triCount) return null;

  const f = Math.min(0.9, Math.max(0.01, factor));
  const o = faceIndex * 9;
  const a = new THREE.Vector3(soup.verts[o], soup.verts[o + 1], soup.verts[o + 2]);
  const b = new THREE.Vector3(soup.verts[o + 3], soup.verts[o + 4], soup.verts[o + 5]);
  const c = new THREE.Vector3(soup.verts[o + 6], soup.verts[o + 7], soup.verts[o + 8]);

  const centroid = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
  const lerpTo = (p: THREE.Vector3): THREE.Vector3 => p.clone().lerp(centroid, f);
  const ai = lerpTo(a);
  const bi = lerpTo(b);
  const ci = lerpTo(c);

  const origN = faceN(a, b, c);
  if (origN.lengthSq() < 1e-24) return null;
  origN.normalize();

  const outVerts: number[] = [];
  const outNormals: number[] = [];

  const tri = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3): void => {
    if (p.distanceToSquared(q) < 1e-24) return;
    if (q.distanceToSquared(r) < 1e-24) return;
    if (r.distanceToSquared(p) < 1e-24) return;
    const fn = faceN(p, q, r);
    if (fn.lengthSq() > 1e-24) fn.normalize();
    else fn.copy(origN);
    for (const v of [p, q, r]) {
      outVerts.push(v.x, v.y, v.z);
      outNormals.push(fn.x, fn.y, fn.z);
    }
  };

  for (let t = 0; t < soup.triCount; t++) {
    if (t !== faceIndex) {
      const to = t * 9;
      for (let k = 0; k < 3; k++) {
        outVerts.push(soup.verts[to + k * 3], soup.verts[to + k * 3 + 1], soup.verts[to + k * 3 + 2]);
        if (soup.normals) {
          outNormals.push(soup.normals[to + k * 3], soup.normals[to + k * 3 + 1], soup.normals[to + k * 3 + 2]);
        } else {
          outNormals.push(origN.x, origN.y, origN.z); // replaced below
        }
      }
      continue;
    }
    // Inner triangle keeps the original winding/normal.
    tri(ai, bi, ci);
    // Rim: for each original edge x->y with inner edge xi->yi, two tris.
    const rim: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
      [a, b, ai, bi],
      [b, c, bi, ci],
      [c, a, ci, ai],
    ];
    for (const [x, y, xi, yi] of rim) {
      tri(x, y, yi);
      tri(x, yi, xi);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(outVerts, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(outNormals, 3));
  if (!soup.normals) geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}
