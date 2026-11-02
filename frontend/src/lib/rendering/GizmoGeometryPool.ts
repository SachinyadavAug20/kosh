import * as THREE from "three";

const geometries = new Map<string, THREE.BufferGeometry>();
const pooled = new Set<THREE.BufferGeometry>();

export function pooledGeometry(key: string, create: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let geometry = geometries.get(key);
  if (!geometry) {
    geometry = create();
    geometries.set(key, geometry);
    pooled.add(geometry);
  }
  return geometry;
}

export function isPooledGeometry(geometry: THREE.BufferGeometry): boolean {
  return pooled.has(geometry);
}

export function disposeGizmoGeometryPool(): void {
  for (const geometry of pooled) {
    geometry.dispose();
  }
  pooled.clear();
  geometries.clear();
}
