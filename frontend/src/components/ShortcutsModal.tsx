"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  X,
  Keyboard,
  Compass,
  Move,
  Layers,
  Palette,
  Eye,
  Sliders,
  HelpCircle,
} from "lucide-react";

interface ShortcutItem {
  keys: string[];
  title: string;
  description: string;
  category: "Transform & Snapping" | "View & Navigation" | "Shading & Visibility" | "Selection & Hierarchy" | "Panels & UI";
}

const SHORTCUTS: ShortcutItem[] = [
  // Transform & Snapping
  {
    keys: ["G"],
    title: "Grab / Translate",
    description: "Move selected sub-mesh in 3D viewport",
    category: "Transform & Snapping",
  },
  {
    keys: ["R"],
    title: "Rotate",
    description: "Rotate selected mesh around view or locked axis",
    category: "Transform & Snapping",
  },
  {
    keys: ["R", "R"],
    title: "Trackball Rotate",
    description: "Double-tap R for free spherical trackball rotation",
    category: "Transform & Snapping",
  },
  {
    keys: ["S"],
    title: "Scale",
    description: "Resize selected sub-mesh uniformly or along axis",
    category: "Transform & Snapping",
  },
  {
    keys: ["X", "Y", "Z"],
    title: "Lock to Axis",
    description: "Constrain active transform strictly to Global X, Y, or Z",
    category: "Transform & Snapping",
  },
  {
    keys: ["Shift", "+", "X/Y/Z"],
    title: "Planar Transform",
    description: "Exclude chosen axis and move within the remaining 2D plane",
    category: "Transform & Snapping",
  },
  {
    keys: ["Ctrl", "(Hold)"],
    title: "Toggle Snap on the Fly",
    description: "Inverts current snapping state during any active transform",
    category: "Transform & Snapping",
  },
  {
    keys: ["Shift", "(Hold)"],
    title: "Precision Mode",
    description: "Slows mouse delta sensitivity 10x for ultra-fine adjustments",
    category: "Transform & Snapping",
  },
  {
    keys: ["Ctrl", "+", "Shift"],
    title: "Precision Snap",
    description: "Snaps in ultra-fine increments (1° angle or 0.01m unit)",
    category: "Transform & Snapping",
  },
  {
    keys: ["Shift", "+", "Tab"],
    title: "Snap Settings Menu",
    description: "Open magnet snap popover to configure units and targets",
    category: "Transform & Snapping",
  },
  {
    keys: ["LMB", "or", "Enter"],
    title: "Confirm Transform",
    description: "Apply transformation and finalize mesh position",
    category: "Transform & Snapping",
  },
  {
    keys: ["RMB", "or", "Esc"],
    title: "Cancel Transform",
    description: "Revert mesh position, rotation, and scale to pre-transform state",
    category: "Transform & Snapping",
  },

  // View & Navigation
  {
    keys: ["Num 1", "or", "1"],
    title: "Front View",
    description: "Align camera to front orthographic/perspective plane",
    category: "View & Navigation",
  },
  {
    keys: ["Ctrl", "+", "1"],
    title: "Back View",
    description: "Align camera to rear view plane",
    category: "View & Navigation",
  },
  {
    keys: ["Num 3", "or", "3"],
    title: "Right View",
    description: "Align camera to right side profile",
    category: "View & Navigation",
  },
  {
    keys: ["Ctrl", "+", "3"],
    title: "Left View",
    description: "Align camera to left side profile",
    category: "View & Navigation",
  },
  {
    keys: ["Num 7", "or", "7"],
    title: "Top View",
    description: "Align camera to direct top overhead plan",
    category: "View & Navigation",
  },
  {
    keys: ["Ctrl", "+", "7"],
    title: "Bottom View",
    description: "Align camera to bottom underside plan",
    category: "View & Navigation",
  },
  {
    keys: ["Num 5", "or", "5"],
    title: "Persp / Ortho",
    description: "Toggle between Perspective and Orthographic camera projection",
    category: "View & Navigation",
  },
  {
    keys: ["Num .", "or", "F"],
    title: "Frame Selected",
    description: "Center and zoom camera view onto selected sub-mesh",
    category: "View & Navigation",
  },
  {
    keys: ["Num 0", "or", "0"],
    title: "Default Camera",
    description: "Reset camera to standard 3/4 isometric viewpoint",
    category: "View & Navigation",
  },

  // Shading & Visibility
  {
    keys: ["Z"],
    title: "Shading Pie Menu",
    description: "Open 4-way radial pie for Wireframe, Solid, Material, Render",
    category: "Shading & Visibility",
  },
  {
    keys: ["Alt", "+", "Z"],
    title: "Toggle X-Ray",
    description: "Enable 50% transparency wire-through for interior geometry",
    category: "Shading & Visibility",
  },
  {
    keys: ["Shift", "+", "Z"],
    title: "Toggle Wireframe / Solid",
    description: "Quick toggle between solid shaded mode and wireframe overlay",
    category: "Shading & Visibility",
  },
  {
    keys: ["Alt", "+", "L"],
    title: "Toggle CAD Inspection Headlamp",
    description: "Camera-locked inspection light to clearly illuminate cavities and surface normals",
    category: "Shading & Visibility",
  },
  {
    keys: ["H"],
    title: "Hide Mesh",
    description: "Conceal the currently selected sub-mesh from view",
    category: "Shading & Visibility",
  },
  {
    keys: ["Alt", "+", "H"],
    title: "Unhide All",
    description: "Reveal all previously hidden meshes in scene",
    category: "Shading & Visibility",
  },
  {
    keys: ["Shift", "+", "H"],
    title: "Isolate Selected",
    description: "Hide all other meshes, isolating only the active selection",
    category: "Shading & Visibility",
  },

  // Selection & Hierarchy
  {
    keys: ["A"],
    title: "Select All",
    description: "Select all objects and meshes in the scene",
    category: "Selection & Hierarchy",
  },
  {
    keys: ["Alt", "+", "A"],
    title: "Deselect All",
    description: "Clear active mesh selection (or double-tap A)",
    category: "Selection & Hierarchy",
  },
  {
    keys: ["Ctrl", "+", "LMB"],
    title: "Toggle Multi-Select",
    description: "Add or remove individual objects from the active selection set",
    category: "Selection & Hierarchy",
  },
  {
    keys: ["B"],
    title: "Box Select",
    description: "Drag a rectangular marquee to select multiple meshes (Shift to add, Alt to subtract)",
    category: "Selection & Hierarchy",
  },
  {
    keys: ["C"],
    title: "Circle / Brush Select",
    description: "Paint over objects with a brush to select them (Scroll or [ / ] to resize)",
    category: "Selection & Hierarchy",
  },
  {
    keys: ["W"],
    title: "Cycle Selection Tool",
    description: "Toggle between Tweak, Box Select, Circle Select, and Lasso Select",
    category: "Selection & Hierarchy",
  },
  {
    keys: ["Ctrl", "+", "I"],
    title: "Invert Selection",
    description: "Invert current selection across all objects in the scene",
    category: "Selection & Hierarchy",
  },
  {
    keys: ["Shift", "+", "D"],
    title: "Duplicate Objects",
    description: "Clone all selected meshes into new independent instances",
    category: "Selection & Hierarchy",
  },
  {
    keys: ["X", "or", "Del"],
    title: "Delete Objects",
    description: "Delete all currently selected meshes from the 3D scene",
    category: "Selection & Hierarchy",
  },

  // Panels & UI
  {
    keys: ["T"],
    title: "Toggle Left Toolbar",
    description: "Collapse or expand left Generator & Parameters dock",
    category: "Panels & UI",
  },
  {
    keys: ["N"],
    title: "Toggle Right Sidebar",
    description: "Collapse or expand right Outliner & Code Inspector",
    category: "Panels & UI",
  },
  {
    keys: ["F1", "or", "?"],
    title: "Shortcuts Cheat Sheet",
    description: "Open this interactive Blender hotkey reference modal",
    category: "Panels & UI",
  },
  {
    keys: ["Space"],
    title: "Play / Pause Animation",
    description: "Toggle timeline scrubber and procedural turntable playback",
    category: "Panels & UI",
  },
];

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("All");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const categories = ["All", "Transform & Snapping", "View & Navigation", "Shading & Visibility", "Selection & Hierarchy", "Panels & UI"];

  const filteredShortcuts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SHORTCUTS.filter((item) => {
      const matchCat = selectedCat === "All" || item.category === selectedCat;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keys.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [search, selectedCat]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-3xl max-h-[85vh] bg-[#18181b] border border-[#3f3f46] rounded-sm flex flex-col shadow-2xl text-[#f4f4f5] font-sans overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Strip */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#1f1f23] border-b border-[#3f3f46]">
          <div className="flex items-center space-x-2">
            <Keyboard className="w-4 h-4 text-[#ea580c]" />
            <span className="font-semibold text-xs tracking-tight uppercase">Blender Standard Keyboard Cheat Sheet</span>
            <span className="text-[10px] font-mono text-[#71717a] px-1.5 py-0.5 bg-[#18181b] border border-[#3f3f46] rounded-sm">
              DCC Native Keymap
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 hover:bg-[#27272a] rounded-sm text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="p-3 bg-[#18181b] border-b border-[#3f3f46] space-y-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#71717a]" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shortcuts... e.g. grab, snap, camera, ortho, axis"
              className="w-full bg-[#1f1f23] border border-[#3f3f46] focus:border-[#ea580c] focus:outline-none pl-8 pr-3 py-1.5 text-xs text-[#f4f4f5] font-mono rounded-sm placeholder-[#71717a]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 text-[10px] text-[#71717a] hover:text-[#f4f4f5]"
              >
                CLEAR
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1 overflow-x-auto pb-0.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(cat)}
                className={`px-2 py-0.5 text-[10px] rounded-sm border whitespace-nowrap transition-colors ${
                  selectedCat === cat
                    ? "bg-[#27272a] border-[#ea580c] text-[#f4f4f5] font-semibold"
                    : "bg-[#1f1f23] border-[#3f3f46] text-[#a1a1aa] hover:text-[#f4f4f5]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#141416]">
          {filteredShortcuts.length === 0 ? (
            <div className="text-center py-12 text-[#71717a] text-xs font-mono">
              No shortcuts found matching &quot;{search}&quot;
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredShortcuts.map((sc, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between p-2.5 bg-[#1f1f23] border border-[#3f3f46] hover:border-[#52525b] rounded-sm transition-colors space-x-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2 mb-0.5">
                      <span className="text-xs font-semibold text-[#f4f4f5] truncate">{sc.title}</span>
                      <span className="text-[9px] font-mono text-[#71717a] uppercase px-1 bg-[#18181b] border border-[#27272a] rounded-sm truncate">
                        {sc.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#a1a1aa] leading-tight">{sc.description}</p>
                  </div>

                  {/* Monospace Badge Keys */}
                  <div className="flex items-center space-x-1 shrink-0 pt-0.5">
                    {sc.keys.map((k, kIdx) =>
                      k === "+" || k === "or" ? (
                        <span key={kIdx} className="text-[10px] text-[#71717a] font-mono px-0.5">
                          {k}
                        </span>
                      ) : (
                        <kbd
                          key={kIdx}
                          className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#18181b] border border-[#52525b] text-[#f4f4f5] rounded-sm shadow-sm"
                        >
                          {k}
                        </kbd>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#1f1f23] border-t border-[#3f3f46] flex items-center justify-between text-[11px] text-[#71717a] font-mono">
          <span>{filteredShortcuts.length} Shortcuts Listed</span>
          <span>Press ESC or F1 to dismiss</span>
        </div>
      </div>
    </div>
  );
}
