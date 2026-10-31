/**
 * TwoBoneIKSolver.ts
 * Analytical Two-Bone Inverse Kinematics (IK) Solver for Kosh characters.
 * 
 * Uses the Law of Cosines and pole vectors to deterministically resolve
 * knee/elbow joint flexion and foot/hand positioning in 3D space,
 * ensuring zero joint popping and natural terrain adaptation.
 */

import * as THREE from "three";

export interface IKSolution {
  jointPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  isReachable: boolean;
  distanceToTarget: number;
  kneeFlexionAngle: number; // in radians
  hipElevationAngle: number; // in radians
}

export class TwoBoneIKSolver {
  private static _vD = new THREE.Vector3();
  private static _vDNorm = new THREE.Vector3();
  private static _vPole = new THREE.Vector3();
  private static _vPolePerp = new THREE.Vector3();
  private static _vCross = new THREE.Vector3();
  private static _vUp = new THREE.Vector3(0, 1, 0);
  private static _mOrient = new THREE.Matrix4();
  private static _qOrient = new THREE.Quaternion();

  /**
   * Solves two-bone analytical inverse kinematics.
   * 
   * @param root World position of root joint (e.g. Hip or Shoulder)
   * @param target Desired world position of end effector (e.g. Foot or Hand)
   * @param pole World direction/position guiding knee or elbow bend direction
   * @param l1 Length of upper bone (e.g. Thigh = 0.44m)
   * @param l2 Length of lower bone (e.g. Calf = 0.42m)
   */
  public static solve(
    root: THREE.Vector3,
    target: THREE.Vector3,
    pole: THREE.Vector3,
    l1: number,
    l2: number
  ): IKSolution {
    // Vector from root to target
    this._vD.subVectors(target, root);
    const dRaw = this._vD.length();

    const maxReach = (l1 + l2) * 0.9999;
    const minReach = Math.abs(l1 - l2) * 1.0001;

    const isReachable = dRaw <= maxReach && dRaw >= minReach;
    const d = Math.max(minReach, Math.min(maxReach, dRaw));

    this._vDNorm.copy(this._vD).normalize();

    // Law of Cosines:
    // cos(beta) = (l1^2 + d^2 - l2^2) / (2 * l1 * d)
    // cos(alpha) = (l1^2 + l2^2 - d^2) / (2 * l1 * l2)
    const cosBeta = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    const cosAlpha = Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2)));

    const beta = Math.acos(cosBeta);
    const alpha = Math.acos(cosAlpha);

    // Pole Vector Projection onto the plane orthogonal to D
    this._vPole.subVectors(pole, root);
    const dotPoleD = this._vPole.dot(this._vDNorm);
    this._vPolePerp.copy(this._vPole).addScaledVector(this._vDNorm, -dotPoleD);

    if (this._vPolePerp.lengthSq() < 1e-6) {
      // Degenerate pole vector, compute default orthogonal vector
      if (Math.abs(this._vDNorm.y) < 0.9) {
        this._vPolePerp.crossVectors(this._vDNorm, this._vUp).normalize();
      } else {
        this._vPolePerp.crossVectors(this._vDNorm, new THREE.Vector3(1, 0, 0)).normalize();
      }
    } else {
      this._vPolePerp.normalize();
    }

    // Joint (Knee/Elbow) position:
    // J = Root + D_norm * (l1 * cos(beta)) + Pole_perp * (l1 * sin(beta))
    const jointPos = new THREE.Vector3()
      .copy(root)
      .addScaledVector(this._vDNorm, l1 * Math.cos(beta))
      .addScaledVector(this._vPolePerp, l1 * Math.sin(beta));

    const finalTarget = isReachable
      ? target.clone()
      : root.clone().addScaledVector(this._vDNorm, d);

    return {
      jointPosition: jointPos,
      targetPosition: finalTarget,
      isReachable,
      distanceToTarget: dRaw,
      kneeFlexionAngle: Math.PI - alpha,
      hipElevationAngle: beta,
    };
  }

  /**
   * Applies IK orientations to Three.js Object3D bones.
   * Orients upperBone towards jointPos and lowerBone towards targetPos.
   */
  public static applyToBones(
    upperBone: THREE.Object3D,
    lowerBone: THREE.Object3D,
    footBone: THREE.Object3D,
    rootPos: THREE.Vector3,
    jointPos: THREE.Vector3,
    targetPos: THREE.Vector3
  ) {
    // 1. Upper bone points to jointPos
    this._vD.subVectors(jointPos, rootPos).normalize();
    upperBone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), this._vD);

    // 2. Lower bone points to targetPos
    this._vD.subVectors(targetPos, jointPos).normalize();
    lowerBone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), this._vD);

    // 3. Foot level with ground
    footBone.quaternion.identity();
  }
}
