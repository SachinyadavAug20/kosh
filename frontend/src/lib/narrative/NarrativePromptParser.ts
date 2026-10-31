import {
  NarrativeSceneDescriptor,
  EnvironmentPreset,
  GroundSurfaceType,
  PropType,
  CharacterType,
  ActorAction,
} from "./NarrativeSceneSchema";

// ============================================================================
// Curated Storyboard Presets
// ============================================================================

export const PRESET_STORYBOARDS: Record<string, NarrativeSceneDescriptor> = {
  sunset_cabin: {
    meta: {
      title: "Sunset Cabin Journey",
      durationFrames: 180,
      fps: 30,
      aspectRatio: "16:9",
    },
    title: "Sunset Cabin Journey",
    prompt: "A traveler walks through a pine forest towards a warm cabin at golden hour sunset",
    durationFrames: 180,
    fps: 30,
    environment: {
      preset: "sunset",
      fogDensity: 0.012,
      skyboxGradient: ["#312e81", "#f97316"],
      ground: { type: "grass", size: [60, 60] },
      ambientLight: { color: "#fed7aa", intensity: 0.8 },
      sunLight: { position: [-25, 14, -20], intensity: 2.2, color: "#f97316", castShadow: true },
    },
    props: [
      { id: "cabin_1", type: "cabin", transform: { position: [0, 0, -8], rotation: [0, 0, 0], scale: [1, 1, 1] }, palette: ["#854d0e", "#991b1b"] },
      { id: "tree_1", type: "pine_tree", transform: { position: [-5, 0, 2], rotation: [0, 0, 0], scale: [1.2, 1.3, 1.2] }, palette: ["#1e3f20"] },
      { id: "tree_2", type: "pine_tree", transform: { position: [5.5, 0, 4], rotation: [0, 0, 0], scale: [1, 1.1, 1] }, palette: ["#1e3f20"] },
      { id: "tree_3", type: "pine_tree", transform: { position: [-4.2, 0, -5], rotation: [0, 0, 0], scale: [1.1, 1.2, 1.1] }, palette: ["#1e3f20"] },
      { id: "tree_4", type: "pine_tree", transform: { position: [4.8, 0, -6], rotation: [0, 0, 0], scale: [1.3, 1.4, 1.3] }, palette: ["#1e3f20"] },
      { id: "rock_1", type: "rock", transform: { position: [-2.5, 0, 4], rotation: [0, 0, 0], scale: [0.9, 0.8, 0.9] }, palette: ["#64748b"] },
      { id: "rock_2", type: "rock", transform: { position: [3.2, 0, -1], rotation: [0, 0, 0], scale: [1.2, 1, 1.1] }, palette: ["#64748b"] },
      { id: "fence_1", type: "fence", transform: { position: [-3.5, 0, -3], rotation: [0, 0.1, 0], scale: [1, 1, 1] }, palette: ["#854d0e"] },
      { id: "fence_2", type: "fence", transform: { position: [3.5, 0, -3], rotation: [0, -0.1, 0], scale: [1, 1, 1] }, palette: ["#854d0e"] },
      { id: "barrel_1", type: "barrel", transform: { position: [2.5, 0, -7], rotation: [0, 0, 0], scale: [1, 1, 1] }, palette: ["#854d0e"] },
      { id: "campfire_1", type: "campfire", transform: { position: [-2.8, 0, -6], rotation: [0, 0, 0], scale: [1, 1, 1] }, palette: ["#f97316"] },
    ],
    actors: [
      {
        id: "traveler",
        name: "Traveler",
        characterType: "stylized_avatar",
        skinPalette: { primary: "#f8c291", secondary: "#b45309", accent: "#334155" },
        path: [
          { frame: 0, position: [0, 0, 9], action: "walk" },
          { frame: 45, position: [0.6, 0, 5], action: "walk" },
          { frame: 90, position: [-0.4, 0, 1], action: "walk" },
          { frame: 135, position: [0.2, 0, -3], action: "walk" },
          { frame: 180, position: [0, 0, -5.5], action: "look_around" },
        ],
      },
    ],
    cameras: [
      {
        id: "main_cam",
        type: "shoulder_track",
        targetActorId: "traveler",
        keyframes: [
          { frame: 0, position: [8, 5.5, 14], target: [0, 1, 0], fov: 42 },
          { frame: 60, position: [3, 2.5, 7], target: [0, 1.2, 2], fov: 40 },
          { frame: 120, position: [0.5, 1.6, -1.8], target: [0, 1.2, -6], fov: 38 },
        ],
      },
    ],
  },

  cyberpunk_alley: {
    meta: {
      title: "Neon Rain Alley",
      durationFrames: 180,
      fps: 30,
      aspectRatio: "16:9",
    },
    title: "Neon Rain Alley",
    prompt: "A courier runs through a rain-soaked cyberpunk alley, stops at a neon door, and looks back",
    durationFrames: 180,
    fps: 30,
    environment: {
      preset: "cyberpunk",
      fogDensity: 0.025,
      skyboxGradient: ["#180b2b", "#ec4899"],
      ground: { type: "cobblestone", size: [60, 60] },
      ambientLight: { color: "#38bdf8", intensity: 0.6 },
      sunLight: { position: [10, 20, 10], intensity: 1.8, color: "#ec4899", castShadow: true },
    },
    props: [
      { id: "building_l1", type: "building_block", transform: { position: [-3.8, 0, 4], rotation: [0, 0, 0], scale: [1, 2, 1] }, palette: ["#1e293b"] },
      { id: "building_l2", type: "building_block", transform: { position: [-3.8, 0, -4], rotation: [0, 0, 0], scale: [1, 2.5, 1] }, palette: ["#1e293b"] },
      { id: "building_r1", type: "building_block", transform: { position: [3.8, 0, 4], rotation: [0, 0, 0], scale: [1, 2, 1] }, palette: ["#1e293b"] },
      { id: "building_r2", type: "building_block", transform: { position: [3.8, 0, -4], rotation: [0, 0, 0], scale: [1, 2.8, 1] }, palette: ["#1e293b"] },
      { id: "streetlamp_1", type: "streetlamp", transform: { position: [-2.8, 0, 1], rotation: [0, 0, 0], scale: [1, 1, 1] }, palette: ["#38bdf8"] },
      { id: "streetlamp_2", type: "streetlamp", transform: { position: [2.8, 0, -2], rotation: [0, 0, 0], scale: [1, 1, 1] }, palette: ["#ec4899"] },
      { id: "barrel_neon", type: "barrel", transform: { position: [-2.2, 0, -1], rotation: [0, 0, 0], scale: [1, 1, 1] }, palette: ["#334155"] },
    ],
    actors: [
      {
        id: "courier",
        name: "Courier",
        characterType: "lowpoly_humanoid",
        skinPalette: { primary: "#fbcfe8", secondary: "#0f172a", accent: "#38bdf8" },
        path: [
          { frame: 0, position: [0, 0, 8], action: "run" },
          { frame: 60, position: [0, 0, 2], action: "run" },
          { frame: 120, position: [-0.5, 0, -3.5], action: "idle" },
          { frame: 180, position: [-0.5, 0, -3.5], action: "look_around" },
        ],
      },
    ],
    cameras: [
      {
        id: "cyber_cam",
        type: "dolly",
        targetActorId: "courier",
        keyframes: [
          { frame: 0, position: [0, 2, 12], target: [0, 1, 4], fov: 45 },
          { frame: 75, position: [2.5, 1.8, 0], target: [-0.5, 1.2, -3], fov: 38 },
          { frame: 130, position: [-0.8, 1.4, -1.8], target: [-0.5, 1.3, -3.5], fov: 35 },
        ],
      },
    ],
  },

  starry_ruins: {
    meta: {
      title: "Moonlit Ancient Camp",
      durationFrames: 180,
      fps: 30,
      aspectRatio: "16:9",
    },
    title: "Moonlit Ancient Camp",
    prompt: "An adventurer discovers ancient ruins under a starry night sky with glowing campfire",
    durationFrames: 180,
    fps: 30,
    environment: {
      preset: "cyberpunk", // Deep blue night
      fogDensity: 0.015,
      skyboxGradient: ["#050814", "#172554"],
      ground: { type: "terrain", size: [60, 60] },
      ambientLight: { color: "#1e293b", intensity: 0.5 },
      sunLight: { position: [15, 25, 20], intensity: 1.4, color: "#93c5fd", castShadow: true },
    },
    props: [
      { id: "campfire_center", type: "campfire", transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, palette: ["#f97316"] },
      { id: "rock_large_1", type: "rock", transform: { position: [-4, 0, -3], rotation: [0, 0, 0], scale: [2.2, 2.5, 2] }, palette: ["#64748b"] },
      { id: "rock_large_2", type: "rock", transform: { position: [4.5, 0, -2], rotation: [0, 0, 0], scale: [2, 3, 2.4] }, palette: ["#64748b"] },
      { id: "rock_wall", type: "rock", transform: { position: [0, 0, -7], rotation: [0, 0, 0], scale: [3.5, 2, 1.8] }, palette: ["#64748b"] },
      { id: "barrel_1", type: "barrel", transform: { position: [-1.8, 0, 1.2], rotation: [0, 0, 0], scale: [1, 1, 1] }, palette: ["#854d0e"] },
      { id: "chair_1", type: "chair", transform: { position: [1.6, 0, 0.4], rotation: [0, -0.8, 0], scale: [1, 1, 1] }, palette: ["#854d0e"] },
      { id: "tree_silhouette", type: "pine_tree", transform: { position: [7, 0, 5], rotation: [0, 0, 0], scale: [1.4, 1.8, 1.4] }, palette: ["#1e3f20"] },
      { id: "lamp_torch", type: "streetlamp", transform: { position: [-3, 0, 2], rotation: [0, 0, 0], scale: [1, 1, 1] }, palette: ["#f59e0b"] },
    ],
    actors: [
      {
        id: "explorer",
        name: "Explorer",
        characterType: "stylized_avatar",
        skinPalette: { primary: "#f8c291", secondary: "#78350f", accent: "#1e293b" },
        path: [
          { frame: 0, position: [-5, 0, 7], action: "walk" },
          { frame: 60, position: [-3, 0, 4], action: "walk" },
          { frame: 120, position: [-1.5, 0, 2], action: "walk" },
          { frame: 180, position: [-0.8, 0, 0.8], action: "wave" },
        ],
      },
    ],
    cameras: [
      {
        id: "ruins_cam",
        type: "orbit",
        targetActorId: "explorer",
        keyframes: [
          { frame: 0, position: [-6, 6, 12], target: [0, 0.5, 0], fov: 40 },
          { frame: 80, position: [-2, 3.5, 6], target: [-1, 1, 1], fov: 38 },
          { frame: 140, position: [1.5, 1.8, 3.2], target: [-0.8, 1.2, 0.8], fov: 36 },
        ],
      },
    ],
  },
};

// ============================================================================
// Dynamic Heuristic Parser
// ============================================================================

export function parseNarrativePrompt(promptText: string): NarrativeSceneDescriptor {
  const norm = promptText.toLowerCase().trim();

  // 1. Direct Presets Match
  if (norm.includes("cyberpunk") || norm.includes("neon") || (norm.includes("rain") && norm.includes("door"))) {
    return { ...PRESET_STORYBOARDS.cyberpunk_alley, prompt: promptText };
  }
  if (norm.includes("cabin") && (norm.includes("sunset") || norm.includes("golden"))) {
    return { ...PRESET_STORYBOARDS.sunset_cabin, prompt: promptText };
  }
  if (norm.includes("star") || (norm.includes("night") && norm.includes("ruin"))) {
    return { ...PRESET_STORYBOARDS.starry_ruins, prompt: promptText };
  }

  // 2. Dynamic Synthesis
  let preset: EnvironmentPreset = "sunset";
  let skyGradient: [string, string] = ["#312e81", "#f97316"];
  let sunColor = "#f97316";
  let sunPos: [number, number, number] = [-25, 18, -20];
  let ambientColor = "#fed7aa";
  let fogDensity = 0.012;

  if (norm.includes("desert") || norm.includes("noon") || norm.includes("sunny") || norm.includes("day")) {
    preset = "desert_noon";
    skyGradient = ["#0284c7", "#fef08a"];
    sunColor = "#fffbeb";
    sunPos = [20, 30, 15];
    ambientColor = "#fef08a";
    fogDensity = 0.005;
  } else if (norm.includes("fog") || norm.includes("mist") || norm.includes("morning")) {
    preset = "foggy_morning";
    skyGradient = ["#334155", "#94a3b8"];
    sunColor = "#cbd5e1";
    sunPos = [5, 15, 10];
    ambientColor = "#64748b";
    fogDensity = 0.03;
  } else if (norm.includes("interior") || norm.includes("room") || norm.includes("inside")) {
    preset = "interior_warm";
    skyGradient = ["#451a03", "#d97706"];
    sunColor = "#fbbf24";
    sunPos = [0, 8, 0];
    ambientColor = "#fef3c7";
    fogDensity = 0.008;
  }

  // Ground
  let groundType: GroundSurfaceType = "grass";
  if (norm.includes("sand") || norm.includes("desert") || norm.includes("beach")) {
    groundType = "sand";
  } else if (norm.includes("cobble") || norm.includes("street") || norm.includes("city") || norm.includes("alley")) {
    groundType = "cobblestone";
  } else if (norm.includes("floor") || norm.includes("wood")) {
    groundType = "wooden_floor";
  } else if (norm.includes("mountain") || norm.includes("ruin") || norm.includes("hill")) {
    groundType = "terrain";
  }

  // Actor
  let charType: CharacterType = "lowpoly_humanoid";
  if (norm.includes("robot") || norm.includes("droid") || norm.includes("mech")) {
    charType = "robot";
  } else if (norm.includes("explorer") || norm.includes("traveler") || norm.includes("courier")) {
    charType = "stylized_avatar";
  }

  let action: ActorAction = "walk";
  if (norm.includes("run") || norm.includes("sprint") || norm.includes("jog")) {
    action = "run";
  } else if (norm.includes("wave") || norm.includes("greet")) {
    action = "wave";
  } else if (norm.includes("look") || norm.includes("survey")) {
    action = "look_around";
  } else if (norm.includes("idle") || norm.includes("stand")) {
    action = "idle";
  }

  // Props
  const props: any[] = [];
  const addProp = (type: PropType, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0]) => {
    props.push({
      id: `${type}_${props.length + 1}`,
      type,
      transform: { position: pos, rotation: rot, scale },
      palette: ["#854d0e"],
    });
  };

  const hasCabin = norm.includes("cabin") || norm.includes("house") || norm.includes("door") || norm.includes("hut");
  const hasFire = norm.includes("fire") || norm.includes("camp");
  const hasTrees = norm.includes("tree") || norm.includes("forest") || norm.includes("wood");
  const hasRocks = norm.includes("rock") || norm.includes("stone");
  const hasLamps = norm.includes("lamp") || norm.includes("light") || norm.includes("lantern");

  if (hasCabin) {
    addProp("cabin", [0, 0, -8]);
    addProp("fence", [-3, 0, -4]);
    addProp("fence", [3, 0, -4]);
    addProp("barrel", [2.5, 0, -7]);
  }

  if (hasFire) {
    addProp("campfire", hasCabin ? [-2.5, 0, -5] : [0, 0, 0]);
    addProp("chair", [-1.5, 0, 1.2]);
  }

  if (hasTrees || (!hasCabin && !hasFire && !norm.includes("street"))) {
    addProp("pine_tree", [-5, 0, 3], [1.2, 1.3, 1.2]);
    addProp("pine_tree", [5, 0, 4], [1, 1.1, 1]);
    addProp("tree", [-4.5, 0, -4], [1.1, 1.2, 1.1]);
    addProp("tree", [4.5, 0, -5], [1.2, 1.3, 1.2]);
  }

  if (hasRocks || norm.includes("mountain")) {
    addProp("rock", [-3, 0, 4], [1.2, 1, 1.1]);
    addProp("rock", [3.5, 0, -1], [1.4, 1.3, 1.2]);
  }

  if (hasLamps) {
    addProp("streetlamp", [-3, 0, 5]);
    addProp("streetlamp", [3, 0, 0]);
  }

  if (props.length === 0) {
    addProp("cabin", [0, 0, -8]);
    addProp("pine_tree", [-4, 0, 2]);
    addProp("pine_tree", [4, 0, 2]);
    addProp("campfire", [0, 0, 0]);
  }

  const startZ = action === "idle" || action === "wave" ? 0 : 8;
  const targetZ = hasCabin ? -5 : (hasFire ? 1.5 : -4);

  return {
    meta: {
      title: promptText.slice(0, 32) + "...",
      durationFrames: 180,
      fps: 30,
      aspectRatio: "16:9",
    },
    title: promptText.slice(0, 32) + "...",
    prompt: promptText,
    durationFrames: 180,
    fps: 30,
    environment: {
      preset,
      fogDensity,
      skyboxGradient: skyGradient,
      ground: { type: groundType, size: [60, 60] },
      ambientLight: { color: ambientColor, intensity: 0.8 },
      sunLight: { position: sunPos, intensity: 2.2, color: sunColor, castShadow: true },
    },
    props,
    actors: [
      {
        id: "hero",
        name: "Hero Actor",
        characterType: charType,
        skinPalette: { primary: "#f8c291", secondary: "#2563eb", accent: "#0f172a" },
        path: [
          { frame: 0, position: [0, 0, startZ], action },
          { frame: 60, position: [0.5, 0, (startZ + targetZ) * 0.65], action },
          { frame: 120, position: [-0.4, 0, (startZ + targetZ) * 0.35], action },
          { frame: 180, position: [0, 0, targetZ], action: action === "run" ? "idle" : action },
        ],
      },
    ],
    cameras: [
      {
        id: "main_cam",
        type: "shoulder_track",
        targetActorId: "hero",
        keyframes: [
          { frame: 0, position: [7, 5, 12], target: [0, 1, 0], fov: 42 },
          { frame: 60, position: [3, 2.5, 6], target: [0, 1, 2], fov: 40 },
          { frame: 120, position: [0.5, 1.6, -1.8], target: [0, 1.2, targetZ], fov: 38 },
        ],
      },
    ],
  };
}
