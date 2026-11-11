import * as THREE from "three";

export interface TopologyReport {
  isWatertight: boolean;
  boundaryEdges: number;
  nonManifoldEdges: number;
  vertexCount: number;
  triangleCount: number;
}

export interface WeldedMesh {
  /** Unique vertex positions, xyz per vertex. */
  positions: number[];
  /** Triangle vertex indices, 3 per triangle. */
  triangles: Uint32Array;
}

/**
 * Welds coincident vertices by exact position so shared-edge topology can be
 * analyzed and rebuilt on CSG output (which is emitted as a triangle soup).
 */
export function weldGeometry(geometry: THREE.BufferGeometry): WeldedMesh {
  const pos = geometry.getAttribute("position");
  if (!pos) return { positions: [], triangles: new Uint32Array(0) };

  const index = geometry.getIndex();
  const triCount = Math.floor((index ? index.count : pos.count) / 3);
  if (triCount <= 0) return { positions: [], triangles: new Uint32Array(0) };

  const lookup = new Map<string, number>();
  const positions: number[] = [];
  const triangles = new Uint32Array(triCount * 3);

  const resolve = (src: number): number => {
    const x = pos.getX(src);
    const y = pos.getY(src);
    const z = pos.getZ(src);
    const key = `${x}|${y}|${z}`;
    let id = lookup.get(key);
    if (id === undefined) {
      id = positions.length / 3;
      lookup.set(key, id);
      positions.push(x, y, z);
    }
    return id;
  };

  for (let t = 0; t < triCount; t++) {
    const a = index ? index.getX(t * 3) : t * 3;
    const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    triangles[t * 3] = resolve(a);
    triangles[t * 3 + 1] = resolve(b);
    triangles[t * 3 + 2] = resolve(c);
  }

  return { positions, triangles };
}

/**
 * Edge-based manifold diagnosis: every edge of a watertight solid is shared by
 * exactly two triangles. Boundary edges (1 face) are holes; edges with more
 * than two faces are non-manifold T-junctions slicers choke on.
 */
export function analyzeTopology(geometry: THREE.BufferGeometry): TopologyReport {
  const { positions, triangles } = weldGeometry(geometry);
  const vertCount = positions.length / 3;
  const triCount = triangles.length / 3;

  const edgeCounts = new Map<string, number>();
  let degenerate = 0;

  for (let t = 0; t < triCount; t++) {
    const a = triangles[t * 3];
    const b = triangles[t * 3 + 1];
    const c = triangles[t * 3 + 2];
    if (a === b || b === c || a === c) {
      degenerate++;
      continue;
    }
    const edges: [number, number][] = [
      [a, b],
      [b, c],
      [c, a],
    ];
    for (const [u, v] of edges) {
      const key = u < v ? `${u}_${v}` : `${v}_${u}`;
      edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
    }
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of edgeCounts.values()) {
    if (count === 1) boundaryEdges++;
    else if (count > 2) nonManifoldEdges++;
  }

  return {
    isWatertight: boundaryEdges === 0 && nonManifoldEdges === 0,
    boundaryEdges,
    nonManifoldEdges,
    vertexCount: vertCount,
    triangleCount: triCount - degenerate,
  };
}
