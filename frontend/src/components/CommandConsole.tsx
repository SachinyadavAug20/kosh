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
} from "lucide-react";

interface CommandConsoleProps {
  tools: McpToolDefinition[];
  isLoading: boolean;
  onExecute: (
    toolName: string,
    args: { prompt?: string; script?: string; format: "glb" | "stl" }
  ) => void;
  lastResult: ToolExecutionResult | null;
  error: string | null;
  hasToken: boolean;
}

const PRESETS = [
  {
    tool: "cad_model",
    label: "Turbine Housing",
    format: "glb" as const,
    prompt: "Procedural mechanical turbine housing with beveled flanges, central bore, and 8 bolt clearance holes",
  },
  {
    tool: "blender_mesh",
    label: "Studio Pyramid",
    format: "glb" as const,
    prompt: "4-sided beveled studio pyramid with precision chamfers and distinct face materials",
  },
  {
    tool: "cad_model",
    label: "Flange Coupling",
    format: "glb" as const,
    prompt: "Precision industrial flange coupling with center drive bore, keyway slot, and bolt holes",
  },
  {
    tool: "cad_model",
    label: "Spur Gear (STL)",
    format: "stl" as const,
    prompt: "Parametric mechanical spur gear with 18 teeth, 40mm pitch diameter, central shaft bore",
  },
  {
    tool: "blender_mesh",
    label: "Geodesic Sphere",
    format: "glb" as const,
    prompt: "Subdivided geodesic orb with frosted glass material and metallic core",
  },
  {
    tool: "blender_mesh",
    label: "Suzanne Monkey",
    format: "glb" as const,
    prompt: "Subdivided Suzanne monkey head with brushed titanium material and chamfered base",
  },
  {
    tool: "cad_model",
    label: "Mobius Ribbon",
    format: "glb" as const,
    prompt: "Parametric twisted Mobius ribbon with subdivision surface and red wax matcap",
  },
];

const MATERIAL_PRESETS = [
  { name: "Brushed Aluminium", metal: 0.92, rough: 0.22, trans: 0.0, color: "#cbd5e1" },
  { name: "Cast Iron", metal: 0.75, rough: 0.65, trans: 0.0, color: "#334155" },
  { name: "Chrome Mirror", metal: 1.0, rough: 0.05, trans: 0.0, color: "#f8fafc" },
  { name: "Polished Concrete", metal: 0.05, rough: 0.85, trans: 0.0, color: "#94a3b8" },
  { name: "Ceramic Tile", metal: 0.0, rough: 0.15, trans: 0.0, color: "#f1f5f9" },
  { name: "Frosted Glass", metal: 0.05, rough: 0.12, trans: 0.88, color: "#e2e8f0" },
  { name: "Red Wax SSS", metal: 0.0, rough: 0.35, trans: 0.0, color: "#b91c1c" },
  { name: "Studio Clay", metal: 0.0, rough: 0.75, trans: 0.0, color: "#d97706" },
  { name: "Industrial Polymer", metal: 0.1, rough: 0.4, trans: 0.0, color: "#1e293b" },
];

export function CommandConsole({
  tools,
  isLoading,
  onExecute,
  lastResult,
  error,
  hasToken,
}: CommandConsoleProps) {
  // Active Drawer Tab
  const [activeTab, setActiveTab] = useState<"ai" | "modifiers" | "shader" | "anim">("ai");

  // AI & Generator Settings
  const [selectedTool, setSelectedTool] = useState<string>("blender_mesh");
  const [format, setFormat] = useState<"glb" | "stl">("glb");
  const [prompt, setPrompt] = useState<string>(
    "Procedural mechanical turbine housing with beveled flanges, central bore, and 8 bolt clearance holes"
  );

  // Tab 2: Modifiers Stack
  const [bevelWidth, setBevelWidth] = useState<number>(0.04);
  const [bevelSegments, setBevelSegments] = useState<number>(3);
  const [subsurfLevel, setSubsurfLevel] = useState<number>(1);
  const [displaceStrength, setDisplaceStrength] = useState<number>(0.0);
  const [solidifyThickness, setSolidifyThickness] = useState<number>(0.0);
  const [arrayCount, setArrayCount] = useState<number>(1);
  const [mirrorX, setMirrorX] = useState<boolean>(false);
  const [decimateRatio, setDecimateRatio] = useState<number>(1.0);

  // Tab 3: Shader & World
  const [matPreset, setMatPreset] = useState<string>("Brushed Aluminium");
  const [metallic, setMetallic] = useState<number>(0.92);
  const [roughness, setRoughness] = useState<number>(0.22);
  const [transmission, setTransmission] = useState<number>(0.0);
  const [clearcoat, setClearcoat] = useState<number>(0.0);
  const [emission, setEmission] = useState<number>(0.0);
  const [lightingRig, setLightingRig] = useState<"studio" | "noir" | "softbox" | "sky">("studio");

  // Tab 4: Animation & Timeline
  const [turntableAnim, setTurntableAnim] = useState<boolean>(false);
  const [hoverAnim, setHoverAnim] = useState<boolean>(false);
  const [explodedView, setExplodedView] = useState<number>(0.0);
  const [frameCount, setFrameCount] = useState<number>(60);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const handleApplyPreset = (preset: typeof MATERIAL_PRESETS[0]) => {
    setMatPreset(preset.name);
    setMetallic(preset.metal);
    setRoughness(preset.rough);
    setTransmission(preset.trans);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    let enrichedPrompt = prompt.trim();

    // Enrich with active modifiers if tuned
    if (bevelWidth > 0 && !enrichedPrompt.toLowerCase().includes("bevel")) {
      enrichedPrompt += `, bevel width ${bevelWidth}m (${bevelSegments} segments)`;
    }
    if (subsurfLevel > 0 && !enrichedPrompt.toLowerCase().includes("subsurf")) {
      enrichedPrompt += `, subdivision surface level ${subsurfLevel}`;
    }
    if (displaceStrength > 0) {
      enrichedPrompt += `, displace procedural noise strength ${displaceStrength}`;
    }
    if (solidifyThickness > 0) {
      enrichedPrompt += `, solidify thickness ${solidifyThickness}m`;
    }
    if (arrayCount > 1) {
      enrichedPrompt += `, array count ${arrayCount}`;
    }
    if (mirrorX) {
      enrichedPrompt += `, symmetrical mirror along X axis`;
    }

    // Enrich with active material
    if (matPreset && !enrichedPrompt.toLowerCase().includes("material")) {
      enrichedPrompt += `, ${matPreset} Principled BSDF material (metallic=${metallic}, roughness=${roughness})`;
    }

    // Enrich with lighting & animation
    if (lightingRig === "noir") {
      enrichedPrompt += `, high-contrast noir lighting`;
    } else if (lightingRig === "softbox") {
      enrichedPrompt += `, softbox studio product lighting`;
    } else if (lightingRig === "sky") {
      enrichedPrompt += `, outdoor Nishita atmospheric sky`;
    }

    if (turntableAnim) {
      enrichedPrompt += `, 360-degree turntable keyframe animation across ${frameCount} frames`;
    }
    if (hoverAnim) {
      enrichedPrompt += `, floating hover sine oscillation`;
    }
    if (explodedView > 0) {
      enrichedPrompt += `, exploded view separation ${explodedView}m`;
    }

    onExecute(selectedTool, { prompt: enrichedPrompt, format });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-[#f4f4f5] text-xs font-sans border-r border-[#3f3f46]">
      {/* 4-Tab DCC Navigation Strip */}
      <div className="grid grid-cols-4 border-b border-[#3f3f46] bg-[#1f1f23]">
        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={`py-2 flex flex-col items-center justify-center space-y-1 transition-colors border-r border-[#3f3f46] ${
            activeTab === "ai"
              ? "bg-[#27272a] text-[#f4f4f5] font-semibold border-b-2 border-b-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50"
          }`}
          title="Generative AI & Presets"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span className="text-[10px]">AI Prompt</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("modifiers")}
          className={`py-2 flex flex-col items-center justify-center space-y-1 transition-colors border-r border-[#3f3f46] ${
            activeTab === "modifiers"
              ? "bg-[#27272a] text-[#f4f4f5] font-semibold border-b-2 border-b-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50"
          }`}
          title="Modifiers Stack"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="text-[10px]">Modifiers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("shader")}
          className={`py-2 flex flex-col items-center justify-center space-y-1 transition-colors border-r border-[#3f3f46] ${
            activeTab === "shader"
              ? "bg-[#27272a] text-[#f4f4f5] font-semibold border-b-2 border-b-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50"
          }`}
          title="Shader, Materials & Lighting"
        >
          <Palette className="w-3.5 h-3.5" />
          <span className="text-[10px]">Shaders</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("anim")}
          className={`py-2 flex flex-col items-center justify-center space-y-1 transition-colors ${
            activeTab === "anim"
              ? "bg-[#27272a] text-[#f4f4f5] font-semibold border-b-2 border-b-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50"
          }`}
          title="Animation & Rigging"
        >
          <Film className="w-3.5 h-3.5" />
          <span className="text-[10px]">Animation</span>
        </button>
      </div>

      {/* Main Parameters Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
        {/* ================= TAB 1: GENERATIVE AI (MCP) ================= */}
        {activeTab === "ai" && (
          <div className="space-y-3">
            {/* Tool & Format Strip */}
            <div className="flex items-center justify-between p-1.5 bg-[#1f1f23] border border-[#3f3f46] rounded-sm">
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setSelectedTool("blender_mesh")}
                  className={`tool-btn ${selectedTool === "blender_mesh" ? "active" : ""}`}
                >
                  <Box className="w-3.5 h-3.5 mr-1" />
                  <span>Mesh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTool("cad_model")}
                  className={`tool-btn ${selectedTool === "cad_model" ? "active" : ""}`}
                >
                  <Cog className="w-3.5 h-3.5 mr-1" />
                  <span>CAD</span>
                </button>
              </div>

              <div className="flex items-center bg-[#18181b] border border-[#3f3f46] p-0.5 rounded-sm">
                <button
                  type="button"
                  onClick={() => setFormat("glb")}
                  className={`px-1.5 py-0.5 font-mono text-[10px] rounded-sm transition-colors ${
                    format === "glb" ? "bg-[#3f3f46] text-[#f4f4f5] font-bold" : "text-[#71717a] hover:text-[#a1a1aa]"
                  }`}
                >
                  GLB
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("stl")}
                  className={`px-1.5 py-0.5 font-mono text-[10px] rounded-sm transition-colors ${
                    format === "stl" ? "bg-[#3f3f46] text-[#f4f4f5] font-bold" : "text-[#71717a] hover:text-[#a1a1aa]"
                  }`}
                >
                  STL
                </button>
              </div>
            </div>

            {/* Prompt Form */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-[#a1a1aa] mb-1">
                <span className="font-medium">Generator Instructions</span>
                <span className="text-[10px] text-[#71717a] font-mono">Ctrl+Enter</span>
              </div>
              <textarea
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe 3D geometry, boolean cuts, dimensions, bevels, or materials..."
                className="w-full bg-[#1f1f23] border border-[#3f3f46] focus:border-[#52525b] focus:outline-none p-2 text-xs text-[#f4f4f5] font-mono rounded-sm resize-none leading-relaxed"
              />
            </div>

            {/* Quick Presets Strip */}
            <div>
              <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-1">DCC Presets</div>
              <div className="flex flex-wrap gap-1">
                {PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedTool(p.tool);
                      setFormat(p.format);
                      setPrompt(p.prompt);
                    }}
                    className="px-2 py-0.5 bg-[#1f1f23] border border-[#3f3f46] hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] text-[10px] rounded-sm transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: MODIFIERS STACK ================= */}
        {activeTab === "modifiers" && (
          <div className="space-y-3">
            <div className="text-[10px] text-[#71717a] uppercase tracking-wider">Active Modifiers Engine</div>

            {/* Bevel */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-[#f4f4f5]">Bevel Chamfer</span>
                <span className="font-mono text-[10px] text-[#ea580c]">{bevelWidth}m</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.2"
                step="0.01"
                value={bevelWidth}
                onChange={(e) => setBevelWidth(parseFloat(e.target.value))}
                className="w-full accent-[#71717a] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#a1a1aa]">
                <span>Segments: {bevelSegments}</span>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 8].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setBevelSegments(s)}
                      className={`px-1 rounded text-[9px] ${
                        bevelSegments === s ? "bg-[#3f3f46] text-white" : "bg-[#18181b] text-[#71717a]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Subsurf */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-[#f4f4f5]">Subdivision Surface</span>
                <span className="font-mono text-[10px] text-[#ea580c]">Lvl {subsurfLevel}</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                value={subsurfLevel}
                onChange={(e) => setSubsurfLevel(parseInt(e.target.value, 10))}
                className="w-full accent-[#71717a] cursor-pointer"
              />
            </div>

            {/* Displace */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-[#f4f4f5]">Displace (Procedural Noise)</span>
                <span className="font-mono text-[10px] text-[#ea580c]">{displaceStrength.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={displaceStrength}
                onChange={(e) => setDisplaceStrength(parseFloat(e.target.value))}
                className="w-full accent-[#71717a] cursor-pointer"
              />
            </div>

            {/* Solidify */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-[#f4f4f5]">Solidify Thickness</span>
                <span className="font-mono text-[10px] text-[#ea580c]">{solidifyThickness}m</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.02"
                value={solidifyThickness}
                onChange={(e) => setSolidifyThickness(parseFloat(e.target.value))}
                className="w-full accent-[#71717a] cursor-pointer"
              />
            </div>

            {/* Mirror & Array */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1">
                <span className="text-[10px] text-[#a1a1aa] block">Symmetric Mirror</span>
                <button
                  type="button"
                  onClick={() => setMirrorX(!mirrorX)}
                  className={`w-full py-1 text-[10px] font-mono border rounded-sm transition-colors ${
                    mirrorX ? "bg-[#3f3f46] text-[#f4f4f5] border-[#52525b]" : "border-[#3f3f46] text-[#71717a]"
                  }`}
                >
                  {mirrorX ? "MIRROR X: ON" : "MIRROR X: OFF"}
                </button>
              </div>

              <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1">
                <span className="text-[10px] text-[#a1a1aa] block">Array Count: {arrayCount}</span>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={arrayCount}
                  onChange={(e) => setArrayCount(parseInt(e.target.value, 10))}
                  className="w-full accent-[#71717a] cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: SHADER & WORLD ================= */}
        {activeTab === "shader" && (
          <div className="space-y-3">
            <div className="text-[10px] text-[#71717a] uppercase tracking-wider">Instant Material Library</div>
            <div className="grid grid-cols-3 gap-1">
              {MATERIAL_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className={`p-1.5 border rounded-sm text-left transition-colors ${
                    matPreset === p.name
                      ? "bg-[#27272a] border-[#ea580c] text-[#f4f4f5]"
                      : "bg-[#1f1f23] border-[#3f3f46] text-[#a1a1aa] hover:text-[#f4f4f5]"
                  }`}
                >
                  <div className="flex items-center space-x-1.5 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full inline-block border border-black/40" style={{ backgroundColor: p.color }} />
                    <span className="text-[10px] font-medium truncate">{p.name}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="text-[10px] text-[#71717a] uppercase tracking-wider pt-1">Principled BSDF 2.0</div>
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-2">
              <div>
                <div className="flex justify-between text-[10px] text-[#a1a1aa] mb-0.5">
                  <span>METALLIC</span>
                  <span className="font-mono text-[#f4f4f5]">{metallic.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={metallic}
                  onChange={(e) => setMetallic(parseFloat(e.target.value))}
                  className="w-full accent-[#71717a] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-[#a1a1aa] mb-0.5">
                  <span>ROUGHNESS</span>
                  <span className="font-mono text-[#f4f4f5]">{roughness.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={roughness}
                  onChange={(e) => setRoughness(parseFloat(e.target.value))}
                  className="w-full accent-[#71717a] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-[#a1a1aa] mb-0.5">
                  <span>TRANSMISSION (GLASS)</span>
                  <span className="font-mono text-[#f4f4f5]">{transmission.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={transmission}
                  onChange={(e) => setTransmission(parseFloat(e.target.value))}
                  className="w-full accent-[#71717a] cursor-pointer"
                />
              </div>
            </div>

            <div className="text-[10px] text-[#71717a] uppercase tracking-wider pt-1">Lighting & World Rig</div>
            <div className="grid grid-cols-2 gap-1">
              {[
                { id: "studio", label: "3-Point Studio" },
                { id: "noir", label: "High-Contrast Noir" },
                { id: "softbox", label: "Clean Softbox" },
                { id: "sky", label: "Nishita HDRI Sky" },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setLightingRig(r.id as any)}
                  className={`p-1.5 border text-center rounded-sm text-[10px] font-mono transition-colors ${
                    lightingRig === r.id
                      ? "bg-[#27272a] border-[#ea580c] text-[#f4f4f5] font-semibold"
                      : "bg-[#1f1f23] border-[#3f3f46] text-[#a1a1aa] hover:text-[#f4f4f5]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 4: ANIMATION & RIGGING ================= */}
        {activeTab === "anim" && (
          <div className="space-y-3">
            <div className="text-[10px] text-[#71717a] uppercase tracking-wider">Animation Rigging Suite</div>

            {/* Turntable */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-[#f4f4f5]">Turntable 360 Spin</span>
                <button
                  type="button"
                  onClick={() => setTurntableAnim(!turntableAnim)}
                  className={`px-2 py-0.5 text-[10px] font-mono border rounded-sm ${
                    turntableAnim ? "bg-[#3f3f46] text-[#f4f4f5] border-[#52525b]" : "border-[#3f3f46] text-[#71717a]"
                  }`}
                >
                  {turntableAnim ? "ON" : "OFF"}
                </button>
              </div>
              <p className="text-[10px] text-[#71717a]">Embeds 360-degree rotation animation track into exported GLB.</p>
            </div>

            {/* Hover Oscillation */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-[#f4f4f5]">Floating Hover Oscillation</span>
                <button
                  type="button"
                  onClick={() => setHoverAnim(!hoverAnim)}
                  className={`px-2 py-0.5 text-[10px] font-mono border rounded-sm ${
                    hoverAnim ? "bg-[#3f3f46] text-[#f4f4f5] border-[#52525b]" : "border-[#3f3f46] text-[#71717a]"
                  }`}
                >
                  {hoverAnim ? "ON" : "OFF"}
                </button>
              </div>
              <p className="text-[10px] text-[#71717a]">Sine-wave vertical levitation keyframes.</p>
            </div>

            {/* Exploded View */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-[#f4f4f5]">Exploded View Separation</span>
                <span className="font-mono text-[10px] text-[#ea580c]">{explodedView.toFixed(2)}m</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={explodedView}
                onChange={(e) => setExplodedView(parseFloat(e.target.value))}
                className="w-full accent-[#71717a] cursor-pointer"
              />
              <p className="text-[10px] text-[#71717a]">Displaces multi-part assembly components along their normals.</p>
            </div>

            {/* Timeline length */}
            <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-[#f4f4f5]">Timeline Frame Count</span>
                <span className="font-mono text-[10px] text-[#f4f4f5]">{frameCount} Frames</span>
              </div>
              <div className="flex space-x-1">
                {[30, 60, 120, 240].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrameCount(f)}
                    className={`flex-1 py-1 rounded text-[10px] font-mono ${
                      frameCount === f ? "bg-[#3f3f46] text-white font-bold" : "bg-[#18181b] text-[#71717a]"
                    }`}
                  >
                    {f}f
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Bottom Action Trigger: Industrial Safety Orange (#ea580c) ONLY */}
      <div className="p-2.5 border-t border-[#3f3f46] bg-[#1f1f23] space-y-1.5">
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isLoading || !prompt.trim()}
          className="w-full py-2 bg-[#ea580c] hover:bg-[#f97316] text-[#ffffff] font-semibold text-xs rounded-sm transition-colors flex items-center justify-center space-x-1.5 shadow-none disabled:opacity-40 disabled:cursor-not-allowed border border-[#c2410c]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>COMPILING BLENDER BPY...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>COMPILE & EXECUTE (Ctrl+Enter)</span>
            </>
          )}
        </button>

        {/* Status / Latency telemetry */}
        <div className="flex items-center justify-between text-[10px] text-[#71717a] font-mono px-0.5">
          <span>{hasToken ? "● GEMINI ACTIVE" : "○ DEMO MODE"}</span>
          {lastResult && (
            <span>
              {lastResult.executionTimeMs}ms • {(lastResult.sizeBytes / 1024).toFixed(1)}KB
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
