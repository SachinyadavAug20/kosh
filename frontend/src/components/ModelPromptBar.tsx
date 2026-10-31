"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Key,
  Box,
  ChevronDown,
  Loader2,
  Wand2,
  CheckCircle2,
} from "lucide-react";
import { ExportFormat } from "@/types/mcp";

export interface ModelPromptBarProps {
  onGenerate: (prompt: string, format: ExportFormat) => void;
  isLoading?: boolean;
  token?: string;
  onOpenKeyModal: () => void;
  activeStep?: string;
  generationMode?: "ai" | "procedural";
  onToggleGenerationMode?: (mode: "ai" | "procedural") => void;
}

export const PRESET_CAD_CHIPS = [
  { label: "Cat", prompt: "A low-poly cat with head, pointy ears, whiskers, feline body, four paws, and an arched tail" },
  { label: "Car", prompt: "A sleek aerodynamic sports car with low-profile chassis, tinted glass cabin, headlights, and rear spoiler" },
  { label: "Airplane", prompt: "A modern commercial jet airliner with tapered fuselage, swept wings, dual turbofan engines, and vertical tail fin" },
  { label: "Boat", prompt: "A coastal motorboat with hydrodynamic hull, teak deck, steering bridge cabin, and radar mast" },
  { label: "Laptop", prompt: "An ultra-thin aluminum unibody laptop with keyboard, trackpad, and open glowing OLED display" },
  { label: "Tree", prompt: "A lush low-poly pine tree with organic timber trunk and 3 tiers of multifaceted evergreen foliage" },
  { label: "House", prompt: "A cozy suburban home with concrete foundation, walls, gabled roof, front door, and windows" },
  { label: "Table", prompt: "A modern minimalist dining table with thick wood top and 4 sturdy frame legs" },
  { label: "Chair", prompt: "An ergonomic dining chair with cushioned seat pad, lumbar backrest, and 4 tapered legs" },
  { label: "Robot", prompt: "A humanoid service robot with articulated metal body, sensor head, arms, and legs" },
  { label: "Rocket", prompt: "A heavy-lift orbital rocket with aerodynamic nose cone, booster fins, and command window" },
  { label: "Castle", prompt: "A medieval stone castle keep with defensive battlements, 4 corner turrets, and arched gate" },
  { label: "Tank", prompt: "An armored combat tank with track treads, rotating turret, and long-range cannon barrel" },
  { label: "Pyramid", prompt: "An ancient monumental stone pyramid with tiered base and gleaming polished gold capstone" },
  { label: "Turbine Flange", prompt: "A precision mechanical turbine base flange with central bore, 8 metric bolt holes, and chamfered bevels" },
  { label: "Bevel Gear", prompt: "A high-torque 24-tooth mechanical bevel gear with keyed center shaft and precision involute teeth" },
  { label: "Sci-Fi Crate", prompt: "A futuristic sci-fi cargo container crate with reinforced corner brackets, locking latch, and metallic panel details" },
  { label: "Battleaxe", prompt: "A medieval iron battleaxe with double-beveled crescent blades, reinforced central spine, and carved wooden haft" },
  { label: "Hover Drone", prompt: "A compact aerodynamic surveillance drone with 4 ducted rotor nacelles, gimbal sensor array, and landing skids" },
  { label: "Coffee Mug", prompt: "A ceramic coffee mug with smooth curved handle, rounded lip, and glossy ceramic finish" },
  { label: "Cow", prompt: "A low-poly cow with brown body, dark spots, head and four legs" },
  { label: "Sheep", prompt: "A fluffy white sheep with woolly body, dark face and four legs" },
];

const SYNTHESIS_STEPS = ["Generating geometry..."];

export function ModelPromptBar({
  onGenerate,
  isLoading = false,
  token = "",
  onOpenKeyModal,
  activeStep,
  generationMode = "ai",
  onToggleGenerationMode,
}: ModelPromptBarProps) {
  const [prompt, setPrompt] = useState<string>("");
  const [format, setFormat] = useState<ExportFormat>("glb");
  const [isFormatOpen, setIsFormatOpen] = useState<boolean>(false);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onGenerate(prompt.trim(), format);
  };

  const handleSelectChip = (chipPrompt: string) => {
    if (isLoading) return;
    setPrompt(chipPrompt);
    onGenerate(chipPrompt, format);
  };

  const isKeyConfigured = !!token && token.trim() !== "";
  const isDemoKey = token === "demo";

  return (
    <div className="absolute bottom-9 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-3 pointer-events-auto select-none font-mono">
      {/* Active Synthesis Step Pill (Shows when loading) */}
      {isLoading && (
        <div className="mb-1.5 flex items-center justify-center">
          <div className="flex items-center space-x-2 px-3 py-1 bg-[#141416] border border-[#ea580c] text-white text-[10px] rounded shadow-2xl animate-pulse">
            <Loader2 className="w-3 h-3 text-[#ea580c] animate-spin" />
            <span className="font-bold text-[#ea580c]">
              {activeStep || SYNTHESIS_STEPS[0]}
            </span>
          </div>
        </div>
      )}

      {/* Main Solid Floating Command Pill */}
      <div className="bg-[#141416] border border-[#27272a] shadow-2xl rounded p-1.5 space-y-1.5">
        {/* Mode Selector & Status Header */}
        <div className="flex items-center justify-between px-1 pb-1 border-b border-[#202024] text-[10px]">
          <div className="flex items-center space-x-1">
            <span className="text-[#71717a] uppercase tracking-wider text-[9px] mr-1">Mode:</span>
            <button
              type="button"
              onClick={() => onToggleGenerationMode?.("ai")}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                generationMode === "ai"
                  ? "bg-emerald-950/70 border border-emerald-500/80 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                  : "bg-[#202024] border border-[#27272a] text-[#71717a] hover:text-[#a1a1aa]"
              }`}
            >
              <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
              <span>AI Generate</span>
              <span className="text-[8px] opacity-75">(Gemini)</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleGenerationMode?.("procedural")}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                generationMode === "procedural"
                  ? "bg-[#ea580c]/20 border border-[#ea580c] text-[#ea580c] shadow-[0_0_10px_rgba(234,88,12,0.2)]"
                  : "bg-[#202024] border border-[#27272a] text-[#71717a] hover:text-[#a1a1aa]"
              }`}
            >
              <Box className="w-2.5 h-2.5 text-[#ea580c]" />
              <span>Procedural</span>
              <span className="text-[8px] opacity-75">(Instant)</span>
            </button>
          </div>

          <div className="flex items-center space-x-1.5">
            {generationMode === "ai" ? (
              isKeyConfigured ? (
                <div className="flex items-center space-x-1 text-emerald-400 text-[9px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Gemini Ready</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenKeyModal}
                  className="flex items-center space-x-1 text-[#ea580c] hover:underline text-[9px]"
                >
                  <Key className="w-2.5 h-2.5" />
                  <span>Enter Gemini Key</span>
                </button>
              )
            ) : (
              <span className="text-[9px] text-[#71717a]">Client Parametric</span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center space-x-1.5">
          {/* Mode Icon Mark */}
          <div className={`pl-1.5 shrink-0 ${generationMode === "ai" ? "text-emerald-400" : "text-[#ea580c]"}`}>
            {generationMode === "ai" ? <Sparkles className="w-4 h-4" /> : <Box className="w-4 h-4" />}
          </div>

          {/* Text Input */}
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              generationMode === "ai"
                ? "Describe any 3D model for Gemini AI to synthesize (e.g., 'Cyberpunk cat with neon collar', 'Sports car')..."
                : "Describe a procedural CAD model (e.g., 'Cat', 'Turbine flange', 'Rocket ship')..."
            }
            disabled={isLoading}
            className="flex-1 bg-transparent px-2 py-1 text-xs text-[#f4f4f5] placeholder-[#52525b] outline-none min-w-0"
          />

          {/* Format Dropdown (.GLB, .OBJ, .STL) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsFormatOpen(!isFormatOpen)}
              className="flex items-center space-x-1 px-1.5 py-1 rounded bg-[#202024] border border-[#27272a] hover:border-[#3f3f46] text-[#a1a1aa] text-[10px] uppercase font-bold transition-colors"
            >
              <span>.{format.toUpperCase()}</span>
              <ChevronDown className="w-2.5 h-2.5 text-[#71717a]" />
            </button>

            {isFormatOpen && (
              <div className="absolute bottom-8 right-0 w-24 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded p-1 z-50 text-[10px] space-y-0.5">
                {(["glb", "blend", "obj", "stl"] as ExportFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => {
                      setFormat(fmt);
                      setIsFormatOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1 rounded uppercase transition-colors ${
                      format === fmt
                        ? generationMode === "ai"
                          ? "bg-emerald-600 text-white font-bold"
                          : "bg-[#ea580c] text-white font-bold"
                        : "text-[#a1a1aa] hover:bg-[#202024] hover:text-white"
                    }`}
                  >
                    .{fmt === "blend" ? "blend" : fmt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className={`flex items-center space-x-1 px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-bold text-[11px] transition-colors shrink-0 shadow-sm ${
              generationMode === "ai"
                ? "bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                : "bg-[#ea580c] hover:bg-[#c2410c] shadow-[0_0_12px_rgba(234,88,12,0.25)]"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Synthesizing...</span>
              </>
            ) : (
              <>
                {generationMode === "ai" ? (
                  <>
                    <Sparkles className="w-3 h-3 text-emerald-200" />
                    <span>AI Generate</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3 h-3" />
                    <span>Build Instant</span>
                  </>
                )}
                <span className="text-[10px] opacity-70">↵</span>
              </>
            )}
          </button>
        </form>

        {/* Quick CAD Preset Chips */}
        <div className="flex items-center space-x-1 overflow-x-auto pt-0.5 no-scrollbar text-[9px]">
          <span className="text-[#52525b] shrink-0 uppercase tracking-wider pl-1">Quick:</span>
          {PRESET_CAD_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => handleSelectChip(chip.prompt)}
              disabled={isLoading}
              className="px-2 py-0.5 rounded bg-[#202024] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors shrink-0 whitespace-nowrap"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
