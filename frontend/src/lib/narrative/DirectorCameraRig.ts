import * as THREE from "three";
import { NarrativeCamera, CameraKeyframe } from "./NarrativeSceneSchema";
import { LowPolyCharacter } from "./LowPolyCharacterRig";

export interface CameraFrameState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export interface CameraCutPoint {
  frame: number;
  cameraType?: "wide" | "close" | "tracking" | "shoulder" | "dolly" | "orbit" | "static";
  pos?: [number, number, number];
  lookAt?: [number, number, number];
}

export class DirectorCameraRig {
  public camera: THREE.PerspectiveCamera;
  public shotDescriptor: any;
  public targetActor: LowPolyCharacter | null = null;
  public sceneCenter: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Reusable vectors for performance
  private _tempPos = new THREE.Vector3();
  private _tempLook = new THREE.Vector3();
  private _actorForward = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, shotDescriptor?: any) {
    this.camera = camera;
    this.shotDescriptor = shotDescriptor || { keyframes: [] };
    if (this.shotDescriptor.fov) {
      this.camera.fov = this.shotDescriptor.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  public setTargetActor(actor: LowPolyCharacter | null) {
    this.targetActor = actor;
  }

  public setSceneCenter(center: THREE.Vector3) {
    this.sceneCenter.copy(center);
  }

  /**
   * Evaluates camera pose at a given frame and total duration.
   */
  public evaluateFrame(currentFrame: number, totalFrames: number): CameraFrameState {
    const progress = totalFrames > 0 ? Math.min(Math.max(currentFrame / totalFrames, 0), 1) : 0;
    const actorPos = this.targetActor ? this.targetActor.group.position : this.sceneCenter;

    // Check for keyframes in shotDescriptor
    const keyframes: CameraKeyframe[] = this.shotDescriptor?.keyframes || [];
    if (keyframes.length > 0) {
      const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);

      // Find active keyframe pair for interpolation
      let k0 = sorted[0];
      let k1 = sorted[sorted.length - 1];

      for (let i = 0; i < sorted.length - 1; i++) {
        if (currentFrame >= sorted[i].frame && currentFrame <= sorted[i + 1].frame) {
          k0 = sorted[i];
          k1 = sorted[i + 1];
          break;
        }
      }

      if (currentFrame >= sorted[sorted.length - 1].frame) {
        k0 = sorted[sorted.length - 1];
        k1 = sorted[sorted.length - 1];
      }

      const frameSpan = k1.frame - k0.frame;
      const alpha = frameSpan > 0 ? Math.min(Math.max((currentFrame - k0.frame) / frameSpan, 0), 1) : 0;

      const p0 = new THREE.Vector3(...k0.position);
      const p1 = new THREE.Vector3(...k1.position);
      const t0 = new THREE.Vector3(...k0.target);
      const t1 = new THREE.Vector3(...k1.target);

      const interpPos = p0.lerp(p1, alpha);
      const interpTarget = t0.lerp(t1, alpha);
      const interpFov = k0.fov + (k1.fov - k0.fov) * alpha;

      return {
        position: interpPos,
        target: interpTarget,
        fov: interpFov || 42,
      };
    }

    // Default shot calculations
    const targetPos = this._tempPos.set(0, 5, 12);
    const targetLook = this._tempLook.copy(actorPos);
    const fov = 42;

    const drift = progress * 1.5;
    targetPos.set(9 - drift, 5.5 - drift * 0.2, 13 - drift);
    targetLook.set(0, 1.2, 0);

    return {
      position: targetPos.clone(),
      target: targetLook.clone(),
      fov,
    };
  }

  /**
   * Applies the evaluated camera pose directly to the Three.js PerspectiveCamera.
   */
  public updateAtFrame(currentFrame: number, totalFrames: number) {
    const frameState = this.evaluateFrame(currentFrame, totalFrames);
    this.camera.position.copy(frameState.position);
    this.camera.lookAt(frameState.target);
    if (this.camera.fov !== frameState.fov) {
      this.camera.fov = frameState.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
