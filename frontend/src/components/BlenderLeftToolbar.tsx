"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MousePointer,
  Crosshair,
  Move,
  RotateCw,
  Scale,
  Sparkles,
  Pencil,
  Ruler,
  Plus,
  Wand2,
  ChevronRight,
  Play,
  Loader2,
  Box,
} from "lucide-react";
import { McpToolDefinition, ToolExecutionResult } from "@/types/mcp";

export type TransformMode = "all" | "select" | "translate" | "rotate" | "scale";

interface BlenderLeftToolbarProps {
  isOpen: boolean;
  transformMode: TransformMode;
  onSetTransformMode: (mode: TransformMode) => void;
  onAddPrimitive: (type: string) => void;
  tools: McpToolDefinition[];
  isLoading: boolean;
  onExecuteTool: (
    toolName: string,
    args: { prompt?: string; script?: string; format: "glb" | "stl" | "obj" | "fbx" | "usdz" }
  ) => void;
  hasToken: boolean;
}

export function BlenderLeftToolbar({
  isOpen,
  transformMode,
  onSetTransformMode,
  onAddPrimitive,
  tools,
  isLoading,
  onExecuteTool,
  hasToken,
}: BlenderLeftToolbarProps) {
  const [activeTool, setActiveTool] = useState<string>("select");
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);

  // AI Prompt State
  const [selectedTool, setSelectedTool] = useState<string>("blender_mesh");
  const [prompt, setPrompt] = useState<string>(
    "Procedural mechanical turbine housing with beveled flanges, central bore, and 8 bolt clearance holes"
  );
  const [format, setFormat] = useState<"glb" | "stl" | "obj" | "fbx" | "usdz">("glb");

  const addMenuRef = useRef<HTMLDivElement>(null);
  const aiDrawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (addMenuRef.current && !addMenuRef.current.contains(target)) {
        setIsAddMenuOpen(false);
      }
      if (aiDrawerRef.current && !aiDrawerRef.current.contains(target)) {
        // Only close if not clicking the AI toggle button
        const btn = document.getElementById("mcp-ai-trigger-btn");
        if (!btn?.contains(target)) {
          setIsAiDrawerOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleRunAi = () => {
    if (!prompt.trim() || isLoading) return;
    onExecuteTool(selectedTool, { prompt: prompt.trim(), format });
    setIsAiDrawerOpen(false);
  };

  const PRESETS = [
    { label: "Turbine Housing", tool: "cad_model", prompt: "Procedural mechanical turbine housing with beveled flanges, central bore, and 8 bolt clearance holes" },
    { label: "Planetary Gearbox", tool: "blender_animation", prompt: "Kinematic planetary gearbox with sun gear, 4 planet gears, ring gear, and smooth rotation animation" },
    { label: "Clay Sculpt Bust", tool: "blender_sculpt_op", prompt: "Stylized organic sculpt bust with anatomical facial contours, cheekbones, and clay brush detailing" },
    { label: "Meteorite Relic", tool: "blender_sculpt", prompt: "Cratered deep-space asteroid relic with porous surface cavities and impact craters" },
    { label: "Dyson Swarm Lattice", tool: "blender_geometry_nodes", prompt: "Procedural geodesic dyson swarm lattice with orbiting photovoltaic collector arrays" },
    { label: "Rigid Body Drop", tool: "blender_physics_sim", prompt: "Rigid body physics drop of 24 dynamic chamfered cubes falling onto a collision bowl" },
  ];

  return (
    <div className="absolute top-2 left-2 z-20 flex pointer-events-auto">
      {/* 44px Single-Column Iconic T-Shelf Toolbar */}
      <div className="w-11 bg-[#18181b]/95 backdrop-blur-md border border-[#27272a] shadow-2xl rounded flex flex-col items-center py-1.5 space-y-1">
        {/* 1. Select Box (W) */}
        <button
          type="button"
          onClick={() => {
            onSetTransformMode("select");
            setActiveTool("select");
          }}
          title="Select Box [W]"
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
            transformMode === "select"
              ? "bg-[#ea580c]/20 text-[#ea580c] border-l-2 border-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
          }`}
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* 2. Universal Transform Gizmo (Q) */}
        <button
          type="button"
          onClick={() => {
            onSetTransformMode("all");
            setActiveTool("all");
          }}
          title="Universal Transform Gizmo (Move, Rotate, Scale) [Q]"
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
            transformMode === "all"
              ? "bg-[#ea580c]/20 text-[#ea580c] border-l-2 border-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
          }`}
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* 3. Move / Translate Gizmo (G / W) */}
        <button
          type="button"
          onClick={() => {
            onSetTransformMode("translate");
            setActiveTool("translate");
          }}
          title="Move / Translate Gizmo [G / W]"
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
            transformMode === "translate"
              ? "bg-[#ea580c]/20 text-[#ea580c] border-l-2 border-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
          }`}
        >
          <Move className="w-4 h-4" />
        </button>

        {/* 4. Rotate Gizmo (R / E) */}
        <button
          type="button"
          onClick={() => {
            onSetTransformMode("rotate");
            setActiveTool("rotate");
          }}
          title="Rotate Gizmo [R / E]"
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
            transformMode === "rotate"
              ? "bg-[#ea580c]/20 text-[#ea580c] border-l-2 border-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
          }`}
        >
          <RotateCw className="w-4 h-4" />
        </button>

        {/* 5. Scale Gizmo (S / R) */}
        <button
          type="button"
          onClick={() => {
            onSetTransformMode("scale");
            setActiveTool("scale");
          }}
          title="Scale Gizmo [S / R]"
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
            transformMode === "scale"
              ? "bg-[#ea580c]/20 text-[#ea580c] border-l-2 border-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
          }`}
        >
          <Scale className="w-4 h-4" />
        </button>

        {/* 6. 3D Cursor (Shift + S) */}
        <button
          type="button"
          onClick={() => setActiveTool("cursor")}
          title="3D Cursor Pivot [Shift + S]"
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
            activeTool === "cursor"
              ? "bg-[#ea580c]/20 text-[#ea580c] border-l-2 border-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
          }`}
        >
          <Crosshair className="w-4 h-4" />
        </button>

        <div className="w-6 h-px bg-[#27272a]" />

        {/* 7. Annotate / Grease Pencil (D) */}
        <button
          type="button"
          onClick={() => setActiveTool("annotate")}
          title="Annotate / Grease Pencil [D]"
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
            activeTool === "annotate"
              ? "bg-[#ea580c]/20 text-[#ea580c] border-l-2 border-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
          }`}
        >
          <Pencil className="w-4 h-4" />
        </button>

        {/* 8. Measure Tool (M) */}
        <button
          type="button"
          onClick={() => setActiveTool("measure")}
          title="Measure / Dimension Tape [M]"
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
            activeTool === "measure"
              ? "bg-[#ea580c]/20 text-[#ea580c] border-l-2 border-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
          }`}
        >
          <Ruler className="w-4 h-4" />
        </button>

        {/* 9. Quick Add Primitive (Shift + A) */}
        <div ref={addMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
            title="Quick Add Primitive [Shift + A]"
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              isAddMenuOpen
                ? "bg-[#ea580c] text-white"
                : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
            }`}
          >
            <Plus className="w-4 h-4" />
          </button>

          {isAddMenuOpen && (
            <div className="absolute left-10 top-0 w-44 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded p-1 z-50 text-[11px] space-y-0.5 font-mono">
              <div className="text-[9px] uppercase text-[#71717a] px-2 py-0.5 border-b border-[#27272a]">
                Mesh Primitives
              </div>
              {[
                { type: "cube", label: "Cube" },
                { type: "cylinder", label: "Cylinder" },
                { type: "uv_sphere", label: "UV Sphere" },
                { type: "cone", label: "Cone" },
                { type: "torus", label: "Torus" },
                { type: "plane", label: "Plane" },
                { type: "suzanne", label: "Monkey (Suzanne)" },
              ].map((p) => (
                <button
                  key={p.type}
                  type="button"
                  onClick={() => {
                    onAddPrimitive(p.type);
                    setIsAddMenuOpen(false);
                  }}
                  className="w-full text-left px-2 py-1 rounded-xs text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5] transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-6 h-px bg-[#27272a]" />

        {/* 10. Generative MCP AI Studio (Sparkles / Wand) */}
        <button
          id="mcp-ai-trigger-btn"
          type="button"
          onClick={() => setIsAiDrawerOpen(!isAiDrawerOpen)}
          title="Generative Blender MCP Prompt Studio [Ctrl + Space]"
          className={`w-8 h-8 rounded flex items-center justify-center transition-all ${
            isAiDrawerOpen || isLoading
              ? "bg-[#ea580c] text-white animate-pulse"
              : "text-[#ea580c] hover:bg-[#ea580c]/20"
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Wand2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Floating MCP AI Generator Flyout Drawer (310px width) */}
      {isAiDrawerOpen && (
        <div
          ref={aiDrawerRef}
          className="ml-2 w-[310px] bg-[#18181b]/98 backdrop-blur-md border border-[#3f3f46] shadow-2xl rounded p-3 z-50 text-xs font-mono space-y-2.5 animate-in fade-in slide-in-from-left-2 duration-150"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-[#27272a]">
            <span className="font-bold text-[#f4f4f5] flex items-center text-[11px]">
              <Sparkles className="w-3.5 h-3.5 mr-1 text-[#ea580c]" />
              GENERATIVE BLENDER MCP
            </span>
            <button
              type="button"
              onClick={() => setIsAiDrawerOpen(false)}
              className="text-[#71717a] hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Tool Selector */}
          <div>
            <label className="text-[10px] text-[#71717a] uppercase block mb-1">
              MCP Tool Pipeline
            </label>
            <select
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              className="w-full bg-[#141416] border border-[#333338] px-2 py-1 text-xs text-[#f4f4f5] rounded focus:border-[#ea580c] outline-none"
            >
              {tools.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt Textarea */}
          <div>
            <label className="text-[10px] text-[#71717a] uppercase block mb-1">
              Natural Language 3D Instruction
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe 3D geometry, materials, animation..."
              className="w-full bg-[#141416] border border-[#333338] p-2 text-xs text-[#f4f4f5] rounded focus:border-[#ea580c] outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Format & Execute Button */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-1">
              {(["glb", "stl", "obj"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                    format === fmt
                      ? "bg-[#333338] text-[#ea580c]"
                      : "text-[#71717a] hover:text-[#f4f4f5]"
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={isLoading || !prompt.trim()}
              onClick={handleRunAi}
              className="flex items-center space-x-1.5 px-3 py-1 bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold text-xs rounded transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Presets */}
          <div className="pt-1 border-t border-[#27272a]">
            <div className="text-[9px] uppercase text-[#71717a] mb-1">Production Presets</div>
            <div className="grid grid-cols-2 gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setSelectedTool(p.tool);
                    setPrompt(p.prompt);
                    onExecuteTool(p.tool, { prompt: p.prompt, format });
                    setIsAiDrawerOpen(false);
                  }}
                  className="px-1.5 py-1 text-left bg-[#141416] hover:bg-[#202024] border border-[#27272a] rounded text-[10px] text-[#a1a1aa] hover:text-[#f4f4f5] truncate"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
