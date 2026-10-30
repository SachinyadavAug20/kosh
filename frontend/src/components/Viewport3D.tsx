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
import { ExportFormat } from "@/types/mcp";
import { Timeline, KeyframeMarker, InterpolationType } from "./Timeline";
import { FloatingInspector, SwatchPreset } from "./FloatingInspector";
import { SimplifyModifier } from "three/examples/jsm/modifiers/SimplifyModifier.js";
import { CanvasOverlay } from "./CanvasOverlay";
import { DccQuickTray, LightingStage } from "./DccQuickTray";
import { UniversalGizmo, GizmoMode, DragBadgeInfo } from "./UniversalGizmo";
import {
  Download,
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
} from "lucide-react";

export type ShadingMode = "solid" | "material" | "wireframe" | "normals";
export type MatcapPreset = "studio" | "clay" | "redwax" | "chrome" | "obsidian" | "pearl" | "check" | "zebra" | "toon";
export type InteractionMode = "object" | "edit" | "sculpt" | "paint" | "weight";
export type EditElement = "vertex" | "edge" | "face";
export type SculptBrush = "draw" | "clay" | "inflate" | "flatten" | "grab" | "crease" | "smooth";
export type CameraView = "iso" | "front" | "back" | "top" | "bottom" | "right" | "left";
export type AxisConstraint = "none" | "x" | "y" | "z" | "shift-x" | "shift-y" | "shift-z";
export type SnapTarget = "closest" | "center" | "median" | "active";
export type SnapElement = "increment" | "vertex" | "edge" | "face" | "volume";
export type TransformMode = "all" | "select" | "translate" | "rotate" | "scale";

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
  onOpenShortcuts,
  liveMaterialUpdate,
  liveExplodedFactor,
  liveTurntable,
  liveHover,
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

  // Snapping Engine State
  const [snapEnabled, setSnapEnabled] = useState<boolean>(false);
  const [isSnapPopoverOpen, setIsSnapPopoverOpen] = useState<boolean>(false);
  const [snapTo, setSnapTo] = useState<SnapElement>("increment");
  const [snapTarget, setSnapTarget] = useState<SnapTarget>("closest");
  const [rotationSnapStep, setRotationSnapStep] = useState<number>(15); // degrees
  const [gridSnapUnit, setGridSnapUnit] = useState<number>(0.5); // meters
  const [isCtrlHeld, setIsCtrlHeld] = useState<boolean>(false);
  const [isShiftHeld, setIsShiftHeld] = useState<boolean>(false);

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
  const [selectedMesh, setSelectedMesh] = useState<THREE.Mesh | null>(null);

  // Pre-Transform Snapshot for RMB / Esc Cancel
  const preTransformSnapshotRef = useRef<{
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
  } | null>(null);

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
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
  const uvCheckerTextureRef = useRef<THREE.CanvasTexture | null>(null);

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
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction[]>([]);

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

    // D. OrbitControls
    const orbit = new OrbitControls(perspCamera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.05;
    orbit.target.set(0, 0.7, 0);
    orbit.maxDistance = 100;
    orbit.minDistance = 0.5;
    orbitControlsRef.current = orbit;

    // E. TransformControls
    const transform = new TransformControls(perspCamera, renderer.domElement);
    transform.size = 0.65;
    transform.addEventListener("dragging-changed", (event) => {
      orbit.enabled = !event.value;
      if (event.value) {
        // Transform drag started: snapshot initial pose for cancel
        const obj = transform.object;
        if (obj) {
          preTransformSnapshotRef.current = {
            position: obj.position.clone(),
            rotation: obj.rotation.clone(),
            scale: obj.scale.clone(),
          };
        }
      }
    });
    transform.addEventListener("objectChange", () => {
      const obj = transform.object;
      if (obj) {
        setLiveTransform({
          pos: [
            parseFloat(obj.position.x.toFixed(2)),
            parseFloat(obj.position.y.toFixed(2)),
            parseFloat(obj.position.z.toFixed(2)),
          ],
          rot: [
            parseFloat(THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1)),
            parseFloat(THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1)),
            parseFloat(THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1)),
          ],
          scale: [
            parseFloat(obj.scale.x.toFixed(2)),
            parseFloat(obj.scale.y.toFixed(2)),
            parseFloat(obj.scale.z.toFixed(2)),
          ],
        });
        if (selectionBoxHelperRef.current) {
          selectionBoxHelperRef.current.update();
        }
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
      },
      onDragMove: (badge) => {
        setLiveDragBadge(badge);
      },
      onDragEnd: () => {
        orbit.enabled = true;
        setLiveDragBadge(null);
      },
      onObjectChange: () => {
        const obj = universalGizmo.getTarget();
        if (obj) {
          setLiveTransform({
            pos: [
              parseFloat(obj.position.x.toFixed(2)),
              parseFloat(obj.position.y.toFixed(2)),
              parseFloat(obj.position.z.toFixed(2)),
            ],
            rot: [
              parseFloat(THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1)),
              parseFloat(THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1)),
              parseFloat(THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1)),
            ],
            scale: [
              parseFloat(obj.scale.x.toFixed(2)),
              parseFloat(obj.scale.y.toFixed(2)),
              parseFloat(obj.scale.z.toFixed(2)),
            ],
          });
          if (selectionBoxHelperRef.current) selectionBoxHelperRef.current.update();
        }
      },
    });
    scene.add(universalGizmo.group);
    universalGizmoRef.current = universalGizmo;

    // F. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(5, 10, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);
    keyLightRef.current = keyLight;

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.7);
    fillLight.position.set(-6, 3, -5);
    scene.add(fillLight);
    fillLightRef.current = fillLight;

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    rimLight.position.set(0, -5, -6);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

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

    const axes = new THREE.AxesHelper(2.5);
    axes.position.set(0, 0.001, 0);
    scene.add(axes);
    axesHelperRef.current = axes;

    // H. Root Groups
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    rootModelGroupRef.current = modelGroup;

    const wireOverlayGroup = new THREE.Group();
    scene.add(wireOverlayGroup);
    wireOverlayGroupRef.current = wireOverlayGroup;

    // I. Selection Box Outline Helper
    const boxHelper = new THREE.BoxHelper(new THREE.Mesh(), 0xea580c);
    boxHelper.visible = false;
    scene.add(boxHelper);
    selectionBoxHelperRef.current = boxHelper;

    // Sculpt Brush Ring Indicator Cursor
    const ringGeo = new THREE.RingGeometry(0.32, 0.35, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xea580c, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.visible = false;
    scene.add(ringMesh);
    sculptRingRef.current = ringMesh;

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
      if (isPlaying && turntableMode === "loop") {
        setCurrentFrame((prev) => {
          if (prev >= totalFrames) {
            return isLooping ? 0 : totalFrames;
          }
          return prev + 1;
        });
      }

      orbit.update();
      universalGizmo.update();
      const activeCamera = isOrtho ? orthoCamera : perspCamera;
      universalGizmo.setCamera(activeCamera);
      renderer.render(scene, activeCamera);
    };
    animate();

    // K. Resize Listener
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
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      orbit.dispose();
      transform.dispose();
      renderer.dispose();
      universalGizmo.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

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
    const intersects = raycasterRef.current.intersectObjects(currentModelRef.current.children, true);

    if (intersects.length > 0) {
      let hitMesh: THREE.Mesh | null = null;
      for (const hit of intersects) {
        if (hit.object instanceof THREE.Mesh) {
          hitMesh = hit.object;
          break;
        }
      }

      if (hitMesh) {
        setSelectedMesh(hitMesh);
        onMeshSelect?.(hitMesh.name);
        universalGizmoRef.current?.attach(hitMesh);

        // Update live transform state to match selected mesh
        setLiveTransform({
          pos: [
            parseFloat(hitMesh.position.x.toFixed(2)),
            parseFloat(hitMesh.position.y.toFixed(2)),
            parseFloat(hitMesh.position.z.toFixed(2)),
          ],
          rot: [
            parseFloat(THREE.MathUtils.radToDeg(hitMesh.rotation.x).toFixed(1)),
            parseFloat(THREE.MathUtils.radToDeg(hitMesh.rotation.y).toFixed(1)),
            parseFloat(THREE.MathUtils.radToDeg(hitMesh.rotation.z).toFixed(1)),
          ],
          scale: [
            parseFloat(hitMesh.scale.x.toFixed(2)),
            parseFloat(hitMesh.scale.y.toFixed(2)),
            parseFloat(hitMesh.scale.z.toFixed(2)),
          ],
        });

        // Read current material values
        const mat = hitMesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.color) {
          setMatColor(`#${mat.color.getHexString()}`);
          setMatRoughness(mat.roughness ?? 0.35);
          setMatMetalness(mat.metalness ?? 0.25);
        }
      }
    } else {
      // Clicked in empty space -> Deselect cleanly and hide gizmo
      setSelectedMesh(null);
      onMeshSelect?.(null);
      universalGizmoRef.current?.attach(null);
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
    const intersects = raycasterRef.current.intersectObjects(currentModelRef.current.children, true);

    if (intersects.length > 0) {
      let hitMesh: THREE.Mesh | null = null;
      for (const hit of intersects) {
        if (hit.object instanceof THREE.Mesh) {
          hitMesh = hit.object;
          break;
        }
      }
      if (hitMesh) {
        setSelectedMesh(hitMesh);
        onMeshSelect?.(hitMesh.name);
        universalGizmoRef.current?.attach(hitMesh);
        smoothFocusObject(hitMesh);
      }
    } else if (currentModelRef.current) {
      smoothFocusObject(currentModelRef.current);
    }
  };

  // Sync selection outline bounding box helper
  useEffect(() => {
    if (!selectionBoxHelperRef.current) return;
    if (selectedMesh) {
      selectionBoxHelperRef.current.setFromObject(selectedMesh);
      selectionBoxHelperRef.current.visible = true;
    } else {
      selectionBoxHelperRef.current.visible = false;
    }
  }, [selectedMesh]);

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

  // Sync Universal Gizmo Attachment on selectedMesh change
  useEffect(() => {
    if (universalGizmoRef.current) {
      universalGizmoRef.current.attach(selectedMesh);
    }
  }, [selectedMesh]);

  // Smooth Focus Camera Animation on Object
  const smoothFocusObject = useCallback((obj: THREE.Object3D) => {
    if (!cameraRef.current || !orbitControlsRef.current) return;
    const box = new THREE.Box3().setFromObject(obj);
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

  // 1-Click Transform Reset Actions for Selected Mesh
  const handlePlaceOnFloor = useCallback(() => {
    if (universalGizmoRef.current) {
      universalGizmoRef.current.placeOnFloor();
    } else if (selectedMesh) {
      const bbox = new THREE.Box3().setFromObject(selectedMesh);
      const bottomOffset = selectedMesh.position.y - bbox.min.y;
      selectedMesh.position.y = bottomOffset;
    }
    if (selectionBoxHelperRef.current) selectionBoxHelperRef.current.update();
  }, [selectedMesh]);

  const handleCenterToOrigin = useCallback(() => {
    if (universalGizmoRef.current) {
      universalGizmoRef.current.centerToOrigin();
    } else if (selectedMesh) {
      selectedMesh.position.set(0, selectedMesh.position.y, 0);
    }
    if (selectionBoxHelperRef.current) selectionBoxHelperRef.current.update();
  }, [selectedMesh]);

  const handleResetRotation = useCallback(() => {
    if (universalGizmoRef.current) {
      universalGizmoRef.current.resetRotation();
    } else if (selectedMesh) {
      selectedMesh.rotation.set(0, 0, 0);
    }
    if (selectionBoxHelperRef.current) selectionBoxHelperRef.current.update();
  }, [selectedMesh]);

  const handleResetScale = useCallback(() => {
    if (universalGizmoRef.current) {
      universalGizmoRef.current.resetScale();
    } else if (selectedMesh) {
      selectedMesh.scale.set(1, 1, 1);
    }
    if (selectionBoxHelperRef.current) selectionBoxHelperRef.current.update();
  }, [selectedMesh]);

  // -------------------------------------------------------------
  // 5. Native Blender Transform Gizmo & Snapping Engine
  // -------------------------------------------------------------
  useEffect(() => {
    if (!transformControlsRef.current) return;
    const tc = transformControlsRef.current;

    if (transformMode === "select" || transformMode === "all") {
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
      if (target) {
        tc.attach(target);
        if (!preTransformSnapshotRef.current) {
          preTransformSnapshotRef.current = {
            position: target.position.clone(),
            rotation: target.rotation.clone(),
            scale: target.scale.clone(),
          };
        }
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

      setLiveTransform({
        pos: [
          parseFloat(target.position.x.toFixed(2)),
          parseFloat(target.position.y.toFixed(2)),
          parseFloat(target.position.z.toFixed(2)),
        ],
        rot: [
          parseFloat(THREE.MathUtils.radToDeg(target.rotation.x).toFixed(1)),
          parseFloat(THREE.MathUtils.radToDeg(target.rotation.y).toFixed(1)),
          parseFloat(THREE.MathUtils.radToDeg(target.rotation.z).toFixed(1)),
        ],
        scale: [
          parseFloat(target.scale.x.toFixed(2)),
          parseFloat(target.scale.y.toFixed(2)),
          parseFloat(target.scale.z.toFixed(2)),
        ],
      });
      if (selectionBoxHelperRef.current) selectionBoxHelperRef.current.update();
    }
    setTransformMode("select");
    setAxisConstraint("none");
    setIsTrackball(false);
    preTransformSnapshotRef.current = null;
  }, [selectedMesh]);

  // Confirm Active Transformation (Left-Click or Enter)
  const handleConfirmTransform = useCallback(() => {
    setTransformMode("select");
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
    const targetObj = selectedMesh || currentModelRef.current;
    if (!targetObj || !orbitControlsRef.current || !cameraRef.current) return;
    const box = new THREE.Box3().setFromObject(targetObj);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const dist = Math.max(sphere.radius * 2.2, 1.5);
    orbitControlsRef.current.target.copy(center);
    cameraRef.current.position.set(center.x + dist * 0.7, center.y + dist * 0.5, center.z + dist * 0.7);
    cameraRef.current.lookAt(center);
    orbitControlsRef.current.update();
  }, [selectedMesh]);

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
    setMatRoughness(rough);
    setMatMetalness(metal);
    if (color) setMatColor(color);

    if (selectedMesh.material instanceof THREE.MeshStandardMaterial) {
      selectedMesh.material.roughness = rough;
      selectedMesh.material.metalness = metal;
      if (color) selectedMesh.material.color.set(color);
      selectedMesh.material.needsUpdate = true;
    }
  }, [selectedMesh]);

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
    if (selectionBoxHelperRef.current) selectionBoxHelperRef.current.update();
  };

  // Duplicate Selected Sub-Mesh (Shift + D)
  const handleDuplicate = useCallback(() => {
    if (!selectedMesh || !currentModelRef.current) return;
    const clone = selectedMesh.clone(true);
    const count = meshList.filter((m) => m.name.startsWith(selectedMesh.name)).length;
    clone.name = `${selectedMesh.name}.${String(count).padStart(3, "0")}`;
    clone.position.x += 0.5;
    clone.updateMatrixWorld();
    selectedMesh.parent?.add(clone);

    const geom = clone.geometry as THREE.BufferGeometry;
    const tris = geom.index ? geom.index.count / 3 : (geom.attributes.position ? geom.attributes.position.count / 3 : 0);
    const verts = geom.attributes.position ? geom.attributes.position.count : 0;

    const newInfo: MeshNodeInfo = {
      id: clone.uuid,
      name: clone.name,
      triangles: Math.round(tris),
      vertices: Math.round(verts),
      visible: true,
      meshRef: clone,
    };
    const updatedList = [...meshList, newInfo];
    setMeshList(updatedList);
    onMeshListUpdate?.(updatedList);
    setSelectedMesh(clone);
    onMeshSelect?.(clone.name);
  }, [selectedMesh, meshList, onMeshListUpdate, onMeshSelect]);

  // Delete Selected Sub-Mesh (X or Delete)
  const handleDelete = useCallback(() => {
    if (!selectedMesh || !currentModelRef.current) return;
    if (transformControlsRef.current) transformControlsRef.current.detach();
    selectedMesh.removeFromParent();

    const newMeshList = meshList.filter((m) => m.name !== selectedMesh.name);
    setMeshList(newMeshList);
    onMeshListUpdate?.(newMeshList);
    setSelectedMesh(null);
    onMeshSelect?.(null);
  }, [selectedMesh, meshList, onMeshListUpdate, onMeshSelect]);

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

  // --- DCC Quick Tools Handlers ---
  const selectMeshByName = useCallback((meshName: string | null) => {
    if (!meshName) {
      setSelectedMesh(null);
      onMeshSelect?.(null);
      if (selectionBoxHelperRef.current) selectionBoxHelperRef.current.visible = false;
      return;
    }
    const hit = meshList.find((m) => m.name === meshName);
    if (hit && hit.meshRef) {
      const hitMesh = hit.meshRef;
      setSelectedMesh(hitMesh);
      onMeshSelect?.(hitMesh.name);
      setLiveTransform({
        pos: [
          parseFloat(hitMesh.position.x.toFixed(2)),
          parseFloat(hitMesh.position.y.toFixed(2)),
          parseFloat(hitMesh.position.z.toFixed(2)),
        ],
        rot: [
          parseFloat(THREE.MathUtils.radToDeg(hitMesh.rotation.x).toFixed(1)),
          parseFloat(THREE.MathUtils.radToDeg(hitMesh.rotation.y).toFixed(1)),
          parseFloat(THREE.MathUtils.radToDeg(hitMesh.rotation.z).toFixed(1)),
        ],
        scale: [
          parseFloat(hitMesh.scale.x.toFixed(2)),
          parseFloat(hitMesh.scale.y.toFixed(2)),
          parseFloat(hitMesh.scale.z.toFixed(2)),
        ],
      });
      const mat = hitMesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.color) {
        setMatColor(`#${mat.color.getHexString()}`);
        if (mat.roughness !== undefined) setMatRoughness(mat.roughness);
        if (mat.metalness !== undefined) setMatMetalness(mat.metalness);
      }
      if (selectionBoxHelperRef.current) {
        selectionBoxHelperRef.current.setFromObject(hitMesh);
        selectionBoxHelperRef.current.visible = true;
      }
    }
  }, [meshList, onMeshSelect]);

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
        setAxisConstraint("none");
        return;
      }
      if (e.key.toLowerCase() === "v" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setTransformMode("select");
        setAxisConstraint("none");
        return;
      }
      if (e.key.toLowerCase() === "w" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setTransformMode("translate");
        setAxisConstraint("none");
        return;
      }
      if (e.key.toLowerCase() === "e" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setTransformMode("rotate");
        setAxisConstraint("none");
        return;
      }

      // Transform Modals: G, R, S
      if (e.key.toLowerCase() === "g" && !e.ctrlKey) {
        e.preventDefault();
        setTransformMode("translate");
        setAxisConstraint("none");
        setIsTrackball(false);
        return;
      }

      if (e.key.toLowerCase() === "r" && !e.ctrlKey) {
        e.preventDefault();
        const now = Date.now();
        if (transformMode === "rotate" && now - lastRPressTimeRef.current < 450) {
          // Double-tap R: Trackball rotation
          setIsTrackball((prev) => !prev);
        } else {
          setTransformMode("rotate");
          setAxisConstraint("none");
          setIsTrackball(false);
        }
        lastRPressTimeRef.current = now;
        return;
      }

      if (e.key.toLowerCase() === "s" && !e.ctrlKey) {
        e.preventDefault();
        setTransformMode("scale");
        setAxisConstraint("none");
        setIsTrackball(false);
        return;
      }

      // Selection: A (Select All) / Alt + A or Double A (Deselect)
      if (e.key.toLowerCase() === "a" && !e.ctrlKey) {
        e.preventDefault();
        if (e.altKey) {
          setSelectedMesh(null);
          onMeshSelect?.(null);
        } else {
          const now = Date.now();
          if (now - lastAPressTimeRef.current < 400 && selectedMesh) {
            setSelectedMesh(null);
            onMeshSelect?.(null);
          } else {
            // Select first mesh or whole object
            if (meshList.length > 0) {
              const target = meshList[0].meshRef;
              setSelectedMesh(target);
              onMeshSelect?.(target.name);
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
  // Direct Multi-Format Exporters (GLB, STL, OBJ, PNG Snapshot)
  // -------------------------------------------------------------
  const handleExportDirect = (exportFmt: "glb" | "stl" | "obj" | "png", alphaBackground = false) => {
    if (!rootModelGroupRef.current || !rendererRef.current) return;
    const baseName = assetName ? assetName.replace(/\.[^/.]+$/, "") : "kosh_scene";

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
      {/* Top DCC Control Strip */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#3f3f46] bg-[#18181b] z-20">
        {/* Left: Mode Switcher, Add Menu & Shading */}
        <div className="flex items-center space-x-1">
          {/* 1. Blender Interaction Mode Switcher */}
          <div className="flex items-center bg-[#1f1f23] border border-[#ea580c]/50 p-0.5 rounded-sm">
            {(["object", "edit", "sculpt", "paint", "weight"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setInteractionMode(m)}
                className={`px-1.5 py-0.5 text-[9px] font-mono capitalize rounded-sm transition-colors ${
                  interactionMode === m
                    ? "bg-[#ea580c] text-white font-bold"
                    : "text-[#a1a1aa] hover:text-[#f4f4f5]"
                }`}
              >
                {m === "object" ? "Object" : m === "edit" ? "Edit" : m === "sculpt" ? "Sculpt" : m === "paint" ? "Paint" : "Weight"}
              </button>
            ))}
          </div>

          {/* 2. Parametric Primitives Insertion Menu (Shift + A) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              className={`tool-btn space-x-1 ${isAddMenuOpen ? "active bg-[#ea580c] text-white" : ""}`}
              title="Add Parametric Primitives (Shift + A)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="font-mono text-[10px]">Add</span>
            </button>

            {isAddMenuOpen && (
              <div className="absolute top-7 left-0 w-44 bg-[#1f1f23] border border-[#52525b] rounded-sm shadow-xl p-1 z-50 text-[10px] space-y-1">
                <div className="text-[9px] font-mono uppercase text-[#71717a] px-1.5 py-0.5 border-b border-[#3f3f46]">
                  Mesh Primitives
                </div>
                <div className="grid grid-cols-2 gap-0.5">
                  {[
                    { id: "cube", label: "Cube" },
                    { id: "cylinder", label: "Cylinder" },
                    { id: "uv_sphere", label: "UV Sphere" },
                    { id: "ico_sphere", label: "Ico Sphere" },
                    { id: "cone", label: "Cone" },
                    { id: "torus", label: "Torus" },
                    { id: "plane", label: "Plane" },
                    { id: "grid", label: "Grid" },
                    { id: "suzanne", label: "Suzanne" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddPrimitive(p.id)}
                      className="px-1.5 py-1 text-left hover:bg-[#27272a] rounded-sm font-mono truncate text-[#f4f4f5]"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="text-[9px] font-mono uppercase text-[#71717a] px-1.5 py-0.5 border-b border-[#3f3f46] pt-1">
                  Lighting & Cameras
                </div>
                <div className="grid grid-cols-2 gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleAddPrimitive("light_point")}
                    className="px-1.5 py-1 text-left hover:bg-[#27272a] rounded-sm font-mono text-[#f4f4f5]"
                  >
                    Point Light
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPrimitive("light_sun")}
                    className="px-1.5 py-1 text-left hover:bg-[#27272a] rounded-sm font-mono text-[#f4f4f5]"
                  >
                    Sun Light
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Shading & Matcaps */}
          <div className="flex items-center bg-[#1f1f23] border border-[#3f3f46] p-0.5 rounded-sm">
            {(["solid", "material", "wireframe", "normals"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setShadingMode(mode)}
                className={`px-2 py-0.5 text-[10px] uppercase font-mono rounded-sm transition-colors ${
                  shadingMode === mode ? "bg-[#3f3f46] text-[#f4f4f5] font-semibold" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {shadingMode === "solid" && (
            <div className="flex items-center bg-[#1f1f23] border border-[#3f3f46] p-0.5 rounded-sm">
              {(["studio", "clay", "redwax", "chrome", "obsidian"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMatcap(m)}
                  className={`px-1.5 py-0.5 text-[10px] capitalize rounded-sm ${
                    matcap === m ? "bg-[#3f3f46] text-[#f4f4f5] font-bold" : "text-[#71717a] hover:text-[#a1a1aa]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {/* X-Ray Toggle Button */}
          <button
            onClick={toggleXRay}
            title="Toggle X-Ray Transparency (Alt + Z)"
            className={`tool-btn ${isXRay ? "active text-[#ea580c]" : ""}`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono hidden md:inline">X-RAY</span>
          </button>

          {/* Active Selected Mesh Chip */}
          {selectedMesh && (
            <div className="flex items-center space-x-1 px-2 py-0.5 bg-[#27272a] border border-[#ea580c] rounded-sm text-[10px] text-[#f4f4f5]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ea580c]" />
              <span className="font-mono font-semibold max-w-[120px] truncate">{selectedMesh.name}</span>
            </div>
          )}
        </div>

        {/* Right: Gizmos, Snapping, Overlays, Direct Downloads */}
        <div className="flex items-center space-x-1">
          {/* Primary Tool Segmented Pill (Q: All, V: Select, W: Move, E: Rotate, R: Scale) */}
          <div className="flex items-center bg-[#18181b] border border-[#333338] p-0.5 rounded-sm space-x-0.5 font-mono text-[10px]">
            <button
              onClick={() => {
                setTransformMode("all");
                setAxisConstraint("none");
              }}
              title="All-In-One Universal Gizmo (Q) — Move, Rotate & Scale simultaneously"
              className={`px-2 py-1 rounded-xs flex items-center space-x-1 transition-colors ${
                transformMode === "all" ? "bg-[#ea580c] text-white font-bold" : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
              }`}
            >
              <Sparkles className="w-3 h-3 text-[#ea580c] group-hover:text-white" />
              <span>All (Q)</span>
            </button>
            <button
              onClick={() => {
                setTransformMode("select");
                setAxisConstraint("none");
              }}
              title="Select Only (V) — Pure raycast click without gizmo"
              className={`px-2 py-1 rounded-xs flex items-center space-x-1 transition-colors ${
                transformMode === "select" ? "bg-[#333338] text-[#f4f4f5] font-bold" : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
              }`}
            >
              <Crosshair className="w-3 h-3" />
              <span>Select (V)</span>
            </button>
            <button
              onClick={() => {
                setTransformMode("translate");
                setAxisConstraint("none");
              }}
              title="Move / Translate (W / G)"
              className={`px-2 py-1 rounded-xs flex items-center space-x-1 transition-colors ${
                transformMode === "translate" ? "bg-[#ea580c] text-white font-bold" : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
              }`}
            >
              <Move className="w-3 h-3" />
              <span>Move (W)</span>
            </button>
            <button
              onClick={() => {
                setTransformMode("rotate");
                setAxisConstraint("none");
              }}
              title="Rotate (E / R)"
              className={`px-2 py-1 rounded-xs flex items-center space-x-1 transition-colors ${
                transformMode === "rotate" ? "bg-[#ea580c] text-white font-bold" : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
              }`}
            >
              <RotateCw className="w-3 h-3" />
              <span>Rotate (E)</span>
            </button>
            <button
              onClick={() => {
                setTransformMode("scale");
                setAxisConstraint("none");
              }}
              title="Scale (R / S)"
              className={`px-2 py-1 rounded-xs flex items-center space-x-1 transition-colors ${
                transformMode === "scale" ? "bg-[#ea580c] text-white font-bold" : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
              }`}
            >
              <Scale className="w-3 h-3" />
              <span>Scale (R)</span>
            </button>
          </div>

          {/* Simple Magnet Toggle (Prominent beginner button) */}
          <div className="relative">
            <div className="flex items-center bg-[#18181b] border border-[#333338] rounded-sm p-0.5 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => setSnapEnabled(!snapEnabled)}
                title={`Magnet Snap (Ctrl inverts) | Status: ${snapEnabled ? "SNAPPED (ON)" : "FREE (OFF)"}`}
                className={`px-2 py-1 rounded-xs flex items-center space-x-1.5 transition-colors ${
                  snapEnabled ? "bg-[#ea580c] text-white font-bold" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
                }`}
              >
                <Magnet className="w-3 h-3" />
                <span>{snapEnabled ? "SNAP ON" : "FREE"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSnapPopoverOpen(!isSnapPopoverOpen)}
                title="Snap Settings (Shift + Tab)"
                className="px-1 py-1 text-[#a1a1aa] hover:text-[#f4f4f5]"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Snap Settings Dropdown */}
            {isSnapPopoverOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-[#18181b] border border-[#3f3f46] shadow-2xl p-2.5 z-40 rounded-sm text-xs space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#27272a]">
                  <span className="font-semibold text-[11px] text-[#f4f4f5] flex items-center">
                    <Magnet className="w-3 h-3 mr-1 text-[#ea580c]" />
                    Snapping Controls
                  </span>
                  <span className="text-[9px] font-mono text-[#71717a]">Shift+Tab</span>
                </div>

                {/* Snap To Element */}
                <div>
                  <div className="text-[10px] text-[#71717a] uppercase mb-1">Snap To</div>
                  <div className="grid grid-cols-2 gap-1">
                    {(["increment", "vertex", "edge", "face"] as SnapElement[]).map((el) => (
                      <button
                        key={el}
                        type="button"
                        onClick={() => setSnapTo(el)}
                        className={`px-1.5 py-1 text-[10px] font-mono capitalize rounded-sm border text-left transition-colors ${
                          snapTo === el
                            ? "bg-[#27272a] border-[#ea580c] text-[#f4f4f5] font-bold"
                            : "bg-[#1f1f23] border-[#3f3f46] text-[#a1a1aa] hover:text-[#f4f4f5]"
                        }`}
                      >
                        {el}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid Unit */}
                <div>
                  <div className="text-[10px] text-[#71717a] uppercase mb-1">Grid Snap Unit</div>
                  <div className="grid grid-cols-4 gap-1">
                    {[0.01, 0.1, 0.5, 1.0].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setGridSnapUnit(u)}
                        className={`py-1 text-[10px] font-mono text-center rounded-sm border transition-colors ${
                          gridSnapUnit === u
                            ? "bg-[#3f3f46] border-[#52525b] text-white font-bold"
                            : "bg-[#1f1f23] border-[#3f3f46] text-[#a1a1aa]"
                        }`}
                      >
                        {u}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rotation Snap Step */}
                <div>
                  <div className="text-[10px] text-[#71717a] uppercase mb-1">Rotation Angle Step</div>
                  <div className="grid grid-cols-4 gap-1">
                    {[5, 15, 45, 90].map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => setRotationSnapStep(deg)}
                        className={`py-1 text-[10px] font-mono text-center rounded-sm border transition-colors ${
                          rotationSnapStep === deg
                            ? "bg-[#3f3f46] border-[#52525b] text-white font-bold"
                            : "bg-[#1f1f23] border-[#3f3f46] text-[#a1a1aa]"
                        }`}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Camera Presets Menu */}
          <div className="flex items-center bg-[#1f1f23] border border-[#3f3f46] p-0.5 rounded-sm space-x-0.5">
            <button
              onClick={() => setCameraPreset("front")}
              title="Front View (Numpad 1)"
              className="px-1.5 py-0.5 text-[10px] font-mono text-[#a1a1aa] hover:text-[#f4f4f5]"
            >
              FRONT
            </button>
            <button
              onClick={() => setCameraPreset("right")}
              title="Right View (Numpad 3)"
              className="px-1.5 py-0.5 text-[10px] font-mono text-[#a1a1aa] hover:text-[#f4f4f5]"
            >
              RIGHT
            </button>
            <button
              onClick={() => setCameraPreset("top")}
              title="Top View (Numpad 7)"
              className="px-1.5 py-0.5 text-[10px] font-mono text-[#a1a1aa] hover:text-[#f4f4f5]"
            >
              TOP
            </button>
          </div>

          {/* Perspective / Ortho Toggle (5) */}
          <button
            onClick={() => setIsOrtho(!isOrtho)}
            title="Toggle Perspective / Orthographic Projection (Numpad 5)"
            className={`tool-btn ${isOrtho ? "active font-bold" : ""}`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono">{isOrtho ? "ORTHO" : "PERSP"}</span>
          </button>

          {/* Frame / Focus (F / Period) */}
          <button onClick={handleFocus} title="Frame Selected / Center Camera (F or Period .)" className="tool-btn">
            <Focus className="w-3.5 h-3.5" />
          </button>

          {/* Projected Dimension Measurement Toggle (D) */}
          <button
            onClick={() => setShowDimensions(!showDimensions)}
            title="Toggle Projected Dimension Callouts (D)"
            className={`tool-btn space-x-1 ${showDimensions ? "active font-bold" : ""}`}
          >
            <Sliders className="w-3.5 h-3.5 text-[#ea580c]" />
            <span className="text-[10px] font-mono">DIMS [D]</span>
          </button>

          {/* Quick DCC Tools Tray Toggle */}
          <button
            onClick={() => setIsQuickTrayOpen(!isQuickTrayOpen)}
            title="Toggle DCC Quick Tools Tray (Decimate, UV Checker, Lighting, Snapshot)"
            className={`tool-btn space-x-1 ${isQuickTrayOpen ? "active font-bold" : ""}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#ea580c]" />
            <span className="text-[10px] font-mono">DCC TOOLS</span>
          </button>

          {/* Export Modified GLB from Canvas */}
          <button
            onClick={handleExportModifiedGLB}
            title="Export Modified GLB (with your live material edits and transforms)"
            className="tool-btn space-x-1 border-[#3f3f46] bg-[#27272a] hover:border-[#ea580c] text-[#f4f4f5]"
          >
            <Download className="w-3.5 h-3.5 text-[#ea580c]" />
            <span className="text-[10px] font-mono font-semibold hidden md:inline">EXPORT MODIFIED</span>
          </button>

          {/* Raw Download */}
          {assetUrl && (
            <button onClick={handleDownloadOriginal} title="Download Raw Server Asset" className="tool-btn p-1">
              <Download className="w-3.5 h-3.5 text-[#a1a1aa]" />
            </button>
          )}

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Toggle Fullscreen"
            className="tool-btn p-1"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Viewport */}
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
            className="pointer-events-none fixed z-50 px-2 py-1 rounded bg-[#18181b]/95 border border-[#ea580c] text-white font-mono text-[11px] shadow-2xl flex items-center space-x-1.5 backdrop-blur-xs transform -translate-x-1/2 -translate-y-full mb-2"
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
        {/* Loading Spinner Overlay */}
        {isLoadingModel && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#141416]/80 text-[#f4f4f5]">
            <div className="w-6 h-6 border-2 border-[#ea580c] border-t-transparent rounded-full animate-spin mb-2" />
            <span className="font-mono text-xs text-[#a1a1aa]">PARSING 3D CAD GEOMETRY...</span>
          </div>
        )}

        {/* Shading Radial Pie Menu Overlay (Z Hotkey) */}
        {isPieMenuOpen && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-[1px]"
            onClick={() => setIsPieMenuOpen(false)}
          >
            <div
              className="relative w-64 h-64 rounded-full border border-[#52525b] bg-[#18181b]/95 p-3 flex items-center justify-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Center dismiss */}
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
                  if (selectionBoxHelperRef.current) selectionBoxHelperRef.current.update();
                }}
                className="w-full accent-[#ea580c]"
              />
            </div>
            <p className="text-[8px] text-[#71717a] font-mono leading-tight">
              Interactive parametric adjustments update geometry buffer in real time.
            </p>
          </div>
        )}

        {/* Floating Quick Action Overlay Strip */}
        <div className="absolute top-3 left-3 z-20 flex flex-col space-y-1.5">
          {/* Quick Timeline Button */}
          <button
            onClick={() => setIsTimelineOpen(!isTimelineOpen)}
            className={`tool-btn shadow-md space-x-1.5 ${isTimelineOpen ? "active" : ""}`}
            title="Toggle Timeline & Procedural Exploded View"
          >
            <Film className="w-3.5 h-3.5 text-[#ea580c]" />
            <span className="font-mono text-[10px]">TIMELINE</span>
          </button>
        </div>

        {/* Hardware-Accelerated 2D/3D Canvas HUD Overlay */}
        <CanvasOverlay
          camera={isOrtho ? orthoCameraRef.current : cameraRef.current}
          selectedMesh={selectedMesh}
          currentModel={rootModelGroupRef.current}
          meshList={meshList.map((m) => ({ name: m.name, meshRef: m.meshRef }))}
          onSelectMesh={(meshName) => selectMeshByName(meshName)}
          transformMode={transformMode}
          liveTransform={liveTransform}
          axisConstraint={axisConstraint}
          showDimensions={showDimensions}
          onToggleDimensions={() => setShowDimensions((p) => !p)}
          onSnapCameraView={setCameraPreset}
        />
      </div>

      {/* Floating Contextual Compact Inspector (HUD) */}
      <FloatingInspector
        selectedMeshName={selectedMesh?.name || null}
        triangles={
          selectedMesh?.geometry?.index
            ? selectedMesh.geometry.index.count / 3
            : selectedMesh?.geometry?.attributes?.position
            ? selectedMesh.geometry.attributes.position.count / 3
            : 0
        }
        onClose={() => {
          setSelectedMesh(null);
          onMeshSelect?.(null);
        }}
        onFocus={handleFocus}
        onApplySwatch={handleApplySwatch}
        onUpdateMaterial={handleUpdateSelectedMaterial}
        currentRoughness={matRoughness}
        currentMetalness={matMetalness}
        currentColor={matColor}
        onSubdivide={handleSubdivide}
        onAddKeyframe={() => handleAddKeyframe(currentFrame)}
        onPlaceOnFloor={handlePlaceOnFloor}
        onCenterOrigin={handleCenterToOrigin}
        onResetRotation={handleResetRotation}
        onResetScale={handleResetScale}
      />

      {/* Floating Transform Numeric Input Pill (While G, R, S active) */}
      {transformMode !== "select" && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2 bg-[#18181b]/95 border border-[#ea580c] px-3 py-1.5 rounded-sm shadow-xl font-mono text-xs text-[#f4f4f5]">
          <span className="font-bold text-[#ea580c] uppercase">
            {transformMode === "translate" ? "G: TRANSLATE" : transformMode === "rotate" ? (isTrackball ? "R: TRACKBALL" : "R: ROTATE") : "S: SCALE"}
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

      {/* Modern Dope Sheet Timeline Component */}
      <Timeline
        isOpen={isTimelineOpen}
        onToggleOpen={() => setIsTimelineOpen(!isTimelineOpen)}
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
      />

      {/* 1-Click DCC Quick Tools Tray (Decimate, UV Checker, Lighting, Snapshot) */}
      <DccQuickTray
        isOpen={isQuickTrayOpen}
        onToggleOpen={() => setIsQuickTrayOpen(!isQuickTrayOpen)}
        simplifyRatio={simplifyRatio}
        onSimplifyRatioChange={handleSimplifyRatioChange}
        isUvCheckerActive={isUvCheckerActive}
        onToggleUvChecker={handleToggleUvChecker}
        currentLightingStage={currentLightingStage}
        onSelectLightingStage={updateLightingStage}
        onCaptureSnapshot={handleCaptureSnapshot}
        showDimensions={showDimensions}
        onToggleDimensions={() => setShowDimensions((p) => !p)}
      />

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
    </div>
  );
}
