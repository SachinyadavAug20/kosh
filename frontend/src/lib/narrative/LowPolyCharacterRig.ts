import * as THREE from "three";
import { NarrativeActor, ActorAction, CharacterType } from "./NarrativeSceneSchema";
import { createLowPolyMaterial } from "./LowPolyProceduralLibrary";

export interface CharacterJoints {
  root: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  leftForearm: THREE.Group;
  leftHand: THREE.Group;
  rightArm: THREE.Group;
  rightForearm: THREE.Group;
  rightHand: THREE.Group;
  leftLeg: THREE.Group;
  leftKnee: THREE.Group;
  leftFoot: THREE.Group;
  rightLeg: THREE.Group;
  rightKnee: THREE.Group;
  rightFoot: THREE.Group;
}

export interface CharacterDescriptorCompatibility {
  id: string;
  name: string;
  characterType?: CharacterType;
  type?: string;
  colors?: {
    skin?: string;
    shirt?: string;
    pants?: string;
    hair?: string;
    boots?: string;
  };
  skinPalette?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  startPos?: [number, number, number];
  route?: [number, number, number][];
  path?: Array<{ frame: number; position: [number, number, number]; action: ActorAction }>;
  motion?: ActorAction;
  speed?: number;
}

export class LowPolyCharacter {
  public group: THREE.Group;
  public joints: CharacterJoints;
  public descriptor: CharacterDescriptorCompatibility;
  public curve: THREE.CatmullRomCurve3 | null = null;
  public currentMotion: ActorAction = "walk";

  private baseHipY: number = 0.88;

  constructor(descriptor: CharacterDescriptorCompatibility | NarrativeActor) {
    this.descriptor = descriptor as CharacterDescriptorCompatibility;
    this.currentMotion = (descriptor as any).motion || (descriptor as any).path?.[0]?.action || "walk";

    // Build CatmullRomCurve3 from route or path coordinates
    const waypoints: THREE.Vector3[] = [];
    if (this.descriptor.path && this.descriptor.path.length >= 2) {
      this.descriptor.path.forEach((p) => {
        waypoints.push(new THREE.Vector3(p.position[0], p.position[1], p.position[2]));
      });
    } else if (this.descriptor.route && this.descriptor.route.length >= 2) {
      this.descriptor.route.forEach((r) => {
        waypoints.push(new THREE.Vector3(r[0], r[1], r[2]));
      });
    }

    if (waypoints.length >= 2) {
      this.curve = new THREE.CatmullRomCurve3(waypoints, false, "centripetal", 0.5);
    }

    // Build the hierarchical rig
    const { group, joints } = this.buildRig();
    this.group = group;
    this.joints = joints;

    // Initial position
    if (this.descriptor.startPos) {
      this.group.position.set(
        this.descriptor.startPos[0],
        this.descriptor.startPos[1],
        this.descriptor.startPos[2]
      );
    } else if (this.descriptor.path && this.descriptor.path.length > 0) {
      const p0 = this.descriptor.path[0].position;
      this.group.position.set(p0[0], p0[1], p0[2]);
    }
  }

  private buildRig(): { group: THREE.Group; joints: CharacterJoints } {
    const root = new THREE.Group();
    root.name = `Character_${this.descriptor.id}`;

    const isRobot =
      this.descriptor.characterType === "robot" ||
      this.descriptor.type === "robot";

    const skinColor =
      this.descriptor.skinPalette?.primary ||
      this.descriptor.colors?.skin ||
      (isRobot ? "#94a3b8" : "#f8c291");

    const shirtColor =
      this.descriptor.skinPalette?.secondary ||
      this.descriptor.colors?.shirt ||
      (isRobot ? "#475569" : "#2563eb");

    const pantsColor =
      this.descriptor.skinPalette?.accent ||
      this.descriptor.colors?.pants ||
      (isRobot ? "#1e293b" : "#0f172a");

    const skinMat = createLowPolyMaterial(skinColor, { roughness: 0.7 });
    const shirtMat = createLowPolyMaterial(shirtColor, { roughness: 0.85 });
    const pantsMat = createLowPolyMaterial(pantsColor, { roughness: 0.9 });
    const bootsMat = createLowPolyMaterial("#18181b", { roughness: 0.95 });
    const metalMat = createLowPolyMaterial("#cbd5e1", { metalness: 0.8, roughness: 0.2 });

    // 1. Pelvis / Hips Group
    const hips = new THREE.Group();
    hips.position.y = this.baseHipY;
    root.add(hips);

    const hipsGeo = new THREE.BoxGeometry(0.38, 0.2, 0.26);
    const hipsMesh = new THREE.Mesh(hipsGeo, pantsMat);
    hipsMesh.castShadow = true;
    hips.add(hipsMesh);

    // 2. Spine & Chest
    const spine = new THREE.Group();
    spine.position.y = 0.1;
    hips.add(spine);

    const spineGeo = new THREE.BoxGeometry(0.4, 0.22, 0.26);
    const spineMesh = new THREE.Mesh(spineGeo, shirtMat);
    spineMesh.position.y = 0.11;
    spineMesh.castShadow = true;
    spine.add(spineMesh);

    const chest = new THREE.Group();
    chest.position.y = 0.22;
    spine.add(chest);

    const chestGeo = new THREE.BoxGeometry(0.46, 0.24, 0.3);
    const chestMesh = new THREE.Mesh(chestGeo, shirtMat);
    chestMesh.position.y = 0.12;
    chestMesh.castShadow = true;
    chest.add(chestMesh);

    // 3. Neck & Head
    const neck = new THREE.Group();
    neck.position.y = 0.24;
    chest.add(neck);

    const head = new THREE.Group();
    head.position.y = 0.08;
    neck.add(head);

    const headGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.y = 0.14;
    headMesh.castShadow = true;
    head.add(headMesh);

    // Robot Visor or Eyes
    if (isRobot) {
      const visorGeo = new THREE.BoxGeometry(0.24, 0.08, 0.06);
      const visorMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#38bdf8"),
        emissive: new THREE.Color("#0284c7"),
        emissiveIntensity: 1.5,
        roughness: 0.2,
      });
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.position.set(0, 0.14, 0.13);
      head.add(visor);
    } else {
      const eyeMat = createLowPolyMaterial("#09090b");
      const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.02);
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.07, 0.14, 0.145);
      head.add(eyeL);

      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(0.07, 0.14, 0.145);
      head.add(eyeR);

      // Hair cap
      const hairGeo = new THREE.BoxGeometry(0.31, 0.12, 0.31);
      const hairMat = createLowPolyMaterial("#451a03");
      const hair = new THREE.Mesh(hairGeo, hairMat);
      hair.position.set(0, 0.26, -0.02);
      head.add(hair);
    }

    // 4. Arms (Chest -> Shoulder -> UpperArm -> Elbow -> LowerArm -> Hand)
    const upperArmGeo = new THREE.BoxGeometry(0.12, 0.26, 0.12);
    const forearmGeo = new THREE.BoxGeometry(0.1, 0.24, 0.1);
    const handGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);

    // Left Arm
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.29, 0.14, 0);
    chest.add(leftArm);

    const leftUpperArmMesh = new THREE.Mesh(upperArmGeo, shirtMat);
    leftUpperArmMesh.position.y = -0.13;
    leftUpperArmMesh.castShadow = true;
    leftArm.add(leftUpperArmMesh);

    const leftForearm = new THREE.Group();
    leftForearm.position.y = -0.26;
    leftArm.add(leftForearm);

    const leftForearmMesh = new THREE.Mesh(forearmGeo, skinMat);
    leftForearmMesh.position.y = -0.12;
    leftForearmMesh.castShadow = true;
    leftForearm.add(leftForearmMesh);

    const leftHand = new THREE.Group();
    leftHand.position.y = -0.24;
    leftForearm.add(leftHand);

    const leftHandMesh = new THREE.Mesh(handGeo, skinMat);
    leftHandMesh.position.y = -0.04;
    leftHandMesh.castShadow = true;
    leftHand.add(leftHandMesh);

    // Right Arm
    const rightArm = new THREE.Group();
    rightArm.position.set(0.29, 0.14, 0);
    chest.add(rightArm);

    const rightUpperArmMesh = new THREE.Mesh(upperArmGeo, shirtMat);
    rightUpperArmMesh.position.y = -0.13;
    rightUpperArmMesh.castShadow = true;
    rightArm.add(rightUpperArmMesh);

    const rightForearm = new THREE.Group();
    rightForearm.position.y = -0.26;
    rightArm.add(rightForearm);

    const rightForearmMesh = new THREE.Mesh(forearmGeo, skinMat);
    rightForearmMesh.position.y = -0.12;
    rightForearmMesh.castShadow = true;
    rightForearm.add(rightForearmMesh);

    const rightHand = new THREE.Group();
    rightHand.position.y = -0.24;
    rightForearm.add(rightHand);

    const rightHandMesh = new THREE.Mesh(handGeo, skinMat);
    rightHandMesh.position.y = -0.04;
    rightHandMesh.castShadow = true;
    rightHand.add(rightHandMesh);

    // 5. Legs (Hips -> UpperLeg -> Knee -> LowerLeg -> Foot)
    const upperLegGeo = new THREE.BoxGeometry(0.16, 0.4, 0.16);
    const lowerLegGeo = new THREE.BoxGeometry(0.14, 0.38, 0.14);
    const footGeo = new THREE.BoxGeometry(0.15, 0.1, 0.24);

    // Left Leg
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.13, -0.08, 0);
    hips.add(leftLeg);

    const leftUpperLegMesh = new THREE.Mesh(upperLegGeo, pantsMat);
    leftUpperLegMesh.position.y = -0.2;
    leftUpperLegMesh.castShadow = true;
    leftLeg.add(leftUpperLegMesh);

    const leftKnee = new THREE.Group();
    leftKnee.position.y = -0.4;
    leftLeg.add(leftKnee);

    const leftLowerLegMesh = new THREE.Mesh(lowerLegGeo, pantsMat);
    leftLowerLegMesh.position.y = -0.19;
    leftLowerLegMesh.castShadow = true;
    leftKnee.add(leftLowerLegMesh);

    const leftFoot = new THREE.Group();
    leftFoot.position.y = -0.38;
    leftKnee.add(leftFoot);

    const leftFootMesh = new THREE.Mesh(footGeo, bootsMat);
    leftFootMesh.position.set(0, -0.05, 0.05);
    leftFootMesh.castShadow = true;
    leftFoot.add(leftFootMesh);

    // Right Leg
    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.13, -0.08, 0);
    hips.add(rightLeg);

    const rightUpperLegMesh = new THREE.Mesh(upperLegGeo, pantsMat);
    rightUpperLegMesh.position.y = -0.2;
    rightUpperLegMesh.castShadow = true;
    rightLeg.add(rightUpperLegMesh);

    const rightKnee = new THREE.Group();
    rightKnee.position.y = -0.4;
    rightLeg.add(rightKnee);

    const rightLowerLegMesh = new THREE.Mesh(lowerLegGeo, pantsMat);
    rightLowerLegMesh.position.y = -0.19;
    rightLowerLegMesh.castShadow = true;
    rightKnee.add(rightLowerLegMesh);

    const rightFoot = new THREE.Group();
    rightFoot.position.y = -0.38;
    rightKnee.add(rightFoot);

    const rightFootMesh = new THREE.Mesh(footGeo, bootsMat);
    rightFootMesh.position.set(0, -0.05, 0.05);
    rightFootMesh.castShadow = true;
    rightFoot.add(rightFootMesh);

    return {
      group: root,
      joints: {
        root,
        hips,
        spine,
        chest,
        neck,
        head,
        leftArm,
        leftForearm,
        leftHand,
        rightArm,
        rightForearm,
        rightHand,
        leftLeg,
        leftKnee,
        leftFoot,
        rightLeg,
        rightKnee,
        rightFoot,
      },
    };
  }

  // -------------------------------------------------------------
  // Mathematical Procedural Locomotion: Walk Cycle Formulation
  // (Pelvis sway, vertical bounce, leg swing, knee lift, arm counter-swing)
  // -------------------------------------------------------------
  public evaluateWalkKinematics(t: number, speed: number = 1.0) {
    const { hips, spine, chest, head, leftArm, leftForearm, rightArm, rightForearm, leftLeg, leftKnee, rightLeg, rightKnee } =
      this.joints;

    const amplitude = 0.04;
    const bounceHeight = 0.045;
    const legAngleMax = 0.48;
    const kneeAngleMax = 0.65;
    const armAngleMax = 0.42;

    // Pelvis sway: sin(t * 2) * amplitude
    hips.rotation.z = Math.sin(t * 2) * amplitude;

    // Vertical bounce: abs(sin(t)) * bounceHeight
    hips.position.y = this.baseHipY - Math.abs(Math.sin(t)) * bounceHeight;

    // Leg forward/backward swing: sin(t) * legAngleMax
    leftLeg.rotation.x = Math.sin(t) * legAngleMax;
    rightLeg.rotation.x = -Math.sin(t) * legAngleMax;

    // Knee bend: max(0, -cos(t) * kneeAngleMax) simulating realistic lift
    leftKnee.rotation.x = Math.max(0, -Math.cos(t) * kneeAngleMax);
    rightKnee.rotation.x = Math.max(0, Math.cos(t) * kneeAngleMax);

    // Arm counter-swing: -sin(t) * armAngleMax
    leftArm.rotation.x = -Math.sin(t) * armAngleMax;
    rightArm.rotation.x = Math.sin(t) * armAngleMax;

    leftForearm.rotation.x = -(0.2 + Math.max(0, -Math.sin(t) * 0.25));
    rightForearm.rotation.x = -(0.2 + Math.max(0, Math.sin(t) * 0.25));

    // Spine and head counter-rotation
    spine.rotation.y = -Math.sin(t) * 0.08;
    head.rotation.y = Math.sin(t) * 0.04;
  }

  // -------------------------------------------------------------
  // Mathematical Procedural Locomotion: Run Cycle Formulation
  // -------------------------------------------------------------
  public evaluateRunKinematics(t: number, speed: number = 1.2) {
    const { hips, spine, head, leftArm, leftForearm, rightArm, rightForearm, leftLeg, leftKnee, rightLeg, rightKnee } =
      this.joints;

    spine.rotation.x = 0.24; // Forward forward-lean
    head.rotation.x = -0.16;

    // High bounce
    hips.position.y = this.baseHipY - Math.abs(Math.sin(t)) * 0.1;
    hips.rotation.z = Math.sin(t * 2) * 0.06;

    // Deep leg strides
    leftLeg.rotation.x = Math.sin(t) * 0.95;
    rightLeg.rotation.x = -Math.sin(t) * 0.95;

    // High knee lift
    leftKnee.rotation.x = Math.max(0, -Math.cos(t) * 1.2);
    rightKnee.rotation.x = Math.max(0, Math.cos(t) * 1.2);

    // Powerful arm pumping
    leftArm.rotation.x = -Math.sin(t) * 0.85;
    rightArm.rotation.x = Math.sin(t) * 0.85;
    leftForearm.rotation.x = -1.25;
    rightForearm.rotation.x = -1.25;

    spine.rotation.y = -Math.sin(t) * 0.16;
  }

  // -------------------------------------------------------------
  // Mathematical Procedural: Idle Kinematics (Breathing)
  // -------------------------------------------------------------
  public evaluateIdleKinematics(time: number) {
    const { hips, spine, chest, head, leftArm, leftForearm, rightArm, rightForearm, leftLeg, rightLeg, leftKnee, rightKnee } =
      this.joints;

    const breathe = Math.sin(time * 2.2);
    chest.scale.set(1 + breathe * 0.02, 1 + breathe * 0.025, 1 + breathe * 0.02);

    hips.position.y = this.baseHipY;
    hips.rotation.set(0, 0, Math.sin(time * 0.8) * 0.02);
    spine.rotation.set(0, Math.sin(time * 0.5) * 0.04, 0);

    head.rotation.set(Math.cos(time * 0.9) * 0.05, Math.sin(time * 0.6) * 0.14, 0);

    leftArm.rotation.set(0.05, 0, -0.08 + breathe * 0.02);
    rightArm.rotation.set(0.05, 0, 0.08 - breathe * 0.02);
    leftForearm.rotation.set(-0.1, 0, 0);
    rightForearm.rotation.set(-0.1, 0, 0);

    leftLeg.rotation.set(0, 0, -0.04);
    rightLeg.rotation.set(0, 0, 0.04);
    leftKnee.rotation.set(0, 0, 0);
    rightKnee.rotation.set(0, 0, 0);
  }

  // -------------------------------------------------------------
  // Mathematical Procedural: Wave Kinematics
  // -------------------------------------------------------------
  public evaluateWaveKinematics(time: number) {
    this.evaluateIdleKinematics(time);
    const { rightArm, rightForearm, head } = this.joints;

    // Right arm raised high
    rightArm.rotation.set(-2.2, 0.3, 0.4);
    // Forearm waving back and forth rapidly
    rightForearm.rotation.set(0, 0, Math.sin(time * 7.0) * 0.45 - 0.2);
    // Head looking towards viewer/camera
    head.rotation.set(-0.1, 0.2, 0);
  }

  // -------------------------------------------------------------
  // Mathematical Procedural: Look Around
  // -------------------------------------------------------------
  public evaluateLookAroundKinematics(time: number) {
    this.evaluateIdleKinematics(time);
    const { head, spine } = this.joints;
    head.rotation.y = Math.sin(time * 1.2) * 0.55;
    head.rotation.x = Math.cos(time * 0.9) * 0.18;
    spine.rotation.y = Math.sin(time * 1.2) * 0.22;
  }

  // -------------------------------------------------------------
  // Update at Timeline Progress [0, 1]
  // -------------------------------------------------------------
  public updateAtProgress(progress: number, totalDurationSec: number = 6) {
    const clampedProgress = Math.min(Math.max(progress, 0), 1);
    const currentTimeSec = clampedProgress * totalDurationSec;

    // Path evaluation with CatmullRomCurve3
    if (this.curve) {
      const position = this.curve.getPointAt(clampedProgress);
      this.group.position.copy(position);

      const tangent = this.curve.getTangentAt(clampedProgress);
      if (tangent.lengthSq() > 0.001) {
        const targetLook = position.clone().add(tangent);
        targetLook.y = position.y; // Keep upright on ground plane
        this.group.lookAt(targetLook);
      }
    }

    const t = currentTimeSec * Math.PI * 2 * (this.currentMotion === "run" ? 2.8 : 1.6);

    switch (this.currentMotion) {
      case "walk":
        this.evaluateWalkKinematics(t);
        break;
      case "run":
        this.evaluateRunKinematics(t);
        break;
      case "wave":
        this.evaluateWaveKinematics(currentTimeSec);
        break;
      case "look_around":
        this.evaluateLookAroundKinematics(currentTimeSec);
        break;
      case "idle":
      default:
        this.evaluateIdleKinematics(currentTimeSec);
        break;
    }
  }

  public setMotion(action: ActorAction) {
    this.currentMotion = action;
  }
}
