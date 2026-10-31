import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  EnvironmentPreset,
  GroundSurfaceType,
  PropType,
} from "./NarrativeSceneSchema";

// Material Helper with Low-Poly Flat Shading
export function createLowPolyMaterial(
  color: string | number,
  options?: Partial<THREE.MeshStandardMaterialParameters>
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    flatShading: true,
    roughness: 0.85,
    metalness: 0.1,
    ...options,
  });
}

// -------------------------------------------------------------
// 1. Procedural Sky Dome & Gradient Mesh
// -------------------------------------------------------------
export function createSkyboxGradient(topHex: string, bottomHex: string): THREE.Mesh {
  const topColor = new THREE.Color(topHex);
  const horizonColor = new THREE.Color(bottomHex);
  const groundColor = new THREE.Color(bottomHex).multiplyScalar(0.5);

  const skyGeo = new THREE.SphereGeometry(180, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTopColor: { value: topColor },
      uHorizonColor: { value: horizonColor },
      uGroundColor: { value: groundColor },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uGroundColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 color = h > 0.0
          ? mix(uHorizonColor, uTopColor, max(pow(max(h, 0.0), 0.7), 0.0))
          : mix(uHorizonColor, uGroundColor, max(pow(max(-h, 0.0), 0.7), 0.0));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.name = "ProceduralSkyDome";
  return skyMesh;
}

export function createLowPolySkyDome(
  skyType: EnvironmentPreset | "sunset" | "night" | "day" | "fog" | "golden_hour"
): THREE.Mesh {
  let topHex = "#1e1b4b";
  let bottomHex = "#ea580c";

  switch (skyType) {
    case "sunset":
      topHex = "#312e81";
      bottomHex = "#f97316";
      break;
    case "cyberpunk":
      topHex = "#180b2b";
      bottomHex = "#ec4899";
      break;
    case "foggy_morning":
    case "fog":
      topHex = "#334155";
      bottomHex = "#94a3b8";
      break;
    case "desert_noon":
    case "day":
      topHex = "#0284c7";
      bottomHex = "#fef08a";
      break;
    case "interior_warm":
    case "golden_hour":
      topHex = "#451a03";
      bottomHex = "#d97706";
      break;
    case "night":
      topHex = "#050814";
      bottomHex = "#1e293b";
      break;
  }

  return createSkyboxGradient(topHex, bottomHex);
}

// -------------------------------------------------------------
// 2. Procedural Low-Poly Terrain Generator
// -------------------------------------------------------------
export function generateLowPolyTerrain(
  width: number = 60,
  depth: number = 60,
  roughness: number = 0.8,
  groundType: GroundSurfaceType = "grass"
): THREE.Mesh {
  const segments = 40;
  const geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const posAttr = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  // Pseudo-random low-poly elevation
  for (let i = 0; i < posAttr.count; i++) {
    vertex.fromBufferAttribute(posAttr, i);
    const distFromCenter = Math.sqrt(vertex.x * vertex.x + vertex.z * vertex.z);

    // Keep center pathway relatively smooth for character walking
    const centerFactor = Math.min(distFromCenter / 12, 1.0);

    const wave1 = Math.sin(vertex.x * 0.15) * Math.cos(vertex.z * 0.15) * 1.5;
    const wave2 = Math.sin(vertex.x * 0.35 + 1.2) * Math.sin(vertex.z * 0.28) * 0.8;
    const micro = Math.sin(vertex.x * 0.8) * Math.cos(vertex.z * 0.8) * 0.3;

    const elevation = (wave1 + wave2 + micro) * roughness * centerFactor;
    posAttr.setY(i, elevation);
  }

  // Flatten normals for faceted low-poly look
  geometry.computeVertexNormals();

  let groundColor = "#2d4a22"; // default grass
  switch (groundType) {
    case "sand":
      groundColor = "#d4a373";
      break;
    case "cobblestone":
      groundColor = "#475569";
      break;
    case "wooden_floor":
      groundColor = "#78350f";
      break;
    case "terrain":
      groundColor = "#3f3f46";
      break;
    case "grid":
      groundColor = "#18181b";
      break;
  }

  const mat = createLowPolyMaterial(groundColor, { roughness: 0.95 });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = `Terrain_${groundType}`;
  mesh.receiveShadow = true;
  return mesh;
}

export function createLowPolyTerrain(
  groundType: GroundSurfaceType = "grass",
  width = 60,
  depth = 60
): THREE.Mesh {
  return generateLowPolyTerrain(width, depth, 0.7, groundType);
}

// -------------------------------------------------------------
// 3. Procedural Low-Poly Trees (BufferGeometryUtils Merged)
// -------------------------------------------------------------
export function generateLowPolyTree(
  foliageStyle: "pine" | "oak" | "round" = "pine"
): THREE.Object3D {
  const treeGroup = new THREE.Group();
  treeGroup.name = `Tree_${foliageStyle}`;

  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 1.8, 6);
  trunkGeo.translate(0, 0.9, 0);
  const trunkMat = createLowPolyMaterial("#5c3d24");
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  trunkMesh.castShadow = true;
  treeGroup.add(trunkMesh);

  if (foliageStyle === "pine") {
    // 3 tiered cones merged together
    const c1 = new THREE.ConeGeometry(1.8, 2.0, 6);
    c1.translate(0, 2.0, 0);

    const c2 = new THREE.ConeGeometry(1.4, 1.8, 6);
    c2.translate(0, 2.9, 0);

    const c3 = new THREE.ConeGeometry(0.9, 1.4, 6);
    c3.translate(0, 3.7, 0);

    const foliageMerged = BufferGeometryUtils.mergeGeometries([c1, c2, c3]);
    const foliageMat = createLowPolyMaterial("#1e3f20");
    const foliageMesh = new THREE.Mesh(foliageMerged, foliageMat);
    foliageMesh.castShadow = true;
    foliageMesh.receiveShadow = true;
    treeGroup.add(foliageMesh);
  } else if (foliageStyle === "oak") {
    // Clustered faceted Dodecahedrons
    const b1 = new THREE.DodecahedronGeometry(1.4, 0);
    b1.translate(0, 2.6, 0);

    const b2 = new THREE.DodecahedronGeometry(1.0, 0);
    b2.translate(-0.6, 2.2, 0.4);

    const b3 = new THREE.DodecahedronGeometry(0.9, 0);
    b3.translate(0.5, 2.3, -0.4);

    const foliageMerged = BufferGeometryUtils.mergeGeometries([b1, b2, b3]);
    const foliageMat = createLowPolyMaterial("#2d5a27");
    const foliageMesh = new THREE.Mesh(foliageMerged, foliageMat);
    foliageMesh.castShadow = true;
    foliageMesh.receiveShadow = true;
    treeGroup.add(foliageMesh);
  } else {
    // Round Stylized Tree
    const roundGeo = new THREE.IcosahedronGeometry(1.6, 1);
    roundGeo.translate(0, 2.6, 0);
    const foliageMat = createLowPolyMaterial("#3b7a34");
    const foliageMesh = new THREE.Mesh(roundGeo, foliageMat);
    foliageMesh.castShadow = true;
    treeGroup.add(foliageMesh);
  }

  return treeGroup;
}

export function createLowPolyPineTree(): THREE.Object3D {
  return generateLowPolyTree("pine");
}

export function createLowPolyDeciduousTree(): THREE.Object3D {
  return generateLowPolyTree("oak");
}

// -------------------------------------------------------------
// 4. Procedural Low-Poly Building (Floors & Architecture)
// -------------------------------------------------------------
export function generateLowPolyBuilding(
  floors: number = 2,
  style: "modern" | "medieval" | "sci-fi" = "medieval"
): THREE.Object3D {
  const building = new THREE.Group();
  building.name = `Building_${style}_${floors}F`;

  const floorHeight = 1.8;
  const width = 4.2;
  const depth = 3.6;

  let wallColor = "#854d0e";
  let roofColor = "#991b1b";
  let trimColor = "#451a03";

  if (style === "modern") {
    wallColor = "#e2e8f0";
    roofColor = "#334155";
    trimColor = "#0f172a";
  } else if (style === "sci-fi") {
    wallColor = "#1e293b";
    roofColor = "#0f172a";
    trimColor = "#38bdf8";
  }

  const wallMat = createLowPolyMaterial(wallColor);
  const trimMat = createLowPolyMaterial(trimColor);
  const roofMat = createLowPolyMaterial(roofColor);
  const glassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(style === "sci-fi" ? "#38bdf8" : "#fbbf24"),
    emissive: new THREE.Color(style === "sci-fi" ? "#0284c7" : "#d97706"),
    emissiveIntensity: 0.8,
    roughness: 0.3,
    flatShading: true,
  });

  // Base Foundation
  const foundationGeo = new THREE.BoxGeometry(width + 0.4, 0.4, depth + 0.4);
  const foundation = new THREE.Mesh(foundationGeo, trimMat);
  foundation.position.y = 0.2;
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  building.add(foundation);

  // Stack Floors
  for (let f = 0; f < floors; f++) {
    const floorY = 0.4 + f * floorHeight + floorHeight / 2;
    const bodyGeo = new THREE.BoxGeometry(width, floorHeight, depth);
    const bodyMesh = new THREE.Mesh(bodyGeo, wallMat);
    bodyMesh.position.y = floorY;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    building.add(bodyMesh);

    // Windows per floor
    const winGeo = new THREE.BoxGeometry(0.7, 0.7, 0.1);
    const win1 = new THREE.Mesh(winGeo, glassMat);
    win1.position.set(-1.1, floorY + 0.1, depth / 2 + 0.05);
    building.add(win1);

    const win2 = new THREE.Mesh(winGeo, glassMat);
    win2.position.set(1.1, floorY + 0.1, depth / 2 + 0.05);
    building.add(win2);
  }

  // Front Door on Ground Floor
  const doorGeo = new THREE.BoxGeometry(0.9, 1.3, 0.1);
  const door = new THREE.Mesh(doorGeo, trimMat);
  door.position.set(0, 0.4 + 0.65, depth / 2 + 0.06);
  door.castShadow = true;
  building.add(door);

  // Roof
  const totalHeight = 0.4 + floors * floorHeight;
  if (style === "medieval") {
    // Pitched Gable Roof
    const roofGeo = new THREE.ConeGeometry(width * 0.85, 1.6, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, totalHeight + 0.8, 0);
    roof.scale.set(1.0, 1.0, depth / width);
    roof.castShadow = true;
    building.add(roof);

    // Chimney
    const chimGeo = new THREE.BoxGeometry(0.5, 1.4, 0.5);
    const chim = new THREE.Mesh(chimGeo, trimMat);
    chim.position.set(1.2, totalHeight + 1.0, -0.6);
    chim.castShadow = true;
    building.add(chim);
  } else {
    // Flat Modern / Sci-Fi Rooftop with Parapet
    const roofSlabGeo = new THREE.BoxGeometry(width + 0.3, 0.3, depth + 0.3);
    const roofSlab = new THREE.Mesh(roofSlabGeo, trimMat);
    roofSlab.position.y = totalHeight + 0.15;
    roofSlab.castShadow = true;
    building.add(roofSlab);
  }

  return building;
}

export function createLowPolyCabin(): THREE.Object3D {
  return generateLowPolyBuilding(1, "medieval");
}

// -------------------------------------------------------------
// 5. Procedural Low-Poly Props (Chair, Table, Lantern, Fence)
// -------------------------------------------------------------
export function generateLowPolyProp(
  type: "chair" | "table" | "lantern" | "fence" | "barrel" | "campfire" | "rock"
): THREE.Object3D {
  const woodMat = createLowPolyMaterial("#854d0e");
  const stoneMat = createLowPolyMaterial("#64748b");
  const metalMat = createLowPolyMaterial("#334155", { metalness: 0.5, roughness: 0.4 });

  switch (type) {
    case "chair": {
      const chair = new THREE.Group();
      chair.name = "Prop_Chair";

      const seatGeo = new THREE.BoxGeometry(0.6, 0.08, 0.6);
      const seat = new THREE.Mesh(seatGeo, woodMat);
      seat.position.y = 0.5;
      seat.castShadow = true;
      chair.add(seat);

      // Backrest
      const backGeo = new THREE.BoxGeometry(0.6, 0.6, 0.08);
      const back = new THREE.Mesh(backGeo, woodMat);
      back.position.set(0, 0.84, -0.26);
      back.castShadow = true;
      chair.add(back);

      // 4 Legs merged
      const legGeo = new THREE.BoxGeometry(0.08, 0.5, 0.08);
      const offsets = [
        [-0.24, -0.24],
        [0.24, -0.24],
        [-0.24, 0.24],
        [0.24, 0.24],
      ];
      for (const [x, z] of offsets) {
        const leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(x, 0.25, z);
        leg.castShadow = true;
        chair.add(leg);
      }
      return chair;
    }

    case "table": {
      const table = new THREE.Group();
      table.name = "Prop_Table";

      const topGeo = new THREE.BoxGeometry(1.6, 0.1, 1.0);
      const top = new THREE.Mesh(topGeo, woodMat);
      top.position.y = 0.8;
      top.castShadow = true;
      table.add(top);

      const legGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1);
      const offsets = [
        [-0.7, -0.4],
        [0.7, -0.4],
        [-0.7, 0.4],
        [0.7, 0.4],
      ];
      for (const [x, z] of offsets) {
        const leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(x, 0.4, z);
        leg.castShadow = true;
        table.add(leg);
      }
      return table;
    }

    case "lantern": {
      const lamp = new THREE.Group();
      lamp.name = "Prop_Lantern";

      const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.8, 6);
      const pole = new THREE.Mesh(poleGeo, metalMat);
      pole.position.y = 1.4;
      pole.castShadow = true;
      lamp.add(pole);

      // Lantern Head
      const headGeo = new THREE.BoxGeometry(0.35, 0.45, 0.35);
      const headMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#fbbf24"),
        emissive: new THREE.Color("#f59e0b"),
        emissiveIntensity: 1.5,
        roughness: 0.2,
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 2.9, 0);
      lamp.add(head);

      const light = new THREE.PointLight(0xf59e0b, 15, 12);
      light.position.set(0, 2.9, 0);
      light.castShadow = true;
      lamp.add(light);
      return lamp;
    }

    case "fence": {
      const fence = new THREE.Group();
      fence.name = "Prop_Fence";

      const postGeo = new THREE.BoxGeometry(0.12, 1.0, 0.12);
      const p1 = new THREE.Mesh(postGeo, woodMat);
      p1.position.set(-1.0, 0.5, 0);
      p1.castShadow = true;
      fence.add(p1);

      const p2 = new THREE.Mesh(postGeo, woodMat);
      p2.position.set(1.0, 0.5, 0);
      p2.castShadow = true;
      fence.add(p2);

      const railGeo = new THREE.BoxGeometry(2.1, 0.08, 0.05);
      const r1 = new THREE.Mesh(railGeo, woodMat);
      r1.position.set(0, 0.75, 0);
      r1.castShadow = true;
      fence.add(r1);

      const r2 = new THREE.Mesh(railGeo, woodMat);
      r2.position.set(0, 0.35, 0);
      r2.castShadow = true;
      fence.add(r2);
      return fence;
    }

    case "barrel": {
      const barrelGeo = new THREE.CylinderGeometry(0.35, 0.32, 0.9, 8);
      const barrel = new THREE.Mesh(barrelGeo, woodMat);
      barrel.name = "Prop_Barrel";
      barrel.position.y = 0.45;
      barrel.castShadow = true;
      return barrel;
    }

    case "campfire": {
      const campfire = new THREE.Group();
      campfire.name = "Prop_Campfire";

      // Ring of small stones
      const stoneGeo = new THREE.DodecahedronGeometry(0.12, 0);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const stone = new THREE.Mesh(stoneGeo, stoneMat);
        stone.position.set(Math.cos(angle) * 0.5, 0.08, Math.sin(angle) * 0.5);
        stone.castShadow = true;
        campfire.add(stone);
      }

      // Crossed logs
      const logGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 5);
      logGeo.rotateZ(Math.PI / 4);
      const l1 = new THREE.Mesh(logGeo, woodMat);
      l1.position.set(0, 0.12, 0);
      campfire.add(l1);

      const l2 = new THREE.Mesh(logGeo, woodMat);
      l2.position.set(0, 0.12, 0);
      l2.rotation.y = Math.PI / 2;
      campfire.add(l2);

      // Glowing flame cones
      const flameGeo = new THREE.ConeGeometry(0.25, 0.6, 5);
      const flameMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#f97316"),
        emissive: new THREE.Color("#ea580c"),
        emissiveIntensity: 2.0,
        roughness: 0.1,
      });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.y = 0.35;
      campfire.add(flame);

      const fireLight = new THREE.PointLight(0xf97316, 20, 10);
      fireLight.position.set(0, 0.5, 0);
      fireLight.castShadow = true;
      campfire.add(fireLight);
      return campfire;
    }

    case "rock":
    default: {
      const rockGeo = new THREE.DodecahedronGeometry(0.8, 1);
      const rock = new THREE.Mesh(rockGeo, stoneMat);
      rock.name = "Prop_Rock";
      rock.position.y = 0.5;
      rock.scale.set(1.2, 0.8, 1.0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      return rock;
    }
  }
}

export function createLowPolyRock(): THREE.Object3D {
  return generateLowPolyProp("rock");
}

export function createLowPolyTable(): THREE.Object3D {
  return generateLowPolyProp("table");
}

export function createLowPolyChair(): THREE.Object3D {
  return generateLowPolyProp("chair");
}

export function createLowPolyStreetLamp(): THREE.Object3D {
  return generateLowPolyProp("lantern");
}

export function createLowPolyFence(): THREE.Object3D {
  return generateLowPolyProp("fence");
}

export function createLowPolyBarrel(): THREE.Object3D {
  return generateLowPolyProp("barrel");
}

export function createLowPolyCampfire(): THREE.Object3D {
  return generateLowPolyProp("campfire");
}

// -------------------------------------------------------------
// Universal Factory: Instantiates Entity by Type Name
// -------------------------------------------------------------
export function instantiateLowPolyEntity(type: PropType | string): THREE.Object3D {
  switch (type) {
    case "cabin":
      return createLowPolyCabin();
    case "building_block":
    case "door":
      return generateLowPolyBuilding(1, "modern");
    case "pine_tree":
      return createLowPolyPineTree();
    case "tree":
      return createLowPolyDeciduousTree();
    case "rock":
      return createLowPolyRock();
    case "table":
      return createLowPolyTable();
    case "chair":
      return createLowPolyChair();
    case "streetlamp":
    case "lamp_post":
    case "lantern":
      return createLowPolyStreetLamp();
    case "fence":
      return createLowPolyFence();
    case "barrel":
      return createLowPolyBarrel();
    case "campfire":
      return createLowPolyCampfire();
    default:
      return createLowPolyRock();
  }
}
