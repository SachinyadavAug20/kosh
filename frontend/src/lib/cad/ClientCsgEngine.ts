import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from "three-bvh-csg";

const evaluator = new Evaluator();
evaluator.useGroups = true;

type CsgOp = "DIFFERENCE" | "UNION" | "INTERSECT";

const sceneMeshRegistry = new Map<string, THREE.Mesh>();

export function syncSceneMeshRegistry(entries: Array<{ name: string; meshRef: THREE.Mesh }>): void {
  sceneMeshRegistry.clear();
  for (const entry of entries) {
    if (entry.name && entry.meshRef) {
      sceneMeshRegistry.set(entry.name, entry.meshRef);
    }
  }
}

export function getRegisteredSceneMesh(name: string): THREE.Mesh | undefined {
  return sceneMeshRegistry.get(name);
}

export function executeClientCSG(
  baseMesh: THREE.Mesh,
  cutterMesh: THREE.Mesh,
  operation: CsgOp
): THREE.Mesh {
  baseMesh.updateMatrixWorld(true);
  cutterMesh.updateMatrixWorld(true);

  const brushA = new Brush(baseMesh.geometry.clone(), baseMesh.material);
  brushA.applyMatrix4(baseMesh.matrixWorld);

  const brushB = new Brush(cutterMesh.geometry.clone(), cutterMesh.material);
  brushB.applyMatrix4(cutterMesh.matrixWorld);

  const opType =
    operation === "DIFFERENCE" ? SUBTRACTION : operation === "UNION" ? ADDITION : INTERSECTION;
  const result = evaluator.evaluate(brushA, brushB, opType);
  result.geometry.computeVertexNormals();
  return result;
}

export function executeNamedBoolean(args: Record<string, unknown>): THREE.Mesh | null {
  const baseName = args.baseMeshName != null ? String(args.baseMeshName) : "Base_Body";
  const cutterName = args.cutterMeshName != null ? String(args.cutterMeshName) : "Cutter_Tool";
  const rawOp = args.operation != null ? String(args.operation).toUpperCase() : "DIFFERENCE";
  if (rawOp !== "DIFFERENCE" && rawOp !== "UNION" && rawOp !== "INTERSECT") {
    return null;
  }

  const base = sceneMeshRegistry.get(baseName);
  const cutter = sceneMeshRegistry.get(cutterName);
  if (!base || !cutter || base === cutter) {
    return null;
  }

  return executeClientCSG(base, cutter, rawOp);
}
