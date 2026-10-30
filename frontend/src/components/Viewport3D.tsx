"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { useTheme } from "@/context/ThemeContext";
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
} from "lucide-react";

export type ShadingMode = "solid" | "material" | "wireframe" | "normals";
export type MatcapPreset = "studio" | "clay" | "redwax" | "chrome" | "obsidian";
export type CameraView = "iso" | "front" | "back" | "top" | "bottom" | "right" | "left";
export type AxisConstraint = "none" | "x" | "y" | "z" | "shift-x" | "shift-y" | "shift-z";
export type SnapTarget = "closest" | "center" | "median" | "active";
export type SnapElement = "increment" | "vertex" | "edge" | "face" | "volume";

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
  format?: "glb" | "stl";
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
  const [transformMode, setTransformMode] = useState<"select" | "translate" | "rotate" | "scale">("select");
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

    // F. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(5, 10, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.7);
    fillLight.position.set(-6, 3, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    rimLight.position.set(0, -5, -6);
    scene.add(rimLight);

    // G. Workstation Helpers (Grid & Coordinate Axes)
    const grid = new THREE.GridHelper(20, 20, 0x52525b, 0x27272a);
    grid.position.y = 0;
    scene.add(grid);
    gridHelperRef.current = grid;

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

    // J. Render Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Procedural turntable rotation
      if (autoRotate && rootModelGroupRef.current) {
        rootModelGroupRef.current.rotation.y += delta * 0.5;
      }

      // Procedural floating hover
      if (hoverActive && rootModelGroupRef.current) {
        rootModelGroupRef.current.position.y = Math.sin(time * 2) * 0.1;
      }

      // Timeline playback frame increment
      if (isPlaying) {
        setCurrentFrame((prev) => {
          if (prev >= totalFrames) {
            return isLooping ? 0 : totalFrames;
          }
          return prev + 1;
        });
      }

      orbit.update();
      const activeCamera = isOrtho ? orthoCamera : perspCamera;
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
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [themeConfig.viewportBg]);

  // Update Scene Background Color when Theme changes
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(themeConfig.viewportBg);
    }
  }, [themeConfig.viewportBg]);

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
            };
            const rough = cap === "chrome" ? 0.05 : cap === "clay" ? 0.75 : 0.4;
            const metal = cap === "chrome" ? 0.95 : cap === "obsidian" ? 0.8 : 0.1;

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
  // 4. Raycasting & Sub-Mesh Selection (Click vs Orbit Drag)
  // -------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const dx = Math.abs(e.clientX - pointerDownPosRef.current.x);
    const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);

    // If mouse moved more than 4px, user was rotating/orbiting camera, not selecting
    if (dx > 4 || dy > 4) return;
    if (!containerRef.current || !cameraRef.current || !currentModelRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), isOrtho ? orthoCameraRef.current! : cameraRef.current);
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
      // Clicked in empty space -> Deselect
      setSelectedMesh(null);
      onMeshSelect?.(null);
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

  // -------------------------------------------------------------
  // 5. Native Blender Transform Gizmo & Snapping Engine
  // -------------------------------------------------------------
  useEffect(() => {
    if (!transformControlsRef.current) return;
    const tc = transformControlsRef.current;

    if (transformMode === "select") {
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
    >
      {/* Top DCC Control Strip */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#3f3f46] bg-[#18181b] z-20">
        {/* Left: Shading & Matcaps */}
        <div className="flex items-center space-x-1">
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
          {/* Transform Gizmos (G, R, S) */}
          <div className="flex items-center bg-[#1f1f23] border border-[#3f3f46] p-0.5 rounded-sm space-x-0.5">
            <button
              onClick={() => {
                setTransformMode("select");
                setAxisConstraint("none");
              }}
              title="Select Mode (Q / Esc)"
              className={`p-1 rounded-sm transition-colors ${
                transformMode === "select" ? "bg-[#3f3f46] text-[#f4f4f5]" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setTransformMode("translate");
                setAxisConstraint("none");
              }}
              title="Translate Gizmo (G / W)"
              className={`p-1 rounded-sm transition-colors ${
                transformMode === "translate" ? "bg-[#3f3f46] text-[#f4f4f5] font-bold" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
              }`}
            >
              <Move className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setTransformMode("rotate");
                setAxisConstraint("none");
              }}
              title="Rotate Gizmo (R) — Press R twice for Trackball"
              className={`p-1 rounded-sm transition-colors ${
                transformMode === "rotate" ? "bg-[#3f3f46] text-[#f4f4f5] font-bold" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setTransformMode("scale");
                setAxisConstraint("none");
              }}
              title="Scale Gizmo (S)"
              className={`p-1 rounded-sm transition-colors ${
                transformMode === "scale" ? "bg-[#3f3f46] text-[#f4f4f5] font-bold" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Magnet Snap Toggle & Settings Popover */}
          <div className="relative">
            <div className="flex items-center bg-[#1f1f23] border border-[#3f3f46] rounded-sm p-0.5">
              <button
                type="button"
                onClick={() => setSnapEnabled(!snapEnabled)}
                title={`Toggle Snapping (Shift + Tab to configure) | Status: ${snapEnabled ? "ON" : "OFF"}`}
                className={`p-1 rounded-sm transition-colors ${
                  snapEnabled ? "bg-[#ea580c] text-white" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
                }`}
              >
                <Magnet className="w-3.5 h-3.5" />
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
        onPointerUp={handlePointerUp}
        className="flex-1 w-full h-full relative overflow-hidden outline-none cursor-grab active:cursor-grabbing"
      >
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
      </div>

      {/* Expandable Bottom Timeline Drawer */}
      {isTimelineOpen && (
        <div className="border-t border-[#3f3f46] bg-[#18181b] px-3 py-2 flex items-center space-x-3 text-xs z-20">
          {/* Play/Pause */}
          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 bg-[#ea580c] hover:bg-[#f97316] text-white rounded-sm"
              title="Play / Pause (Space)"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>
            <button
              onClick={() => setCurrentFrame(0)}
              className="p-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#a1a1aa] rounded-sm"
              title="Rewind to Frame 0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsLooping(!isLooping)}
              title="Loop Timeline"
              className={`p-1.5 rounded-sm border ${
                isLooping ? "bg-[#27272a] text-[#f4f4f5] border-[#52525b]" : "text-[#71717a] border-[#3f3f46]"
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] text-[#a1a1aa]">
              {currentFrame} / {totalFrames}f
            </span>
          </div>

          {/* Timeline Scrubber */}
          <div className="flex-1 flex items-center space-x-2">
            <input
              type="range"
              min="0"
              max={totalFrames}
              step="1"
              value={currentFrame}
              onChange={(e) => setCurrentFrame(parseInt(e.target.value, 10))}
              className="w-full accent-[#ea580c] cursor-pointer"
            />
          </div>

          {/* Exploded View Slider */}
          <div className="flex items-center space-x-2 w-52 bg-[#1f1f23] border border-[#3f3f46] px-2 py-1 rounded-sm">
            <span className="text-[10px] text-[#a1a1aa] font-mono whitespace-nowrap">
              EXPLODE: {(explodedFactor * 100).toFixed(0)}%
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={explodedFactor}
              onChange={(e) => handleExplodedChange(parseFloat(e.target.value))}
              className="w-full accent-[#38bdf8] cursor-pointer"
            />
          </div>
        </div>
      )}

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

        {/* Context-Sensitive Key Hints Strip */}
        {transformMode !== "select" ? (
          <div className="flex items-center space-x-2 text-[10px] font-mono">
            <span className="px-1.5 py-0.5 bg-[#ea580c] text-white font-bold rounded-xs">
              [{transformMode === "translate" ? "G: TRANSLATE" : transformMode === "rotate" ? (isTrackball ? "R: TRACKBALL" : "R: ROTATE") : "S: SCALE"}]
            </span>
            <span className="text-[#f4f4f5] font-bold">
              {axisConstraint !== "none" ? `AXIS: ${axisConstraint.toUpperCase()}` : "FREE"}
            </span>
            <span className="text-[#a1a1aa]">X/Y/Z: Constrain</span>
            <span className="text-[#a1a1aa]">Shift+X/Y/Z: Plane</span>
            <span className="text-[#a1a1aa]">Ctrl: Snap ({gridSnapUnit}m)</span>
            <span className="text-[#a1a1aa]">Shift: Precision</span>
            <span className="text-[#f4f4f5] font-semibold">LMB/Enter: Confirm</span>
            <span className="text-[#ef4444] font-semibold">RMB/Esc: Cancel</span>
          </div>
        ) : (
          <div className="flex items-center space-x-3 text-[10px] text-[#71717a]">
            <span>Click: Select</span>
            <span>G: Move</span>
            <span>R: Rotate</span>
            <span>S: Scale</span>
            <span>Ctrl: Snap</span>
            <span>Shift+Tab: Snap Settings</span>
            <span>Z: Shading</span>
            <span>1/3/7: Views</span>
            <span>F: Focus</span>
            {onOpenShortcuts && (
              <button
                type="button"
                onClick={onOpenShortcuts}
                className="text-[#a1a1aa] hover:text-[#f4f4f5] font-semibold underline"
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
