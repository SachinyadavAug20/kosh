import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const exporter = new GLTFExporter();

export async function objectToGlbObjectUrl(object: THREE.Object3D): Promise<string> {
  const buffer = (await exporter.parseAsync(object, { binary: true })) as ArrayBuffer;
  const blob = new Blob([buffer], { type: "model/gltf-binary" });
  return URL.createObjectURL(blob);
}

export async function geometryToGlbObjectUrl(geometry: THREE.BufferGeometry): Promise<string> {
  const material = new THREE.MeshStandardMaterial({
    color: 0xb0b4bc,
    roughness: 0.4,
    metalness: 0.8,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Kosh_CSG_Result";
  return objectToGlbObjectUrl(mesh);
}
