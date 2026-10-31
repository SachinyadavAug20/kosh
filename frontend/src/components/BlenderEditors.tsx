"use client";

import React, { useState } from "react";
import {
  Sliders,
  Layers,
  Wrench,
  Palette,
  Code2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Play,
  RotateCcw,
  Sparkles,
  Copy,
  Check,
  Search,
  Plus,
  Compass,
  Box,
  Minimize2,
} from "lucide-react";

export interface TransformValues {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number }; // in degrees
  scale: { x: number; y: number; z: number };
  dimensions?: { x: number; y: number; z: number };
}

export interface SwatchPreset {
  name: string;
  color: string;
  roughness: number;
  metalness: number;
  transmission?: number;
  clearcoat?: number;
  emissive?: string;
  bgClass: string;
}

export const BLENDER_SWATCHES: SwatchPreset[] = [
  { name: "Blender Clay", color: "#d97706", roughness: 0.75, metalness: 0.05, bgClass: "bg-amber-600" },
  { name: "Titanium Slate", color: "#475569", roughness: 0.35, metalness: 0.85, bgClass: "bg-slate-600" },
  { name: "Machined Steel", color: "#94a3b8", roughness: 0.18, metalness: 0.95, bgClass: "bg-slate-400" },
  { name: "Polished Brass", color: "#eab308", roughness: 0.22, metalness: 0.9, bgClass: "bg-yellow-500" },
  { name: "Obsidian Core", color: "#18181b", roughness: 0.1, metalness: 0.98, bgClass: "bg-zinc-900 border border-zinc-700" },
  { name: "Emissive Cyan", color: "#06b6d4", roughness: 0.2, metalness: 0.4, emissive: "#06b6d4", bgClass: "bg-cyan-500 shadow-sm shadow-cyan-500/50" },
  { name: "Clear Glass", color: "#ffffff", roughness: 0.05, metalness: 0.0, transmission: 0.95, clearcoat: 1.0, bgClass: "bg-sky-200/40 border border-sky-300" },
  { name: "Pure White", color: "#f4f4f5", roughness: 0.6, metalness: 0.1, bgClass: "bg-zinc-100" },
];

export interface MeshNodeItem {
  id: string;
  name: string;
  triangles: number;
  vertices: number;
  visible?: boolean;
}

// ----------------------------------------------------------------------
// 1. Standalone Outliner Editor
// ----------------------------------------------------------------------
export interface OutlinerEditorProps {
  meshList: MeshNodeItem[];
  selectedMeshName: string | null;
  selectedMeshNames?: string[];
  onSelectMesh: (name: string | null) => void;
  onToggleSelectMesh?: (name: string) => void;
  onToggleMeshVisibility: (name: string) => void;
  lockedMeshes: Set<string>;
  onToggleMeshLock: (name: string) => void;
}

export function OutlinerEditor({
  meshList = [],
  selectedMeshName,
  selectedMeshNames = [],
  onSelectMesh,
  onToggleSelectMesh,
  onToggleMeshVisibility,
  lockedMeshes,
  onToggleMeshLock,
}: OutlinerEditorProps) {
  const [outlinerFilter, setOutlinerFilter] = useState("");

  const filtered = meshList.filter((m) =>
    m.name.toLowerCase().includes(outlinerFilter.toLowerCase())
  );
  const totalTris = meshList.reduce((acc, m) => acc + (m.triangles || 0), 0);

  return (
    <div className="flex flex-col h-full w-full bg-[#18181b] p-2 space-y-2 select-none overflow-hidden text-xs">
      {/* Search / Filter */}
      <div className="relative shrink-0">
        <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-[#71717a]" />
        <input
          type="text"
          value={outlinerFilter}
          onChange={(e) => setOutlinerFilter(e.target.value)}
          placeholder="Filter scene meshes... (Ctrl+Click to multi-select)"
          className="w-full bg-[#141416] border border-[#27272a] rounded pl-7 pr-2 py-1 text-[11px] font-mono text-[#f4f4f5] placeholder-[#52525b] focus:outline-none focus:border-[#ea580c]"
        />
      </div>

      {/* Summary Metrics */}
      <div className="flex items-center justify-between text-[10px] font-mono text-[#71717a] shrink-0 px-0.5">
        <span>
          Meshes: {meshList.length}
          {selectedMeshNames.length > 1 && (
            <span className="ml-1 text-[#ea580c] font-bold">({selectedMeshNames.length} selected)</span>
          )}
        </span>
        <span>{totalTris.toLocaleString()} Tris</span>
      </div>

      {/* Mesh Tree List */}
      <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
        {filtered.map((mesh) => {
          const isSelected = selectedMeshName === mesh.name || (selectedMeshNames && selectedMeshNames.includes(mesh.name));
          const isActive = selectedMeshName === mesh.name;
          const isLocked = lockedMeshes.has(mesh.name);
          const isVisible = mesh.visible !== false;

          return (
            <div
              key={mesh.id}
              className={`flex items-center justify-between px-2 py-1.5 rounded font-mono text-[11px] border transition-colors ${
                isSelected
                  ? isActive
                    ? "bg-[#ea580c]/20 border-[#ea580c] text-white"
                    : "bg-[#ea580c]/10 border-[#d97706]/70 text-[#f4f4f5]"
                  : "bg-[#141416] border-[#27272a] hover:bg-[#202024] text-[#a1a1aa]"
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  if (e.ctrlKey || e.shiftKey) {
                    onToggleSelectMesh?.(mesh.name);
                  } else {
                    onSelectMesh(isSelected ? null : mesh.name);
                  }
                }}
                className="flex-1 flex items-center space-x-1.5 text-left truncate min-w-0"
              >
                <Box
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? "text-[#f59e0b]" : isSelected ? "text-[#ea580c]" : "text-[#71717a]"
                  }`}
                />
                <span className="truncate font-semibold">{mesh.name}</span>
                {isSelected && !isActive && (
                  <span className="ml-1 text-[8px] px-1 py-0.2 rounded bg-[#d97706]/30 text-[#f59e0b]">SEL</span>
                )}
              </button>

              <div className="flex items-center space-x-2 shrink-0 ml-2">
                <span className="text-[9px] text-[#52525b]">{mesh.triangles}t</span>
                <button
                  type="button"
                  onClick={() => onToggleMeshVisibility(mesh.name)}
                  className={`p-0.5 hover:text-white transition-colors ${
                    isVisible ? "text-[#71717a]" : "text-red-400"
                  }`}
                  title={isVisible ? "Hide Mesh" : "Show Mesh"}
                >
                  {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleMeshLock(mesh.name)}
                  className={`p-0.5 hover:text-white transition-colors ${
                    isLocked ? "text-amber-400" : "text-[#71717a]"
                  }`}
                  title={isLocked ? "Unlock Mesh" : "Lock Mesh (Prevent Selection)"}
                >
                  {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </button>
              </div>
            </div>
          );
        })}

        {meshList.length === 0 && (
          <div className="text-center py-6 text-[#52525b] font-mono text-[10px]">
            No mesh objects in active scene.
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 2. Standalone Properties Editor
// ----------------------------------------------------------------------
export interface PropertiesEditorProps {
  selectedMeshName: string | null;
  onSelectMesh: (name: string | null) => void;
  transform?: TransformValues;
  onUpdateTransform?: (
    pos: [number, number, number],
    rot: [number, number, number],
    scale: [number, number, number]
  ) => void;
  onPlaceOnFloor?: () => void;
  onCenterOrigin?: () => void;
  onResetRotation?: () => void;
  onResetScale?: () => void;
  simplifyRatio?: number;
  onDecimate?: (ratio: number) => void;
  onSubdivide?: () => void;
  isWireframe?: boolean;
  onToggleWireframe?: () => void;
  currentRoughness?: number;
  currentMetalness?: number;
  currentColor?: string;
  currentTransmission?: number;
  currentClearcoat?: number;
  onUpdateMaterial?: (
    roughness: number,
    metalness: number,
    color?: string,
    extra?: { transmission?: number; clearcoat?: number }
  ) => void;
  defaultTab?: "item" | "modifiers" | "material";
}

export function PropertiesEditor({
  selectedMeshName,
  onSelectMesh,
  transform,
  onUpdateTransform,
  onPlaceOnFloor,
  onCenterOrigin,
  onResetRotation,
  onResetScale,
  simplifyRatio = 1.0,
  onDecimate,
  onSubdivide,
  isWireframe = false,
  onToggleWireframe,
  currentRoughness = 0.5,
  currentMetalness = 0.5,
  currentColor = "#94a3b8",
  currentTransmission = 0.0,
  currentClearcoat = 0.0,
  onUpdateMaterial,
  defaultTab = "item",
}: PropertiesEditorProps) {
  const [activeTab, setActiveTab] = useState<"item" | "modifiers" | "material">(defaultTab);

  const [loc, setLoc] = useState({ x: 0, y: 0, z: 0 });
  const [rot, setRot] = useState({ x: 0, y: 0, z: 0 });
  const [scl, setScl] = useState({ x: 1, y: 1, z: 1 });
  const [lockScale, setLockScale] = useState(true);

  React.useEffect(() => {
    if (transform) {
      setLoc(transform.position);
      setRot(transform.rotation);
      setScl(transform.scale);
    }
  }, [transform]);

  const handleApplyTransform = (nextLoc = loc, nextRot = rot, nextScl = scl) => {
    setLoc(nextLoc);
    setRot(nextRot);
    setScl(nextScl);
    if (onUpdateTransform) {
      onUpdateTransform(
        [nextLoc.x, nextLoc.y, nextLoc.z],
        [nextRot.x, nextRot.y, nextRot.z],
        [nextScl.x, nextScl.y, nextScl.z]
      );
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#18181b] select-none overflow-hidden text-xs">
      {/* Properties Category Header Strip */}
      <div className="h-7 shrink-0 flex items-center space-x-1 px-2 border-b border-[#27272a] bg-[#141416]/90 font-mono text-[10px]">
        {[
          { id: "item", label: "Item", icon: <Sliders className="w-3 h-3" /> },
          { id: "modifiers", label: "Modifiers", icon: <Wrench className="w-3 h-3" /> },
          { id: "material", label: "Material", icon: <Palette className="w-3 h-3" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as "item" | "modifiers" | "material")}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded transition-colors ${
              activeTab === tab.id
                ? "bg-[#27272a] text-[#ea580c] font-bold"
                : "text-[#71717a] hover:text-[#f4f4f5]"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {/* ITEM TAB */}
        {activeTab === "item" && (
          <div className="space-y-4">
            {/* Active Selection Pill */}
            <div className="p-2 bg-[#202024] border border-[#27272a] rounded flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                <Box className="w-3.5 h-3.5 text-[#ea580c] shrink-0" />
                <span className="font-mono text-[11px] font-semibold truncate text-[#f4f4f5]">
                  {selectedMeshName || "No Mesh Selected"}
                </span>
              </div>
              {selectedMeshName && (
                <button
                  type="button"
                  onClick={() => onSelectMesh(null)}
                  className="text-[10px] text-[#71717a] hover:text-[#ef4444] font-mono"
                  title="Deselect"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#a1a1aa] uppercase tracking-wider">
                <span>Location</span>
                <button
                  type="button"
                  onClick={() => handleApplyTransform({ x: 0, y: 0, z: 0 })}
                  className="hover:text-[#ea580c] text-[9px] flex items-center space-x-0.5"
                  title="Reset Location to 0"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>0</span>
                </button>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                {(["x", "y", "z"] as const).map((axis) => (
                  <div
                    key={axis}
                    className="flex items-center bg-[#141416] border border-[#27272a] rounded overflow-hidden"
                  >
                    <span
                      className={`w-6 text-center font-bold text-[10px] uppercase py-1 ${
                        axis === "x"
                          ? "bg-red-500/20 text-red-400"
                          : axis === "y"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {axis}
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      value={Number(loc[axis].toFixed(3))}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        handleApplyTransform({ ...loc, [axis]: val });
                      }}
                      className="flex-1 bg-transparent px-2 py-1 text-right text-[#f4f4f5] focus:outline-none focus:bg-[#202024]"
                    />
                    <span className="text-[9px] text-[#71717a] pr-2">m</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rotation */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#a1a1aa] uppercase tracking-wider">
                <span>Rotation</span>
                <button
                  type="button"
                  onClick={() => {
                    handleApplyTransform(loc, { x: 0, y: 0, z: 0 });
                    if (onResetRotation) onResetRotation();
                  }}
                  className="hover:text-[#ea580c] text-[9px] flex items-center space-x-0.5"
                  title="Reset Rotation to 0°"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>0°</span>
                </button>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                {(["x", "y", "z"] as const).map((axis) => (
                  <div
                    key={axis}
                    className="flex items-center bg-[#141416] border border-[#27272a] rounded overflow-hidden"
                  >
                    <span
                      className={`w-6 text-center font-bold text-[10px] uppercase py-1 ${
                        axis === "x"
                          ? "bg-red-500/20 text-red-400"
                          : axis === "y"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {axis}
                    </span>
                    <input
                      type="number"
                      step="15"
                      value={Number(rot[axis].toFixed(1))}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        handleApplyTransform(loc, { ...rot, [axis]: val });
                      }}
                      className="flex-1 bg-transparent px-2 py-1 text-right text-[#f4f4f5] focus:outline-none focus:bg-[#202024]"
                    />
                    <span className="text-[9px] text-[#71717a] pr-2">°</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scale */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#a1a1aa] uppercase tracking-wider">
                <span className="flex items-center space-x-1">
                  <span>Scale</span>
                  <button
                    type="button"
                    onClick={() => setLockScale(!lockScale)}
                    className={`text-[9px] px-1 rounded ${
                      lockScale ? "bg-[#ea580c]/20 text-[#ea580c]" : "text-[#71717a]"
                    }`}
                    title={lockScale ? "Uniform Scaling (Locked)" : "Per-Axis Scaling"}
                  >
                    {lockScale ? "XYZ Locked" : "Free"}
                  </button>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    handleApplyTransform(loc, rot, { x: 1, y: 1, z: 1 });
                    if (onResetScale) onResetScale();
                  }}
                  className="hover:text-[#ea580c] text-[9px] flex items-center space-x-0.5"
                  title="Reset Scale to 1.0"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>1.0</span>
                </button>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                {(["x", "y", "z"] as const).map((axis) => (
                  <div
                    key={axis}
                    className="flex items-center bg-[#141416] border border-[#27272a] rounded overflow-hidden"
                  >
                    <span
                      className={`w-6 text-center font-bold text-[10px] uppercase py-1 ${
                        axis === "x"
                          ? "bg-red-500/20 text-red-400"
                          : axis === "y"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {axis}
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      value={Number(scl[axis].toFixed(3))}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1;
                        if (lockScale) {
                          handleApplyTransform(loc, rot, { x: val, y: val, z: val });
                        } else {
                          handleApplyTransform(loc, rot, { ...scl, [axis]: val });
                        }
                      }}
                      className="flex-1 bg-transparent px-2 py-1 text-right text-[#f4f4f5] focus:outline-none focus:bg-[#202024]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Align */}
            <div className="pt-2 border-t border-[#27272a] space-y-1.5">
              <span className="text-[10px] font-mono uppercase text-[#71717a]">Quick Align</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={onPlaceOnFloor}
                  className="px-2 py-1 bg-[#202024] hover:bg-[#27272a] border border-[#27272a] rounded text-[10px] font-mono text-[#f4f4f5] flex items-center justify-center space-x-1 transition-colors"
                  title="Snap lowest point to Ground Plane Y=0"
                >
                  <Minimize2 className="w-3 h-3 text-[#ea580c]" />
                  <span>Drop to Floor</span>
                </button>
                <button
                  type="button"
                  onClick={onCenterOrigin}
                  className="px-2 py-1 bg-[#202024] hover:bg-[#27272a] border border-[#27272a] rounded text-[10px] font-mono text-[#f4f4f5] flex items-center justify-center space-x-1 transition-colors"
                  title="Center object at (0, Y, 0)"
                >
                  <Compass className="w-3 h-3 text-cyan-400" />
                  <span>Center Origin</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODIFIERS TAB */}
        {activeTab === "modifiers" && (
          <div className="space-y-4">
            <div className="p-3 bg-[#202024] border border-[#27272a] rounded space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-[#f4f4f5]">Decimate / Simplify</span>
                <span className="font-mono text-[10px] text-[#ea580c]">
                  {Math.round(simplifyRatio * 100)}% Poly
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={simplifyRatio}
                onChange={(e) => onDecimate && onDecimate(parseFloat(e.target.value))}
                className="w-full accent-[#ea580c] h-1.5 bg-[#141416] rounded cursor-pointer"
              />
              <div className="flex justify-between text-[9px] font-mono text-[#52525b]">
                <span>10% Low-Poly</span>
                <span>100% Original</span>
              </div>
            </div>

            <div className="p-3 bg-[#202024] border border-[#27272a] rounded space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-[#f4f4f5]">Subdivision Surface</span>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <button
                type="button"
                onClick={onSubdivide}
                className="w-full py-1.5 bg-[#141416] hover:bg-[#27272a] border border-[#27272a] rounded font-mono text-[10px] text-[#f4f4f5] flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Plus className="w-3 h-3 text-[#ea580c]" />
                <span>Subdivide Mesh</span>
              </button>
            </div>

            <div className="p-3 bg-[#202024] border border-[#27272a] rounded flex items-center justify-between">
              <div>
                <div className="font-mono text-[11px] font-semibold text-[#f4f4f5]">Wireframe Edges</div>
                <div className="text-[9px] text-[#71717a]">Overlay topology quad/triangle lines</div>
              </div>
              <button
                type="button"
                onClick={onToggleWireframe}
                className={`px-2.5 py-1 font-mono text-[10px] rounded border transition-colors ${
                  isWireframe
                    ? "bg-[#ea580c] border-[#ea580c] text-white"
                    : "bg-[#141416] border-[#27272a] text-[#71717a] hover:text-[#f4f4f5]"
                }`}
              >
                {isWireframe ? "Active" : "Off"}
              </button>
            </div>
          </div>
        )}

        {/* MATERIAL TAB */}
        {activeTab === "material" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase text-[#71717a] tracking-wider">
                Swatches
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {BLENDER_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.name}
                    type="button"
                    onClick={() =>
                      onUpdateMaterial &&
                      onUpdateMaterial(swatch.roughness, swatch.metalness, swatch.color, {
                        transmission: swatch.transmission,
                        clearcoat: swatch.clearcoat,
                      })
                    }
                    className="group flex flex-col items-center p-1.5 bg-[#141416] hover:bg-[#202024] border border-[#27272a] rounded transition-all"
                    title={`${swatch.name}`}
                  >
                    <div className={`w-5 h-5 rounded-full ${swatch.bgClass} mb-1 shadow-inner`} />
                    <span className="text-[8px] font-mono text-[#a1a1aa] truncate max-w-full group-hover:text-white">
                      {swatch.name.split(" ")[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Base Color */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase text-[#71717a] tracking-wider">
                Base Color
              </span>
              <div className="flex items-center space-x-2 bg-[#141416] border border-[#27272a] rounded p-1.5">
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) =>
                    onUpdateMaterial && onUpdateMaterial(currentRoughness, currentMetalness, e.target.value)
                  }
                  className="w-7 h-7 bg-transparent rounded cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={currentColor}
                  onChange={(e) =>
                    onUpdateMaterial && onUpdateMaterial(currentRoughness, currentMetalness, e.target.value)
                  }
                  className="flex-1 bg-transparent font-mono text-[11px] text-[#f4f4f5] focus:outline-none uppercase"
                />
              </div>
            </div>

            {/* Roughness */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#a1a1aa]">
                <span>Roughness</span>
                <span className="text-[#ea580c]">{currentRoughness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={currentRoughness}
                onChange={(e) =>
                  onUpdateMaterial &&
                  onUpdateMaterial(parseFloat(e.target.value), currentMetalness, currentColor)
                }
                className="w-full accent-[#ea580c] h-1.5 bg-[#141416] rounded cursor-pointer"
              />
            </div>

            {/* Metalness */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#a1a1aa]">
                <span>Metallic</span>
                <span className="text-[#ea580c]">{currentMetalness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={currentMetalness}
                onChange={(e) =>
                  onUpdateMaterial &&
                  onUpdateMaterial(currentRoughness, parseFloat(e.target.value), currentColor)
                }
                className="w-full accent-[#ea580c] h-1.5 bg-[#141416] rounded cursor-pointer"
              />
            </div>

            {/* Transmission */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#a1a1aa]">
                <span>Transmission (Glass)</span>
                <span className="text-[#ea580c]">{currentTransmission.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={currentTransmission}
                onChange={(e) =>
                  onUpdateMaterial &&
                  onUpdateMaterial(currentRoughness, currentMetalness, currentColor, {
                    transmission: parseFloat(e.target.value),
                    clearcoat: currentClearcoat,
                  })
                }
                className="w-full accent-[#ea580c] h-1.5 bg-[#141416] rounded cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 3. Standalone Scripting / MCP Console Editor
// ----------------------------------------------------------------------
export interface ScriptingEditorProps {
  script: string | null;
  assetUrl?: string | null;
  onExecuteScript?: (script: string) => void;
  isLoading?: boolean;
  stdout?: string | null;
  stderr?: string | null;
}

export function ScriptingEditor({
  script,
  assetUrl,
  onExecuteScript,
  isLoading = false,
  stdout,
  stderr,
}: ScriptingEditorProps) {
  const [editableScript, setEditableScript] = useState(script || "");
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  React.useEffect(() => {
    if (script) setEditableScript(script);
  }, [script]);

  const handleCopyStandaloneHtml = () => {
    const fullUrl = assetUrl
      ? assetUrl.startsWith("http")
        ? assetUrl
        : `http://localhost:8080${assetUrl}`
      : "";

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kosh 3D Model</title>
  <style>
    body { margin: 0; overflow: hidden; background: #141416; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    #canvas-container { width: 100vw; height: 100vh; }
    .badge { position: absolute; bottom: 20px; left: 20px; background: rgba(26,26,30,0.85); color: #f4f4f5; padding: 8px 14px; border-radius: 6px; font-size: 12px; border: 1px solid #333338; backdrop-filter: blur(8px); }
  </style>
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
      }
    }
  </script>
</head>
<body>
  <div id="canvas-container"></div>
  <div class="badge">Kosh Standalone 3D Export</div>
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141416);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(4, 3, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x22222a, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(5, 8, 5);
    scene.add(key);

    const grid = new THREE.GridHelper(10, 20, 0x3f3f46, 0x27272a);
    scene.add(grid);

    const loader = new GLTFLoader();
    loader.load('${fullUrl}', (gltf) => {
      scene.add(gltf.scene);
      const bbox = new THREE.Box3().setFromObject(gltf.scene);
      const center = bbox.getCenter(new THREE.Vector3());
      controls.target.copy(center);
    });

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
  </script>
</body>
</html>`;

    navigator.clipboard.writeText(htmlContent);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#18181b] p-3 space-y-3 select-none overflow-hidden text-xs">
      {/* Top Actions: Run, Copy HTML, Copy Script */}
      <div className="flex items-center space-x-2 shrink-0">
        <button
          type="button"
          onClick={() => onExecuteScript && onExecuteScript(editableScript)}
          disabled={isLoading || !editableScript.trim()}
          className="flex-1 py-1.5 bg-[#ea580c] hover:bg-[#f97316] disabled:opacity-50 text-white rounded font-mono text-[10px] font-bold flex items-center justify-center space-x-1.5 transition-colors"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>{isLoading ? "Executing bpy..." : "Run Script (Alt+P)"}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyStandaloneHtml}
          className="px-2.5 py-1.5 bg-[#202024] hover:bg-[#27272a] border border-[#27272a] rounded font-mono text-[10px] text-[#f4f4f5] flex items-center justify-center space-x-1 transition-colors"
          title="1-Click Standalone Three.js HTML Export"
        >
          {copiedHtml ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copiedHtml ? "Copied HTML!" : "HTML Export"}</span>
        </button>
      </div>

      {/* Script Code Block */}
      <div className="flex-1 flex flex-col space-y-1 min-h-0">
        <div className="flex items-center justify-between text-[10px] font-mono text-[#71717a] shrink-0">
          <span>Blender Python Script (bpy)</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(editableScript);
              setCopiedScript(true);
              setTimeout(() => setCopiedScript(false), 2000);
            }}
            className="hover:text-white flex items-center space-x-0.5"
          >
            {copiedScript ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
            <span>{copiedScript ? "Copied" : "Copy"}</span>
          </button>
        </div>
        <textarea
          value={editableScript}
          onChange={(e) => setEditableScript(e.target.value)}
          className="flex-1 w-full bg-[#141416] border border-[#27272a] rounded p-2.5 font-mono text-[11px] text-[#e4e4e7] leading-relaxed resize-none focus:outline-none focus:border-[#ea580c] custom-scrollbar"
          placeholder="# Paste or write Blender bpy script here..."
          spellCheck={false}
        />
      </div>

      {/* Execution Telemetry Logs */}
      {(stdout || stderr) && (
        <div className="h-32 shrink-0 flex flex-col space-y-1">
          <span className="text-[10px] font-mono uppercase text-[#71717a]">
            Console Logs & Output
          </span>
          <div className="flex-1 bg-[#141416] border border-[#27272a] rounded p-2 overflow-y-auto font-mono text-[9px] custom-scrollbar">
            {stdout && <div className="text-emerald-400 whitespace-pre-wrap">{stdout}</div>}
            {stderr && <div className="text-red-400 whitespace-pre-wrap mt-1">{stderr}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 4. Director AI Studio Editor (Prompt Console, Script Breakdown)
// -------------------------------------------------------------
export interface DirectorEditorProps {
  sceneDescriptor?: any;
  onGeneratePrompt?: (prompt: string) => void;
  onOpenExportModal?: () => void;
  onResetScene?: () => void;
  isGenerating?: boolean;
}

export function DirectorEditor({
  sceneDescriptor,
  onGeneratePrompt,
  onOpenExportModal,
  onResetScene,
  isGenerating = false,
}: DirectorEditorProps) {
  const [promptInput, setPromptInput] = useState<string>(
    sceneDescriptor?.prompt || "A courier runs through a rain-soaked cyberpunk alley, stops at a neon door, and looks back"
  );

  const presets = [
    { label: "Cyberpunk Alley", prompt: "A courier runs through a rain-soaked cyberpunk alley, stops at a neon door, and looks back" },
    { label: "Sunset Cabin", prompt: "A traveler walks through a pine forest towards a warm cabin at golden hour sunset" },
    { label: "Starry Ruins", prompt: "An adventurer discovers ancient ruins under a starry night sky with glowing campfire" },
    { label: "Desert Expedition", prompt: "A low-poly robotic scout jogs across sunny sand dunes exploring an outpost" },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#18181b] p-3 space-y-3 select-none overflow-y-auto custom-scrollbar text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-[#ea580c]" />
          <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
            DIRECTOR AI STUDIO
          </span>
        </div>
        {sceneDescriptor && (
          <span className="px-1.5 py-0.5 rounded bg-[#ea580c]/20 border border-[#ea580c]/40 text-[#ea580c] font-mono text-[10px]">
            ACTIVE SCENE
          </span>
        )}
      </div>

      {/* Prompt Console */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono text-[#a1a1aa] uppercase">
          Narrative Script / Scene Prompt
        </label>
        <textarea
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          rows={3}
          className="w-full bg-[#141416] border border-[#27272a] rounded p-2 text-xs text-white placeholder-[#52525b] focus:outline-none focus:border-[#ea580c] resize-none"
          placeholder="Describe your 3D animation scene..."
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onGeneratePrompt?.(promptInput)}
            disabled={isGenerating || !promptInput.trim()}
            className="flex-1 py-1.5 bg-[#ea580c] hover:bg-[#f97316] disabled:opacity-50 text-white rounded font-mono text-[11px] font-bold flex items-center justify-center space-x-1.5 shadow-md transition-colors"
          >
            <span>{isGenerating ? "Synthesizing Scene..." : "Generate Scene"}</span>
          </button>
          {onOpenExportModal && (
            <button
              type="button"
              onClick={onOpenExportModal}
              className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] rounded font-mono text-[11px] font-medium transition-colors"
            >
              Export Video
            </button>
          )}
        </div>
      </div>

      {/* Preset Chips */}
      <div className="space-y-1">
        <span className="text-[10px] font-mono text-[#71717a] uppercase">Storyboards</span>
        <div className="grid grid-cols-2 gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setPromptInput(p.prompt);
                onGeneratePrompt?.(p.prompt);
              }}
              className="p-1.5 rounded bg-[#141416] border border-[#27272a] hover:border-[#ea580c]/60 text-left text-[10px] text-[#d4d4d8] truncate transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Script Breakdown / Scene Graph */}
      {sceneDescriptor && (
        <div className="space-y-2 pt-2 border-t border-[#27272a]">
          <span className="text-[10px] font-mono text-[#a1a1aa] uppercase font-bold">
            Scene Breakdown
          </span>

          <div className="bg-[#141416] border border-[#27272a] rounded p-2 space-y-1.5 font-mono text-[10px]">
            <div className="flex justify-between text-[#71717a]">
              <span>Duration</span>
              <span className="text-[#f4f4f5]">
                {sceneDescriptor.meta?.durationFrames || sceneDescriptor.durationFrames || 180} frames ({sceneDescriptor.meta?.fps || 30} FPS)
              </span>
            </div>
            <div className="flex justify-between text-[#71717a]">
              <span>Environment</span>
              <span className="text-[#ea580c] uppercase">
                {sceneDescriptor.environment?.preset || "Procedural"}
              </span>
            </div>
            <div className="flex justify-between text-[#71717a]">
              <span>Ground</span>
              <span className="text-[#f4f4f5]">
                {sceneDescriptor.environment?.ground?.type || "terrain"}
              </span>
            </div>
            <div className="flex justify-between text-[#71717a]">
              <span>Props Count</span>
              <span className="text-[#f4f4f5]">
                {sceneDescriptor.props?.length || sceneDescriptor.entities?.length || 0}
              </span>
            </div>
            <div className="flex justify-between text-[#71717a]">
              <span>Actors</span>
              <span className="text-emerald-400">
                {sceneDescriptor.actors?.map((a: any) => a.name).join(", ") || "None"}
              </span>
            </div>
          </div>

          {onResetScene && (
            <button
              type="button"
              onClick={onResetScene}
              className="w-full py-1 text-center text-[10px] font-mono text-[#71717a] hover:text-red-400 transition-colors"
            >
              Clear Narrative Scene
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 5. MCP Live Console Editor (Real-Time JSON-RPC Tool Calls)
// -------------------------------------------------------------
import { DIRECTOR_MCP_TOOLS, dispatchMcpTool } from "../lib/mcp/DirectorMcpTools";

export interface McpConsoleEditorProps {
  onExecuteTool?: (toolName: string, params: Record<string, any>) => void;
  isLoading?: boolean;
}

export function McpConsoleEditor({
  onExecuteTool,
  isLoading = false,
}: McpConsoleEditorProps) {
  const [selectedTool, setSelectedTool] = useState<string>("create_actor");
  const [jsonParams, setJsonParams] = useState<string>(
    JSON.stringify(
      DIRECTOR_MCP_TOOLS.find((t) => t.name === "create_actor")?.samplePayload || {},
      null,
      2
    )
  );
  const [logs, setLogs] = useState<Array<{ time: string; tool: string; status: string; detail?: string }>>([
    { time: "10:30:12", tool: "mcp/health_check", status: "200 OK" },
    { time: "10:30:15", tool: "blender_eval", status: "SUCCESS (Engine Ready)" },
  ]);

  const tools = [
    ...DIRECTOR_MCP_TOOLS.map((t) => ({ id: t.name, label: `${t.name} (Director)`, sample: t.samplePayload })),
    {
      id: "blender_eval",
      label: "blender_eval (Python)",
      sample: { code: "import bpy\nbpy.ops.mesh.primitive_cube_add(size=2.0)" },
    },
    {
      id: "openscad_render",
      label: "openscad_render (CSG)",
      sample: { code: "cube([10, 10, 10], center=true);" },
    },
    {
      id: "svg_extrude",
      label: "svg_extrude (Path)",
      sample: { path: "M 0 0 L 10 0 L 10 10 Z", depth: 2.0 },
    },
    {
      id: "audio_motion_bake",
      label: "audio_motion_bake (FFT)",
      sample: { audioUrl: "/audio/narration_demo.wav", fps: 30 },
    },
  ];

  const handleToolSelect = (toolId: string) => {
    setSelectedTool(toolId);
    const found = tools.find((t) => t.id === toolId);
    if (found && found.sample) {
      setJsonParams(JSON.stringify(found.sample, null, 2));
    }
  };

  const handleRun = () => {
    try {
      const parsed = JSON.parse(jsonParams);
      const res = dispatchMcpTool(selectedTool, parsed);
      onExecuteTool?.(selectedTool, parsed);
      setLogs((prev) => [
        {
          time: new Date().toLocaleTimeString(),
          tool: selectedTool,
          status: res.error ? `ERROR (${res.error.code})` : "JSON-RPC 200 OK",
          detail: res.error ? res.error.message : "Executed",
        },
        ...prev,
      ]);
    } catch (e: any) {
      alert("Invalid JSON parameters: " + e.message);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#18181b] p-3 space-y-3 select-none overflow-hidden text-xs font-mono">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
        <div className="flex items-center space-x-2">
          <Code2 className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            MCP LIVE TOOL CONSOLE
          </span>
        </div>
        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px]">
          JSON-RPC CONNECTED
        </span>
      </div>

      {/* Tool Selector */}
      <div className="space-y-1">
        <label className="text-[10px] text-[#71717a] uppercase">Registered Endpoint</label>
        <select
          value={selectedTool}
          onChange={(e) => handleToolSelect(e.target.value)}
          className="w-full bg-[#141416] border border-[#27272a] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#ea580c]"
        >
          {tools.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* JSON Payload Input */}
      <div className="flex-1 flex flex-col space-y-1 min-h-0">
        <label className="text-[10px] text-[#71717a] uppercase">Input Payload (JSON)</label>
        <textarea
          value={jsonParams}
          onChange={(e) => setJsonParams(e.target.value)}
          className="flex-1 w-full bg-[#141416] border border-[#27272a] rounded p-2 text-[11px] text-[#e4e4e7] focus:outline-none focus:border-[#ea580c] resize-none custom-scrollbar"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={handleRun}
          disabled={isLoading}
          className="py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded font-bold text-[11px] flex items-center justify-center space-x-1 transition-colors"
        >
          <span>{isLoading ? "Executing Call..." : "Dispatch Tool Call"}</span>
        </button>
      </div>

      {/* Live Request Log */}
      <div className="h-28 flex flex-col space-y-1 shrink-0 pt-2 border-t border-[#27272a]">
        <span className="text-[10px] text-[#71717a] uppercase">Transmission Stream</span>
        <div className="flex-1 bg-[#141416] border border-[#27272a] rounded p-1.5 overflow-y-auto text-[9px] space-y-0.5 custom-scrollbar">
          {logs.map((l, i) => (
            <div key={i} className="flex justify-between items-center text-[#a1a1aa]">
              <span className="text-zinc-500">{l.time}</span>
              <span className="text-sky-300 font-bold">{l.tool}</span>
              <span className="text-emerald-400">{l.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

