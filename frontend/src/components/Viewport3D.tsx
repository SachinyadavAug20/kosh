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
} from "lucide-react";

export type ShadingMode = "solid" | "material" | "wireframe" | "normals";
export type MatcapPreset = "studio" | "clay" | "redwax" | "chrome" | "obsidian";
export type CameraView = "iso" | "front" | "top" | "right";

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
  const [gridSnap, setGridSnap] = useState<boolean>(false);
  const [isOrtho, setIsOrtho] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [showWireOverlay, setShowWireOverlay] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

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
      }
    });
    scene.add(transform.getHelper());
    transformControlsRef.current = transform;

    // F. Selection Box Helper (Subtle Orange Silhouette)
    const boxHelper = new THREE.BoxHelper(new THREE.Mesh(), 0xea580c);
    (boxHelper.material as THREE.Material).depthTest = false;
    boxHelper.visible = false;
    scene.add(boxHelper);
    selectionBoxHelperRef.current = boxHelper;

    // G. 3-Point Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xb0c4de, 0.8);
    fillLight.position.set(-6, 4, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.0);
    rimLight.position.set(0, -4, -6);
    scene.add(rimLight);

    // H. Floor Grid & Axes
    const grid = new THREE.GridHelper(16, 32, themeConfig.gridMajor, themeConfig.gridMinor);
    grid.position.y = 0;
    scene.add(grid);
    gridHelperRef.current = grid;

    const axes = new THREE.AxesHelper(3.0);
    (axes.material as THREE.Material).depthTest = false;
    axes.renderOrder = 2;
    scene.add(axes);
    axesHelperRef.current = axes;

    // Root Group for Models
    const rootGroup = new THREE.Group();
    rootGroup.name = "RootModelGroup";
    scene.add(rootGroup);
    rootModelGroupRef.current = rootGroup;

    // Wireframe Overlay Group
    const wireGroup = new THREE.Group();
    wireGroup.name = "WireframeOverlayGroup";
    wireGroup.visible = false;
    scene.add(wireGroup);
    wireOverlayGroupRef.current = wireGroup;

    // I. Default Object: Precision Chamfered Workstation Cube
    const cubeGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8, 4, 4, 4);
    cubeGeo.computeVertexNormals();
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0x8e9297,
      roughness: 0.35,
      metalness: 0.25,
    });
    const defaultCube = new THREE.Mesh(cubeGeo, cubeMat);
    defaultCube.position.y = 0.9;
    defaultCube.castShadow = true;
    defaultCube.receiveShadow = true;
    defaultCube.name = "Default_Workstation_Cube";

    rootGroup.add(defaultCube);
    currentModelRef.current = defaultCube;
    setSelectedMesh(defaultCube);

    updateMeshListAndStats(defaultCube);

    // J. Click & Raycasting Setup (Pointerdown / Pointerup)
    const handlePointerDown = (e: MouseEvent) => {
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: MouseEvent) => {
      // Calculate move distance to ignore orbit drags
      const dx = Math.abs(e.clientX - pointerDownPosRef.current.x);
      const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);
      if (dx > 4 || dy > 4) return; // was a drag, ignore

      if (!containerRef.current || !rootModelGroupRef.current || !cameraRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const activeCam = isOrtho && orthoCameraRef.current ? orthoCameraRef.current : cameraRef.current;
      raycasterRef.current.setFromCamera(new THREE.Vector2(mouseX, mouseY), activeCam);

      const intersects = raycasterRef.current.intersectObjects(rootModelGroupRef.current.children, true);

      // Find first visible Mesh
      const meshHit = intersects.find((hit) => hit.object instanceof THREE.Mesh);

      if (meshHit) {
        const mesh = meshHit.object as THREE.Mesh;
        setSelectedMesh(mesh);
        onMeshSelect?.(mesh.name);

        // Extract Material Properties
        if (mesh.material) {
          const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            setMatColor("#" + mat.color.getHexString());
            setMatRoughness(mat.roughness);
            setMatMetalness(mat.metalness);
            setMatTransmission((mat as any).transmission || 0.0);
            setMatClearcoat((mat as any).clearcoat || 0.0);
            setMatEmissive("#" + (mat.emissive ? mat.emissive.getHexString() : "000000"));
          }
        }
      } else {
        // Clicked background - deselect if in select mode
        if (transformMode === "select") {
          setSelectedMesh(null);
          onMeshSelect?.(null);
        }
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener("pointerdown", handlePointerDown);
    domElement.addEventListener("pointerup", handlePointerUp);

    // K. Animation Render Loop
    let animId: number;
    let localFrame = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const activeCam = isOrtho && orthoCameraRef.current ? orthoCameraRef.current : perspCamera;

      if (orbitControlsRef.current) orbitControlsRef.current.update();

      // Live BoxHelper update
      if (selectionBoxHelperRef.current && selectionBoxHelperRef.current.visible) {
        selectionBoxHelperRef.current.update();
      }

      // Timeline Playback
      if (isPlaying) {
        localFrame = (localFrame + 1) % totalFrames;
        setCurrentFrame(localFrame);

        // Sinusoidal floating hover
        if (hoverActive && currentModelRef.current) {
          currentModelRef.current.position.y = 0.9 + Math.sin(localFrame * 0.08) * 0.15;
        }

        // Turntable spin
        if (autoRotate && currentModelRef.current) {
          currentModelRef.current.rotation.y += 0.015;
        }
      }

      renderer.render(scene, activeCam);
    };
    animate();

    // L. Window Resize
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      const newAspect = w / h;

      if (cameraRef.current) {
        cameraRef.current.aspect = newAspect;
        cameraRef.current.updateProjectionMatrix();
      }

      if (orthoCameraRef.current) {
        orthoCameraRef.current.left = (frustumSize * newAspect) / -2;
        orthoCameraRef.current.right = (frustumSize * newAspect) / 2;
        orthoCameraRef.current.top = frustumSize / 2;
        orthoCameraRef.current.bottom = frustumSize / -2;
        orthoCameraRef.current.updateProjectionMatrix();
      }

      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      domElement.removeEventListener("pointerdown", handlePointerDown);
      domElement.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      orbit.dispose();
      transform.dispose();
      renderer.dispose();
      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }
    };
  }, []);

  // Update theme background and grid
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(themeConfig.viewportBg);
    }
    if (gridHelperRef.current && sceneRef.current) {
      sceneRef.current.remove(gridHelperRef.current);
      gridHelperRef.current.dispose();
      const newGrid = new THREE.GridHelper(16, 32, themeConfig.gridMajor, themeConfig.gridMinor);
      newGrid.visible = showGrid;
      sceneRef.current.add(newGrid);
      gridHelperRef.current = newGrid;
    }
  }, [themeConfig, showGrid]);

  // Update selection box helper when selectedMesh changes
  useEffect(() => {
    if (!selectionBoxHelperRef.current) return;
    if (selectedMesh) {
      selectionBoxHelperRef.current.setFromObject(selectedMesh);
      selectionBoxHelperRef.current.visible = true;
    } else {
      selectionBoxHelperRef.current.visible = false;
    }
  }, [selectedMesh]);

  // Sync external selection from outliner
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

  // Update Transform Mode (Gizmo)
  useEffect(() => {
    if (!transformControlsRef.current) return;
    const tc = transformControlsRef.current;
    if (transformMode === "select") {
      tc.enabled = false;
      tc.detach();
    } else {
      tc.enabled = true;
      tc.setMode(transformMode);
      tc.setTranslationSnap(gridSnap ? 0.5 : null);
      const target = selectedMesh || currentModelRef.current;
      if (target) tc.attach(target);
    }
  }, [transformMode, selectedMesh, gridSnap]);

  // Sync Live Material Tweaks from external drawer
  useEffect(() => {
    if (!liveMaterialUpdate) return;
    handleUpdateMaterial(
      liveMaterialUpdate.color,
      liveMaterialUpdate.roughness,
      liveMaterialUpdate.metalness,
      liveMaterialUpdate.transmission,
      liveMaterialUpdate.clearcoat,
      liveMaterialUpdate.emissive
    );
  }, [liveMaterialUpdate]);

  // Sync Live Exploded View
  useEffect(() => {
    if (liveExplodedFactor !== undefined) {
      handleExplodedChange(liveExplodedFactor);
    }
  }, [liveExplodedFactor]);

  // Sync Turntable / Hover
  useEffect(() => {
    if (liveTurntable !== undefined) setAutoRotate(liveTurntable);
    if (liveHover !== undefined) setHoverActive(liveHover);
  }, [liveTurntable, liveHover]);

  // -------------------------------------------------------------
  // 2. Exploded View Engine (Assembly Inspection)
  // -------------------------------------------------------------
  const handleExplodedChange = (factor: number) => {
    setExplodedFactor(factor);
    if (!currentModelRef.current) return;
    const model = currentModelRef.current;
    const modelCenter: THREE.Vector3 = model.userData.modelCenter || new THREE.Vector3(0, 0, 0);

    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.initialPosition && child.userData.explodeDir) {
        const displacement = (child.userData.explodeDir as THREE.Vector3).clone().multiplyScalar(factor * 2.5);
        child.position.copy(child.userData.initialPosition).add(displacement);
        child.updateMatrixWorld();
      }
    });
  };

  // -------------------------------------------------------------
  // 3. Live Material Painting Engine
  // -------------------------------------------------------------
  const handleUpdateMaterial = (
    color: string,
    roughness: number,
    metalness: number,
    transmission?: number,
    clearcoat?: number,
    emissive?: string
  ) => {
    setMatColor(color);
    setMatRoughness(roughness);
    setMatMetalness(metalness);
    if (transmission !== undefined) setMatTransmission(transmission);
    if (clearcoat !== undefined) setMatClearcoat(clearcoat);
    if (emissive !== undefined) setMatEmissive(emissive);

    const targetObjects: THREE.Mesh[] = [];
    if (selectedMesh) {
      targetObjects.push(selectedMesh);
    } else if (currentModelRef.current) {
      currentModelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) targetObjects.push(child);
      });
    }

    targetObjects.forEach((mesh) => {
      let mat = mesh.material;
      if (Array.isArray(mat)) mat = mat[0];

      // Convert to MeshPhysicalMaterial if transmission or clearcoat used
      if ((transmission && transmission > 0) || (clearcoat && clearcoat > 0)) {
        if (!(mat instanceof THREE.MeshPhysicalMaterial)) {
          mat = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(color),
            roughness,
            metalness,
            transmission: transmission || 0.0,
            clearcoat: clearcoat || 0.0,
            ior: 1.45,
          });
          mesh.material = mat;
        }
      }

      if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
        mat.color.set(color);
        mat.roughness = roughness;
        mat.metalness = metalness;
        if (transmission !== undefined) (mat as any).transmission = transmission;
        if (clearcoat !== undefined) (mat as any).clearcoat = clearcoat;
        if (emissive) {
          mat.emissive.set(emissive);
          mat.emissiveIntensity = 1.0;
        }
        mat.needsUpdate = true;
      }
    });
  };

  // -------------------------------------------------------------
  // 4. Update Mesh List & Topology Stats
  // -------------------------------------------------------------
  const updateMeshListAndStats = (model: THREE.Object3D) => {
    let triCount = 0;
    let vertCount = 0;
    const meshes: MeshNodeInfo[] = [];

    // Calculate model center for exploded view
    const modelBox = new THREE.Box3().setFromObject(model);
    const modelCenter = new THREE.Vector3();
    modelBox.getCenter(modelCenter);
    model.userData.modelCenter = modelCenter;

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.userData.initialPosition = child.position.clone();

        const childBox = new THREE.Box3().setFromObject(child);
        const childCenter = new THREE.Vector3();
        childBox.getCenter(childCenter);

        const dir = new THREE.Vector3().subVectors(childCenter, modelCenter);
        if (dir.lengthSq() < 0.0001) {
          dir.set(0, 1, 0);
        } else {
          dir.normalize();
        }
        child.userData.explodeDir = dir;

        const geo = child.geometry;
        const tris = geo.index ? geo.index.count / 3 : (geo.attributes.position?.count || 0) / 3;
        const verts = geo.attributes.position?.count || 0;
        triCount += Math.floor(tris);
        vertCount += verts;

        meshes.push({
          id: child.uuid,
          name: child.name || `Mesh_${meshes.length + 1}`,
          triangles: Math.floor(tris),
          vertices: verts,
          visible: child.visible,
          meshRef: child,
        });
      }
    });

    const size = new THREE.Vector3();
    modelBox.getSize(size);

    setStats({
      triangles: triCount,
      vertices: vertCount,
      dimensions: `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}m`,
    });

    setMeshList(meshes);
    onMeshListUpdate?.(meshes);
  };

  // -------------------------------------------------------------
  // 5. Load 3D Asset (.glb / .stl)
  // -------------------------------------------------------------
  const loadModel = useCallback((url: string, fileExt: "glb" | "stl") => {
    if (!sceneRef.current || !rootModelGroupRef.current) return;
    setIsLoadingModel(true);

    const root = rootModelGroupRef.current;
    while (root.children.length > 0) {
      const obj = root.children[0];
      root.remove(obj);
    }
    if (transformControlsRef.current) transformControlsRef.current.detach();
    if (selectionBoxHelperRef.current) selectionBoxHelperRef.current.visible = false;
    setSelectedMesh(null);

    const fullUrl = url.startsWith("http") || url.startsWith("/") ? url : `${apiBase}${url}`;

    if (fileExt === "stl") {
      const loader = new STLLoader();
      loader.load(
        fullUrl,
        (geometry) => {
          geometry.computeVertexNormals();
          geometry.center();
          const material = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.35,
            metalness: 0.8,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.name = assetName || "STL_Model";

          root.add(mesh);
          currentModelRef.current = mesh;
          setSelectedMesh(mesh);

          updateMeshListAndStats(mesh);
          frameObject(mesh);
          setIsLoadingModel(false);
        },
        undefined,
        () => setIsLoadingModel(false)
      );
    } else {
      const loader = new GLTFLoader();
      loader.load(
        fullUrl,
        (gltf) => {
          const model = gltf.scene;
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // Center and sit on floor
          const box = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          box.getCenter(center);
          model.position.sub(center);
          model.position.y += (box.max.y - box.min.y) / 2;

          root.add(model);
          currentModelRef.current = model;

          updateMeshListAndStats(model);
          frameObject(model);
          setIsLoadingModel(false);
        },
        undefined,
        () => setIsLoadingModel(false)
      );
    }
  }, [apiBase, assetName]);

  useEffect(() => {
    if (assetUrl) {
      loadModel(assetUrl, format);
    }
  }, [assetUrl, format, loadModel]);

  // Frame Object in Viewport
  const frameObject = (object: THREE.Object3D) => {
    if (!cameraRef.current || !orbitControlsRef.current) return;
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 2.2;

    cameraRef.current.position.set(center.x + cameraZ * 0.7, center.y + cameraZ * 0.5, center.z + cameraZ * 0.7);
    cameraRef.current.lookAt(center);
    orbitControlsRef.current.target.copy(center);
    orbitControlsRef.current.update();
  };

  // Camera Presets
  const setCameraPreset = (view: CameraView) => {
    if (!cameraRef.current || !orbitControlsRef.current) return;
    const target = orbitControlsRef.current.target;
    const dist = cameraRef.current.position.distanceTo(target) || 6;

    switch (view) {
      case "front":
        cameraRef.current.position.set(target.x, target.y, target.z + dist);
        break;
      case "right":
        cameraRef.current.position.set(target.x + dist, target.y, target.z);
        break;
      case "top":
        cameraRef.current.position.set(target.x, target.y + dist, target.z + 0.0001);
        break;
      case "iso":
      default:
        cameraRef.current.position.set(target.x + dist * 0.7, target.y + dist * 0.5, target.z + dist * 0.7);
        break;
    }
    cameraRef.current.lookAt(target);
    orbitControlsRef.current.update();
  };

  // Keyboard Shortcuts (G, R, S, 1, 3, 7, 5, Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case "g":
        case "w":
          setTransformMode("translate");
          break;
        case "e":
          setTransformMode("rotate");
          break;
        case "s":
          setTransformMode("scale");
          break;
        case "q":
        case "escape":
          setTransformMode("select");
          setSelectedMesh(null);
          onMeshSelect?.(null);
          break;
        case "1":
          setCameraPreset("front");
          break;
        case "3":
          setCameraPreset("right");
          break;
        case "7":
          setCameraPreset("top");
          break;
        case "5":
          setIsOrtho((prev) => !prev);
          break;
        case " ":
          e.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onMeshSelect]);

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

  // Capture Canvas PNG Snapshot
  const handleCapturePNG = () => {
    if (!rendererRef.current) return;
    const url = rendererRef.current.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${assetName ? assetName.replace(/\.[^/.]+$/, "") : "kosh_snapshot"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className={`relative flex flex-col w-full h-full bg-[#141416] text-[#f4f4f5] select-none ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
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

          {/* Active Selected Mesh Chip */}
          {selectedMesh && (
            <div className="flex items-center space-x-1 px-2 py-0.5 bg-[#27272a] border border-[#ea580c] rounded-sm text-[10px] text-[#f4f4f5]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ea580c]" />
              <span className="font-mono font-semibold max-w-[120px] truncate">{selectedMesh.name}</span>
            </div>
          )}
        </div>

        {/* Right: Gizmos, Overlays, Direct Downloads */}
        <div className="flex items-center space-x-1">
          {/* Transform Gizmos */}
          <div className="flex items-center bg-[#1f1f23] border border-[#3f3f46] p-0.5 rounded-sm space-x-0.5">
            <button
              onClick={() => setTransformMode("select")}
              title="Select Mode (Q / Esc)"
              className={`p-1 rounded-sm transition-colors ${
                transformMode === "select" ? "bg-[#3f3f46] text-[#f4f4f5]" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTransformMode("translate")}
              title="Translate Gizmo (G / W)"
              className={`p-1 rounded-sm transition-colors ${
                transformMode === "translate" ? "bg-[#3f3f46] text-[#f4f4f5]" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
              }`}
            >
              <Move className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTransformMode("rotate")}
              title="Rotate Gizmo (R / E)"
              className={`p-1 rounded-sm transition-colors ${
                transformMode === "rotate" ? "bg-[#3f3f46] text-[#f4f4f5]" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTransformMode("scale")}
              title="Scale Gizmo (S)"
              className={`p-1 rounded-sm transition-colors ${
                transformMode === "scale" ? "bg-[#3f3f46] text-[#f4f4f5]" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Grid Snap Toggle */}
          <button
            onClick={() => setGridSnap(!gridSnap)}
            title="Toggle 0.5m Translation Snap"
            className={`tool-btn ${gridSnap ? "active text-[#ea580c]" : ""}`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Timeline Drawer Toggle */}
          <button
            onClick={() => setIsTimelineOpen(!isTimelineOpen)}
            title="Toggle Animation & Exploded Timeline"
            className={`tool-btn ${isTimelineOpen ? "active text-[#ea580c]" : ""}`}
          >
            <Film className="w-3.5 h-3.5" />
          </button>

          {/* Material Tweaker Popover */}
          <button
            onClick={() => setActiveOverlay(activeOverlay === "material" ? "none" : "material")}
            title="Inspect / Edit Selected Material"
            className={`tool-btn ${activeOverlay === "material" ? "active" : ""}`}
          >
            <Palette className="w-3.5 h-3.5" />
          </button>

          {/* Studio Rendered Snapshot PNG Download */}
          {snapshotUrl ? (
            <a
              href={`${apiBase}${snapshotUrl}`}
              download={assetName ? `${assetName.replace(/\.[^/.]+$/, "")}.png` : "snapshot.png"}
              target="_blank"
              rel="noopener noreferrer"
              title="Download High-Res Studio Render (PNG)"
              className="tool-btn text-[#ea580c] hover:text-[#f97316] flex items-center space-x-1"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono">PNG</span>
            </a>
          ) : (
            <button
              onClick={handleCapturePNG}
              title="Capture Viewport Snapshot (PNG)"
              className="tool-btn"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Export Modified GLB directly from Browser */}
          <button
            onClick={handleExportModifiedGLB}
            title="Export Modified Scene from Browser (.GLB)"
            className="tool-btn text-[#38bdf8] hover:text-[#0284c7] flex items-center space-x-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono">MOD.GLB</span>
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Toggle Viewport Fullscreen"
            className="tool-btn"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Area */}
      <div className="relative flex-1 min-h-0 w-full" ref={containerRef}>
        {/* Floating Left Camera Orientation Strip */}
        <div className="absolute top-2 left-2 z-10 flex flex-col space-y-0.5 bg-[#18181b] border border-[#3f3f46] p-0.5 rounded-sm shadow-sm">
          <button
            onClick={() => setCameraPreset("front")}
            title="Front View (1)"
            className="px-1.5 py-0.5 text-[10px] text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] rounded-sm font-mono"
          >
            FRONT
          </button>
          <button
            onClick={() => setCameraPreset("right")}
            title="Right View (3)"
            className="px-1.5 py-0.5 text-[10px] text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] rounded-sm font-mono"
          >
            RIGHT
          </button>
          <button
            onClick={() => setCameraPreset("top")}
            title="Top View (7)"
            className="px-1.5 py-0.5 text-[10px] text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] rounded-sm font-mono"
          >
            TOP
          </button>
          <button
            onClick={() => setCameraPreset("iso")}
            title="Isometric View"
            className="px-1.5 py-0.5 text-[10px] text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] rounded-sm font-mono"
          >
            ISO
          </button>

          <div className="w-full h-px bg-[#27272a] my-0.5" />

          <button
            onClick={() => setIsOrtho(!isOrtho)}
            title="Toggle Ortho / Perspective (5)"
            className="px-1.5 py-0.5 text-[10px] text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] rounded-sm font-mono"
          >
            {isOrtho ? "ORTHO" : "PERSP"}
          </button>

          <button
            onClick={() => currentModelRef.current && frameObject(currentModelRef.current)}
            title="Frame Selected Object (.)"
            className="p-1 text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] rounded-sm flex items-center justify-center"
          >
            <Focus className="w-3 h-3" />
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Floor Grid"
            className={`p-1 rounded-sm flex items-center justify-center ${
              showGrid ? "text-[#f4f4f5] bg-[#27272a]" : "text-[#71717a] hover:text-[#a1a1aa]"
            }`}
          >
            <Grid className="w-3 h-3" />
          </button>
        </div>

        {/* Live Material Studio Popover */}
        {activeOverlay === "material" && (
          <div className="absolute top-2 right-2 z-20 w-64 bg-[#1f1f23] border border-[#3f3f46] p-2.5 rounded-sm shadow-xl space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-1">
              <span className="font-semibold text-[#f4f4f5]">
                {selectedMesh ? `Edit: ${selectedMesh.name}` : "Live Material Studio"}
              </span>
              <button onClick={() => setActiveOverlay("none")} className="text-[#a1a1aa] hover:text-[#f4f4f5]">✕</button>
            </div>

            <div>
              <div className="text-[10px] text-[#a1a1aa] mb-1">BASE COLOR</div>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={matColor}
                  onChange={(e) => handleUpdateMaterial(e.target.value, matRoughness, matMetalness, matTransmission, matClearcoat, matEmissive)}
                  className="w-7 h-7 border border-[#3f3f46] rounded-sm cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={matColor}
                  onChange={(e) => handleUpdateMaterial(e.target.value, matRoughness, matMetalness, matTransmission, matClearcoat, matEmissive)}
                  className="flex-1 bg-[#18181b] border border-[#3f3f46] px-2 py-0.5 text-xs font-mono text-[#f4f4f5] rounded-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-[#a1a1aa] mb-1">
                <span>ROUGHNESS</span>
                <span className="font-mono">{matRoughness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={matRoughness}
                onChange={(e) => handleUpdateMaterial(matColor, parseFloat(e.target.value), matMetalness, matTransmission, matClearcoat, matEmissive)}
                className="w-full accent-[#71717a] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-[#a1a1aa] mb-1">
                <span>METALLIC</span>
                <span className="font-mono">{matMetalness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={matMetalness}
                onChange={(e) => handleUpdateMaterial(matColor, matRoughness, parseFloat(e.target.value), matTransmission, matClearcoat, matEmissive)}
                className="w-full accent-[#71717a] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-[#a1a1aa] mb-1">
                <span>TRANSMISSION (GLASS)</span>
                <span className="font-mono">{matTransmission.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={matTransmission}
                onChange={(e) => handleUpdateMaterial(matColor, matRoughness, matMetalness, parseFloat(e.target.value), matClearcoat, matEmissive)}
                className="w-full accent-[#71717a] cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Interactive Bottom Timeline & Animation Drawer */}
      {isTimelineOpen && (
        <div className="px-3 py-2 border-t border-[#3f3f46] bg-[#18181b] flex items-center justify-between text-xs font-sans z-20 space-x-4">
          {/* Playback Controls */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              title="Play / Pause Animation (Space)"
              className="p-1.5 bg-[#ea580c] hover:bg-[#f97316] text-white rounded-sm font-semibold flex items-center justify-center"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>

            <button
              onClick={() => setIsLooping(!isLooping)}
              title="Toggle Timeline Loop"
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

      {/* Viewport Bottom Status Bar (Real-Time DCC Telemetry HUD) */}
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

        <div className="flex items-center space-x-3 text-[10px] text-[#71717a]">
          <span>Click: Select Part</span>
          <span>G: Move</span>
          <span>R: Rotate</span>
          <span>S: Scale</span>
          <span>1/3/7: Views</span>
          <span>5: Persp/Ortho</span>
        </div>
      </div>
    </div>
  );
}
