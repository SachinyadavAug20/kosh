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
    label: "Pyramid",
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
];

export function CommandConsole({
  tools,
  isLoading,
  onExecute,
  lastResult,
  error,
  hasToken,
}: CommandConsoleProps) {
  const [selectedTool, setSelectedTool] = useState<string>("blender_mesh");
  const [format, setFormat] = useState<"glb" | "stl">("glb");
  const [prompt, setPrompt] = useState<string>(
    "Procedural mechanical turbine housing with beveled flanges, central bore, and 8 bolt clearance holes"
  );

  // Accordion Sections
  const [openModifiers, setOpenModifiers] = useState<boolean>(true);
  const [openMaterials, setOpenMaterials] = useState<boolean>(false);

  // Modifiers Stack Values
  const [subsurfLevel, setSubsurfLevel] = useState<number>(1);
  const [bevelWidth, setBevelWidth] = useState<number>(0.05);
  const [useMirror, setUseMirror] = useState<boolean>(false);
  const [useDecimate, setUseDecimate] = useState<boolean>(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    // Inject modifier specifications into prompt if tuned
    let enrichedPrompt = prompt.trim();
    if (bevelWidth > 0 && !enrichedPrompt.toLowerCase().includes("bevel")) {
      enrichedPrompt += ` with bevel width ${bevelWidth}`;
    }
    if (subsurfLevel > 0 && !enrichedPrompt.toLowerCase().includes("subsurf")) {
      enrichedPrompt += ` and subsurf level ${subsurfLevel}`;
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
      {/* Top Tool Switcher Strip */}
      <div className="flex items-center justify-between p-2 border-b border-[#3f3f46] bg-[#1f1f23]">
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

        {/* Format chips */}
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

      {/* Main Parameters Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
        {/* Prompt Input Form */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-[#a1a1aa] mb-1">
            <span className="font-medium">Generator Instructions</span>
            <span className="text-[10px] text-[#71717a] font-mono">Ctrl+Enter</span>
          </div>
          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe 3D geometry, boolean cuts, dimensions, bevels, or materials..."
            className="w-full bg-[#1f1f23] border border-[#3f3f46] focus:border-[#52525b] focus:outline-none p-2 text-xs text-[#f4f4f5] font-mono rounded-sm resize-none leading-relaxed"
          />
        </div>

        {/* Action Button: Industrial Safety Orange (ONLY here) */}
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

        {/* Modifiers Stack Accordion */}
        <div className="border border-[#3f3f46] bg-[#1f1f23] rounded-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenModifiers(!openModifiers)}
            className="w-full flex items-center justify-between p-2 text-[11px] font-semibold text-[#f4f4f5] hover:bg-[#27272a] transition-colors"
          >
            <div className="flex items-center space-x-1.5">
              <Sliders className="w-3 h-3 text-[#a1a1aa]" />
              <span>Modifiers Stack</span>
            </div>
            {openModifiers ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          {openModifiers && (
            <div className="p-2 border-t border-[#3f3f46] space-y-2 text-[11px] bg-[#18181b]">
              {/* Bevel Chamfer */}
              <div>
                <div className="flex justify-between text-[10px] text-[#a1a1aa] mb-0.5">
                  <span>Bevel Chamfer Width</span>
                  <span className="font-mono text-[#f4f4f5]">{bevelWidth}m</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.15"
                  step="0.01"
                  value={bevelWidth}
                  onChange={(e) => setBevelWidth(parseFloat(e.target.value))}
                  className="w-full accent-[#71717a] cursor-pointer"
                />
              </div>

              {/* Subsurf Level */}
              <div>
                <div className="flex justify-between text-[10px] text-[#a1a1aa] mb-0.5">
                  <span>Subdivision Surface</span>
                  <span className="font-mono text-[#f4f4f5]">Lvl {subsurfLevel}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="1"
                  value={subsurfLevel}
                  onChange={(e) => setSubsurfLevel(parseInt(e.target.value))}
                  className="w-full accent-[#71717a] cursor-pointer"
                />
              </div>

              {/* Symmetry / Decimate toggles */}
              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setUseMirror(!useMirror)}
                  className={`px-2 py-0.5 text-[10px] border rounded-sm ${
                    useMirror ? "bg-[#3f3f46] text-[#f4f4f5] border-[#52525b]" : "border-[#3f3f46] text-[#71717a]"
                  }`}
                >
                  Mirror Symmetry
                </button>
                <button
                  type="button"
                  onClick={() => setUseDecimate(!useDecimate)}
                  className={`px-2 py-0.5 text-[10px] border rounded-sm ${
                    useDecimate ? "bg-[#3f3f46] text-[#f4f4f5] border-[#52525b]" : "border-[#3f3f46] text-[#71717a]"
                  }`}
                >
                  Decimate Poly
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Material Presets Accordion */}
        <div className="border border-[#3f3f46] bg-[#1f1f23] rounded-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenMaterials(!openMaterials)}
            className="w-full flex items-center justify-between p-2 text-[11px] font-semibold text-[#f4f4f5] hover:bg-[#27272a] transition-colors"
          >
            <div className="flex items-center space-x-1.5">
              <Layers className="w-3 h-3 text-[#a1a1aa]" />
              <span>BSDF Material Presets</span>
            </div>
            {openMaterials ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          {openMaterials && (
            <div className="p-2 border-t border-[#3f3f46] grid grid-cols-2 gap-1 text-[10px] bg-[#18181b]">
              {[
                { label: "Titanium Metal", desc: "Metallic 0.95" },
                { label: "Machined Steel", desc: "Roughness 0.2" },
                { label: "Terracotta Clay", desc: "Matte Sculpt" },
                { label: "Frosted Glass", desc: "Transmission 0.8" },
                { label: "Graphite Polymer", desc: "Industrial" },
                { label: "Safety Orange", desc: "Accent BSDF" },
              ].map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt((prev) => `${prev} with ${m.label.toLowerCase()} material`)}
                  className="p-1.5 text-left bg-[#1f1f23] border border-[#3f3f46] hover:bg-[#27272a] rounded-sm text-[#f4f4f5] transition-colors"
                >
                  <div className="font-medium">{m.label}</div>
                  <div className="text-[9px] text-[#71717a]">{m.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error Notice with Auto-Retry */}
        {error && (
          <div className="p-2.5 bg-[#27272a] border border-[#dc2626] rounded-sm text-xs space-y-1.5">
            <div className="flex items-center space-x-1.5 font-semibold text-[#f87171]">
              <AlertTriangle className="w-3.5 h-3.5 text-[#ef4444]" />
              <span>Process Failure</span>
            </div>
            <div className="text-[10px] font-mono text-[#fca5a5] break-all leading-normal opacity-90">{error}</div>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isLoading}
              className="w-full py-1 bg-[#dc2626] hover:bg-[#ef4444] text-[#ffffff] font-semibold text-[11px] rounded-sm transition-colors flex items-center justify-center space-x-1"
            >
              <RotateCcw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
              <span>RETRY GENERATION</span>
            </button>
          </div>
        )}

        {/* Success Notice */}
        {lastResult && lastResult.success && (
          <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm text-[11px] flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-[#f4f4f5]">
              <Check className="w-3.5 h-3.5 text-[#a1a1aa]" />
              <span className="font-mono truncate">{lastResult.assetName}</span>
            </div>
            <span className="text-[10px] font-mono text-[#71717a]">{lastResult.executionTimeMs}ms</span>
          </div>
        )}
      </div>

      {/* Engine Status Line */}
      <div className="p-2 border-t border-[#3f3f46] bg-[#1f1f23] text-[10px] text-[#71717a] font-mono flex items-center justify-between">
        <span>ENGINE: Blender 5.2 LTS</span>
        <span>AI: Gemini 2.5</span>
      </div>
    </div>
  );
}
