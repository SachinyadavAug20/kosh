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

export function createProceduralCat(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Cat";

  const furMat = createLowPolyMaterial("#ea580c", { roughness: 0.65, metalness: 0.05 }); // Ginger tabby
  const bellyMat = createLowPolyMaterial("#fef3c7", { roughness: 0.7, metalness: 0.0 }); // Cream belly & muzzle
  const earInnerMat = createLowPolyMaterial("#f472b6", { roughness: 0.5, metalness: 0.0 }); // Pink ears & nose
  const eyeMat = createLowPolyMaterial("#10b981", { roughness: 0.1, metalness: 0.1, emissive: new THREE.Color("#059669"), emissiveIntensity: 0.5 }); // Emerald eyes
  const collarMat = createLowPolyMaterial("#dc2626", { roughness: 0.4, metalness: 0.2 }); // Red collar
  const bellMat = createLowPolyMaterial("#f59e0b", { roughness: 0.2, metalness: 0.95 }); // Golden bell

  // 1. Torso / Body (slender, curved feline spine)
  const bodyGeo = new THREE.CylinderGeometry(0.32, 0.38, 1.25, 16);
  bodyGeo.rotateX(Math.PI / 2);
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, furMat);
  body.name = "Cat_Body";
  body.position.set(0, 0.65, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 2. Chest & Belly Pad
  const bellyGeo = new THREE.BoxGeometry(0.48, 0.35, 0.95);
  bellyGeo.computeVertexNormals();
  const belly = new THREE.Mesh(bellyGeo, bellyMat);
  belly.name = "Cat_Belly";
  belly.position.set(0, 0.55, 0.05);
  group.add(belly);

  // 3. Cat Head
  const headGeo = new THREE.SphereGeometry(0.36, 16, 12);
  headGeo.scale(1.0, 0.92, 0.95);
  headGeo.computeVertexNormals();
  const head = new THREE.Mesh(headGeo, furMat);
  head.name = "Cat_Head";
  head.position.set(0, 0.98, 0.68);
  head.castShadow = true;
  group.add(head);

  // 4. Pointy Triangular Ears (Left & Right)
  for (const [side, sx] of [["Left", -0.2], ["Right", 0.2]] as const) {
    const earGeo = new THREE.ConeGeometry(0.14, 0.28, 4);
    earGeo.computeVertexNormals();
    const ear = new THREE.Mesh(earGeo, furMat);
    ear.name = `Cat_Ear_${side}`;
    ear.position.set(sx, 1.35, 0.65);
    ear.rotation.set(-0.15, 0, sx < 0 ? 0.3 : -0.3);
    ear.castShadow = true;
    group.add(ear);

    // Inner pink ear
    const innerEarGeo = new THREE.ConeGeometry(0.09, 0.2, 4);
    innerEarGeo.computeVertexNormals();
    const innerEar = new THREE.Mesh(innerEarGeo, earInnerMat);
    innerEar.name = `Cat_Inner_Ear_${side}`;
    innerEar.position.set(sx * 0.95, 1.34, 0.68);
    innerEar.rotation.set(-0.15, 0, sx < 0 ? 0.3 : -0.3);
    group.add(innerEar);
  }

  // 5. Snout / Muzzle
  const muzzleGeo = new THREE.BoxGeometry(0.24, 0.14, 0.16);
  muzzleGeo.computeVertexNormals();
  const muzzle = new THREE.Mesh(muzzleGeo, bellyMat);
  muzzle.name = "Cat_Muzzle";
  muzzle.position.set(0, 0.88, 1.0);
  group.add(muzzle);

  // Pink Nose
  const noseGeo = new THREE.ConeGeometry(0.05, 0.06, 3);
  noseGeo.rotateZ(Math.PI);
  noseGeo.computeVertexNormals();
  const nose = new THREE.Mesh(noseGeo, earInnerMat);
  nose.name = "Cat_Nose";
  nose.position.set(0, 0.94, 1.08);
  group.add(nose);

  // 6. Eyes (Left & Right Glowing Emerald)
  for (const [side, sx] of [["Left", -0.14], ["Right", 0.14]] as const) {
    const eyeGeo = new THREE.SphereGeometry(0.065, 10, 8);
    eyeGeo.computeVertexNormals();
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.name = `Cat_Eye_${side}`;
    eye.position.set(sx, 1.04, 0.98);
    group.add(eye);
  }

  // 7. Four Paws & Legs
  const legPositions = [
    { name: "Cat_Leg_Front_Left", x: -0.22, y: 0.32, z: 0.42 },
    { name: "Cat_Leg_Front_Right", x: 0.22, y: 0.32, z: 0.42 },
    { name: "Cat_Leg_Back_Left", x: -0.24, y: 0.32, z: -0.42 },
    { name: "Cat_Leg_Back_Right", x: 0.24, y: 0.32, z: -0.42 },
  ];
  const legGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.58, 12);
  legGeo.computeVertexNormals();

  const pawGeo = new THREE.BoxGeometry(0.16, 0.09, 0.18);
  pawGeo.computeVertexNormals();

  legPositions.forEach((pos) => {
    const leg = new THREE.Mesh(legGeo, furMat);
    leg.name = pos.name;
    leg.position.set(pos.x, pos.y, pos.z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);

    const paw = new THREE.Mesh(pawGeo, bellyMat);
    paw.name = `${pos.name}_Paw`;
    paw.position.set(pos.x, 0.05, pos.z + 0.03);
    paw.castShadow = true;
    group.add(paw);
  });

  // 8. Curved Arching Tail
  const tailSegments = [
    { x: 0, y: 0.72, z: -0.7, rx: -0.6 },
    { x: 0, y: 0.92, z: -0.85, rx: -0.4 },
    { x: 0, y: 1.15, z: -0.9, rx: 0.1 },
    { x: 0, y: 1.32, z: -0.8, rx: 0.7 },
  ];
  const tailGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.26, 10);
  tailGeo.computeVertexNormals();
  tailSegments.forEach((seg, i) => {
    const tailSeg = new THREE.Mesh(tailGeo, furMat);
    tailSeg.name = `Cat_Tail_Segment_${i + 1}`;
    tailSeg.position.set(seg.x, seg.y, seg.z);
    tailSeg.rotation.x = seg.rx;
    tailSeg.castShadow = true;
    group.add(tailSeg);
  });

  // 9. Collar & Golden Bell
  const collarGeo = new THREE.TorusGeometry(0.35, 0.035, 8, 24);
  collarGeo.rotateX(Math.PI / 2);
  collarGeo.computeVertexNormals();
  const collar = new THREE.Mesh(collarGeo, collarMat);
  collar.name = "Cat_Collar";
  collar.position.set(0, 0.78, 0.62);
  group.add(collar);

  const bellGeo = new THREE.SphereGeometry(0.06, 12, 10);
  bellGeo.computeVertexNormals();
  const bell = new THREE.Mesh(bellGeo, bellMat);
  bell.name = "Cat_Bell";
  bell.position.set(0, 0.72, 0.95);
  group.add(bell);

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

export function createProceduralCar(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Car";

  const paintMat = createLowPolyMaterial("#2563eb", { roughness: 0.25, metalness: 0.65 });
  const trimMat = createLowPolyMaterial("#18181b", { roughness: 0.7, metalness: 0.2 });
  const glassMat = createLowPolyMaterial("#0f172a", { roughness: 0.1, metalness: 0.9 });
  const wheelRubberMat = createLowPolyMaterial("#18181b", { roughness: 0.85, metalness: 0.05 });
  const wheelRimMat = createLowPolyMaterial("#cbd5e1", { roughness: 0.3, metalness: 0.9 });
  const lightFrontMat = createLowPolyMaterial("#ffffff", { roughness: 0.1, metalness: 0.1, emissive: new THREE.Color("#e0f2fe"), emissiveIntensity: 0.6 });
  const lightRearMat = createLowPolyMaterial("#ef4444", { roughness: 0.2, metalness: 0.1, emissive: new THREE.Color("#ef4444"), emissiveIntensity: 0.5 });

  // 1. Lower Chassis
  const chassisGeo = new THREE.BoxGeometry(1.6, 0.42, 3.4);
  chassisGeo.computeVertexNormals();
  const chassis = new THREE.Mesh(chassisGeo, paintMat);
  chassis.name = "Car_Chassis";
  chassis.position.set(0, 0.45, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // 2. Hood / Front Nose Slope
  const hoodGeo = new THREE.BoxGeometry(1.5, 0.22, 1.1);
  hoodGeo.computeVertexNormals();
  const hood = new THREE.Mesh(hoodGeo, paintMat);
  hood.name = "Car_Hood_Panel";
  hood.position.set(0, 0.62, 1.05);
  hood.castShadow = true;
  group.add(hood);

  // 3. Cabin & Roof Structure
  const cabinGeo = new THREE.BoxGeometry(1.36, 0.48, 1.7);
  cabinGeo.computeVertexNormals();
  const cabin = new THREE.Mesh(cabinGeo, paintMat);
  cabin.name = "Car_Cabin_Roof";
  cabin.position.set(0, 0.88, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  // 4. Windshield & Windows
  const windshieldGeo = new THREE.BoxGeometry(1.38, 0.44, 0.55);
  windshieldGeo.computeVertexNormals();
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.name = "Car_Windshield_Glass";
  windshield.position.set(0, 0.86, 0.6);
  windshield.rotation.x = -0.32;
  windshield.castShadow = true;
  group.add(windshield);

  const rearGlassGeo = new THREE.BoxGeometry(1.38, 0.42, 0.5);
  rearGlassGeo.computeVertexNormals();
  const rearGlass = new THREE.Mesh(rearGlassGeo, glassMat);
  rearGlass.name = "Car_Rear_Window_Glass";
  rearGlass.position.set(0, 0.86, -1.0);
  rearGlass.rotation.x = 0.35;
  rearGlass.castShadow = true;
  group.add(rearGlass);

  // 5. Wheels & Rims
  const wheelPositions = [
    { name: "Car_Wheel_FL", x: -0.82, y: 0.32, z: 1.05 },
    { name: "Car_Wheel_FR", x: 0.82, y: 0.32, z: 1.05 },
    { name: "Car_Wheel_RL", x: -0.82, y: 0.32, z: -1.05 },
    { name: "Car_Wheel_RR", x: 0.82, y: 0.32, z: -1.05 },
  ];

  const tireGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 24);
  tireGeo.rotateZ(Math.PI / 2);
  tireGeo.computeVertexNormals();

  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.23, 16);
  rimGeo.rotateZ(Math.PI / 2);
  rimGeo.computeVertexNormals();

  wheelPositions.forEach((pos) => {
    const wheel = new THREE.Mesh(tireGeo, wheelRubberMat);
    wheel.name = pos.name;
    wheel.position.set(pos.x, pos.y, pos.z);
    wheel.castShadow = true;
    wheel.receiveShadow = true;

    const rim = new THREE.Mesh(rimGeo, wheelRimMat);
    rim.name = `${pos.name}_Rim`;
    rim.position.set(pos.x, pos.y, pos.z);
    group.add(wheel);
    group.add(rim);
  });

  // 6. Front Grille & Headlights
  const grilleGeo = new THREE.BoxGeometry(1.1, 0.22, 0.08);
  grilleGeo.computeVertexNormals();
  const grille = new THREE.Mesh(grilleGeo, trimMat);
  grille.name = "Car_Front_Grille";
  grille.position.set(0, 0.42, 1.72);
  group.add(grille);

  const headlightGeo = new THREE.BoxGeometry(0.25, 0.14, 0.08);
  headlightGeo.computeVertexNormals();
  const hlLeft = new THREE.Mesh(headlightGeo, lightFrontMat);
  hlLeft.name = "Car_Headlight_Left";
  hlLeft.position.set(-0.58, 0.52, 1.72);
  group.add(hlLeft);

  const hlRight = new THREE.Mesh(headlightGeo, lightFrontMat);
  hlRight.name = "Car_Headlight_Right";
  hlRight.position.set(0.58, 0.52, 1.72);
  group.add(hlRight);

  // 7. Taillights
  const taillightGeo = new THREE.BoxGeometry(0.3, 0.12, 0.08);
  taillightGeo.computeVertexNormals();
  const tlLeft = new THREE.Mesh(taillightGeo, lightRearMat);
  tlLeft.name = "Car_Taillight_Left";
  tlLeft.position.set(-0.58, 0.52, -1.72);
  group.add(tlLeft);

  const tlRight = new THREE.Mesh(taillightGeo, lightRearMat);
  tlRight.name = "Car_Taillight_Right";
  tlRight.position.set(0.58, 0.52, -1.72);
  group.add(tlRight);

  // 8. Rear Spoiler
  const spoilerWingGeo = new THREE.BoxGeometry(1.5, 0.06, 0.3);
  spoilerWingGeo.computeVertexNormals();
  const spoilerWing = new THREE.Mesh(spoilerWingGeo, paintMat);
  spoilerWing.name = "Car_Rear_Spoiler_Wing";
  spoilerWing.position.set(0, 0.95, -1.6);
  spoilerWing.castShadow = true;
  group.add(spoilerWing);

  const strutGeo = new THREE.BoxGeometry(0.06, 0.25, 0.06);
  strutGeo.computeVertexNormals();
  const strutL = new THREE.Mesh(strutGeo, trimMat);
  strutL.name = "Car_Spoiler_Strut_Left";
  strutL.position.set(-0.5, 0.8, -1.6);
  group.add(strutL);

  const strutR = new THREE.Mesh(strutGeo, trimMat);
  strutR.name = "Car_Spoiler_Strut_Right";
  strutR.position.set(0.5, 0.8, -1.6);
  group.add(strutR);

  return group;
}

export function createProceduralAirplane(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Airplane";

  const bodyMat = createLowPolyMaterial("#f1f5f9", { roughness: 0.35, metalness: 0.5 });
  const wingMat = createLowPolyMaterial("#0284c7", { roughness: 0.3, metalness: 0.6 });
  const glassMat = createLowPolyMaterial("#0f172a", { roughness: 0.1, metalness: 0.9 });
  const engineMat = createLowPolyMaterial("#475569", { roughness: 0.4, metalness: 0.8 });

  // 1. Fuselage
  const fuselageGeo = new THREE.CylinderGeometry(0.42, 0.2, 4.2, 18);
  fuselageGeo.rotateX(Math.PI / 2);
  fuselageGeo.computeVertexNormals();
  const fuselage = new THREE.Mesh(fuselageGeo, bodyMat);
  fuselage.name = "Airplane_Fuselage";
  fuselage.position.set(0, 1.2, 0);
  fuselage.castShadow = true;
  group.add(fuselage);

  // 2. Nose Cone
  const noseGeo = new THREE.ConeGeometry(0.42, 0.9, 18);
  noseGeo.rotateX(Math.PI / 2);
  noseGeo.computeVertexNormals();
  const nose = new THREE.Mesh(noseGeo, wingMat);
  nose.name = "Airplane_Nose_Cone";
  nose.position.set(0, 1.2, 2.5);
  nose.castShadow = true;
  group.add(nose);

  // 3. Cockpit Canopy
  const cockpitGeo = new THREE.BoxGeometry(0.44, 0.32, 0.9);
  cockpitGeo.computeVertexNormals();
  const cockpit = new THREE.Mesh(cockpitGeo, glassMat);
  cockpit.name = "Airplane_Cockpit_Canopy";
  cockpit.position.set(0, 1.5, 1.4);
  cockpit.rotation.x = -0.25;
  cockpit.castShadow = true;
  group.add(cockpit);

  // 4. Main Wings (Swept)
  const wingLeftGeo = new THREE.BoxGeometry(2.4, 0.08, 0.85);
  wingLeftGeo.computeVertexNormals();
  const wingL = new THREE.Mesh(wingLeftGeo, wingMat);
  wingL.name = "Airplane_Main_Wing_Left";
  wingL.position.set(-1.45, 1.15, 0.1);
  wingL.rotation.y = 0.12;
  wingL.rotation.z = 0.05;
  wingL.castShadow = true;
  group.add(wingL);

  const wingRightGeo = new THREE.BoxGeometry(2.4, 0.08, 0.85);
  wingRightGeo.computeVertexNormals();
  const wingR = new THREE.Mesh(wingRightGeo, wingMat);
  wingR.name = "Airplane_Main_Wing_Right";
  wingR.position.set(1.45, 1.15, 0.1);
  wingR.rotation.y = -0.12;
  wingR.rotation.z = -0.05;
  wingR.castShadow = true;
  group.add(wingR);

  // 5. Vertical Tail Fin
  const finGeo = new THREE.BoxGeometry(0.08, 1.1, 0.85);
  finGeo.computeVertexNormals();
  const fin = new THREE.Mesh(finGeo, wingMat);
  fin.name = "Airplane_Vertical_Fin";
  fin.position.set(0, 1.85, -1.7);
  fin.rotation.x = -0.3;
  fin.castShadow = true;
  group.add(fin);

  // 6. Horizontal Stabilizers
  const stabLeftGeo = new THREE.BoxGeometry(0.9, 0.05, 0.5);
  stabLeftGeo.computeVertexNormals();
  const stabL = new THREE.Mesh(stabLeftGeo, bodyMat);
  stabL.name = "Airplane_Stabilizer_Left";
  stabL.position.set(-0.6, 1.35, -1.9);
  group.add(stabL);

  const stabRightGeo = new THREE.BoxGeometry(0.9, 0.05, 0.5);
  stabRightGeo.computeVertexNormals();
  const stabR = new THREE.Mesh(stabRightGeo, bodyMat);
  stabR.name = "Airplane_Stabilizer_Right";
  stabR.position.set(0.6, 1.35, -1.9);
  group.add(stabR);

  // 7. Jet Engines
  const engineGeo = new THREE.CylinderGeometry(0.2, 0.18, 0.95, 16);
  engineGeo.rotateX(Math.PI / 2);
  engineGeo.computeVertexNormals();

  const engL = new THREE.Mesh(engineGeo, engineMat);
  engL.name = "Airplane_Jet_Engine_Left";
  engL.position.set(-1.1, 0.95, 0.15);
  engL.castShadow = true;
  group.add(engL);

  const engR = new THREE.Mesh(engineGeo, engineMat);
  engR.name = "Airplane_Jet_Engine_Right";
  engR.position.set(1.1, 0.95, 0.15);
  engR.castShadow = true;
  group.add(engR);

  return group;
}

export function createProceduralBoat(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Boat";

  const hullMat = createLowPolyMaterial("#0284c7", { roughness: 0.35, metalness: 0.3 });
  const deckMat = createLowPolyMaterial("#d97706", { roughness: 0.8, metalness: 0.1 });
  const cabinMat = createLowPolyMaterial("#f8fafc", { roughness: 0.4, metalness: 0.2 });
  const mastMat = createLowPolyMaterial("#475569", { roughness: 0.5, metalness: 0.8 });

  // 1. Boat Hull
  const hullGeo = new THREE.BoxGeometry(1.5, 0.7, 3.8);
  hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.name = "Boat_Hull_Main";
  hull.position.set(0, 0.35, 0);
  hull.castShadow = true;
  group.add(hull);

  // 2. Bow Pointed Nose
  const bowGeo = new THREE.ConeGeometry(0.85, 1.4, 4);
  bowGeo.rotateX(-Math.PI / 2);
  bowGeo.computeVertexNormals();
  const bow = new THREE.Mesh(bowGeo, hullMat);
  bow.name = "Boat_Bow_Prow";
  bow.position.set(0, 0.35, 2.3);
  bow.castShadow = true;
  group.add(bow);

  // 3. Top Deck
  const deckGeo = new THREE.BoxGeometry(1.4, 0.1, 3.5);
  deckGeo.computeVertexNormals();
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.name = "Boat_Deck_Planks";
  deck.position.set(0, 0.72, 0.1);
  group.add(deck);

  // 4. Cabin Bridge
  const cabinGeo = new THREE.BoxGeometry(1.0, 0.75, 1.4);
  cabinGeo.computeVertexNormals();
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.name = "Boat_Bridge_Cabin";
  cabin.position.set(0, 1.15, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  // 5. Radar Mast
  const mastGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.2, 8);
  mastGeo.computeVertexNormals();
  const mast = new THREE.Mesh(mastGeo, mastMat);
  mast.name = "Boat_Antenna_Mast";
  mast.position.set(0, 2.0, -0.2);
  group.add(mast);

  return group;
}

export function createProceduralLaptop(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Laptop";

  const metalMat = createLowPolyMaterial("#94a3b8", { roughness: 0.3, metalness: 0.85 });
  const keyMat = createLowPolyMaterial("#1e293b", { roughness: 0.8, metalness: 0.1 });
  const screenMat = createLowPolyMaterial("#0284c7", { roughness: 0.1, metalness: 0.2, emissive: new THREE.Color("#0369a1"), emissiveIntensity: 0.4 });

  // 1. Base Keyboard Chassis
  const baseGeo = new THREE.BoxGeometry(1.8, 0.06, 1.25);
  baseGeo.computeVertexNormals();
  const base = new THREE.Mesh(baseGeo, metalMat);
  base.name = "Laptop_Base_Chassis";
  base.position.set(0, 0.03, 0);
  base.castShadow = true;
  group.add(base);

  // 2. Keyboard Inset
  const keyGeo = new THREE.BoxGeometry(1.55, 0.02, 0.65);
  keyGeo.computeVertexNormals();
  const keys = new THREE.Mesh(keyGeo, keyMat);
  keys.name = "Laptop_Keyboard_Surface";
  keys.position.set(0, 0.07, -0.15);
  group.add(keys);

  // 3. Trackpad
  const trackpadGeo = new THREE.BoxGeometry(0.55, 0.015, 0.38);
  trackpadGeo.computeVertexNormals();
  const trackpad = new THREE.Mesh(trackpadGeo, metalMat);
  trackpad.name = "Laptop_Trackpad";
  trackpad.position.set(0, 0.07, 0.36);
  group.add(trackpad);

  // 4. Screen Lid (Tilted at 115 degrees)
  const lidGeo = new THREE.BoxGeometry(1.8, 1.25, 0.05);
  lidGeo.computeVertexNormals();
  const lid = new THREE.Mesh(lidGeo, metalMat);
  lid.name = "Laptop_Screen_Lid";
  lid.position.set(0, 0.65, -0.75);
  lid.rotation.x = -0.38;
  lid.castShadow = true;
  group.add(lid);

  // 5. Screen OLED Display
  const displayGeo = new THREE.BoxGeometry(1.65, 1.1, 0.02);
  displayGeo.computeVertexNormals();
  const display = new THREE.Mesh(displayGeo, screenMat);
  display.name = "Laptop_OLED_Screen";
  display.position.set(0, 0.65, -0.72);
  display.rotation.x = -0.38;
  group.add(display);

  return group;
}

export function createProceduralTreeModel(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Tree";

  const trunkMat = createLowPolyMaterial("#78350f", { roughness: 0.9, metalness: 0.05 });
  const foliageMat1 = createLowPolyMaterial("#15803d", { roughness: 0.85, metalness: 0.0 });
  const foliageMat2 = createLowPolyMaterial("#16a34a", { roughness: 0.85, metalness: 0.0 });
  const foliageMat3 = createLowPolyMaterial("#22c55e", { roughness: 0.85, metalness: 0.0 });

  // 1. Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.8, 10);
  trunkGeo.computeVertexNormals();
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.name = "Tree_Trunk";
  trunk.position.set(0, 0.9, 0);
  trunk.castShadow = true;
  group.add(trunk);

  // 2. Lower Foliage Cone
  const foliageGeo1 = new THREE.ConeGeometry(1.2, 1.4, 9);
  foliageGeo1.computeVertexNormals();
  const foliage1 = new THREE.Mesh(foliageGeo1, foliageMat1);
  foliage1.name = "Tree_Foliage_Layer_1";
  foliage1.position.set(0, 1.8, 0);
  foliage1.castShadow = true;
  group.add(foliage1);

  // 3. Middle Foliage Cone
  const foliageGeo2 = new THREE.ConeGeometry(0.95, 1.2, 9);
  foliageGeo2.computeVertexNormals();
  const foliage2 = new THREE.Mesh(foliageGeo2, foliageMat2);
  foliage2.name = "Tree_Foliage_Layer_2";
  foliage2.position.set(0, 2.45, 0);
  foliage2.castShadow = true;
  group.add(foliage2);

  // 4. Top Crown Cone
  const foliageGeo3 = new THREE.ConeGeometry(0.68, 1.0, 8);
  foliageGeo3.computeVertexNormals();
  const foliage3 = new THREE.Mesh(foliageGeo3, foliageMat3);
  foliage3.name = "Tree_Foliage_Crown";
  foliage3.position.set(0, 3.05, 0);
  foliage3.castShadow = true;
  group.add(foliage3);

  return group;
}

export function createProceduralBuildingModel(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_House";

  const wallMat = createLowPolyMaterial("#f8fafc", { roughness: 0.75, metalness: 0.1 });
  const roofMat = createLowPolyMaterial("#dc2626", { roughness: 0.6, metalness: 0.2 });
  const doorMat = createLowPolyMaterial("#92400e", { roughness: 0.85, metalness: 0.05 });
  const glassMat = createLowPolyMaterial("#38bdf8", { roughness: 0.2, metalness: 0.8 });
  const foundationMat = createLowPolyMaterial("#64748b", { roughness: 0.9, metalness: 0.1 });

  // 1. Foundation
  const foundGeo = new THREE.BoxGeometry(2.5, 0.2, 2.5);
  foundGeo.computeVertexNormals();
  const foundation = new THREE.Mesh(foundGeo, foundationMat);
  foundation.name = "House_Foundation";
  foundation.position.set(0, 0.1, 0);
  group.add(foundation);

  // 2. Main Wall Body
  const wallGeo = new THREE.BoxGeometry(2.3, 1.6, 2.3);
  wallGeo.computeVertexNormals();
  const walls = new THREE.Mesh(wallGeo, wallMat);
  walls.name = "House_Walls";
  walls.position.set(0, 1.0, 0);
  walls.castShadow = true;
  group.add(walls);

  // 3. Pitched Roof
  const roofGeo = new THREE.ConeGeometry(1.8, 1.1, 4);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.name = "House_Pitched_Roof";
  roof.position.set(0, 2.35, 0);
  roof.castShadow = true;
  group.add(roof);

  // 4. Front Door
  const doorGeo = new THREE.BoxGeometry(0.48, 0.9, 0.06);
  doorGeo.computeVertexNormals();
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.name = "House_Front_Door";
  door.position.set(0, 0.65, 1.16);
  group.add(door);

  // 5. Windows
  const winGeo = new THREE.BoxGeometry(0.4, 0.45, 0.06);
  winGeo.computeVertexNormals();
  const winL = new THREE.Mesh(winGeo, glassMat);
  winL.name = "House_Window_Left";
  winL.position.set(-0.65, 1.0, 1.16);
  group.add(winL);

  const winR = new THREE.Mesh(winGeo, glassMat);
  winR.name = "House_Window_Right";
  winR.position.set(0.65, 1.0, 1.16);
  group.add(winR);

  return group;
}

export function createProceduralTableGroup(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Table";

  const woodMat = createLowPolyMaterial("#b45309", { roughness: 0.65, metalness: 0.1 });
  const frameMat = createLowPolyMaterial("#18181b", { roughness: 0.7, metalness: 0.4 });

  // 1. Table Top Surface
  const topGeo = new THREE.BoxGeometry(2.2, 0.1, 1.3);
  topGeo.computeVertexNormals();
  const top = new THREE.Mesh(topGeo, woodMat);
  top.name = "Table_Top_Surface";
  top.position.set(0, 0.95, 0);
  top.castShadow = true;
  group.add(top);

  // 2. Underframe Apron
  const frameGeo = new THREE.BoxGeometry(1.9, 0.12, 1.05);
  frameGeo.computeVertexNormals();
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.name = "Table_Support_Apron";
  frame.position.set(0, 0.88, 0);
  group.add(frame);

  // 3. Legs
  const legPositions = [
    { name: "Table_Leg_FL", x: -0.95, z: 0.52 },
    { name: "Table_Leg_FR", x: 0.95, z: 0.52 },
    { name: "Table_Leg_RL", x: -0.95, z: -0.52 },
    { name: "Table_Leg_RR", x: 0.95, z: -0.52 },
  ];

  const legGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.9, 12);
  legGeo.computeVertexNormals();

  legPositions.forEach((pos) => {
    const leg = new THREE.Mesh(legGeo, frameMat);
    leg.name = pos.name;
    leg.position.set(pos.x, 0.45, pos.z);
    leg.castShadow = true;
    group.add(leg);
  });

  return group;
}

export function createProceduralChairGroup(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Chair";

  const seatMat = createLowPolyMaterial("#ea580c", { roughness: 0.55, metalness: 0.15 });
  const legMat = createLowPolyMaterial("#27272a", { roughness: 0.65, metalness: 0.7 });

  // 1. Seat Pad
  const seatGeo = new THREE.BoxGeometry(0.7, 0.08, 0.7);
  seatGeo.computeVertexNormals();
  const seat = new THREE.Mesh(seatGeo, seatMat);
  seat.name = "Chair_Seat_Cushion";
  seat.position.set(0, 0.55, 0);
  seat.castShadow = true;
  group.add(seat);

  // 2. Backrest
  const backGeo = new THREE.BoxGeometry(0.66, 0.6, 0.06);
  backGeo.computeVertexNormals();
  const back = new THREE.Mesh(backGeo, seatMat);
  back.name = "Chair_Backrest_Panel";
  back.position.set(0, 0.92, -0.32);
  back.castShadow = true;
  group.add(back);

  // 3. 4 Legs
  const legPositions = [
    { name: "Chair_Leg_FL", x: -0.28, z: 0.28 },
    { name: "Chair_Leg_FR", x: 0.28, z: 0.28 },
    { name: "Chair_Leg_RL", x: -0.28, z: -0.28 },
    { name: "Chair_Leg_RR", x: 0.28, z: -0.28 },
  ];

  const legGeo = new THREE.CylinderGeometry(0.028, 0.024, 0.54, 10);
  legGeo.computeVertexNormals();

  legPositions.forEach((pos) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.name = pos.name;
    leg.position.set(pos.x, 0.27, pos.z);
    leg.castShadow = true;
    group.add(leg);
  });

  return group;
}

export function createProceduralBicycle(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Bicycle";

  const frameMat = createLowPolyMaterial("#dc2626", { roughness: 0.35, metalness: 0.6 });
  const metalMat = createLowPolyMaterial("#cbd5e1", { roughness: 0.25, metalness: 0.9 });
  const rubberMat = createLowPolyMaterial("#18181b", { roughness: 0.9, metalness: 0.05 });

  // 1. Wheels
  const wheelGeo = new THREE.TorusGeometry(0.42, 0.05, 12, 32);
  wheelGeo.computeVertexNormals();

  const frontWheel = new THREE.Mesh(wheelGeo, rubberMat);
  frontWheel.name = "Bicycle_Front_Wheel";
  frontWheel.position.set(0, 0.42, 0.9);
  frontWheel.castShadow = true;
  group.add(frontWheel);

  const rearWheel = new THREE.Mesh(wheelGeo, rubberMat);
  rearWheel.name = "Bicycle_Rear_Wheel";
  rearWheel.position.set(0, 0.42, -0.9);
  rearWheel.castShadow = true;
  group.add(rearWheel);

  // 2. Diamond Frame Tubing
  const frameGeo = new THREE.BoxGeometry(0.06, 0.06, 1.4);
  frameGeo.computeVertexNormals();
  const topTube = new THREE.Mesh(frameGeo, frameMat);
  topTube.name = "Bicycle_Top_Tube";
  topTube.position.set(0, 0.88, 0.0);
  group.add(topTube);

  const downTubeGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8);
  downTubeGeo.computeVertexNormals();
  const seatPost = new THREE.Mesh(downTubeGeo, metalMat);
  seatPost.name = "Bicycle_Seat_Post";
  seatPost.position.set(0, 0.72, -0.4);
  group.add(seatPost);

  // 3. Saddle
  const saddleGeo = new THREE.BoxGeometry(0.22, 0.05, 0.35);
  saddleGeo.computeVertexNormals();
  const saddle = new THREE.Mesh(saddleGeo, rubberMat);
  saddle.name = "Bicycle_Saddle";
  saddle.position.set(0, 1.05, -0.4);
  group.add(saddle);

  // 4. Handlebars
  const barGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.75, 8);
  barGeo.rotateZ(Math.PI / 2);
  barGeo.computeVertexNormals();
  const bars = new THREE.Mesh(barGeo, metalMat);
  bars.name = "Bicycle_Handlebars";
  bars.position.set(0, 1.15, 0.65);
  group.add(bars);

  return group;
}

/**
 * Intelligent Dynamic Generative CAD Synthesizer
 * Synthesizes a tailored, multi-part CAD model for ANY arbitrary prompt
 * (e.g. "guitar", "spaceship station", "clock", "generator", "camera", "bridge", etc.)
 * so the system NEVER falls back to an unrelated turbine flange!
 */
export function createDynamicGenerativeCadModel(prompt: string): THREE.Group {
  const p = prompt.toLowerCase();
  const group = new THREE.Group();

  // Extract a clean capitalized subject name for parts
  const words = prompt.replace(/[^a-zA-Z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const stopWords = new Set(["a", "an", "the", "make", "create", "model", "build", "generate", "with", "and", "of", "in", "like", "3d", "cad", "full"]);
  const subjectWords = words.filter((w) => !stopWords.has(w.toLowerCase()));
  const subjectName = subjectWords.length > 0
    ? subjectWords.slice(0, 2).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("_")
    : "Object";

  group.name = `Procedural_${subjectName}`;

  // Color extraction from prompt
  let primaryColor = "#3b82f6"; // default sleek engineering blue
  let accentColor = "#ea580c";  // default vivid orange
  let metalValue = 0.55;
  let roughValue = 0.4;

  if (p.includes("gold") || p.includes("brass") || p.includes("bronze")) {
    primaryColor = "#d97706";
    accentColor = "#fbbf24";
    metalValue = 0.9;
    roughValue = 0.25;
  } else if (p.includes("silver") || p.includes("chrome") || p.includes("steel") || p.includes("metal")) {
    primaryColor = "#94a3b8";
    accentColor = "#cbd5e1";
    metalValue = 0.95;
    roughValue = 0.2;
  } else if (p.includes("dark") || p.includes("black") || p.includes("stealth") || p.includes("carbon")) {
    primaryColor = "#18181b";
    accentColor = "#3f3f46";
    metalValue = 0.7;
    roughValue = 0.5;
  } else if (p.includes("red") || p.includes("crimson") || p.includes("ruby")) {
    primaryColor = "#dc2626";
    accentColor = "#f87171";
  } else if (p.includes("green") || p.includes("emerald") || p.includes("forest")) {
    primaryColor = "#16a34a";
    accentColor = "#4ade80";
  } else if (p.includes("purple") || p.includes("violet") || p.includes("amethyst")) {
    primaryColor = "#9333ea";
    accentColor = "#c084fc";
  } else if (p.includes("orange") || p.includes("amber")) {
    primaryColor = "#ea580c";
    accentColor = "#fb923c";
  } else if (p.includes("white") || p.includes("ceramic") || p.includes("marble")) {
    primaryColor = "#f8fafc";
    accentColor = "#e2e8f0";
    metalValue = 0.1;
    roughValue = 0.3;
  }

  const primaryMat = createLowPolyMaterial(primaryColor, { roughness: roughValue, metalness: metalValue });
  const accentMat = createLowPolyMaterial(accentColor, { roughness: 0.3, metalness: 0.8 });
  const trimMat = createLowPolyMaterial("#27272a", { roughness: 0.65, metalness: 0.5 });
  const glassMat = createLowPolyMaterial("#38bdf8", { roughness: 0.1, metalness: 0.9, emissive: new THREE.Color("#0284c7"), emissiveIntensity: 0.3 });

  // Determine geometry profile based on prompt semantics
  const isSpherical = p.includes("sphere") || p.includes("orb") || p.includes("ball") || p.includes("globe") || p.includes("planet") || p.includes("satellite");
  const isVertical = p.includes("tower") || p.includes("tall") || p.includes("pillar") || p.includes("monument") || p.includes("spire") || p.includes("antenna") || p.includes("pylon");
  const isCubic = p.includes("box") || p.includes("cube") || p.includes("console") || p.includes("computer") || p.includes("device") || p.includes("battery") || p.includes("generator");

  if (isSpherical) {
    // 1. Core Sphere
    const sphereGeo = new THREE.SphereGeometry(0.85, 24, 16);
    sphereGeo.computeVertexNormals();
    const core = new THREE.Mesh(sphereGeo, primaryMat);
    core.name = `${subjectName}_Core_Sphere`;
    core.position.set(0, 1.2, 0);
    core.castShadow = true;
    group.add(core);

    // 2. Equatorial Gimbal Ring
    const ringGeo = new THREE.TorusGeometry(1.15, 0.06, 12, 36);
    ringGeo.computeVertexNormals();
    const ring = new THREE.Mesh(ringGeo, accentMat);
    ring.name = `${subjectName}_Equatorial_Ring`;
    ring.position.set(0, 1.2, 0);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // 3. Polar Caps
    const capGeo = new THREE.CylinderGeometry(0.25, 0.35, 0.2, 16);
    capGeo.computeVertexNormals();
    const capTop = new THREE.Mesh(capGeo, trimMat);
    capTop.name = `${subjectName}_Polar_Cap_Top`;
    capTop.position.set(0, 2.05, 0);
    group.add(capTop);

    // 4. Pedestal Mount
    const pedGeo = new THREE.CylinderGeometry(0.12, 0.55, 0.6, 16);
    pedGeo.computeVertexNormals();
    const pedestal = new THREE.Mesh(pedGeo, trimMat);
    pedestal.name = `${subjectName}_Mounting_Pedestal`;
    pedestal.position.set(0, 0.3, 0);
    group.add(pedestal);

  } else if (isVertical) {
    // 1. Plinth Base
    const baseGeo = new THREE.BoxGeometry(1.6, 0.25, 1.6);
    baseGeo.computeVertexNormals();
    const base = new THREE.Mesh(baseGeo, trimMat);
    base.name = `${subjectName}_Plinth_Base`;
    base.position.set(0, 0.125, 0);
    group.add(base);

    // 2. Main Tower Shaft
    const shaftGeo = new THREE.BoxGeometry(1.0, 2.4, 1.0);
    shaftGeo.computeVertexNormals();
    const shaft = new THREE.Mesh(shaftGeo, primaryMat);
    shaft.name = `${subjectName}_Tower_Shaft`;
    shaft.position.set(0, 1.45, 0);
    shaft.castShadow = true;
    group.add(shaft);

    // 3. Tiered Crown
    const crownGeo = new THREE.BoxGeometry(1.2, 0.35, 1.2);
    crownGeo.computeVertexNormals();
    const crown = new THREE.Mesh(crownGeo, accentMat);
    crown.name = `${subjectName}_Capital_Crown`;
    crown.position.set(0, 2.8, 0);
    group.add(crown);

    // 4. Spire Needle
    const spireGeo = new THREE.ConeGeometry(0.2, 1.0, 8);
    spireGeo.computeVertexNormals();
    const spire = new THREE.Mesh(spireGeo, accentMat);
    spire.name = `${subjectName}_Apex_Spire`;
    spire.position.set(0, 3.45, 0);
    spire.castShadow = true;
    group.add(spire);

  } else if (isCubic) {
    // 1. Main Beveled Enclosure
    const boxGeo = new THREE.BoxGeometry(1.8, 1.1, 1.4);
    boxGeo.computeVertexNormals();
    const box = new THREE.Mesh(boxGeo, primaryMat);
    box.name = `${subjectName}_Enclosure_Chassis`;
    box.position.set(0, 0.65, 0);
    box.castShadow = true;
    group.add(box);

    // 2. Control Interface Panel
    const panelGeo = new THREE.BoxGeometry(1.5, 0.75, 0.08);
    panelGeo.computeVertexNormals();
    const panel = new THREE.Mesh(panelGeo, trimMat);
    panel.name = `${subjectName}_Front_Panel`;
    panel.position.set(0, 0.65, 0.72);
    group.add(panel);

    // 3. Status Display Screen
    const screenGeo = new THREE.BoxGeometry(0.9, 0.45, 0.05);
    screenGeo.computeVertexNormals();
    const screen = new THREE.Mesh(screenGeo, glassMat);
    screen.name = `${subjectName}_Display_Screen`;
    screen.position.set(-0.2, 0.68, 0.76);
    group.add(screen);

    // 4. Top Ventilation Heat Sink
    const ventGeo = new THREE.BoxGeometry(1.4, 0.1, 1.0);
    ventGeo.computeVertexNormals();
    const vent = new THREE.Mesh(ventGeo, accentMat);
    vent.name = `${subjectName}_Cooling_Vent`;
    vent.position.set(0, 1.24, 0);
    group.add(vent);

  } else {
    // High-Precision Multi-Tiered Modular CAD Assembly
    // 1. Base Flange Plate
    const baseGeo = new THREE.CylinderGeometry(1.25, 1.35, 0.22, 24);
    baseGeo.computeVertexNormals();
    const base = new THREE.Mesh(baseGeo, trimMat);
    base.name = `${subjectName}_Foundation_Plate`;
    base.position.set(0, 0.11, 0);
    base.castShadow = true;
    group.add(base);

    // 2. Primary Feature Housing
    const bodyGeo = new THREE.CylinderGeometry(0.9, 1.05, 1.2, 24);
    bodyGeo.computeVertexNormals();
    const body = new THREE.Mesh(bodyGeo, primaryMat);
    body.name = `${subjectName}_Primary_Housing`;
    body.position.set(0, 0.82, 0);
    body.castShadow = true;
    group.add(body);

    // 3. Accent Retaining Ring
    const collarGeo = new THREE.TorusGeometry(0.98, 0.08, 12, 32);
    collarGeo.computeVertexNormals();
    const collar = new THREE.Mesh(collarGeo, accentMat);
    collar.name = `${subjectName}_Retaining_Bezel`;
    collar.position.set(0, 1.35, 0);
    collar.rotation.x = Math.PI / 2;
    group.add(collar);

    // 4. Top Finial / Optical Core
    const coreGeo = new THREE.SphereGeometry(0.48, 18, 12);
    coreGeo.computeVertexNormals();
    const core = new THREE.Mesh(coreGeo, glassMat);
    core.name = `${subjectName}_Optical_Core`;
    core.position.set(0, 1.7, 0);
    core.castShadow = true;
    group.add(core);

    // 5. Perimeter Fasteners (4x metric bolts)
    const boltGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8);
    boltGeo.computeVertexNormals();
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const bolt = new THREE.Mesh(boltGeo, accentMat);
      bolt.name = `${subjectName}_Bolt_${i + 1}`;
      bolt.position.set(Math.cos(angle) * 1.15, 0.26, Math.sin(angle) * 1.15);
      group.add(bolt);
    }
  }

  return group;
}

export function generateProceduralModelFromPrompt(prompt: string): THREE.Object3D {
  const p = prompt.toLowerCase();

  // 1. Vehicles: Car, Automobile, Truck
  if (
    p.includes("car") ||
    p.includes("automobile") ||
    p.includes("vehicle") ||
    p.includes("truck") ||
    p.includes("van") ||
    p.includes("sedan") ||
    p.includes("coupe") ||
    p.includes("jeep") ||
    p.includes("hotrod")
  ) {
    return createProceduralCar();
  }

  // 2. Aviation: Airplane, Jet, Aircraft
  if (
    p.includes("airplane") ||
    p.includes("aeroplane") ||
    p.includes("plane") ||
    p.includes("aircraft") ||
    p.includes("jet") ||
    p.includes("glider") ||
    p.includes("biplane")
  ) {
    return createProceduralAirplane();
  }

  // 3. Marine: Boat, Ship, Yacht
  if (
    p.includes("boat") ||
    p.includes("ship") ||
    p.includes("yacht") ||
    p.includes("vessel") ||
    p.includes("ferry") ||
    p.includes("canoe") ||
    p.includes("tugboat")
  ) {
    return createProceduralBoat();
  }

  // 4. Electronics: Laptop, Computer
  if (
    p.includes("laptop") ||
    p.includes("notebook") ||
    p.includes("macbook") ||
    p.includes("computer") ||
    p.includes("pc")
  ) {
    return createProceduralLaptop();
  }

  // 5. Nature: Tree, Pine, Oak, Forest
  if (
    p.includes("tree") ||
    p.includes("plant") ||
    p.includes("pine") ||
    p.includes("oak") ||
    p.includes("forest") ||
    p.includes("woodland") ||
    p.includes("shrub")
  ) {
    return createProceduralTreeModel();
  }

  // 6. Architecture: House, Building, Cabin, Home
  if (
    p.includes("house") ||
    p.includes("building") ||
    p.includes("cabin") ||
    p.includes("cottage") ||
    p.includes("home") ||
    p.includes("shed") ||
    p.includes("barn") ||
    p.includes("villa")
  ) {
    return createProceduralBuildingModel();
  }

  // 7. Furniture: Table, Desk
  if (p.includes("table") || p.includes("desk") || p.includes("workbench") || p.includes("counter")) {
    return createProceduralTableGroup();
  }

  // 8. Furniture: Chair, Stool, Seat
  if (p.includes("chair") || p.includes("seat") || p.includes("stool") || p.includes("bench") || p.includes("armchair")) {
    return createProceduralChairGroup();
  }

  // 9. Vehicles: Bicycle, Bike
  if (p.includes("bicycle") || p.includes("bike") || p.includes("cycle")) {
    return createProceduralBicycle();
  }

  // 10. Weapons: Battleaxe, Axe
  if (p.includes("axe") || p.includes("battleaxe") || p.includes("hatchet") || p.includes("tomahawk")) {
    return createProceduralBattleaxe();
  }

  // 11. Drones: Hover drone, Quadcopter
  if (p.includes("drone") || p.includes("hover") || p.includes("quadcopter") || p.includes("copter")) {
    return createProceduralHoverDrone();
  }

  // 12. Weapons: Sword, Blade, Dagger
  if (p.includes("sword") || p.includes("blade") || p.includes("dagger") || p.includes("saber") || p.includes("katana")) {
    return createProceduralSword();
  }

  // 13. Mechanical: Bevel Gear, Cog
  if (p.includes("gear") || p.includes("cog") || p.includes("sprocket") || p.includes("pinion")) {
    return createProceduralBevelGear();
  }

  // 14. Kitchenware: Coffee Mug, Cup
  if (p.includes("mug") || p.includes("cup") || p.includes("coffee") || p.includes("tea") || p.includes("goblet")) {
    return createProceduralCoffeeMug();
  }

  // 15. Containers: Sci-Fi Crate, Box
  if (p.includes("crate") || p.includes("cargo") || p.includes("box") || p.includes("container") || p.includes("chest")) {
    return createProceduralSciFiCrate();
  }

  // 16. Lighting: Lantern, Lamp
  if (p.includes("lamp") || p.includes("lantern") || p.includes("light") || p.includes("torch")) {
    return generateLowPolyProp("lantern");
  }

  // 17. Animals: Cow, Bull, Ox
  if (p.includes("cow") || p.includes("bull") || p.includes("ox") || p.includes("cattle") || p.includes("calf")) {
    return createProceduralCow();
  }

  // 18. Animals: Sheep, Ram, Lamb
  if (p.includes("sheep") || p.includes("ram") || p.includes("lamb")) {
    return createProceduralSheep();
  }

  // 18b. Animals: Cat, Kitten, Kitty, Feline
  if (p.includes("cat") || p.includes("kitten") || p.includes("kitty") || p.includes("feline") || p.includes("meow")) {
    return createProceduralCat();
  }

  // 19. Space: Rocket, Starship, Spaceship
  if (p.includes("rocket") || p.includes("starship") || p.includes("spaceship") || p.includes("rocket ship") || p.includes("missile") || p.includes("shuttle")) {
    return createProceduralRocketShip();
  }

  // 20. Military: Tank, Panzer
  if (p.includes("tank") || p.includes("panzer") || p.includes("armored")) {
    return createProceduralTank();
  }

  // 21. Medieval: Castle, Fortress, Citadel
  if (p.includes("castle") || p.includes("fortress") || p.includes("citadel") || p.includes("keep")) {
    return createProceduralCastle();
  }

  // 22. Robotics: Robot, Android, Mech
  if (p.includes("robot") || p.includes("android") || p.includes("mech") || p.includes("cyborg") || p.includes("droid")) {
    return createProceduralRobot();
  }

  // 23. Monuments: Pyramid
  if (p.includes("pyramid")) {
    return createProceduralPyramid();
  }

  // 24. Explicit CAD Flange / Turbine
  if (p.includes("flange") || p.includes("turbine")) {
    return createProceduralTurbineFlange();
  }

  // 25. For ANY other prompt, dynamically synthesize a tailored multi-part CAD model!
  // NEVER fall back to a turbine flange unless explicitly requested!
  return createDynamicGenerativeCadModel(prompt);
}


