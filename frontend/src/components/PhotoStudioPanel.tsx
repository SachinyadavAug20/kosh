"use client";

import React, { useRef, useState } from "react";
import {
  Camera,
  Sun,
  Grid as GridIcon,
  Palette,
  UploadCloud,
  Focus,
  Sliders,
  Check,
  X,
  Sparkles,
  Download,
  Image as ImageIcon,
  Minimize2,
  Maximize2,
  Trash2,
  Eye,
  Layers,
  RotateCcw,
} from "lucide-react";
import { FramingMode } from "./narrative/AspectRatioFramer";

export type BackgroundMode = "solid" | "gradient" | "image";
export type GradientTheme =
  | "studio_dark"
  | "cosmic_space"
  | "blueprint_cad"
  | "clean_white"
  | "sunset_warm"
  | "cyber_neon";

export interface LightingRigState {
  keyIntensity: number;
  keyColor: string;
  fillIntensity: number;
  fillColor: string;
  rimIntensity: number;
  rimColor: string;
  headlamp: boolean;
}

export interface StudioGridState {
  visible: boolean;
  colorMajor: string;
  colorMinor: string;
  size: number;
  opacity: number;
}

export interface PhotoStudioPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Grid
  gridState: StudioGridState;
  onUpdateGrid: (update: Partial<StudioGridState>) => void;
  // Background
  bgMode: BackgroundMode;
  onSetBgMode: (mode: BackgroundMode) => void;
  bgColor: string;
  onSetBgColor: (color: string) => void;
  bgGradient: GradientTheme;
  onSetBgGradient: (theme: GradientTheme) => void;
  bgImage: string | null;
  onSetBgImage: (dataUrl: string | null) => void;
  // Lighting
  lightingState: LightingRigState;
  onUpdateLighting: (update: Partial<LightingRigState>) => void;
  onApplyLightingPreset: (preset: "cad_studio" | "high_key" | "dramatic_rim" | "cyber_neon" | "sunset_warm") => void;
  // Camera & Lens
  isCameraView: boolean;
  onToggleCameraView: () => void;
  focalLength: number;
  onSetFocalLength: (mm: number) => void;
  framingAspect: FramingMode;
  onSetFramingAspect: (mode: FramingMode) => void;
  showGuides: boolean;
  onToggleGuides: () => void;
  isOrtho: boolean;
  onToggleOrtho: () => void;
  onFrameSelected: () => void;
  // Snapshot Capture
  transparentExport: boolean;
  onSetTransparentExport: (trans: boolean) => void;
  resolutionScale: number;
  onSetResolutionScale: (scale: number) => void;
  onCaptureSnapshot: () => void;
}

export function PhotoStudioPanel({
  isOpen,
  onClose,
  gridState,
  onUpdateGrid,
  bgMode,
  onSetBgMode,
  bgColor,
  onSetBgColor,
  bgGradient,
  onSetBgGradient,
  bgImage,
  onSetBgImage,
  lightingState,
  onUpdateLighting,
  onApplyLightingPreset,
  isCameraView,
  onToggleCameraView,
  focalLength,
  onSetFocalLength,
  framingAspect,
  onSetFramingAspect,
  showGuides,
  onToggleGuides,
  isOrtho,
  onToggleOrtho,
  onFrameSelected,
  transparentExport,
  onSetTransparentExport,
  resolutionScale,
  onSetResolutionScale,
  onCaptureSnapshot,
}: PhotoStudioPanelProps) {
  const [activeTab, setActiveTab] = useState<"backdrop" | "lighting" | "camera" | "capture">("backdrop");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onSetBgImage(result);
        onSetBgMode("image");
      }
    };
    reader.readAsDataURL(file);
  };

  const solidColors = [
    { label: "CAD Dark", value: "#141416" },
    { label: "Pitch Black", value: "#050505" },
    { label: "Zinc 900", value: "#18181b" },
    { label: "Slate Navy", value: "#0f172a" },
    { label: "Clean White", value: "#f8fafc" },
    { label: "Studio Grey", value: "#334155" },
  ];

  const gradientThemes: { id: GradientTheme; name: string; preview: string }[] = [
    { id: "studio_dark", name: "Studio Dark", preview: "from-[#18181b] to-[#09090b]" },
    { id: "cosmic_space", name: "Cosmic Space", preview: "from-[#030712] via-[#1e1b4b] to-[#0f172a]" },
    { id: "blueprint_cad", name: "Blueprint CAD", preview: "from-[#0f172a] via-[#1e3a8a] to-[#0284c7]" },
    { id: "clean_white", name: "Clean White", preview: "from-[#ffffff] to-[#e2e8f0]" },
    { id: "sunset_warm", name: "Warm Sunset", preview: "from-[#451a03] via-[#78350f] to-[#1c1917]" },
    { id: "cyber_neon", name: "Cyber Neon", preview: "from-[#050505] via-[#0f172a] to-[#0369a1]" },
  ];

  const focalLengths = [
    { mm: 24, label: "24mm Wide", fov: 84 },
    { mm: 35, label: "35mm Standard", fov: 63 },
    { mm: 50, label: "50mm Normal", fov: 46 },
    { mm: 85, label: "85mm Portrait", fov: 28 },
  ];

  const aspectRatios: { id: FramingMode; label: string; desc: string }[] = [
    { id: "full", label: "Free Orbit", desc: "Full canvas view" },
    { id: "1:1", label: "1:1 Square", desc: "Logo / Avatar / Icon" },
    { id: "16:9", label: "16:9 Landscape", desc: "Banner / Web / Video" },
    { id: "9:16", label: "9:16 Portrait", desc: "Mobile / Story / Reel" },
    { id: "4:3", label: "4:3 Classic", desc: "Studio / Product" },
  ];

  return (
    <div className="absolute top-12 right-3 z-40 w-80 md:w-96 rounded-lg bg-[#141416]/95 backdrop-blur-md border border-[#27272a] shadow-2xl font-mono text-xs text-[#f4f4f5] overflow-hidden flex flex-col select-none animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#18181b] border-b border-[#27272a]">
        <div className="flex items-center space-x-2">
          <Camera className="w-4 h-4 text-[#ea580c]" />
          <span className="font-bold tracking-wider text-[11px] uppercase text-[#f4f4f5]">
            Photo Studio & Staging
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[#71717a] hover:text-white p-1 rounded hover:bg-[#27272a] transition-colors"
          title="Close Studio Panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 bg-[#141416] border-b border-[#27272a] text-[10px]">
        <button
          type="button"
          onClick={() => setActiveTab("backdrop")}
          className={`py-2 px-1 text-center font-bold tracking-wide transition-colors ${
            activeTab === "backdrop"
              ? "bg-[#202024] text-[#ea580c] border-b-2 border-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]"
          }`}
        >
          Backdrop
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("lighting")}
          className={`py-2 px-1 text-center font-bold tracking-wide transition-colors ${
            activeTab === "lighting"
              ? "bg-[#202024] text-[#ea580c] border-b-2 border-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]"
          }`}
        >
          Lighting
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("camera")}
          className={`py-2 px-1 text-center font-bold tracking-wide transition-colors ${
            activeTab === "camera"
              ? "bg-[#202024] text-[#ea580c] border-b-2 border-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]"
          }`}
        >
          Camera
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("capture")}
          className={`py-2 px-1 text-center font-bold tracking-wide transition-colors ${
            activeTab === "capture"
              ? "bg-[#202024] text-[#ea580c] border-b-2 border-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]"
          }`}
        >
          Take Photo
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-3.5 space-y-4 max-h-[70vh] overflow-y-auto">
        {/* ========================================================= */}
        {/* TAB 1: BACKDROP & GRID */}
        {/* ========================================================= */}
        {activeTab === "backdrop" && (
          <div className="space-y-4">
            {/* Grid Settings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-[#e4e4e7] uppercase flex items-center gap-1.5">
                  <GridIcon className="w-3.5 h-3.5 text-[#ea580c]" />
                  Ground Grid
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateGrid({ visible: !gridState.visible })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                    gridState.visible
                      ? "bg-[#ea580c]/20 border-[#ea580c] text-[#ea580c]"
                      : "bg-[#202024] border-[#27272a] text-[#71717a]"
                  }`}
                >
                  {gridState.visible ? "ENABLED" : "MUTED"}
                </button>
              </div>

              {gridState.visible && (
                <div className="space-y-2 pt-1 pl-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#a1a1aa]">Grid Opacity:</span>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={gridState.opacity}
                      onChange={(e) => onUpdateGrid({ opacity: parseFloat(e.target.value) })}
                      className="w-32 accent-[#ea580c] h-1.5 bg-[#27272a] rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#a1a1aa]">Subdivision Size:</span>
                    <div className="flex gap-1">
                      {[0.5, 1.0, 2.0].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => onUpdateGrid({ size: sz })}
                          className={`px-2 py-0.5 rounded border text-[10px] ${
                            gridState.size === sz
                              ? "bg-[#ea580c] border-[#ea580c] text-white"
                              : "bg-[#202024] border-[#27272a] text-[#a1a1aa]"
                          }`}
                        >
                          {sz}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#a1a1aa]">Grid Color:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={gridState.colorMajor}
                        onChange={(e) => onUpdateGrid({ colorMajor: e.target.value })}
                        className="w-6 h-6 rounded border border-[#3f3f46] bg-transparent cursor-pointer"
                        title="Major Grid Line Color"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[#27272a] pt-3 space-y-2.5">
              <span className="font-bold text-[11px] text-[#e4e4e7] uppercase flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-[#ea580c]" />
                Space Background Mode
              </span>

              {/* Mode Toggle Buttons */}
              <div className="grid grid-cols-3 gap-1.5">
                {(["solid", "gradient", "image"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onSetBgMode(m)}
                    className={`py-1.5 rounded border text-center font-bold capitalize transition-colors ${
                      bgMode === m
                        ? "bg-[#ea580c] border-[#ea580c] text-white"
                        : "bg-[#202024] border-[#27272a] text-[#a1a1aa] hover:border-[#3f3f46]"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Solid Color Picker */}
              {bgMode === "solid" && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-3 gap-1.5">
                    {solidColors.map((sc) => (
                      <button
                        key={sc.value}
                        type="button"
                        onClick={() => onSetBgColor(sc.value)}
                        className={`flex items-center gap-1.5 p-1.5 rounded border text-[10px] transition-colors ${
                          bgColor.toLowerCase() === sc.value.toLowerCase()
                            ? "border-[#ea580c] bg-[#27272a]"
                            : "border-[#27272a] bg-[#18181b] hover:border-[#3f3f46]"
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded border border-white/20 shrink-0"
                          style={{ backgroundColor: sc.value }}
                        />
                        <span className="truncate">{sc.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-[#a1a1aa]">Custom Color:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[#71717a]">{bgColor}</span>
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => onSetBgColor(e.target.value)}
                        className="w-6 h-6 rounded border border-[#3f3f46] bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Gradient Themes */}
              {bgMode === "gradient" && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {gradientThemes.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => onSetBgGradient(theme.id)}
                      className={`p-2 rounded border text-left flex flex-col gap-1 transition-all ${
                        bgGradient === theme.id
                          ? "border-[#ea580c] bg-[#202024]"
                          : "border-[#27272a] bg-[#18181b] hover:border-[#3f3f46]"
                      }`}
                    >
                      <div className={`w-full h-5 rounded bg-gradient-to-r ${theme.preview} border border-white/10`} />
                      <span className="font-bold text-[10px] truncate">{theme.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Custom Image Upload Backdrop */}
              {bgMode === "image" && (
                <div className="space-y-2 pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {bgImage ? (
                    <div className="relative rounded border border-[#27272a] bg-[#18181b] p-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img
                          src={bgImage}
                          alt="Backdrop"
                          className="w-10 h-10 object-cover rounded border border-[#3f3f46]"
                        />
                        <span className="text-[10px] text-[#a1a1aa] truncate">Custom Backdrop Active</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 rounded bg-[#202024] hover:bg-[#27272a] text-[#f4f4f5] border border-[#3f3f46]"
                          title="Change Image"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetBgImage(null)}
                          className="p-1.5 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/50"
                          title="Remove Image"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 border border-dashed border-[#3f3f46] hover:border-[#ea580c] rounded bg-[#18181b] flex flex-col items-center justify-center gap-1.5 text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors cursor-pointer"
                    >
                      <UploadCloud className="w-5 h-5 text-[#ea580c]" />
                      <span className="font-bold text-[11px]">Upload Backdrop Image</span>
                      <span className="text-[9px] text-[#71717a]">PNG, JPG, WebP supported</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: LIGHTING RIG */}
        {/* ========================================================= */}
        {activeTab === "lighting" && (
          <div className="space-y-4">
            {/* Presets */}
            <div className="space-y-2">
              <span className="font-bold text-[11px] text-[#e4e4e7] uppercase flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-[#ea580c]" />
                Lighting Rig Presets
              </span>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "cad_studio", label: "3-Point Studio CAD" },
                  { id: "high_key", label: "High-Key Product" },
                  { id: "dramatic_rim", label: "Dramatic Rim" },
                  { id: "cyber_neon", label: "Cyber Neon" },
                  { id: "sunset_warm", label: "Warm Sunset" },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onApplyLightingPreset(preset.id as any)}
                    className="p-2 rounded border border-[#27272a] bg-[#18181b] hover:bg-[#202024] hover:border-[#ea580c] text-left text-[10px] font-bold text-[#e4e4e7] transition-all"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Individual Light Sliders */}
            <div className="border-t border-[#27272a] pt-3 space-y-3">
              <span className="font-bold text-[11px] text-[#e4e4e7] uppercase flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#ea580c]" />
                Light Intensity & Color
              </span>

              {/* Key Light */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white font-semibold">Key Light:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#71717a]">{lightingState.keyIntensity.toFixed(1)}x</span>
                    <input
                      type="color"
                      value={lightingState.keyColor}
                      onChange={(e) => onUpdateLighting({ keyColor: e.target.value })}
                      className="w-5 h-5 rounded border border-[#3f3f46] bg-transparent cursor-pointer"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="5.0"
                  step="0.1"
                  value={lightingState.keyIntensity}
                  onChange={(e) => onUpdateLighting({ keyIntensity: parseFloat(e.target.value) })}
                  className="w-full accent-[#ea580c] h-1.5 bg-[#27272a] rounded cursor-pointer"
                />
              </div>

              {/* Fill Light */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white font-semibold">Fill Light:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#71717a]">{lightingState.fillIntensity.toFixed(1)}x</span>
                    <input
                      type="color"
                      value={lightingState.fillColor}
                      onChange={(e) => onUpdateLighting({ fillColor: e.target.value })}
                      className="w-5 h-5 rounded border border-[#3f3f46] bg-transparent cursor-pointer"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="3.0"
                  step="0.1"
                  value={lightingState.fillIntensity}
                  onChange={(e) => onUpdateLighting({ fillIntensity: parseFloat(e.target.value) })}
                  className="w-full accent-[#ea580c] h-1.5 bg-[#27272a] rounded cursor-pointer"
                />
              </div>

              {/* Rim Light */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white font-semibold">Rim Light:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#71717a]">{lightingState.rimIntensity.toFixed(1)}x</span>
                    <input
                      type="color"
                      value={lightingState.rimColor}
                      onChange={(e) => onUpdateLighting({ rimColor: e.target.value })}
                      className="w-5 h-5 rounded border border-[#3f3f46] bg-transparent cursor-pointer"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="4.0"
                  step="0.1"
                  value={lightingState.rimIntensity}
                  onChange={(e) => onUpdateLighting({ rimIntensity: parseFloat(e.target.value) })}
                  className="w-full accent-[#ea580c] h-1.5 bg-[#27272a] rounded cursor-pointer"
                />
              </div>

              {/* Camera Headlamp */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[#a1a1aa]">Camera Headlamp:</span>
                <button
                  type="button"
                  onClick={() => onUpdateLighting({ headlamp: !lightingState.headlamp })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                    lightingState.headlamp
                      ? "bg-[#ea580c]/20 border-[#ea580c] text-[#ea580c]"
                      : "bg-[#202024] border-[#27272a] text-[#71717a]"
                  }`}
                >
                  {lightingState.headlamp ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: CAMERA & LENS */}
        {/* ========================================================= */}
        {activeTab === "camera" && (
          <div className="space-y-4">
            {/* Camera View Mode */}
            <div className="p-2.5 rounded bg-[#18181b] border border-[#27272a] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[11px] text-[#f4f4f5]">Active Camera View</div>
                  <div className="text-[9px] text-[#71717a]">Shortcut: Numpad 0</div>
                </div>
                <button
                  type="button"
                  onClick={onToggleCameraView}
                  className={`px-3 py-1 rounded text-[11px] font-bold border transition-all ${
                    isCameraView
                      ? "bg-[#ea580c] border-[#ea580c] text-white shadow-lg"
                      : "bg-[#202024] border-[#3f3f46] text-[#a1a1aa] hover:border-[#ea580c]"
                  }`}
                >
                  {isCameraView ? "LOOKING AT SHOT" : "ENTER CAMERA VIEW"}
                </button>
              </div>
            </div>

            {/* Framing Aspect Ratio */}
            <div className="space-y-2">
              <span className="font-bold text-[11px] text-[#e4e4e7] uppercase flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#ea580c]" />
                Framing & Aspect Ratio
              </span>

              <div className="grid grid-cols-2 gap-1.5">
                {aspectRatios.map((ar) => (
                  <button
                    key={ar.id}
                    type="button"
                    onClick={() => {
                      onSetFramingAspect(ar.id);
                      if (!isCameraView && ar.id !== "full") {
                        onToggleCameraView();
                      }
                    }}
                    className={`p-2 rounded border text-left transition-all ${
                      framingAspect === ar.id
                        ? "border-[#ea580c] bg-[#202024] text-white"
                        : "border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:border-[#3f3f46]"
                    }`}
                  >
                    <div className="font-bold text-[10px]">{ar.label}</div>
                    <div className="text-[9px] text-[#71717a]">{ar.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Focal Lengths / Lenses */}
            <div className="space-y-2 border-t border-[#27272a] pt-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-[#e4e4e7] uppercase flex items-center gap-1.5">
                  <Focus className="w-3.5 h-3.5 text-[#ea580c]" />
                  Focal Length / Lens
                </span>
                <button
                  type="button"
                  onClick={onToggleOrtho}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                    isOrtho
                      ? "bg-[#ea580c] border-[#ea580c] text-white"
                      : "bg-[#202024] border-[#27272a] text-[#71717a]"
                  }`}
                >
                  ORTHO
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {focalLengths.map((fl) => (
                  <button
                    key={fl.mm}
                    type="button"
                    onClick={() => onSetFocalLength(fl.mm)}
                    className={`p-2 rounded border text-left transition-all ${
                      focalLength === fl.mm && !isOrtho
                        ? "border-[#ea580c] bg-[#202024] text-white"
                        : "border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:border-[#3f3f46]"
                    }`}
                  >
                    <div className="font-bold text-[10px]">{fl.label}</div>
                    <div className="text-[9px] text-[#71717a]">FOV {fl.fov}°</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Guides Toggle & Frame Selected */}
            <div className="flex items-center justify-between pt-2 border-t border-[#27272a]">
              <button
                type="button"
                onClick={onToggleGuides}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-bold ${
                  showGuides
                    ? "bg-[#202024] border-[#ea580c] text-[#ea580c]"
                    : "bg-[#18181b] border-[#27272a] text-[#71717a]"
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>Rule-of-Thirds Grid</span>
              </button>

              <button
                type="button"
                onClick={onFrameSelected}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#27272a] bg-[#18181b] hover:bg-[#202024] text-[#e4e4e7] text-[10px] font-bold"
                title="Frame Selected (Numpad .)"
              >
                <Focus className="w-3 h-3 text-[#ea580c]" />
                <span>Center Shot</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: RENDER SNAPSHOT / TAKE PHOTO */}
        {/* ========================================================= */}
        {activeTab === "capture" && (
          <div className="space-y-4">
            <div className="p-3 rounded bg-[#18181b] border border-[#27272a] space-y-3">
              <span className="font-bold text-[11px] text-[#e4e4e7] uppercase flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#ea580c]" />
                Render Snapshot Setup
              </span>

              {/* Transparent PNG Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[11px] text-[#f4f4f5]">Transparent PNG Cutout</div>
                  <div className="text-[9px] text-[#71717a]">Removes background for logo/icon use</div>
                </div>
                <button
                  type="button"
                  onClick={() => onSetTransparentExport(!transparentExport)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
                    transparentExport
                      ? "bg-emerald-950/40 border-emerald-500 text-emerald-400"
                      : "bg-[#202024] border-[#27272a] text-[#71717a]"
                  }`}
                >
                  {transparentExport ? "TRANSPARENT" : "SOLID / SCENE"}
                </button>
              </div>

              {/* Resolution Multiplier */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#27272a]">
                <span className="text-[#a1a1aa]">Resolution:</span>
                <div className="flex gap-1">
                  {[1, 2, 4].map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => onSetResolutionScale(scale)}
                      className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                        resolutionScale === scale
                          ? "bg-[#ea580c] border-[#ea580c] text-white"
                          : "bg-[#202024] border-[#27272a] text-[#a1a1aa]"
                      }`}
                    >
                      {scale === 1 ? "1x (HD)" : scale === 2 ? "2x (4K)" : "4x (8K)"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Shutter Capture Button */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={onCaptureSnapshot}
                className="w-full py-3.5 rounded bg-gradient-to-r from-[#ea580c] to-[#f59e0b] hover:from-[#c2410c] hover:to-[#d97706] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-[#ea580c]/20 active:scale-98 cursor-pointer transition-all"
              >
                <Camera className="w-4 h-4 fill-current" />
                <span>Take Photo / Render Snapshot</span>
                <span className="px-1.5 py-0.5 rounded bg-black/30 text-[10px] font-mono">F12</span>
              </button>
              <p className="text-[10px] text-center text-[#71717a]">
                Instant high-resolution PNG download with calibrated studio lighting.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
