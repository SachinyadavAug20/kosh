import * as THREE from "three";

export type AspectRatioOption = "16:9" | "9:16" | "1:1" | "2.39:1";
export type EnvironmentPreset = "sunset" | "cyberpunk" | "foggy_morning" | "desert_noon" | "interior_warm";
export type GroundSurfaceType = "grid" | "cobblestone" | "sand" | "wooden_floor" | "grass" | "terrain";
export type PropType =
  | "cabin"
  | "door"
  | "tree"
  | "pine_tree"
  | "rock"
  | "streetlamp"
  | "table"
  | "chair"
  | "building_block"
  | "barrel"
  | "fence"
  | "campfire";

export type CharacterType = "lowpoly_humanoid" | "robot" | "stylized_avatar";
export type ActorAction = "walk" | "run" | "idle" | "wave" | "look_around";
export type CameraRigType = "dolly" | "orbit" | "static" | "shoulder_track";

export interface NarrativeSceneMeta {
  title: string;
  durationFrames: number;
  fps: 24 | 30 | 60;
  aspectRatio: AspectRatioOption;
}

export interface NarrativeEnvironment {
  preset: EnvironmentPreset;
  fogDensity: number;
  skyboxGradient: [string, string]; // [topHex, bottomHex]
  ground: {
    type: GroundSurfaceType;
    size: [number, number];
  };
  ambientLight: {
    color: string;
    intensity: number;
  };
  sunLight: {
    position: [number, number, number];
    intensity: number;
    color: string;
    castShadow: boolean;
  };
}

export interface NarrativeProp {
  id: string;
  type: PropType;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  palette: string[];
}

export interface ActorPathPoint {
  frame: number;
  position: [number, number, number];
  action: ActorAction;
}

export interface NarrativeActor {
  id: string;
  name: string;
  characterType: CharacterType;
  skinPalette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  path: ActorPathPoint[];
}

export interface CameraKeyframe {
  frame: number;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface NarrativeCamera {
  id: string;
  type: CameraRigType;
  targetActorId?: string;
  keyframes: CameraKeyframe[];
}

export interface NarrativeSceneDescriptor {
  meta: NarrativeSceneMeta;
  environment: NarrativeEnvironment;
  props: NarrativeProp[];
  actors: NarrativeActor[];
  cameras: NarrativeCamera[];

  // Convenience aliases for backward compatibility with UI components
  title?: string;
  prompt?: string;
  durationFrames?: number;
  fps?: number;
}
