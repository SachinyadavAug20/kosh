"use client";

import React, { useState, useRef, useEffect } from "react";
import { BackendHealth } from "@/types/mcp";
import { useTheme, THEMES, ThemeId } from "@/context/ThemeContext";
import {
  Box,
  Component,
  Brush,
  Paintbrush,
  Scale,
  Plus,
  Globe,
  Compass,
  Layers,
  Dot,
  Target,
  Magnet,
  CircleDot,
  Grid,
  Sun,
  Eye,
  Sliders,
  Focus,
  Key,
  Share2,
  Shapes,
  Keyboard,
  PanelLeft,
  PanelRight,
  ChevronDown,
  Flashlight,
  Sparkles,
  RefreshCw,
  Code2,
  Download,
  RotateCcw,
  Trash2,
} from "lucide-react";

export type InteractionMode = "object" | "edit" | "sculpt" | "paint" | "weight";
export type ShadingMode = "solid" | "material" | "wireframe" | "normals";
export type MatcapPreset = "studio" | "clay" | "redwax" | "chrome" | "obsidian" | "pearl" | "check" | "zebra" | "toon";
export type TransformOrientation = "global" | "local" | "normal" | "view";
export type PivotPoint = "median" | "cursor" | "bounding_box" | "individual";
export type SnapElement = "increment" | "vertex" | "edge" | "face" | "volume";

export interface BlenderTopBarProps {
  health: BackendHealth | null;
  isHealthChecking: boolean;
  onRefreshHealth: () => void;
  token: string;
  onSaveToken: (token: string) => void;
  onClearToken: () => void;
  isTOpen: boolean;
  onToggleTPanel: () => void;
  isNOpen: boolean;
  onToggleNPanel: () => void;
  onOpenShortcuts: () => void;
  onOpenPasteBpy: () => void;
  onOpenShare: () => void;
  onOpenShowcase: () => void;
  onOpenKeyModal?: () => void;
  onExport?: (format: "glb" | "stl" | "obj" | "blend") => void;
  selectedCount?: number;
  onClearCanvas?: () => void;

  // Blender DCC Viewport States
  interactionMode: InteractionMode;
  onSetInteractionMode: (mode: InteractionMode) => void;
  shadingMode: ShadingMode;
  onSetShadingMode: (mode: ShadingMode) => void;
  isPostProcessing?: boolean;
  onTogglePostProcessing?: () => void;
  matcap: MatcapPreset;
  onSetMatcap: (m: MatcapPreset) => void;
  isXRay: boolean;
  onToggleXRay: () => void;
  showDimensions: boolean;
  onToggleDimensions: () => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  snapTo: SnapElement;
  onSetSnapTo: (el: SnapElement) => void;
  gridSnapUnit: number;
  onSetGridSnapUnit: (u: number) => void;
  rotationSnapStep: number;
  onSetRotationSnapStep: (s: number) => void;
  isProportionalEditing: boolean;
  onToggleProportionalEditing: () => void;
  transformOrientation: TransformOrientation;
  onSetTransformOrientation: (o: TransformOrientation) => void;
  pivotPoint: PivotPoint;
  onSetPivotPoint: (p: PivotPoint) => void;
  onAddPrimitive: (type: string) => void;
  selectedMeshName: string | null;
  isOrtho: boolean;
  onToggleOrtho: () => void;
  onFocus: () => void;

  // Workspace Presets
  workspacePreset?: "default" | "modeling" | "animation" | "director" | "render" | "scripting";
  onSelectWorkspacePreset?: (preset: "default" | "modeling" | "animation" | "director" | "render" | "scripting") => void;

  // Viewport Overlays HUD
  showGrid?: boolean;
  onToggleGrid?: () => void;
  showAxes?: boolean;
  onToggleAxes?: () => void;
  showCursor?: boolean;
  onToggleCursor?: () => void;
  showWireframeOverlay?: boolean;
  onToggleWireframeOverlay?: () => void;
  showNormals?: boolean;
  onToggleNormals?: () => void;

  // CAD Studio Lighting Rig & Inspection Headlamp
  headlampEnabled?: boolean;
  onToggleHeadlamp?: () => void;
  lightingPreset?: "cad_studio" | "matcap" | "high_contrast";
  onSelectLightingPreset?: (preset: "cad_studio" | "matcap" | "high_contrast") => void;

  // 3D Model Generation Mode
  generationMode?: "ai" | "procedural";
  onToggleGenerationMode?: (mode: "ai" | "procedural") => void;
}

export function BlenderTopBar({
  health,
  isHealthChecking,
  onRefreshHealth,
  token,
  onSaveToken,
  isTOpen,
  onToggleTPanel,
  isNOpen,
  onToggleNPanel,
  onOpenShortcuts,
  onOpenPasteBpy,
  onOpenShare,
  onOpenShowcase,
  headlampEnabled = true,
  onToggleHeadlamp,
  lightingPreset = "cad_studio",
  onSelectLightingPreset,
  interactionMode,
  onSetInteractionMode,
  shadingMode,
  onSetShadingMode,
  isPostProcessing,
  onTogglePostProcessing,
  matcap,
  onSetMatcap,
  isXRay,
  onToggleXRay,
  showDimensions,
  onToggleDimensions,
  snapEnabled,
  onToggleSnap,
  snapTo,
  onSetSnapTo,
  gridSnapUnit,
  onSetGridSnapUnit,
  rotationSnapStep,
  onSetRotationSnapStep,
  isProportionalEditing,
  onToggleProportionalEditing,
  transformOrientation,
  onSetTransformOrientation,
  pivotPoint,
  onSetPivotPoint,
  onAddPrimitive,
  selectedMeshName,
  isOrtho,
  onToggleOrtho,
  onFocus,
  onOpenKeyModal,
  onExport,
  selectedCount,
  onClearCanvas,
  workspacePreset = "default",
  onSelectWorkspacePreset,
  showGrid = true,
  onToggleGrid,
  showAxes = true,
  onToggleAxes,
  showCursor = true,
  onToggleCursor,
  showWireframeOverlay = false,
  onToggleWireframeOverlay,
  showNormals = false,
  onToggleNormals,
  generationMode = "ai",
  onToggleGenerationMode,
}: BlenderTopBarProps) {
  const { theme, setTheme } = useTheme();

  // Dropdown states
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isOverlaysOpen, setIsOverlaysOpen] = useState(false);
  const overlaysRef = useRef<HTMLDivElement>(null);
  const [isOrientationOpen, setIsOrientationOpen] = useState(false);
  const [isPivotOpen, setIsPivotOpen] = useState(false);
  const [isSnapOpen, setIsSnapOpen] = useState(false);
  const [isMatcapOpen, setIsMatcapOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isKeyDrawerOpen, setIsKeyDrawerOpen] = useState(false);
  const [keyInput, setKeyInput] = useState(token);

  const modeMenuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const orientationRef = useRef<HTMLDivElement>(null);
  const pivotRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef<HTMLDivElement>(null);
  const matcapRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (modeMenuRef.current && !modeMenuRef.current.contains(target)) setIsModeOpen(false);
      if (addMenuRef.current && !addMenuRef.current.contains(target)) setIsAddOpen(false);
      if (exportRef.current && !exportRef.current.contains(target)) setIsExportOpen(false);
      if (orientationRef.current && !orientationRef.current.contains(target)) setIsOrientationOpen(false);
      if (pivotRef.current && !pivotRef.current.contains(target)) setIsPivotOpen(false);
      if (snapRef.current && !snapRef.current.contains(target)) setIsSnapOpen(false);
      if (matcapRef.current && !matcapRef.current.contains(target)) setIsMatcapOpen(false);
      if (themeRef.current && !themeRef.current.contains(target)) setIsThemeOpen(false);
      if (overlaysRef.current && !overlaysRef.current.contains(target)) setIsOverlaysOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const getModeIcon = (mode: InteractionMode) => {
    switch (mode) {
      case "object":
        return <Box className="w-4 h-4 text-[#ea580c]" />;
      case "edit":
        return <Component className="w-4 h-4 text-emerald-400" />;
      case "sculpt":
        return <Brush className="w-4 h-4 text-sky-400" />;
      case "paint":
        return <Paintbrush className="w-4 h-4 text-amber-400" />;
      case "weight":
        return <Scale className="w-4 h-4 text-violet-400" />;
    }
  };

  const isBackendUp = health?.status === "UP";

  return (
    <header className="h-[32px] bg-[#141416] border-b border-[#27272a] px-2 flex items-center justify-between select-none z-30 shrink-0 text-xs font-sans">
      {/* LEFT: Logo + T-Shelf Toggle + Mode Switcher + Add Primitives */}
      <div className="flex items-center space-x-1.5">
        {/* Kosh Minimal Isometric Logo SVG Mark */}
        <div className="flex items-center space-x-1.5 pr-1">
          <svg className="w-4 h-4" viewBox="0 0 512 512" fill="none">
            <polygon points="256,76 412,166 256,256 100,166" fill="#2e323b" stroke="#3f434d" strokeWidth="12" />
            <polygon points="100,166 256,256 256,436 100,346" fill="#22252c" stroke="#333740" strokeWidth="12" />
            <polygon points="256,256 412,166 412,346 256,436" fill="#1b1d22" stroke="#272a32" strokeWidth="12" />
            <polygon points="256,186 316,221 256,256 196,221" fill="#ea580c" />
            <polygon points="196,221 256,256 256,326 196,291" fill="#c2410c" />
            <polygon points="256,256 316,221 316,291 256,326" fill="#9a3412" />
            <circle cx="256" cy="256" r="14" fill="#ffffff" />
          </svg>
          <span className="font-mono font-bold tracking-wider text-[11px] text-[#f4f4f5]">KOSH</span>
        </div>

        {/* T-Shelf (Toolbar) Toggle Button (T) */}
        <button
          type="button"
          onClick={onToggleTPanel}
          title={`Left Toolbar (${isTOpen ? "Close" : "Open"}) [T]`}
          className={`p-1 rounded transition-colors ${
            isTOpen
              ? "bg-[#27272a] text-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
          }`}
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-[#27272a]" />

        {/* Blender Mode Switcher Dropdown (Tab) */}
        <div ref={modeMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsModeOpen(!isModeOpen)}
            title={`Interaction Mode (${interactionMode}) [Tab]`}
            className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#202024] hover:bg-[#27272a] border border-[#333338] transition-colors"
          >
            {getModeIcon(interactionMode)}
            <span className="capitalize text-[10px] font-mono font-semibold text-[#f4f4f5] hidden sm:inline">
              {interactionMode}
            </span>
            <ChevronDown className="w-2.5 h-2.5 text-[#71717a]" />
          </button>

          {isModeOpen && (
            <div className="absolute top-8 left-0 w-36 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded-sm p-1 z-50 space-y-0.5">
              {(["object", "edit", "sculpt", "paint", "weight"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    onSetInteractionMode(m);
                    setIsModeOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-2 py-1 rounded-xs text-[11px] capitalize font-mono text-left transition-colors ${
                    interactionMode === m
                      ? "bg-[#ea580c]/20 text-[#ea580c] font-bold"
                      : "text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]"
                  }`}
                >
                  {getModeIcon(m)}
                  <span>{m} Mode</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add Primitives Menu Button (Shift + A) */}
        <div ref={addMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsAddOpen(!isAddOpen)}
            title="Add Mesh Primitive [Shift + A]"
            className={`p-1 rounded transition-colors ${
              isAddOpen
                ? "bg-[#ea580c] text-white"
                : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {isAddOpen && (
            <div className="absolute top-8 left-0 w-44 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded-sm p-1 z-50 text-[11px] space-y-0.5">
              <div className="text-[9px] font-mono uppercase text-[#71717a] px-2 py-0.5 border-b border-[#27272a]">
                Add Mesh Primitive
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
                    setIsAddOpen(false);
                  }}
                  className="w-full text-left px-2 py-1 font-mono rounded-xs text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5] transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Mesh Name / Multi-Select Chip */}
        <div className="hidden md:flex items-center space-x-1.5 px-2 py-0.5 bg-[#202024] border border-[#27272a] rounded text-[10px] text-[#f4f4f5] font-mono">
          <span className={`w-1.5 h-1.5 rounded-full ${selectedCount && selectedCount > 0 ? "bg-[#ea580c] animate-pulse" : "bg-[#71717a]"}`} />
          <span className="max-w-[140px] truncate">
            {selectedCount && selectedCount > 1
              ? `${selectedCount} Objects Selected`
              : selectedMeshName || "Scene Root"}
          </span>
        </div>
      </div>

      {/* CENTER: Transform Orientation & Pivot Point Selectors */}
      <div className="flex items-center space-x-1">
        {/* Transform Orientation (Global / Local / Normal / View) */}
        <div ref={orientationRef} className="relative">
          <button
            type="button"
            onClick={() => setIsOrientationOpen(!isOrientationOpen)}
            title={`Transform Orientation: ${transformOrientation.toUpperCase()} [,]`}
            className="flex items-center space-x-1 p-1 rounded hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
          >
            {transformOrientation === "global" ? (
              <Globe className="w-4 h-4 text-[#ea580c]" />
            ) : transformOrientation === "local" ? (
              <Compass className="w-4 h-4 text-emerald-400" />
            ) : (
              <Layers className="w-4 h-4 text-sky-400" />
            )}
            <ChevronDown className="w-2.5 h-2.5 text-[#71717a]" />
          </button>

          {isOrientationOpen && (
            <div className="absolute top-9 left-1/2 -translate-x-1/2 w-32 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded-sm p-1 z-50 space-y-0.5">
              {(["global", "local", "normal", "view"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    onSetTransformOrientation(o);
                    setIsOrientationOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1 rounded-xs text-[11px] capitalize font-mono transition-colors ${
                    transformOrientation === o
                      ? "bg-[#ea580c]/20 text-[#ea580c] font-bold"
                      : "text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pivot Point Selector (Median, Cursor, Bounding Box, Individual) */}
        <div ref={pivotRef} className="relative">
          <button
            type="button"
            onClick={() => setIsPivotOpen(!isPivotOpen)}
            title={`Pivot Point: ${pivotPoint.replace("_", " ").toUpperCase()} [.]`}
            className="flex items-center space-x-1 p-1 rounded hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
          >
            {pivotPoint === "median" ? (
              <Target className="w-4 h-4 text-amber-400" />
            ) : pivotPoint === "cursor" ? (
              <Dot className="w-4 h-4 text-[#ea580c]" />
            ) : (
              <CircleDot className="w-4 h-4 text-sky-400" />
            )}
            <ChevronDown className="w-2.5 h-2.5 text-[#71717a]" />
          </button>

          {isPivotOpen && (
            <div className="absolute top-9 left-1/2 -translate-x-1/2 w-36 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded-sm p-1 z-50 space-y-0.5">
              {[
                { id: "median", label: "Median Point" },
                { id: "bounding_box", label: "Bounding Box" },
                { id: "individual", label: "Individual Origins" },
                { id: "cursor", label: "3D Cursor" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSetPivotPoint(p.id as PivotPoint);
                    setIsPivotOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1 rounded-xs text-[11px] font-mono transition-colors ${
                    pivotPoint === p.id
                      ? "bg-[#ea580c]/20 text-[#ea580c] font-bold"
                      : "text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Snapping, Proportional, Shading, Tools, N-Panel Toggle */}
      <div className="flex items-center space-x-1">
        {/* Magnet Snapping Toggle (Shift + Tab) */}
        <div ref={snapRef} className="relative flex items-center">
          <button
            type="button"
            onClick={onToggleSnap}
            title={`Snapping Toggle (${snapEnabled ? "ON" : "OFF"}) [Shift + Tab]`}
            className={`p-1.5 rounded transition-colors ${
              snapEnabled
                ? "bg-[#ea580c] text-white"
                : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
            }`}
          >
            <Magnet className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsSnapOpen(!isSnapOpen)}
            title="Snapping Settings Popover"
            className="p-0.5 text-[#71717a] hover:text-[#f4f4f5]"
          >
            <ChevronDown className="w-2.5 h-2.5" />
          </button>

          {isSnapOpen && (
            <div className="absolute top-9 right-0 w-52 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded-sm p-2 z-50 space-y-2 text-[10px]">
              <div className="text-[9px] font-mono uppercase text-[#71717a] border-b border-[#27272a] pb-1">
                Snap Target Element
              </div>
              <div className="grid grid-cols-2 gap-1">
                {(["increment", "vertex", "edge", "face"] as const).map((el) => (
                  <button
                    key={el}
                    type="button"
                    onClick={() => onSetSnapTo(el)}
                    className={`px-1.5 py-1 font-mono capitalize rounded border text-left ${
                      snapTo === el
                        ? "bg-[#ea580c]/20 border-[#ea580c] text-[#ea580c] font-bold"
                        : "bg-[#202024] border-[#333338] text-[#a1a1aa] hover:text-[#f4f4f5]"
                    }`}
                  >
                    {el}
                  </button>
                ))}
              </div>

              <div className="text-[9px] font-mono uppercase text-[#71717a] pt-1">
                Grid Unit ({gridSnapUnit}m)
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[0.01, 0.1, 0.5, 1.0].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => onSetGridSnapUnit(u)}
                    className={`py-0.5 font-mono text-center rounded border ${
                      gridSnapUnit === u
                        ? "bg-[#ea580c] border-[#ea580c] text-white font-bold"
                        : "bg-[#202024] border-[#333338] text-[#a1a1aa]"
                    }`}
                  >
                    {u}m
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Proportional Editing Toggle (O) */}
        <button
          type="button"
          onClick={onToggleProportionalEditing}
          title={`Proportional Editing (${isProportionalEditing ? "ON" : "OFF"}) [O]`}
          className={`p-1.5 rounded transition-colors ${
            isProportionalEditing
              ? "bg-[#ea580c] text-white"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
          }`}
        >
          <CircleDot className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-[#27272a]" />

        {/* Viewport Shading 4-Way Blender Icons */}
        <div className="flex items-center bg-[#202024] border border-[#333338] p-0.5 rounded space-x-0.5">
          {/* 1. Wireframe (Z 4) */}
          <button
            type="button"
            onClick={() => onSetShadingMode("wireframe")}
            title="Wireframe Shading [Z 4]"
            className={`p-1 rounded-xs transition-colors ${
              shadingMode === "wireframe"
                ? "bg-[#333338] text-white shadow-inner"
                : "text-[#71717a] hover:text-[#f4f4f5]"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* 2. Solid (Z 6) */}
          <button
            type="button"
            onClick={() => onSetShadingMode("solid")}
            title="Solid Shading [Z 6]"
            className={`p-1 rounded-xs transition-colors ${
              shadingMode === "solid"
                ? "bg-[#333338] text-white shadow-inner"
                : "text-[#71717a] hover:text-[#f4f4f5]"
            }`}
          >
            <Box className="w-3.5 h-3.5" />
          </button>

          {/* 3. Material Preview (Z 8) */}
          <button
            type="button"
            onClick={() => onSetShadingMode("material")}
            title="Material Preview [Z 8]"
            className={`p-1 rounded-xs transition-colors ${
              shadingMode === "material"
                ? "bg-[#333338] text-[#ea580c] shadow-inner"
                : "text-[#71717a] hover:text-[#f4f4f5]"
            }`}
          >
            <CircleDot className="w-3.5 h-3.5" />
          </button>

          {/* 4. Rendered / Normals (Z 2) */}
          <button
            type="button"
            onClick={() => onSetShadingMode("normals")}
            title="Rendered Normals Preview [Z 2]"
            className={`p-1 rounded-xs transition-colors ${
              shadingMode === "normals"
                ? "bg-[#333338] text-sky-400 shadow-inner"
                : "text-[#71717a] hover:text-[#f4f4f5]"
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* CAD Studio Lighting Presets Strip */}
        {onSelectLightingPreset && (
          <div className="hidden sm:flex items-center bg-[#202024] border border-[#333338] p-0.5 rounded text-[10px] font-mono space-x-0.5">
            <button
              type="button"
              onClick={() => onSelectLightingPreset("cad_studio")}
              title="CAD Studio Lighting: Balanced 3-Point Studio Rig"
              className={`px-1.5 py-0.5 rounded-xs transition-colors ${
                lightingPreset === "cad_studio"
                  ? "bg-[#333338] text-white font-bold"
                  : "text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              Studio
            </button>
            <button
              type="button"
              onClick={() => onSelectLightingPreset("matcap")}
              title="MatCap Evaluation: Zero-Lighting Normal & Surface Inspection"
              className={`px-1.5 py-0.5 rounded-xs transition-colors ${
                lightingPreset === "matcap"
                  ? "bg-[#333338] text-amber-400 font-bold"
                  : "text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              MatCap
            </button>
            <button
              type="button"
              onClick={() => onSelectLightingPreset("high_contrast")}
              title="High Contrast: Strong Key Light & Crisp Specular Edges"
              className={`px-1.5 py-0.5 rounded-xs transition-colors ${
                lightingPreset === "high_contrast"
                  ? "bg-[#333338] text-sky-400 font-bold"
                  : "text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              Contrast
            </button>
          </div>
        )}

        {/* CAD Inspection Headlamp Button (Alt + L) */}
        {onToggleHeadlamp && (
          <button
            type="button"
            onClick={onToggleHeadlamp}
            title={headlampEnabled ? "CAD Inspection Headlamp ON [Alt + L]" : "CAD Inspection Headlamp OFF [Alt + L]"}
            className={`flex items-center space-x-1 px-1.5 py-1 rounded-xs border text-[10px] font-mono transition-colors ${
              headlampEnabled
                ? "bg-amber-500/20 border-amber-500/50 text-amber-400 font-bold"
                : "bg-[#202024] border-[#27272a] text-[#71717a] hover:text-[#a1a1aa]"
            }`}
          >
            <Flashlight className="w-3 h-3" />
            <span className="hidden xl:inline">Headlamp</span>
          </button>
        )}

        {/* Post-Processing (SSAO & Bloom) High-Fidelity Button */}
        {onTogglePostProcessing && (
          <button
            type="button"
            onClick={onTogglePostProcessing}
            title={isPostProcessing ? "Post-Processing Active (SSAO & Bloom ON)" : "Enable Post-Processing (SSAO & Bloom)"}
            className={`flex items-center space-x-1 px-1.5 py-0.5 rounded-xs border text-[10px] font-mono transition-colors ${
              isPostProcessing
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold"
                : "bg-[#202024] border-[#27272a] text-[#71717a] hover:text-[#a1a1aa]"
            }`}
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span className="hidden lg:inline">SSAO+Bloom</span>
          </button>
        )}

        {/* Solid Matcap Swatch Popover */}
        {shadingMode === "solid" && (
          <div ref={matcapRef} className="relative">
            <button
              type="button"
              onClick={() => setIsMatcapOpen(!isMatcapOpen)}
              title={`Matcap Preset: ${matcap.toUpperCase()}`}
              className="p-1 rounded hover:bg-[#27272a] text-[#a1a1aa] flex items-center space-x-0.5"
            >
              <div
                className={`w-3 h-3 rounded-full border border-white/20 ${
                  matcap === "clay"
                    ? "bg-[#c2410c]"
                    : matcap === "redwax"
                    ? "bg-[#dc2626]"
                    : matcap === "chrome"
                    ? "bg-[#94a3b8]"
                    : matcap === "obsidian"
                    ? "bg-[#18181b]"
                    : "bg-[#71717a]"
                }`}
              />
              <ChevronDown className="w-2.5 h-2.5 text-[#71717a]" />
            </button>

            {isMatcapOpen && (
              <div className="absolute top-9 right-0 w-32 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded-sm p-1 z-50 space-y-0.5">
                {(["studio", "clay", "redwax", "chrome", "obsidian"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onSetMatcap(m);
                      setIsMatcapOpen(false);
                    }}
                    className={`w-full flex items-center space-x-2 px-2 py-1 rounded-xs text-[11px] capitalize font-mono transition-colors ${
                      matcap === m
                        ? "bg-[#ea580c]/20 text-[#ea580c] font-bold"
                        : "text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]"
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        m === "clay"
                          ? "bg-[#c2410c]"
                          : m === "redwax"
                          ? "bg-[#dc2626]"
                          : m === "chrome"
                          ? "bg-[#94a3b8]"
                          : m === "obsidian"
                          ? "bg-[#09090b]"
                          : "bg-[#71717a]"
                      }`}
                    />
                    <span>{m}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* X-Ray Transparency Toggle (Alt + Z) */}
        <button
          type="button"
          onClick={onToggleXRay}
          title={`X-Ray Transparency (${isXRay ? "ON" : "OFF"}) [Alt + Z]`}
          className={`p-1.5 rounded transition-colors ${
            isXRay
              ? "bg-[#ea580c] text-white"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
          }`}
        >
          <Eye className="w-4 h-4" />
        </button>

        {/* Viewport Overlays HUD Popover */}
        <div ref={overlaysRef} className="relative">
          <button
            type="button"
            onClick={() => setIsOverlaysOpen(!isOverlaysOpen)}
            title="Viewport Overlays HUD"
            className={`flex items-center space-x-0.5 p-1.5 rounded transition-colors ${
              isOverlaysOpen || showDimensions || showWireframeOverlay
                ? "bg-[#27272a] text-[#ea580c]"
                : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <ChevronDown className="w-2.5 h-2.5 text-[#71717a]" />
          </button>

          {isOverlaysOpen && (
            <div className="absolute top-9 right-0 w-48 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded-sm p-2 z-50 text-[11px] font-mono space-y-2">
              <div className="font-bold text-[10px] uppercase text-[#71717a] border-b border-[#27272a] pb-1 flex justify-between">
                <span>Viewport Overlays</span>
                <span className="text-[#ea580c]">HUD</span>
              </div>

              {/* Overlays Checklist */}
              <div className="space-y-1">
                {/* Grid Floor */}
                <label className="flex items-center space-x-2 cursor-pointer hover:text-white text-[#a1a1aa] p-0.5 rounded hover:bg-[#202024]">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={onToggleGrid}
                    className="accent-[#ea580c] rounded"
                  />
                  <span>Grid Floor</span>
                </label>

                {/* Cardinal Axes */}
                <label className="flex items-center space-x-2 cursor-pointer hover:text-white text-[#a1a1aa] p-0.5 rounded hover:bg-[#202024]">
                  <input
                    type="checkbox"
                    checked={showAxes}
                    onChange={onToggleAxes}
                    className="accent-[#ea580c] rounded"
                  />
                  <span>Cardinal Axes</span>
                </label>

                {/* 3D Cursor */}
                <label className="flex items-center space-x-2 cursor-pointer hover:text-white text-[#a1a1aa] p-0.5 rounded hover:bg-[#202024]">
                  <input
                    type="checkbox"
                    checked={showCursor}
                    onChange={onToggleCursor}
                    className="accent-[#ea580c] rounded"
                  />
                  <span>3D Cursor</span>
                </label>

                {/* Wireframe Overlay */}
                <label className="flex items-center space-x-2 cursor-pointer hover:text-white text-[#a1a1aa] p-0.5 rounded hover:bg-[#202024]">
                  <input
                    type="checkbox"
                    checked={showWireframeOverlay}
                    onChange={onToggleWireframeOverlay}
                    className="accent-[#ea580c] rounded"
                  />
                  <span>Wireframe Mesh</span>
                </label>

                {/* Normals Display */}
                <label className="flex items-center space-x-2 cursor-pointer hover:text-white text-[#a1a1aa] p-0.5 rounded hover:bg-[#202024]">
                  <input
                    type="checkbox"
                    checked={showNormals}
                    onChange={onToggleNormals}
                    className="accent-[#ea580c] rounded"
                  />
                  <span>Normals Display</span>
                </label>

                {/* Dimensions */}
                <label className="flex items-center space-x-2 cursor-pointer hover:text-white text-[#a1a1aa] p-0.5 rounded hover:bg-[#202024]">
                  <input
                    type="checkbox"
                    checked={showDimensions}
                    onChange={onToggleDimensions}
                    className="accent-[#ea580c] rounded"
                  />
                  <span>CAD Dimensions [D]</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Camera Frame / Focus (F / Period .) */}
        <button
          type="button"
          onClick={onFocus}
          title="Frame Selected Object in Viewport [F or Period .]"
          className="p-1.5 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] transition-colors"
        >
          <Focus className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-[#27272a]" />

        {/* Theme Palette Switcher */}
        <div ref={themeRef} className="relative">
          <button
            type="button"
            onClick={() => setIsThemeOpen(!isThemeOpen)}
            title={`Color Theme: ${THEMES[theme].name}`}
            className="p-1.5 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] transition-colors"
          >
            <div
              className="w-3 h-3 rounded-full border border-white/20"
              style={{ backgroundColor: THEMES[theme].accentAction }}
            />
          </button>

          {isThemeOpen && (
            <div className="absolute top-9 right-0 w-44 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded-sm p-1 z-50 space-y-0.5">
              {(Object.keys(THEMES) as ThemeId[]).map((tid) => (
                <button
                  key={tid}
                  type="button"
                  onClick={() => {
                    setTheme(tid);
                    setIsThemeOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-2 py-1 rounded-xs text-[11px] font-mono transition-colors ${
                    theme === tid
                      ? "bg-[#ea580c]/20 text-[#ea580c] font-bold"
                      : "text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: THEMES[tid].accentAction }}
                  />
                  <span>{THEMES[tid].name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clear Canvas / Reset Scene */}
        {onClearCanvas && (
          <button
            type="button"
            onClick={onClearCanvas}
            title="Clear Canvas / Reset Scene"
            className="p-1 rounded text-[#a1a1aa] hover:text-red-400 hover:bg-[#27272a] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Export CAD Mesh Dropdown */}
        <div ref={exportRef} className="relative">
          <button
            type="button"
            onClick={() => setIsExportOpen(!isExportOpen)}
            title="Export 3D CAD Mesh (.GLB, .OBJ, .STL)"
            className={`p-1 rounded flex items-center space-x-0.5 transition-colors ${
              isExportOpen ? "bg-[#ea580c] text-white" : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <ChevronDown className="w-2.5 h-2.5" />
          </button>

          {isExportOpen && (
            <div className="absolute top-8 right-0 w-32 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded-sm p-1 z-50 space-y-0.5 text-[11px] font-mono">
              <div className="text-[9px] uppercase font-bold text-[#71717a] px-2 py-0.5 border-b border-[#27272a]">
                Export CAD
              </div>
              {(["glb", "blend", "obj", "stl"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => {
                    onExport?.(fmt);
                    setIsExportOpen(false);
                  }}
                  className="w-full text-left px-2 py-1 rounded-xs text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5] uppercase transition-colors"
                >
                  .{fmt === "blend" ? "BLEND (Blender)" : fmt.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-[#27272a]" />

        {/* Hotkeys Modal Trigger (F1) */}
        <button
          type="button"
          onClick={onOpenShortcuts}
          title="Keyboard Shortcuts Cheat Sheet [F1]"
          className="p-1 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] transition-colors"
        >
          <Keyboard className="w-3.5 h-3.5" />
        </button>

        {/* Paste bpy Code Modal Trigger */}
        <button
          type="button"
          onClick={onOpenPasteBpy}
          title="Paste Blender Python Script [bpy]"
          className="p-1 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] transition-colors"
        >
          <Code2 className="w-3.5 h-3.5" />
        </button>

        {/* Community Showcase Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenShowcase}
          title="Community 3D Model Showcase"
          className="p-1 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] transition-colors"
        >
          <Shapes className="w-3.5 h-3.5" />
        </button>

        {/* Share 3D Model Modal Trigger */}
        <button
          type="button"
          onClick={onOpenShare}
          title="Share 3D Creation Link / Standalone HTML"
          className="p-1 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>

        {/* Generation Mode Pill */}
        <button
          type="button"
          onClick={() => {
            if (onToggleGenerationMode) {
              onToggleGenerationMode(generationMode === "ai" ? "procedural" : "ai");
            } else if (onOpenKeyModal) {
              onOpenKeyModal();
            } else {
              setIsKeyDrawerOpen(!isKeyDrawerOpen);
            }
          }}
          title={
            generationMode === "ai"
              ? "Active Mode: AI Generate (Google Gemini AI + Headless Blender). Click to switch to Procedural mode."
              : "Active Mode: Procedural (Instant client-side parametric 3D synthesis). Click to switch to AI Generate mode."
          }
          className={`flex items-center space-x-1.5 px-2 py-0.5 rounded border text-[10px] font-mono transition-all ${
            generationMode === "ai"
              ? "border-emerald-500/70 bg-emerald-950/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15)] hover:bg-emerald-900/50"
              : "border-[#ea580c]/70 bg-[#ea580c]/15 text-[#ea580c] shadow-[0_0_10px_rgba(234,88,12,0.15)] hover:bg-[#ea580c]/25"
          }`}
        >
          {generationMode === "ai" ? (
            <>
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span className="hidden xl:inline text-[#e4e4e7]">Mode:</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline text-emerald-400 font-bold">AI Generate</span>
            </>
          ) : (
            <>
              <Box className="w-3 h-3 text-[#ea580c]" />
              <span className="hidden xl:inline text-[#e4e4e7]">Mode:</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#ea580c]" />
              <span className="hidden sm:inline text-[#ea580c] font-bold">Procedural</span>
            </>
          )}
        </button>

        <div className="w-px h-4 bg-[#27272a]" />

        {/* N-Panel (Properties / Outliner) Toggle Button (N) */}
        <button
          type="button"
          onClick={onToggleNPanel}
          title={`Right Properties Panel (${isNOpen ? "Close" : "Open"}) [N]`}
          className={`p-1 rounded transition-colors ${
            isNOpen
              ? "bg-[#27272a] text-[#ea580c]"
              : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
          }`}
        >
          <PanelRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
