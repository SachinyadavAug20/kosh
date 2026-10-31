"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MousePointer,
  Crosshair,
  Move,
  RotateCw,
  Scale,
  Sparkles,
  Plus,
  Wand2,
  SquareChevronUp,
  Minimize2,
  CornerDownRight,
  Columns,
  Loader2,
  Box,
  Circle,
  Layers,
  Compass,
  Square,
} from "lucide-react";
import { McpToolDefinition } from "@/types/mcp";

export type SelectionTool = "tweak" | "box" | "circle" | "lasso";

export type TransformMode =
  | "all"
  | "select"
  | "translate"
  | "rotate"
  | "scale"
  | "cursor"
  | "extrude"
  | "inset"
  | "bevel"
  | "loopcut";

interface BlenderLeftToolbarProps {
  isOpen: boolean;
  transformMode: TransformMode;
  onSetTransformMode: (mode: TransformMode) => void;
  selectionTool?: SelectionTool;
  onSetSelectionTool?: (tool: SelectionTool) => void;
  onAddPrimitive: (type: string) => void;
  tools?: McpToolDefinition[];
  isLoading?: boolean;
  onExecuteTool?: (
    toolName: string,
    args: { prompt?: string; script?: string; format: "glb" | "stl" | "obj" | "fbx" | "usdz" }
  ) => void;
  hasToken?: boolean;
}

export function BlenderLeftToolbar({
  isOpen,
  transformMode,
  onSetTransformMode,
  selectionTool = "tweak",
  onSetSelectionTool,
  onAddPrimitive,
  tools = [],
  isLoading = false,
  onExecuteTool,
  hasToken = false,
}: BlenderLeftToolbarProps) {
  const [activeTool, setActiveTool] = useState<TransformMode>("select");
  const [isSelectMenuOpen, setIsSelectMenuOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);

  // AI Prompt State
  const [selectedTool, setSelectedTool] = useState<string>("cad_model");
  const [prompt, setPrompt] = useState<string>(
    "A precision mechanical turbine base flange with central bore, 8 metric bolt holes, and chamfered bevels"
  );
  const [format, setFormat] = useState<"glb" | "stl" | "obj" | "fbx" | "usdz">("glb");

  const selectMenuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const aiDrawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (selectMenuRef.current && !selectMenuRef.current.contains(target)) {
        setIsSelectMenuOpen(false);
      }
      if (addMenuRef.current && !addMenuRef.current.contains(target)) {
        setIsAddMenuOpen(false);
      }
      if (aiDrawerRef.current && !aiDrawerRef.current.contains(target)) {
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
    onExecuteTool?.(selectedTool, { prompt: prompt.trim(), format });
    setIsAiDrawerOpen(false);
  };

  const handleSelectTool = (mode: TransformMode) => {
    setActiveTool(mode);
    onSetTransformMode(mode);
  };

  const PRESETS = [
    { label: "Turbine Flange", tool: "cad_model", prompt: "A precision mechanical turbine base flange with central bore, 8 metric bolt holes, and chamfered bevels" },
    { label: "Bevel Gear", tool: "cad_model", prompt: "A high-torque 24-tooth mechanical bevel gear with keyed center shaft and precision involute teeth" },
    { label: "Sci-Fi Crate", tool: "cad_model", prompt: "A futuristic sci-fi cargo container crate with reinforced corner brackets, locking latch, and metallic panel details" },
    { label: "Drone Chassis", tool: "cad_model", prompt: "A lightweight quadcopter drone frame with central avionics bay, 4 motor arms, and landing skids" },
  ];

  return (
    <div className="absolute top-2 left-2 z-20 flex pointer-events-auto select-none font-mono">
      {/* 40px Single-Column Iconic CAD Modeling Toolbar */}
      <div className="w-10 bg-[#141416] border border-[#27272a] shadow-2xl rounded flex flex-col items-center py-1.5 space-y-1">
        {/* 1. Selection Tool Group (Box, Circle, Lasso, Tweak) [W / B / C] */}
        <div ref={selectMenuRef} className="relative">
          <button
            type="button"
            onClick={() => {
              if (transformMode === "select") {
                setIsSelectMenuOpen((p) => !p);
              } else {
                handleSelectTool("select");
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setIsSelectMenuOpen(true);
            }}
            title={`Select Tool: ${
              selectionTool === "box"
                ? "Select Box [B / W]"
                : selectionTool === "circle"
                ? "Select Circle [C]"
                : selectionTool === "lasso"
                ? "Select Lasso [W]"
                : "Tweak (Click Select) [W]"
            } (Click or right-click to switch)`}
            className={`w-7 h-7 rounded relative flex items-center justify-center transition-colors ${
              transformMode === "select" || activeTool === "select"
                ? "bg-[#ea580c] text-white"
                : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#202024]"
            }`}
          >
            {selectionTool === "box" ? (
              <Square className="w-3.5 h-3.5" />
            ) : selectionTool === "circle" ? (
              <Circle className="w-3.5 h-3.5" />
            ) : selectionTool === "lasso" ? (
              <Compass className="w-3.5 h-3.5" />
            ) : (
              <MousePointer className="w-3.5 h-3.5" />
            )}
            <span className="absolute bottom-0.5 right-0.5 w-1 h-1 bg-current opacity-70 rounded-full" />
          </button>

          {/* Selection Tool Flyout Menu */}
          {isSelectMenuOpen && (
            <div className="absolute left-9 top-0 w-44 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded p-1 z-50 text-[10px] space-y-0.5">
              <div className="text-[9px] uppercase font-bold text-[#71717a] px-2 py-0.5 border-b border-[#27272a]">
                Selection Mode
              </div>
              {[
                { id: "box" as const, label: "Select Box", hotkey: "B / W", icon: <Square className="w-3.5 h-3.5" /> },
                { id: "circle" as const, label: "Select Circle", hotkey: "C", icon: <Circle className="w-3.5 h-3.5" /> },
                { id: "lasso" as const, label: "Select Lasso", hotkey: "W", icon: <Compass className="w-3.5 h-3.5" /> },
                { id: "tweak" as const, label: "Tweak (Click)", hotkey: "W", icon: <MousePointer className="w-3.5 h-3.5" /> },
              ].map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    onSetSelectionTool?.(tool.id);
                    handleSelectTool("select");
                    setIsSelectMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded transition-colors ${
                    selectionTool === tool.id
                      ? "bg-[#ea580c] text-white font-bold"
                      : "text-[#a1a1aa] hover:bg-[#202024] hover:text-[#f4f4f5]"
                  }`}
                >
                  <span className="flex items-center space-x-1.5">
                    {tool.icon}
                    <span>{tool.label}</span>
                  </span>
                  <span className="text-[9px] opacity-60 font-mono">{tool.hotkey}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. 3D Cursor Placement (Shift + Space) */}
        <button
          type="button"
          onClick={() => handleSelectTool("cursor")}
          title="3D Cursor Placement [Shift + Space]"
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            activeTool === "cursor"
              ? "bg-[#ea580c] text-white"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#202024]"
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
        </button>

        {/* 3. Move / Translate Gizmo (G) */}
        <button
          type="button"
          onClick={() => handleSelectTool("translate")}
          title="Move / Translate Gizmo [G]"
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            transformMode === "translate"
              ? "bg-[#ea580c] text-white"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#202024]"
          }`}
        >
          <Move className="w-3.5 h-3.5" />
        </button>

        {/* 4. Rotate Gizmo (R) */}
        <button
          type="button"
          onClick={() => handleSelectTool("rotate")}
          title="Rotate Gizmo [R]"
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            transformMode === "rotate"
              ? "bg-[#ea580c] text-white"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#202024]"
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        {/* 5. Scale Gizmo (S) */}
        <button
          type="button"
          onClick={() => handleSelectTool("scale")}
          title="Scale Gizmo [S]"
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            transformMode === "scale"
              ? "bg-[#ea580c] text-white"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#202024]"
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
        </button>

        {/* 6. Universal Transform Gizmo (Q) */}
        <button
          type="button"
          onClick={() => handleSelectTool("all")}
          title="Universal Transform (Move, Rotate, Scale) [Q]"
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            transformMode === "all"
              ? "bg-[#ea580c] text-white"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#202024]"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>

        <div className="w-6 h-px bg-[#27272a] my-0.5" />

        {/* 7. Extrude Face (E) */}
        <button
          type="button"
          onClick={() => handleSelectTool("extrude")}
          title="Extrude Face [E]"
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            activeTool === "extrude"
              ? "bg-[#ea580c] text-white"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#202024]"
          }`}
        >
          <SquareChevronUp className="w-3.5 h-3.5" />
        </button>

        {/* 8. Inset Face (I) */}
        <button
          type="button"
          onClick={() => handleSelectTool("inset")}
          title="Inset Face [I]"
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            activeTool === "inset"
              ? "bg-[#ea580c] text-white"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#202024]"
          }`}
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>

        {/* 9. Bevel Edge (Ctrl + B) */}
        <button
          type="button"
          onClick={() => handleSelectTool("bevel")}
          title="Bevel Edge [Ctrl + B]"
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            activeTool === "bevel"
              ? "bg-[#ea580c] text-white"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#202024]"
          }`}
        >
          <CornerDownRight className="w-3.5 h-3.5" />
        </button>

        {/* 10. Loop Cut (Ctrl + R) */}
        <button
          type="button"
          onClick={() => handleSelectTool("loopcut")}
          title="Loop Cut & Slide [Ctrl + R]"
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            activeTool === "loopcut"
              ? "bg-[#ea580c] text-white"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#202024]"
          }`}
        >
          <Columns className="w-3.5 h-3.5" />
        </button>

        <div className="w-6 h-px bg-[#27272a] my-0.5" />

        {/* Quick Add Mesh Primitive (Shift + A) */}
        <div ref={addMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
            title="Add Mesh Primitive [Shift + A]"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              isAddMenuOpen
                ? "bg-[#ea580c] text-white"
                : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#202024]"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {isAddMenuOpen && (
            <div className="absolute left-9 top-0 w-44 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded p-1 z-50 text-[11px] space-y-0.5">
              <div className="text-[9px] uppercase font-bold text-[#71717a] px-2 py-0.5 border-b border-[#27272a]">
                Mesh Primitives
              </div>
              {[
                { type: "cube", label: "Cube", icon: <Box className="w-3 h-3 text-[#ea580c]" /> },
                { type: "cylinder", label: "Cylinder", icon: <Layers className="w-3 h-3 text-emerald-400" /> },
                { type: "uv_sphere", label: "UV Sphere", icon: <Circle className="w-3 h-3 text-sky-400" /> },
                { type: "cone", label: "Cone", icon: <Compass className="w-3 h-3 text-amber-400" /> },
                { type: "torus", label: "Torus", icon: <Circle className="w-3 h-3 text-pink-400" /> },
                { type: "plane", label: "Plane", icon: <Square className="w-3 h-3 text-blue-400" /> },
              ].map((p) => (
                <button
                  key={p.type}
                  type="button"
                  onClick={() => {
                    onAddPrimitive(p.type);
                    setIsAddMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2 px-2 py-1 rounded-xs text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5] transition-colors"
                >
                  {p.icon}
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Generative CAD Studio Drawer Trigger */}
        <button
          id="mcp-ai-trigger-btn"
          type="button"
          onClick={() => setIsAiDrawerOpen(!isAiDrawerOpen)}
          title="Generative CAD Studio [Ctrl + Space]"
          className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
            isAiDrawerOpen || isLoading
              ? "bg-[#ea580c] text-white animate-pulse"
              : "text-[#ea580c] hover:bg-[#ea580c]/20"
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Wand2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Floating MCP AI Generator Flyout Drawer (310px width) */}
      {isAiDrawerOpen && (
        <div
          ref={aiDrawerRef}
          className="ml-2 w-[310px] bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded p-3 z-50 text-xs font-mono space-y-2.5 animate-in fade-in slide-in-from-left-2 duration-150"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-[#27272a]">
            <span className="font-bold text-[#f4f4f5] flex items-center text-[11px]">
              <Sparkles className="w-3.5 h-3.5 mr-1 text-[#ea580c]" />
              GENERATIVE CAD STUDIO
            </span>
            <button
              type="button"
              onClick={() => setIsAiDrawerOpen(false)}
              className="text-[#71717a] hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Prompt Textarea */}
          <div>
            <label className="text-[10px] text-[#71717a] uppercase block mb-1">
              CAD Model Description
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe CAD geometry, features, dimensions..."
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
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Presets */}
          <div className="pt-1 border-t border-[#27272a]">
            <div className="text-[9px] uppercase text-[#71717a] mb-1">Quick Presets</div>
            <div className="grid grid-cols-2 gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setPrompt(p.prompt);
                    onExecuteTool?.(p.tool, { prompt: p.prompt, format });
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
