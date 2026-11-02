import * as THREE from "three";

const TEXTURE_KEYS = [
  "map",
  "alphaMap",
  "aoMap",
  "bumpMap",
  "displacementMap",
  "emissiveMap",
  "envMap",
  "lightMap",
  "metalnessMap",
  "normalMap",
  "roughnessMap",
  "specularMap",
] as const;

function disposeMaterial(material: THREE.Material): void {
  for (const key of TEXTURE_KEYS) {
    const value = (material as unknown as Record<string, unknown>)[key];
    const texture = value as THREE.Texture | undefined;
    if (texture && typeof texture.dispose === "function") {
      texture.dispose();
    }
  }
  material.dispose();
}

export function disposeObjectTree(root: THREE.Object3D): void {
  const targets: THREE.Object3D[] = [];
  root.traverse((obj) => {
    targets.push(obj);
  });

  for (const obj of targets) {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const entry of material) {
        if (entry) disposeMaterial(entry);
      }
    } else if (material) {
      disposeMaterial(material);
    }
  }

  root.removeFromParent();
}
