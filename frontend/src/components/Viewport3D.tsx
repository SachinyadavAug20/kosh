"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
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
  Eye,
  EyeOff,
  Sliders,
  Compass,
  Plus,
  Minimize2,
  Check,
  Palette,
  UploadCloud,
  FileCode,
  Wand2,
  Focus,
} from "lucide-react";

export type ShadingMode = "material" | "solid" | "wireframe" | "xray" | "normals";
export type MatcapPreset = "studio" | "clay" | "redwax" | "chrome" | "pearl" | "obsidian";
export type LightingPreset = "studio" | "warm" | "cool" | "sunset" | "flat";
export type TransformMode = "select" | "translate" | "rotate" | "scale";
export type CameraView = "iso" | "front" | "top" | "right";

interface Viewport3DProps {
  assetUrl?: string | null;
  assetName?: string | null;
  format?: "glb" | "stl";
  apiBase?: string;
  onSelectMesh?: (name: string) => void;
}

interface MeshNodeInfo {
  id: string;
  name: string;
  triangles: number;
  vertices: number;
  visible: boolean;
  meshRef: THREE.Mesh;
}

export function Viewport3D({
  assetUrl,
  assetName,
  format = "glb",
  apiBase = "http://localhost:8080",
}: Viewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, config: themeConfig } = useTheme();

  // Viewport Settings
  const [shadingMode, setShadingMode] = useState<ShadingMode>("material");
  const [matcap, setMatcap] = useState<MatcapPreset>("studio");
  const [transformMode, setTransformMode] = useState<TransformMode>("select");
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>("studio");
  const [isOrtho, setIsOrtho] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [showBoundingBox, setShowBoundingBox] = useState<boolean>(false);
  const [showWireframeOverlay, setShowWireframeOverlay] = useState<boolean>(false);
  const [lightIntensity, setLightIntensity] = useState<number>(1.2);

  // Active UI Panels
  const [activePanel, setActivePanel] = useState<"none" | "transform" | "material" | "outliner" | "add" | "lighting">("none");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Mesh & Scene Stats
  const [stats, setStats] = useState<{
    triangles: number;
    vertices: number;
    dimensions: string;
  } | null>(null);

  const [meshList, setMeshList] = useState<MeshNodeInfo[]>([]);
  const [selectedMesh, setSelectedMesh] = useState<THREE.Mesh | null>(null);

  // Live Material Inspector States
  const [matColor, setMatColor] = useState<string>("#9e9e9e");
  const [matRoughness, setMatRoughness] = useState<number>(0.35);
  const [matMetalness, setMatMetalness] = useState<number>(0.15);

  // Live transform values for inspector
  const [liveTransform, setLiveTransform] = useState<{
    pos: [number, number, number];
    rot: [number, number, number];
    scale: [number, number, number];
  }>({
    pos: [0, 0, 0],
    rot: [0, 0, 0],
    scale: [1, 1, 1],
  });

  // Three.js Core Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);

  const rootModelGroupRef = useRef<THREE.Group | null>(null);
  const currentModelRef = useRef<THREE.Object3D | null>(null);
  const shadowPlaneRef = useRef<THREE.Mesh | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null);
  const boxHelperRef = useRef<THREE.BoxHelper | null>(null);

  // Lights
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Wireframe Overlays Cache
  const wireOverlayGroupRef = useRef<THREE.Group | null>(null);

  // 1. Initialize Scene, Cameras, Renderer, and Controls
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // A. Scene with authentic Blender studio gradient background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(themeConfig.viewportBg);
    sceneRef.current = scene;

    // B. Cameras
    const aspect = width / height;
    const perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    perspCamera.position.set(4.5, 3.5, 5.5);
    cameraRef.current = perspCamera;

    const frustumSize = 8;
    const orthoCamera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    orthoCamera.position.set(4.5, 3.5, 5.5);
    orthoCameraRef.current = orthoCamera;

    // C. WebGL Renderer with High-Quality Soft Shadows & Color Management
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // D. Orbit Controls (Blender navigation)
    const orbit = new OrbitControls(perspCamera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.05;
    orbit.autoRotate = autoRotate;
    orbit.autoRotateSpeed = 1.5;
    orbit.target.set(0, 0.8, 0);
    orbitControlsRef.current = orbit;

    // E. Transform Controls (Blender G / R / S Gizmo)
    const transform = new TransformControls(perspCamera, renderer.domElement);
    transform.size = 0.8;
    transform.enabled = false;
    scene.add(transform.getHelper());
    transformControlsRef.current = transform;

    transform.addEventListener("dragging-changed", (event) => {
      orbit.enabled = !event.value;
    });

    transform.addEventListener("change", () => {
      if (transform.object) {
        const obj = transform.object;
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

    // F. Authentic Blender 3-Point Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    // Key Light (Warm soft sunlight)
    const keyLight = new THREE.DirectionalLight(0xfffaee, 1.8);
    keyLight.position.set(6, 10, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);
    keyLightRef.current = keyLight;

    // Fill Light (Cool sky bounce)
    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.9);
    fillLight.position.set(-6, 4, -4);
    scene.add(fillLight);
    fillLightRef.current = fillLight;

    // Rim / Kick Light (Crisp edge separation)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.7);
    rimLight.position.set(0, -5, -6);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    // G. Realistic Contact Shadow Plane (Blender Ground Shadow Catcher)
    const shadowGeo = new THREE.PlaneGeometry(24, 24);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.22 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.001;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);
    shadowPlaneRef.current = shadowPlane;

    // H. Blender Floor Grid & Color-Coded Axes
    const grid = new THREE.GridHelper(16, 32, themeConfig.gridMajor, themeConfig.gridMinor);
    grid.position.y = 0;
    scene.add(grid);
    gridHelperRef.current = grid;

    const axes = new THREE.AxesHelper(3.5);
    (axes.material as THREE.Material).depthTest = false;
    axes.renderOrder = 2;
    scene.add(axes);
    axesHelperRef.current = axes;

    // Root Group for User Models
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

    // I. Authentic Blender Default Object: Smooth Shaded Studio Cube
    const cubeGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8, 4, 4, 4);
    cubeGeo.computeVertexNormals();
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0x9e9e9e, // Authentic Blender studio neutral grey
      roughness: 0.38,
      metalness: 0.12,
    });
    const defaultCube = new THREE.Mesh(cubeGeo, cubeMat);
    defaultCube.position.y = 0.9;
    defaultCube.castShadow = true;
    defaultCube.receiveShadow = true;
    defaultCube.name = "Blender_Default_Cube";

    rootGroup.add(defaultCube);
    currentModelRef.current = defaultCube;
    setSelectedMesh(defaultCube);

    // Bounding Box Helper
    const boxHelper = new THREE.BoxHelper(defaultCube, 0xe68523);
    boxHelper.visible = false;
    scene.add(boxHelper);
    boxHelperRef.current = boxHelper;

    updateMeshListAndStats(defaultCube);

    // J. Animation Render Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const activeCam = isOrtho && orthoCameraRef.current ? orthoCameraRef.current : perspCamera;
      if (orbitControlsRef.current) {
        orbitControlsRef.current.update();
      }
      if (boxHelperRef.current && currentModelRef.current) {
        boxHelperRef.current.update();
      }
      renderer.render(scene, activeCam);
    };
    animate();

    // K. Window Resize
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
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      orbit.dispose();
      transform.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update theme background and grid colors dynamically
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

  // Update Camera Target when Projection toggles
  useEffect(() => {
    if (!orbitControlsRef.current || !cameraRef.current || !orthoCameraRef.current) return;
    const activeCam = isOrtho ? orthoCameraRef.current : cameraRef.current;
    orbitControlsRef.current.object = activeCam;
    if (transformControlsRef.current) {
      transformControlsRef.current.camera = activeCam;
    }
  }, [isOrtho]);

  // Update Auto-Rotate
  useEffect(() => {
    if (orbitControlsRef.current) {
      orbitControlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Update Overlays
  useEffect(() => {
    if (gridHelperRef.current) gridHelperRef.current.visible = showGrid;
    if (axesHelperRef.current) axesHelperRef.current.visible = showAxes;
    if (boxHelperRef.current) boxHelperRef.current.visible = showBoundingBox;
    if (wireOverlayGroupRef.current) wireOverlayGroupRef.current.visible = showWireframeOverlay;
  }, [showGrid, showAxes, showBoundingBox, showWireframeOverlay]);

  // Update Transform Mode (G / R / S Gizmo)
  useEffect(() => {
    if (!transformControlsRef.current) return;
    const tc = transformControlsRef.current;
    if (transformMode === "select") {
      tc.enabled = false;
      tc.detach();
    } else {
      tc.enabled = true;
      tc.setMode(transformMode);
      const target = selectedMesh || currentModelRef.current;
      if (target) {
        tc.attach(target);
      }
    }
  }, [transformMode, selectedMesh]);

  // Update Lighting Presets
  useEffect(() => {
    if (!ambientLightRef.current || !keyLightRef.current || !fillLightRef.current || !rimLightRef.current) return;
    const amb = ambientLightRef.current;
    const key = keyLightRef.current;
    const fill = fillLightRef.current;
    const rim = rimLightRef.current;

    switch (lightingPreset) {
      case "studio":
        amb.color.setHex(0xffffff);
        amb.intensity = 0.65 * lightIntensity;
        key.color.setHex(0xfffaee);
        key.intensity = 1.8 * lightIntensity;
        fill.color.setHex(0xdbeafe);
        fill.intensity = 0.9 * lightIntensity;
        rim.color.setHex(0xffffff);
        rim.intensity = 0.7 * lightIntensity;
        break;
      case "warm":
        amb.color.setHex(0xffedd5);
        amb.intensity = 0.7 * lightIntensity;
        key.color.setHex(0xfb923c);
        key.intensity = 2.0 * lightIntensity;
        fill.color.setHex(0xfef3c7);
        fill.intensity = 0.8 * lightIntensity;
        rim.color.setHex(0xffedd5);
        rim.intensity = 0.6 * lightIntensity;
        break;
      case "cool":
        amb.color.setHex(0xe0f2fe);
        amb.intensity = 0.7 * lightIntensity;
        key.color.setHex(0x38bdf8);
        key.intensity = 1.9 * lightIntensity;
        fill.color.setHex(0x818cf8);
        fill.intensity = 1.0 * lightIntensity;
        rim.color.setHex(0xffffff);
        rim.intensity = 0.8 * lightIntensity;
        break;
      case "sunset":
        amb.color.setHex(0x4c1d95);
        amb.intensity = 0.6 * lightIntensity;
        key.color.setHex(0xf43f5e);
        key.intensity = 2.2 * lightIntensity;
        fill.color.setHex(0x0284c7);
        fill.intensity = 1.1 * lightIntensity;
        rim.color.setHex(0xfbbf24);
        rim.intensity = 1.0 * lightIntensity;
        break;
      case "flat":
        amb.color.setHex(0xffffff);
        amb.intensity = 2.2 * lightIntensity;
        key.intensity = 0.1;
        fill.intensity = 0.1;
        rim.intensity = 0.1;
        break;
    }
  }, [lightingPreset, lightIntensity]);

  // Apply Shading Modes & True Matcaps
  const applyShading = useCallback(() => {
    if (!currentModelRef.current) return;

    currentModelRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material;
        }

        switch (shadingMode) {
          case "wireframe":
            child.material = new THREE.MeshBasicMaterial({
              color: 0xe0e0e0,
              wireframe: true,
            });
            break;

          case "xray":
            child.material = new THREE.MeshStandardMaterial({
              color: 0x38bdf8,
              transparent: true,
              opacity: 0.45,
              roughness: 0.2,
              metalness: 0.8,
              depthWrite: false,
            });
            break;

          case "normals":
            child.material = new THREE.MeshNormalMaterial();
            break;

          case "solid":
            let solidColor = 0x9e9e9e;
            let roughness = 0.35;
            let metalness = 0.15;

            if (matcap === "clay") {
              solidColor = 0xb45309; // Warm Terracotta sculpt
              roughness = 0.85;
              metalness = 0.05;
            } else if (matcap === "redwax") {
              solidColor = 0x9f1239; // Classic ZBrush / Blender red wax
              roughness = 0.38;
              metalness = 0.25;
            } else if (matcap === "chrome") {
              solidColor = 0xf4f4f5; // Chrome mirror
              roughness = 0.02;
              metalness = 0.98;
            } else if (matcap === "pearl") {
              solidColor = 0xf8fafc; // Clean pearl ceramic
              roughness = 0.15;
              metalness = 0.4;
            } else if (matcap === "obsidian") {
              solidColor = 0x18181b; // Matte obsidian
              roughness = 0.25;
              metalness = 0.85;
            }

            child.material = new THREE.MeshStandardMaterial({
              color: solidColor,
              roughness,
              metalness,
              wireframe: false,
            });
            break;

          case "material":
          default:
            if (child.userData.originalMaterial) {
              child.material = child.userData.originalMaterial;
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => (m.wireframe = false));
              } else {
                child.material.wireframe = false;
              }
            }
            break;
        }
      }
    });

    // Rebuild wireframe overlays
    buildWireframeOverlays(currentModelRef.current);
  }, [shadingMode, matcap]);

  useEffect(() => {
    applyShading();
  }, [applyShading]);

  // Build clean wireframe overlays without distorting original geometry
  const buildWireframeOverlays = (model: THREE.Object3D | null) => {
    if (!wireOverlayGroupRef.current) return;
    const wireGroup = wireOverlayGroupRef.current;
    while (wireGroup.children.length > 0) {
      wireGroup.remove(wireGroup.children[0]);
    }

    if (!model) return;

    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const wireGeo = new THREE.WireframeGeometry(child.geometry);
        const wireMat = new THREE.LineBasicMaterial({
          color: 0x484848,
          linewidth: 1,
          transparent: true,
          opacity: 0.6,
        });
        const line = new THREE.LineSegments(wireGeo, wireMat);
        line.position.copy(child.position);
        line.rotation.copy(child.rotation);
        line.scale.copy(child.scale);
        wireGroup.add(line);
      }
    });
  };

  const updateMeshListAndStats = (object: THREE.Object3D) => {
    const meshes: MeshNodeInfo[] = [];
    let totalTris = 0;
    let totalVerts = 0;

    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const geom = child.geometry;

        let tris = 0;
        let verts = 0;
        if (geom.index) {
          tris = geom.index.count / 3;
        } else if (geom.attributes.position) {
          tris = geom.attributes.position.count / 3;
        }
        if (geom.attributes.position) {
          verts = geom.attributes.position.count;
        }

        totalTris += Math.round(tris);
        totalVerts += Math.round(verts);

        meshes.push({
          id: child.uuid,
          name: child.name || `Mesh_${meshes.length + 1}`,
          triangles: Math.round(tris),
          vertices: Math.round(verts),
          visible: child.visible,
          meshRef: child,
        });
      }
    });

    setMeshList(meshes);

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);

    setStats({
      triangles: totalTris,
      vertices: totalVerts,
      dimensions: `${(size.x * 10).toFixed(1)} × ${(size.y * 10).toFixed(1)} × ${(size.z * 10).toFixed(1)} mm`,
    });
  };

  // Frame Camera on Object
  const frameObject = (object: THREE.Object3D) => {
    if (!cameraRef.current || !orbitControlsRef.current) return;
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 1.5);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    const cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

    cameraRef.current.position.set(
      center.x + cameraDistance * 0.7,
      center.y + cameraDistance * 0.6,
      center.z + cameraDistance * 0.8
    );
    orbitControlsRef.current.target.copy(center);
    orbitControlsRef.current.update();
  };

  // Load 3D Asset from URL or API
  useEffect(() => {
    if (!assetUrl || !sceneRef.current || !rootModelGroupRef.current) return;

    const fullUrl = assetUrl.startsWith("http") ? assetUrl : `${apiBase}${assetUrl}`;
    const rootGroup = rootModelGroupRef.current;
    setIsLoadingModel(true);

    const onModelLoaded = (object: THREE.Object3D) => {
      while (rootGroup.children.length > 0) {
        rootGroup.remove(rootGroup.children[0]);
      }

      rootGroup.add(object);
      currentModelRef.current = object;
      setSelectedMesh(null);

      updateMeshListAndStats(object);
      frameObject(object);

      if (boxHelperRef.current) {
        boxHelperRef.current.setFromObject(object);
      }

      applyShading();
      setIsLoadingModel(false);
    };

    if (assetUrl.toLowerCase().endsWith(".stl") || format === "stl") {
      const loader = new STLLoader();
      loader.load(
        fullUrl,
        (geom) => {
          geom.computeVertexNormals();
          // Studio Brushed Titanium Material for CAD
          const mat = new THREE.MeshStandardMaterial({
            color: 0xb0b5ba,
            metalness: 0.75,
            roughness: 0.28,
          });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.name = assetName || "CAD_STL_Model";
          onModelLoaded(mesh);
        },
        undefined,
        (err) => {
          console.error("Failed to load STL model:", err);
          setIsLoadingModel(false);
        }
      );
    } else {
      const loader = new GLTFLoader();
      loader.load(
        fullUrl,
        (gltf) => {
          const model = gltf.scene;
          model.name = assetName || "Blender_GLTF_Model";
          onModelLoaded(model);
        },
        undefined,
        (err) => {
          console.error("Failed to load GLTF model:", err);
          setIsLoadingModel(false);
        }
      );
    }
  }, [assetUrl, format, apiBase]);

  // Drag and Drop Local File Handler (.glb, .gltf, .stl)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const file = e.dataTransfer.files[0];
    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    setIsLoadingModel(true);

    reader.onload = (event) => {
      const contents = event.target?.result;
      if (!contents || !rootModelGroupRef.current) return;
      const rootGroup = rootModelGroupRef.current;

      const finishLoad = (object: THREE.Object3D) => {
        while (rootGroup.children.length > 0) {
          rootGroup.remove(rootGroup.children[0]);
        }
        rootGroup.add(object);
        currentModelRef.current = object;
        setSelectedMesh(null);
        updateMeshListAndStats(object);
        frameObject(object);
        applyShading();
        setIsLoadingModel(false);
      };

      if (fileName.endsWith(".stl")) {
        const loader = new STLLoader();
        const geom = loader.parse(contents as ArrayBuffer);
        geom.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({
          color: 0x9e9e9e,
          metalness: 0.5,
          roughness: 0.35,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.name = file.name;
        finishLoad(mesh);
      } else if (fileName.endsWith(".glb") || fileName.endsWith(".gltf")) {
        const loader = new GLTFLoader();
        loader.parse(
          contents as ArrayBuffer,
          "",
          (gltf) => {
            finishLoad(gltf.scene);
          },
          (err) => {
            console.error("Error parsing dropped GLTF:", err);
            setIsLoadingModel(false);
          }
        );
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Primitive Spawner (Shift+A / Add menu)
  const spawnPrimitive = (type: "cube" | "sphere" | "cylinder" | "cone" | "torus" | "pyramid" | "plane") => {
    if (!rootModelGroupRef.current) return;
    const rootGroup = rootModelGroupRef.current;

    let geo: THREE.BufferGeometry;
    let name = type.toUpperCase();
    let initialY = 0.9;

    switch (type) {
      case "sphere":
        geo = new THREE.SphereGeometry(1.2, 32, 24);
        initialY = 1.2;
        break;
      case "cylinder":
        geo = new THREE.CylinderGeometry(1.0, 1.0, 2.0, 32);
        initialY = 1.0;
        break;
      case "cone":
        geo = new THREE.ConeGeometry(1.2, 2.2, 32);
        initialY = 1.1;
        break;
      case "torus":
        geo = new THREE.TorusGeometry(1.0, 0.35, 24, 48);
        initialY = 1.0;
        break;
      case "pyramid":
        geo = new THREE.ConeGeometry(1.5, 2.2, 4);
        initialY = 1.1;
        break;
      case "plane":
        geo = new THREE.PlaneGeometry(3, 3);
        initialY = 0.01;
        break;
      case "cube":
      default:
        geo = new THREE.BoxGeometry(1.8, 1.8, 1.8, 4, 4, 4);
        initialY = 0.9;
        break;
    }

    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9e9e9e,
      roughness: 0.35,
      metalness: 0.15,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${name}_${Date.now().toString().slice(-4)}`;
    mesh.position.set(0, initialY, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    while (rootGroup.children.length > 0) {
      rootGroup.remove(rootGroup.children[0]);
    }
    rootGroup.add(mesh);
    currentModelRef.current = mesh;
    setSelectedMesh(mesh);

    updateMeshListAndStats(mesh);
    frameObject(mesh);
    applyShading();
    setActivePanel("none");
  };

  // Quick Mesh Transforms (Snap to Floor, Center, Reset)
  const snapToFloor = () => {
    if (!currentModelRef.current) return;
    const box = new THREE.Box3().setFromObject(currentModelRef.current);
    currentModelRef.current.position.y -= box.min.y;
    currentModelRef.current.updateMatrixWorld();
  };

  const centerToOrigin = () => {
    if (!currentModelRef.current) return;
    const box = new THREE.Box3().setFromObject(currentModelRef.current);
    const center = new THREE.Vector3();
    box.getCenter(center);
    currentModelRef.current.position.x -= center.x;
    currentModelRef.current.position.z -= center.z;
    currentModelRef.current.updateMatrixWorld();
  };

  const clearTransforms = () => {
    if (!currentModelRef.current) return;
    currentModelRef.current.position.set(0, 0, 0);
    currentModelRef.current.rotation.set(0, 0, 0);
    currentModelRef.current.scale.set(1, 1, 1);
    snapToFloor();
    currentModelRef.current.updateMatrixWorld();
  };

  // Live Material Color Tweaker
  const handleUpdateMaterial = (color: string, roughness: number, metalness: number) => {
    setMatColor(color);
    setMatRoughness(roughness);
    setMatMetalness(metalness);

    const target = selectedMesh || currentModelRef.current;
    if (!target) return;

    target.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.color.set(color);
          child.material.roughness = roughness;
          child.material.metalness = metalness;
          child.material.needsUpdate = true;
        }
      }
    });
  };

  // Set Camera View Presets (Front, Top, Right, Iso)
  const setCameraPreset = (view: CameraView) => {
    if (!cameraRef.current || !orbitControlsRef.current) return;
    const cam = cameraRef.current;
    const target = orbitControlsRef.current.target;
    const dist = 7.0;

    switch (view) {
      case "front":
        cam.position.set(target.x, target.y, target.z + dist);
        break;
      case "right":
        cam.position.set(target.x + dist, target.y, target.z);
        break;
      case "top":
        cam.position.set(target.x, target.y + dist, target.z + 0.001);
        break;
      case "iso":
      default:
        cam.position.set(target.x + dist * 0.6, target.y + dist * 0.5, target.z + dist * 0.6);
        break;
    }
    orbitControlsRef.current.update();
  };

  // Export Active Scene as GLB
  const handleExportGLB = () => {
    if (!currentModelRef.current) return;
    const exporter = new GLTFExporter();
    exporter.parse(
      currentModelRef.current,
      (gltf) => {
        const blob = new Blob([gltf as ArrayBuffer], { type: "application/octet-stream" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${assetName || "kosh_model"}.glb`;
        link.click();
      },
      (error) => console.error("Export error:", error),
      { binary: true }
    );
  };

  // Render PNG Snapshot
  const handleRenderSnapshot = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${assetName || "kosh_render"}_snapshot.png`;
    link.click();
  };

  return (
    <div
      className={`relative flex flex-col h-full w-full bg-[var(--background)] text-[var(--foreground)] overflow-hidden font-mono text-xs ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* 1. Viewport Top Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-header)] select-none">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5">
            <Box className="w-4 h-4 text-[var(--accent)]" />
            <span className="font-bold tracking-wide">Blender_Viewport</span>
            <span className="text-[10px] text-[var(--text-muted)]">({format.toUpperCase()})</span>
          </div>

          {isLoadingModel && (
            <div className="flex items-center space-x-1 text-[11px] text-[var(--accent)] animate-pulse">
              <Sparkles className="w-3 h-3" />
              <span>LOADING MESH...</span>
            </div>
          )}
        </div>

        {/* Shading Mode Selector (Material / Solid / Wireframe / X-Ray / Normals) */}
        <div className="flex items-center space-x-1">
          <div className="flex items-center bg-[var(--bg-subpanel)] border border-[var(--border)] p-0.5 text-[11px]">
            {(["material", "solid", "wireframe", "xray", "normals"] as ShadingMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setShadingMode(mode)}
                className={`px-2 py-0.5 uppercase transition-colors ${
                  shadingMode === mode
                    ? "bg-[var(--accent)] text-[var(--background)] font-bold shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Quick Panels Toggles */}
          <button
            onClick={() => setActivePanel(activePanel === "transform" ? "none" : "transform")}
            title="Transform Inspector (G/R/S)"
            className={`p-1.5 border transition-colors ${
              activePanel === "transform"
                ? "bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]"
                : "bg-[var(--bg-panel)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActivePanel(activePanel === "material" ? "none" : "material")}
            title="Material Tweaker"
            className={`p-1.5 border transition-colors ${
              activePanel === "material"
                ? "bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]"
                : "bg-[var(--bg-panel)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActivePanel(activePanel === "outliner" ? "none" : "outliner")}
            title="Scene Outliner Hierarchy"
            className={`p-1.5 border transition-colors ${
              activePanel === "outliner"
                ? "bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]"
                : "bg-[var(--bg-panel)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActivePanel(activePanel === "add" ? "none" : "add")}
            title="Add Primitives (Shift+A)"
            className={`p-1.5 border transition-colors ${
              activePanel === "add"
                ? "bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]"
                : "bg-[var(--bg-panel)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActivePanel(activePanel === "lighting" ? "none" : "lighting")}
            title="Studio Lighting Presets"
            className={`p-1.5 border transition-colors ${
              activePanel === "lighting"
                ? "bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]"
                : "bg-[var(--bg-panel)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main 3D Canvas Container */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden" ref={containerRef}>
        {/* Drag & Drop Visual Overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-40 bg-[var(--background)]/85 border-2 border-dashed border-[var(--accent)] flex flex-col items-center justify-center pointer-events-none">
            <UploadCloud className="w-12 h-12 text-[var(--accent)] animate-bounce mb-2" />
            <span className="text-sm font-bold text-[var(--foreground)]">DROP .GLB / .STL MODEL HERE</span>
            <span className="text-xs text-[var(--text-muted)]">Immediate client-side viewport inspection</span>
          </div>
        )}

        {/* Floating Blender Left Navigation Toolbar (Camera Views & Tools) */}
        <div className="absolute top-3 left-3 z-10 flex flex-col space-y-1 bg-[var(--bg-panel)]/90 backdrop-blur border border-[var(--border)] p-1 shadow-xl">
          {/* Transform Gizmo Selector */}
          <button
            onClick={() => setTransformMode("translate")}
            title="Move / Translate (G)"
            className={`p-1.5 transition-colors ${
              transformMode === "translate"
                ? "bg-[var(--accent)] text-[var(--background)]"
                : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Move className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setTransformMode("rotate")}
            title="Rotate (R)"
            className={`p-1.5 transition-colors ${
              transformMode === "rotate"
                ? "bg-[var(--accent)] text-[var(--background)]"
                : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setTransformMode("scale")}
            title="Scale (S)"
            className={`p-1.5 transition-colors ${
              transformMode === "scale"
                ? "bg-[var(--accent)] text-[var(--background)]"
                : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
          </button>

          <div className="w-full h-px bg-[var(--border)] my-1" />

          {/* Camera Angles */}
          <button
            onClick={() => setCameraPreset("front")}
            title="Front View (NumPad 1)"
            className="px-1.5 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)]"
          >
            FRONT
          </button>

          <button
            onClick={() => setCameraPreset("right")}
            title="Right View (NumPad 3)"
            className="px-1.5 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)]"
          >
            RIGHT
          </button>

          <button
            onClick={() => setCameraPreset("top")}
            title="Top View (NumPad 7)"
            className="px-1.5 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)]"
          >
            TOP
          </button>

          <button
            onClick={() => setCameraPreset("iso")}
            title="Isometric Perspective"
            className="px-1.5 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)]"
          >
            ISO
          </button>

          <div className="w-full h-px bg-[var(--border)] my-1" />

          {/* Perspective / Orthographic Toggle */}
          <button
            onClick={() => setIsOrtho(!isOrtho)}
            title="Toggle Ortho / Perspective (NumPad 5)"
            className={`px-1.5 py-1 text-[10px] font-bold ${
              isOrtho ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {isOrtho ? "ORTHO" : "PERSP"}
          </button>

          {/* Frame Selected */}
          <button
            onClick={() => currentModelRef.current && frameObject(currentModelRef.current)}
            title="Frame Selected Object (Period .)"
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--foreground)]"
          >
            <Focus className="w-3.5 h-3.5" />
          </button>

          {/* Floor Grid Toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Floor Grid"
            className={`p-1.5 ${
              showGrid ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Turntable Auto-Rotate */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title="Toggle Turntable 360° (Space)"
            className={`p-1.5 ${
              autoRotate ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Solid Matcap Drawer (Appears when Solid shading is active) */}
        {shadingMode === "solid" && (
          <div className="absolute top-3 right-3 z-10 flex items-center space-x-1 bg-[var(--bg-panel)]/90 backdrop-blur border border-[var(--border)] p-1 text-[10px]">
            <span className="text-[var(--text-muted)] px-1">MATCAP:</span>
            {(["studio", "clay", "redwax", "chrome", "pearl", "obsidian"] as MatcapPreset[]).map((m) => (
              <button
                key={m}
                onClick={() => setMatcap(m)}
                className={`px-2 py-0.5 uppercase transition-colors ${
                  matcap === m
                    ? "bg-[var(--accent)] text-[var(--background)] font-bold"
                    : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* Transform Inspector Drawer */}
        {activePanel === "transform" && (
          <div className="absolute top-12 right-3 z-20 w-64 bg-[var(--bg-panel)]/95 backdrop-blur border border-[var(--border)] p-3 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
              <span className="font-bold flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" />
                TRANSFORM INSPECTOR
              </span>
              <button onClick={() => setActivePanel("none")} className="text-[var(--text-muted)] hover:text-[var(--foreground)]">
                ✕
              </button>
            </div>

            {/* Position */}
            <div>
              <div className="text-[10px] text-[var(--text-muted)] mb-1">POSITION (X, Y, Z)</div>
              <div className="grid grid-cols-3 gap-1 text-[11px]">
                <div className="bg-[var(--bg-subpanel)] border border-[var(--border)] px-1.5 py-0.5">X: {liveTransform.pos[0]}</div>
                <div className="bg-[var(--bg-subpanel)] border border-[var(--border)] px-1.5 py-0.5">Y: {liveTransform.pos[1]}</div>
                <div className="bg-[var(--bg-subpanel)] border border-[var(--border)] px-1.5 py-0.5">Z: {liveTransform.pos[2]}</div>
              </div>
            </div>

            {/* Rotation */}
            <div>
              <div className="text-[10px] text-[var(--text-muted)] mb-1">ROTATION (DEG)</div>
              <div className="grid grid-cols-3 gap-1 text-[11px]">
                <div className="bg-[var(--bg-subpanel)] border border-[var(--border)] px-1.5 py-0.5">X: {liveTransform.rot[0]}°</div>
                <div className="bg-[var(--bg-subpanel)] border border-[var(--border)] px-1.5 py-0.5">Y: {liveTransform.rot[1]}°</div>
                <div className="bg-[var(--bg-subpanel)] border border-[var(--border)] px-1.5 py-0.5">Z: {liveTransform.rot[2]}°</div>
              </div>
            </div>

            {/* Scale */}
            <div>
              <div className="text-[10px] text-[var(--text-muted)] mb-1">SCALE</div>
              <div className="grid grid-cols-3 gap-1 text-[11px]">
                <div className="bg-[var(--bg-subpanel)] border border-[var(--border)] px-1.5 py-0.5">X: {liveTransform.scale[0]}</div>
                <div className="bg-[var(--bg-subpanel)] border border-[var(--border)] px-1.5 py-0.5">Y: {liveTransform.scale[1]}</div>
                <div className="bg-[var(--bg-subpanel)] border border-[var(--border)] px-1.5 py-0.5">Z: {liveTransform.scale[2]}</div>
              </div>
            </div>

            {/* Quick Mesh Operations */}
            <div className="pt-2 border-t border-[var(--border)] space-y-1.5">
              <button
                onClick={snapToFloor}
                className="w-full py-1 bg-[var(--bg-subpanel)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--foreground)] transition-colors"
              >
                Snap to Floor (Z = 0)
              </button>
              <button
                onClick={centerToOrigin}
                className="w-full py-1 bg-[var(--bg-subpanel)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--foreground)] transition-colors"
              >
                Center to Origin
              </button>
              <button
                onClick={clearTransforms}
                className="w-full py-1 bg-[var(--bg-subpanel)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--foreground)] transition-colors"
              >
                Clear All Transforms
              </button>
            </div>
          </div>
        )}

        {/* Live Material Tweaker Drawer */}
        {activePanel === "material" && (
          <div className="absolute top-12 right-3 z-20 w-64 bg-[var(--bg-panel)]/95 backdrop-blur border border-[var(--border)] p-3 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
              <span className="font-bold flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-[var(--accent)]" />
                MATERIAL TWEAKER
              </span>
              <button onClick={() => setActivePanel("none")} className="text-[var(--text-muted)] hover:text-[var(--foreground)]">
                ✕
              </button>
            </div>

            {/* Base Color Picker */}
            <div>
              <div className="text-[10px] text-[var(--text-muted)] mb-1">BASE COLOR</div>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={matColor}
                  onChange={(e) => handleUpdateMaterial(e.target.value, matRoughness, matMetalness)}
                  className="w-8 h-8 border border-[var(--border)] cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={matColor}
                  onChange={(e) => handleUpdateMaterial(e.target.value, matRoughness, matMetalness)}
                  className="flex-1 bg-[var(--bg-subpanel)] border border-[var(--border)] px-2 py-1 text-xs font-mono"
                />
              </div>
            </div>

            {/* Roughness Slider */}
            <div>
              <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
                <span>ROUGHNESS</span>
                <span>{matRoughness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={matRoughness}
                onChange={(e) => handleUpdateMaterial(matColor, parseFloat(e.target.value), matMetalness)}
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
            </div>

            {/* Metalness Slider */}
            <div>
              <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
                <span>METALLIC</span>
                <span>{matMetalness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={matMetalness}
                onChange={(e) => handleUpdateMaterial(matColor, matRoughness, parseFloat(e.target.value))}
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
            </div>

            {/* Wireframe Overlay Checkbox */}
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-muted)]">Wireframe Overlay</span>
              <button
                onClick={() => setShowWireframeOverlay(!showWireframeOverlay)}
                className={`px-2 py-0.5 border text-[10px] ${
                  showWireframeOverlay
                    ? "bg-[var(--accent)] text-[var(--background)] font-bold border-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--text-muted)]"
                }`}
              >
                {showWireframeOverlay ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        )}

        {/* Add Primitives Drawer (Shift+A) */}
        {activePanel === "add" && (
          <div className="absolute top-12 right-3 z-20 w-56 bg-[var(--bg-panel)]/95 backdrop-blur border border-[var(--border)] p-2 shadow-2xl space-y-1">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-1 px-1">
              <span className="font-bold flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-[var(--accent)]" />
                ADD PRIMITIVE
              </span>
              <button onClick={() => setActivePanel("none")} className="text-[var(--text-muted)] hover:text-[var(--foreground)]">
                ✕
              </button>
            </div>
            {(["cube", "sphere", "cylinder", "cone", "torus", "pyramid", "plane"] as const).map((prim) => (
              <button
                key={prim}
                onClick={() => spawnPrimitive(prim)}
                className="w-full text-left px-2.5 py-1.5 hover:bg-[var(--accent)] hover:text-[var(--background)] capitalize text-[11px] transition-colors"
              >
                + {prim}
              </button>
            ))}
          </div>
        )}

        {/* Scene Outliner Drawer */}
        {activePanel === "outliner" && (
          <div className="absolute top-12 right-3 z-20 w-64 max-h-80 overflow-y-auto bg-[var(--bg-panel)]/95 backdrop-blur border border-[var(--border)] p-3 shadow-2xl space-y-2">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
              <span className="font-bold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
                SCENE OUTLINER
              </span>
              <button onClick={() => setActivePanel("none")} className="text-[var(--text-muted)] hover:text-[var(--foreground)]">
                ✕
              </button>
            </div>

            <div className="space-y-1">
              {meshList.length === 0 ? (
                <div className="text-[var(--text-muted)] py-2 text-center">No meshes in scene</div>
              ) : (
                meshList.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedMesh(m.meshRef);
                      if (transformControlsRef.current) {
                        transformControlsRef.current.attach(m.meshRef);
                      }
                    }}
                    className={`flex items-center justify-between p-1.5 border cursor-pointer transition-colors ${
                      selectedMesh === m.meshRef
                        ? "bg-[var(--accent)] text-[var(--background)] font-bold border-[var(--accent)]"
                        : "bg-[var(--bg-subpanel)] border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]"
                    }`}
                  >
                    <span className="truncate flex-1">{m.name}</span>
                    <span className="text-[10px] opacity-75">{m.triangles.toLocaleString()} tris</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Lighting Presets Drawer */}
        {activePanel === "lighting" && (
          <div className="absolute top-12 right-3 z-20 w-56 bg-[var(--bg-panel)]/95 backdrop-blur border border-[var(--border)] p-3 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
              <span className="font-bold flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-[var(--accent)]" />
                LIGHTING PRESETS
              </span>
              <button onClick={() => setActivePanel("none")} className="text-[var(--text-muted)] hover:text-[var(--foreground)]">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {(["studio", "warm", "cool", "sunset", "flat"] as LightingPreset[]).map((lp) => (
                <button
                  key={lp}
                  onClick={() => setLightingPreset(lp)}
                  className={`py-1 text-center uppercase border text-[10px] transition-colors ${
                    lightingPreset === lp
                      ? "bg-[var(--accent)] text-[var(--background)] font-bold border-[var(--accent)]"
                      : "bg-[var(--bg-subpanel)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {lp}
                </button>
              ))}
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
                <span>INTENSITY</span>
                <span>{lightIntensity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="3.0"
                step="0.2"
                value={lightIntensity}
                onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Viewport Bottom Status Bar & Action Shortcuts */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t border-[var(--border)] bg-[var(--bg-panel)] select-none text-[11px]">
        {/* Mesh Statistics */}
        <div className="flex items-center space-x-3 text-[var(--text-muted)]">
          {stats ? (
            <>
              <span>
                TRIS: <strong className="text-[var(--foreground)]">{stats.triangles.toLocaleString()}</strong>
              </span>
              <span>
                VERTS: <strong className="text-[var(--foreground)]">{stats.vertices.toLocaleString()}</strong>
              </span>
              <span>
                SIZE: <strong className="text-[var(--foreground)]">{stats.dimensions}</strong>
              </span>
            </>
          ) : (
            <span>READY</span>
          )}
        </div>

        {/* Action Shortcuts & Export Suite */}
        <div className="flex items-center space-x-2">
          <div className="hidden lg:flex items-center space-x-2 text-[10px] text-[var(--text-muted)] border-r border-[var(--border)] pr-2">
            <span>G: Move</span>
            <span>R: Rotate</span>
            <span>S: Scale</span>
            <span>1/3/7: Views</span>
          </div>

          <button
            onClick={handleRenderSnapshot}
            title="Export High-Res PNG Viewport Snapshot"
            className="flex items-center space-x-1 px-2.5 py-1 bg-[var(--bg-subpanel)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--foreground)] transition-colors"
          >
            <Camera className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>RENDER PNG</span>
          </button>

          <button
            onClick={handleExportGLB}
            title="Download Active Model as GLB"
            className="flex items-center space-x-1 px-2.5 py-1 bg-[var(--accent)] text-[var(--background)] font-bold hover:opacity-90 transition-opacity"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT GLB</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Toggle Viewport Fullscreen"
            className="p-1 border border-[var(--border)] bg-[var(--bg-subpanel)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
