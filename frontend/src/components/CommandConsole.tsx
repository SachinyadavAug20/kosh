"use client";

import React, { useState } from "react";
import { McpToolDefinition, ToolExecutionResult } from "@/types/mcp";
import {
  Play,
  Box,
  Cog,
  Loader2,
  Sliders,
  RotateCcw,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  Wand2,
  Palette,
  Film,
  Sun,
  Flame,
  Maximize2,
  RotateCw,
  Sparkles,
  MousePointer,
  Cpu,
  Activity,
  Camera,
  Shapes,
  Hammer,
  Eye,
  Scissors,
  Download,
  Minimize2,
  Brush,
  Globe,
  Radio,
  Share2,
} from "lucide-react";

interface CommandConsoleProps {
  tools: McpToolDefinition[];
  isLoading: boolean;
  onExecute: (
    toolName: string,
    args: { prompt?: string; script?: string; format: "glb" | "stl" | "obj" | "fbx" | "usdz"; previousScript?: string }
  ) => void;
  lastResult: ToolExecutionResult | null;
  error: string | null;
  hasToken: boolean;
  selectedMeshName?: string | null;
  meshList?: Array<{ id: string; name: string; triangles: number; vertices: number; visible?: boolean }>;
  onSelectMesh?: (meshName: string | null) => void;
  onLiveMaterialUpdate?: (mat: {
    color: string;
    roughness: number;
    metalness: number;
    transmission?: number;
    clearcoat?: number;
    emissive?: string;
    timestamp: number;
  }) => void;
  onLiveExplodedViewChange?: (factor: number) => void;
  onLiveTurntableChange?: (active: boolean) => void;
  onLiveHoverChange?: (active: boolean) => void;
}

export type DccTab = "ai" | "sculpt" | "shader" | "modifiers" | "physics" | "world";

const PRESETS = [
  {
    tool: "cad_model",
    label: "Turbine Housing",
    format: "glb" as const,
    prompt: "Procedural mechanical turbine housing with beveled flanges, central bore, and 8 bolt clearance holes",
  },
  {
    tool: "blender_animation",
    label: "Planetary Gearbox",
    format: "glb" as const,
    prompt: "Kinetic mechanical planetary gear train with orbiting planet gears across 120 keyframed rotation frames",
  },
  {
    tool: "blender_sculpt_op",
    label: "Clay Sculpt Bust",
    format: "glb" as const,
    prompt: "Organic sculpted terracotta bust with dynamic topology clay build-up and 0.04m voxel remeshing",
  },
  {
    tool: "blender_sculpt",
    label: "Meteorite Relic",
    format: "glb" as const,
    prompt: "Organic sculpted meteorite artifact with procedural Voronoi craters, eroded crevices, and dual rock/moss materials",
  },
  {
    tool: "geometry_nodes",
    label: "Dyson Swarm Lattice",
    format: "glb" as const,
    prompt: "Algorithmic Fibonacci Dyson constellation with 24 instanced crystal nodes orbiting a central titanium geodesic core",
  },
  {
    tool: "blender_animate_pipeline",
    label: "Physics Rigid Drop",
    format: "glb" as const,
    prompt: "Procedural rigid body gravity drop simulation of 4 falling monolith cubes bouncing onto a steel ground collider plate",
  },
  {
    tool: "blender_uv_paint",
    label: "Smart UV Polyhedron",
    format: "glb" as const,
    prompt: "Smart UV projected icosphere with custom vertex color gradient attribute layer and normal map baking",
  },
  {
    tool: "rigging_armature",
    label: "Articulated Robot Arm",
    format: "glb" as const,
    prompt: "3-stage articulated industrial robotic arm with skeletal armature, rotating turntable base, and gripper claw waving across 120 frames",
  },
  {
    tool: "material_shader",
    label: "Iridescent Chrome",
    format: "glb" as const,
    prompt: "Iridescent metallic orb with procedural Voronoi noise bump, dual-tone clearcoat, and brushed titanium pedestal",
  },
  {
    tool: "mesh_modifier",
    label: "Boolean Heat Sink",
    format: "glb" as const,
    prompt: "Precision aluminum heat sink with 5 boolean fin slot cutouts, chamfered bevels, and anodized charcoal finish",
  },
  {
    tool: "camera_compositor",
    label: "Director Camera Rig",
    format: "glb" as const,
    prompt: "Cinematic 50mm camera rig performing a 360-degree orbital sweep around a machined sculptural obelisk with softbox studio lighting",
  },
  {
    tool: "scene_assembler",
    label: "Brutalist Pavilion",
    format: "glb" as const,
    prompt: "Compound brutalist architectural pavilion with terraced foundation plaza, 4 colonnade pillars, cantilever roof, and copper sculpture",
  },
  {
    tool: "lighting_studio",
    label: "3-Point Studio Rig",
    format: "glb" as const,
    prompt: "Cinematic 3-point softbox studio stage with cyclorama infinity cove, floor reflection, and depth-of-field camera",
  },
  {
    tool: "blender_mesh",
    label: "Geodesic Sphere",
    format: "glb" as const,
    prompt: "Subdivided geodesic orb with frosted glass material and metallic core",
  },
  {
    tool: "blender_animation",
    label: "Oscillating Engine",
    format: "glb" as const,
    prompt: "Kinetic dual-piston engine block with reciprocating pistons and spinning crankshaft across 120 frames",
  },
  {
    tool: "material_shader",
    label: "Damascus Steel",
    format: "glb" as const,
    prompt: "Folded Damascus steel combat blade with wave pattern bump map and polished brass hilt",
  },
  {
    tool: "cad_model",
    label: "Spur Gear (STL)",
    format: "stl" as const,
    prompt: "Parametric mechanical spur gear with 18 teeth, 40mm pitch diameter, central shaft bore",
  },
  {
    tool: "mesh_modifier",
    label: "Chamfered Hex Bolt",
    format: "glb" as const,
    prompt: "High-precision hex bolt with threaded cylindrical shaft and beveled socket head",
  },
];

const SHADER_PRESETS = [
  { name: "Brushed Aluminium", category: "Metals", metal: 0.92, rough: 0.22, trans: 0.0, color: "#cbd5e1" },
  { name: "Anodized Titanium", category: "Metals", metal: 0.95, rough: 0.18, trans: 0.0, color: "#94a3b8" },
  { name: "Polished Gold", category: "Metals", metal: 0.98, rough: 0.08, trans: 0.0, color: "#eab308" },
  { name: "Brushed Copper", category: "Metals", metal: 0.90, rough: 0.25, trans: 0.0, color: "#d97706" },
  { name: "Cast Iron", category: "Metals", metal: 0.75, rough: 0.65, trans: 0.0, color: "#334155" },
  { name: "Dual-Coat Car Paint", category: "Dielectrics", metal: 0.1, rough: 0.15, trans: 0.0, color: "#dc2626" },
  { name: "Matte Black Polymer", category: "Dielectrics", metal: 0.05, rough: 0.45, trans: 0.0, color: "#18181b" },
  { name: "Glazed Porcelain", category: "Dielectrics", metal: 0.0, rough: 0.12, trans: 0.0, color: "#f8fafc" },
  { name: "Frosted Glass", category: "Transmissives", metal: 0.05, rough: 0.15, trans: 0.88, color: "#e2e8f0" },
  { name: "Tinted Water", category: "Transmissives", metal: 0.0, rough: 0.02, trans: 0.95, color: "#0284c7" },
  { name: "Terracotta Clay", category: "Organics", metal: 0.0, rough: 0.75, trans: 0.0, color: "#b45309" },
  { name: "Subsurface Wax", category: "Organics", metal: 0.02, rough: 0.35, trans: 0.2, color: "#fef08a" },
];

export function CommandConsole({
  tools,
  isLoading,
  onExecute,
  lastResult,
  error,
  hasToken,
  selectedMeshName,
  meshList = [],
  onSelectMesh,
  onLiveMaterialUpdate,
  onLiveExplodedViewChange,
  onLiveTurntableChange,
  onLiveHoverChange,
}: CommandConsoleProps) {
  // Active 6-Tab DCC Workspace
  const [activeTab, setActiveTab] = useState<DccTab>("ai");

  // Tab 1: AI & Generator Settings
  const [selectedTool, setSelectedTool] = useState<string>("blender_mesh");
  const [format, setFormat] = useState<"glb" | "stl" | "obj" | "fbx" | "usdz">("glb");
  const [prompt, setPrompt] = useState<string>(
    "Procedural mechanical turbine housing with beveled flanges, central bore, and 8 bolt clearance holes"
  );
  const [refineMode, setRefineMode] = useState<boolean>(false);

  // Tab 2: Sculpt & Mesh Settings
  const [voxelSize, setVoxelSize] = useState<number>(0.04);
  const [displaceNoiseScale, setDisplaceNoiseScale] = useState<number>(2.5);
  const [displaceHeight, setDisplaceHeight] = useState<number>(0.15);
  const [subsurfLevel, setSubsurfLevel] = useState<number>(1);
  const [smoothShading, setSmoothShading] = useState<boolean>(true);

  // Tab 3: Shaders & PBR Paint Settings
  const [activeShaderPreset, setActiveShaderPreset] = useState<string>("Brushed Aluminium");
  const [matColor, setMatColor] = useState<string>("#cbd5e1");
  const [metallic, setMetallic] = useState<number>(0.92);
  const [roughness, setRoughness] = useState<number>(0.22);
  const [transmission, setTransmission] = useState<number>(0.0);
  const [clearcoat, setClearcoat] = useState<number>(0.0);
  const [emissiveColor, setEmissiveColor] = useState<string>("#000000");
  const [activeTextureMap, setActiveTextureMap] = useState<"none" | "checker" | "voronoi" | "carbon">("none");

  // Tab 4: Modifiers Stack & Geometry Nodes
  const [bevelWidth, setBevelWidth] = useState<number>(0.04);
  const [bevelSegments, setBevelSegments] = useState<number>(3);
  const [solidifyThickness, setSolidifyThickness] = useState<number>(0.0);
  const [arrayCount, setArrayCount] = useState<number>(1);
  const [mirrorX, setMirrorX] = useState<boolean>(false);
  const [voronoiCells, setVoronoiCells] = useState<number>(12);

  // Tab 5: Simulation & Physics
  const [rigidBounciness, setRigidBounciness] = useState<number>(0.3);
  const [rigidFriction, setRigidFriction] = useState<number>(0.5);
  const [explodedView, setExplodedView] = useState<number>(0.0);
  const [waveDeform, setWaveDeform] = useState<number>(0.0);
  const [clothDrape, setClothDrape] = useState<boolean>(false);

  // Tab 6: World & Lighting
  const [lightingRig, setLightingRig] = useState<"studio" | "noir" | "softbox" | "sky" | "cyberpunk">("studio");
  const [keyIntensity, setKeyIntensity] = useState<number>(1.0);
  const [ambientExposure, setAmbientExposure] = useState<number>(1.0);
  const [dofEnabled, setDofEnabled] = useState<boolean>(false);
  const [bloomEnabled, setBloomEnabled] = useState<boolean>(false);
  const [turntableAnim, setTurntableAnim] = useState<boolean>(false);
  const [hoverAnim, setHoverAnim] = useState<boolean>(false);

  // Trigger live in-viewport material update
  const triggerLiveMatUpdate = (partial?: {
    color?: string;
    roughness?: number;
    metalness?: number;
    transmission?: number;
    clearcoat?: number;
    emissive?: string;
  }) => {
    onLiveMaterialUpdate?.({
      color: partial?.color ?? matColor,
      roughness: partial?.roughness ?? roughness,
      metalness: partial?.metalness ?? metallic,
      transmission: partial?.transmission ?? transmission,
      clearcoat: partial?.clearcoat ?? clearcoat,
      emissive: partial?.emissive ?? emissiveColor,
      timestamp: Date.now(),
    });
  };

  const handleApplyShaderPreset = (preset: typeof SHADER_PRESETS[0]) => {
    setActiveShaderPreset(preset.name);
    setMetallic(preset.metal);
    setRoughness(preset.rough);
    setTransmission(preset.trans);
    setMatColor(preset.color);
    onLiveMaterialUpdate?.({
      color: preset.color,
      roughness: preset.rough,
      metalness: preset.metal,
      transmission: preset.trans,
      clearcoat: 0,
      timestamp: Date.now(),
    });
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    let enrichedPrompt = prompt.trim();

    // Enrich with modifiers if tuned
    if (bevelWidth > 0 && !enrichedPrompt.toLowerCase().includes("bevel")) {
      enrichedPrompt += `, bevel width ${bevelWidth}m (${bevelSegments} segments)`;
    }
    if (subsurfLevel > 0 && !enrichedPrompt.toLowerCase().includes("subsurf")) {
      enrichedPrompt += `, subdivision surface level ${subsurfLevel}`;
    }
    if (displaceHeight > 0) {
      enrichedPrompt += `, procedural displacement height ${displaceHeight}m`;
    }
    if (solidifyThickness > 0) {
      enrichedPrompt += `, solidify thickness ${solidifyThickness}m`;
    }
    if (arrayCount > 1) {
      enrichedPrompt += `, array count ${arrayCount}`;
    }
    if (mirrorX) {
      enrichedPrompt += `, bilateral mirror along X axis`;
    }

    // Enrich with active material
    if (activeShaderPreset && !enrichedPrompt.toLowerCase().includes("material")) {
      enrichedPrompt += `, ${activeShaderPreset} Principled BSDF (metallic=${metallic}, roughness=${roughness})`;
    }

    // Enrich with lighting & animation
    if (lightingRig === "noir") {
      enrichedPrompt += `, high-contrast noir lighting`;
    } else if (lightingRig === "softbox") {
      enrichedPrompt += `, softbox studio product lighting`;
    } else if (lightingRig === "sky") {
      enrichedPrompt += `, outdoor Nishita atmospheric sky`;
    } else if (lightingRig === "cyberpunk") {
      enrichedPrompt += `, cinematic cyberpunk teal and orange lighting`;
    }

    if (turntableAnim) {
      enrichedPrompt += `, 360-degree turntable keyframe animation across 120 frames`;
    }
    if (hoverAnim) {
      enrichedPrompt += `, floating hover sine oscillation`;
    }
    if (explodedView > 0) {
      enrichedPrompt += `, exploded view separation ${explodedView}m`;
    }

    onExecute(selectedTool, {
      prompt: enrichedPrompt,
      format,
      previousScript: refineMode && lastResult?.script ? lastResult.script : undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-[#f4f4f5] text-xs font-sans border-r border-[#3f3f46]">
      {/* 6-Tab DCC Navigation Strip */}
      <div className="grid grid-cols-6 border-b border-[#3f3f46] bg-[#1f1f23]">
        {[
          { id: "ai" as DccTab, label: "AI", icon: Wand2, tip: "Generative AI & MCP Presets" },
          { id: "sculpt" as DccTab, label: "Sculpt", icon: Sparkles, tip: "Dynamic Sculpt & Mesh Operations" },
          { id: "shader" as DccTab, label: "Shader", icon: Palette, tip: "PBR Materials & Shader Workbench" },
          { id: "modifiers" as DccTab, label: "Modifiers", icon: Sliders, tip: "Modifier Stack & Geometry Nodes" },
          { id: "physics" as DccTab, label: "Physics", icon: Flame, tip: "Rigid Dynamics & Cloth Simulation" },
          { id: "world" as DccTab, label: "World", icon: Sun, tip: "Cinematic Studio & Camera Rigging" },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              title={tab.tip}
              className={`py-2 flex flex-col items-center justify-center space-y-0.5 transition-colors border-r border-[#3f3f46] ${
                isActive
                  ? "bg-[#27272a] text-[#f4f4f5] font-semibold border-b-2 border-b-[#ea580c]"
                  : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[9px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Parameters Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
        {/* ================= TAB 1: GENERATIVE AI (MCP) ================= */}
        {activeTab === "ai" && (
          <div className="space-y-3">
            {/* Tool & Format Strip */}
            <div className="flex flex-col space-y-1.5 p-1.5 bg-[#1f1f23] border border-[#3f3f46] rounded-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-[#71717a]">Blender Tool</span>
                <div className="flex items-center bg-[#18181b] border border-[#3f3f46] p-0.5 rounded-sm">
                  {(["glb", "stl", "obj", "fbx", "usdz"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={`px-1 py-0.5 font-mono text-[9px] uppercase rounded-sm transition-colors ${
                        format === fmt ? "bg-[#3f3f46] text-[#f4f4f5] font-bold" : "text-[#71717a] hover:text-[#a1a1aa]"
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* 16 Tools Selector Grid (4 columns x 4 rows) */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: "blender_mesh", label: "Mesh", icon: Box, tip: "Procedural Primitives & Mesh Gen" },
                  { id: "cad_model", label: "CAD", icon: Cog, tip: "Precision CAD & CSG Booleans" },
                  { id: "blender_sculpt_op", label: "SculptOp", icon: Hammer, tip: "Digital Sculpting & Remesh Engine" },
                  { id: "blender_mesh_ops", label: "BMesh", icon: Scissors, tip: "Advanced BMesh Manifold Ops" },
                  { id: "geometry_nodes", label: "GeoNodes", icon: Cpu, tip: "Procedural Lattices & Scattering" },
                  { id: "scene_assembler", label: "Scene", icon: Layers, tip: "Compound Environments & Architecture" },
                  { id: "blender_animation", label: "Anim", icon: Film, tip: "Keyframed Kinematics & Loops" },
                  { id: "blender_animate_pipeline", label: "PhysicsDrop", icon: Flame, tip: "Procedural Physics & Colliders" },
                  { id: "blender_uv_paint", label: "UVPaint", icon: Brush, tip: "Smart UV Unwrapping & Vertex Colors" },
                  { id: "rigging_armature", label: "Rigging", icon: Activity, tip: "Bones, Armatures & Articulated Limbs" },
                  { id: "material_shader", label: "Shader", icon: Palette, tip: "PBR Principled BSDF 2.0 Graphs" },
                  { id: "lighting_studio", label: "Studio", icon: Sun, tip: "3-Point Softbox & Cyclorama Cove" },
                  { id: "camera_compositor", label: "Camera", icon: Camera, tip: "Director 360 Orbit & Tracking" },
                  { id: "mesh_modifier", label: "Modifiers", icon: Sliders, tip: "Boolean, Remesh, Bevel, Array" },
                  { id: "blender_sculpt", label: "Sculpt", icon: Sparkles, tip: "Organic Sculpting & Displacements" },
                  { id: "physics_simulation", label: "Simulate", icon: Radio, tip: "Rigid Body Cascades & Cloth" },
                ].map((t) => {
                  const Icon = t.icon;
                  const isSel = selectedTool === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTool(t.id)}
                      title={t.tip}
                      className={`px-1 py-1 text-[9px] font-mono rounded-sm border flex items-center justify-center space-x-1 transition-colors ${
                        isSel
                          ? "bg-[#27272a] border-[#ea580c] text-[#f4f4f5] font-bold"
                          : "bg-[#18181b] border-[#3f3f46] text-[#a1a1aa] hover:text-[#f4f4f5]"
                      }`}
                    >
                      <Icon className={`w-3 h-3 ${isSel ? "text-[#ea580c]" : "text-[#71717a]"}`} />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Iterative Detail Generator / Refinement Mode */}
            {lastResult?.script && (
              <div className="p-2 bg-[#1f1f23] border border-[#ea580c]/50 rounded-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#f4f4f5] flex items-center">
                    <Sparkles className="w-3.5 h-3.5 text-[#ea580c] mr-1" />
                    Iterative Refinement
                  </span>
                  <button
                    type="button"
                    onClick={() => setRefineMode(!refineMode)}
                    className={`px-1.5 py-0.5 text-[9px] font-mono border rounded-sm transition-colors ${
                      refineMode
                        ? "bg-[#ea580c] text-white border-[#ea580c] font-bold"
                        : "border-[#3f3f46] text-[#a1a1aa] hover:text-[#f4f4f5]"
                    }`}
                  >
                    {refineMode ? "ACTIVE (PREV SCRIPT)" : "ENABLE"}
                  </button>
                </div>
                <p className="text-[10px] text-[#a1a1aa] leading-tight">
                  Refines the existing Blender code with new geometric detail without wiping prior work.
                </p>
              </div>
            )}

            {/* Prompt Input Box */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono uppercase text-[#71717a]">Generative Instruction</label>
                <span className="text-[9px] font-mono text-[#52525b]">Ctrl + Enter to run</span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={4}
                className="w-full bg-[#141416] text-[#f4f4f5] p-2 rounded-sm border border-[#3f3f46] focus:border-[#ea580c] focus:outline-none font-sans text-xs resize-none"
                placeholder="Describe procedural geometry, mechanics, sculpting, animations or materials..."
              />
            </div>

            {/* Execute Button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isLoading || !prompt.trim()}
              className="w-full py-2 bg-[#ea580c] hover:bg-[#f97316] text-white font-semibold rounded-sm flex items-center justify-center space-x-1.5 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Compiling Headless Blender...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute {selectedTool} ({format.toUpperCase()})</span>
                </>
              )}
            </button>

            {/* Presets Library */}
            <div className="space-y-1 pt-1 border-t border-[#3f3f46]">
              <div className="text-[10px] font-mono uppercase text-[#71717a]">Production Presets (18)</div>
              <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                {PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedTool(p.tool);
                      setFormat(p.format);
                      setPrompt(p.prompt);
                    }}
                    className="p-1.5 bg-[#1f1f23] hover:bg-[#27272a] border border-[#3f3f46] rounded-sm text-left transition-colors flex flex-col justify-between"
                  >
                    <span className="font-semibold text-[10px] truncate">{p.label}</span>
                    <span className="text-[8px] font-mono text-[#ea580c] uppercase">{p.tool}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: SCULPT & MESH ================= */}
        {activeTab === "sculpt" && (
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase text-[#71717a]">Digital Sculpting & BMesh Engine</div>

            {/* Dynamic Voxel Remesh */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-[#f4f4f5]">Dynamic Voxel Remesh</span>
                <span className="text-[10px] font-mono text-[#ea580c]">{voxelSize.toFixed(3)}m</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.2"
                step="0.005"
                value={voxelSize}
                onChange={(e) => setVoxelSize(parseFloat(e.target.value))}
                className="w-full accent-[#ea580c]"
              />
              <button
                type="button"
                onClick={() => {
                  onExecute("blender_sculpt_op", {
                    prompt: `Apply voxel remesh with voxel size ${voxelSize}m for clean manifold topology`,
                    format: "glb",
                  });
                }}
                className="w-full py-1 bg-[#27272a] hover:bg-[#3f3f46] border border-[#52525b] text-[#f4f4f5] rounded-sm font-mono text-[10px] transition-colors"
              >
                Apply Voxel Remesh ({voxelSize}m)
              </button>
            </div>

            {/* Procedural Surface Displacement */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-2">
              <span className="font-semibold text-[11px] text-[#f4f4f5]">Procedural Displace (Sculpt Detail)</span>
              
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#a1a1aa]">Displacement Height</span>
                  <span className="font-mono text-[#ea580c]">{displaceHeight.toFixed(2)}m</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.02"
                  value={displaceHeight}
                  onChange={(e) => setDisplaceHeight(parseFloat(e.target.value))}
                  className="w-full accent-[#ea580c]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#a1a1aa]">Noise Scale</span>
                  <span className="font-mono text-[#ea580c]">{displaceNoiseScale.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="8.0"
                  step="0.5"
                  value={displaceNoiseScale}
                  onChange={(e) => setDisplaceNoiseScale(parseFloat(e.target.value))}
                  className="w-full accent-[#ea580c]"
                />
              </div>
            </div>

            {/* Subdivision Surface & Shading */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-2">
              <span className="font-semibold text-[11px] text-[#f4f4f5]">Subdivision Surface</span>
              <div className="grid grid-cols-4 gap-1">
                {[0, 1, 2, 3].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSubsurfLevel(lvl)}
                    className={`py-1 text-[10px] font-mono rounded-sm border ${
                      subsurfLevel === lvl
                        ? "bg-[#ea580c] text-white border-[#ea580c] font-bold"
                        : "bg-[#18181b] border-[#3f3f46] text-[#a1a1aa]"
                    }`}
                  >
                    Level {lvl}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-[#a1a1aa]">Smooth Shading</span>
                <button
                  type="button"
                  onClick={() => setSmoothShading(!smoothShading)}
                  className={`px-2 py-0.5 text-[9px] font-mono border rounded-sm ${
                    smoothShading ? "bg-[#3f3f46] text-white border-[#52525b]" : "border-[#3f3f46] text-[#71717a]"
                  }`}
                >
                  {smoothShading ? "SMOOTH" : "FLAT"}
                </button>
              </div>
            </div>

            {/* Topology Cleanup Quick Actions */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1.5">
              <span className="font-semibold text-[11px] text-[#f4f4f5]">Topology Diagnostics & Cleaners</span>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => onExecute("blender_mesh_ops", { prompt: "Weld duplicate vertices with 0.001m distance threshold", format: "glb" })}
                  className="p-1 bg-[#18181b] hover:bg-[#27272a] border border-[#3f3f46] text-[9px] font-mono rounded-sm text-left"
                >
                  Weld Doubles (0.001m)
                </button>
                <button
                  type="button"
                  onClick={() => onExecute("blender_mesh_ops", { prompt: "Decimate mesh with 75% ratio preserving UVs and normal boundaries", format: "glb" })}
                  className="p-1 bg-[#18181b] hover:bg-[#27272a] border border-[#3f3f46] text-[9px] font-mono rounded-sm text-left"
                >
                  Decimate (75% ratio)
                </button>
                <button
                  type="button"
                  onClick={() => onExecute("blender_mesh_ops", { prompt: "Recalculate normals outside and ensure clean manifold surface", format: "glb" })}
                  className="p-1 bg-[#18181b] hover:bg-[#27272a] border border-[#3f3f46] text-[9px] font-mono rounded-sm text-left"
                >
                  Recalculate Normals
                </button>
                <button
                  type="button"
                  onClick={() => onExecute("blender_uv_paint", { prompt: "Smart UV project unwrap with 66 degree angle limit and vertex colors", format: "glb" })}
                  className="p-1 bg-[#18181b] hover:bg-[#27272a] border border-[#3f3f46] text-[9px] font-mono rounded-sm text-left"
                >
                  Smart UV Project (66°)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: SHADERS & PBR PAINT ================= */}
        {activeTab === "shader" && (
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase text-[#71717a]">PBR Principled BSDF 2.0 Studio</div>

            {/* Selected Sub-Mesh Selector */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#71717a] uppercase font-mono">Target Sub-Mesh</span>
                <span className="text-[10px] font-bold text-[#ea580c] truncate max-w-[140px]">
                  {selectedMeshName || "Entire Model"}
                </span>
              </div>
              <select
                value={selectedMeshName || ""}
                onChange={(e) => onSelectMesh?.(e.target.value || null)}
                className="w-full bg-[#141416] border border-[#3f3f46] text-[#f4f4f5] p-1 text-[10px] font-mono rounded-sm focus:outline-none"
              >
                <option value="">(All Sub-Meshes)</option>
                {meshList.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} ({m.triangles} tris)
                  </option>
                ))}
              </select>
            </div>

            {/* Color & Material Sliders */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#a1a1aa]">Base Color</span>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="color"
                    value={matColor}
                    onChange={(e) => {
                      setMatColor(e.target.value);
                      triggerLiveMatUpdate({ color: e.target.value });
                    }}
                    className="w-6 h-6 rounded cursor-pointer border border-[#3f3f46] bg-transparent"
                  />
                  <span className="font-mono text-[10px] uppercase text-[#f4f4f5]">{matColor}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#a1a1aa]">Metallic</span>
                  <span className="font-mono text-[#ea580c]">{metallic.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.02"
                  value={metallic}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMetallic(val);
                    triggerLiveMatUpdate({ metalness: val });
                  }}
                  className="w-full accent-[#ea580c]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#a1a1aa]">Roughness</span>
                  <span className="font-mono text-[#ea580c]">{roughness.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.02"
                  value={roughness}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setRoughness(val);
                    triggerLiveMatUpdate({ roughness: val });
                  }}
                  className="w-full accent-[#ea580c]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#a1a1aa]">Transmission (Glass)</span>
                  <span className="font-mono text-[#ea580c]">{transmission.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.02"
                  value={transmission}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setTransmission(val);
                    triggerLiveMatUpdate({ transmission: val });
                  }}
                  className="w-full accent-[#ea580c]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#a1a1aa]">Clearcoat</span>
                  <span className="font-mono text-[#ea580c]">{clearcoat.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.02"
                  value={clearcoat}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setClearcoat(val);
                    triggerLiveMatUpdate({ clearcoat: val });
                  }}
                  className="w-full accent-[#ea580c]"
                />
              </div>
            </div>

            {/* Shader Preset Library (12 presets) */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#71717a]">PBR Shader Presets (12)</div>
              <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                {SHADER_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyShaderPreset(p)}
                    className={`p-1.5 border rounded-sm text-left flex items-center space-x-1.5 transition-colors ${
                      activeShaderPreset === p.name
                        ? "bg-[#27272a] border-[#ea580c] text-[#f4f4f5]"
                        : "bg-[#1f1f23] border-[#3f3f46] text-[#a1a1aa] hover:bg-[#27272a]"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="truncate text-[10px]">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: MODIFIERS STACK & GEOMETRY NODES ================= */}
        {activeTab === "modifiers" && (
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase text-[#71717a]">Blender Modifiers Stack</div>

            {/* Bevel Chamfer Modifier */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-[#f4f4f5]">Bevel Modifier</span>
                <span className="font-mono text-[#ea580c] text-[10px]">{bevelWidth.toFixed(3)}m</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.15"
                step="0.005"
                value={bevelWidth}
                onChange={(e) => setBevelWidth(parseFloat(e.target.value))}
                className="w-full accent-[#ea580c]"
              />
              <div className="flex items-center justify-between text-[10px] text-[#a1a1aa]">
                <span>Segments</span>
                <div className="flex space-x-1">
                  {[1, 2, 3, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setBevelSegments(s)}
                      className={`px-1.5 py-0.5 font-mono text-[9px] rounded-sm border ${
                        bevelSegments === s ? "bg-[#ea580c] text-white border-[#ea580c]" : "border-[#3f3f46]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Solidify Modifier */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-[#f4f4f5]">Solidify Modifier</span>
                <span className="font-mono text-[#ea580c] text-[10px]">{solidifyThickness.toFixed(2)}m</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.4"
                step="0.02"
                value={solidifyThickness}
                onChange={(e) => setSolidifyThickness(parseFloat(e.target.value))}
                className="w-full accent-[#ea580c]"
              />
            </div>

            {/* Array & Instancing Modifier */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-[#f4f4f5]">Linear / Radial Array</span>
                <span className="font-mono text-[#ea580c] text-[10px]">{arrayCount}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={arrayCount}
                onChange={(e) => setArrayCount(parseInt(e.target.value, 10))}
                className="w-full accent-[#ea580c]"
              />
            </div>

            {/* Bilateral Symmetry Mirror */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm flex items-center justify-between">
              <div>
                <span className="font-semibold text-[11px] text-[#f4f4f5] block">Mirror Symmetry</span>
                <span className="text-[10px] text-[#71717a]">Bilateral reflection on X axis</span>
              </div>
              <button
                type="button"
                onClick={() => setMirrorX(!mirrorX)}
                className={`px-2 py-1 text-[10px] font-mono border rounded-sm ${
                  mirrorX ? "bg-[#ea580c] text-white border-[#ea580c] font-bold" : "border-[#3f3f46] text-[#71717a]"
                }`}
              >
                {mirrorX ? "ACTIVE" : "OFF"}
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 5: SIMULATION & PHYSICS ================= */}
        {activeTab === "physics" && (
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase text-[#71717a]">Physics Engines & Dynamics</div>

            {/* Bake Physics Drop Button */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-2">
              <span className="font-semibold text-[11px] text-[#f4f4f5]">Rigid Body Gravity Drop</span>
              <p className="text-[10px] text-[#a1a1aa] leading-tight">
                Executes headless simulation bake onto ground collider with bounce & friction keyframes.
              </p>
              <button
                type="button"
                onClick={() => {
                  onExecute("blender_animate_pipeline", {
                    prompt: "Procedural rigid body gravity drop simulation across 120 keyframed frames with ground colliders",
                    format: "glb",
                  });
                }}
                className="w-full py-1.5 bg-[#ea580c] hover:bg-[#f97316] text-white font-semibold rounded-sm text-[10px] flex items-center justify-center space-x-1"
              >
                <Flame className="w-3 h-3 fill-current" />
                <span>Bake Physics Gravity Drop (120f)</span>
              </button>
            </div>

            {/* Exploded View Assembly Slider */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-[#f4f4f5]">Exploded View Assembly</span>
                <span className="font-mono text-[#ea580c] text-[10px]">{Math.round(explodedView * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.05"
                value={explodedView}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setExplodedView(val);
                  onLiveExplodedViewChange?.(val);
                }}
                className="w-full accent-[#ea580c]"
              />
              <p className="text-[9px] text-[#71717a]">
                Displaces individual sub-meshes along normal vectors for internal component inspection.
              </p>
            </div>

            {/* Organic Sinusoidal Wave Movement */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-[#f4f4f5]">Sinusoidal Wave Deform</span>
                <span className="font-mono text-[#ea580c] text-[10px]">{waveDeform.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={waveDeform}
                onChange={(e) => setWaveDeform(parseFloat(e.target.value))}
                className="w-full accent-[#ea580c]"
              />
            </div>
          </div>
        )}

        {/* ================= TAB 6: WORLD & LIGHTING ================= */}
        {activeTab === "world" && (
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase text-[#71717a]">Cinematic Studio & Lighting Rigs</div>

            {/* Studio Staging Presets */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-2">
              <span className="font-semibold text-[11px] text-[#f4f4f5]">Lighting Rig Presets</span>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { id: "studio", label: "3-Point Studio" },
                  { id: "softbox", label: "Softbox Cove" },
                  { id: "noir", label: "High-Contrast Noir" },
                  { id: "cyberpunk", label: "Teal & Orange" },
                ].map((rig) => (
                  <button
                    key={rig.id}
                    type="button"
                    onClick={() => setLightingRig(rig.id as any)}
                    className={`p-1.5 text-[10px] font-mono rounded-sm border text-left ${
                      lightingRig === rig.id
                        ? "bg-[#27272a] border-[#ea580c] text-[#f4f4f5] font-bold"
                        : "bg-[#18181b] border-[#3f3f46] text-[#a1a1aa]"
                    }`}
                  >
                    {rig.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Depth of Field & Post Processing */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[11px] text-[#f4f4f5] block">Depth of Field (DoF)</span>
                  <span className="text-[9px] text-[#71717a]">f/2.8 shallow aperture blur</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDofEnabled(!dofEnabled)}
                  className={`px-2 py-0.5 text-[9px] font-mono border rounded-sm ${
                    dofEnabled ? "bg-[#ea580c] text-white border-[#ea580c]" : "border-[#3f3f46] text-[#71717a]"
                  }`}
                >
                  {dofEnabled ? "ACTIVE" : "OFF"}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="font-semibold text-[11px] text-[#f4f4f5] block">Emissive Bloom & Glow</span>
                  <span className="text-[9px] text-[#71717a]">Glow shader threshold</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBloomEnabled(!bloomEnabled)}
                  className={`px-2 py-0.5 text-[9px] font-mono border rounded-sm ${
                    bloomEnabled ? "bg-[#ea580c] text-white border-[#ea580c]" : "border-[#3f3f46] text-[#71717a]"
                  }`}
                >
                  {bloomEnabled ? "ACTIVE" : "OFF"}
                </button>
              </div>
            </div>

            {/* Turntable & Hover Live Toggles */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-2">
              <span className="font-semibold text-[11px] text-[#f4f4f5]">Motion Previews</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const next = !turntableAnim;
                    setTurntableAnim(next);
                    onLiveTurntableChange?.(next);
                  }}
                  className={`p-1.5 text-[10px] font-mono border rounded-sm flex items-center justify-center space-x-1 ${
                    turntableAnim ? "bg-[#ea580c] text-white border-[#ea580c]" : "bg-[#18181b] border-[#3f3f46] text-[#a1a1aa]"
                  }`}
                >
                  <RotateCw className="w-3 h-3" />
                  <span>360° Turntable</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !hoverAnim;
                    setHoverAnim(next);
                    onLiveHoverChange?.(next);
                  }}
                  className={`p-1.5 text-[10px] font-mono border rounded-sm flex items-center justify-center space-x-1 ${
                    hoverAnim ? "bg-[#ea580c] text-white border-[#ea580c]" : "bg-[#18181b] border-[#3f3f46] text-[#a1a1aa]"
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Floating Hover</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
