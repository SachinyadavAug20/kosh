"use client";

import React, { useState } from "react";
import {
  Sliders,
  Layers,
  Wrench,
  Palette,
  Code2,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Play,
  RotateCcw,
  Sparkles,
  Copy,
  Check,
  Download,
  Search,
  Plus,
  Compass,
  Box,
  Maximize2,
  Minimize2,
  FileCode,
  Terminal,
} from "lucide-react";

export type NPanelTab = "item" | "outliner" | "modifiers" | "material" | "script";

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

interface BlenderNPanelProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  selectedMeshName: string | null;
  meshList: MeshNodeItem[];
  onSelectMesh: (name: string | null) => void;
  onToggleMeshVisibility: (name: string) => void;
  lockedMeshes: Set<string>;
  onToggleMeshLock: (name: string) => void;

  // Item / Transform
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

  // Modifiers
  simplifyRatio?: number;
  onDecimate?: (ratio: number) => void;
  onSubdivide?: () => void;
  isWireframe?: boolean;
  onToggleWireframe?: () => void;

  // Material
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

  // Script & MCP
  script: string | null;
  assetUrl?: string | null;
  onExecuteScript?: (script: string) => void;
  isLoading?: boolean;
  stdout?: string | null;
  stderr?: string | null;
}

export function BlenderNPanel({
  isOpen,
  onToggleOpen,
  selectedMeshName,
  meshList = [],
  onSelectMesh,
  onToggleMeshVisibility,
  lockedMeshes,
  onToggleMeshLock,
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
  script,
  assetUrl,
  onExecuteScript,
  isLoading = false,
  stdout,
  stderr,
}: BlenderNPanelProps) {
  const [activeTab, setActiveTab] = useState<NPanelTab>("item");
  const [outlinerFilter, setOutlinerFilter] = useState("");
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [editableScript, setEditableScript] = useState(script || "");
  const [isEditingScript, setIsEditingScript] = useState(false);

  // Sync script changes
  React.useEffect(() => {
    if (script) setEditableScript(script);
  }, [script]);

  // Local transform buffer
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

  const handleApplyTransform = (
    nextLoc = loc,
    nextRot = rot,
    nextScl = scl
  ) => {
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

  const handleCopyStandaloneHtml = () => {
    const fullUrl = assetUrl
      ? (assetUrl.startsWith("http") ? assetUrl : `http://localhost:8080${assetUrl}`)
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

  const tabs: { id: NPanelTab; label: string; icon: React.ReactNode; tooltip: string }[] = [
    { id: "item", label: "Item", icon: <Sliders className="w-3.5 h-3.5" />, tooltip: "Item Properties & Transform" },
    { id: "outliner", label: "Outliner", icon: <Layers className="w-3.5 h-3.5" />, tooltip: "Scene Hierarchy & Mesh List" },
    { id: "modifiers", label: "Modifiers", icon: <Wrench className="w-3.5 h-3.5" />, tooltip: "Topology Modifiers (Decimate/Subdivide)" },
    { id: "material", label: "Material", icon: <Palette className="w-3.5 h-3.5" />, tooltip: "Material Color & PBR Shading" },
    { id: "script", label: "Script", icon: <Code2 className="w-3.5 h-3.5" />, tooltip: "Blender Python bpy & Code Execution" },
  ];

  return (
    <div className="flex h-full pointer-events-auto select-none">
      {/* 1. Blender Collapsible Drawer Body (280px) */}
      {isOpen && (
        <aside className="w-[280px] bg-[#18181b]/95 backdrop-blur-md border-l border-[#27272a] shadow-2xl flex flex-col h-full overflow-hidden text-xs text-[#f4f4f5] animate-in slide-in-from-right-2 duration-150">
          {/* Header */}
          <div className="h-8 shrink-0 flex items-center justify-between px-3 border-b border-[#27272a] bg-[#141416]/90">
            <div className="flex items-center space-x-1.5 font-mono text-[11px] text-[#f4f4f5] uppercase font-bold tracking-wider">
              {tabs.find((t) => t.id === activeTab)?.icon}
              <span>{tabs.find((t) => t.id === activeTab)?.label}</span>
            </div>
            <button
              type="button"
              onClick={onToggleOpen}
              title="Close N-Panel (N)"
              className="p-1 hover:bg-[#27272a] text-[#71717a] hover:text-[#f4f4f5] rounded transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content Pane */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
            {/* TAB 1: ITEM / TRANSFORM */}
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

                {/* Transform Location */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#a1a1aa] uppercase tracking-wider">
                    <span>Location</span>
                    <button
                      type="button"
                      onClick={() => handleApplyTransform({ x: 0, y: 0, z: 0 })}
                      className="hover:text-[#ea580c] text-[9px] flex items-center space-x-0.5"
                      title="Reset Location to [0, 0, 0]"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>0</span>
                    </button>
                  </div>
                  <div className="space-y-1 font-mono text-[11px]">
                    {(["x", "y", "z"] as const).map((axis) => (
                      <div key={axis} className="flex items-center bg-[#141416] border border-[#27272a] rounded overflow-hidden">
                        <span className={`w-6 text-center font-bold text-[10px] uppercase py-1 ${
                          axis === "x" ? "bg-red-500/20 text-red-400" : axis === "y" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
                        }`}>
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

                {/* Transform Rotation */}
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
                      <div key={axis} className="flex items-center bg-[#141416] border border-[#27272a] rounded overflow-hidden">
                        <span className={`w-6 text-center font-bold text-[10px] uppercase py-1 ${
                          axis === "x" ? "bg-red-500/20 text-red-400" : axis === "y" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
                        }`}>
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

                {/* Transform Scale */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#a1a1aa] uppercase tracking-wider">
                    <span className="flex items-center space-x-1">
                      <span>Scale</span>
                      <button
                        type="button"
                        onClick={() => setLockScale(!lockScale)}
                        className={`text-[9px] px-1 rounded ${lockScale ? "bg-[#ea580c]/20 text-[#ea580c]" : "text-[#71717a]"}`}
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
                      <div key={axis} className="flex items-center bg-[#141416] border border-[#27272a] rounded overflow-hidden">
                        <span className={`w-6 text-center font-bold text-[10px] uppercase py-1 ${
                          axis === "x" ? "bg-red-500/20 text-red-400" : axis === "y" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
                        }`}>
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

                {/* Quick CAD Snapping Actions */}
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

            {/* TAB 2: SCENE OUTLINER */}
            {activeTab === "outliner" && (
              <div className="space-y-3">
                {/* Search / Filter */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-[#71717a]" />
                  <input
                    type="text"
                    value={outlinerFilter}
                    onChange={(e) => setOutlinerFilter(e.target.value)}
                    placeholder="Search meshes in hierarchy..."
                    className="w-full bg-[#141416] border border-[#27272a] rounded pl-7 pr-2 py-1 text-[11px] font-mono text-[#f4f4f5] placeholder-[#52525b] focus:outline-none focus:border-[#ea580c]"
                  />
                </div>

                {/* Mesh Count Summary */}
                <div className="flex items-center justify-between text-[10px] font-mono text-[#71717a]">
                  <span>Total Meshes: {meshList.length}</span>
                  <span>{meshList.reduce((acc, m) => acc + (m.triangles || 0), 0).toLocaleString()} Tris</span>
                </div>

                {/* Mesh Hierarchy List */}
                <div className="space-y-1 max-h-[460px] overflow-y-auto custom-scrollbar">
                  {meshList
                    .filter((m) => m.name.toLowerCase().includes(outlinerFilter.toLowerCase()))
                    .map((mesh) => {
                      const isSelected = selectedMeshName === mesh.name;
                      const isLocked = lockedMeshes.has(mesh.name);
                      const isVisible = mesh.visible !== false;

                      return (
                        <div
                          key={mesh.id}
                          className={`flex items-center justify-between px-2 py-1.5 rounded font-mono text-[11px] border transition-colors ${
                            isSelected
                              ? "bg-[#ea580c]/15 border-[#ea580c] text-white"
                              : "bg-[#141416] border-[#27272a] hover:bg-[#202024] text-[#a1a1aa]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectMesh(isSelected ? null : mesh.name)}
                            className="flex-1 flex items-center space-x-1.5 text-left truncate min-w-0"
                          >
                            <Box className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-[#ea580c]" : "text-[#71717a]"}`} />
                            <span className="truncate font-semibold">{mesh.name}</span>
                          </button>

                          <div className="flex items-center space-x-2 shrink-0 ml-2">
                            <span className="text-[9px] text-[#52525b]">{mesh.triangles}t</span>
                            <button
                              type="button"
                              onClick={() => onToggleMeshVisibility(mesh.name)}
                              className={`p-0.5 hover:text-white transition-colors ${isVisible ? "text-[#71717a]" : "text-red-400"}`}
                              title={isVisible ? "Hide Mesh" : "Show Mesh"}
                            >
                              {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleMeshLock(mesh.name)}
                              className={`p-0.5 hover:text-white transition-colors ${isLocked ? "text-amber-400" : "text-[#71717a]"}`}
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
                      No mesh geometry currently loaded in scene.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: TOPOLOGY MODIFIERS */}
            {activeTab === "modifiers" && (
              <div className="space-y-4">
                {/* Decimate / Simplify Modifier */}
                <div className="p-3 bg-[#202024] border border-[#27272a] rounded space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold text-[#f4f4f5]">Decimate / Simplify</span>
                    <span className="font-mono text-[10px] text-[#ea580c]">
                      {Math.round(simplifyRatio * 100)}% Poly
                    </span>
                  </div>
                  <p className="text-[10px] text-[#71717a]">
                    Reduce polygon count dynamically while preserving silhouette edge flow.
                  </p>
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
                    <span>10% (Low-Poly)</span>
                    <span>100% (Original)</span>
                  </div>
                </div>

                {/* Subdivide Surface */}
                <div className="p-3 bg-[#202024] border border-[#27272a] rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold text-[#f4f4f5]">Subdivision Surface</span>
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <p className="text-[10px] text-[#71717a]">
                    Subdivide polygon faces to create ultra-smooth curvature.
                  </p>
                  <button
                    type="button"
                    onClick={onSubdivide}
                    className="w-full py-1.5 bg-[#141416] hover:bg-[#27272a] border border-[#27272a] rounded font-mono text-[10px] text-[#f4f4f5] flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <Plus className="w-3 h-3 text-[#ea580c]" />
                    <span>Subdivide Mesh (Loop Split)</span>
                  </button>
                </div>

                {/* Wireframe Overlay */}
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

            {/* TAB 4: MATERIAL & PBR SHADING */}
            {activeTab === "material" && (
              <div className="space-y-4">
                {/* 1-Click Material Presets */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase text-[#71717a] tracking-wider">
                    Preset Swatches
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
                        title={`${swatch.name} (Rough: ${swatch.roughness}, Metal: ${swatch.metalness})`}
                      >
                        <div className={`w-5 h-5 rounded-full ${swatch.bgClass} mb-1 shadow-inner`} />
                        <span className="text-[8px] font-mono text-[#a1a1aa] truncate max-w-full group-hover:text-white">
                          {swatch.name.split(" ")[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Base Color Picker */}
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

                {/* Roughness Slider */}
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
                  <div className="flex justify-between text-[8px] font-mono text-[#52525b]">
                    <span>0.0 (Glossy / Mirror)</span>
                    <span>1.0 (Matte / Chalk)</span>
                  </div>
                </div>

                {/* Metalness Slider */}
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
                  <div className="flex justify-between text-[8px] font-mono text-[#52525b]">
                    <span>0.0 (Dielectric / Plastic)</span>
                    <span>1.0 (Pure Conductor)</span>
                  </div>
                </div>

                {/* Transmission (Glass) */}
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

            {/* TAB 5: SCRIPT & STANDALONE HTML EXPORT */}
            {activeTab === "script" && (
              <div className="space-y-3">
                {/* Top Actions: Run, Copy HTML, Copy Script */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onExecuteScript && onExecuteScript(editableScript)}
                    disabled={isLoading || !editableScript.trim()}
                    className="px-2 py-1.5 bg-[#ea580c] hover:bg-[#f97316] disabled:opacity-50 text-white rounded font-mono text-[10px] font-bold flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Run bpy</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyStandaloneHtml}
                    className="px-2 py-1.5 bg-[#202024] hover:bg-[#27272a] border border-[#27272a] rounded font-mono text-[10px] text-[#f4f4f5] flex items-center justify-center space-x-1.5 transition-colors"
                    title="1-Click Standalone Three.js HTML Export"
                  >
                    {copiedHtml ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHtml ? "Copied HTML!" : "Copy HTML"}</span>
                  </button>
                </div>

                {/* Script Code Block */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#71717a]">
                    <span>Blender Python Script</span>
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
                    rows={12}
                    className="w-full bg-[#141416] border border-[#27272a] rounded p-2 font-mono text-[10px] text-[#e4e4e7] leading-relaxed resize-none focus:outline-none focus:border-[#ea580c] custom-scrollbar"
                    placeholder="# Standard bpy script..."
                  />
                </div>

                {/* Execution Telemetry Logs */}
                {(stdout || stderr) && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase text-[#71717a]">
                      Execution Logs
                    </span>
                    <div className="bg-[#141416] border border-[#27272a] rounded p-2 max-h-32 overflow-y-auto font-mono text-[9px] custom-scrollbar">
                      {stdout && <div className="text-emerald-400 whitespace-pre-wrap">{stdout}</div>}
                      {stderr && <div className="text-red-400 whitespace-pre-wrap mt-1">{stderr}</div>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* 2. Blender Iconic Tab Selector Strip (Edge of N-Panel) */}
      <div className="w-8 bg-[#141416] border-l border-[#27272a] flex flex-col items-center py-2 space-y-1 shrink-0 z-20">
        {tabs.map((tab) => {
          const isActive = isOpen && activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (!isOpen) {
                  setActiveTab(tab.id);
                  onToggleOpen();
                } else if (activeTab === tab.id) {
                  onToggleOpen(); // Toggle closed if clicking same active tab
                } else {
                  setActiveTab(tab.id);
                }
              }}
              title={`${tab.tooltip} (N)`}
              className={`w-7 h-7 flex items-center justify-center rounded transition-all ${
                isActive
                  ? "bg-[#ea580c] text-white shadow-sm"
                  : "text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#202024]"
              }`}
            >
              {tab.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}
