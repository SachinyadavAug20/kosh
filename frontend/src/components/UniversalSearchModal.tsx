"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  Box,
  Layers,
  Wand2,
  Sliders,
  Scissors,
  Download,
  Eye,
  Camera,
  RotateCcw,
  Sparkles,
  Command,
  ArrowRight,
  Check,
  X,
  FileCode,
  ShieldCheck,
  Minimize2,
  Maximize2,
  Compass,
  Palette,
  Pencil,
} from "lucide-react";

export interface UniversalSearchItem {
  id: string;
  title: string;
  category: "model" | "tool" | "scene_object" | "action";
  subtitle: string;
  shortcut?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssemblePrompt?: (prompt: string) => void;
  onSelectMesh?: (meshName: string) => void;
  onExecuteTool?: (toolName: string, args: Record<string, unknown>) => void;
  onToggleWireframe?: () => void;
  onPlaceOnFloor?: () => void;
  onCenterOrigin?: () => void;
  onResetRotation?: () => void;
  onToggleOrtho?: () => void;
  onExport?: (format: "glb" | "stl" | "obj") => void;
  meshList?: Array<{ name: string; triangles?: number; vertices?: number }>;
  selectedMeshName?: string | null;
  onOpenSketchModal?: () => void;
}

export const POPULAR_PIECE_PRESETS = [
  { name: "Astronaut Explorer", query: "A low-poly astronaut standing in space suit with helmet and visor" },
  { name: "Moon Surface", query: "Cratered lunar surface terrain base" },
  { name: "Acoustic Guitar", query: "Acoustic guitar with soundboard, fretboard and tuning pegs" },
  { name: "Man on Moon with Guitar", query: "A man on the moon with guitar" },
  { name: "Cyberpunk Sports Car", query: "A low-poly cyberpunk sports car with spoiler and neon headlights" },
  { name: "Humanoid Robot Warrior", query: "Humanoid combat robot with articulated metal limbs and sword" },
  { name: "Tavern Dining Table", query: "Medieval wooden tavern table with candle and beer mug" },
  { name: "Pine Tree Forest", query: "Lush evergreen pine tree with tiered foliage" },
  { name: "Granite Boulder", query: "Rugged granite rock boulder with faceted displacements" },
  { name: "Turbine Flange Base", query: "Precision mechanical turbine base flange with bolt circle holes" },
];

export function UniversalSearchModal({
  isOpen,
  onClose,
  onAssemblePrompt,
  onSelectMesh,
  onExecuteTool,
  onToggleWireframe,
  onPlaceOnFloor,
  onCenterOrigin,
  onResetRotation,
  onToggleOrtho,
  onExport,
  meshList = [],
  selectedMeshName,
  onOpenSketchModal,
}: UniversalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Construct search items
  const items = useMemo<UniversalSearchItem[]>(() => {
    const list: UniversalSearchItem[] = [];

    // 1. Scene Objects in Hierarchy
    meshList.forEach((mesh) => {
      const isSelected = selectedMeshName === mesh.name;
      list.push({
        id: `mesh_${mesh.name}`,
        title: mesh.name,
        category: "scene_object",
        subtitle: `Scene Object (${mesh.triangles?.toLocaleString() || 0} tris)${isSelected ? " - Active Selection" : ""}`,
        icon: <Layers className="w-4 h-4 text-[#ea580c]" />,
        onSelect: () => {
          onSelectMesh?.(mesh.name);
          onClose();
        },
      });
    });

    // 2. Preset 3D Models & Piece Assemblies
    POPULAR_PIECE_PRESETS.forEach((preset) => {
      list.push({
        id: `preset_${preset.name}`,
        title: preset.name,
        category: "model",
        subtitle: `Downloadable / Procedural 3D Piece ("${preset.query}")`,
        icon: <Box className="w-4 h-4 text-emerald-400" />,
        onSelect: () => {
          onAssemblePrompt?.(preset.query);
          onClose();
        },
      });
    });

    // 3. MCP CAD Tools & Operations
    const cadOperations = [
      { name: "Check Watertight / Manifold", tool: "cad_check_manifold", desc: "Non-manifold edge audit & topological watertight inspection" },
      { name: "Apply Bevel / Fillet", tool: "cad_apply_fillet_chamfer", desc: "Chamfer sharp CAD edges with rounding curvature" },
      { name: "CSG Boolean Difference", tool: "cad_boolean_operation", desc: "Subtract secondary tool cutter from primary solid" },
      { name: "Digital Caliper Measurement", tool: "cad_measure_dimensions", desc: "Compute exact bounding dimensions, surface area, and volume" },
      { name: "Apply PBR Titanium Material", tool: "cad_apply_pbr_preset", desc: "Assign matte titanium aerospace PBR shader" },
      { name: "Linear Array Pattern", tool: "cad_linear_array", desc: "Multiply geometry along X/Y/Z coordinate offsets" },
      { name: "Radial Array Pattern", tool: "cad_radial_array", desc: "Circular polar duplication around rotation axis" },
      { name: "ISO Metric Screw Threads", tool: "cad_generate_threads", desc: "Generate standard ISO metric helical pitch threads" },
      { name: "Hollow Shell & Wall Thickness", tool: "cad_hollow_shell", desc: "Hollow interior with 2.0mm calibrated wall thickness" },
      { name: "Convex Bounding Hull", tool: "cad_convex_hull", desc: "Compute minimum enclosing convex collision geometry" },
      { name: "Transform / Move / Scale Part", tool: "cad_transform_part", desc: "Surgical translation, rotation, and scaling of selected part" },
      { name: "Bisect / Slice Cutaway", tool: "cad_bisect_slice", desc: "Planar bisection cut across XY, XZ, or YZ with manifold cap fill" },
      { name: "Recolor Part / Material", tool: "cad_recolor_part", desc: "Targeted PBR color, roughness, and metalness modification" },
      { name: "Voxel Watertight Remesh", tool: "cad_voxel_remesh", desc: "Fuse intersecting components into a single watertight OpenVDB solid" },
      { name: "Mirror Symmetry Seam Weld", tool: "cad_mirror_symmetry", desc: "Bilateral symmetry across coordinate plane with seam welding" },
      { name: "Decimate / Simplify Mesh", tool: "cad_decimate_mesh", desc: "Intelligent polycount reduction preserving sharp CAD boundaries" },
      { name: "Nonlinear Deform / Taper / Twist", tool: "cad_deform_taper_twist", desc: "Parametric spatial deformation (taper, twist, bend, stretch)" },
      { name: "Subdivide & Smooth", tool: "cad_subdivide_smooth", desc: "Catmull-Clark surface smoothing with auto-smooth normal preservation" },
      { name: "Delete Submesh / Loose Parts", tool: "cad_delete_submesh", desc: "Excise unwanted components, stands, or loose floating vertices" },
      { name: "Extrude Face Region", tool: "cad_extrude_face_region", desc: "Push-pull normal extrusion for bosses, recesses, or flanges" },
      { name: "Align & Snap Objects", tool: "cad_align_snap_objects", desc: "Precision 3D datum snapping and multi-part bounding box alignment" },
      { name: "Weld Vertices & Close Seams", tool: "cad_weld_vertices", desc: "Distance-based vertex deduplication to close cracks and seal manifolds" },
      { name: "Recalculate / Repair Normals", tool: "cad_flip_recalculate_normals", desc: "Fix inverted polygon face orientations and outward normal vectors" },
      { name: "Cap Open Holes (Watertight)", tool: "cad_fill_holes", desc: "Automatically detect and cap open perimeter boundary hole loops" },
      { name: "Metric Scale to Bounding Box", tool: "cad_scale_to_bounding_box", desc: "Calibrate part to exact real-world dimensions in millimeters" },
      { name: "Loft Surface Curves", tool: "cad_loft_curves", desc: "Parametric cross-section profile skinning and ruled loft transitions" },
      { name: "Generate Compression Spring", tool: "cad_generate_helical_spring", desc: "Parametric coil spring with calibrated wire gauge, pitch, and turns" },
      { name: "Carve O-Ring Seal Groove", tool: "cad_generate_o_ring_groove", desc: "Precision pressure/fluid sealing gland channel on shaft or cylinder" },
      { name: "Split Loose Components", tool: "cad_split_into_components", desc: "Separate disconnected mesh islands into independent child objects" },
      { name: "Exploded Assembly View", tool: "cad_explode_assembly_view", desc: "Radiate all scene components outward from assembly center of mass" },
    ];

    cadOperations.forEach((op) => {
      list.push({
        id: `tool_${op.tool}`,
        title: op.name,
        category: "tool",
        subtitle: op.desc,
        icon: <Wand2 className="w-4 h-4 text-sky-400" />,
        onSelect: () => {
          onExecuteTool?.(op.tool, {});
          onClose();
        },
      });
    });

    // 4. Viewport Actions & Quick Align
    list.push({
      id: "act_sketch_to_3d",
      title: "Hand-Drawn Sketch to 3D Model",
      category: "action",
      subtitle: "Draw on canvas or upload image to reconstruct watertight 3D CAD solid",
      shortcut: "Alt+S",
      icon: <Pencil className="w-4 h-4 text-[#ea580c]" />,
      onSelect: () => {
        onOpenSketchModal?.();
        onClose();
      },
    });

    list.push({
      id: "act_drop_floor",
      title: "Drop to Floor (Ground Plane Y=0)",
      category: "action",
      subtitle: "Align lowest vertex of selected mesh directly to ground datum",
      shortcut: "End",
      icon: <Minimize2 className="w-4 h-4 text-[#ea580c]" />,
      onSelect: () => {
        onPlaceOnFloor?.();
        onClose();
      },
    });

    list.push({
      id: "act_center_origin",
      title: "Center to Origin",
      category: "action",
      subtitle: "Move active object center to world (0, 0, 0)",
      icon: <Compass className="w-4 h-4 text-violet-400" />,
      onSelect: () => {
        onCenterOrigin?.();
        onClose();
      },
    });

    list.push({
      id: "act_toggle_wireframe",
      title: "Toggle Wireframe Shading",
      category: "action",
      subtitle: "Switch between Solid PBR and Wireframe mesh topology",
      shortcut: "Shift + Z",
      icon: <Eye className="w-4 h-4 text-amber-400" />,
      onSelect: () => {
        onToggleWireframe?.();
        onClose();
      },
    });

    list.push({
      id: "act_toggle_ortho",
      title: "Toggle Perspective / Orthographic View",
      category: "action",
      subtitle: "Switch between cinematic perspective and isometric CAD alignment",
      shortcut: "Numpad 5",
      icon: <Compass className="w-4 h-4 text-emerald-400" />,
      onSelect: () => {
        onToggleOrtho?.();
        onClose();
      },
    });

    list.push({
      id: "act_export_glb",
      title: "Export Binary GLTF (.GLB)",
      category: "action",
      subtitle: "Export full multi-object scene as self-contained .glb",
      shortcut: "Ctrl + E",
      icon: <Download className="w-4 h-4 text-blue-400" />,
      onSelect: () => {
        onExport?.("glb");
        onClose();
      },
    });

    list.push({
      id: "act_export_stl",
      title: "Export 3D Print Mesh (.STL)",
      category: "action",
      subtitle: "Generate triangulated binary stereolithography mesh for slicers",
      icon: <Download className="w-4 h-4 text-emerald-400" />,
      onSelect: () => {
        onExport?.("stl");
        onClose();
      },
    });

    return list;
  }, [
    meshList,
    selectedMeshName,
    onSelectMesh,
    onClose,
    onAssemblePrompt,
    onExecuteTool,
    onPlaceOnFloor,
    onCenterOrigin,
    onToggleWireframe,
    onToggleOrtho,
    onExport,
  ]);

  // Filter items matching query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems.length > 0 && selectedIndex < filteredItems.length) {
        filteredItems[selectedIndex].onSelect();
      } else if (query.trim()) {
        // If query has no direct match, execute query as assembly prompt directly!
        onAssemblePrompt?.(query.trim());
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#141416] border border-[#27272a] shadow-2xl rounded-md overflow-hidden font-mono text-xs flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Top Search Input Bar */}
        <div className="flex items-center px-3.5 py-3 border-b border-[#27272a] bg-[#18181b]/80 space-x-2.5">
          <Search className="w-4 h-4 text-[#ea580c] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models, pieces, tools, hierarchy, or describe a scene to assemble..."
            className="flex-1 bg-transparent text-[#f4f4f5] placeholder-[#71717a] text-xs focus:outline-none"
          />
          <div className="flex items-center space-x-1 text-[10px] text-[#71717a] border border-[#27272a] px-1.5 py-0.5 rounded">
            <span>Esc</span>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#18181b] border-b border-[#202024] text-[10px] text-[#71717a] overflow-x-auto">
          <span className="uppercase font-bold tracking-wider text-[#a1a1aa]">Filter:</span>
          {(["all", "model", "tool", "scene_object", "action"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                if (cat === "all") setQuery("");
                else setQuery(cat);
              }}
              className="px-2 py-0.5 rounded bg-[#202024] hover:bg-[#27272a] hover:text-[#f4f4f5] transition-colors capitalize"
            >
              {cat.replace("_", " ")}
            </button>
          ))}
          <span className="ml-auto text-[9px] text-[#71717a]">
            {filteredItems.length} results
          </span>
        </div>

        {/* Results Scroll Area */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-[#71717a] space-y-2">
              <Command className="w-6 h-6 mx-auto text-[#52525b] animate-pulse" />
              <p className="text-xs">No exact matches for &quot;{query}&quot;</p>
              <button
                type="button"
                onClick={() => {
                  onAssemblePrompt?.(query.trim());
                  onClose();
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded text-xs transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Search Online & Assemble &quot;{query}&quot;</span>
              </button>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.onSelect}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-sm cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[#27272a] border border-[#ea580c]/50 text-[#f4f4f5]"
                      : "hover:bg-[#1f1f23] text-[#a1a1aa] border border-transparent"
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div className="shrink-0">{item.icon}</div>
                    <div className="truncate">
                      <div className={`font-semibold truncate ${isSelected ? "text-white" : "text-[#f4f4f5]"}`}>
                        {item.title}
                      </div>
                      <div className="text-[10px] text-[#71717a] truncate">{item.subtitle}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 ml-3">
                    <span className="text-[9px] uppercase px-1.5 py-0.2 border border-[#3f3f46] rounded text-[#71717a]">
                      {item.category.replace("_", " ")}
                    </span>
                    {item.shortcut && (
                      <span className="text-[10px] font-mono text-[#a1a1aa] bg-[#202024] px-1.5 py-0.5 rounded border border-[#27272a]">
                        {item.shortcut}
                      </span>
                    )}
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-[#ea580c]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-3 py-2 bg-[#18181b] border-t border-[#27272a] flex items-center justify-between text-[10px] text-[#71717a]">
          <div className="flex items-center space-x-3">
            <span>
              <kbd className="px-1 py-0.5 bg-[#202024] border border-[#27272a] rounded text-[#a1a1aa]">Up</kbd>{" "}
              <kbd className="px-1 py-0.5 bg-[#202024] border border-[#27272a] rounded text-[#a1a1aa]">Down</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-[#202024] border border-[#27272a] rounded text-[#a1a1aa]">Enter</kbd> Select / Assemble
            </span>
          </div>
          <div className="text-[#a1a1aa]">
            Universal Search: <span className="text-[#ea580c]">Ctrl + K</span>
          </div>
        </div>
      </div>
    </div>
  );
}
