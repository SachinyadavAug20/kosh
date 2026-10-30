"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Grid,
  Sun,
  Camera,
  Layers,
  ChevronUp,
  ChevronDown,
  Sliders,
  Check,
  Maximize2,
} from "lucide-react";

export type LightingStage = "flat" | "studio" | "rim" | "daylight";

export interface DccQuickTrayProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  // Topology Simplifier
  simplifyRatio: number;
  onSimplifyRatioChange: (ratio: number) => void;
  // Auto-UV Checkerboard
  isUvCheckerActive: boolean;
  onToggleUvChecker: () => void;
  // Lighting Staging
  currentLightingStage: LightingStage;
  onSelectLightingStage: (stage: LightingStage) => void;
  // Snapshot
  onCaptureSnapshot: (transparentBg: boolean) => void;
  // Dimensions Hotkey toggle
  showDimensions: boolean;
  onToggleDimensions: () => void;
}

export function DccQuickTray({
  isOpen,
  onToggleOpen,
  simplifyRatio,
  onSimplifyRatioChange,
  isUvCheckerActive,
  onToggleUvChecker,
  currentLightingStage,
  onSelectLightingStage,
  onCaptureSnapshot,
  showDimensions,
  onToggleDimensions,
}: DccQuickTrayProps) {
  const [transparentAlpha, setTransparentAlpha] = useState(true);

  return (
    <div className="border-t border-[#3f3f46] bg-[#141416] text-xs font-sans select-none z-20">
      {/* Tray Header Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#1f1f23] border-b border-[#27272a]">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onToggleOpen}
            className="flex items-center space-x-1.5 text-[10px] font-mono text-[#f4f4f5] hover:text-[#ea580c] transition-colors"
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            <span className="font-semibold uppercase tracking-wider">1-Click DCC Quick Tools Tray</span>
          </button>
        </div>

        {/* Quick Toggles in Header */}
        <div className="flex items-center space-x-2">
          {/* Dimensions Overlay Toggle (D) */}
          <button
            type="button"
            onClick={onToggleDimensions}
            title="Toggle 2D Dimension Callouts (Hotkey: D)"
            className={`px-2 py-0.5 rounded-sm font-mono text-[10px] border flex items-center space-x-1 transition-colors ${
              showDimensions
                ? "bg-[#ea580c] border-[#f97316] text-white font-semibold"
                : "bg-[#27272a] border-[#3f3f46] text-[#a1a1aa] hover:text-[#f4f4f5]"
            }`}
          >
            <Sliders className="w-2.5 h-2.5" />
            <span>Dims (D)</span>
          </button>

          {/* Quick UV Checker */}
          <button
            type="button"
            onClick={onToggleUvChecker}
            title="Toggle UV Checkerboard Test Pattern"
            className={`px-2 py-0.5 rounded-sm font-mono text-[10px] border flex items-center space-x-1 transition-colors ${
              isUvCheckerActive
                ? "bg-[#38bdf8] border-[#0284c7] text-[#0f172a] font-bold"
                : "bg-[#27272a] border-[#3f3f46] text-[#a1a1aa] hover:text-[#f4f4f5]"
            }`}
          >
            <Grid className="w-2.5 h-2.5" />
            <span>UV Grid</span>
          </button>
        </div>
      </div>

      {/* Expanded Tools Tray Drawer */}
      {isOpen && (
        <div className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3 bg-[#18181b]">
          {/* 1. Topology Simplifier */}
          <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="flex items-center space-x-1 text-[#a1a1aa]">
                <Sparkles className="w-3 h-3 text-[#ea580c]" />
                <span className="uppercase font-semibold">Topology Decimate</span>
              </span>
              <span className="text-[#f4f4f5]">{(simplifyRatio * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={simplifyRatio}
              onChange={(e) => onSimplifyRatioChange(parseFloat(e.target.value))}
              className="w-full accent-[#ea580c] cursor-pointer h-1.5 bg-[#27272a] rounded-sm"
            />
            <p className="text-[9px] text-[#71717a] font-mono leading-tight">
              Decimates polygon count while preserving sharp boundary silhouettes.
            </p>
          </div>

          {/* 2. Auto-UV Checker Pattern */}
          <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="flex items-center space-x-1 text-[#a1a1aa]">
                <Grid className="w-3 h-3 text-[#38bdf8]" />
                <span className="uppercase font-semibold">Auto-UV Checker</span>
              </span>
              <span className={isUvCheckerActive ? "text-[#38bdf8] font-bold" : "text-[#71717a]"}>
                {isUvCheckerActive ? "ACTIVE" : "OFF"}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleUvChecker}
              className={`w-full py-1 text-[10px] font-mono font-semibold rounded-sm border transition-colors flex items-center justify-center space-x-1.5 ${
                isUvCheckerActive
                  ? "bg-[#38bdf8] hover:bg-[#0284c7] text-[#0f172a] border-[#38bdf8]"
                  : "bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] border-[#3f3f46]"
              }`}
            >
              {isUvCheckerActive ? <Check className="w-3 h-3" /> : <Grid className="w-3 h-3" />}
              <span>{isUvCheckerActive ? "Restore PBR Shaders" : "Apply UV Checkerboard"}</span>
            </button>
            <p className="text-[9px] text-[#71717a] font-mono leading-tight">
              Inspects UV stretching, texel distribution, and seam distortion.
            </p>
          </div>

          {/* 3. Lighting Staging Switcher */}
          <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1.5">
            <div className="flex items-center space-x-1 text-[10px] font-mono text-[#a1a1aa]">
              <Sun className="w-3 h-3 text-[#eab308]" />
              <span className="uppercase font-semibold">Lighting Rig Staging</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  { id: "flat", label: "Flat Modeling" },
                  { id: "studio", label: "Studio 3-Point" },
                  { id: "rim", label: "Rim Silhouette" },
                  { id: "daylight", label: "Ambient Daylight" },
                ] as const
              ).map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => onSelectLightingStage(stage.id)}
                  className={`py-1 px-1.5 text-[9px] font-mono rounded-sm text-center border truncate transition-colors ${
                    currentLightingStage === stage.id
                      ? "bg-[#27272a] border-[#eab308] text-[#f4f4f5] font-bold"
                      : "bg-[#18181b] border-[#3f3f46] text-[#a1a1aa] hover:bg-[#27272a]"
                  }`}
                >
                  {stage.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Render Snapshot Engine */}
          <div className="p-2 bg-[#1f1f23] border border-[#3f3f46] rounded-sm space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="flex items-center space-x-1 text-[#a1a1aa]">
                <Camera className="w-3 h-3 text-[#ea580c]" />
                <span className="uppercase font-semibold">Render Snapshot</span>
              </span>
              <label className="flex items-center space-x-1 cursor-pointer text-[9px] text-[#a1a1aa]">
                <input
                  type="checkbox"
                  checked={transparentAlpha}
                  onChange={(e) => setTransparentAlpha(e.target.checked)}
                  className="rounded-sm accent-[#ea580c] w-3 h-3"
                />
                <span>Alpha</span>
              </label>
            </div>
            <button
              type="button"
              onClick={() => onCaptureSnapshot(transparentAlpha)}
              className="w-full py-1 bg-[#ea580c] hover:bg-[#f97316] text-white font-mono text-[10px] font-semibold rounded-sm flex items-center justify-center space-x-1.5 shadow-sm transition-colors"
            >
              <Camera className="w-3 h-3" />
              <span>Capture Hi-Res PNG</span>
            </button>
            <p className="text-[9px] text-[#71717a] font-mono leading-tight">
              Exports a crisp viewport render with optional transparent alpha channel.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
