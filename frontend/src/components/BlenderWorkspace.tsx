"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Layers,
  Sliders,
  Code2,
  Film,
  Columns,
  Rows,
  Maximize2,
  Minimize2,
  X,
  ChevronDown,
  Plus,
  Play,
  Check,
  FolderOpen,
  Eye,
  Camera,
  RotateCcw,
  Sparkles,
} from "lucide-react";

export type EditorType = "viewport" | "timeline" | "outliner" | "properties" | "script";
export type SplitDirection = "horizontal" | "vertical"; // horizontal = left/right columns, vertical = top/bottom rows
export type WorkspacePreset = "default" | "animation" | "modeling" | "scripting";

export interface SplitNode {
  id: string;
  type: "split";
  direction: SplitDirection;
  ratio: number; // 0.1 to 0.9
  first: WorkspaceNode;
  second: WorkspaceNode;
}

export interface LeafNode {
  id: string;
  type: "leaf";
  editorType: EditorType;
  subView?: "persp" | "top" | "front" | "right";
  activeTab?: string;
}

export type WorkspaceNode = SplitNode | LeafNode;

const STORAGE_KEY = "kosh_blender_workspace_layout";

// Default Preset Layouts
export const PRESETS: Record<WorkspacePreset, WorkspaceNode> = {
  // 1. Default (Classic DCC Layout): Viewport + Outliner/Properties right + Bottom Timeline
  default: {
    id: "root_split_h",
    type: "split",
    direction: "horizontal",
    ratio: 0.76,
    first: {
      id: "split_vp_tl",
      type: "split",
      direction: "vertical",
      ratio: 0.82,
      first: {
        id: "leaf_viewport",
        type: "leaf",
        editorType: "viewport",
        subView: "persp",
      },
      second: {
        id: "leaf_timeline",
        type: "leaf",
        editorType: "timeline",
      },
    },
    second: {
      id: "split_out_prop",
      type: "split",
      direction: "vertical",
      ratio: 0.42,
      first: {
        id: "leaf_outliner",
        type: "leaf",
        editorType: "outliner",
      },
      second: {
        id: "leaf_properties",
        type: "leaf",
        editorType: "properties",
      },
    },
  },

  // 2. Animation Preset: Top Viewport + Bottom Tall Dope Sheet / Timeline
  animation: {
    id: "root_anim",
    type: "split",
    direction: "vertical",
    ratio: 0.6,
    first: {
      id: "split_anim_top",
      type: "split",
      direction: "horizontal",
      ratio: 0.8,
      first: {
        id: "leaf_viewport_anim",
        type: "leaf",
        editorType: "viewport",
        subView: "persp",
      },
      second: {
        id: "leaf_properties_anim",
        type: "leaf",
        editorType: "properties",
      },
    },
    second: {
      id: "leaf_timeline_anim",
      type: "leaf",
      editorType: "timeline",
    },
  },

  // 3. Modeling Preset: 4-Quadrant Ortho/Persp Split + Properties
  modeling: {
    id: "root_modeling",
    type: "split",
    direction: "horizontal",
    ratio: 0.76,
    first: {
      id: "split_quad_v",
      type: "split",
      direction: "vertical",
      ratio: 0.5,
      first: {
        id: "split_quad_top",
        type: "split",
        direction: "horizontal",
        ratio: 0.5,
        first: {
          id: "leaf_vp_top",
          type: "leaf",
          editorType: "viewport",
          subView: "top",
        },
        second: {
          id: "leaf_vp_persp",
          type: "leaf",
          editorType: "viewport",
          subView: "persp",
        },
      },
      second: {
        id: "split_quad_bot",
        type: "split",
        direction: "horizontal",
        ratio: 0.5,
        first: {
          id: "leaf_vp_front",
          type: "leaf",
          editorType: "viewport",
          subView: "front",
        },
        second: {
          id: "leaf_vp_right",
          type: "leaf",
          editorType: "viewport",
          subView: "right",
        },
      },
    },
    second: {
      id: "leaf_prop_model",
      type: "leaf",
      editorType: "properties",
    },
  },

  // 4. Scripting / MCP Preset: Viewport + Timeline Left, Full Height Python IDE Right
  scripting: {
    id: "root_script",
    type: "split",
    direction: "horizontal",
    ratio: 0.48,
    first: {
      id: "split_script_left",
      type: "split",
      direction: "vertical",
      ratio: 0.75,
      first: {
        id: "leaf_vp_script",
        type: "leaf",
        editorType: "viewport",
        subView: "persp",
      },
      second: {
        id: "leaf_tl_script",
        type: "leaf",
        editorType: "timeline",
      },
    },
    second: {
      id: "leaf_script_ide",
      type: "leaf",
      editorType: "script",
    },
  },
};

// Tree Helper: Deep Clone
function cloneTree(node: WorkspaceNode): WorkspaceNode {
  if (node.type === "leaf") {
    return { ...node };
  }
  return {
    ...node,
    first: cloneTree(node.first),
    second: cloneTree(node.second),
  };
}

// Tree Helper: Count leaves
function countLeaves(node: WorkspaceNode): number {
  if (node.type === "leaf") return 1;
  return countLeaves(node.first) + countLeaves(node.second);
}

// Tree Helper: Find & Replace
function updateNode(
  root: WorkspaceNode,
  targetId: string,
  transform: (node: WorkspaceNode) => WorkspaceNode
): WorkspaceNode {
  if (root.id === targetId) {
    return transform(root);
  }
  if (root.type === "split") {
    return {
      ...root,
      first: updateNode(root.first, targetId, transform),
      second: updateNode(root.second, targetId, transform),
    };
  }
  return root;
}

// Tree Helper: Close / Remove leaf (merges parent with sibling)
function removeLeaf(root: WorkspaceNode, targetLeafId: string): WorkspaceNode {
  if (root.type === "leaf") return root;

  if (root.first.id === targetLeafId) {
    return root.second;
  }
  if (root.second.id === targetLeafId) {
    return root.first;
  }

  return {
    ...root,
    first: removeLeaf(root.first, targetLeafId),
    second: removeLeaf(root.second, targetLeafId),
  };
}

// ----------------------------------------------------------------------
// Area Header Bar Props
// ----------------------------------------------------------------------
interface AreaHeaderProps {
  leaf: LeafNode;
  canClose: boolean;
  isMaximized: boolean;
  onSetEditorType: (leafId: string, editorType: EditorType) => void;
  onSplit: (leafId: string, direction: SplitDirection) => void;
  onMaximize: (leafId: string) => void;
  onClose: (leafId: string) => void;
  // Area menu callbacks
  onCameraPreset?: (view: "front" | "top" | "right" | "iso") => void;
  onAddPrimitive?: (type: string) => void;
  onFocus?: () => void;
  onRunScript?: () => void;
}

function AreaHeader({
  leaf,
  canClose,
  isMaximized,
  onSetEditorType,
  onSplit,
  onMaximize,
  onClose,
  onCameraPreset,
  onAddPrimitive,
  onFocus,
  onRunScript,
}: AreaHeaderProps) {
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const getEditorMeta = (t: EditorType) => {
    switch (t) {
      case "viewport":
        return { label: "3D Viewport", icon: <Box className="w-3.5 h-3.5 text-[#ea580c]" /> };
      case "timeline":
        return { label: "Timeline / Dope Sheet", icon: <Film className="w-3.5 h-3.5 text-amber-400" /> };
      case "outliner":
        return { label: "Outliner", icon: <Layers className="w-3.5 h-3.5 text-cyan-400" /> };
      case "properties":
        return { label: "Properties", icon: <Sliders className="w-3.5 h-3.5 text-emerald-400" /> };
      case "script":
        return { label: "Script / MCP Console", icon: <Code2 className="w-3.5 h-3.5 text-sky-400" /> };
    }
  };

  const currentMeta = getEditorMeta(leaf.editorType);

  return (
    <div className="h-7 px-2 flex items-center justify-between border-b border-[#27272a] bg-[#141416] select-none text-[11px] font-mono shrink-0 z-10 text-[#f4f4f5]">
      {/* LEFT: Editor Type Switcher + Area Menus */}
      <div className="flex items-center space-x-2 min-w-0">
        {/* Editor Switcher Dropdown */}
        <div ref={dropdownRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
            className="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-[#202024] border border-transparent hover:border-[#27272a] transition-colors"
            title="Switch Editor Type"
          >
            {currentMeta.icon}
            <ChevronDown className="w-2.5 h-2.5 text-[#71717a]" />
          </button>

          {isTypeDropdownOpen && (
            <div className="absolute top-7 left-0 w-44 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded-sm p-1 z-50 space-y-0.5">
              {(["viewport", "timeline", "outliner", "properties", "script"] as const).map((t) => {
                const meta = getEditorMeta(t);
                const isActive = leaf.editorType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      onSetEditorType(leaf.id, t);
                      setIsTypeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center space-x-2 px-2 py-1 rounded-xs text-[11px] text-left transition-colors ${
                      isActive
                        ? "bg-[#ea580c]/20 text-[#ea580c] font-bold"
                        : "text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]"
                    }`}
                  >
                    {meta.icon}
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Viewport Sub-View Badge (e.g. Quad Top/Front/Right/Persp) */}
        {leaf.editorType === "viewport" && leaf.subView && (
          <span className="text-[10px] uppercase font-bold text-[#ea580c] bg-[#ea580c]/10 px-1 py-0.2 rounded border border-[#ea580c]/30">
            {leaf.subView}
          </span>
        )}

        {/* Area Context Menus */}
        <div ref={menuBarRef} className="hidden sm:flex items-center space-x-0.5 text-[#a1a1aa] text-[10px]">
          {leaf.editorType === "viewport" && (
            <>
              {/* View Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveMenu(activeMenu === "view" ? null : "view")}
                  className={`px-1.5 py-0.5 rounded hover:bg-[#202024] hover:text-[#f4f4f5] ${
                    activeMenu === "view" ? "bg-[#202024] text-white" : ""
                  }`}
                >
                  View
                </button>
                {activeMenu === "view" && (
                  <div className="absolute top-6 left-0 w-36 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded-sm p-1 z-50 text-[10px] space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        onFocus?.();
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-2 py-1 rounded-xs text-[#a1a1aa] hover:bg-[#27272a] hover:text-white flex justify-between"
                    >
                      <span>Frame Selected</span>
                      <span className="text-[#52525b]">.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onCameraPreset?.("top");
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-2 py-1 rounded-xs text-[#a1a1aa] hover:bg-[#27272a] hover:text-white flex justify-between"
                    >
                      <span>Top View</span>
                      <span className="text-[#52525b]">Num7</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onCameraPreset?.("front");
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-2 py-1 rounded-xs text-[#a1a1aa] hover:bg-[#27272a] hover:text-white flex justify-between"
                    >
                      <span>Front View</span>
                      <span className="text-[#52525b]">Num1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onCameraPreset?.("right");
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-2 py-1 rounded-xs text-[#a1a1aa] hover:bg-[#27272a] hover:text-white flex justify-between"
                    >
                      <span>Right View</span>
                      <span className="text-[#52525b]">Num3</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Add Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveMenu(activeMenu === "add" ? null : "add")}
                  className={`px-1.5 py-0.5 rounded hover:bg-[#202024] hover:text-[#f4f4f5] ${
                    activeMenu === "add" ? "bg-[#202024] text-white" : ""
                  }`}
                >
                  Add
                </button>
                {activeMenu === "add" && (
                  <div className="absolute top-6 left-0 w-36 bg-[#18181b] border border-[#3f3f46] shadow-2xl rounded-sm p-1 z-50 text-[10px] space-y-0.5">
                    {["cube", "uv_sphere", "cylinder", "cone", "plane", "suzanne"].map((prim) => (
                      <button
                        key={prim}
                        type="button"
                        onClick={() => {
                          onAddPrimitive?.(prim);
                          setActiveMenu(null);
                        }}
                        className="w-full text-left px-2 py-1 rounded-xs text-[#a1a1aa] hover:bg-[#27272a] hover:text-white capitalize"
                      >
                        {prim.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {leaf.editorType === "timeline" && (
            <span className="text-[#52525b] text-[10px]">Transport & Dope Sheet</span>
          )}
          {leaf.editorType === "outliner" && (
            <span className="text-[#52525b] text-[10px]">Scene Tree</span>
          )}
          {leaf.editorType === "properties" && (
            <span className="text-[#52525b] text-[10px]">DCC Inspector</span>
          )}
          {leaf.editorType === "script" && (
            <button
              type="button"
              onClick={onRunScript}
              className="text-[#ea580c] hover:underline flex items-center space-x-1"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>Run (Alt+P)</span>
            </button>
          )}
        </div>
      </div>

      {/* RIGHT: Split / Maximize / Close Icons */}
      <div className="flex items-center space-x-1 shrink-0 text-[#71717a]">
        {/* Split Horizontally (Columns) */}
        <button
          type="button"
          onClick={() => onSplit(leaf.id, "horizontal")}
          title="Split Area Horizontally"
          className="p-1 rounded hover:bg-[#202024] hover:text-[#f4f4f5] transition-colors"
        >
          <Columns className="w-3.5 h-3.5" />
        </button>

        {/* Split Vertically (Rows) */}
        <button
          type="button"
          onClick={() => onSplit(leaf.id, "vertical")}
          title="Split Area Vertically"
          className="p-1 rounded hover:bg-[#202024] hover:text-[#f4f4f5] transition-colors"
        >
          <Rows className="w-3.5 h-3.5" />
        </button>

        {/* Maximize Area (Ctrl+Space) */}
        <button
          type="button"
          onClick={() => onMaximize(leaf.id)}
          title={isMaximized ? "Restore Area (Ctrl+Space)" : "Maximize Area (Ctrl+Space)"}
          className={`p-1 rounded transition-colors ${
            isMaximized
              ? "bg-[#ea580c] text-white"
              : "hover:bg-[#202024] hover:text-[#f4f4f5]"
          }`}
        >
          {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {/* Close Area (X) */}
        {canClose && !isMaximized && (
          <button
            type="button"
            onClick={() => onClose(leaf.id)}
            title="Close / Join Area"
            className="p-1 rounded hover:bg-[#27272a] hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Workspace Node Renderer (Recursive Tree)
// ----------------------------------------------------------------------
interface WorkspaceRendererProps {
  node: WorkspaceNode;
  canClose: boolean;
  maximizedLeafId: string | null;
  onSetEditorType: (leafId: string, editorType: EditorType) => void;
  onSplit: (leafId: string, direction: SplitDirection) => void;
  onMaximize: (leafId: string) => void;
  onClose: (leafId: string) => void;
  onRatioChange: (splitId: string, newRatio: number) => void;
  renderLeafContent: (leaf: LeafNode) => React.ReactNode;
  // Area Menu Actions
  onCameraPreset?: (view: "front" | "top" | "right" | "iso") => void;
  onAddPrimitive?: (type: string) => void;
  onFocus?: () => void;
  onRunScript?: () => void;
}

function WorkspaceNodeView({
  node,
  canClose,
  maximizedLeafId,
  onSetEditorType,
  onSplit,
  onMaximize,
  onClose,
  onRatioChange,
  renderLeafContent,
  onCameraPreset,
  onAddPrimitive,
  onFocus,
  onRunScript,
}: WorkspaceRendererProps): React.ReactElement {
  // 1. LEAF NODE
  if (node.type === "leaf") {
    const isMax = maximizedLeafId === node.id;
    return (
      <div className="flex flex-col h-full w-full overflow-hidden bg-[#141416] border border-[#27272a] rounded-xs shadow-inner">
        {/* Blender 28px Area Header */}
        <AreaHeader
          leaf={node}
          canClose={canClose}
          isMaximized={isMax}
          onSetEditorType={onSetEditorType}
          onSplit={onSplit}
          onMaximize={onMaximize}
          onClose={onClose}
          onCameraPreset={onCameraPreset}
          onAddPrimitive={onAddPrimitive}
          onFocus={onFocus}
          onRunScript={onRunScript}
        />

        {/* Area Editor Content */}
        <div className="flex-1 w-full h-full relative overflow-hidden min-h-0 min-w-0">
          {renderLeafContent(node)}
        </div>
      </div>
    );
  }

  // 2. SPLIT NODE
  const containerRef = useRef<HTMLDivElement>(null);
  const isHorizontal = node.direction === "horizontal";

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      let newRatio: number;
      if (isHorizontal) {
        const x = moveEvent.clientX - rect.left;
        newRatio = Math.max(0.1, Math.min(0.9, x / rect.width));
      } else {
        const y = moveEvent.clientY - rect.top;
        newRatio = Math.max(0.1, Math.min(0.9, y / rect.height));
      }
      onRatioChange(node.id, newRatio);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const firstPct = `${node.ratio * 100}%`;
  const secondPct = `${(1 - node.ratio) * 100}%`;

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex ${
        isHorizontal ? "flex-row" : "flex-col"
      } relative overflow-hidden`}
    >
      {/* First Child Pane */}
      <div
        style={{
          flexBasis: firstPct,
          flexGrow: 0,
          flexShrink: 0,
          overflow: "hidden",
        }}
        className="relative min-w-0 min-h-0"
      >
        <WorkspaceNodeView
          node={node.first}
          canClose={canClose}
          maximizedLeafId={maximizedLeafId}
          onSetEditorType={onSetEditorType}
          onSplit={onSplit}
          onMaximize={onMaximize}
          onClose={onClose}
          onRatioChange={onRatioChange}
          renderLeafContent={renderLeafContent}
          onCameraPreset={onCameraPreset}
          onAddPrimitive={onAddPrimitive}
          onFocus={onFocus}
          onRunScript={onRunScript}
        />
      </div>

      {/* Resizable Divider Handle (4px) */}
      <div
        onMouseDown={handleDividerMouseDown}
        className={`group shrink-0 relative z-30 transition-colors select-none ${
          isHorizontal
            ? "w-1 cursor-col-resize hover:bg-[#ea580c] bg-[#27272a]"
            : "h-1 cursor-row-resize hover:bg-[#ea580c] bg-[#27272a]"
        }`}
      >
        {/* Hover / Drag Glow Pill */}
        <div
          className={`absolute inset-0 group-hover:bg-[#ea580c] group-active:bg-[#ea580c] transition-colors`}
        />
      </div>

      {/* Second Child Pane */}
      <div
        style={{
          flexBasis: secondPct,
          flexGrow: 1,
          flexShrink: 1,
          overflow: "hidden",
        }}
        className="relative min-w-0 min-h-0"
      >
        <WorkspaceNodeView
          node={node.second}
          canClose={canClose}
          maximizedLeafId={maximizedLeafId}
          onSetEditorType={onSetEditorType}
          onSplit={onSplit}
          onMaximize={onMaximize}
          onClose={onClose}
          onRatioChange={onRatioChange}
          renderLeafContent={renderLeafContent}
          onCameraPreset={onCameraPreset}
          onAddPrimitive={onAddPrimitive}
          onFocus={onFocus}
          onRunScript={onRunScript}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main BlenderWorkspace Component
// ----------------------------------------------------------------------
export interface BlenderWorkspaceProps {
  preset: WorkspacePreset;
  onPresetChange: (preset: WorkspacePreset) => void;
  renderLeafContent: (leaf: LeafNode) => React.ReactNode;
  onCameraPreset?: (view: "front" | "top" | "right" | "iso") => void;
  onAddPrimitive?: (type: string) => void;
  onFocus?: () => void;
  onRunScript?: () => void;
}

export function BlenderWorkspace({
  preset,
  onPresetChange,
  renderLeafContent,
  onCameraPreset,
  onAddPrimitive,
  onFocus,
  onRunScript,
}: BlenderWorkspaceProps) {
  const [layoutTree, setLayoutTree] = useState<WorkspaceNode>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.warn("Failed to load saved workspace:", e);
      }
    }
    return cloneTree(PRESETS[preset]);
  });

  const [maximizedLeafId, setMaximizedLeafId] = useState<string | null>(null);

  // Sync preset changes
  useEffect(() => {
    const nextTree = cloneTree(PRESETS[preset]);
    setLayoutTree(nextTree);
    setMaximizedLeafId(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTree));
    } catch (e) {
      console.warn("Failed to persist workspace layout:", e);
    }
  }, [preset]);

  // Save to localStorage on changes
  const saveTree = (nextTree: WorkspaceNode) => {
    setLayoutTree(nextTree);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTree));
    } catch (e) {
      console.warn("Failed to persist workspace layout:", e);
    }
  };

  // Split Area
  const handleSplit = useCallback((leafId: string, direction: SplitDirection) => {
    setLayoutTree((current) => {
      const updated = updateNode(current, leafId, (node) => {
        if (node.type !== "leaf") return node;
        const leaf = node as LeafNode;
        const newFirst: LeafNode = { ...leaf, id: `leaf_${Date.now()}_1` };
        const newSecond: LeafNode = {
          id: `leaf_${Date.now()}_2`,
          type: "leaf",
          editorType: leaf.editorType === "viewport" ? "properties" : "viewport",
          subView: "persp",
        };
        const splitNode: SplitNode = {
          id: `split_${Date.now()}`,
          type: "split",
          direction,
          ratio: 0.5,
          first: newFirst,
          second: newSecond,
        };
        return splitNode;
      });
      saveTree(updated);
      return updated;
    });
  }, []);

  // Close Area
  const handleClose = useCallback((leafId: string) => {
    setLayoutTree((current) => {
      if (countLeaves(current) <= 1) return current;
      const updated = removeLeaf(current, leafId);
      saveTree(updated);
      return updated;
    });
  }, []);

  // Change Editor Type
  const handleSetEditorType = useCallback((leafId: string, editorType: EditorType) => {
    setLayoutTree((current) => {
      const updated = updateNode(current, leafId, (node) => {
        if (node.type !== "leaf") return node;
        return { ...(node as LeafNode), editorType };
      });
      saveTree(updated);
      return updated;
    });
  }, []);

  // Change Split Ratio
  const handleRatioChange = useCallback((splitId: string, newRatio: number) => {
    setLayoutTree((current) => {
      const updated = updateNode(current, splitId, (node) => {
        if (node.type !== "split") return node;
        return { ...(node as SplitNode), ratio: newRatio };
      });
      saveTree(updated);
      return updated;
    });
  }, []);

  // Maximize Area Toggle (Ctrl + Space)
  const handleMaximize = useCallback((leafId: string) => {
    setMaximizedLeafId((prev) => (prev === leafId ? null : leafId));
  }, []);

  // Hotkey: Ctrl + Space to maximize hovered / active area
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        // If maximized, restore
        if (maximizedLeafId) {
          setMaximizedLeafId(null);
        } else {
          // Find first leaf or main viewport
          const findFirstLeaf = (n: WorkspaceNode): string | null => {
            if (n.type === "leaf") return n.id;
            return findFirstLeaf(n.first) || findFirstLeaf(n.second);
          };
          const firstId = findFirstLeaf(layoutTree);
          if (firstId) setMaximizedLeafId(firstId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [maximizedLeafId, layoutTree]);

  // Find leaf if maximized
  const findLeafById = (n: WorkspaceNode, id: string): LeafNode | null => {
    if (n.type === "leaf") return n.id === id ? n : null;
    return findLeafById(n.first, id) || findLeafById(n.second, id);
  };

  const canClose = countLeaves(layoutTree) > 1;

  if (maximizedLeafId) {
    const leaf = findLeafById(layoutTree, maximizedLeafId);
    if (leaf) {
      return (
        <div className="w-full h-full flex flex-col overflow-hidden bg-[#141416]">
          <AreaHeader
            leaf={leaf}
            canClose={false}
            isMaximized={true}
            onSetEditorType={handleSetEditorType}
            onSplit={handleSplit}
            onMaximize={handleMaximize}
            onClose={handleClose}
            onCameraPreset={onCameraPreset}
            onAddPrimitive={onAddPrimitive}
            onFocus={onFocus}
            onRunScript={onRunScript}
          />
          <div className="flex-1 w-full h-full relative overflow-hidden min-h-0 min-w-0">
            {renderLeafContent(leaf)}
          </div>
        </div>
      );
    }
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#141416] select-none">
      <WorkspaceNodeView
        node={layoutTree}
        canClose={canClose}
        maximizedLeafId={maximizedLeafId}
        onSetEditorType={handleSetEditorType}
        onSplit={handleSplit}
        onMaximize={handleMaximize}
        onClose={handleClose}
        onRatioChange={handleRatioChange}
        renderLeafContent={renderLeafContent}
        onCameraPreset={onCameraPreset}
        onAddPrimitive={onAddPrimitive}
        onFocus={onFocus}
        onRunScript={onRunScript}
      />
    </div>
  );
}
