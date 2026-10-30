"use client";

import React, { useState } from "react";
import {
  Crosshair,
  X,
  Sliders,
  Palette,
  Layers,
  Sparkles,
  Plus,
  Maximize2,
} from "lucide-react";

export interface SwatchPreset {
  name: string;
  color: string;
  roughness: number;
  metalness: number;
  emissive?: string;
  bgClass: string;
}

export const SWATCH_PRESETS: SwatchPreset[] = [
  {
    name: "Clay",
    color: "#d97706",
    roughness: 0.75,
    metalness: 0.05,
    bgClass: "bg-amber-600",
  },
  {
    name: "Metallic Steel",
    color: "#94a3b8",
    roughness: 0.2,
    metalness: 0.95,
    bgClass: "bg-slate-400",
  },
  {
    name: "Matte Charcoal",
    color: "#27272a",
    roughness: 0.85,
    metalness: 0.2,
    bgClass: "bg-zinc-800 border-zinc-600",
  },
  {
    name: "Machined Brass",
    color: "#eab308",
    roughness: 0.25,
    metalness: 0.9,
    bgClass: "bg-yellow-500",
  },
  {
    name: "Emissive Cyan",
    color: "#06b6d4",
    roughness: 0.3,
    metalness: 0.5,
    emissive: "#06b6d4",
    bgClass: "bg-cyan-500 shadow-sm shadow-cyan-500/50",
  },
];

export interface FloatingInspectorProps {
  selectedMeshName: string | null;
  triangles: number;
  onClose: () => void;
  onFocus: () => void;
  onApplySwatch: (swatch: SwatchPreset) => void;
  onUpdateMaterial: (roughness: number, metalness: number, color?: string) => void;
  currentRoughness: number;
  currentMetalness: number;
  currentColor: string;
  onSubdivide: () => void;
  onAddKeyframe: () => void;
  onPlaceOnFloor?: () => void;
  onCenterOrigin?: () => void;
  onResetRotation?: () => void;
  onResetScale?: () => void;
}

export function FloatingInspector({
  selectedMeshName,
  triangles,
  onClose,
  onFocus,
  onApplySwatch,
  onUpdateMaterial,
  currentRoughness,
  currentMetalness,
  currentColor,
  onSubdivide,
  onAddKeyframe,
  onPlaceOnFloor,
  onCenterOrigin,
  onResetRotation,
  onResetScale,
}: FloatingInspectorProps) {
  const [roughness, setRoughness] = useState(currentRoughness);
  const [metalness, setMetalness] = useState(currentMetalness);

  React.useEffect(() => {
    setRoughness(currentRoughness);
    setMetalness(currentMetalness);
  }, [currentRoughness, currentMetalness]);

  if (!selectedMeshName) return null;

  return (
    <div className="absolute top-14 right-4 z-20 w-64 bg-[#18181b]/95 border border-[#3f3f46] rounded-sm shadow-2xl p-2.5 font-sans text-xs text-[#f4f4f5] select-none backdrop-blur-none space-y-2.5 transition-all animate-in fade-in zoom-in-95 duration-100">
      {/* HUD Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#27272a]">
        <div className="flex items-center space-x-1.5 truncate">
          <Layers className="w-3.5 h-3.5 text-[#ea580c] shrink-0" />
          <span className="font-mono font-bold text-[11px] truncate text-[#f4f4f5]">
            {selectedMeshName}
          </span>
          <span className="text-[9px] font-mono text-[#71717a] shrink-0">
            {triangles.toLocaleString()}t
          </span>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <button
            type="button"
            onClick={onFocus}
            title="Focus camera on part (Hotkey: F)"
            className="p-1 hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] rounded-sm transition-colors"
          >
            <Crosshair className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Deselect part (Esc / Alt+A)"
            className="p-1 hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#ef4444] rounded-sm transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 1-Click Quick Palette Swatches */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-[#71717a] font-mono uppercase">
          <span className="flex items-center space-x-1">
            <Palette className="w-2.5 h-2.5" />
            <span>Palette Swatches</span>
          </span>
          <span className="text-[8px] text-[#52525b]">1-Click Paint</span>
        </div>

        <div className="flex items-center justify-between px-1 py-1 bg-[#1f1f23] border border-[#27272a] rounded-sm">
          {SWATCH_PRESETS.map((swatch) => (
            <button
              key={swatch.name}
              type="button"
              onClick={() => onApplySwatch(swatch)}
              title={`${swatch.name} (Rough: ${swatch.roughness}, Metal: ${swatch.metalness})`}
              className={`w-6 h-6 rounded-full border border-white/20 hover:scale-110 active:scale-95 transition-transform ${swatch.bgClass}`}
            />
          ))}
        </div>
      </div>

      {/* Roughness & Metalness Mini-Sliders */}
      <div className="space-y-1.5 pt-0.5">
        {/* Roughness */}
        <div className="space-y-0.5">
          <div className="flex justify-between text-[10px] font-mono text-[#a1a1aa]">
            <span>ROUGHNESS</span>
            <span className="text-[#f4f4f5]">{(roughness * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={roughness}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setRoughness(val);
              onUpdateMaterial(val, metalness);
            }}
            className="w-full accent-[#ea580c] cursor-pointer h-1.5 bg-[#27272a] rounded-sm"
          />
        </div>

        {/* Metalness */}
        <div className="space-y-0.5">
          <div className="flex justify-between text-[10px] font-mono text-[#a1a1aa]">
            <span>METALLIC</span>
            <span className="text-[#f4f4f5]">{(metalness * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={metalness}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setMetalness(val);
              onUpdateMaterial(roughness, val);
            }}
            className="w-full accent-[#ea580c] cursor-pointer h-1.5 bg-[#27272a] rounded-sm"
          />
        </div>
      </div>

      {/* Action Buttons: [+1 Subdiv] and [+ Keyframe (I)] */}
      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#27272a]">
        <button
          type="button"
          onClick={onSubdivide}
          title="Smooth & increase geometry resolution by midpoint subdivision"
          className="py-1 px-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] border border-[#3f3f46] rounded-sm font-mono text-[10px] flex items-center justify-center space-x-1 transition-colors"
        >
          <Sparkles className="w-3 h-3 text-[#ea580c]" />
          <span>+1 Subdiv</span>
        </button>

        <button
          type="button"
          onClick={onAddKeyframe}
          title="Record sub-mesh pose & material at current frame (Hotkey: I)"
          className="py-1 px-1.5 bg-[#ea580c] hover:bg-[#f97316] text-white rounded-sm font-mono text-[10px] font-semibold flex items-center justify-center space-x-1 transition-colors shadow-sm"
        >
          <Plus className="w-3 h-3" />
          <span>+ Keyframe (I)</span>
        </button>
      </div>

      {/* 1-Click Transform Reset Panel */}
      <div className="space-y-1 pt-1 border-t border-[#27272a]">
        <div className="text-[10px] text-[#71717a] font-mono uppercase flex items-center justify-between">
          <span>Transform Reset</span>
          <span className="text-[8px] text-[#52525b]">Quick Align</span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
          <button
            type="button"
            onClick={onPlaceOnFloor}
            title="Snap minimum bounding box to floor grid (Y=0)"
            className="py-1 px-1 bg-[#202024] hover:bg-[#2e2e34] border border-[#333338] rounded-xs text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
          >
            Drop to Floor
          </button>
          <button
            type="button"
            onClick={onCenterOrigin}
            title="Move object to X:0, Z:0 center"
            className="py-1 px-1 bg-[#202024] hover:bg-[#2e2e34] border border-[#333338] rounded-xs text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
          >
            Center Origin
          </button>
          <button
            type="button"
            onClick={onResetRotation}
            title="Clear all rotation angles back to 0°"
            className="py-1 px-1 bg-[#202024] hover:bg-[#2e2e34] border border-[#333338] rounded-xs text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
          >
            Reset Rotation
          </button>
          <button
            type="button"
            onClick={onResetScale}
            title="Reset scale to uniform 1.0x"
            className="py-1 px-1 bg-[#202024] hover:bg-[#2e2e34] border border-[#333338] rounded-xs text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
          >
            Reset Scale
          </button>
        </div>
      </div>
    </div>
  );
}
