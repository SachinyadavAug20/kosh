/**
 * Instant Client-Side Procedural Primitives & Assembly Library
 * Zero-latency (<10ms) procedural 3D model synthesis in Three.js
 */

import * as THREE from "three";
import {
  createProceduralCar,
  createProceduralAirplane,
  createProceduralBoat,
  createProceduralLaptop,
  createProceduralTableGroup,
  createProceduralChairGroup,
  createProceduralBicycle,
  createProceduralBattleaxe,
  createProceduralHoverDrone,
  createProceduralSword,
  createProceduralBevelGear,
  createProceduralCoffeeMug,
  createProceduralSciFiCrate,
  createProceduralCow,
  createProceduralSheep,
  createProceduralCat,
  createProceduralRocketShip,
  createProceduralTank,
  createProceduralCastle,
  createProceduralRobot,
  createProceduralPyramid,
  createProceduralTurbineFlange,
  createDynamicGenerativeCadModel,
} from "../narrative/LowPolyProceduralLibrary";

// -------------------------------------------------------------
// PBR Material Palette
// -------------------------------------------------------------
function makeMaterial(
  colorHex: string,
  options: { roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number } = {}
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: options.roughness ?? 0.6,
    metalness: options.metalness ?? 0.05,
    flatShading: true,
    emissive: options.emissive ? new THREE.Color(options.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: options.emissiveIntensity ?? 0.0,
  });
}

// -------------------------------------------------------------
// 1. Props & Nature: generateTree
// -------------------------------------------------------------
export function generateTree(type: "pine" | "oak" | "stylized" = "pine"): THREE.Group {
  const group = new THREE.Group();
  group.name = `Procedural_Tree_${type}`;

  const barkMat = makeMaterial("#5c3a21", { roughness: 0.85, metalness: 0.0 });
  const pineLeavesMat1 = makeMaterial("#1e3a1e", { roughness: 0.65 });
  const pineLeavesMat2 = makeMaterial("#2d5a27", { roughness: 0.65 });
  const pineLeavesMat3 = makeMaterial("#3b7a34", { roughness: 0.65 });
  const oakLeavesMat = makeMaterial("#16a34a", { roughness: 0.6 });
  const stylizedLeavesMat = makeMaterial("#059669", { roughness: 0.4, metalness: 0.1 });

  if (type === "oak") {
    // Oak: Tapered trunk + multiple cloud foliage clusters
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 2.2, 8);
    trunkGeo.computeVertexNormals();
    const trunk = new THREE.Mesh(trunkGeo, barkMat);
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    const foliageClusters = [
      { x: 0, y: 2.6, z: 0, r: 1.35 },
      { x: -0.65, y: 2.3, z: 0.4, r: 0.95 },
      { x: 0.7, y: 2.4, z: -0.3, r: 1.05 },
      { x: 0.2, y: 3.2, z: 0.2, r: 1.0 },
      { x: -0.3, y: 2.7, z: -0.6, r: 0.85 },
    ];

    foliageClusters.forEach((c, i) => {
      const fGeo = new THREE.DodecahedronGeometry(c.r, 1);
      fGeo.computeVertexNormals();
      const fMesh = new THREE.Mesh(fGeo, oakLeavesMat);
      fMesh.name = `Oak_Canopy_${i + 1}`;
      fMesh.position.set(c.x, c.y, c.z);
      fMesh.castShadow = true;
      group.add(fMesh);
    });

    return group;
  }

  if (type === "stylized") {
    // Stylized: Curved faceted spiral tree
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 2.8, 6);
    trunkGeo.computeVertexNormals();
    const trunk = new THREE.Mesh(trunkGeo, barkMat);
    trunk.position.set(0, 1.4, 0);
    trunk.rotation.z = -0.06;
    trunk.castShadow = true;
    group.add(trunk);

    const tiers = [
      { r: 1.4, h: 1.6, y: 2.2, ry: 0.2 },
      { r: 1.05, h: 1.4, y: 3.1, ry: 0.7 },
      { r: 0.7, h: 1.1, y: 3.9, ry: 1.2 },
      { r: 0.35, h: 0.8, y: 4.5, ry: 1.8 },
    ];

    tiers.forEach((t, i) => {
      const tierGeo = new THREE.ConeGeometry(t.r, t.h, 7);
      tierGeo.computeVertexNormals();
      const tier = new THREE.Mesh(tierGeo, stylizedLeavesMat);
      tier.name = `Stylized_Tier_${i + 1}`;
      tier.position.set(0, t.y, 0);
      tier.rotation.y = t.ry;
      tier.castShadow = true;
      group.add(tier);
    });

    return group;
  }

  // Default: Pine Tree (Procedural trunk + 3 layered cone clusters with randomized slight offsets)
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 2.0, 8);
  trunkGeo.computeVertexNormals();
  const trunk = new THREE.Mesh(trunkGeo, barkMat);
  trunk.name = "Pine_Trunk";
  trunk.position.y = 1.0;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const pineTiers = [
    { r: 1.4, h: 1.7, y: 2.1, mat: pineLeavesMat1, rotY: 0.1 },
    { r: 1.05, h: 1.5, y: 2.9, mat: pineLeavesMat2, rotY: 0.45 },
    { r: 0.7, h: 1.25, y: 3.65, mat: pineLeavesMat3, rotY: 0.8 },
  ];

  pineTiers.forEach((t, i) => {
    const coneGeo = new THREE.ConeGeometry(t.r, t.h, 8);
    coneGeo.computeVertexNormals();
    const cone = new THREE.Mesh(coneGeo, t.mat);
    cone.name = `Pine_Foliage_Layer_${i + 1}`;
    cone.position.set(0, t.y, 0);
    cone.rotation.y = t.rotY;
    cone.castShadow = true;
    group.add(cone);
  });

  return group;
}

// -------------------------------------------------------------
// 1b. Props & Nature: generateRock
// -------------------------------------------------------------
export function generateRock(detail: number = 1): THREE.Mesh {
  const geo = new THREE.DodecahedronGeometry(1.2, detail);
  const pos = geo.attributes.position;

  // Pseudo-random vertex displacement noise
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Deterministic procedural displacement noise
    const noise = Math.sin(x * 2.5) * Math.cos(y * 2.3) * Math.sin(z * 2.7) * 0.28;
    const factor = 1.0 + noise;

    pos.setXYZ(i, x * factor, y * (factor * 0.8), z * factor);
  }

  geo.computeVertexNormals();

  const rockMat = makeMaterial("#64748b", { roughness: 0.9, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, rockMat);
  mesh.name = "Procedural_Rock";
  mesh.position.y = 0.9;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// -------------------------------------------------------------
// 1c. Props & Nature: generateTerrain
// -------------------------------------------------------------
export function generateTerrain(size: number = 16, relief: number = 1.6): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size, 28, 28);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors: number[] = [];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    // Multi-frequency harmonic elevation
    const elevation =
      Math.sin(x * 0.35) * Math.cos(z * 0.35) * relief +
      Math.sin(x * 0.8 + z * 0.5) * (relief * 0.35) +
      Math.cos(x * 1.5 - z * 1.2) * (relief * 0.12);

    pos.setY(i, elevation);

    // Height-based vertex coloring
    if (elevation < -0.2) {
      colors.push(0.85, 0.78, 0.6); // Sand
    } else if (elevation < 0.8) {
      colors.push(0.18, 0.55, 0.22); // Green grass
    } else if (elevation < 1.3) {
      colors.push(0.45, 0.45, 0.48); // Mountain rock
    } else {
      colors.push(0.92, 0.94, 0.96); // Snow summit
    }
  }

  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geo, terrainMat);
  mesh.name = "Procedural_Terrain";
  mesh.receiveShadow = true;
  return mesh;
}

// -------------------------------------------------------------
// 2. Low-Poly Animals: generateWolf
// -------------------------------------------------------------
export function generateWolf(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Wolf";

  const greyFurMat = makeMaterial("#475569", { roughness: 0.7, metalness: 0.05 });
  const whiteFurMat = makeMaterial("#e2e8f0", { roughness: 0.8, metalness: 0.0 });
  const darkMat = makeMaterial("#1e293b", { roughness: 0.85 });
  const eyeMat = makeMaterial("#f59e0b", { roughness: 0.1, emissive: "#d97706", emissiveIntensity: 0.6 });

  // 1. Torso
  const torsoGeo = new THREE.BoxGeometry(0.65, 0.75, 1.4);
  torsoGeo.computeVertexNormals();
  const torso = new THREE.Mesh(torsoGeo, greyFurMat);
  torso.name = "Wolf_Torso";
  torso.position.set(0, 0.95, 0);
  torso.castShadow = true;
  group.add(torso);

  // 2. Chest & Underbelly
  const chestGeo = new THREE.BoxGeometry(0.55, 0.45, 0.9);
  chestGeo.computeVertexNormals();
  const chest = new THREE.Mesh(chestGeo, whiteFurMat);
  chest.name = "Wolf_Chest";
  chest.position.set(0, 0.8, 0.2);
  group.add(chest);

  // 3. Head & Snout
  const headGeo = new THREE.BoxGeometry(0.48, 0.45, 0.52);
  headGeo.computeVertexNormals();
  const head = new THREE.Mesh(headGeo, greyFurMat);
  head.name = "Wolf_Head";
  head.position.set(0, 1.4, 0.8);
  head.castShadow = true;
  group.add(head);

  // Snout
  const snoutGeo = new THREE.BoxGeometry(0.28, 0.22, 0.42);
  snoutGeo.computeVertexNormals();
  const snout = new THREE.Mesh(snoutGeo, whiteFurMat);
  snout.name = "Wolf_Snout";
  snout.position.set(0, 1.3, 1.15);
  group.add(snout);

  // Nose tip
  const noseGeo = new THREE.BoxGeometry(0.12, 0.08, 0.08);
  const nose = new THREE.Mesh(noseGeo, darkMat);
  nose.position.set(0, 1.36, 1.37);
  group.add(nose);

  // 4. Ears (Pointy Cones)
  for (const [side, sx] of [["Left", -0.16], ["Right", 0.16]] as const) {
    const earGeo = new THREE.ConeGeometry(0.12, 0.26, 4);
    earGeo.computeVertexNormals();
    const ear = new THREE.Mesh(earGeo, greyFurMat);
    ear.name = `Wolf_Ear_${side}`;
    ear.position.set(sx, 1.74, 0.75);
    ear.rotation.set(-0.15, 0, sx < 0 ? 0.25 : -0.25);
    group.add(ear);
  }

  // 5. Amber Eyes
  for (const [side, sx] of [["Left", -0.16], ["Right", 0.16]] as const) {
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.06);
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.name = `Wolf_Eye_${side}`;
    eye.position.set(sx, 1.46, 1.05);
    group.add(eye);
  }

  // 6. Four Articulated Legs
  const legPositions = [
    { name: "Wolf_Leg_Front_Left", x: -0.24, y: 0.48, z: 0.45 },
    { name: "Wolf_Leg_Front_Right", x: 0.24, y: 0.48, z: 0.45 },
    { name: "Wolf_Leg_Back_Left", x: -0.24, y: 0.48, z: -0.45 },
    { name: "Wolf_Leg_Back_Right", x: 0.24, y: 0.48, z: -0.45 },
  ];

  const upperLegGeo = new THREE.BoxGeometry(0.18, 0.55, 0.2);
  upperLegGeo.computeVertexNormals();
  const pawGeo = new THREE.BoxGeometry(0.2, 0.12, 0.26);
  pawGeo.computeVertexNormals();

  legPositions.forEach((pos) => {
    const leg = new THREE.Mesh(upperLegGeo, greyFurMat);
    leg.name = pos.name;
    leg.position.set(pos.x, pos.y, pos.z);
    leg.castShadow = true;
    group.add(leg);

    const paw = new THREE.Mesh(pawGeo, whiteFurMat);
    paw.name = `${pos.name}_Paw`;
    paw.position.set(pos.x, 0.06, pos.z + 0.04);
    group.add(paw);
  });

  // 7. Bushy Tail
  const tailSegments = [
    { x: 0, y: 0.95, z: -0.85, rx: -0.5 },
    { x: 0, y: 0.75, z: -1.15, rx: -0.25 },
    { x: 0, y: 0.5, z: -1.35, rx: 0.1 },
  ];
  const tailGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.4, 6);
  tailGeo.computeVertexNormals();

  tailSegments.forEach((seg, i) => {
    const tailSeg = new THREE.Mesh(tailGeo, i === 2 ? whiteFurMat : greyFurMat);
    tailSeg.name = `Wolf_Tail_${i + 1}`;
    tailSeg.position.set(seg.x, seg.y, seg.z);
    tailSeg.rotation.x = seg.rx;
    tailSeg.castShadow = true;
    group.add(tailSeg);
  });

  return group;
}

// -------------------------------------------------------------
// 3. Architecture & Hard-Surface
// -------------------------------------------------------------

// 3a. Procedural Crate
export function generateCrate(size: number = 1.2): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Crate";

  const woodMat = makeMaterial("#b45309", { roughness: 0.75 });
  const metalMat = makeMaterial("#1e293b", { roughness: 0.35, metalness: 0.85 });

  // Main Box
  const boxGeo = new THREE.BoxGeometry(size, size, size);
  boxGeo.computeVertexNormals();
  const box = new THREE.Mesh(boxGeo, woodMat);
  box.name = "Crate_Body";
  box.position.y = size / 2;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);

  // 8 Corner Reinforcements
  const cornerSize = size * 0.28;
  const cornerGeo = new THREE.BoxGeometry(cornerSize, cornerSize, cornerSize);
  cornerGeo.computeVertexNormals();

  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const corner = new THREE.Mesh(cornerGeo, metalMat);
        corner.position.set(
          sx * (size / 2 - cornerSize / 4),
          size / 2 + sy * (size / 2 - cornerSize / 4),
          sz * (size / 2 - cornerSize / 4)
        );
        group.add(corner);
      }
    }
  }

  // Cross Straps (Horizontal & Vertical banding)
  const bandGeo = new THREE.BoxGeometry(size * 1.02, size * 0.08, size * 1.02);
  const band = new THREE.Mesh(bandGeo, metalMat);
  band.position.y = size / 2;
  group.add(band);

  return group;
}

// 3b. Procedural Fence
export function generateFence(length: number = 3.6): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Fence";

  const woodMat = makeMaterial("#78350f", { roughness: 0.8 });

  // 3 Vertical Posts
  const postGeo = new THREE.BoxGeometry(0.18, 1.4, 0.18);
  postGeo.computeVertexNormals();

  const numPosts = 3;
  for (let i = 0; i < numPosts; i++) {
    const post = new THREE.Mesh(postGeo, woodMat);
    const x = -length / 2 + (i * length) / (numPosts - 1);
    post.name = `Fence_Post_${i + 1}`;
    post.position.set(x, 0.7, 0);
    post.castShadow = true;
    group.add(post);

    // Chamfered Post Cap
    const capGeo = new THREE.ConeGeometry(0.16, 0.18, 4);
    const cap = new THREE.Mesh(capGeo, woodMat);
    cap.position.set(x, 1.48, 0);
    cap.rotation.y = Math.PI / 4;
    group.add(cap);
  }

  // 2 Horizontal Cross Rails
  const railGeo = new THREE.BoxGeometry(length, 0.12, 0.08);
  railGeo.computeVertexNormals();

  for (const ry of [0.45, 1.05]) {
    const rail = new THREE.Mesh(railGeo, woodMat);
    rail.position.set(0, ry, 0.06);
    rail.castShadow = true;
    group.add(rail);
  }

  return group;
}

// 3c. Procedural Cabin
export function generateCabin(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Cabin";

  const woodMat = makeMaterial("#78350f", { roughness: 0.8 });
  const roofMat = makeMaterial("#991b1b", { roughness: 0.65 });
  const stoneMat = makeMaterial("#64748b", { roughness: 0.9 });
  const glassMat = makeMaterial("#38bdf8", { roughness: 0.1, metalness: 0.9 });

  // 1. Stone Foundation
  const fGeo = new THREE.BoxGeometry(3.6, 0.4, 3.6);
  fGeo.computeVertexNormals();
  const foundation = new THREE.Mesh(fGeo, stoneMat);
  foundation.name = "Cabin_Foundation";
  foundation.position.y = 0.2;
  foundation.receiveShadow = true;
  group.add(foundation);

  // 2. Timber Log Walls
  const wallGeo = new THREE.BoxGeometry(3.2, 2.0, 3.2);
  wallGeo.computeVertexNormals();
  const walls = new THREE.Mesh(wallGeo, woodMat);
  walls.name = "Cabin_Walls";
  walls.position.y = 1.4;
  walls.castShadow = true;
  group.add(walls);

  // 3. Gabled Shingle Roof
  const roofGeo = new THREE.ConeGeometry(2.7, 1.4, 4);
  roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.name = "Cabin_Roof";
  roof.position.y = 3.1;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.15, 1.0, 1.15);
  roof.castShadow = true;
  group.add(roof);

  // 4. Stone Chimney
  const chimGeo = new THREE.BoxGeometry(0.55, 2.2, 0.55);
  chimGeo.computeVertexNormals();
  const chimney = new THREE.Mesh(chimGeo, stoneMat);
  chimney.name = "Cabin_Chimney";
  chimney.position.set(1.0, 2.8, -0.9);
  chimney.castShadow = true;
  group.add(chimney);

  // 5. Windows
  for (const sx of [-0.8, 0.8]) {
    const winGeo = new THREE.BoxGeometry(0.55, 0.55, 0.08);
    const win = new THREE.Mesh(winGeo, glassMat);
    win.position.set(sx, 1.6, 1.62);
    group.add(win);
  }

  // 6. Plank Door
  const doorGeo = new THREE.BoxGeometry(0.65, 1.25, 0.1);
  const door = new THREE.Mesh(doorGeo, stoneMat);
  door.position.set(0, 1.05, 1.62);
  group.add(door);

  return group;
}

// 3d. Procedural Barrel
export function generateBarrel(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Procedural_Barrel";

  const woodMat = makeMaterial("#92400e", { roughness: 0.75 });
  const ironMat = makeMaterial("#1e293b", { roughness: 0.35, metalness: 0.9 });

  // Main Staves Body (bulged cylinder)
  const barrelGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.4, 16);
  barrelGeo.computeVertexNormals();
  const barrel = new THREE.Mesh(barrelGeo, woodMat);
  barrel.name = "Barrel_Body";
  barrel.position.y = 0.7;
  barrel.scale.set(1.12, 1.0, 1.12);
  barrel.castShadow = true;
  group.add(barrel);

  // 4 Iron Hoops
  for (const hy of [0.2, 0.55, 0.85, 1.2]) {
    const hoopGeo = new THREE.TorusGeometry(0.58, 0.03, 8, 24);
    hoopGeo.rotateX(Math.PI / 2);
    hoopGeo.computeVertexNormals();
    const hoop = new THREE.Mesh(hoopGeo, ironMat);
    hoop.position.y = hy;
    group.add(hoop);
  }

  return group;
}

// -------------------------------------------------------------
// 4. Master Instant Dispatcher (<5ms)
// -------------------------------------------------------------
export function generateInstantProcedural(promptOrKeyword: string): THREE.Object3D {
  const p = promptOrKeyword.toLowerCase().trim();

  // 1. Animals
  if (p.includes("wolf") || p.includes("hound") || p.includes("canine")) {
    return generateWolf();
  }
  if (p.includes("cat") || p.includes("kitten") || p.includes("kitty") || p.includes("feline") || p.includes("meow")) {
    return createProceduralCat();
  }
  if (p.includes("sheep") || p.includes("ram") || p.includes("lamb")) {
    return createProceduralSheep();
  }
  if (p.includes("cow") || p.includes("bull") || p.includes("ox") || p.includes("cattle")) {
    return createProceduralCow();
  }

  // 2. Nature & Landscape
  if (p.includes("oak")) {
    return generateTree("oak");
  }
  if (p.includes("stylized tree")) {
    return generateTree("stylized");
  }
  if (p.includes("tree") || p.includes("pine") || p.includes("plant") || p.includes("foliage")) {
    return generateTree("pine");
  }
  if (p.includes("rock") || p.includes("boulder") || p.includes("stone")) {
    return generateRock();
  }
  if (p.includes("terrain") || p.includes("landscape") || p.includes("relief") || p.includes("mountain") || p.includes("ground")) {
    return generateTerrain();
  }

  // 3. Architecture & Hard-Surface
  if (p.includes("crate") || p.includes("cargo") || p.includes("box")) {
    return generateCrate();
  }
  if (p.includes("fence") || p.includes("railing") || p.includes("barrier")) {
    return generateFence();
  }
  if (p.includes("cabin") || p.includes("house") || p.includes("cottage") || p.includes("home") || p.includes("shed")) {
    return generateCabin();
  }
  if (p.includes("barrel") || p.includes("keg") || p.includes("cask")) {
    return generateBarrel();
  }

  // 4. Vehicles & Robotics
  if (p.includes("car") || p.includes("vehicle") || p.includes("automobile") || p.includes("truck")) {
    return createProceduralCar();
  }
  if (p.includes("airplane") || p.includes("plane") || p.includes("jet") || p.includes("aircraft")) {
    return createProceduralAirplane();
  }
  if (p.includes("boat") || p.includes("ship") || p.includes("yacht")) {
    return createProceduralBoat();
  }
  if (p.includes("robot") || p.includes("android") || p.includes("mech") || p.includes("droid")) {
    return createProceduralRobot();
  }
  if (p.includes("rocket") || p.includes("starship") || p.includes("spaceship")) {
    return createProceduralRocketShip();
  }
  if (p.includes("tank") || p.includes("panzer")) {
    return createProceduralTank();
  }

  // 5. Furniture & Props
  if (p.includes("table") || p.includes("desk")) {
    return createProceduralTableGroup();
  }
  if (p.includes("chair") || p.includes("seat") || p.includes("stool")) {
    return createProceduralChairGroup();
  }
  if (p.includes("laptop") || p.includes("computer") || p.includes("notebook")) {
    return createProceduralLaptop();
  }
  if (p.includes("flange") || p.includes("turbine")) {
    return createProceduralTurbineFlange();
  }
  if (p.includes("gear") || p.includes("cog")) {
    return createProceduralBevelGear();
  }
  if (p.includes("sword") || p.includes("blade")) {
    return createProceduralSword();
  }
  if (p.includes("axe") || p.includes("battleaxe")) {
    return createProceduralBattleaxe();
  }
  if (p.includes("drone") || p.includes("hover")) {
    return createProceduralHoverDrone();
  }
  if (p.includes("mug") || p.includes("coffee") || p.includes("cup")) {
    return createProceduralCoffeeMug();
  }
  if (p.includes("castle") || p.includes("fortress")) {
    return createProceduralCastle();
  }
  if (p.includes("pyramid")) {
    return createProceduralPyramid();
  }
  if (p.includes("bicycle") || p.includes("bike")) {
    return createProceduralBicycle();
  }

  // Dynamic fallback CAD model
  return createDynamicGenerativeCadModel(promptOrKeyword);
}
