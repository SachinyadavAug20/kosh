"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { useTheme } from "@/context/ThemeContext";
import { ExportFormat, BackendHealth, McpToolDefinition } from "@/types/mcp";
import { Timeline, KeyframeMarker, InterpolationType } from "./Timeline";
import { FloatingInspector, SwatchPreset } from "./FloatingInspector";
import { SimplifyModifier } from "three/examples/jsm/modifiers/SimplifyModifier.js";
import { CanvasOverlay, SelectionTool } from "./CanvasOverlay";
import { DccQuickTray, LightingStage } from "./DccQuickTray";
import { UniversalGizmo, GizmoMode, DragBadgeInfo } from "./UniversalGizmo";
import {
  BlenderTopBar,
  TransformOrientation,
  PivotPoint,
  SnapElement,
} from "./BlenderTopBar";
import { BlenderLeftToolbar } from "./BlenderLeftToolbar";
import { BlenderNPanel } from "./BlenderNPanel";
import { BlenderTimeline } from "./BlenderTimeline";
import { BlenderWorkspace, WorkspacePreset, LeafNode } from "./BlenderWorkspace";
import { OutlinerEditor, PropertiesEditor, ScriptingEditor, DirectorEditor, McpConsoleEditor } from "./BlenderEditors";
import { AspectRatioFramer, FramingMode } from "./narrative/AspectRatioFramer";
import { VideoExportModal } from "./narrative/VideoExportModal";
import { ModelPromptBar } from "./ModelPromptBar";
import { ApiKeyModal } from "./ApiKeyModal";
import { PostProcessingPipeline } from "../lib/rendering/PostProcessingPipeline";
import { AudioVisemeSynthesizer } from "../lib/audio/AudioVisemeSynthesizer";
import { GraphEditorCanvas } from "./timeline/GraphEditorCanvas";
import { NarrativeSceneDescriptor } from "../lib/narrative/NarrativeSceneSchema";
import { parseNarrativePrompt } from "../lib/narrative/NarrativePromptParser";
import {
  createSkyboxGradient,
  createLowPolySkyDome,
  createLowPolyTerrain,
  instantiateLowPolyEntity,
  generateProceduralModelFromPrompt,
} from "../lib/narrative/LowPolyProceduralLibrary";
import { LowPolyCharacter } from "../lib/narrative/LowPolyCharacterRig";
import { DirectorCameraRig } from "../lib/narrative/DirectorCameraRig";
import {
  Download,
  Loader2,
  RotateCw,
  Grid,
  Maximize2,
  Box,
  Layers,
  Sparkles,
  Move,
  RotateCcw,
  Scale,
  Camera,
  Sun,
  Sliders,
  Plus,
  Minimize2,
  Palette,
  UploadCloud,
  Focus,
  Eye,
  EyeOff,
  Crosshair,
  Compass,
  Film,
  Play,
  Pause,
  Repeat,
  Magnet,
  ChevronDown,
  Check,
  X,
  Keyboard,
  HelpCircle,
  Hammer,
  Brush,
  Scissors,
  Square,
  Circle,
  Camera as CameraIcon,
  Lightbulb,
  Component,
  Paintbrush,
} from "lucide-react";

export type ShadingMode = "solid" | "material" | "wireframe" | "normals";
export type MatcapPreset = "studio" | "clay" | "redwax" | "chrome" | "obsidian" | "pearl" | "check" | "zebra" | "toon";
export type InteractionMode = "object" | "edit" | "sculpt" | "paint" | "weight";
export type EditElement = "vertex" | "edge" | "face";
export type SculptBrush = "draw" | "clay" | "inflate" | "flatten" | "grab" | "crease" | "smooth";
export type CameraView = "iso" | "front" | "back" | "top" | "bottom" | "right" | "left";
export type AxisConstraint = "none" | "x" | "y" | "z" | "shift-x" | "shift-y" | "shift-z";
export type SnapTarget = "closest" | "center" | "median" | "active";
export type TransformMode =
  | "all"
  | "select"
  | "translate"
  | "rotate"
  | "scale"
  | "cursor"
  | "extrude"
  | "inset"
  | "bevel"
  | "loopcut";

export interface MeshNodeInfo {
  id: string;
  name: string;
  triangles: number;
  vertices: number;
  visible: boolean;
  meshRef: THREE.Mesh;
}

export interface Viewport3DProps {
  assetUrl?: string | null;
  assetName?: string | null;
  snapshotUrl?: string | null;
  telemetry?: {
    triangles: number;
    vertices: number;
    edges: number;
    dimensions: [number, number, number];
    materials: string[];
    objects: string[];
  } | null;
  format?: ExportFormat;
  apiBase?: string;
  onMeshSelect?: (meshName: string | null) => void;
  onMeshListUpdate?: (list: MeshNodeInfo[]) => void;
  externalSelectedMeshName?: string | null;
  onOpenShortcuts?: () => void;
  // External triggers from Left Drawer
  liveMaterialUpdate?: {
    color: string;
    roughness: number;
    metalness: number;
    transmission?: number;
    clearcoat?: number;
    emissive?: string;
    timestamp: number;
  } | null;
  liveExplodedFactor?: number;
  liveTurntable?: boolean;
  liveHover?: boolean;

  // Blender DCC Unified Workspace Props
  health?: BackendHealth | null;
  isHealthChecking?: boolean;
  onRefreshHealth?: () => void;
  token?: string;
  onSaveToken?: (token: string) => void;
  onClearToken?: () => void;
  onOpenPasteBpy?: () => void;
  onOpenShare?: () => void;
  onOpenShowcase?: () => void;
  tools?: McpToolDefinition[];
  isLoading?: boolean;
  onExecuteTool?: (
    toolName: string,
    args: { prompt?: string; script?: string; format: ExportFormat; previousScript?: string }
  ) => void;
  onExecuteRawScript?: (script: string) => void;
  script?: string | null;
  stdout?: string | null;
  stderr?: string | null;
}

export function Viewport3D({
  assetUrl,
  assetName,
  snapshotUrl,
  telemetry,
  format = "glb",
  apiBase = "http://localhost:8080",
  onMeshSelect,
  onMeshListUpdate,
  externalSelectedMeshName,
  onOpenShortcuts = () => {},
  liveMaterialUpdate,
  liveExplodedFactor,
  liveTurntable,
  liveHover,
  health = null,
  isHealthChecking = false,
  onRefreshHealth = () => {},
  token = "",
  onSaveToken = () => {},
  onClearToken = () => {},
  onOpenPasteBpy = () => {},
  onOpenShare = () => {},
  onOpenShowcase = () => {},
  tools = [],
  isLoading = false,
  onExecuteTool = () => {},
  onExecuteRawScript = () => {},
  script = null,
  stdout = null,
  stderr = null,
}: Viewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, config: themeConfig } = useTheme();

  // Viewport Settings
  const [shadingMode, setShadingMode] = useState<ShadingMode>("solid");
  const [matcap, setMatcap] = useState<MatcapPreset>("studio");
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("object");
  const [editElement, setEditElement] = useState<EditElement>("vertex");
  const [sculptBrush, setSculptBrush] = useState<SculptBrush>("clay");
  const [sculptRadius, setSculptRadius] = useState<number>(0.35);
  const [sculptStrength, setSculptStrength] = useState<number>(0.5);
  const [sculptSymmetryX, setSculptSymmetryX] = useState<boolean>(false);
  const [paintColor, setPaintColor] = useState<string>("#ea580c");
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [lastAddedPrimitive, setLastAddedPrimitive] = useState<{ type: string; mesh: THREE.Mesh; radius?: number; depth?: number; segments?: number } | null>(null);
  const [transformMode, setTransformMode] = useState<TransformMode>("all");
  const [isModalTransforming, setIsModalTransforming] = useState<boolean>(false);
  const [liveDragBadge, setLiveDragBadge] = useState<DragBadgeInfo | null>(null);
  const universalGizmoRef = useRef<UniversalGizmo | null>(null);
  const [axisConstraint, setAxisConstraint] = useState<AxisConstraint>("none");
  const [isTrackball, setIsTrackball] = useState<boolean>(false);
  const [isOrtho, setIsOrtho] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [showWireOverlay, setShowWireOverlay] = useState<boolean>(false);
  const [isXRay, setIsXRay] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Generation Mode: AI Generate (Google Gemini AI + Headless Blender) vs Procedural (Instant Parametric)
  const [generationMode, setGenerationMode] = useState<"ai" | "procedural">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kosh_generation_mode");
      if (saved === "ai" || saved === "procedural") return saved;
    }
    return "ai";
  });

  const handleToggleGenerationMode = useCallback((mode: "ai" | "procedural") => {
    setGenerationMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("kosh_generation_mode", mode);
    }
  }, []);

  // Monitor backend AI tool execution and update progress HUD
  const prevIsLoadingRef = useRef(isLoading);
  useEffect(() => {
    if (isLoading && generationMode === "ai") {
      setIsLoadingModel(true);
      const t1 = setTimeout(() => {
        setSynthesisProgress(45);
        setSynthesisStep("Synthesizing Blender Python parametric script via Gemini...");
      }, 700);
      const t2 = setTimeout(() => {
        setSynthesisProgress(75);
        setSynthesisStep("Executing headless Blender pipeline on MCP backend...");
      }, 2200);
      const t3 = setTimeout(() => {
        setSynthesisProgress(90);
        setSynthesisStep("Optimizing geometry & compiling binary GLTF/GLB...");
      }, 4200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [isLoading, generationMode]);

  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading) {
      const timer = setTimeout(() => {
        setIsLoadingModel(false);
      }, 600);
      return () => clearTimeout(timer);
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading]);

  // Snapping Engine State
  const [snapEnabled, setSnapEnabled] = useState<boolean>(false);
  const [isSnapPopoverOpen, setIsSnapPopoverOpen] = useState<boolean>(false);
  const [snapTo, setSnapTo] = useState<SnapElement>("increment");
  const [snapTarget, setSnapTarget] = useState<SnapTarget>("closest");
  const [rotationSnapStep, setRotationSnapStep] = useState<number>(15); // degrees
  const [gridSnapUnit, setGridSnapUnit] = useState<number>(0.5); // meters
  const [isCtrlHeld, setIsCtrlHeld] = useState<boolean>(false);
  const [isShiftHeld, setIsShiftHeld] = useState<boolean>(false);

  // Workspace Preset & Viewport Overlays HUD
  const [workspacePreset, setWorkspacePreset] = useState<WorkspacePreset>("default");
  const [showCursor, setShowCursor] = useState<boolean>(true);
  const [showWireframeOverlay, setShowWireframeOverlay] = useState<boolean>(false);
  const [showNormals, setShowNormals] = useState<boolean>(false);

  // Tab Mode Switcher Pie Menu State
  const [isTabPieMenuOpen, setIsTabPieMenuOpen] = useState<boolean>(false);

  // Shift + A Contextual Quick-Add Menu State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [quickAddPos, setQuickAddPos] = useState<{ x: number; y: number }>({ x: 300, y: 300 });
  const latestMousePosRef = useRef<{ x: number; y: number }>({ x: 400, y: 300 });

  // Z Shading Pie Menu State
  const [isPieMenuOpen, setIsPieMenuOpen] = useState<boolean>(false);

  // Timeline & Animation Drawer State
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [totalFrames, setTotalFrames] = useState<number>(120);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [hoverActive, setHoverActive] = useState<boolean>(false);
  const [explodedFactor, setExplodedFactor] = useState<number>(0.0);

  // Narrative Scene Director & Video Export State
  const [narrativeDescriptor, setNarrativeDescriptor] = useState<NarrativeSceneDescriptor | null>(null);
  const [narrativeFramingMode, setNarrativeFramingMode] = useState<FramingMode>("16:9");
  const [isVideoExportModalOpen, setIsVideoExportModalOpen] = useState<boolean>(false);
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState<boolean>(false);
  const [isDirectorCameraActive, setIsDirectorCameraActive] = useState<boolean>(true);

  // Blender DCC Panel & Hierarchy States
  const [isTOpen, setIsTOpen] = useState<boolean>(true);
  const [isNOpen, setIsNOpen] = useState<boolean>(false);
  const [lockedMeshes, setLockedMeshes] = useState<Set<string>>(new Set());
  const [transformOrientation, setTransformOrientation] = useState<TransformOrientation>("global");
  const [pivotPoint, setPivotPoint] = useState<PivotPoint>("median");
  const [isProportionalEditing, setIsProportionalEditing] = useState<boolean>(false);
  const [selectedTransform, setSelectedTransform] = useState<{
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  }>({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  });


  // Modern Dope Sheet Timeline State
  const [turntableMode, setTurntableMode] = useState<"loop" | "infinite">("loop");
  const [interpolation, setInterpolation] = useState<InterpolationType>("linear");
  const [keyframes, setKeyframes] = useState<KeyframeMarker[]>([
    { id: "kf-0", frame: 0, type: "transform", label: "Start Pose" },
    { id: "kf-30", frame: 30, type: "transform", label: "Pose 1" },
    { id: "kf-60", frame: 60, type: "transform", label: "Midpoint" },
    { id: "kf-90", frame: 90, type: "transform", label: "Pose 2" },
    { id: "kf-120", frame: 120, type: "transform", label: "End Pose" },
  ]);

  // Direct Numeric Typed Input for Active Transform Modal (G, R, S)
  const [typedNumericBuffer, setTypedNumericBuffer] = useState<string>("");

  // Refs for horizon-fade grid and ground contact shadow
  const contactShadowRef = useRef<THREE.Mesh | null>(null);
  const fadeGridRef = useRef<THREE.Mesh | null>(null);

  // Active Overlay Popovers
  const [activeOverlay, setActiveOverlay] = useState<"none" | "material" | "transform" | "add">("none");

  // Mesh & Stats State
  const [stats, setStats] = useState<{
    triangles: number;
    vertices: number;
    dimensions: string;
  } | null>(null);

  const [meshList, setMeshList] = useState<MeshNodeInfo[]>([]);
  const [selectedMeshes, setSelectedMeshes] = useState<THREE.Mesh[]>([]);
  const selectedMesh = selectedMeshes.length > 0 ? selectedMeshes[selectedMeshes.length - 1] : null;
  const setSelectedMesh = useCallback((mesh: THREE.Mesh | null) => {
    if (!mesh) setSelectedMeshes([]);
    else setSelectedMeshes([mesh]);
  }, []);
  const [selectionTool, setSelectionTool] = useState<SelectionTool>("tweak");
  const selectionHelpersGroupRef = useRef<THREE.Group | null>(null);

  const updateSelectionHelpers = useCallback(() => {
    if (selectionHelpersGroupRef.current) {
      for (const h of selectionHelpersGroupRef.current.children) {
        if (h instanceof THREE.BoxHelper) h.update();
      }
    }
    if (selectionBoxHelperRef.current) {
      selectionBoxHelperRef.current.update();
    }
  }, []);

  const toggleMeshByName = useCallback((name: string) => {
    const found = meshList.find((m) => m.name === name)?.meshRef;
    if (!found) return;
    setSelectedMeshes((prev) => {
      const exists = prev.some((m) => m === found || m.name === name);
      if (exists) {
        return prev.filter((m) => m !== found && m.name !== name);
      } else {
        return [...prev, found];
      }
    });
  }, [meshList]);

  const selectMeshByName = useCallback((name: string | null) => {
    if (!name) {
      setSelectedMeshes([]);
      return;
    }
    const found = meshList.find((m) => m.name === name)?.meshRef;
    if (found) {
      setSelectedMeshes([found]);
    }
  }, [meshList]);

  const selectMultipleMeshes = useCallback((names: string[], mode: "replace" | "add" | "remove") => {
    const matched = meshList
      .filter((m) => names.includes(m.name) && m.meshRef)
      .map((m) => m.meshRef);

    setSelectedMeshes((prev) => {
      if (mode === "replace") {
        return matched;
      }
      if (mode === "add") {
        const existingNames = new Set(prev.map((m) => m.name));
        const toAdd = matched.filter((m) => !existingNames.has(m.name));
        return [...prev, ...toAdd];
      }
      if (mode === "remove") {
        const removeNames = new Set(names);
        return prev.filter((m) => !removeNames.has(m.name));
      }
      return prev;
    });
  }, [meshList]);

  const handleToggleMeshLock = useCallback((meshName: string) => {
    setLockedMeshes((prev) => {
      const next = new Set(prev);
      if (next.has(meshName)) next.delete(meshName);
      else next.add(meshName);
      return next;
    });
  }, []);

  const handleToggleMeshVisibility = useCallback((meshName: string) => {
    setMeshList((prevList) =>
      prevList.map((m) => {
        if (m.name === meshName) {
          const nextVis = !m.visible;
          if (m.meshRef) {
            m.meshRef.visible = nextVis;
          }
          return { ...m, visible: nextVis };
        }
        return m;
      })
    );
  }, []);

  const handleUpdateTransform = useCallback(
    (pos: [number, number, number], rot: [number, number, number], scl: [number, number, number]) => {
      if (!selectedMesh) return;
      selectedMesh.position.set(pos[0], pos[1], pos[2]);
      selectedMesh.rotation.set((rot[0] * Math.PI) / 180, (rot[1] * Math.PI) / 180, (rot[2] * Math.PI) / 180);
      selectedMesh.scale.set(scl[0], scl[1], scl[2]);
      if (universalGizmoRef.current) universalGizmoRef.current.update();
      updateSelectionHelpers();
      setSelectedTransform({
        position: { x: pos[0], y: pos[1], z: pos[2] },
        rotation: { x: rot[0], y: rot[1], z: rot[2] },
        scale: { x: scl[0], y: scl[1], z: scl[2] },
      });
    },
    [selectedMesh, updateSelectionHelpers]
  );

  // Pre-Transform Snapshot for RMB / Esc Cancel
  const preTransformSnapshotRef = useRef<{
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
  } | null>(null);

  // Snapshot of all selected object transforms taken at UniversalGizmo drag-start
  type TransformSnapshot = {
    obj: THREE.Object3D;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
  };
  const gizmoSnapshotRef = useRef<TransformSnapshot[] | null>(null);

  // Command-pattern undo: each entry captures its own undo/redo closures so it
  // can restore any kind of scene mutation (transform, add, delete, material).
  interface UndoCommand {
    label: string;
    undo: () => void;
    redo: () => void;
  }

  const undoStackRef = useRef<UndoCommand[]>([]);
  const redoStackRef = useRef<UndoCommand[]>([]);
  const [undoToast, setUndoToast] = useState<string | null>(null);

  const showUndoToast = useCallback((msg: string) => {
    setUndoToast(msg);
    setTimeout(() => {
      setUndoToast((current) => (current === msg ? null : current));
    }, 2000);
  }, []);

  const pushUndo = useCallback((command: UndoCommand) => {
    undoStackRef.current.push(command);
    if (undoStackRef.current.length > 100) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
  }, []);

  const handleUndo = useCallback(() => {
    const command = undoStackRef.current.pop();
    if (!command) {
      showUndoToast("Nothing to undo");
      return;
    }
    command.undo();
    redoStackRef.current.push(command);
    showUndoToast(`Undo: ${command.label}`);
  }, [showUndoToast]);

  const handleRedo = useCallback(() => {
    const command = redoStackRef.current.pop();
    if (!command) {
      showUndoToast("Nothing to redo");
      return;
    }
    command.redo();
    undoStackRef.current.push(command);
    showUndoToast(`Redo: ${command.label}`);
  }, [showUndoToast]);

  // Helper: snapshot transform of a set of objects, returns restore fn.
  const snapshotTransforms = useCallback((objects: THREE.Object3D[]) => {
    return objects.map((obj) => ({
      obj,
      position: obj.position.clone(),
      rotation: obj.rotation.clone(),
      scale: obj.scale.clone(),
    }));
  }, []);

  const applyTransforms = useCallback(
    (snap: ReturnType<typeof snapshotTransforms>) => {
      for (const s of snap) {
        s.obj.position.copy(s.position);
        s.obj.rotation.copy(s.rotation);
        s.obj.scale.copy(s.scale);
        s.obj.updateMatrixWorld();
      }
      updateSelectionHelpers();
    },
    [updateSelectionHelpers]
  );

  // Double tap R tracking
  const lastRPressTimeRef = useRef<number>(0);
  // Double tap A tracking
  const lastAPressTimeRef = useRef<number>(0);

  // Live Material State for Selected Sub-Mesh
  const [matColor, setMatColor] = useState<string>("#8e9297");
  const [matRoughness, setMatRoughness] = useState<number>(0.35);
  const [matMetalness, setMatMetalness] = useState<number>(0.25);
  const [matTransmission, setMatTransmission] = useState<number>(0.0);
  const [matClearcoat, setMatClearcoat] = useState<number>(0.0);
  const [matEmissive, setMatEmissive] = useState<string>("#000000");

  // Live Transform State
  // DCC Quick Tools & HUD Overlay State
  const [showDimensions, setShowDimensions] = useState<boolean>(false);
  const [isUvCheckerActive, setIsUvCheckerActive] = useState<boolean>(false);
  const [currentLightingStage, setCurrentLightingStage] = useState<LightingStage>("studio");
  const [simplifyRatio, setSimplifyRatio] = useState<number>(1.0);
  const [isQuickTrayOpen, setIsQuickTrayOpen] = useState<boolean>(false);

  // Lighting & UV Refs
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
  const headlampRef = useRef<THREE.DirectionalLight | null>(null);
  const [headlampEnabled, setHeadlampEnabled] = useState<boolean>(true);
  const headlampEnabledRef = useRef<boolean>(true);
  const [lightingPreset, setLightingPreset] = useState<"cad_studio" | "matcap" | "high_contrast">("cad_studio");
  const uvCheckerTextureRef = useRef<THREE.CanvasTexture | null>(null);

  // Live CAD Model Synthesis Progress States
  const [synthesisStep, setSynthesisStep] = useState<string>("");
  const [synthesisProgress, setSynthesisProgress] = useState<number>(0);
  const [activeSynthesisPrompt, setActiveSynthesisPrompt] = useState<string>("");

  useEffect(() => {
    headlampEnabledRef.current = headlampEnabled;
  }, [headlampEnabled]);

  const applyLightingPreset = useCallback(
    (preset: "cad_studio" | "matcap" | "high_contrast") => {
      setLightingPreset(preset);
      if (preset === "cad_studio") {
        if (hemiLightRef.current) {
          hemiLightRef.current.intensity = 0.35;
          hemiLightRef.current.color.setHex(0xffffff);
          hemiLightRef.current.groundColor.setHex(0x18181b);
        }
        if (ambientLightRef.current) ambientLightRef.current.intensity = 0.15;
        if (keyLightRef.current) {
          keyLightRef.current.intensity = 2.0;
          keyLightRef.current.position.set(5, 12, 7);
          keyLightRef.current.visible = true;
        }
        if (fillLightRef.current) {
          fillLightRef.current.intensity = 0.8;
          fillLightRef.current.position.set(-6, 4, -5);
          fillLightRef.current.color.setHex(0xe2e8f0);
          fillLightRef.current.visible = true;
        }
        if (rimLightRef.current) {
          rimLightRef.current.intensity = 1.2;
          rimLightRef.current.position.set(0, -5, -8);
          rimLightRef.current.color.setHex(0xf1f5f9);
          rimLightRef.current.visible = true;
        }
        setShadingMode("solid");
        setMatcap("studio");
        showUndoToast("CAD Studio Rig (3-Point Neutral)");
      } else if (preset === "matcap") {
        if (hemiLightRef.current) hemiLightRef.current.intensity = 0.05;
        if (ambientLightRef.current) ambientLightRef.current.intensity = 0.05;
        if (keyLightRef.current) keyLightRef.current.visible = false;
        if (fillLightRef.current) fillLightRef.current.visible = false;
        if (rimLightRef.current) rimLightRef.current.visible = false;
        setShadingMode("solid");
        setMatcap("clay");
        showUndoToast("MatCap Shading (Clay Inspection)");
      } else if (preset === "high_contrast") {
        if (hemiLightRef.current) {
          hemiLightRef.current.intensity = 0.2;
          hemiLightRef.current.color.setHex(0xffffff);
          hemiLightRef.current.groundColor.setHex(0x09090b);
        }
        if (ambientLightRef.current) ambientLightRef.current.intensity = 0.05;
        if (keyLightRef.current) {
          keyLightRef.current.intensity = 2.8;
          keyLightRef.current.position.set(6, 14, 8);
          keyLightRef.current.visible = true;
        }
        if (fillLightRef.current) {
          fillLightRef.current.intensity = 0.4;
          fillLightRef.current.position.set(-6, 3, -5);
          fillLightRef.current.color.setHex(0x94a3b8);
          fillLightRef.current.visible = true;
        }
        if (rimLightRef.current) {
          rimLightRef.current.intensity = 1.6;
          rimLightRef.current.position.set(0, -6, -9);
          rimLightRef.current.color.setHex(0xffffff);
          rimLightRef.current.visible = true;
        }
        setShadingMode("solid");
        setMatcap("studio");
        showUndoToast("High Contrast CAD (Crisp Shadows)");
      }
    },
    [showUndoToast]
  );

  const [liveTransform, setLiveTransform] = useState<{
    pos: [number, number, number];
    rot: [number, number, number];
    scale: [number, number, number];
  }>({ pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] });

  // Three.js Core Scene Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const rootModelGroupRef = useRef<THREE.Group | null>(null);
  const wireOverlayGroupRef = useRef<THREE.Group | null>(null);
  const currentModelRef = useRef<THREE.Object3D | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null);
  const selectionBoxHelperRef = useRef<THREE.BoxHelper | null>(null);
  const sculptRingRef = useRef<THREE.Mesh | null>(null);
  const cursor3DRef = useRef<THREE.Group | null>(null);
  const normalsGroupRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction[]>([]);

  // Narrative Scene & Character Animation Refs
  const narrativeRootGroupRef = useRef<THREE.Group | null>(null);
  const narrativeCharacterRef = useRef<LowPolyCharacter | null>(null);
  const directorCameraRigRef = useRef<DirectorCameraRig | null>(null);
  const isDirectorCameraActiveRef = useRef<boolean>(true);
  const isPlayingRef = useRef<boolean>(false);
  const currentFrameRef = useRef<number>(0);
  const narrativeTotalFramesRef = useRef<number>(180);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);

  // Post-Processing Pipeline & Audio Synthesizer Refs
  const postPipelineRef = useRef<PostProcessingPipeline | null>(null);
  const [isPostProcessingEnabled, setIsPostProcessingEnabled] = useState<boolean>(true);
  const isPostProcessingEnabledRef = useRef<boolean>(true);
  const audioSynthesizerRef = useRef<AudioVisemeSynthesizer>(new AudioVisemeSynthesizer());
  const terrainMeshRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    isPostProcessingEnabledRef.current = isPostProcessingEnabled;
    if (postPipelineRef.current) {
      postPipelineRef.current.setEnabled(isPostProcessingEnabled);
    }
  }, [isPostProcessingEnabled]);

  const syncMeshTransformRef = useRef<((mesh: THREE.Object3D | null) => void) | null>(null);

  const syncMeshTransform = useCallback(
    (mesh: THREE.Object3D | null) => {
      if (!mesh) return;
      const nextPos = {
        x: parseFloat(mesh.position.x.toFixed(2)),
        y: parseFloat(mesh.position.y.toFixed(2)),
        z: parseFloat(mesh.position.z.toFixed(2)),
      };
      const nextRot = {
        x: parseFloat(THREE.MathUtils.radToDeg(mesh.rotation.x).toFixed(1)),
        y: parseFloat(THREE.MathUtils.radToDeg(mesh.rotation.y).toFixed(1)),
        z: parseFloat(THREE.MathUtils.radToDeg(mesh.rotation.z).toFixed(1)),
      };
      const nextScale = {
        x: parseFloat(mesh.scale.x.toFixed(2)),
        y: parseFloat(mesh.scale.y.toFixed(2)),
        z: parseFloat(mesh.scale.z.toFixed(2)),
      };
      setSelectedTransform({
        position: nextPos,
        rotation: nextRot,
        scale: nextScale,
      });
      setLiveTransform({
        pos: [nextPos.x, nextPos.y, nextPos.z],
        rot: [nextRot.x, nextRot.y, nextRot.z],
        scale: [nextScale.x, nextScale.y, nextScale.z],
      });
      updateSelectionHelpers();
    },
    [updateSelectionHelpers]
  );

  useEffect(() => {
    syncMeshTransformRef.current = syncMeshTransform;
  }, [syncMeshTransform]);

  // Raycaster & Mouse Click Tracking (to distinguish click vs orbit drag)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // -------------------------------------------------------------
  // 1. Initial Three.js Scene Setup
  // -------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // A. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(themeConfig.viewportBg);
    sceneRef.current = scene;

    // B. Cameras
    const aspect = width / height;
    const perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    perspCamera.position.set(4.5, 3.5, 4.5);
    cameraRef.current = perspCamera;

    const frustumSize = 6;
    const orthoCamera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    orthoCamera.position.set(4.5, 3.5, 4.5);
    orthoCameraRef.current = orthoCamera;

    // C. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // High-Fidelity Post-Processing Chain (SSAO + Bloom + Output tone mapping)
    try {
      const post = new PostProcessingPipeline(
        renderer,
        scene,
        perspCamera,
        width,
        height,
        { enabled: isPostProcessingEnabledRef.current }
      );
      postPipelineRef.current = post;
    } catch (e) {
      console.warn("PostProcessingPipeline init skipped, fallback to standard WebGL renderer", e);
    }

    // D. OrbitControls
    const orbit = new OrbitControls(perspCamera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.05;
    orbit.target.set(0, 0.7, 0);
    orbit.maxDistance = 100;
    orbit.minDistance = 0.5;
    orbit.addEventListener("start", () => {
      isDirectorCameraActiveRef.current = false;
      setIsDirectorCameraActive(false);
    });
    orbitControlsRef.current = orbit;

    // E. TransformControls
    const transform = new TransformControls(perspCamera, renderer.domElement);
    transform.size = 0.65;
    transform.addEventListener("dragging-changed", (event) => {
      orbit.enabled = !event.value;
      if (event.value) {
        // Transform drag started: snapshot initial pose for cancel and undo
        const obj = transform.object;
        if (obj) {
          preTransformSnapshotRef.current = {
            position: obj.position.clone(),
            rotation: obj.rotation.clone(),
            scale: obj.scale.clone(),
          };
        }
      } else {
        // Transform drag finished: record undo
        const obj = transform.object;
        if (obj && preTransformSnapshotRef.current) {
          const prev = preTransformSnapshotRef.current;
          if (
            !prev.position.equals(obj.position) ||
            !prev.rotation.equals(obj.rotation) ||
            !prev.scale.equals(obj.scale)
          ) {
            const before: TransformSnapshot = {
              obj,
              position: prev.position.clone(),
              rotation: prev.rotation.clone(),
              scale: prev.scale.clone(),
            };
            const after: TransformSnapshot = {
              obj,
              position: obj.position.clone(),
              rotation: obj.rotation.clone(),
              scale: obj.scale.clone(),
            };
            pushUndo({
              label: `Transform ${obj.name || "object"}`,
              undo: () => applyTransforms([before]),
              redo: () => applyTransforms([after]),
            });
          }
        }
      }
    });
    transform.addEventListener("objectChange", () => {
      const obj = transform.object;
      if (obj) {
        syncMeshTransformRef.current?.(obj);
      }
    });
    scene.add(transform.getHelper());
    transformControlsRef.current = transform;

    // H. Modern All-In-One Universal Gizmo
    const universalGizmo = new UniversalGizmo(perspCamera, renderer.domElement, {
      mode: "all",
      snapEnabled: false,
      gridSnapUnit: 0.5,
      rotationSnapStep: 15,
      isShiftHeld: false,
      isCtrlHeld: false,
      onDragStart: () => {
        orbit.enabled = false;
        // Snapshot all affected objects (primary + secondary) for undo
        const primary = universalGizmo.getTarget();
        const all = [primary, ...universalGizmo.getSecondaryTargets()].filter(
          Boolean
        ) as THREE.Object3D[];
        gizmoSnapshotRef.current = snapshotTransforms(all);
      },
      onDragMove: (badge) => {
        setLiveDragBadge(badge);
      },
      onDragEnd: () => {
        orbit.enabled = true;
        setLiveDragBadge(null);
        const obj = universalGizmo.getTarget();
        if (obj) {
          syncMeshTransformRef.current?.(obj);
        }
        // Record undo command for this transform
        const before = gizmoSnapshotRef.current;
        if (before && before.length > 0) {
          const after = snapshotTransforms(before.map((s) => s.obj));
          const changed = before.some(
            (s, i) =>
              !s.position.equals(after[i].position) ||
              !s.rotation.equals(after[i].rotation) ||
              !s.scale.equals(after[i].scale)
          );
          if (changed) {
            const label =
              before.length === 1
                ? `Transform ${before[0].obj.name || "object"}`
                : `Transform ${before.length} objects`;
            pushUndo({
              label,
              undo: () => applyTransforms(before),
              redo: () => applyTransforms(after),
            });
          }
        }
        gizmoSnapshotRef.current = null;
      },
      onObjectChange: () => {
        const obj = universalGizmo.getTarget();
        if (obj) {
          syncMeshTransformRef.current?.(obj);
        }
      },
    });
    scene.add(universalGizmo.group);
    universalGizmoRef.current = universalGizmo;

    // F. Studio 3-Point CAD Rig & Ambient Lighting
    // Sky Color: #ffffff, Ground Color: #18181b, Intensity: 0.35 (No face renders pitch-black)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x18181b, 0.35);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    // Key Light (Directional, Studio position [5, 12, 7], intensity 2.0, soft PCF shadows)
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(5, 12, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 40;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    scene.add(keyLight);
    keyLightRef.current = keyLight;

    // Fill Light (Directional, Position [-6, 4, -5], Cool neutral grey #e2e8f0, intensity 0.8)
    const fillLight = new THREE.DirectionalLight(0xe2e8f0, 0.8);
    fillLight.position.set(-6, 4, -5);
    scene.add(fillLight);
    fillLightRef.current = fillLight;

    // Rim / Edge Light (Directional, Position [0, -5, -8], Color #f1f5f9, intensity 1.2)
    const rimLight = new THREE.DirectionalLight(0xf1f5f9, 1.2);
    rimLight.position.set(0, -5, -8);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    // Camera Inspection Headlamp (Locked to camera origin, look direction, intensity 0.8)
    const headlamp = new THREE.DirectionalLight(0xffffff, 0.8);
    headlamp.position.copy(perspCamera.position);
    scene.add(headlamp);
    scene.add(headlamp.target);
    headlampRef.current = headlamp;

    // G. Workstation Helpers (Horizon-Fade Grid & Ground Contact Shadow Catcher)
    const gridGeo = new THREE.PlaneGeometry(60, 60);
    gridGeo.rotateX(-Math.PI / 2);
    const gridMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSize: { value: 1.0 },
        uMajorSize: { value: 5.0 },
        uColorMajor: { value: new THREE.Color(0x3f3f46) },
        uColorMinor: { value: new THREE.Color(0x27272a) },
        uFadeDistance: { value: 24.0 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        uniform float uSize;
        uniform float uMajorSize;
        uniform vec3 uColorMajor;
        uniform vec3 uColorMinor;
        uniform float uFadeDistance;
        void main() {
          vec2 coord = vWorldPos.xz / uSize;
          vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
          float lineMinor = 1.0 - min(min(grid.x, grid.y), 1.0);

          vec2 coordMaj = vWorldPos.xz / uMajorSize;
          vec2 gridMaj = abs(fract(coordMaj - 0.5) - 0.5) / fwidth(coordMaj);
          float lineMajor = 1.0 - min(min(gridMaj.x, gridMaj.y), 1.0);

          float dist = length(vWorldPos.xz);
          float alpha = 1.0 - smoothstep(uFadeDistance * 0.35, uFadeDistance, dist);
          if (alpha <= 0.005) discard;

          vec3 col = mix(uColorMinor, uColorMajor, lineMajor);
          float intensity = max(lineMinor * 0.3, lineMajor * 0.85);
          gl_FragColor = vec4(col, intensity * alpha);
        }
      `,
    });
    const fadeGrid = new THREE.Mesh(gridGeo, gridMat);
    fadeGrid.position.y = 0;
    scene.add(fadeGrid);
    fadeGridRef.current = fadeGrid;

    // Contact Shadow Catcher Plane underneath model base
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext("2d");
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(0, 0, 0, 0.65)");
      grad.addColorStop(0.35, "rgba(0, 0, 0, 0.28)");
      grad.addColorStop(0.7, "rgba(0, 0, 0, 0.07)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.position.y = 0.002;
    contactShadow.visible = false;
    scene.add(contactShadow);
    contactShadowRef.current = contactShadow;

    const axes = new THREE.AxesHelper(1.6);
    axes.position.set(0, 0.001, 0);
    if (axes.material instanceof THREE.Material) {
      axes.material.transparent = true;
      axes.material.opacity = 0.45;
      axes.material.depthWrite = false;
    }
    scene.add(axes);
    axesHelperRef.current = axes;

    // H. Root Groups
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    rootModelGroupRef.current = modelGroup;

    const wireOverlayGroup = new THREE.Group();
    scene.add(wireOverlayGroup);
    wireOverlayGroupRef.current = wireOverlayGroup;

    // I. Selection Box Outline Helper & Group
    const boxHelper = new THREE.BoxHelper(new THREE.Mesh(), 0xea580c);
    boxHelper.visible = false;
    scene.add(boxHelper);
    selectionBoxHelperRef.current = boxHelper;

    const selectionGroup = new THREE.Group();
    selectionGroup.name = "selection_helpers_group";
    scene.add(selectionGroup);
    selectionHelpersGroupRef.current = selectionGroup;

    // Sculpt Brush Ring Indicator Cursor
    const ringGeo = new THREE.RingGeometry(0.32, 0.35, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xea580c, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.visible = false;
    scene.add(ringMesh);
    sculptRingRef.current = ringMesh;

    // 3D Cursor Helper (Iconic Blender Red/White Target Ring & Crosshairs)
    const cursor3D = new THREE.Group();
    cursor3D.name = "blender_3d_cursor";
    const cursorRingGeo = new THREE.RingGeometry(0.18, 0.20, 32);
    const cursorRingMat = new THREE.MeshBasicMaterial({
      color: 0xd97706,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    });
    const cursorRing = new THREE.Mesh(cursorRingGeo, cursorRingMat);
    cursorRing.rotation.x = -Math.PI / 2;
    cursor3D.add(cursorRing);

    const crosshairGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.35, 0, 0), new THREE.Vector3(0.35, 0, 0),
      new THREE.Vector3(0, -0.35, 0), new THREE.Vector3(0, 0.35, 0),
      new THREE.Vector3(0, 0, -0.35), new THREE.Vector3(0, 0, 0.35),
    ]);
    const crosshairMat = new THREE.LineBasicMaterial({
      color: 0xf4f4f5,
      depthTest: false,
      transparent: true,
      opacity: 0.85,
    });
    const crosshair = new THREE.LineSegments(crosshairGeo, crosshairMat);
    cursor3D.add(crosshair);
    cursor3D.position.set(0, 0, 0);
    scene.add(cursor3D);
    cursor3DRef.current = cursor3D;

    // Normals Group Helper
    const normalsGroup = new THREE.Group();
    scene.add(normalsGroup);
    normalsGroupRef.current = normalsGroup;

    // J. Render Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Play embedded glTF animation tracks
      if (mixerRef.current && isPlaying) {
        mixerRef.current.update(delta);
      }

      // Procedural turntable rotation / Infinite Spin (30 RPM continuous smooth orbit)
      if ((autoRotate || (isPlaying && turntableMode === "infinite")) && rootModelGroupRef.current) {
        rootModelGroupRef.current.rotation.y += delta * 1.0;
      }

      // Procedural floating hover
      if (hoverActive && rootModelGroupRef.current) {
        rootModelGroupRef.current.position.y = Math.sin(time * 2) * 0.1;
      }

      // Timeline playback frame increment (in Loop Scrub mode)
      if (isPlaying && turntableMode === "loop" && !narrativeCharacterRef.current) {
        setCurrentFrame((prev) => {
          if (prev >= totalFrames) {
            return isLooping ? 0 : totalFrames;
          }
          return prev + 1;
        });
      }

      // Narrative Scene & Character Kinematics Playback
      if (isPlayingRef.current && narrativeCharacterRef.current) {
        const totalF = narrativeTotalFramesRef.current || 180;
        currentFrameRef.current = (currentFrameRef.current + 1) % totalF;
        setCurrentFrame(currentFrameRef.current);

        const progress = currentFrameRef.current / totalF;
        narrativeCharacterRef.current.updateAtProgress(progress, totalF / 30, terrainMeshRef.current);

        // Formant Lip-Sync Viseme Evaluation
        if (audioSynthesizerRef.current?.isLoaded) {
          const vis = audioSynthesizerRef.current.getVisemeAtFrame(currentFrameRef.current);
          narrativeCharacterRef.current.updateVisemes(vis);
        }

        if (directorCameraRigRef.current && isDirectorCameraActiveRef.current) {
          directorCameraRigRef.current.updateAtFrame(currentFrameRef.current, totalF);
        }
      }

      // Safety guard against TransformControls unparented object warning
      if (transform.object && !transform.object.parent) {
        transform.detach();
      }

      const activeCamera = isOrtho ? orthoCamera : perspCamera;
      universalGizmo.setCamera(activeCamera);

      // Camera-Attached CAD Headlamp (Inspection Light follows view angle)
      if (headlampRef.current) {
        if (headlampEnabledRef.current) {
          headlampRef.current.visible = true;
          headlampRef.current.position.copy(activeCamera.position);
          const dir = new THREE.Vector3();
          activeCamera.getWorldDirection(dir);
          headlampRef.current.target.position.copy(activeCamera.position).add(dir.multiplyScalar(5));
          headlampRef.current.target.updateMatrixWorld();
        } else {
          headlampRef.current.visible = false;
        }
      }

      orbit.update();
      universalGizmo.update();

      // Continuous geometry tracking for any active selection helpers
      if (selectionHelpersGroupRef.current && selectionHelpersGroupRef.current.children.length > 0) {
        for (const h of selectionHelpersGroupRef.current.children) {
          if (h instanceof THREE.BoxHelper) h.update();
        }
      }
      if (selectionBoxHelperRef.current && selectionBoxHelperRef.current.visible) {
        selectionBoxHelperRef.current.update();
      }

      if (postPipelineRef.current && isPostProcessingEnabledRef.current) {
        postPipelineRef.current.updateCamera(activeCamera);
        postPipelineRef.current.render();
      } else {
        renderer.render(scene, activeCamera);
      }
    };
    animate();

    // K. Resize Listener & ResizeObserver (for smooth split pane resizing)
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      const asp = w / h;
      perspCamera.aspect = asp;
      perspCamera.updateProjectionMatrix();

      orthoCamera.left = (-frustumSize * asp) / 2;
      orthoCamera.right = (frustumSize * asp) / 2;
      orthoCamera.top = frustumSize / 2;
      orthoCamera.bottom = -frustumSize / 2;
      orthoCamera.updateProjectionMatrix();

      renderer.setSize(w, h);
      if (postPipelineRef.current) {
        postPipelineRef.current.setSize(w, h);
      }
    };
    window.addEventListener("resize", handleResize);
    const ro = new ResizeObserver(() => handleResize());
    ro.observe(container);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      orbit.dispose();
      transform.dispose();
      if (postPipelineRef.current) {
        postPipelineRef.current.dispose();
      }
      renderer.dispose();
      universalGizmo.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Synchronize playback refs with React states
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentFrameRef.current = currentFrame;
  }, [currentFrame]);

  // Viewport Overlays Reactive Sync
  useEffect(() => {
    if (fadeGridRef.current) fadeGridRef.current.visible = showGrid;
    if (contactShadowRef.current) contactShadowRef.current.visible = showGrid && currentModelRef.current !== null;
  }, [showGrid]);

  useEffect(() => {
    if (axesHelperRef.current) axesHelperRef.current.visible = showAxes;
  }, [showAxes]);

  useEffect(() => {
    if (cursor3DRef.current) cursor3DRef.current.visible = showCursor;
  }, [showCursor]);

  useEffect(() => {
    if (!wireOverlayGroupRef.current) return;
    while (wireOverlayGroupRef.current.children.length > 0) {
      wireOverlayGroupRef.current.remove(wireOverlayGroupRef.current.children[0]);
    }
    if (showWireframeOverlay && currentModelRef.current) {
      currentModelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          const wireGeo = new THREE.WireframeGeometry(child.geometry);
          const wireMat = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.45,
            depthTest: true,
          });
          const wireLines = new THREE.LineSegments(wireGeo, wireMat);
          wireLines.matrixAutoUpdate = false;
          wireLines.matrix.copy(child.matrixWorld);
          wireOverlayGroupRef.current?.add(wireLines);
        }
      });
    }
  }, [showWireframeOverlay, meshList]);

  useEffect(() => {
    if (!normalsGroupRef.current) return;
    while (normalsGroupRef.current.children.length > 0) {
      normalsGroupRef.current.remove(normalsGroupRef.current.children[0]);
    }
    if (showNormals && currentModelRef.current) {
      currentModelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          const geom = child.geometry;
          const posAttr = geom.getAttribute("position");
          const normAttr = geom.getAttribute("normal");
          if (posAttr && normAttr) {
            const linePoints: THREE.Vector3[] = [];
            const count = Math.min(posAttr.count, 1500);
            for (let i = 0; i < count; i += 2) {
              const p = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
              const n = new THREE.Vector3(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i)).multiplyScalar(0.1);
              p.applyMatrix4(child.matrixWorld);
              const nEnd = p.clone().add(n);
              linePoints.push(p, nEnd);
            }
            const normGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
            const normMat = new THREE.LineBasicMaterial({
              color: 0x06b6d4,
              transparent: true,
              opacity: 0.65,
            });
            const normLines = new THREE.LineSegments(normGeo, normMat);
            normalsGroupRef.current?.add(normLines);
          }
        }
      });
    }
  }, [showNormals, meshList]);

  // Update Scene Background & Grid Colors dynamically when Theme changes (no scene rebuild)
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(themeConfig.viewportBg);
    }
    if (fadeGridRef.current && (fadeGridRef.current.material as THREE.ShaderMaterial).uniforms) {
      const mat = fadeGridRef.current.material as THREE.ShaderMaterial;
      if (mat.uniforms.uColorMajor && mat.uniforms.uColorMinor) {
        mat.uniforms.uColorMajor.value.set(themeConfig.gridMajor);
        mat.uniforms.uColorMinor.value.set(themeConfig.gridMinor);
      }
    }
  }, [themeConfig.viewportBg, themeConfig.gridMajor, themeConfig.gridMinor]);

  // -------------------------------------------------------------
  // 2. Load 3D Asset (.glb or .stl)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!assetUrl || !rootModelGroupRef.current || !sceneRef.current) return;

    setIsLoadingModel(true);
    const resolvedUrl = assetUrl.startsWith("http") ? assetUrl : `${apiBase}${assetUrl}`;

    // Clear old models
    while (rootModelGroupRef.current.children.length > 0) {
      const obj = rootModelGroupRef.current.children[0];
      rootModelGroupRef.current.remove(obj);
    }
    if (wireOverlayGroupRef.current) {
      while (wireOverlayGroupRef.current.children.length > 0) {
        wireOverlayGroupRef.current.remove(wireOverlayGroupRef.current.children[0]);
      }
    }
    setSelectedMesh(null);
    onMeshSelect?.(null);
    if (transformControlsRef.current) transformControlsRef.current.detach();
    if (selectionBoxHelperRef.current) selectionBoxHelperRef.current.visible = false;

    const onLoad = (object: THREE.Object3D) => {
      currentModelRef.current = object;
      rootModelGroupRef.current?.add(object);

      // Compute bounding box & center geometry
      const box = new THREE.Box3().setFromObject(object);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);

      // Adjust model so it rests cleanly on ground plane
      object.position.x = -center.x;
      object.position.y = -box.min.y;
      object.position.z = -center.z;

      // Ground Contact Shadow Catcher Placement
      if (contactShadowRef.current) {
        const radius = Math.max(size.x, size.z) * 1.5;
        contactShadowRef.current.scale.set(radius, radius, 1);
        contactShadowRef.current.position.set(0, 0.002, 0);
        contactShadowRef.current.visible = true;
      }

      // Extract Sub-Meshes for Raycasting & Scene Outliner
      const detectedMeshes: MeshNodeInfo[] = [];
      let totalTris = 0;
      let totalVerts = 0;

      // Store initial position and radial exploded view direction for each sub-mesh
      const modelCenter = new THREE.Vector3(0, (box.max.y - box.min.y) / 2, 0);

      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          // Store initial transform for exploded view math
          child.userData.initialPosition = child.position.clone();
          const meshBox = new THREE.Box3().setFromObject(child);
          const meshCenter = new THREE.Vector3();
          meshBox.getCenter(meshCenter);
          const dir = meshCenter.clone().sub(modelCenter).normalize();
          if (dir.lengthSq() < 0.001) {
            dir.set(0, 1, 0);
          }
          child.userData.explodeDirection = dir;

          const geom = child.geometry as THREE.BufferGeometry;
          const tris = geom.index ? geom.index.count / 3 : (geom.attributes.position ? geom.attributes.position.count / 3 : 0);
          const verts = geom.attributes.position ? geom.attributes.position.count : 0;
          totalTris += tris;
          totalVerts += verts;

          detectedMeshes.push({
            id: child.uuid,
            name: child.name || `Part_${detectedMeshes.length + 1}`,
            triangles: Math.round(tris),
            vertices: Math.round(verts),
            visible: true,
            meshRef: child,
          });
        }
      });

      setMeshList(detectedMeshes);
      onMeshListUpdate?.(detectedMeshes);

      // Auto-select the first detected mesh so the gizmo/inspector are never empty
      if (detectedMeshes.length > 0) {
        const first = detectedMeshes[0].meshRef;
        setSelectedMeshes([first]);
        onMeshSelect?.(first.name);
      } else {
        setSelectedMeshes([]);
        onMeshSelect?.(null);
      }

      setStats({
        triangles: telemetry?.triangles ?? Math.round(totalTris),
        vertices: telemetry?.vertices ?? Math.round(totalVerts),
        dimensions: `${size.x.toFixed(2)}m × ${size.y.toFixed(2)}m × ${size.z.toFixed(2)}m`,
      });

      // Fit OrbitControls Camera view to model bounding sphere
      const sphere = new THREE.Sphere();
      box.getBoundingSphere(sphere);
      const maxDim = Math.max(size.x, size.y, size.z, 2);
      if (cameraRef.current && orbitControlsRef.current) {
        cameraRef.current.position.set(maxDim * 1.5, maxDim * 1.1, maxDim * 1.5);
        cameraRef.current.lookAt(0, maxDim * 0.4, 0);
        orbitControlsRef.current.target.set(0, maxDim * 0.4, 0);
        orbitControlsRef.current.update();
      }

      applyShading(shadingMode, matcap);
      setIsLoadingModel(false);
    };

    if (format === "stl" || resolvedUrl.endsWith(".stl")) {
      const stlLoader = new STLLoader();
      stlLoader.load(
        resolvedUrl,
        (geometry) => {
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.35,
            metalness: 0.25,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.name = assetName ? assetName.replace(/\.[^/.]+$/, "") : "CAD_Mesh";
          onLoad(mesh);
        },
        undefined,
        (err) => {
          console.error("Failed to load STL model", err);
          setIsLoadingModel(false);
        }
      );
    } else {
      const gltfLoader = new GLTFLoader();
      gltfLoader.load(
        resolvedUrl,
        (gltf) => {
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(gltf.scene);
            mixerRef.current = mixer;
            const actions: THREE.AnimationAction[] = [];
            const detectedFrames = new Set<number>();

            gltf.animations.forEach((clip) => {
              const act = mixer.clipAction(clip);
              act.play();
              actions.push(act);

              clip.tracks.forEach((track) => {
                for (let i = 0; i < track.times.length; i++) {
                  const f = Math.round(track.times[i] * 30);
                  if (f <= 120) detectedFrames.add(f);
                }
              });
            });
            actionRef.current = actions;

            if (detectedFrames.size > 0) {
              const sorted = Array.from(detectedFrames).sort((a, b) => a - b);
              setKeyframes(
                sorted.map((f, idx) => ({
                  id: `kf-clip-${idx}-${f}`,
                  frame: f,
                  type: "transform" as const,
                  label: `Frame ${f}`,
                }))
              );
            }

            setIsPlaying(true);
            setIsTimelineOpen(true);
          } else {
            mixerRef.current = null;
            actionRef.current = [];
          }
          onLoad(gltf.scene);
        },
        undefined,
        (err) => {
          console.error("Failed to load GLB model", err);
          setIsLoadingModel(false);
        }
      );
    }
  }, [assetUrl, format, apiBase]);

  // -------------------------------------------------------------
  // 3. Shading Modes & Matcap Engine
  // -------------------------------------------------------------
  const applyShading = useCallback(
    (mode: ShadingMode, cap: MatcapPreset) => {
      if (!currentModelRef.current) return;

      currentModelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material;
          }

          if (mode === "solid") {
            const matcapColors: Record<MatcapPreset, number> = {
              studio: 0x94a3b8,
              clay: 0xd97706,
              redwax: 0x991b1b,
              chrome: 0xe2e8f0,
              obsidian: 0x1e293b,
              pearl: 0xf1f5f9,
              check: 0x38bdf8,
              zebra: 0x0f172a,
              toon: 0xfbbf24,
            };
            const rough = cap === "chrome" ? 0.05 : cap === "clay" ? 0.75 : cap === "pearl" ? 0.2 : cap === "toon" ? 0.9 : 0.4;
            const metal = cap === "chrome" ? 0.95 : cap === "obsidian" ? 0.8 : cap === "pearl" ? 0.6 : cap === "zebra" ? 0.9 : 0.1;

            child.material = new THREE.MeshStandardMaterial({
              color: matcapColors[cap],
              roughness: rough,
              metalness: metal,
              wireframe: false,
            });
          } else if (mode === "material") {
            child.material = child.userData.originalMaterial || new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => (m.wireframe = false));
            } else {
              child.material.wireframe = false;
            }
          } else if (mode === "wireframe") {
            child.material = new THREE.MeshBasicMaterial({
              color: 0xea580c,
              wireframe: true,
            });
          } else if (mode === "normals") {
            child.material = new THREE.MeshNormalMaterial({ wireframe: false });
          }
        }
      });
    },
    []
  );

  useEffect(() => {
    applyShading(shadingMode, matcap);
  }, [shadingMode, matcap, applyShading]);

  // -------------------------------------------------------------
  // 4. Raycasting & Sub-Mesh Selection (Click vs Orbit Drag & Universal Gizmo)
  // -------------------------------------------------------------
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    latestMousePosRef.current = { x: e.clientX, y: e.clientY };
    if (!containerRef.current || !cameraRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(
      new THREE.Vector2(x, y),
      isOrtho && orthoCameraRef.current ? orthoCameraRef.current : cameraRef.current
    );

    if (universalGizmoRef.current) {
      universalGizmoRef.current.setOptions({
        isShiftHeld,
        isCtrlHeld,
        snapEnabled,
        gridSnapUnit,
        rotationSnapStep,
      });
      const handled = universalGizmoRef.current.onPointerMove(e.nativeEvent, raycasterRef.current);
      if (handled) return;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };

    if (containerRef.current && cameraRef.current && universalGizmoRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(
        new THREE.Vector2(x, y),
        isOrtho && orthoCameraRef.current ? orthoCameraRef.current : cameraRef.current
      );

      const gizmoIntercepted = universalGizmoRef.current.onPointerDown(e.nativeEvent, raycasterRef.current);
      if (gizmoIntercepted) {
        if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
        return;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
    if (universalGizmoRef.current?.isDragging) {
      universalGizmoRef.current.onPointerUp();
      setLiveDragBadge(null);
      return;
    }
    setLiveDragBadge(null);

    const dx = Math.abs(e.clientX - pointerDownPosRef.current.x);
    const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);

    // If mouse moved more than 4px, user was orbiting camera
    if (dx > 4 || dy > 4) return;
    if (!containerRef.current || !cameraRef.current || !currentModelRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(
      new THREE.Vector2(x, y),
      isOrtho && orthoCameraRef.current ? orthoCameraRef.current : cameraRef.current
    );

    // Build a filtered list of selectable meshes: visible, not helper/gizmo
    const collectSelectable = (obj: THREE.Object3D, out: THREE.Object3D[]) => {
      if (!obj.visible) return;
      if (obj instanceof THREE.Mesh) {
        const n = obj.name || "";
        const isHelper = n.includes("Helper") || n.includes("Gizmo") || n.includes("Grid") ||
          n.includes("Selection") || obj.userData?.isHelper === true || obj.userData?.isGizmo === true;
        if (!isHelper) out.push(obj);
      }
      for (const c of obj.children) collectSelectable(c, out);
    };

    const selectable: THREE.Object3D[] = [];
    for (const child of currentModelRef.current.children) collectSelectable(child, selectable);

    const intersects = raycasterRef.current.intersectObjects(selectable, false);

    if (intersects.length > 0) {
      // Front-face priority: find the first intersection whose face normal
      // faces the camera (i.e. hit.face normal dot ray direction < 0).
      // Fall back to the closest intersection if none pass the front-face test
      // (e.g. non-indexed or degenerate geometry).
      let hitMesh: THREE.Mesh | null = null;
      for (const hit of intersects) {
        if (!(hit.object instanceof THREE.Mesh)) continue;
        if (!hit.object.visible) continue;
        if (hit.face) {
          const normal = hit.face.normal.clone();
          // Transform normal to world space to compare with ray direction
          const worldNormal = normal
            .clone()
            .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
            .normalize();
          const dot = worldNormal.dot(raycasterRef.current.ray.direction);
          if (dot < 0) {
            hitMesh = hit.object; // front-facing
            break;
          }
        } else {
          hitMesh = hit.object; // no face data — accept closest
          break;
        }
      }

      // Fallback: if no front-facing hit found, take the closest mesh hit
      if (!hitMesh) {
        for (const hit of intersects) {
          if (hit.object instanceof THREE.Mesh && hit.object.visible) {
            hitMesh = hit.object;
            break;
          }
        }
      }

      if (hitMesh) {
        if (e.ctrlKey || e.shiftKey) {
          setSelectedMeshes((prev) => {
            const exists = prev.some((m) => m === hitMesh || m.name === hitMesh!.name);
            if (exists) {
              return prev.filter((m) => m !== hitMesh && m.name !== hitMesh!.name);
            } else {
              return [...prev, hitMesh!];
            }
          });
        } else {
          setSelectedMeshes([hitMesh]);
        }
      }
    } else {
      // Clicked in empty space -> Deselect cleanly unless Ctrl or Shift held
      if (!e.ctrlKey && !e.shiftKey) {
        setSelectedMeshes([]);
        onMeshSelect?.(null);
        universalGizmoRef.current?.attach(null);
        universalGizmoRef.current?.setSecondaryTargets([]);
        transformControlsRef.current?.detach();
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !cameraRef.current || !orbitControlsRef.current || !currentModelRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(
      new THREE.Vector2(x, y),
      isOrtho && orthoCameraRef.current ? orthoCameraRef.current : cameraRef.current
    );

    // Same filtered, front-face-priority raycast as handlePointerUp
    const collectSelectable = (obj: THREE.Object3D, out: THREE.Object3D[]) => {
      if (!obj.visible) return;
      if (obj instanceof THREE.Mesh) {
        const n = obj.name || "";
        const isHelper = n.includes("Helper") || n.includes("Gizmo") || n.includes("Grid") ||
          n.includes("Selection") || obj.userData?.isHelper === true || obj.userData?.isGizmo === true;
        if (!isHelper) out.push(obj);
      }
      for (const c of obj.children) collectSelectable(c, out);
    };
    const selectable: THREE.Object3D[] = [];
    for (const child of currentModelRef.current.children) collectSelectable(child, selectable);

    const intersects = raycasterRef.current.intersectObjects(selectable, false);

    if (intersects.length > 0) {
      let hitMesh: THREE.Mesh | null = null;
      for (const hit of intersects) {
        if (!(hit.object instanceof THREE.Mesh) || !hit.object.visible) continue;
        if (hit.face) {
          const worldNormal = hit.face.normal
            .clone()
            .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
            .normalize();
          if (worldNormal.dot(raycasterRef.current.ray.direction) < 0) {
            hitMesh = hit.object;
            break;
          }
        } else {
          hitMesh = hit.object;
          break;
        }
      }
      if (!hitMesh) {
        for (const hit of intersects) {
          if (hit.object instanceof THREE.Mesh && hit.object.visible) {
            hitMesh = hit.object;
            break;
          }
        }
      }
      if (hitMesh) {
        setSelectedMeshes([hitMesh]);
        smoothFocusObjects([hitMesh]);
      }
    } else if (currentModelRef.current) {
      smoothFocusObjects([currentModelRef.current]);
    }
  };

  // Sync Selection Outlines & Universal Gizmo on selectedMeshes change
  useEffect(() => {
    const activeMesh = selectedMeshes.length > 0 ? selectedMeshes[selectedMeshes.length - 1] : null;
    onMeshSelect?.(activeMesh ? activeMesh.name : null);

    if (universalGizmoRef.current) {
      universalGizmoRef.current.attach(activeMesh);
      universalGizmoRef.current.setSecondaryTargets(selectedMeshes.filter((m) => m !== activeMesh));
    }
    if (transformControlsRef.current && (!activeMesh || !activeMesh.parent)) {
      transformControlsRef.current.detach();
    }

    if (activeMesh) {
      syncMeshTransform(activeMesh);

      const mat = activeMesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.color) {
        setMatColor(`#${mat.color.getHexString()}`);
        setMatRoughness(mat.roughness ?? 0.35);
        setMatMetalness(mat.metalness ?? 0.25);
      }
    } else {
      setSelectedTransform({
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      });
      setLiveTransform({
        pos: [0, 0, 0],
        rot: [0, 0, 0],
        scale: [1, 1, 1],
      });
    }

    // Rebuild multi-selection helpers
    if (selectionHelpersGroupRef.current) {
      while (selectionHelpersGroupRef.current.children.length > 0) {
        const child = selectionHelpersGroupRef.current.children[0];
        selectionHelpersGroupRef.current.remove(child);
        if (child instanceof THREE.BoxHelper) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      }

      // Only add BoxHelper wireframe fallback if post-processing outline pass is disabled
      if (!isPostProcessingEnabledRef.current || !postPipelineRef.current) {
        for (const m of selectedMeshes) {
          const isActive = m === activeMesh;
          const color = isActive ? 0xf59e0b : 0xd97706;
          const helper = new THREE.BoxHelper(m, color);
          helper.visible = true;
          selectionHelpersGroupRef.current.add(helper);
        }
      }
    }

    // Update Blender-style OutlinePass glow for selected meshes
    if (postPipelineRef.current) {
      postPipelineRef.current.setOutlineTargets(selectedMeshes);
    }
  }, [selectedMeshes, onMeshSelect, syncMeshTransform]);

  // Sync external mesh selection (e.g. from Scene Outliner in right drawer)
  useEffect(() => {
    if (!externalSelectedMeshName || !currentModelRef.current) return;
    let found: THREE.Mesh | null = null;
    currentModelRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name === externalSelectedMeshName) {
        found = child;
      }
    });
    if (found) {
      setSelectedMesh(found);
    }
  }, [externalSelectedMeshName]);

  // Sync Modern Universal Gizmo Options with React State
  useEffect(() => {
    if (universalGizmoRef.current) {
      universalGizmoRef.current.setOptions({
        mode: transformMode as GizmoMode,
        snapEnabled,
        gridSnapUnit,
        rotationSnapStep,
        isShiftHeld,
        isCtrlHeld,
      });
    }
  }, [transformMode, snapEnabled, gridSnapUnit, rotationSnapStep, isShiftHeld, isCtrlHeld]);

  // Smooth Focus Camera Animation on Objects
  const smoothFocusObjects = useCallback((objects: THREE.Object3D[]) => {
    if (!cameraRef.current || !orbitControlsRef.current || objects.length === 0) return;
    const box = new THREE.Box3();
    for (const obj of objects) {
      box.expandByObject(obj);
    }
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.5);
    const cam = cameraRef.current;
    const fov = cam.fov * (Math.PI / 180);
    let cameraDist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
    cameraDist = Math.max(cameraDist, 2.0);

    const startTarget = orbitControlsRef.current.target.clone();
    const endTarget = center.clone();
    const startCamPos = cam.position.clone();
    const dir = startCamPos.clone().sub(startTarget).normalize();
    const endCamPos = center.clone().add(dir.multiplyScalar(cameraDist));

    const startTime = performance.now();
    const duration = 380;

    const animateFocus = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      orbitControlsRef.current?.target.lerpVectors(startTarget, endTarget, ease);
      cam.position.lerpVectors(startCamPos, endCamPos, ease);
      orbitControlsRef.current?.update();

      if (progress < 1.0) {
        requestAnimationFrame(animateFocus);
      }
    };
    requestAnimationFrame(animateFocus);
  }, []);

  const smoothFocusObject = useCallback((obj: THREE.Object3D) => {
    smoothFocusObjects([obj]);
  }, [smoothFocusObjects]);

  // 1-Click Transform Reset Actions for Selected Mesh
  const handlePlaceOnFloor = useCallback(() => {
    if (universalGizmoRef.current) {
      universalGizmoRef.current.placeOnFloor();
    } else if (selectedMesh) {
      const bbox = new THREE.Box3().setFromObject(selectedMesh);
      const bottomOffset = selectedMesh.position.y - bbox.min.y;
      selectedMesh.position.y = bottomOffset;
    }
    syncMeshTransform(selectedMesh);
  }, [selectedMesh, syncMeshTransform]);

  const handleCenterToOrigin = useCallback(() => {
    if (universalGizmoRef.current) {
      universalGizmoRef.current.centerToOrigin();
    } else if (selectedMesh) {
      selectedMesh.position.set(0, selectedMesh.position.y, 0);
    }
    syncMeshTransform(selectedMesh);
  }, [selectedMesh, syncMeshTransform]);

  const handleResetRotation = useCallback(() => {
    if (universalGizmoRef.current) {
      universalGizmoRef.current.resetRotation();
    } else if (selectedMesh) {
      selectedMesh.rotation.set(0, 0, 0);
    }
    syncMeshTransform(selectedMesh);
  }, [selectedMesh, syncMeshTransform]);

  const handleResetScale = useCallback(() => {
    if (universalGizmoRef.current) {
      universalGizmoRef.current.resetScale();
    } else if (selectedMesh) {
      selectedMesh.scale.set(1, 1, 1);
    }
    syncMeshTransform(selectedMesh);
  }, [selectedMesh, syncMeshTransform]);

  // -------------------------------------------------------------
  // 5. Native Blender Transform Gizmo & Snapping Engine
  // -------------------------------------------------------------
  useEffect(() => {
    if (!transformControlsRef.current) return;
    const tc = transformControlsRef.current;

    if (transformMode !== "translate" && transformMode !== "rotate" && transformMode !== "scale") {
      tc.enabled = false;
      tc.detach();
    } else {
      tc.enabled = true;
      tc.setMode(transformMode);

      // Trackball / Free local vs global space
      tc.setSpace(isTrackball ? "local" : "world");

      // Axis Locking
      if (axisConstraint === "x") {
        tc.showX = true;
        tc.showY = false;
        tc.showZ = false;
      } else if (axisConstraint === "y") {
        tc.showX = false;
        tc.showY = true;
        tc.showZ = false;
      } else if (axisConstraint === "z") {
        tc.showX = false;
        tc.showY = false;
        tc.showZ = true;
      } else if (axisConstraint === "shift-x") {
        // Planar YZ
        tc.showX = false;
        tc.showY = true;
        tc.showZ = true;
      } else if (axisConstraint === "shift-y") {
        // Planar XZ
        tc.showX = true;
        tc.showY = false;
        tc.showZ = true;
      } else if (axisConstraint === "shift-z") {
        // Planar XY
        tc.showX = true;
        tc.showY = true;
        tc.showZ = false;
      } else {
        tc.showX = true;
        tc.showY = true;
        tc.showZ = true;
      }

      // Snapping Calculation:
      // Holding Ctrl inverts current snapEnabled state on the fly!
      const effectiveSnap = (snapEnabled && !isCtrlHeld) || (!snapEnabled && isCtrlHeld);

      if (effectiveSnap) {
        if (isShiftHeld) {
          // Precision Snap Mode (Shift + Ctrl)
          tc.setTranslationSnap(gridSnapUnit * 0.1);
          tc.setRotationSnap(THREE.MathUtils.degToRad(1)); // 1-degree precision
          tc.setScaleSnap(0.01);
        } else {
          // Standard Incremental Snap
          tc.setTranslationSnap(gridSnapUnit);
          tc.setRotationSnap(THREE.MathUtils.degToRad(rotationSnapStep));
          tc.setScaleSnap(0.1);
        }
      } else {
        tc.setTranslationSnap(null);
        tc.setRotationSnap(null);
        tc.setScaleSnap(null);
      }

      const target = selectedMesh || currentModelRef.current;
      if (target && target.parent) {
        tc.attach(target);
        if (!preTransformSnapshotRef.current) {
          preTransformSnapshotRef.current = {
            position: target.position.clone(),
            rotation: target.rotation.clone(),
            scale: target.scale.clone(),
          };
        }
      } else {
        tc.detach();
      }
    }
  }, [
    transformMode,
    selectedMesh,
    axisConstraint,
    isTrackball,
    snapEnabled,
    isCtrlHeld,
    isShiftHeld,
    gridSnapUnit,
    rotationSnapStep,
  ]);

  // Cancel Active Transformation (Right-Click or Esc)
  const handleCancelTransform = useCallback(() => {
    const target = selectedMesh || currentModelRef.current;
    if (target && preTransformSnapshotRef.current) {
      target.position.copy(preTransformSnapshotRef.current.position);
      target.rotation.copy(preTransformSnapshotRef.current.rotation);
      target.scale.copy(preTransformSnapshotRef.current.scale);
      target.updateMatrixWorld();

      syncMeshTransform(target);
    }
    setIsModalTransforming(false);
    setTypedNumericBuffer("");
    setTransformMode("all");
    setAxisConstraint("none");
    setIsTrackball(false);
    preTransformSnapshotRef.current = null;
  }, [selectedMesh]);

  // Confirm Active Transformation (Left-Click or Enter)
  const handleConfirmTransform = useCallback(() => {
    setIsModalTransforming(false);
    setTypedNumericBuffer("");
    setTransformMode("all");
    setAxisConstraint("none");
    setIsTrackball(false);
    preTransformSnapshotRef.current = null;
  }, []);

  // -------------------------------------------------------------
  // 6. Live Material Tweaks from External Drawer
  // -------------------------------------------------------------
  const handleSubMeshMaterialUpdate = useCallback(
    (
      color: string,
      roughness: number,
      metalness: number,
      transmission = 0,
      clearcoat = 0,
      emissive = "#000000"
    ) => {
      const targetMesh = selectedMesh;
      if (!targetMesh && !currentModelRef.current) return;

      const applyMat = (mesh: THREE.Mesh) => {
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(color),
          roughness,
          metalness,
          transmission,
          clearcoat,
          emissive: new THREE.Color(emissive),
          transparent: transmission > 0,
          opacity: transmission > 0 ? 0.9 : 1.0,
          ior: 1.5,
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      };

      if (targetMesh) {
        applyMat(targetMesh);
      } else if (currentModelRef.current) {
        currentModelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) applyMat(child);
        });
      }
    },
    [selectedMesh]
  );

  useEffect(() => {
    if (!liveMaterialUpdate) return;
    handleSubMeshMaterialUpdate(
      liveMaterialUpdate.color,
      liveMaterialUpdate.roughness,
      liveMaterialUpdate.metalness,
      liveMaterialUpdate.transmission,
      liveMaterialUpdate.clearcoat,
      liveMaterialUpdate.emissive
    );
  }, [liveMaterialUpdate, handleSubMeshMaterialUpdate]);

  // Exploded View Assembly Slider Engine
  const handleExplodedChange = useCallback((factor: number) => {
    setExplodedFactor(factor);
    if (!currentModelRef.current) return;

    currentModelRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.initialPosition && child.userData.explodeDirection) {
        const initPos = child.userData.initialPosition as THREE.Vector3;
        const dir = child.userData.explodeDirection as THREE.Vector3;
        const maxDist = 2.0; // max displacement
        child.position.copy(initPos).addScaledVector(dir, factor * maxDist);
        child.updateMatrixWorld();
      }
    });

    if (selectionBoxHelperRef.current) {
      selectionBoxHelperRef.current.update();
    }
  }, []);

  useEffect(() => {
    if (liveExplodedFactor !== undefined) {
      handleExplodedChange(liveExplodedFactor);
    }
  }, [liveExplodedFactor, handleExplodedChange]);

  useEffect(() => {
    if (liveTurntable !== undefined) setAutoRotate(liveTurntable);
  }, [liveTurntable]);

  useEffect(() => {
    if (actionRef.current.length > 0) {
      actionRef.current.forEach((act) => {
        act.paused = !isPlaying;
      });
    }
  }, [isPlaying]);

  useEffect(() => {
    if (liveHover !== undefined) setHoverActive(liveHover);
  }, [liveHover]);

  // Toggle X-Ray Transparency Mode (Alt + Z)
  const toggleXRay = useCallback(() => {
    const next = !isXRay;
    setIsXRay(next);
    if (!currentModelRef.current) return;

    currentModelRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (m) {
            if (next) {
              if (m.userData.origOpacity === undefined) {
                m.userData.origOpacity = m.opacity;
                m.userData.origTransparent = m.transparent;
                m.userData.origDepthWrite = m.depthWrite;
              }
              m.transparent = true;
              m.opacity = 0.5;
              m.depthWrite = false;
            } else {
              m.opacity = m.userData.origOpacity ?? 1.0;
              m.transparent = m.userData.origTransparent ?? false;
              m.depthWrite = m.userData.origDepthWrite ?? true;
            }
            m.needsUpdate = true;
          }
        });
      }
    });
  }, [isXRay]);

  // Frame / Focus Camera on Selected Mesh (Numpad . or F)
  const handleFocus = useCallback(() => {
    const targets = selectedMeshes.length > 0 ? selectedMeshes : (currentModelRef.current ? [currentModelRef.current] : []);
    if (targets.length === 0 || !orbitControlsRef.current || !cameraRef.current) return;
    smoothFocusObjects(targets);
  }, [selectedMeshes, smoothFocusObjects]);

  // --- Modern Dope Sheet Keyframe Handlers ---
  const handleSeekFrame = useCallback((frame: number) => {
    setCurrentFrame(frame);
    if (mixerRef.current) {
      const time = (frame / totalFrames) * 4.0;
      mixerRef.current.setTime(time);
    }
  }, [totalFrames]);

  const handleAddKeyframe = useCallback((frame: number) => {
    const id = `kf-${Date.now()}`;
    const label = selectedMesh ? `${selectedMesh.name} Pose` : `Keyframe ${frame}`;
    setKeyframes((prev) => {
      const filtered = prev.filter((k) => k.frame !== frame);
      const newKf: KeyframeMarker = { id, frame, type: "transform", label };
      return [...filtered, newKf].sort((a, b) => a.frame - b.frame);
    });
  }, [selectedMesh]);

  const handleMoveKeyframe = useCallback((keyframeId: string, newFrame: number) => {
    setKeyframes((prev) =>
      prev.map((k) => (k.id === keyframeId ? { ...k, frame: newFrame } : k)).sort((a, b) => a.frame - b.frame)
    );
  }, []);

  const handleDeleteKeyframe = useCallback((keyframeId: string) => {
    setKeyframes((prev) => prev.filter((k) => k.id !== keyframeId));
  }, []);

  const handleChangeInterpolation = useCallback((type: InterpolationType) => {
    setInterpolation(type);
    actionRef.current.forEach((act) => {
      const clip = act.getClip();
      clip.tracks.forEach((track) => {
        if (type === "linear") {
          track.setInterpolation(THREE.InterpolateLinear);
        } else if (type === "bezier") {
          track.setInterpolation(THREE.InterpolateSmooth);
        } else if (type === "step") {
          track.setInterpolation(THREE.InterpolateDiscrete);
        }
      });
    });
  }, []);

  // --- Sub-Mesh In-Viewport HUD Handlers ---
  const handleApplySwatch = useCallback((swatch: SwatchPreset) => {
    if (!selectedMesh) return;
    setMatColor(swatch.color);
    setMatRoughness(swatch.roughness);
    setMatMetalness(swatch.metalness);
    if (swatch.emissive) setMatEmissive(swatch.emissive);

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(swatch.color),
      roughness: swatch.roughness,
      metalness: swatch.metalness,
      emissive: swatch.emissive ? new THREE.Color(swatch.emissive) : new THREE.Color(0x000000),
      emissiveIntensity: swatch.emissive ? 0.6 : 0.0,
    });
    selectedMesh.material = mat;
  }, [selectedMesh]);

  const handleUpdateSelectedMaterial = useCallback((rough: number, metal: number, color?: string) => {
    if (!selectedMesh) return;
    const mat = selectedMesh.material as THREE.MeshStandardMaterial;
    if (!(mat instanceof THREE.MeshStandardMaterial)) return;

    const prev = {
      roughness: mat.roughness,
      metalness: mat.metalness,
      color: mat.color.getHexString(),
    };
    const next = {
      roughness: rough,
      metalness: metal,
      color: color ? color.replace("#", "") : prev.color,
    };
    if (
      prev.roughness === next.roughness &&
      prev.metalness === next.metalness &&
      prev.color === next.color
    ) {
      return;
    }

    setMatRoughness(rough);
    setMatMetalness(metal);
    if (color) setMatColor(color);

    mat.roughness = rough;
    mat.metalness = metal;
    if (color) mat.color.set(color);
    mat.needsUpdate = true;

    const mesh = selectedMesh;
    pushUndo({
      label: `Material ${mesh.name || "mesh"}`,
      undo: () => {
        mat.roughness = prev.roughness;
        mat.metalness = prev.metalness;
        mat.color.set(`#${prev.color}`);
        mat.needsUpdate = true;
        setMatRoughness(prev.roughness);
        setMatMetalness(prev.metalness);
        setMatColor(`#${prev.color}`);
      },
      redo: () => {
        mat.roughness = next.roughness;
        mat.metalness = next.metalness;
        mat.color.set(`#${next.color}`);
        mat.needsUpdate = true;
        setMatRoughness(next.roughness);
        setMatMetalness(next.metalness);
        setMatColor(`#${next.color}`);
      },
    });
  }, [selectedMesh, pushUndo]);

  const handleSubdivide = useCallback(() => {
    if (!selectedMesh) return;
    const geo = selectedMesh.geometry;
    if (!geo || !geo.attributes.position) return;

    const posAttr = geo.attributes.position;
    const isIndexed = !!geo.index;
    const indices: number[] = [];
    if (isIndexed) {
      const idx = geo.index!;
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i));
    } else {
      for (let i = 0; i < posAttr.count; i++) indices.push(i);
    }

    const newPositions: number[] = [];
    const getVertex = (i: number) => new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));

    for (let i = 0; i < indices.length; i += 3) {
      const v0 = getVertex(indices[i]);
      const v1 = getVertex(indices[i + 1]);
      const v2 = getVertex(indices[i + 2]);

      const m01 = new THREE.Vector3().addVectors(v0, v1).multiplyScalar(0.5);
      const m12 = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
      const m20 = new THREE.Vector3().addVectors(v2, v0).multiplyScalar(0.5);

      // 4 Subdivided Triangles
      newPositions.push(v0.x, v0.y, v0.z, m01.x, m01.y, m01.z, m20.x, m20.y, m20.z);
      newPositions.push(v1.x, v1.y, v1.z, m12.x, m12.y, m12.z, m01.x, m01.y, m01.z);
      newPositions.push(v2.x, v2.y, v2.z, m20.x, m20.y, m20.z, m12.x, m12.y, m12.z);
      newPositions.push(m01.x, m01.y, m01.z, m12.x, m12.y, m12.z, m20.x, m20.y, m20.z);
    }

    const newGeo = new THREE.BufferGeometry();
    newGeo.setAttribute("position", new THREE.Float32BufferAttribute(newPositions, 3));
    newGeo.computeVertexNormals();
    selectedMesh.geometry.dispose();
    selectedMesh.geometry = newGeo;

    const newTris = newPositions.length / 9;
    const newVerts = newPositions.length / 3;
    setMeshList((prev) =>
      prev.map((m) =>
        m.name === selectedMesh.name ? { ...m, triangles: newTris, vertices: newVerts } : m
      )
    );
    if (selectionBoxHelperRef.current) selectionBoxHelperRef.current.update();
  }, [selectedMesh]);

  const applyTypedValue = (valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val)) return;
    const target = selectedMesh || currentModelRef.current;
    if (!target || !preTransformSnapshotRef.current) return;

    if (transformMode === "rotate") {
      const rad = THREE.MathUtils.degToRad(val);
      const axis = axisConstraint === "x" ? "x" : axisConstraint === "y" ? "y" : "z";
      target.rotation.copy(preTransformSnapshotRef.current.rotation);
      target.rotation[axis] = preTransformSnapshotRef.current.rotation[axis] + rad;
      target.updateMatrixWorld();
    } else if (transformMode === "translate") {
      const axis = axisConstraint === "x" ? "x" : axisConstraint === "y" ? "y" : axisConstraint === "z" ? "z" : "y";
      target.position.copy(preTransformSnapshotRef.current.position);
      target.position[axis] = preTransformSnapshotRef.current.position[axis] + val;
      target.updateMatrixWorld();
    } else if (transformMode === "scale") {
      target.scale.copy(preTransformSnapshotRef.current.scale);
      if (axisConstraint === "none") {
        target.scale.multiplyScalar(val);
      } else {
        const axis = axisConstraint === "x" ? "x" : axisConstraint === "y" ? "y" : "z";
        target.scale[axis] = preTransformSnapshotRef.current.scale[axis] * val;
      }
      target.updateMatrixWorld();
    }
    syncMeshTransform(target);
  };

  const refreshMeshList = useCallback(() => {
    if (!rootModelGroupRef.current) return;
    const list: MeshNodeInfo[] = [];
    let count = 0;
    let totalTriangles = 0;
    let totalVertices = 0;

    rootModelGroupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && !child.name.includes("Helper") && !child.name.includes("selection_")) {
        count++;
        if (!child.name || child.name.trim() === "") {
          const type = (child.geometry?.type || "Mesh").replace("Geometry", "").replace("Buffer", "");
          child.name = `${type || "Part"}_${String(count).padStart(3, "0")}`;
        }
        const tris = child.geometry?.index
          ? Math.round(child.geometry.index.count / 3)
          : child.geometry?.attributes?.position
          ? Math.round(child.geometry.attributes.position.count / 3)
          : 0;
        const verts = child.geometry?.attributes?.position ? child.geometry.attributes.position.count : 0;
        totalTriangles += tris;
        totalVertices += verts;

        list.push({
          id: child.uuid,
          name: child.name,
          triangles: tris,
          vertices: verts,
          visible: child.visible,
          meshRef: child,
        });
      }
    });

    const box = new THREE.Box3().setFromObject(rootModelGroupRef.current);
    const size = new THREE.Vector3();
    box.getSize(size);
    const dimensions = `${size.x.toFixed(2)}m × ${size.y.toFixed(2)}m × ${size.z.toFixed(2)}m`;
    setStats({
      triangles: totalTriangles,
      vertices: totalVertices,
      dimensions,
    });

    setMeshList(list);
    onMeshListUpdate?.(list);
  }, [onMeshListUpdate]);

  // Duplicate Selected Sub-Meshes (Shift + D)
  const handleDuplicate = useCallback(() => {
    const targets = selectedMeshes.length > 0 ? selectedMeshes : (selectedMesh ? [selectedMesh] : []);
    if (targets.length === 0 || !currentModelRef.current) return;

    const newClones: THREE.Mesh[] = [];
    const newItems: MeshNodeInfo[] = [];

    for (const target of targets) {
      const clone = target.clone(true);
      const count = meshList.filter((m) => m.name.startsWith(target.name)).length;
      clone.name = `${target.name}.${String(count).padStart(3, "0")}`;
      clone.position.x += 0.5;
      clone.updateMatrixWorld();
      target.parent?.add(clone);

      const geom = clone.geometry as THREE.BufferGeometry;
      const tris = geom.index ? geom.index.count / 3 : (geom.attributes.position ? geom.attributes.position.count / 3 : 0);
      const verts = geom.attributes.position ? geom.attributes.position.count : 0;

      newItems.push({
        id: clone.uuid,
        name: clone.name,
        triangles: Math.round(tris),
        vertices: Math.round(verts),
        visible: true,
        meshRef: clone,
      });
      newClones.push(clone);
    }

    const updatedList = [...meshList, ...newItems];
    const prevList = meshList;
    setMeshList(updatedList);
    onMeshListUpdate?.(updatedList);
    setSelectedMeshes(newClones);
    onMeshSelect?.(newClones[newClones.length - 1].name);

    pushUndo({
      label: `Duplicate ${newClones.length} mesh${newClones.length > 1 ? "es" : ""}`,
      undo: () => {
        for (const c of newClones) c.removeFromParent();
        setMeshList(prevList);
        onMeshListUpdate?.(prevList);
        setSelectedMeshes([]);
        refreshMeshList();
      },
      redo: () => {
        for (const c of newClones) c.parent?.add(c) || currentModelRef.current?.add(c);
        setMeshList(updatedList);
        onMeshListUpdate?.(updatedList);
        refreshMeshList();
      },
    });
    showUndoToast(`Duplicated ${newClones.length} mesh${newClones.length > 1 ? "es" : ""}`);
  }, [selectedMeshes, selectedMesh, meshList, onMeshListUpdate, onMeshSelect, showUndoToast, pushUndo, refreshMeshList]);

  // Delete Selected Sub-Meshes (X or Delete)
  const handleDelete = useCallback(() => {
    const targets = selectedMeshes.length > 0 ? selectedMeshes : (selectedMesh ? [selectedMesh] : []);
    if (targets.length === 0) return;

    if (transformControlsRef.current) {
      transformControlsRef.current.detach();
    }
    if (universalGizmoRef.current) {
      universalGizmoRef.current.attach(null);
    }
    if (selectionBoxHelperRef.current) {
      selectionBoxHelperRef.current.visible = false;
    }

    const targetNames = new Set(targets.map((t) => t.name));
    const removed: { obj: THREE.Object3D; parent: THREE.Object3D | null }[] = [];
    for (const target of targets) {
      removed.push({ obj: target, parent: target.parent });
      target.removeFromParent();
      if (currentModelRef.current === target) {
        currentModelRef.current = null;
      }
    }

    const newMeshList = meshList.filter((m) => !targetNames.has(m.name));
    const prevMeshList = meshList;
    setMeshList(newMeshList);
    onMeshListUpdate?.(newMeshList);
    setSelectedMeshes([]);
    onMeshSelect?.(null);

    pushUndo({
      label: `Delete ${targets.length} mesh${targets.length > 1 ? "es" : ""}`,
      undo: () => {
        for (const r of removed) {
          r.parent?.add(r.obj);
        }
        setMeshList(prevMeshList);
        onMeshListUpdate?.(prevMeshList);
        refreshMeshList();
      },
      redo: () => {
        for (const r of removed) {
          r.obj.removeFromParent();
        }
        setMeshList(newMeshList);
        onMeshListUpdate?.(newMeshList);
        refreshMeshList();
      },
    });
    showUndoToast(`Deleted ${targets.length} mesh${targets.length > 1 ? "es" : ""}`);
  }, [selectedMeshes, selectedMesh, meshList, onMeshListUpdate, onMeshSelect, showUndoToast, pushUndo, refreshMeshList]);

  // Standard Camera Presets (Front, Back, Top, Bottom, Right, Left, Iso)
  const setCameraPreset = useCallback((preset: CameraView) => {
    if (!cameraRef.current || !orbitControlsRef.current) return;
    const dist = 5.5;
    const target = orbitControlsRef.current.target;

    switch (preset) {
      case "front":
        cameraRef.current.position.set(target.x, target.y, target.z + dist);
        break;
      case "back":
        cameraRef.current.position.set(target.x, target.y, target.z - dist);
        break;
      case "right":
        cameraRef.current.position.set(target.x + dist, target.y, target.z);
        break;
      case "left":
        cameraRef.current.position.set(target.x - dist, target.y, target.z);
        break;
      case "top":
        cameraRef.current.position.set(target.x, target.y + dist, target.z + 0.0001);
        break;
      case "bottom":
        cameraRef.current.position.set(target.x, target.y - dist, target.z + 0.0001);
        break;
      case "iso":
      default:
        cameraRef.current.position.set(target.x + dist * 0.7, target.y + dist * 0.5, target.z + dist * 0.7);
        break;
    }
    cameraRef.current.lookAt(target);
    orbitControlsRef.current.update();
  }, []);



  const updateLightingStage = useCallback((stage: LightingStage) => {
    setCurrentLightingStage(stage);
    if (!ambientLightRef.current || !keyLightRef.current || !fillLightRef.current || !rimLightRef.current) return;
    const amb = ambientLightRef.current;
    const key = keyLightRef.current;
    const fill = fillLightRef.current;
    const rim = rimLightRef.current;

    if (stage === "flat") {
      amb.intensity = 2.4;
      amb.color.set(0xffffff);
      key.intensity = 0.0;
      fill.intensity = 0.0;
      rim.intensity = 0.0;
    } else if (stage === "studio") {
      amb.intensity = 0.6;
      amb.color.set(0xffffff);
      key.intensity = 2.0;
      key.color.set(0xffffff);
      key.position.set(5, 10, 7);
      fill.intensity = 0.7;
      fill.color.set(0x94a3b8);
      fill.position.set(-6, 3, -5);
      rim.intensity = 0.8;
      rim.color.set(0xffffff);
      rim.position.set(0, 5, -6);
    } else if (stage === "rim") {
      amb.intensity = 0.15;
      amb.color.set(0x38bdf8);
      key.intensity = 0.2;
      key.color.set(0xffffff);
      fill.intensity = 0.1;
      fill.color.set(0x64748b);
      rim.intensity = 3.8;
      rim.color.set(0x38bdf8);
      rim.position.set(0, 4, -8);
    } else if (stage === "daylight") {
      amb.intensity = 0.85;
      amb.color.set(0xbae6fd);
      key.intensity = 2.8;
      key.color.set(0xfef08a);
      key.position.set(8, 14, 6);
      fill.intensity = 0.5;
      fill.color.set(0x93c5fd);
      fill.position.set(-6, 3, -5);
      rim.intensity = 0.2;
      rim.color.set(0xffffff);
    }
  }, []);

  const handleToggleUvChecker = useCallback(() => {
    setIsUvCheckerActive((prev) => {
      const next = !prev;
      if (!rootModelGroupRef.current) return next;

      if (!uvCheckerTextureRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d")!;
        const size = 32;
        for (let y = 0; y < 256; y += size) {
          for (let x = 0; x < 256; x += size) {
            const isEven = ((x / size) + (y / size)) % 2 === 0;
            ctx.fillStyle = isEven ? "#e4e4e7" : "#18181b";
            ctx.fillRect(x, y, size, size);
            ctx.strokeStyle = "#3f3f46";
            ctx.strokeRect(x, y, size, size);
          }
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 4);
        uvCheckerTextureRef.current = tex;
      }

      const checkerMat = new THREE.MeshStandardMaterial({
        map: uvCheckerTextureRef.current,
        roughness: 0.4,
        metalness: 0.1,
      });

      rootModelGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (next) {
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = child.material;
            }
            child.material = checkerMat;
          } else {
            if (child.userData.originalMaterial) {
              child.material = child.userData.originalMaterial;
            }
          }
        }
      });
      return next;
    });
  }, []);

  const handleSimplifyRatioChange = useCallback((ratio: number) => {
    setSimplifyRatio(ratio);
    if (!rootModelGroupRef.current) return;
    const modifier = new SimplifyModifier();

    let totalTris = 0;
    let totalVerts = 0;

    rootModelGroupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        if (!child.userData.originalGeometry) {
          child.userData.originalGeometry = child.geometry.clone();
        }
        const origGeo = child.userData.originalGeometry as THREE.BufferGeometry;
        if (ratio >= 0.99) {
          child.geometry.dispose();
          child.geometry = origGeo.clone();
        } else {
          const origVerts = origGeo.attributes.position ? origGeo.attributes.position.count : 0;
          const targetVerts = Math.max(4, Math.floor(origVerts * ratio));
          try {
            const simplified = modifier.modify(origGeo, targetVerts);
            child.geometry.dispose();
            child.geometry = simplified;
          } catch (e) {
            console.warn("SimplifyModifier error:", e);
          }
        }

        const pos = child.geometry.attributes.position;
        const idx = child.geometry.index;
        totalTris += idx ? idx.count / 3 : pos ? pos.count / 3 : 0;
        totalVerts += pos ? pos.count : 0;
      }
    });

    setStats((prev) => (prev ? { ...prev, triangles: Math.round(totalTris), vertices: Math.round(totalVerts) } : prev));
    if (selectionBoxHelperRef.current) selectionBoxHelperRef.current.update();
  }, []);

  const handleCaptureSnapshot = useCallback((transparentBg: boolean) => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const cam = isOrtho && orthoCameraRef.current ? orthoCameraRef.current : cameraRef.current;

    const prevBg = scene.background;
    if (transparentBg) {
      scene.background = null;
    }

    renderer.render(scene, cam);
    const dataUrl = renderer.domElement.toDataURL("image/png");

    if (transparentBg) {
      scene.background = prevBg;
      renderer.render(scene, cam);
    }

    const link = document.createElement("a");
    link.download = `kosh-render-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [isOrtho]);

  // -------------------------------------------------------------
  // 7. Comprehensive Native Blender Keyboard Events
  // -------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in inputs or textareas
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Persistent Undo / Redo (Ctrl + Z, Ctrl + Shift + Z, Ctrl + Y)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Track Ctrl & Shift hold
      if (e.key === "Control" || e.key === "Meta") {
        setIsCtrlHeld(true);
      }
      if (e.key === "Shift") {
        setIsShiftHeld(true);
      }

      // Shift + Tab -> Snap Settings Popover
      if (e.shiftKey && e.key === "Tab") {
        e.preventDefault();
        setIsSnapPopoverOpen((prev) => !prev);
        return;
      }

      // F1 or ? -> Open Shortcuts Cheat Sheet
      if (e.key === "F1" || (e.shiftKey && e.key === "?") || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        onOpenShortcuts?.();
        return;
      }

      // Enter -> Confirm Active Transformation
      if (e.key === "Enter" && transformMode !== "select") {
        e.preventDefault();
        handleConfirmTransform();
        return;
      }

      // Escape -> Cancel Transformation or Deselect
      if (e.key === "Escape") {
        e.preventDefault();
        if (isPieMenuOpen) {
          setIsPieMenuOpen(false);
          return;
        }
        if (isTabPieMenuOpen) {
          setIsTabPieMenuOpen(false);
          return;
        }
        if (isQuickAddOpen) {
          setIsQuickAddOpen(false);
          return;
        }
        if (isSnapPopoverOpen) {
          setIsSnapPopoverOpen(false);
          return;
        }
        if (transformMode !== "select") {
          handleCancelTransform();
        } else {
          setSelectedMesh(null);
          onMeshSelect?.(null);
        }
        return;
      }

      // Tab -> Mode Switcher Pie Menu (Object, Edit, Sculpt, Paint, Weight)
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsTabPieMenuOpen((prev) => !prev);
        return;
      }

      // If Tab Pie Menu is open, pressing 1/2/3/4/5 sets mode
      if (isTabPieMenuOpen) {
        if (e.key === "1") {
          setInteractionMode("object");
          setIsTabPieMenuOpen(false);
          return;
        }
        if (e.key === "2") {
          setInteractionMode("edit");
          setIsTabPieMenuOpen(false);
          return;
        }
        if (e.key === "3") {
          setInteractionMode("sculpt");
          setIsTabPieMenuOpen(false);
          return;
        }
        if (e.key === "4") {
          setInteractionMode("paint");
          setIsTabPieMenuOpen(false);
          return;
        }
        if (e.key === "5") {
          setInteractionMode("weight");
          setIsTabPieMenuOpen(false);
          return;
        }
      }

      // Z Pie Menu Hotkey & Numbers
      if (e.key.toLowerCase() === "z" && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setIsPieMenuOpen((prev) => !prev);
        return;
      }

      // If Pie Menu is open, pressing 4/6/8/2 selects shading mode
      if (isPieMenuOpen) {
        if (e.key === "4") {
          setShadingMode("wireframe");
          setIsPieMenuOpen(false);
          return;
        }
        if (e.key === "6") {
          setShadingMode("solid");
          setIsPieMenuOpen(false);
          return;
        }
        if (e.key === "8") {
          setShadingMode("material");
          setIsPieMenuOpen(false);
          return;
        }
        if (e.key === "2") {
          setShadingMode("normals");
          setIsPieMenuOpen(false);
          return;
        }
      }

      // Alt + Z -> Toggle X-Ray
      if (e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        toggleXRay();
        return;
      }

      // Shift + Z -> Fast Toggle Solid / Wireframe
      if (e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setShadingMode((prev) => (prev === "wireframe" ? "solid" : "wireframe"));
        return;
      }

      // Direct Numeric Typing in active transform modal (0-9, ., -, Backspace, Enter, Esc)
      if (transformMode !== "select") {
        if (e.key === "Enter") {
          e.preventDefault();
          handleConfirmTransform();
          setTypedNumericBuffer("");
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          handleCancelTransform();
          setTypedNumericBuffer("");
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          setTypedNumericBuffer((prev) => {
            const next = prev.slice(0, -1);
            applyTypedValue(next);
            return next;
          });
          return;
        }
        if (/^[0-9.\-]$/.test(e.key)) {
          e.preventDefault();
          setTypedNumericBuffer((prev) => {
            const next = prev + e.key;
            applyTypedValue(next);
            return next;
          });
          return;
        }
      }

      // Axis Locking during Active Transform (X, Y, Z, Shift+X, Shift+Y, Shift+Z)
      if (transformMode !== "select") {
        if (e.key.toLowerCase() === "x") {
          e.preventDefault();
          setAxisConstraint((prev) => (e.shiftKey ? "shift-x" : prev === "x" ? "none" : "x"));
          return;
        }
        if (e.key.toLowerCase() === "y") {
          e.preventDefault();
          setAxisConstraint((prev) => (e.shiftKey ? "shift-y" : prev === "y" ? "none" : "y"));
          return;
        }
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          setAxisConstraint((prev) => (e.shiftKey ? "shift-z" : prev === "z" ? "none" : "z"));
          return;
        }
      }

      // Universal & DCC Transform Modes: Q (All), V (Select), W (Move), E (Rotate), R (Scale)
      if (e.key.toLowerCase() === "q" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setTransformMode("all");
        setIsModalTransforming(false);
        setAxisConstraint("none");
        return;
      }
      if (e.key.toLowerCase() === "v" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setTransformMode("select");
        setIsModalTransforming(false);
        setAxisConstraint("none");
        return;
      }
      if (e.key.toLowerCase() === "w" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (transformMode === "select") {
          setSelectionTool((prev) => {
            const cycle: SelectionTool[] = ["tweak", "box", "circle", "lasso"];
            const idx = cycle.indexOf(prev);
            return cycle[(idx + 1) % cycle.length];
          });
        } else {
          setTransformMode("translate");
          setIsModalTransforming(false);
          setAxisConstraint("none");
        }
        return;
      }
      if (e.key.toLowerCase() === "e" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setTransformMode("rotate");
        setIsModalTransforming(false);
        setAxisConstraint("none");
        return;
      }

      // B -> Box Select Tool Toggle
      if (e.key.toLowerCase() === "b" && !e.ctrlKey && !e.altKey && !e.shiftKey && !isModalTransforming) {
        e.preventDefault();
        setSelectionTool((prev) => (prev === "box" ? "tweak" : "box"));
        return;
      }

      // C -> Circle Select Tool Toggle
      if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.altKey && !e.shiftKey && !isModalTransforming) {
        e.preventDefault();
        setSelectionTool((prev) => (prev === "circle" ? "tweak" : "circle"));
        return;
      }

      // Transform Modals: G, R, S (Only if mesh is selected)
      if (e.key.toLowerCase() === "g" && !e.ctrlKey) {
        e.preventDefault();
        if (selectedMesh) {
          setIsModalTransforming(true);
          setTransformMode("translate");
          setAxisConstraint("none");
          setIsTrackball(false);
        }
        return;
      }

      if (e.key.toLowerCase() === "r" && !e.ctrlKey) {
        e.preventDefault();
        if (selectedMesh) {
          const now = Date.now();
          if (transformMode === "rotate" && now - lastRPressTimeRef.current < 450) {
            // Double-tap R: Trackball rotation
            setIsTrackball((prev) => !prev);
          } else {
            setIsModalTransforming(true);
            setTransformMode("rotate");
            setAxisConstraint("none");
            setIsTrackball(false);
          }
          lastRPressTimeRef.current = now;
        }
        return;
      }

      if (e.key.toLowerCase() === "s" && !e.ctrlKey) {
        e.preventDefault();
        if (selectedMesh) {
          setIsModalTransforming(true);
          setTransformMode("scale");
          setAxisConstraint("none");
          setIsTrackball(false);
        }
      }

      // Shift + A -> Contextual Quick-Add Parametric Menu
      if (e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const rect = containerRef.current?.getBoundingClientRect();
        const px = rect ? Math.max(20, Math.min(rect.width - 220, latestMousePosRef.current.x - rect.left)) : 200;
        const py = rect ? Math.max(20, Math.min(rect.height - 280, latestMousePosRef.current.y - rect.top)) : 200;
        setQuickAddPos({ x: px, y: py });
        setIsQuickAddOpen((prev) => !prev);
        return;
      }

      // Ctrl + I -> Invert Selection
      if (e.ctrlKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setSelectedMeshes((prev) => {
          const selectedSet = new Set(prev);
          const inverted = meshList.map((m) => m.meshRef).filter((m) => m && !selectedSet.has(m));
          if (inverted.length > 0) {
            onMeshSelect?.(inverted[inverted.length - 1].name);
          } else {
            onMeshSelect?.(null);
          }
          return inverted;
        });
        return;
      }

      // Selection: A (Select All) / Alt + A or Double A (Deselect)
      if (e.key.toLowerCase() === "a" && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        if (e.altKey) {
          setSelectedMeshes([]);
          onMeshSelect?.(null);
        } else {
          const now = Date.now();
          if (now - lastAPressTimeRef.current < 400 && selectedMeshes.length > 0) {
            setSelectedMeshes([]);
            onMeshSelect?.(null);
          } else {
            // Select ALL meshes in the scene
            const allMeshes = meshList.map((m) => m.meshRef).filter(Boolean);
            setSelectedMeshes(allMeshes);
            if (allMeshes.length > 0) {
              onMeshSelect?.(allMeshes[allMeshes.length - 1].name);
            }
          }
          lastAPressTimeRef.current = now;
        }
        return;
      }

      // Shift + D -> Duplicate Selected Mesh
      if (e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleDuplicate();
        return;
      }

      // X or Delete -> Delete Selected Mesh
      if ((e.key.toLowerCase() === "x" && transformMode === "select") || e.key === "Delete") {
        e.preventDefault();
        handleDelete();
        return;
      }

      // H, Alt + H, Shift + H -> Mesh Visibility
      if (e.key.toLowerCase() === "h") {
        e.preventDefault();
        if (e.altKey) {
          // Unhide all
          currentModelRef.current?.traverse((child) => {
            if (child instanceof THREE.Mesh) child.visible = true;
          });
        } else if (e.shiftKey) {
          // Isolate selected
          if (selectedMesh) {
            currentModelRef.current?.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.visible = child === selectedMesh;
              }
            });
          }
        } else {
          // Hide selected
          if (selectedMesh) {
            selectedMesh.visible = false;
            setSelectedMesh(null);
            onMeshSelect?.(null);
          }
        }
        return;
      }

      // Frame / Focus Camera (Period . or F)
      if (e.key === "." || e.key === "Decimal" || e.key.toLowerCase() === "f") {
        e.preventDefault();
        handleFocus();
        return;
      }

      // Numpad & Number Camera Presets
      if (e.key === "1" || e.code === "Numpad1") {
        e.preventDefault();
        setCameraPreset(e.ctrlKey ? "back" : "front");
        return;
      }
      if (e.key === "3" || e.code === "Numpad3") {
        e.preventDefault();
        setCameraPreset(e.ctrlKey ? "left" : "right");
        return;
      }
      if (e.key === "7" || e.code === "Numpad7") {
        e.preventDefault();
        setCameraPreset(e.ctrlKey ? "bottom" : "top");
        return;
      }
      if (e.key === "5" || e.code === "Numpad5") {
        e.preventDefault();
        setIsOrtho((prev) => !prev);
        return;
      }
      if (e.key === "0" || e.code === "Numpad0") {
        e.preventDefault();
        setCameraPreset("iso");
        return;
      }

      // T -> Toggle T-Shelf Left Toolbar
      if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setIsTOpen((prev) => !prev);
        return;
      }

      // N -> Toggle N-Panel Right Properties Strip
      if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setIsNOpen((prev) => !prev);
        return;
      }

      // Alt + L -> Toggle CAD Inspection Headlamp
      if (e.altKey && e.key.toLowerCase() === "l" && !e.ctrlKey) {
        e.preventDefault();
        setHeadlampEnabled((prev) => {
          const next = !prev;
          showUndoToast(next ? "CAD Headlamp ON (Camera Lock)" : "CAD Headlamp OFF");
          return next;
        });
        return;
      }

      // Space -> Toggle Timeline Playback
      if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        setIsCtrlHeld(false);
      }
      if (e.key === "Shift") {
        setIsShiftHeld(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    transformMode,
    isPieMenuOpen,
    isSnapPopoverOpen,
    selectedMesh,
    meshList,
    handleConfirmTransform,
    handleCancelTransform,
    toggleXRay,
    handleDuplicate,
    handleDelete,
    handleFocus,
    setCameraPreset,
    onMeshSelect,
    onOpenShortcuts,
  ]);


  // -------------------------------------------------------------
  // Parametric Primitives Insertion Library (Shift + A)
  // -------------------------------------------------------------
  const handleAddPrimitive = (type: string) => {
    if (!rootModelGroupRef.current || !sceneRef.current) return;
    let geo: THREE.BufferGeometry;
    let name = "Primitive";

    switch (type) {
      case "cube":
        geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        name = "Cube";
        break;
      case "cylinder":
        geo = new THREE.CylinderGeometry(0.6, 0.6, 1.6, 32);
        name = "Cylinder";
        break;
      case "uv_sphere":
        geo = new THREE.SphereGeometry(0.8, 32, 16);
        name = "UV_Sphere";
        break;
      case "ico_sphere":
        geo = new THREE.IcosahedronGeometry(0.8, 2);
        name = "Ico_Sphere";
        break;
      case "cone":
        geo = new THREE.ConeGeometry(0.8, 1.6, 32);
        name = "Cone";
        break;
      case "torus":
        geo = new THREE.TorusGeometry(0.8, 0.25, 16, 48);
        name = "Torus";
        break;
      case "plane":
        geo = new THREE.PlaneGeometry(2.5, 2.5);
        name = "Plane";
        break;
      case "grid":
        geo = new THREE.PlaneGeometry(4.0, 4.0, 8, 8);
        name = "Grid";
        break;
      case "suzanne":
        geo = new THREE.TorusKnotGeometry(0.6, 0.2, 64, 16);
        name = "Suzanne_Knot";
        break;
      case "light_point": {
        const light = new THREE.PointLight(0xffeedd, 15, 10);
        light.position.set(0, 2.5, 0);
        light.name = `Point_Light_${Date.now() % 1000}`;
        sceneRef.current.add(light);
        setIsAddMenuOpen(false);
        return;
      }
      case "light_sun": {
        const sun = new THREE.DirectionalLight(0xffffff, 2.5);
        sun.position.set(5, 8, 5);
        sun.name = `Sun_Light_${Date.now() % 1000}`;
        sceneRef.current.add(sun);
        setIsAddMenuOpen(false);
        return;
      }
      default:
        geo = new THREE.BoxGeometry(1, 1, 1);
        name = "Primitive";
    }

    const mat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.35,
      metalness: 0.25,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${name}_${Date.now() % 1000}`;
    mesh.position.set(0, 0.8, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    rootModelGroupRef.current.add(mesh);
    setSelectedMesh(mesh);
    onMeshSelect?.(mesh.name);
    setLastAddedPrimitive({ type, mesh });
    setIsAddMenuOpen(false);
    syncMeshTransform(mesh);

    // Refresh mesh stats
    const list: MeshNodeInfo[] = [];
    rootModelGroupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name && !child.name.includes("Helper")) {
        list.push({
          id: child.uuid,
          name: child.name,
          triangles: child.geometry.index ? child.geometry.index.count / 3 : child.geometry.attributes.position.count / 3,
          vertices: child.geometry.attributes.position.count,
          visible: child.visible,
          meshRef: child,
        });
      }
    });
    setMeshList(list);
    onMeshListUpdate?.(list);
  };

  // -------------------------------------------------------------
  // Instant Procedural Model Synthesis & CAD Prompt Execution
  // -------------------------------------------------------------

  const handleClearCanvas = useCallback(() => {
    if (transformControlsRef.current) {
      transformControlsRef.current.detach();
      transformControlsRef.current.enabled = false;
    }
    if (universalGizmoRef.current) {
      universalGizmoRef.current.attach(null);
    }
    if (selectionBoxHelperRef.current) {
      selectionBoxHelperRef.current.visible = false;
    }
    const clearedChildren: THREE.Object3D[] = [];
    const prevMeshList = meshList;
    if (rootModelGroupRef.current) {
      while (rootModelGroupRef.current.children.length > 0) {
        const child = rootModelGroupRef.current.children[0];
        rootModelGroupRef.current.remove(child);
        clearedChildren.push(child);
      }
    }
    currentModelRef.current = null;
    setSelectedMesh(null);
    onMeshSelect?.(null);
    setMeshList([]);
    setLastAddedPrimitive(null);

    pushUndo({
      label: "Clear Canvas",
      undo: () => {
        for (const c of clearedChildren) rootModelGroupRef.current?.add(c);
        currentModelRef.current = clearedChildren[0] || null;
        setMeshList(prevMeshList);
        onMeshListUpdate?.(prevMeshList);
        refreshMeshList();
      },
      redo: () => {
        for (const c of clearedChildren) c.removeFromParent();
        currentModelRef.current = null;
        setMeshList([]);
        onMeshListUpdate?.([]);
        refreshMeshList();
      },
    });
    showUndoToast("Clear Canvas");
  }, [onMeshSelect, showUndoToast, meshList, onMeshListUpdate, pushUndo, refreshMeshList]);

  const handleGenerateModelFromPrompt = useCallback(
    async (promptText: string, format: ExportFormat = "glb") => {
      if (!sceneRef.current) return;
      setActiveSynthesisPrompt(promptText);

      // Detach any active gizmos to prevent dangling unparented references
      if (transformControlsRef.current) {
        transformControlsRef.current.detach();
      }
      if (universalGizmoRef.current) {
        universalGizmoRef.current.attach(null);
      }
      if (selectionBoxHelperRef.current) {
        selectionBoxHelperRef.current.visible = false;
      }

      // -------------------------------------------------------------
      // AI GENERATE MODE: Google Gemini AI + Headless Blender Pipeline
      // -------------------------------------------------------------
      if (generationMode === "ai") {
        if (!token || token.trim() === "") {
          setIsKeyModalOpen(true);
          showUndoToast("Enter Google Gemini API Key from Google AI Studio to use AI Generate Mode");
          return;
        }

        setIsLoadingModel(true);
        setSynthesisProgress(15);
        setSynthesisStep("Sending prompt to Google Gemini 1.5 Flash...");

        if (onExecuteTool) {
          onExecuteTool("cad_model", { prompt: promptText, format } as any);
        } else {
          setIsLoadingModel(false);
          showUndoToast("MCP Tool Execution not connected");
        }
        return;
      }

      // -------------------------------------------------------------
      // PROCEDURAL MODE: Instant Parametric Client-Side Synthesis
      // -------------------------------------------------------------
      setIsLoadingModel(true);
      setSynthesisProgress(15);
      setSynthesisStep("Analyzing semantic tokens & spatial proportions...");

      // Snapshot current scene for undo
      const prevChildren: THREE.Object3D[] = rootModelGroupRef.current
        ? [...rootModelGroupRef.current.children]
        : [];
      const prevMeshList = meshList;

      // Stage 2: Synthesis
      await new Promise((r) => setTimeout(r, 120));
      setSynthesisProgress(40);
      setSynthesisStep("Synthesizing 3D parametric components & vertex geometry...");

      let proceduralMesh: THREE.Object3D | null = null;
      try {
        proceduralMesh = generateProceduralModelFromPrompt(promptText);
      } catch (err) {
        console.warn("Procedural generation failed:", err);
      }

      // Stage 3: Normals & manifold
      await new Promise((r) => setTimeout(r, 120));
      setSynthesisProgress(65);
      setSynthesisStep("Computing surface normals & manifold topology...");

      // Stage 4: Materials calibration
      await new Promise((r) => setTimeout(r, 120));
      setSynthesisProgress(85);
      setSynthesisStep("Calibrating studio PBR materials & shading presets...");

      if (proceduralMesh && rootModelGroupRef.current) {
        // Clear prior children WITHOUT disposing (kept alive for undo)
        while (rootModelGroupRef.current.children.length > 0) {
          rootModelGroupRef.current.remove(rootModelGroupRef.current.children[0]);
        }

        rootModelGroupRef.current.add(proceduralMesh);
        currentModelRef.current = proceduralMesh;

        // Stage 5: Outliner hierarchy
        setSynthesisProgress(95);
        setSynthesisStep("Assembling scene hierarchy & populating Outliner...");

        // Find first mesh in hierarchy for selection
        let firstMesh: THREE.Mesh | null = null;
        if (proceduralMesh instanceof THREE.Mesh) {
          firstMesh = proceduralMesh;
        } else {
          proceduralMesh.traverse((child) => {
            if (!firstMesh && child instanceof THREE.Mesh) {
              firstMesh = child;
            }
          });
        }

        refreshMeshList();
        if (firstMesh) {
          setSelectedMeshes([firstMesh]);
          onMeshSelect?.(firstMesh.name);
        } else {
          setSelectedMeshes([]);
          onMeshSelect?.(null);
        }

        handleFocus();

        const nextChildren: THREE.Object3D[] = [...rootModelGroupRef.current.children];
        const nextModel = proceduralMesh;
        pushUndo({
          label: `Generate "${promptText.slice(0, 20)}"`,
          undo: () => {
            if (!rootModelGroupRef.current) return;
            for (const c of nextChildren) c.removeFromParent();
            for (const c of prevChildren) rootModelGroupRef.current.add(c);
            currentModelRef.current = prevChildren[0] || null;
            refreshMeshList();
            setSelectedMeshes([]);
            onMeshSelect?.(null);
          },
          redo: () => {
            if (!rootModelGroupRef.current) return;
            for (const c of prevChildren) c.removeFromParent();
            rootModelGroupRef.current.add(nextModel);
            currentModelRef.current = nextModel;
            refreshMeshList();
          },
        });

        // Stage 6: Finalize viewport
        setSynthesisProgress(100);
        setSynthesisStep("Finalizing viewport scene...");
        await new Promise((r) => setTimeout(r, 100));

        setIsLoadingModel(false);
        showUndoToast(`Generated: ${promptText.slice(0, 24)}...`);
      } else {
        setIsLoadingModel(false);
        showUndoToast("Generation failed");
      }
    },
    [refreshMeshList, handleFocus, onMeshSelect, showUndoToast, meshList, pushUndo, onExecuteTool, token, generationMode]
  );

  // -------------------------------------------------------------
  // Narrative Scene Synthesis & Procedural Assembly
  // -------------------------------------------------------------
  const handleGenerateNarrativeScene = useCallback((promptText: string) => {
    if (!sceneRef.current) return;
    setIsGeneratingNarrative(true);

    try {
      const descriptor = parseNarrativePrompt(promptText);
      setNarrativeDescriptor(descriptor);
      const totalF = descriptor.meta?.durationFrames || descriptor.durationFrames || 180;
      setTotalFrames(totalF);
      narrativeTotalFramesRef.current = totalF;
      setCurrentFrame(0);
      currentFrameRef.current = 0;

      // 1. Clear prior narrative scene group
      if (narrativeRootGroupRef.current) {
        sceneRef.current.remove(narrativeRootGroupRef.current);
        narrativeRootGroupRef.current.traverse((child) => {
          if ((child as any).geometry) (child as any).geometry.dispose();
          if ((child as any).material) {
            if (Array.isArray((child as any).material)) {
              (child as any).material.forEach((m: any) => m.dispose());
            } else {
              (child as any).material.dispose();
            }
          }
        });
        narrativeRootGroupRef.current = null;
      }

      // 2. Create new Narrative Root
      const narrativeRoot = new THREE.Group();
      narrativeRoot.name = "NarrativeSceneRoot";
      sceneRef.current.add(narrativeRoot);
      narrativeRootGroupRef.current = narrativeRoot;

      // 3. Environment & Atmosphere
      const skyGradient = descriptor.environment.skyboxGradient || ["#312e81", "#f97316"];
      const sky = createSkyboxGradient(skyGradient[0], skyGradient[1]);
      narrativeRoot.add(sky);

      const groundType = descriptor.environment.ground?.type || "grass";
      const groundSize = descriptor.environment.ground?.size || [60, 60];
      const terrain = createLowPolyTerrain(groundType as any, groundSize[0], groundSize[1]);
      narrativeRoot.add(terrain);

      // Sun Directional Light
      const sunDesc = descriptor.environment.sunLight;
      const dirLight = new THREE.DirectionalLight(
        new THREE.Color(sunDesc.color),
        sunDesc.intensity
      );
      dirLight.position.set(sunDesc.position[0], sunDesc.position[1], sunDesc.position[2]);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 120;
      dirLight.shadow.camera.left = -25;
      dirLight.shadow.camera.right = 25;
      dirLight.shadow.camera.top = 25;
      dirLight.shadow.camera.bottom = -25;
      dirLight.shadow.bias = -0.0005;
      narrativeRoot.add(dirLight);

      // Ambient Fill
      const ambDesc = descriptor.environment.ambientLight;
      const ambLight = new THREE.AmbientLight(
        new THREE.Color(ambDesc.color),
        ambDesc.intensity
      );
      narrativeRoot.add(ambLight);

      // Fog
      sceneRef.current.fog = new THREE.FogExp2(
        new THREE.Color(skyGradient[1]),
        descriptor.environment.fogDensity
      );

      // 4. Props / Architecture / Props
      const propsList = descriptor.props || [];
      for (const p of propsList) {
        const propObj = instantiateLowPolyEntity(p.type);
        propObj.position.set(p.transform.position[0], p.transform.position[1], p.transform.position[2]);
        if (p.transform.scale) {
          propObj.scale.set(p.transform.scale[0], p.transform.scale[1], p.transform.scale[2]);
        }
        if (p.transform.rotation) {
          propObj.rotation.set(p.transform.rotation[0], p.transform.rotation[1], p.transform.rotation[2]);
        }
        narrativeRoot.add(propObj);
      }

      // 5. Hero Character & Spline Kinematics
      if (descriptor.actors && descriptor.actors.length > 0) {
        const heroActor = descriptor.actors[0];
        const character = new LowPolyCharacter(heroActor);
        narrativeRoot.add(character.group);
        narrativeCharacterRef.current = character;
        character.updateAtProgress(0, totalF / 30);
      } else {
        narrativeCharacterRef.current = null;
      }

      // 6. Camera Rig & Shot Choreography
      if (cameraRef.current) {
        const camDesc = descriptor.cameras?.[0] || { keyframes: [] };
        const cameraRig = new DirectorCameraRig(cameraRef.current, camDesc);
        cameraRig.setTargetActor(narrativeCharacterRef.current);
        cameraRig.setSceneCenter(new THREE.Vector3(0, 0, 0));
        directorCameraRigRef.current = cameraRig;
        cameraRig.updateAtFrame(0, totalF);

        isDirectorCameraActiveRef.current = true;
        setIsDirectorCameraActive(true);

        if (orbitControlsRef.current) {
          const frameState = cameraRig.evaluateFrame(0, totalF);
          orbitControlsRef.current.target.copy(frameState.target);
          orbitControlsRef.current.update();
        }
      }

      // 7. Auto Play
      isPlayingRef.current = true;
      setIsPlaying(true);
    } catch (err) {
      console.error("Failed to generate narrative scene:", err);
    } finally {
      setIsGeneratingNarrative(false);
    }
  }, []);

  const handleResetNarrativeScene = useCallback(() => {
    if (narrativeRootGroupRef.current && sceneRef.current) {
      sceneRef.current.remove(narrativeRootGroupRef.current);
      narrativeRootGroupRef.current.traverse((child) => {
        if ((child as any).geometry) (child as any).geometry.dispose();
        if ((child as any).material) {
          if (Array.isArray((child as any).material)) {
            (child as any).material.forEach((m: any) => m.dispose());
          } else {
            (child as any).material.dispose();
          }
        }
      });
      narrativeRootGroupRef.current = null;
    }
    if (sceneRef.current) {
      sceneRef.current.fog = null;
    }
    narrativeCharacterRef.current = null;
    directorCameraRigRef.current = null;
    setNarrativeDescriptor(null);
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentFrame(0);
    currentFrameRef.current = 0;
  }, []);

  // -------------------------------------------------------------
  // In-Viewport Digital Sculpting Stroke Handler
  // -------------------------------------------------------------
  const handleSculptStroke = (intersectPoint: THREE.Vector3, intersectNormal: THREE.Vector3, isSmooth: boolean) => {
    const target = selectedMesh || (rootModelGroupRef.current?.children[0] as THREE.Mesh);
    if (!target || !(target.geometry instanceof THREE.BufferGeometry)) return;

    const geo = target.geometry;
    const posAttr = geo.attributes.position;
    const normAttr = geo.attributes.normal;
    if (!posAttr) return;

    const localCenter = intersectPoint.clone();
    target.worldToLocal(localCenter);
    const radius = sculptRadius / (target.scale.x || 1.0);

    const v = new THREE.Vector3();
    const n = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      const dist = v.distanceTo(localCenter);
      if (dist < radius) {
        const falloff = Math.pow(1.0 - dist / radius, 2);

        if (isSmooth || sculptBrush === "smooth" || isShiftHeld) {
          // Laplacian Smoothing
          v.lerp(localCenter, 0.08 * sculptStrength * falloff);
        } else if (sculptBrush === "clay" || sculptBrush === "draw") {
          if (normAttr) n.fromBufferAttribute(normAttr, i);
          else n.copy(intersectNormal);
          v.addScaledVector(n, 0.04 * sculptStrength * falloff);
        } else if (sculptBrush === "inflate") {
          if (normAttr) n.fromBufferAttribute(normAttr, i);
          else n.copy(intersectNormal);
          v.addScaledVector(n, 0.06 * sculptStrength * falloff);
        } else if (sculptBrush === "flatten") {
          const planeDist = (v.x - localCenter.x) * intersectNormal.x +
                            (v.y - localCenter.y) * intersectNormal.y +
                            (v.z - localCenter.z) * intersectNormal.z;
          v.addScaledVector(intersectNormal, -planeDist * 0.25 * falloff);
        } else if (sculptBrush === "crease") {
          if (normAttr) n.fromBufferAttribute(normAttr, i);
          else n.copy(intersectNormal);
          v.lerp(localCenter, 0.04 * falloff);
          v.addScaledVector(n, -0.03 * sculptStrength * falloff);
        } else if (sculptBrush === "grab") {
          v.addScaledVector(intersectNormal, 0.05 * sculptStrength * falloff);
        }

        posAttr.setXYZ(i, v.x, v.y, v.z);
      }
    }

    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
    if (selectionBoxHelperRef.current) selectionBoxHelperRef.current.update();
  };

  // -------------------------------------------------------------
  // In-Viewport Vertex Color Painting Stroke Handler
  // -------------------------------------------------------------
  const handleVertexPaintStroke = (intersectPoint: THREE.Vector3) => {
    const target = selectedMesh || (rootModelGroupRef.current?.children[0] as THREE.Mesh);
    if (!target || !(target.geometry instanceof THREE.BufferGeometry)) return;

    const geo = target.geometry;
    const posAttr = geo.attributes.position;
    if (!posAttr) return;

    let colAttr = geo.attributes.color;
    if (!colAttr) {
      const colors = new Float32Array(posAttr.count * 3);
      colors.fill(1.0);
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      colAttr = geo.attributes.color;
    }

    const localCenter = intersectPoint.clone();
    target.worldToLocal(localCenter);
    const radius = sculptRadius / (target.scale.x || 1.0);
    const v = new THREE.Vector3();
    const c = new THREE.Color(paintColor);

    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      const dist = v.distanceTo(localCenter);
      if (dist < radius) {
        const falloff = Math.pow(1.0 - dist / radius, 2);
        const curR = colAttr.getX(i);
        const curG = colAttr.getY(i);
        const curB = colAttr.getZ(i);
        colAttr.setXYZ(
          i,
          curR + (c.r - curR) * falloff * sculptStrength,
          curG + (c.g - curG) * falloff * sculptStrength,
          curB + (c.b - curB) * falloff * sculptStrength
        );
      }
    }

    colAttr.needsUpdate = true;
    if (target.material) {
      (target.material as any).vertexColors = true;
      (target.material as any).needsUpdate = true;
    }
  };

  // -------------------------------------------------------------
  // Direct Multi-Format Exporters (GLB, STL, OBJ, BLEND, PNG Snapshot)
  // -------------------------------------------------------------
  const handleExportDirect = (exportFmt: "glb" | "stl" | "obj" | "png" | "blend", alphaBackground = false) => {
    if (!rootModelGroupRef.current || !rendererRef.current) return;
    const baseName = assetName ? assetName.replace(/\.[^/.]+$/, "") : "kosh_scene";

    if (exportFmt === "blend") {
      setIsExportMenuOpen(false);
      showUndoToast("Generating native .blend file with Blender...");
      try {
        const exporter = new GLTFExporter();
        exporter.parse(
          rootModelGroupRef.current,
          async (gltf) => {
            try {
              const glbBlob = new Blob([gltf as ArrayBuffer], { type: "model/gltf-binary" });
              const targetUrl = `${apiBase || ""}/api/assets/export-blend?name=${encodeURIComponent(baseName)}`;
              const res = await fetch(targetUrl, {
                method: "POST",
                headers: { "Content-Type": "model/gltf-binary" },
                body: glbBlob,
              });

              if (!res.ok) {
                throw new Error(`Blender export failed with HTTP ${res.status}`);
              }

              const blendBlob = await res.blob();
              const url = URL.createObjectURL(blendBlob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${baseName}.blend`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              showUndoToast("Downloaded native .blend scene");
            } catch (err: any) {
              console.error("Native .blend export error:", err);
              showUndoToast(`Blend export error: ${err.message || "Failed"}`);
            }
          },
          (err) => {
            console.error("GLTF scene parse error before Blender conversion:", err);
            showUndoToast("Failed to serialize scene for Blender");
          },
          { binary: true }
        );
      } catch (e: any) {
        console.error("Blend export error:", e);
        showUndoToast("Failed to generate .blend");
      }
      return;
    }

    if (exportFmt === "glb") {
      const exporter = new GLTFExporter();
      const exportAnimations = actionRef.current.map((a) => a.getClip());
      exporter.parse(
        rootModelGroupRef.current,
        (gltf) => {
          const blob = new Blob([gltf as ArrayBuffer], { type: "model/gltf-binary" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${baseName}.glb`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        },
        (err) => console.error("Export error", err),
        { binary: true, animations: exportAnimations }
      );
    } else if (exportFmt === "stl") {
      try {
        const exporter = new STLExporter();
        const stlString = exporter.parse(rootModelGroupRef.current, { binary: true });
        const blob = new Blob([stlString as any], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}.stl`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("STL export error", e);
      }
    } else if (exportFmt === "obj") {
      try {
        const exporter = new OBJExporter();
        const objText = exporter.parse(rootModelGroupRef.current);
        const blob = new Blob([objText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}.obj`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("OBJ export error", e);
      }
    } else if (exportFmt === "png") {
      const renderer = rendererRef.current;
      const oldBg = sceneRef.current?.background;
      if (alphaBackground && sceneRef.current) {
        sceneRef.current.background = null;
      }
      const activeCam = isOrtho ? orthoCameraRef.current : cameraRef.current;
      if (sceneRef.current && activeCam) {
        renderer.render(sceneRef.current, activeCam);
        const dataUrl = renderer.domElement.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${baseName}_snapshot.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      if (sceneRef.current) {
        sceneRef.current.background = oldBg || null;
      }
    }

    setIsExportMenuOpen(false);
  };

  // Export Modified GLB from Browser Canvas
  const handleExportModifiedGLB = () => {
    if (!currentModelRef.current) return;
    const exporter = new GLTFExporter();
    exporter.parse(
      currentModelRef.current,
      (gltf) => {
        const blob = new Blob([gltf as ArrayBuffer], { type: "model/gltf-binary" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${assetName ? assetName.replace(/\.[^/.]+$/, "") : "kosh_model"}_modified.glb`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      (err) => console.error("Export error", err),
      { binary: true }
    );
  };

  // Raw Server Asset Download
  const handleDownloadOriginal = () => {
    if (!assetUrl) return;
    const resolvedUrl = assetUrl.startsWith("http") ? assetUrl : `${apiBase}${assetUrl}`;
    const a = document.createElement("a");
    a.href = resolvedUrl;
    a.download = assetName || `kosh_model.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className={`relative flex flex-col w-full h-full bg-[#141416] text-[#f4f4f5] select-none ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
      onContextMenu={(e) => {
        if (transformMode !== "select") {
          e.preventDefault();
          handleCancelTransform();
        }
      }}
      onPointerDown={(e) => {
        if (interactionMode === "sculpt" || interactionMode === "paint") {
          if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
          // Raycast
          if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          const activeCam = isOrtho ? orthoCameraRef.current : cameraRef.current;
          if (!activeCam) return;
          raycasterRef.current.setFromCamera(mouse, activeCam);
          const target = selectedMesh || rootModelGroupRef.current;
          if (target) {
            const hits = raycasterRef.current.intersectObjects(target.children.length > 0 ? target.children : [target], true);
            if (hits.length > 0 && hits[0].face) {
              if (interactionMode === "sculpt") {
                handleSculptStroke(hits[0].point, hits[0].face.normal, e.shiftKey);
              } else if (interactionMode === "paint") {
                handleVertexPaintStroke(hits[0].point);
              }
            }
          }
        }
      }}
      onPointerMove={(e) => {
        if (!containerRef.current || !sceneRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const activeCam = isOrtho ? orthoCameraRef.current : cameraRef.current;
        if (!activeCam) return;
        raycasterRef.current.setFromCamera(mouse, activeCam);

        if (interactionMode === "sculpt" || interactionMode === "paint") {
          const target = selectedMesh || rootModelGroupRef.current;
          if (target) {
            const hits = raycasterRef.current.intersectObjects(target.children.length > 0 ? target.children : [target], true);
            if (hits.length > 0 && hits[0].face) {
              if (sculptRingRef.current) {
                sculptRingRef.current.visible = true;
                sculptRingRef.current.position.copy(hits[0].point);
                sculptRingRef.current.lookAt(hits[0].point.clone().add(hits[0].face.normal));
                sculptRingRef.current.scale.set(sculptRadius, sculptRadius, sculptRadius);
              }
              // Active stroke
              if (e.buttons === 1) {
                if (interactionMode === "sculpt") {
                  handleSculptStroke(hits[0].point, hits[0].face.normal, e.shiftKey);
                } else if (interactionMode === "paint") {
                  handleVertexPaintStroke(hits[0].point);
                }
              }
            } else if (sculptRingRef.current) {
              sculptRingRef.current.visible = false;
            }
          }
        } else if (sculptRingRef.current) {
          sculptRingRef.current.visible = false;
        }
      }}
      onPointerUp={() => {
        if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
      }}
    >
      {/* 1. Blender DCC Zero-Text Top Header */}
      <BlenderTopBar
        health={health}
        isHealthChecking={isHealthChecking}
        onRefreshHealth={onRefreshHealth}
        token={token}
        onSaveToken={onSaveToken}
        onClearToken={onClearToken}
        isTOpen={isTOpen}
        onToggleTPanel={() => setIsTOpen(!isTOpen)}
        isNOpen={isNOpen}
        onToggleNPanel={() => setIsNOpen(!isNOpen)}
        onOpenShortcuts={onOpenShortcuts || (() => {})}
        onOpenPasteBpy={onOpenPasteBpy || (() => {})}
        onOpenShare={onOpenShare || (() => {})}
        onOpenShowcase={onOpenShowcase || (() => {})}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        onExport={handleExportDirect}
        selectedCount={selectedMeshes.length}
        onClearCanvas={handleClearCanvas}
        interactionMode={interactionMode}
        onSetInteractionMode={setInteractionMode}
        shadingMode={shadingMode}
        onSetShadingMode={setShadingMode}
        matcap={matcap}
        onSetMatcap={setMatcap}
        isXRay={isXRay}
        onToggleXRay={toggleXRay}
        showDimensions={showDimensions}
        onToggleDimensions={() => setShowDimensions(!showDimensions)}
        snapEnabled={snapEnabled}
        onToggleSnap={() => setSnapEnabled(!snapEnabled)}
        snapTo={snapTo}
        onSetSnapTo={setSnapTo}
        gridSnapUnit={gridSnapUnit}
        onSetGridSnapUnit={setGridSnapUnit}
        rotationSnapStep={rotationSnapStep}
        onSetRotationSnapStep={setRotationSnapStep}
        isProportionalEditing={isProportionalEditing}
        onToggleProportionalEditing={() => setIsProportionalEditing(!isProportionalEditing)}
        transformOrientation={transformOrientation}
        onSetTransformOrientation={setTransformOrientation}
        pivotPoint={pivotPoint}
        onSetPivotPoint={setPivotPoint}
        onAddPrimitive={handleAddPrimitive}
        selectedMeshName={selectedMesh?.name || null}
        isOrtho={isOrtho}
        onToggleOrtho={() => setIsOrtho(!isOrtho)}
        onFocus={handleFocus}
        workspacePreset={workspacePreset}
        onSelectWorkspacePreset={setWorkspacePreset}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        showAxes={showAxes}
        onToggleAxes={() => setShowAxes(!showAxes)}
        showCursor={showCursor}
        onToggleCursor={() => setShowCursor(!showCursor)}
        showWireframeOverlay={showWireframeOverlay}
        onToggleWireframeOverlay={() => setShowWireframeOverlay(!showWireframeOverlay)}
        showNormals={showNormals}
        onToggleNormals={() => setShowNormals(!showNormals)}
        headlampEnabled={headlampEnabled}
        onToggleHeadlamp={() => setHeadlampEnabled(!headlampEnabled)}
        lightingPreset={lightingPreset}
        onSelectLightingPreset={applyLightingPreset}
        generationMode={generationMode}
        onToggleGenerationMode={handleToggleGenerationMode}
      />

      {/* Persistent Undo / Redo Floating Toast */}
      {undoToast && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 bg-[#202024] border border-[#ea580c]/50 text-[#f4f4f5] rounded text-xs font-mono shadow-2xl flex items-center space-x-2 animate-fade-in pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ea580c] animate-pulse" />
          <span>{undoToast}</span>
        </div>
      )}

      {/* 2. Blender Modular Dockable Window System (Split-Pane Binary Tree Engine) */}
      <div className="flex-1 flex min-h-0 min-w-0 w-full h-full relative overflow-hidden">
        <BlenderWorkspace
          preset={workspacePreset}
          onPresetChange={setWorkspacePreset}
          onCameraPreset={setCameraPreset}
          onAddPrimitive={handleAddPrimitive}
          onFocus={handleFocus}
          onRunScript={() => script && onExecuteRawScript?.(script)}
          renderLeafContent={(leaf) => {
            switch (leaf.editorType) {
              case "viewport":
                if (leaf.subView && leaf.subView !== "persp") {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#141416] p-4 text-center font-mono select-none relative">
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-[#202024] border border-[#ea580c]/40 text-[#ea580c] rounded text-[10px] uppercase font-bold tracking-wider">
                        {leaf.subView} Orthographic
                      </div>
                      <Compass className="w-8 h-8 text-[#52525b] mb-2 animate-pulse" />
                      <div className="text-xs text-[#a1a1aa] mb-1 font-bold uppercase">
                        {leaf.subView} ORTHO VIEW
                      </div>
                      <p className="text-[10px] text-[#71717a] max-w-xs mb-3">
                        Synchronized CAD projection plane for precision alignment.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setCameraPreset(leaf.subView as any);
                          setIsOrtho(true);
                        }}
                        className="px-3 py-1 bg-[#202024] hover:bg-[#ea580c] border border-[#3f3f46] hover:border-[#ea580c] text-white rounded text-[11px] font-mono transition-colors"
                      >
                        Orient Main Camera to {leaf.subView.toUpperCase()}
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="flex-1 flex min-h-0 min-w-0 w-full h-full relative overflow-hidden">
                    {/* T-Shelf Left Toolbar (44px, collapsible with T) */}
                    <BlenderLeftToolbar
                      isOpen={isTOpen}
                      transformMode={transformMode}
                      onSetTransformMode={setTransformMode}
                      selectionTool={selectionTool}
                      onSetSelectionTool={setSelectionTool}
                      onAddPrimitive={handleAddPrimitive}
                      tools={tools}
                      isLoading={isLoading}
                      onExecuteTool={onExecuteTool}
                      hasToken={!!token}
                    />

                    {/* 100% Three.js Canvas Container */}
                    <div
                      ref={containerRef}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onDoubleClick={handleDoubleClick}
                      className="flex-1 w-full h-full relative overflow-hidden outline-none cursor-grab active:cursor-grabbing"
                    >
                      {/* Friendly Live Numeric Dragging Badge (Attached to Mouse) */}
                      {liveDragBadge && (
                        <div
                          className="pointer-events-none fixed z-50 px-2 py-1 rounded bg-[#18181b] border border-[#ea580c] text-white font-mono text-[11px] shadow-2xl flex items-center space-x-1.5 transform -translate-x-1/2 -translate-y-full mb-2"
                          style={{
                            left: `${liveDragBadge.x}px`,
                            top: `${liveDragBadge.y - 12}px`,
                          }}
                        >
                          <span className="font-bold text-[#ea580c] uppercase">{liveDragBadge.type}</span>
                          <span className="text-[#52525b]">|</span>
                          <span className="font-bold text-[#f4f4f5]">{liveDragBadge.text}</span>
                        </div>
                      )}

                      {/* Active CAD Model Synthesis Progress HUD */}
                      {isLoadingModel && (
                        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none pointer-events-auto animate-fade-in">
                          <div className="w-full max-w-md mx-4 p-5 rounded bg-[#141416] border border-[#ea580c] shadow-2xl font-mono text-xs text-[#f4f4f5] space-y-3.5">
                            {/* Header */}
                            <div className="flex items-center justify-between pb-2.5 border-b border-[#27272a]">
                              <div className="flex items-center space-x-2 text-[#ea580c]">
                                <Loader2 className="w-4 h-4 animate-spin text-[#ea580c]" />
                                <span className="font-bold tracking-wider uppercase text-[11px]">
                                  SYNTHESIZING 3D CAD MODEL
                                </span>
                              </div>
                              <span className="text-[10px] text-[#ea580c] font-bold px-2 py-0.5 rounded bg-[#202024] border border-[#27272a]">
                                {synthesisProgress}%
                              </span>
                            </div>

                            {/* Active Prompt Label */}
                            {activeSynthesisPrompt && (
                              <div className="p-2 rounded bg-[#18181b] border border-[#27272a] text-[11px] text-[#e4e4e7] truncate flex items-center space-x-2">
                                <span className="text-[#ea580c] font-bold shrink-0">PROMPT:</span>
                                <span className="truncate italic text-[#a1a1aa]">"{activeSynthesisPrompt}"</span>
                              </div>
                            )}

                            {/* Progress Bar & Current Status */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-[#f4f4f5] font-semibold">{synthesisStep || "Synthesizing geometry..."}</span>
                                <span className="text-[#ea580c] animate-pulse">In Progress</span>
                              </div>
                              <div className="w-full h-2 bg-[#202024] rounded-full overflow-hidden border border-[#27272a]">
                                <div
                                  className="h-full bg-gradient-to-r from-[#ea580c] to-[#f59e0b] transition-all duration-200 ease-out"
                                  style={{ width: `${synthesisProgress}%` }}
                                />
                              </div>
                            </div>

                            {/* Live Sub-Stage Checklist */}
                            <div className="grid grid-cols-2 gap-1.5 text-[10px] text-[#71717a] pt-1 border-t border-[#27272a]">
                              <div className={`flex items-center space-x-1.5 ${synthesisProgress >= 15 ? "text-emerald-400 font-medium" : ""}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${synthesisProgress >= 15 ? "bg-emerald-400" : "bg-[#52525b]"}`} />
                                <span>Topology Analysis</span>
                              </div>
                              <div className={`flex items-center space-x-1.5 ${synthesisProgress >= 40 ? "text-emerald-400 font-medium" : ""}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${synthesisProgress >= 40 ? "bg-emerald-400" : "bg-[#52525b]"}`} />
                                <span>Geometry Synthesis</span>
                              </div>
                              <div className={`flex items-center space-x-1.5 ${synthesisProgress >= 65 ? "text-emerald-400 font-medium" : ""}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${synthesisProgress >= 65 ? "bg-emerald-400" : "bg-[#52525b]"}`} />
                                <span>Normals Computing</span>
                              </div>
                              <div className={`flex items-center space-x-1.5 ${synthesisProgress >= 85 ? "text-emerald-400 font-medium" : ""}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${synthesisProgress >= 85 ? "bg-emerald-400" : "bg-[#52525b]"}`} />
                                <span>PBR Materials</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Shading Radial Pie Menu Overlay (Z Hotkey) */}
                      {isPieMenuOpen && (
                        <div
                          className="absolute inset-0 z-40 flex items-center justify-center bg-black/60"
                          onClick={() => setIsPieMenuOpen(false)}
                        >
                          <div
                            className="relative w-64 h-64 rounded-full border border-[#52525b] bg-[#18181b]/95 p-3 flex items-center justify-center shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-col items-center justify-center text-center">
                              <span className="text-[11px] font-mono font-bold text-[#ea580c] uppercase">{shadingMode}</span>
                              <span className="text-[9px] text-[#71717a] font-mono mt-0.5">SHADING PIE</span>
                            </div>

                            {/* Top: 8 - Material Preview */}
                            <button
                              type="button"
                              onClick={() => {
                                setShadingMode("material");
                                setIsPieMenuOpen(false);
                              }}
                              className={`absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-sm border text-[11px] font-mono flex items-center space-x-1 transition-colors ${
                                shadingMode === "material"
                                  ? "bg-[#ea580c] text-white border-[#ea580c]"
                                  : "bg-[#27272a] text-[#f4f4f5] border-[#3f3f46] hover:bg-[#3f3f46]"
                              }`}
                            >
                              <Palette className="w-3 h-3 text-[#f4f4f5]" />
                              <span>8: Material</span>
                            </button>

                            {/* Left: 4 - Wireframe */}
                            <button
                              type="button"
                              onClick={() => {
                                setShadingMode("wireframe");
                                setIsPieMenuOpen(false);
                              }}
                              className={`absolute left-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-sm border text-[11px] font-mono flex items-center space-x-1 transition-colors ${
                                shadingMode === "wireframe"
                                  ? "bg-[#ea580c] text-white border-[#ea580c]"
                                  : "bg-[#27272a] text-[#f4f4f5] border-[#3f3f46] hover:bg-[#3f3f46]"
                              }`}
                            >
                              <Grid className="w-3 h-3 text-[#f4f4f5]" />
                              <span>4: Wireframe</span>
                            </button>

                            {/* Right: 6 - Solid */}
                            <button
                              type="button"
                              onClick={() => {
                                setShadingMode("solid");
                                setIsPieMenuOpen(false);
                              }}
                              className={`absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-sm border text-[11px] font-mono flex items-center space-x-1 transition-colors ${
                                shadingMode === "solid"
                                  ? "bg-[#ea580c] text-white border-[#ea580c]"
                                  : "bg-[#27272a] text-[#f4f4f5] border-[#3f3f46] hover:bg-[#3f3f46]"
                              }`}
                            >
                              <Box className="w-3 h-3 text-[#f4f4f5]" />
                              <span>6: Solid</span>
                            </button>

                            {/* Bottom: 2 - Rendered / Normals */}
                            <button
                              type="button"
                              onClick={() => {
                                setShadingMode("normals");
                                setIsPieMenuOpen(false);
                              }}
                              className={`absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-sm border text-[11px] font-mono flex items-center space-x-1 transition-colors ${
                                shadingMode === "normals"
                                  ? "bg-[#ea580c] text-white border-[#ea580c]"
                                  : "bg-[#27272a] text-[#f4f4f5] border-[#3f3f46] hover:bg-[#3f3f46]"
                              }`}
                            >
                              <Sun className="w-3 h-3 text-[#f4f4f5]" />
                              <span>2: Normals</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Mode Switcher Radial Pie Menu Overlay (Tab Hotkey) */}
                      {isTabPieMenuOpen && (
                        <div
                          className="absolute inset-0 z-40 flex items-center justify-center bg-black/60"
                          onClick={() => setIsTabPieMenuOpen(false)}
                        >
                          <div
                            className="relative w-64 h-64 rounded-full border border-[#52525b] bg-[#18181b]/95 p-3 flex items-center justify-center shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Center: Object Mode (1) */}
                            <button
                              type="button"
                              onClick={() => {
                                setInteractionMode("object");
                                setIsTabPieMenuOpen(false);
                              }}
                              className={`flex flex-col items-center justify-center p-2 rounded-full border transition-colors ${
                                interactionMode === "object"
                                  ? "bg-[#ea580c] text-white border-[#ea580c]"
                                  : "bg-[#27272a] text-[#f4f4f5] border-[#3f3f46] hover:bg-[#3f3f46]"
                              }`}
                            >
                              <Box className="w-4 h-4" />
                              <span className="text-[10px] font-mono font-bold mt-0.5">1: OBJECT</span>
                            </button>

                            {/* Top: Edit Mode (Tab or 2) */}
                            <button
                              type="button"
                              onClick={() => {
                                setInteractionMode("edit");
                                setIsTabPieMenuOpen(false);
                              }}
                              className={`absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-sm border text-[11px] font-mono flex items-center space-x-1 transition-colors ${
                                interactionMode === "edit"
                                  ? "bg-[#ea580c] text-white border-[#ea580c]"
                                  : "bg-[#27272a] text-[#f4f4f5] border-[#3f3f46] hover:bg-[#3f3f46]"
                              }`}
                            >
                              <Component className="w-3 h-3 text-emerald-400" />
                              <span>Tab: Edit</span>
                            </button>

                            {/* Left: Sculpt Mode (3) */}
                            <button
                              type="button"
                              onClick={() => {
                                setInteractionMode("sculpt");
                                setIsTabPieMenuOpen(false);
                              }}
                              className={`absolute left-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-sm border text-[11px] font-mono flex items-center space-x-1 transition-colors ${
                                interactionMode === "sculpt"
                                  ? "bg-[#ea580c] text-white border-[#ea580c]"
                                  : "bg-[#27272a] text-[#f4f4f5] border-[#3f3f46] hover:bg-[#3f3f46]"
                              }`}
                            >
                              <Brush className="w-3 h-3 text-sky-400" />
                              <span>3: Sculpt</span>
                            </button>

                            {/* Right: Vertex Paint Mode (4) */}
                            <button
                              type="button"
                              onClick={() => {
                                setInteractionMode("paint");
                                setIsTabPieMenuOpen(false);
                              }}
                              className={`absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-sm border text-[11px] font-mono flex items-center space-x-1 transition-colors ${
                                interactionMode === "paint"
                                  ? "bg-[#ea580c] text-white border-[#ea580c]"
                                  : "bg-[#27272a] text-[#f4f4f5] border-[#3f3f46] hover:bg-[#3f3f46]"
                              }`}
                            >
                              <Paintbrush className="w-3 h-3 text-amber-400" />
                              <span>4: Paint</span>
                            </button>

                            {/* Bottom: Weight Paint Mode (5) */}
                            <button
                              type="button"
                              onClick={() => {
                                setInteractionMode("weight");
                                setIsTabPieMenuOpen(false);
                              }}
                              className={`absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-sm border text-[11px] font-mono flex items-center space-x-1 transition-colors ${
                                interactionMode === "weight"
                                  ? "bg-[#ea580c] text-white border-[#ea580c]"
                                  : "bg-[#27272a] text-[#f4f4f5] border-[#3f3f46] hover:bg-[#3f3f46]"
                              }`}
                            >
                              <Scale className="w-3 h-3 text-violet-400" />
                              <span>5: Weight</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Shift + A Contextual Quick-Add Menu Popup */}
                      {isQuickAddOpen && (
                        <div
                          className="fixed inset-0 z-50 select-none"
                          onClick={() => setIsQuickAddOpen(false)}
                        >
                          <div
                            style={{ left: `${quickAddPos.x}px`, top: `${quickAddPos.y}px` }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute w-48 bg-[#18181b]/98 border border-[#3f3f46] shadow-2xl rounded-sm p-1 text-[11px] font-mono space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
                          >
                            <div className="flex items-center justify-between px-2 py-1 border-b border-[#27272a] text-[9px] uppercase font-bold text-[#71717a]">
                              <span>Add Primitive</span>
                              <span className="text-[#ea580c]">Shift + A</span>
                            </div>
                            {[
                              { type: "cube", label: "Cube", icon: <Box className="w-3.5 h-3.5 text-[#ea580c]" /> },
                              { type: "uv_sphere", label: "UV Sphere", icon: <Circle className="w-3.5 h-3.5 text-sky-400" /> },
                              { type: "cylinder", label: "Cylinder", icon: <Layers className="w-3.5 h-3.5 text-emerald-400" /> },
                              { type: "cone", label: "Cone", icon: <Compass className="w-3.5 h-3.5 text-amber-400" /> },
                              { type: "torus", label: "Torus", icon: <Circle className="w-3.5 h-3.5 text-pink-400" /> },
                              { type: "plane", label: "Plane", icon: <Square className="w-3.5 h-3.5 text-blue-400" /> },
                              { type: "suzanne", label: "Monkey (Suzanne)", icon: <Sparkles className="w-3.5 h-3.5 text-orange-400" /> },
                            ].map((p) => (
                              <button
                                key={p.type}
                                type="button"
                                onClick={() => {
                                  handleAddPrimitive(p.type);
                                  setIsQuickAddOpen(false);
                                }}
                                className="w-full flex items-center space-x-2 px-2 py-1 rounded-xs text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5] transition-colors"
                              >
                                {p.icon}
                                <span>{p.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bottom-Left Parametric Operator Adjustment Popup */}
                      {lastAddedPrimitive && (
                        <div className="absolute bottom-10 left-3 bg-[#1f1f23] border border-[#ea580c]/60 rounded-sm shadow-2xl p-2 w-52 z-30 text-xs space-y-1.5">
                          <div className="flex items-center justify-between border-b border-[#3f3f46] pb-1">
                            <span className="font-mono text-[10px] uppercase font-bold text-[#f4f4f5]">
                              {lastAddedPrimitive.type.toUpperCase()} PARAMETERS
                            </span>
                            <button
                              type="button"
                              onClick={() => setLastAddedPrimitive(null)}
                              className="text-[#71717a] hover:text-[#f4f4f5]"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="space-y-1 text-[10px]">
                            <div className="flex justify-between text-[#a1a1aa]">
                              <span>Scale Size</span>
                              <span className="font-mono text-[#ea580c]">{lastAddedPrimitive.mesh.scale.x.toFixed(2)}x</span>
                            </div>
                            <input
                              type="range"
                              min="0.2"
                              max="3.0"
                              step="0.1"
                              defaultValue="1.0"
                              onChange={(e) => {
                                const s = parseFloat(e.target.value);
                                lastAddedPrimitive.mesh.scale.set(s, s, s);
                                syncMeshTransform(lastAddedPrimitive.mesh);
                                if (universalGizmoRef.current) universalGizmoRef.current.update();
                              }}
                              className="w-full accent-[#ea580c]"
                            />
                          </div>
                          <p className="text-[8px] text-[#71717a] font-mono leading-tight">
                            Interactive parametric adjustments update geometry buffer in real time.
                          </p>
                        </div>
                      )}

                      {/* Hardware-Accelerated 2D/3D Canvas HUD Overlay */}
                      <CanvasOverlay
                        camera={isOrtho ? orthoCameraRef.current : cameraRef.current}
                        selectedMesh={selectedMesh}
                        selectedMeshes={selectedMeshes}
                        currentModel={rootModelGroupRef.current}
                        meshList={meshList.map((m) => ({ name: m.name, meshRef: m.meshRef }))}
                        onSelectMesh={(meshName) => selectMeshByName(meshName)}
                        onSelectMultiple={selectMultipleMeshes}
                        selectionTool={selectionTool}
                        onSetSelectionTool={setSelectionTool}
                        transformMode={
                          (["all", "select", "translate", "rotate", "scale"] as const).includes(transformMode as any)
                            ? (transformMode as any)
                            : "select"
                        }
                        liveTransform={liveTransform}
                        axisConstraint={axisConstraint}
                        showDimensions={showDimensions}
                        onToggleDimensions={() => setShowDimensions((p) => !p)}
                      />

                      {/* Floating Transform Numeric Input Pill */}
                      {((isModalTransforming && selectedMesh) || typedNumericBuffer !== "") && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2 bg-[#18181b]/95 border border-[#ea580c] px-3 py-1.5 rounded-sm shadow-xl font-mono text-xs text-[#f4f4f5]">
                          <span className="font-bold text-[#ea580c] uppercase">
                            {transformMode === "translate"
                              ? "G: TRANSLATE"
                              : transformMode === "rotate"
                              ? isTrackball
                                ? "R: TRACKBALL"
                                : "R: ROTATE"
                              : transformMode === "scale"
                              ? "S: SCALE"
                              : "TRANSFORM"}
                          </span>
                          <span className="text-[#3f3f46]">|</span>
                          {transformMode === "translate" && (
                            <span>
                              X: {liveTransform.pos[0].toFixed(2)}m  Y: {liveTransform.pos[1].toFixed(2)}m  Z: {liveTransform.pos[2].toFixed(2)}m
                            </span>
                          )}
                          {transformMode === "rotate" && (
                            <span>
                              X: {liveTransform.rot[0].toFixed(1)}°  Y: {liveTransform.rot[1].toFixed(1)}°  Z: {liveTransform.rot[2].toFixed(1)}°
                            </span>
                          )}
                          {transformMode === "scale" && (
                            <span>
                              X: {liveTransform.scale[0].toFixed(2)}x  Y: {liveTransform.scale[1].toFixed(2)}x  Z: {liveTransform.scale[2].toFixed(2)}x
                            </span>
                          )}
                          {axisConstraint !== "none" && (
                            <span className="px-1 py-0.2 bg-[#ea580c]/20 text-[#ea580c] text-[10px] uppercase font-bold rounded">
                              [{axisConstraint}]
                            </span>
                          )}
                          {typedNumericBuffer ? (
                            <span className="px-1.5 py-0.5 bg-[#ea580c] text-white rounded font-bold">
                              VAL: {typedNumericBuffer} (Enter)
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#71717a]">
                              (Type numbers, Enter to commit, Esc to cancel)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Sleek Floating CAD Command Prompt Bar (Bottom-Center) */}
                      <ModelPromptBar
                        onGenerate={handleGenerateModelFromPrompt}
                        isLoading={isLoadingModel || isLoading}
                        token={token}
                        onOpenKeyModal={() => setIsKeyModalOpen(true)}
                        activeStep={synthesisStep}
                        generationMode={generationMode}
                        onToggleGenerationMode={handleToggleGenerationMode}
                      />
                    </div>

                    {/* N-Panel Right Properties Strip (Drawer collapsible with N) */}
                    <BlenderNPanel
                      isOpen={isNOpen}
                      onToggleOpen={() => setIsNOpen(!isNOpen)}
                      selectedMeshName={selectedMesh?.name || null}
                      selectedMeshNames={selectedMeshes.map((m) => m.name)}
                      meshList={meshList}
                      onSelectMesh={(name) => selectMeshByName(name)}
                      onToggleSelectMesh={toggleMeshByName}
                      onToggleMeshVisibility={handleToggleMeshVisibility}
                      lockedMeshes={lockedMeshes}
                      onToggleMeshLock={handleToggleMeshLock}
                      transform={selectedTransform}
                      onUpdateTransform={handleUpdateTransform}
                      onPlaceOnFloor={handlePlaceOnFloor}
                      onCenterOrigin={handleCenterToOrigin}
                      onResetRotation={handleResetRotation}
                      onResetScale={handleResetScale}
                      simplifyRatio={simplifyRatio}
                      onDecimate={handleSimplifyRatioChange}
                      onSubdivide={handleSubdivide}
                      isWireframe={shadingMode === "wireframe"}
                      onToggleWireframe={() => setShadingMode(shadingMode === "wireframe" ? "solid" : "wireframe")}
                      onApplyModifier={(type, params) => {
                        if (type === "subdivide") handleSubdivide();
                        showUndoToast(`Apply ${type}`);
                      }}
                      currentRoughness={matRoughness}
                      currentMetalness={matMetalness}
                      currentColor={matColor}
                      onUpdateMaterial={handleUpdateSelectedMaterial}
                      script={script}
                      assetUrl={assetUrl}
                      onExecuteScript={onExecuteRawScript}
                      isLoading={isLoading}
                      stdout={stdout}
                      stderr={stderr}
                    />
                  </div>
                );

              case "timeline":
                return (
                  <BlenderTimeline
                    isOpen={true}
                    onToggleOpen={() => {}}
                    isPlaying={isPlaying}
                    onTogglePlay={() => setIsPlaying(!isPlaying)}
                    onRewind={() => handleSeekFrame(0)}
                    currentFrame={currentFrame}
                    totalFrames={totalFrames}
                    onSeekFrame={handleSeekFrame}
                    isLooping={isLooping}
                    onToggleLoop={() => setIsLooping(!isLooping)}
                    turntableMode={turntableMode}
                    onToggleTurntableMode={setTurntableMode}
                    keyframes={keyframes}
                    onAddKeyframe={handleAddKeyframe}
                    onMoveKeyframe={handleMoveKeyframe}
                    onDeleteKeyframe={handleDeleteKeyframe}
                    activeObjectName={selectedMesh?.name}
                    interpolation={interpolation}
                    onChangeInterpolation={handleChangeInterpolation}
                    explodedFactor={explodedFactor}
                    onExplodedChange={handleExplodedChange}
                    audioSynthesizer={audioSynthesizerRef.current}
                  />
                );

              case "graph_editor":
                return (
                  <GraphEditorCanvas
                    currentFrame={currentFrame}
                    totalFrames={totalFrames}
                    onSeekFrame={handleSeekFrame}
                    isPlaying={isPlaying}
                    onTogglePlay={() => setIsPlaying(!isPlaying)}
                    onRewind={() => handleSeekFrame(0)}
                  />
                );

              case "outliner":
                return (
                  <OutlinerEditor
                    meshList={meshList}
                    selectedMeshName={selectedMesh?.name || null}
                    selectedMeshNames={selectedMeshes.map((m) => m.name)}
                    onSelectMesh={(name) => selectMeshByName(name)}
                    onToggleSelectMesh={toggleMeshByName}
                    onSelectAll={() => {
                      const allMeshes = meshList.map((m) => m.meshRef).filter(Boolean);
                      setSelectedMeshes(allMeshes);
                      if (allMeshes.length > 0) onMeshSelect?.(allMeshes[allMeshes.length - 1].name);
                    }}
                    onDeselectAll={() => {
                      setSelectedMeshes([]);
                      onMeshSelect?.(null);
                    }}
                    onAddPrimitive={handleAddPrimitive}
                    onToggleMeshVisibility={handleToggleMeshVisibility}
                    lockedMeshes={lockedMeshes}
                    onToggleMeshLock={handleToggleMeshLock}
                  />
                );

              case "properties":
                return (
                  <PropertiesEditor
                    selectedMeshName={selectedMesh?.name || null}
                    onSelectMesh={(name) => selectMeshByName(name)}
                    transform={selectedTransform}
                    onUpdateTransform={handleUpdateTransform}
                    onPlaceOnFloor={handlePlaceOnFloor}
                    onCenterOrigin={handleCenterToOrigin}
                    onResetRotation={handleResetRotation}
                    onResetScale={handleResetScale}
                    simplifyRatio={simplifyRatio}
                    onDecimate={handleSimplifyRatioChange}
                    onSubdivide={handleSubdivide}
                    isWireframe={shadingMode === "wireframe"}
                    onToggleWireframe={() => setShadingMode(shadingMode === "wireframe" ? "solid" : "wireframe")}
                    currentRoughness={matRoughness}
                    currentMetalness={matMetalness}
                    currentColor={matColor}
                    onUpdateMaterial={handleUpdateSelectedMaterial}
                  />
                );

              case "script":
                return (
                  <ScriptingEditor
                    script={script}
                    assetUrl={assetUrl}
                    onExecuteScript={onExecuteRawScript}
                    isLoading={isLoading}
                    stdout={stdout}
                    stderr={stderr}
                  />
                );

              case "director":
                return (
                  <DirectorEditor
                    sceneDescriptor={narrativeDescriptor}
                    onGeneratePrompt={handleGenerateNarrativeScene}
                    onOpenExportModal={() => setIsVideoExportModalOpen(true)}
                    onResetScene={handleResetNarrativeScene}
                    isGenerating={isGeneratingNarrative}
                  />
                );

              case "mcp_console":
                return (
                  <McpConsoleEditor
                    onExecuteTool={(toolName, params) => {
                      if (toolName === "blender_eval" && params.code) {
                        onExecuteRawScript?.(params.code);
                      } else if (onExecuteTool) {
                        onExecuteTool(toolName, { format: "glb", ...params } as any);
                      }
                    }}
                    isLoading={isLoading}
                  />
                );
            }
          }}
        />
      </div>

      {/* Viewport Bottom Status Bar (Real-Time DCC Telemetry & Contextual Key Hints HUD) */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-[#27272a] bg-[#18181b] text-[11px] text-[#a1a1aa] font-mono">
        <div className="flex items-center space-x-4">
          {telemetry ? (
            <>
              <span>TRIS: <strong className="text-[#f4f4f5]">{telemetry.triangles.toLocaleString()}</strong></span>
              <span>VERTS: <strong className="text-[#f4f4f5]">{telemetry.vertices.toLocaleString()}</strong></span>
              <span>EDGES: <strong className="text-[#f4f4f5]">{telemetry.edges.toLocaleString()}</strong></span>
              <span>DIMS: <strong className="text-[#f4f4f5]">{telemetry.dimensions.join(" × ")}m</strong></span>
              {telemetry.materials && telemetry.materials.length > 0 && (
                <span className="hidden sm:inline">MATS: <strong className="text-[#f4f4f5]">{telemetry.materials.join(", ")}</strong></span>
              )}
            </>
          ) : stats ? (
            <>
              <span>TRIS: <strong className="text-[#f4f4f5]">{stats.triangles.toLocaleString()}</strong></span>
              <span>VERTS: <strong className="text-[#f4f4f5]">{stats.vertices.toLocaleString()}</strong></span>
              <span>BOUNDS: <strong className="text-[#f4f4f5]">{stats.dimensions}</strong></span>
            </>
          ) : (
            <span>STANDBY</span>
          )}
        </div>

        {/* Onboarding Gentle Hint Ribbon (Friendly Context Bar) */}
        {selectedMesh ? (
          <div className="flex items-center space-x-3 text-[11px] font-sans text-[#a1a1aa]">
            <span className="text-[#ea580c] font-semibold">Drag arrows to move</span>
            <span className="text-[#52525b]">•</span>
            <span>Drag rings to turn</span>
            <span className="text-[#52525b]">•</span>
            <span>Drag cubes to scale</span>
            <span className="text-[#52525b]">•</span>
            <span className="text-[#f4f4f5]">Hold Shift: Drop on floor</span>
            <span className="text-[#52525b]">•</span>
            <span>Double click: Focus</span>
            <span className="text-[#52525b]">•</span>
            <span>Del: Delete</span>
            {onOpenShortcuts && (
              <button
                type="button"
                onClick={onOpenShortcuts}
                className="text-[#f4f4f5] hover:text-[#ea580c] font-mono text-[10px] underline ml-2"
              >
                F1: Cheatsheet
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-3 text-[11px] font-sans text-[#71717a]">
            <span className="text-[#f4f4f5] font-medium">Click any object to select & edit</span>
            <span className="text-[#3f3f46]">•</span>
            <span>Drag empty space to rotate view</span>
            <span className="text-[#3f3f46]">•</span>
            <span>Scroll to zoom</span>
            <span className="text-[#3f3f46]">•</span>
            <span>Shift + drag to pan</span>
            {onOpenShortcuts && (
              <button
                type="button"
                onClick={onOpenShortcuts}
                className="text-[#a1a1aa] hover:text-[#f4f4f5] font-mono text-[10px] underline ml-2"
              >
                F1: Hotkeys
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bring Your Own Key (BYOK) Gemini / Custom API Key Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        token={token || ""}
        onSaveToken={onSaveToken || (() => {})}
        onClearToken={onClearToken || (() => {})}
      />
    </div>
  );
}
