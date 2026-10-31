/**
 * PostProcessingPipeline.ts
 * High-Fidelity Shading, Lighting & Post-Processing Chain for Kosh.
 * 
 * Chains depth-aware SSAOPass (for low-poly creasing and contact occlusion),
 * UnrealBloomPass (for glowing emissives, neon, fire, and sun highlights),
 * and OutputPass (sRGB color space & tone mapping).
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";

export interface PostProcessingConfig {
  enabled: boolean;
  ssao: {
    enabled: boolean;
    kernelRadius: number;
    minDistance: number;
    maxDistance: number;
  };
  bloom: {
    enabled: boolean;
    strength: number;
    radius: number;
    threshold: number;
  };
  outline: {
    enabled: boolean;
    edgeStrength: number;
    edgeGlow: number;
    edgeThickness: number;
    visibleEdgeColor: string;
    hiddenEdgeColor: string;
  };
}

export const DEFAULT_POST_CONFIG: PostProcessingConfig = {
  enabled: true,
  ssao: {
    enabled: true,
    kernelRadius: 0.6,
    minDistance: 0.001,
    maxDistance: 0.1,
  },
  bloom: {
    enabled: true,
    strength: 0.15,
    radius: 0.25,
    threshold: 0.96,
  },
  outline: {
    enabled: true,
    edgeStrength: 6,
    edgeGlow: 0.3,
    edgeThickness: 2,
    visibleEdgeColor: "#f97316",
    hiddenEdgeColor: "#7c2d12",
  },
};

export class PostProcessingPipeline {
  public composer: EffectComposer;
  public renderPass: RenderPass;
  public ssaoPass: SSAOPass;
  public bloomPass: UnrealBloomPass;
  public outlinePass: OutlinePass;
  public outputPass: OutputPass;
  public config: PostProcessingConfig;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
    config: Partial<PostProcessingConfig> = {}
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.config = {
      enabled: config.enabled ?? DEFAULT_POST_CONFIG.enabled,
      ssao: { ...DEFAULT_POST_CONFIG.ssao, ...config.ssao },
      bloom: { ...DEFAULT_POST_CONFIG.bloom, ...config.bloom },
      outline: { ...DEFAULT_POST_CONFIG.outline, ...config.outline },
    };

    // 1. Initialize EffectComposer
    this.composer = new EffectComposer(renderer);
    this.composer.setSize(width, height);

    // 2. Base Scene RenderPass
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // 3. Depth-Aware SSAOPass for geometric creasing
    this.ssaoPass = new SSAOPass(scene, camera, width, height);
    this.ssaoPass.kernelRadius = this.config.ssao.kernelRadius;
    this.ssaoPass.minDistance = this.config.ssao.minDistance;
    this.ssaoPass.maxDistance = this.config.ssao.maxDistance;
    this.ssaoPass.enabled = this.config.ssao.enabled;
    this.composer.addPass(this.ssaoPass);

    // 4. OutlinePass for Blender-style selection glow
    this.outlinePass = new OutlinePass(new THREE.Vector2(width, height), scene, camera);
    this.outlinePass.edgeStrength = this.config.outline.edgeStrength;
    this.outlinePass.edgeGlow = this.config.outline.edgeGlow;
    this.outlinePass.edgeThickness = this.config.outline.edgeThickness;
    this.outlinePass.visibleEdgeColor.set(this.config.outline.visibleEdgeColor);
    this.outlinePass.hiddenEdgeColor.set(this.config.outline.hiddenEdgeColor);
    this.outlinePass.enabled = this.config.outline.enabled;
    this.outlinePass.selectedObjects = [];
    this.composer.addPass(this.outlinePass);

    // 5. UnrealBloomPass for highlights & glow
    const bloomRes = new THREE.Vector2(width, height);
    this.bloomPass = new UnrealBloomPass(
      bloomRes,
      this.config.bloom.strength,
      this.config.bloom.radius,
      this.config.bloom.threshold
    );
    this.bloomPass.enabled = this.config.bloom.enabled;
    this.composer.addPass(this.bloomPass);

    // 6. OutputPass for sRGB tone mapping
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  /** Set the meshes that should receive the selection outline glow. */
  public setOutlineTargets(meshes: THREE.Object3D[]) {
    this.outlinePass.selectedObjects = meshes;
  }

  public render(deltaTime?: number) {
    if (this.config.enabled) {
      this.composer.render(deltaTime);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public setSize(width: number, height: number) {
    this.composer.setSize(width, height);
    this.ssaoPass.setSize(width, height);
    this.outlinePass.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  public updateCamera(camera: THREE.Camera) {
    this.camera = camera;
    this.renderPass.camera = camera;
    this.ssaoPass.camera = camera;
    this.outlinePass.renderCamera = camera;
  }

  public setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
  }

  public setSSAOEnabled(enabled: boolean) {
    this.config.ssao.enabled = enabled;
    this.ssaoPass.enabled = enabled;
  }

  public setBloomEnabled(enabled: boolean) {
    this.config.bloom.enabled = enabled;
    this.bloomPass.enabled = enabled;
  }

  public setBloomStrength(strength: number) {
    const capped = Math.min(Math.max(strength, 0.0), 0.2);
    this.config.bloom.strength = capped;
    this.bloomPass.strength = capped;
  }

  public setBloomRadius(radius: number) {
    this.config.bloom.radius = radius;
    this.bloomPass.radius = radius;
  }

  public setBloomThreshold(threshold: number) {
    const capped = Math.max(threshold, 0.95);
    this.config.bloom.threshold = capped;
    this.bloomPass.threshold = capped;
  }

  public setSSAORadius(radius: number) {
    this.config.ssao.kernelRadius = radius;
    this.ssaoPass.kernelRadius = radius;
  }

  public dispose() {
    this.composer.dispose();
    this.ssaoPass.dispose();
    this.bloomPass.dispose();
  }
}
