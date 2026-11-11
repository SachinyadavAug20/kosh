import * as THREE from "three";

export interface LayFlatResult {
  /** New local-space quaternion that lays the dominant flat face down. */
  quaternion: THREE.Quaternion;
  /** True when no rotation was needed (already aligned). */
  alreadyFlat: boolean;
  /** Dominant face normal in world space before rotation. */
  dominantNormal: THREE.Vector3;
}

const DOT_FLAT = 0.9999;
const DOT_CLUSTER = 0.995;
const MAX_CLUSTERS = 256;

let largest: { dir: THREE.Vector3; area: number } | null = null;

/**
 * Computes a quaternion that rotates the mesh's dominant planar face to
 * face -Y (Kosh is Y-up: build plate / floor is the y = 0 plane).
 *
 * Dominant face = the cluster of coplanar triangle normals with the greatest
 * total area (largest flat facet of the part). Falls back to the single
 * largest triangle when the part has too many distinct normals.
 */
export function computeLayFlatQuaternion(mesh: THREE.Mesh): LayFlatResult | null {
  const geometry = mesh.geometry;
  const pos = geometry?.getAttribute("position");
  if (!pos) return null;

  mesh.updateWorldMatrix(true, false);
  const matrix = mesh.matrixWorld.clone();
  largest = null;

  const index = geometry!.getIndex();
  const triCount = Math.floor((index ? index.count : pos.count) / 3);
  if (triCount <= 0) return null;

  interface Cluster {
    dir: THREE.Vector3;
    area: number;
  }
  const clusters: Cluster[] = [];
  let overCap = false;

  const av = new THREE.Vector3();
  const bv = new THREE.Vector3();
  const cv = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const ia = index ? index.getX(t * 3) : t * 3;
    const ib = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const ic = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    av.set(pos.getX(ia), pos.getY(ia), pos.getZ(ia)).applyMatrix4(matrix);
    bv.set(pos.getX(ib), pos.getY(ib), pos.getZ(ib)).applyMatrix4(matrix);
    cv.set(pos.getX(ic), pos.getY(ic), pos.getZ(ic)).applyMatrix4(matrix);

    ab.subVectors(bv, av);
    ac.subVectors(cv, av);
    const cross = new THREE.Vector3().crossVectors(ab, ac);
    const area = cross.length() * 0.5;
    if (area < 1e-12) continue;
    cross.multiplyScalar(1 / (area * 2));

    if (!overCap) {
      let matched = false;
      for (const cl of clusters) {
        if (cl.dir.dot(cross) >= DOT_CLUSTER) {
          cl.area += area;
          // Keep the cluster direction near the area-weighted mean.
          cl.dir.addScaledVector(cross, area / (cl.area)).normalize();
          matched = true;
          break;
        }
      }
      if (!matched) {
        if (clusters.length >= MAX_CLUSTERS) {
          overCap = true;
        } else {
          clusters.push({ dir: cross.clone(), area });
        }
      }
    }

    if (overCap && area > 0) {
      // Emergency path handled after the loop via largest-triangle tracking.
      if (!largest || area > largest.area) {
        largest = { dir: cross.clone(), area };
      }
    }
  }

  let dominant: THREE.Vector3 | null = null;
  if (!overCap && clusters.length > 0) {
    let best = clusters[0];
    for (const cl of clusters) if (cl.area > best.area) best = cl;
    dominant = best.dir.clone();
  } else if (largest) {
    dominant = largest.dir.clone();
  }
  if (!dominant) return null;

  const current = mesh.quaternion.clone();
  const down = new THREE.Vector3(0, -1, 0);
  if (dominant.dot(down) >= DOT_FLAT) {
    return { quaternion: current, alreadyFlat: true, dominantNormal: dominant };
  }

  // If the dominant face points +Y (part is upside down), rotate 180° around
  // a horizontal axis instead of the setFromUnitVectors shortest path.
  const target = dominant.dot(down) < -DOT_FLAT
    ? new THREE.Vector3(1, 0, 0)
    : down;

  const extra = new THREE.Quaternion().setFromUnitVectors(dominant, target);
  const worldQuat = new THREE.Quaternion().multiplyQuaternions(extra, current);

  // Convert world-space result back to the parent's local frame.
  const parent = mesh.parent;
  if (parent) {
    parent.updateWorldMatrix(true, false);
    const parentInv = new THREE.Quaternion()
      .setFromRotationMatrix(new THREE.Matrix4().extractRotation(parent.matrixWorld))
      .invert();
    worldQuat.premultiply(parentInv);
  }

  return { quaternion: worldQuat, alreadyFlat: false, dominantNormal: dominant };
}
