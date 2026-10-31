import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  EnvironmentPreset,
  GroundSurfaceType,
  PropType,
} from "./NarrativeSceneSchema";

// Material Helper with Clean CAD Studio Shading
export function createLowPolyMaterial(
  color: string | number = "#858b97",
  options?: Partial<THREE.MeshStandardMaterialParameters>
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    flatShading: false,
    roughness: 0.52,
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

// -------------------------------------------------------------
// Procedural CAD Models (Turbine Flange, Bevel Gear, Mug, Crate)
// -------------------------------------------------------------
export function createProceduralTurbineFlange(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Turbine_Base_Flange";
  const steelMat = createLowPolyMaterial("#94a3b8", { metalness: 0.85, roughness: 0.25 });
  const darkMetal = createLowPolyMaterial("#475569", { metalness: 0.9, roughness: 0.2 });

  // Flange disc base
  const baseGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.4, 32);
  baseGeo.computeVertexNormals();
  const baseMesh = new THREE.Mesh(baseGeo, steelMat);
  baseMesh.name = "Flange_Base_Disc";
  baseMesh.position.y = 0.2;
  baseMesh.castShadow = true;
  group.add(baseMesh);

  // Central column
  const colGeo = new THREE.CylinderGeometry(1.3, 1.45, 2.4, 32);
  colGeo.computeVertexNormals();
  const colMesh = new THREE.Mesh(colGeo, darkMetal);
  colMesh.name = "Central_Column";
  colMesh.position.y = 1.4;
  colMesh.castShadow = true;
  group.add(colMesh);

  // Inner central bore
  const boreGeo = new THREE.CylinderGeometry(0.85, 0.85, 2.6, 24);
  boreGeo.computeVertexNormals();
  const boreMat = createLowPolyMaterial("#1e293b", { roughness: 0.8 });
  const boreMesh = new THREE.Mesh(boreGeo, boreMat);
  boreMesh.name = "Center_Bore";
  boreMesh.position.y = 1.4;
  group.add(boreMesh);

  // 8 Metric bolt holes around perimeter
  const boltGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.45, 12);
  boltGeo.computeVertexNormals();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const bx = Math.cos(angle) * 1.8;
    const bz = Math.sin(angle) * 1.8;
    const bolt = new THREE.Mesh(boltGeo, boreMat);
    bolt.name = `Perimeter_Bolt_${i + 1}`;
    bolt.position.set(bx, 0.22, bz);
    group.add(bolt);
  }

  return group;
}

export function createProceduralBevelGear(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Mechanical_Bevel_Gear";
  const brassMat = createLowPolyMaterial("#eab308", { metalness: 0.8, roughness: 0.25 });
  const coreMat = createLowPolyMaterial("#ca8a04", { metalness: 0.85, roughness: 0.3 });

  // Cone Gear Hub
  const hubGeo = new THREE.CylinderGeometry(1.4, 1.8, 0.9, 32);
  hubGeo.computeVertexNormals();
  const hubMesh = new THREE.Mesh(hubGeo, coreMat);
  hubMesh.name = "Gear_Cone_Hub";
  hubMesh.position.y = 0.45;
  hubMesh.castShadow = true;
  group.add(hubMesh);

  // 24 Gear Teeth
  const toothGeo = new THREE.BoxGeometry(0.22, 0.75, 0.65);
  toothGeo.computeVertexNormals();
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const tx = Math.cos(angle) * 1.7;
    const tz = Math.sin(angle) * 1.7;
    const tooth = new THREE.Mesh(toothGeo, brassMat);
    tooth.name = `Bevel_Tooth_${String(i + 1).padStart(2, "0")}`;
    tooth.position.set(tx, 0.5, tz);
    tooth.rotation.y = -angle;
    tooth.rotation.z = -0.15;
    tooth.castShadow = true;
    group.add(tooth);
  }

  // Center Keyed Bore
  const boreGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.0, 24);
  boreGeo.computeVertexNormals();
  const boreMat = createLowPolyMaterial("#1e293b");
  const boreMesh = new THREE.Mesh(boreGeo, boreMat);
  boreMesh.name = "Shaft_Keyway_Bore";
  boreMesh.position.y = 0.45;
  group.add(boreMesh);

  return group;
}

export function createProceduralCoffeeMug(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Ceramic_Coffee_Mug";
  const ceramicMat = createLowPolyMaterial("#0284c7", { roughness: 0.15, metalness: 0.05 });
  const insideMat = createLowPolyMaterial("#f8fafc", { roughness: 0.2 });

  // Outer Mug Body
  const bodyGeo = new THREE.CylinderGeometry(0.8, 0.75, 1.6, 32);
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, ceramicMat);
  body.name = "Mug_Exterior_Body";
  body.position.y = 0.8;
  body.castShadow = true;
  group.add(body);

  // Inner Cup (white ceramic)
  const insideGeo = new THREE.CylinderGeometry(0.7, 0.65, 1.5, 32);
  insideGeo.computeVertexNormals();
  const inside = new THREE.Mesh(insideGeo, insideMat);
  inside.name = "Mug_Interior_Cavity";
  inside.position.y = 0.85;
  group.add(inside);

  // Handle (Torus cutout)
  const handleGeo = new THREE.TorusGeometry(0.45, 0.1, 16, 32, Math.PI);
  handleGeo.computeVertexNormals();
  const handle = new THREE.Mesh(handleGeo, ceramicMat);
  handle.name = "Ergonomic_Handle";
  handle.position.set(0.8, 0.8, 0);
  handle.rotation.z = -Math.PI / 2;
  handle.castShadow = true;
  group.add(handle);

  return group;
}

export function createProceduralSciFiCrate(): THREE.Group {
  const group = new THREE.Group();
  group.name = "SciFi_Cargo_Crate";
  const crateMat = createLowPolyMaterial("#ea580c", { roughness: 0.35, metalness: 0.2 });
  const armorMat = createLowPolyMaterial("#0f172a", { roughness: 0.45, metalness: 0.85 });
  const brassMat = createLowPolyMaterial("#eab308", { roughness: 0.25, metalness: 0.95 });
  const handleMat = createLowPolyMaterial("#94a3b8", { roughness: 0.2, metalness: 0.9 });
  const rubberMat = createLowPolyMaterial("#18181b", { roughness: 0.85, metalness: 0.05 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#38bdf8"),
    emissive: new THREE.Color("#0284c7"),
    emissiveIntensity: 0.45,
    roughness: 0.15,
  });

  // 1. Main Crate Hull
  const cubeGeo = new THREE.BoxGeometry(1.8, 1.4, 1.4);
  cubeGeo.computeVertexNormals();
  const cube = new THREE.Mesh(cubeGeo, crateMat);
  cube.name = "Crate_Main_Hull";
  cube.position.y = 0.85;
  cube.castShadow = true;
  group.add(cube);

  // 2. 8 Corner Armor Reinforcement Brackets
  const bracketGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  bracketGeo.computeVertexNormals();
  let bIdx = 0;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        bIdx++;
        const bx = sx * 0.85;
        const by = 0.85 + sy * 0.65;
        const bz = sz * 0.65;
        const bracket = new THREE.Mesh(bracketGeo, armorMat);
        bracket.name = `Corner_Armor_${bIdx}`;
        bracket.position.set(bx, by, bz);
        bracket.castShadow = true;
        group.add(bracket);
      }
    }
  }

  // 3. Side Reinforcement Rim Bands
  const rimGeo = new THREE.BoxGeometry(1.65, 0.08, 1.35);
  rimGeo.computeVertexNormals();
  const rim1 = new THREE.Mesh(rimGeo, armorMat);
  rim1.name = "Upper_Reinforcement_Rim";
  rim1.position.y = 1.15;
  group.add(rim1);

  const rim2 = new THREE.Mesh(rimGeo, armorMat);
  rim2.name = "Lower_Reinforcement_Rim";
  rim2.position.y = 0.55;
  group.add(rim2);

  // 4. Center Holographic Status Screen
  const screenGeo = new THREE.BoxGeometry(0.5, 0.25, 0.05);
  screenGeo.computeVertexNormals();
  const screen = new THREE.Mesh(screenGeo, glowMat);
  screen.name = "Cargo_Status_Display";
  screen.position.set(0, 0.95, 0.72);
  group.add(screen);

  // 5. Golden Brass Locking Latches
  const latchGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.28, 16);
  latchGeo.computeVertexNormals();
  for (const sx of [-0.45, 0.45]) {
    const latch = new THREE.Mesh(latchGeo, brassMat);
    latch.name = `Lock_Latch_${sx > 0 ? "Right" : "Left"}`;
    latch.position.set(sx, 0.65, 0.72);
    latch.rotation.x = Math.PI / 2;
    group.add(latch);
  }

  // 6. Top Tubular Carry Handles
  const handleGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.5, 12);
  handleGeo.computeVertexNormals();
  for (const sx of [-0.45, 0.45]) {
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.name = `Carry_Handle_${sx > 0 ? "Right" : "Left"}`;
    handle.position.set(sx, 1.58, 0);
    handle.rotation.z = Math.PI / 2;
    group.add(handle);
  }

  // 7. 4 Bottom Rubberized Grip Pads
  const padGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12);
  padGeo.computeVertexNormals();
  let pIdx = 0;
  for (const sx of [-0.75, 0.75]) {
    for (const sz of [-0.55, 0.55]) {
      pIdx++;
      const pad = new THREE.Mesh(padGeo, rubberMat);
      pad.name = `Grip_Foot_${pIdx}`;
      pad.position.set(sx, 0.04, sz);
      group.add(pad);
    }
  }

  return group;
}

export function createProceduralBattleaxe(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Medieval_Battleaxe";
  const woodMat = createLowPolyMaterial("#78350f", { roughness: 0.8, metalness: 0.05 });
  const steelMat = createLowPolyMaterial("#cbd5e1", { roughness: 0.25, metalness: 0.9 });
  const darkSteel = createLowPolyMaterial("#475569", { roughness: 0.35, metalness: 0.85 });
  const brassMat = createLowPolyMaterial("#eab308", { roughness: 0.25, metalness: 0.8 });

  // Wooden Haft
  const haftGeo = new THREE.CylinderGeometry(0.05, 0.06, 2.2, 16);
  haftGeo.computeVertexNormals();
  const haft = new THREE.Mesh(haftGeo, woodMat);
  haft.name = "Axe_Wooden_Haft";
  haft.position.y = 1.1;
  haft.castShadow = true;
  group.add(haft);

  // Grip leather bands
  const gripGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.6, 16);
  gripGeo.computeVertexNormals();
  const gripMat = createLowPolyMaterial("#3f1e09", { roughness: 0.9 });
  const grip = new THREE.Mesh(gripGeo, gripMat);
  grip.name = "Axe_Leather_Grip";
  grip.position.y = 0.55;
  group.add(grip);

  // Central Axe Collar
  const collarGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.45, 16);
  collarGeo.computeVertexNormals();
  const collar = new THREE.Mesh(collarGeo, darkSteel);
  collar.name = "Reinforced_Collar";
  collar.position.y = 1.95;
  group.add(collar);

  // Main Crescent Blades (Left & Right)
  const bladeGeo = new THREE.BoxGeometry(0.7, 0.55, 0.04);
  bladeGeo.computeVertexNormals();
  const leftBlade = new THREE.Mesh(bladeGeo, steelMat);
  leftBlade.name = "Left_Crescent_Blade";
  leftBlade.position.set(-0.42, 1.95, 0);
  leftBlade.rotation.z = 0.05;
  leftBlade.castShadow = true;
  group.add(leftBlade);

  const rightBlade = new THREE.Mesh(bladeGeo, steelMat);
  rightBlade.name = "Right_Crescent_Blade";
  rightBlade.position.set(0.42, 1.95, 0);
  rightBlade.rotation.z = -0.05;
  rightBlade.castShadow = true;
  group.add(rightBlade);

  // Brass Reinforcement Rings
  const ringGeo = new THREE.TorusGeometry(0.09, 0.02, 8, 16);
  ringGeo.computeVertexNormals();
  const ring1 = new THREE.Mesh(ringGeo, brassMat);
  ring1.name = "Collar_Brass_Ring_Bottom";
  ring1.position.y = 1.75;
  ring1.rotation.x = Math.PI / 2;
  group.add(ring1);

  const ring2 = new THREE.Mesh(ringGeo, brassMat);
  ring2.name = "Collar_Brass_Ring_Top";
  ring2.position.y = 2.15;
  ring2.rotation.x = Math.PI / 2;
  group.add(ring2);

  // Top Spike
  const spikeGeo = new THREE.ConeGeometry(0.06, 0.35, 12);
  spikeGeo.computeVertexNormals();
  const spike = new THREE.Mesh(spikeGeo, steelMat);
  spike.name = "Armor_Piercing_Spike";
  spike.position.y = 2.35;
  group.add(spike);

  return group;
}

export function createProceduralHoverDrone(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Aerodynamic_Hover_Drone";
  const bodyMat = createLowPolyMaterial("#f8fafc", { roughness: 0.35, metalness: 0.2 });
  const darkMat = createLowPolyMaterial("#0f172a", { roughness: 0.5, metalness: 0.8 });
  const rotorMat = createLowPolyMaterial("#ea580c", { roughness: 0.25, metalness: 0.5 });
  const lensMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#38bdf8"),
    emissive: new THREE.Color("#0284c7"),
    emissiveIntensity: 0.4,
    roughness: 0.15,
  });

  // Central Aerodynamic Fuselage
  const bodyGeo = new THREE.BoxGeometry(0.9, 0.35, 1.2);
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.name = "Fuselage_Main_Body";
  body.position.y = 0.7;
  body.castShadow = true;
  group.add(body);

  // Top Canopy
  const canopyGeo = new THREE.CylinderGeometry(0.3, 0.45, 0.2, 16);
  canopyGeo.computeVertexNormals();
  const canopy = new THREE.Mesh(canopyGeo, darkMat);
  canopy.name = "Sensor_Dome_Canopy";
  canopy.position.set(0, 0.95, 0);
  group.add(canopy);

  // Front Camera Gimbal
  const gimbalGeo = new THREE.SphereGeometry(0.18, 16, 16);
  gimbalGeo.computeVertexNormals();
  const gimbal = new THREE.Mesh(gimbalGeo, darkMat);
  gimbal.name = "Gimbal_Camera_Turret";
  gimbal.position.set(0, 0.55, 0.65);
  group.add(gimbal);

  const lensGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16);
  lensGeo.computeVertexNormals();
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.name = "Optical_Sensor_Lens";
  lens.position.set(0, 0.55, 0.82);
  lens.rotation.x = Math.PI / 2;
  group.add(lens);

  // 4 Rotor Arms & Ducted Nacelles
  const armOffsets = [
    { label: "FL", x: 0.9, z: 0.8 },
    { label: "BL", x: -0.9, z: 0.8 },
    { label: "FR", x: 0.9, z: -0.8 },
    { label: "BR", x: -0.9, z: -0.8 },
  ];

  const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8);
  armGeo.computeVertexNormals();
  const nacelleGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.15, 24, 1, true);
  nacelleGeo.computeVertexNormals();
  const propGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.02, 16);
  propGeo.computeVertexNormals();

  armOffsets.forEach((pos) => {
    // Arm
    const arm = new THREE.Mesh(armGeo, darkMat);
    arm.name = `Rotor_Boom_${pos.label}`;
    arm.position.set(pos.x * 0.5, 0.7, pos.z * 0.5);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = Math.atan2(pos.z, pos.x);
    group.add(arm);

    // Ducted Nacelle
    const nacelle = new THREE.Mesh(nacelleGeo, bodyMat);
    nacelle.name = `Ducted_Shroud_${pos.label}`;
    nacelle.position.set(pos.x, 0.75, pos.z);
    group.add(nacelle);

    // Spinning Rotor Blade Disc
    const prop = new THREE.Mesh(propGeo, rotorMat);
    prop.name = `Rotor_Blades_${pos.label}`;
    prop.position.set(pos.x, 0.78, pos.z);
    group.add(prop);
  });

  // Landing Skids
  const skidGeo = new THREE.BoxGeometry(0.06, 0.06, 1.6);
  skidGeo.computeVertexNormals();
  const leftSkid = new THREE.Mesh(skidGeo, darkMat);
  leftSkid.name = "Landing_Skid_Left";
  leftSkid.position.set(-0.5, 0.2, 0);
  group.add(leftSkid);

  const rightSkid = new THREE.Mesh(skidGeo, darkMat);
  rightSkid.name = "Landing_Skid_Right";
  rightSkid.position.set(0.5, 0.2, 0);
  group.add(rightSkid);

  // Skid Struts
  const strutGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8);
  strutGeo.computeVertexNormals();
  const strut1 = new THREE.Mesh(strutGeo, darkMat);
  strut1.name = "Skid_Strut_FL";
  strut1.position.set(-0.45, 0.45, 0.4);
  strut1.rotation.z = -0.25;
  group.add(strut1);

  const strut2 = new THREE.Mesh(strutGeo, darkMat);
  strut2.name = "Skid_Strut_BL";
  strut2.position.set(-0.45, 0.45, -0.4);
  strut2.rotation.z = -0.25;
  group.add(strut2);

  const strut3 = new THREE.Mesh(strutGeo, darkMat);
  strut3.name = "Skid_Strut_FR";
  strut3.position.set(0.45, 0.45, 0.4);
  strut3.rotation.z = 0.25;
  group.add(strut3);

  const strut4 = new THREE.Mesh(strutGeo, darkMat);
  strut4.name = "Skid_Strut_BR";
  strut4.position.set(0.45, 0.45, -0.4);
  strut4.rotation.z = 0.25;
  group.add(strut4);

  return group;
}

export function createProceduralSword(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Medieval_Longsword";
  const steelMat = createLowPolyMaterial("#cbd5e1", { roughness: 0.2, metalness: 0.95 });
  const goldMat = createLowPolyMaterial("#ca8a04", { roughness: 0.3, metalness: 0.8 });
  const gripMat = createLowPolyMaterial("#18181b", { roughness: 0.8, metalness: 0.1 });

  // Blade
  const bladeGeo = new THREE.BoxGeometry(0.18, 1.8, 0.03);
  bladeGeo.computeVertexNormals();
  const blade = new THREE.Mesh(bladeGeo, steelMat);
  blade.name = "Steel_Blade";
  blade.position.y = 1.35;
  blade.castShadow = true;
  group.add(blade);

  // Crossguard
  const guardGeo = new THREE.BoxGeometry(0.65, 0.08, 0.08);
  guardGeo.computeVertexNormals();
  const guard = new THREE.Mesh(guardGeo, goldMat);
  guard.name = "Gilded_Crossguard";
  guard.position.y = 0.45;
  group.add(guard);

  // Grip
  const gripGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 12);
  gripGeo.computeVertexNormals();
  const grip = new THREE.Mesh(gripGeo, gripMat);
  grip.name = "Leather_Handle_Grip";
  grip.position.y = 0.25;
  group.add(grip);

  // Pommel
  const pommelGeo = new THREE.SphereGeometry(0.07, 12, 12);
  pommelGeo.computeVertexNormals();
  const pommel = new THREE.Mesh(pommelGeo, goldMat);
  pommel.name = "Counterweight_Pommel";
  pommel.position.y = 0.05;
  group.add(pommel);

  return group;
}

export function createProceduralCow(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Cow";
  const bodyMat = createLowPolyMaterial("#d97706", { roughness: 0.8, metalness: 0.1 });
  const spotMat = createLowPolyMaterial("#374151", { roughness: 0.9, metalness: 0.0 });

  // Body
  const bodyGeo = new THREE.CylinderGeometry(0.9, 0.7, 1.6, 24);
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.name = "Cow_Body";
  body.position.y = 0.8;
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  // Head
  const headGeo = new THREE.CylinderGeometry(0.35, 0.25, 0.5, 16);
  headGeo.computeVertexNormals();
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.name = "Cow_Head";
  head.position.set(-0.95, 0.8, 0);
  head.rotation.z = Math.PI / 2;
  head.castShadow = true;
  group.add(head);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8);
  legGeo.computeVertexNormals();
  const legPositions = [
    new THREE.Vector3(-0.5, 0.4, 0.45),
    new THREE.Vector3(0.5, 0.4, 0.45),
    new THREE.Vector3(-0.5, 0.4, -0.45),
    new THREE.Vector3(0.5, 0.4, -0.45),
  ];
  legPositions.forEach((pos, i) => {
    const leg = new THREE.Mesh(legGeo, spotMat);
    leg.name = `Cow_Leg_${i + 1}`;
    leg.position.copy(pos);
    leg.castShadow = true;
    group.add(leg);
  });

  // Spots
  [new THREE.Vector3(-0.3, 0.85, 0.5), new THREE.Vector3(0.4, 0.75, -0.3)].forEach((pos, i) => {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), spotMat);
    spot.name = `Cow_Spot_${i + 1}`;
    spot.position.copy(pos);
    group.add(spot);
  });

  return group;
}

export function createProceduralSheep(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Sheep";
  const woolMat = createLowPolyMaterial("#f3f4f6", { roughness: 0.95, metalness: 0.0 });
  const faceMat = createLowPolyMaterial("#4b5563", { roughness: 0.9, metalness: 0.0 });

  // Woolly body
  const bodyGeo = new THREE.SphereGeometry(0.6, 16, 12);
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, woolMat);
  body.name = "Sheep_Body";
  body.position.set(0, 0.6, 0);
  body.castShadow = true;
  group.add(body);

  // Head
  const headGeo = new THREE.SphereGeometry(0.22, 12, 10);
  headGeo.computeVertexNormals();
  const head = new THREE.Mesh(headGeo, faceMat);
  head.name = "Sheep_Head";
  head.position.set(-0.65, 0.6, 0);
  head.castShadow = true;
  group.add(head);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.45, 6);
  legGeo.computeVertexNormals();
  const legPositions = [
    new THREE.Vector3(-0.25, 0.35, 0.25),
    new THREE.Vector3(0.25, 0.35, 0.25),
    new THREE.Vector3(-0.25, 0.35, -0.25),
    new THREE.Vector3(0.25, 0.35, -0.25),
  ];
  legPositions.forEach((pos, i) => {
    const leg = new THREE.Mesh(legGeo, faceMat);
    leg.name = `Sheep_Leg_${i + 1}`;
    leg.position.copy(pos);
    leg.castShadow = true;
    group.add(leg);
  });

  return group;
}

export function createProceduralRocketShip(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_RocketShip";
  const hullMat = createLowPolyMaterial("#374151", { roughness: 0.6, metalness: 0.3 });
  const accentMat = createLowPolyMaterial("#fbbf24", { roughness: 0.4, metalness: 0.8 });
  const windowMat = createLowPolyMaterial("#60a5fa", { roughness: 0.2, metalness: 0.1 });

  // Main hull (cone pointing up)
  const hullGeo = new THREE.ConeGeometry(0.6, 2.4, 16);
  hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.name = "Rocket_Hull";
  hull.position.y = 1.2;
  hull.rotation.x = Math.PI / 2;
  hull.castShadow = true;
  group.add(hull);

  // Nose cone (smaller cone on top)
  const noseGeo = new THREE.ConeGeometry(0.45, 0.8, 12);
  noseGeo.computeVertexNormals();
  const nose = new THREE.Mesh(noseGeo, accentMat);
  nose.name = "Rocket_Nose";
  nose.position.y = 2.45;
  nose.rotation.x = Math.PI / 2;
  nose.castShadow = true;
  group.add(nose);

  // Fins (3 around base)
  const finGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6);
  finGeo.computeVertexNormals();
  [0, 120, 240].forEach((angle, i) => {
    const fin = new THREE.Mesh(finGeo, accentMat);
    fin.name = `Rocket_Fin_${i + 1}`;
    const rad = (angle * Math.PI) / 180;
    fin.position.set(Math.cos(rad) * 0.85, 0.05, Math.sin(rad) * 0.85);
    fin.rotation.x = Math.PI / 2;
    fin.rotation.z = rad;
    fin.castShadow = true;
    group.add(fin);
  });

  // Window
  const windowGeo = new THREE.SphereGeometry(0.15, 12, 10);
  windowGeo.computeVertexNormals();
  const window = new THREE.Mesh(windowGeo, windowMat);
  window.name = "Rocket_Window";
  window.position.set(0, 1.5, 0.5);
  group.add(window);

  return group;
}

export function createProceduralTank(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Tank";
  const bodyMat = createLowPolyMaterial("#4b5563", { roughness: 0.8, metalness: 0.2 });
  const barrelMat = createLowPolyMaterial("#374151", { roughness: 0.7, metalness: 0.3 });

  // Chassis (rounded box)
  const chassisGeo = new THREE.BoxGeometry(1.4, 0.5, 0.9);
  chassisGeo.computeVertexNormals();
  const chassis = new THREE.Mesh(chassisGeo, bodyMat);
  chassis.name = "Tank_Chassis";
  chassis.position.y = 0.35;
  chassis.castShadow = true;
  group.add(chassis);

  // Turret
  const turretGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.4, 12);
  turretGeo.computeVertexNormals();
  const turret = new THREE.Mesh(turretGeo, bodyMat);
  turret.name = "Tank_Turret";
  turret.position.y = 0.6;
  turret.castShadow = true;
  group.add(turret);

  // Barrel
  const barrelGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8);
  barrelGeo.computeVertexNormals();
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.name = "Tank_Barrel";
  barrel.position.set(0.5, 0.6, 0);
  barrel.rotation.z = -Math.PI / 2;
  barrel.castShadow = true;
  group.add(barrel);

  // Tracks
  const trackGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.5, 16);
  trackGeo.computeVertexNormals();
  [new THREE.Vector3(-0.75, 0.25, 0), new THREE.Vector3(0.75, 0.25, 0)].forEach((pos, i) => {
    const track = new THREE.Mesh(trackGeo, bodyMat);
    track.name = `Tank_Track_${i + 1}`;
    track.position.copy(pos);
    track.rotation.z = Math.PI / 2;
    track.castShadow = true;
    group.add(track);
  });

  return group;
}

export function createProceduralCastle(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Castle";
  const stoneMat = createLowPolyMaterial("#9ca3af", { roughness: 0.9, metalness: 0.1 });

  // Keep (main tower)
  const keepGeo = new THREE.BoxGeometry(1.2, 2.4, 1.2);
  keepGeo.computeVertexNormals();
  const keep = new THREE.Mesh(keepGeo, stoneMat);
  keep.name = "Castle_Keep";
  keep.position.y = 1.2;
  keep.castShadow = true;
  group.add(keep);

  // Battlements on top
  const battlementGeo = new THREE.BoxGeometry(1.4, 0.3, 1.4);
  battlementGeo.computeVertexNormals();
  const battlements = new THREE.Mesh(battlementGeo, stoneMat);
  battlements.name = "Castle_Battlements";
  battlements.position.y = 2.55;
  group.add(battlements);

  // Corner turrets
  const turretGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.6, 8);
  turretGeo.computeVertexNormals();
  const turretPositions = [
    new THREE.Vector3(-0.6, 0.8, -0.6),
    new THREE.Vector3(0.6, 0.8, -0.6),
    new THREE.Vector3(-0.6, 0.8, 0.6),
    new THREE.Vector3(0.6, 0.8, 0.6),
  ];
  turretPositions.forEach((pos, i) => {
    const turret = new THREE.Mesh(turretGeo, stoneMat);
    turret.name = `Castle_Turret_${i + 1}`;
    turret.position.copy(pos);
    turret.castShadow = true;
    group.add(turret);
  });

  // Gate arch
  const gateGeo = new THREE.BoxGeometry(0.6, 1.2, 0.2);
  gateGeo.computeVertexNormals();
  const gate = new THREE.Mesh(gateGeo, stoneMat);
  gate.name = "Castle_Gate";
  gate.position.set(0, 0.6, 0.61);
  group.add(gate);

  return group;
}

export function createProceduralRobot(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Robot";
  const metalMat = createLowPolyMaterial("#e5e7eb", { roughness: 0.3, metalness: 0.6 });
  const accentMat = createLowPolyMaterial("#3b82f6", { roughness: 0.2, metalness: 0.8 });

  // Head
  const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  headGeo.computeVertexNormals();
  const head = new THREE.Mesh(headGeo, metalMat);
  head.name = "Robot_Head";
  head.position.y = 1.6;
  head.castShadow = true;
  group.add(head);

  // Body
  const bodyGeo = new THREE.BoxGeometry(0.7, 1.0, 0.5);
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, metalMat);
  body.name = "Robot_Body";
  body.position.y = 0.7;
  body.castShadow = true;
  group.add(body);

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.7, 8);
  armGeo.computeVertexNormals();
  [new THREE.Vector3(-0.5, 0.9, 0), new THREE.Vector3(0.5, 0.9, 0)].forEach((pos, i) => {
    const arm = new THREE.Mesh(armGeo, metalMat);
    arm.name = `Robot_Arm_${i + 1}`;
    arm.position.copy(pos);
    arm.castShadow = true;
    group.add(arm);
  });

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
  legGeo.computeVertexNormals();
  [new THREE.Vector3(-0.2, 0.25, 0), new THREE.Vector3(0.2, 0.25, 0)].forEach((pos, i) => {
    const leg = new THREE.Mesh(legGeo, accentMat);
    leg.name = `Robot_Leg_${i + 1}`;
    leg.position.copy(pos);
    leg.castShadow = true;
    group.add(leg);
  });

  return group;
}

export function createProceduralPyramid(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Pyramid";
  const stoneMat = createLowPolyMaterial("#d1d5db", { roughness: 0.85, metalness: 0.05 });
  const goldMat = createLowPolyMaterial("#f59e0b", { roughness: 0.3, metalness: 0.9 });

  // Base (square)
  const baseGeo = new THREE.BoxGeometry(2.0, 0.4, 2.0);
  baseGeo.computeVertexNormals();
  const base = new THREE.Mesh(baseGeo, stoneMat);
  base.name = "Pyramid_Base";
  base.position.y = 0.2;
  base.castShadow = true;
  group.add(base);

  // Pyramid (cone with 4 sides = square pyramid)
  const pyramidGeo = new THREE.ConeGeometry(1.0, 1.8, 4);
  pyramidGeo.computeVertexNormals();
  const pyramid = new THREE.Mesh(pyramidGeo, stoneMat);
  pyramid.name = "Pyramid";
  pyramid.position.y = 1.1;
  pyramid.castShadow = true;
  group.add(pyramid);

  // Capstone
  const capGeo = new THREE.ConeGeometry(0.18, 0.3, 4);
  capGeo.computeVertexNormals();
  const cap = new THREE.Mesh(capGeo, goldMat);
  cap.name = "Pyramid_Capstone";
  cap.position.y = 2.0;
  cap.castShadow = true;
  group.add(cap);

  return group;
}

export function generateProceduralModelFromPrompt(prompt: string): THREE.Object3D {
  const p = prompt.toLowerCase();
  if (p.includes("axe") || p.includes("battleaxe") || p.includes("hatchet")) {
    return createProceduralBattleaxe();
  }
  if (p.includes("drone") || p.includes("hover") || p.includes("aircraft") || p.includes("copter")) {
    return createProceduralHoverDrone();
  }
  if (p.includes("sword") || p.includes("blade") || p.includes("dagger") || p.includes("saber")) {
    return createProceduralSword();
  }
  if (p.includes("cabin") || p.includes("house") || p.includes("building") || p.includes("home")) {
    return generateLowPolyBuilding(1, "medieval");
  }
  if (p.includes("gear")) {
    return createProceduralBevelGear();
  }
  if (p.includes("mug") || p.includes("cup") || p.includes("coffee") || p.includes("tea")) {
    return createProceduralCoffeeMug();
  }
  if (p.includes("crate") || p.includes("cargo") || p.includes("box") || p.includes("container")) {
    return createProceduralSciFiCrate();
  }
  if (p.includes("table") || p.includes("desk")) {
    return generateLowPolyProp("table");
  }
  if (p.includes("chair") || p.includes("seat") || p.includes("stool")) {
    return generateLowPolyProp("chair");
  }
  if (p.includes("lamp") || p.includes("lantern") || p.includes("light")) {
    return generateLowPolyProp("lantern");
  }
  if (p.includes("cow") || p.includes("bull") || p.includes("ox")) {
    return createProceduralCow();
  }
  if (p.includes("sheep") || p.includes("ram")) {
    return createProceduralSheep();
  }
  if (p.includes("rocket") || p.includes("starship") || p.includes("spaceship") || p.includes("rocket ship")) {
    return createProceduralRocketShip();
  }
  if (p.includes("tank")) {
    return createProceduralTank();
  }
  if (p.includes("castle") || p.includes("fortress")) {
    return createProceduralCastle();
  }
  if (p.includes("robot") || p.includes("android") || p.includes("mech")) {
    return createProceduralRobot();
  }
  if (p.includes("pyramid")) {
    return createProceduralPyramid();
  }
  // Default CAD model: High precision turbine flange
  return createProceduralTurbineFlange();
}

