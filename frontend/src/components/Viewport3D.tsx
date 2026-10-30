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
} from "lucide-react";

export type ShadingMode = "solid" | "material" | "wireframe" | "normals";
export type MatcapPreset = "studio" | "clay" | "redwax" | "chrome" | "obsidian";
export type CameraView = "iso" | "front" | "top" | "right";

interface Viewport3DProps {
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
  onMeshSelect?: (meshName: string) => void;
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
  snapshotUrl,
  telemetry,
  format = "glb",
  apiBase = "http://localhost:8080",
}: Viewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, config: themeConfig } = useTheme();

  // Viewport Settings
  const [shadingMode, setShadingMode] = useState<ShadingMode>("solid");
  const [matcap, setMatcap] = useState<MatcapPreset>("studio");
  const [transformMode, setTransformMode] = useState<"select" | "translate" | "rotate" | "scale">("select");
  const [isOrtho, setIsOrtho] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [showWireOverlay, setShowWireOverlay] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Active Overlay Popovers
  const [activeOverlay, setActiveOverlay] = useState<"none" | "material" | "transform" | "add">("none");

  // Stats
  const [stats, setStats] = useState<{
    triangles: number;
    vertices: number;
    dimensions: string;
  } | null>(null);

  const [meshList, setMeshList] = useState<MeshNodeInfo[]>([]);
  const [selectedMesh, setSelectedMesh] = useState<THREE.Mesh | null>(null);

  // Live Material State
  const [matColor, setMatColor] = useState<string>("#8e9297");
  const [matRoughness, setMatRoughness] = useState<number>(0.35);
  const [matMetalness, setMatMetalness] = useState<number>(0.25);

  // Live Transform State
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
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null);
  const wireOverlayGroupRef = useRef<THREE.Group | null>(null);

  // 1. Initialize Scene, Cameras, Renderer, and Controls
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // A. Scene (Clean neutral dark gray studio)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(themeConfig.viewportBg);
    sceneRef.current = scene;

    // B. Cameras
    const aspect = width / height;
    const perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    perspCamera.position.set(4.5, 3.2, 5.5);
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
    orthoCamera.position.set(4.5, 3.2, 5.5);
    orthoCameraRef.current = orthoCamera;

    // C. Renderer (Anti-aliased, PCF Soft Shadows, ACES Filmic tone mapping)
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
    renderer.toneMappingExposure = 1.05;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // D. Orbit Controls (Blender navigation)
    const orbit = new OrbitControls(perspCamera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.05;
    orbit.autoRotate = autoRotate;
    orbit.autoRotateSpeed = 1.2;
    orbit.target.set(0, 0.8, 0);
    orbitControlsRef.current = orbit;

    // E. Transform Controls (Gizmo)
    const transform = new TransformControls(perspCamera, renderer.domElement);
    transform.size = 0.75;
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

    // F. Studio 3-Point Lighting Setup (Zero neon, pure neutral photography lighting)
    const ambLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambLight);

    const keyLight = new THREE.DirectionalLight(0xfffaed, 2.0);
    keyLight.position.set(6, 10, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe2e8f0, 0.9);
    fillLight.position.set(-6, 4, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.75);
    rimLight.position.set(0, -4, -6);
    scene.add(rimLight);

    // G. Realistic Contact Ground Shadow Catcher
    const shadowGeo = new THREE.PlaneGeometry(24, 24);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.28 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.001;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // H. Floor Grid & Axes (Neutral crisp lines)
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

    // J. Animation Render Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const activeCam = isOrtho && orthoCameraRef.current ? orthoCameraRef.current : perspCamera;
      if (orbitControlsRef.current) orbitControlsRef.current.update();
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
      cancelAnimationFrame(animId);
      orbit.dispose();
      transform.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
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

  // Update camera target when projection toggles
  useEffect(() => {
    if (!orbitControlsRef.current || !cameraRef.current || !orthoCameraRef.current) return;
    const activeCam = isOrtho ? orthoCameraRef.current : cameraRef.current;
    orbitControlsRef.current.object = activeCam;
    if (transformControlsRef.current) transformControlsRef.current.camera = activeCam;
  }, [isOrtho]);

  // Update Auto-Rotate
  useEffect(() => {
    if (orbitControlsRef.current) orbitControlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  // Update Overlays
  useEffect(() => {
    if (gridHelperRef.current) gridHelperRef.current.visible = showGrid;
    if (axesHelperRef.current) axesHelperRef.current.visible = showAxes;
    if (wireOverlayGroupRef.current) wireOverlayGroupRef.current.visible = showWireOverlay;
  }, [showGrid, showAxes, showWireOverlay]);

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
      const target = selectedMesh || currentModelRef.current;
      if (target) tc.attach(target);
    }
  }, [transformMode, selectedMesh]);

  // Apply Shading Modes
  const applyShading = useCallback(() => {
    if (!currentModelRef.current) return;

    currentModelRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material;
        }

        switch (shadingMode) {
          case "wireframe":
            child.material = new THREE.MeshBasicMaterial({ color: 0xd4d4d8, wireframe: true });
            break;

          case "normals":
            child.material = new THREE.MeshNormalMaterial();
            break;

          case "solid":
            let color = 0x8e9297;
            let roughness = 0.35;
            let metalness = 0.25;

            if (matcap === "clay") {
              color = 0x9a3412; // Terracotta clay
              roughness = 0.85;
              metalness = 0.05;
            } else if (matcap === "redwax") {
              color = 0x881337; // Classic sculpting wax
              roughness = 0.38;
              metalness = 0.2;
            } else if (matcap === "chrome") {
              color = 0xf4f4f5; // Polished chrome
              roughness = 0.04;
              metalness = 0.98;
            } else if (matcap === "obsidian") {
              color = 0x18181b; // Matte graphite
              roughness = 0.25;
              metalness = 0.8;
            }

            child.material = new THREE.MeshStandardMaterial({
              color,
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

    buildWireframeOverlays(currentModelRef.current);
  }, [shadingMode, matcap]);

  useEffect(() => {
    applyShading();
  }, [applyShading]);

  const buildWireframeOverlays = (model: THREE.Object3D | null) => {
    if (!wireOverlayGroupRef.current) return;
    const wireGroup = wireOverlayGroupRef.current;
    while (wireGroup.children.length > 0) wireGroup.remove(wireGroup.children[0]);
    if (!model) return;

    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const wireGeo = new THREE.WireframeGeometry(child.geometry);
        const wireMat = new THREE.LineBasicMaterial({
          color: 0x52525b,
          linewidth: 1,
          transparent: true,
          opacity: 0.5,
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
        if (geom.index) tris = geom.index.count / 3;
        else if (geom.attributes.position) tris = geom.attributes.position.count / 3;
        if (geom.attributes.position) verts = geom.attributes.position.count;

        totalTris += Math.round(tris);
        totalVerts += Math.round(verts);

        meshes.push({
          id: child.uuid,
          name: child.name || `Object_${meshes.length + 1}`,
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

  // Load Model from Backend URL
  useEffect(() => {
    if (!assetUrl || !sceneRef.current || !rootModelGroupRef.current) return;

    const fullUrl = assetUrl.startsWith("http") ? assetUrl : `${apiBase}${assetUrl}`;
    const rootGroup = rootModelGroupRef.current;
    setIsLoadingModel(true);

    const onModelLoaded = (object: THREE.Object3D) => {
      while (rootGroup.children.length > 0) rootGroup.remove(rootGroup.children[0]);
      rootGroup.add(object);
      currentModelRef.current = object;
      setSelectedMesh(null);

      updateMeshListAndStats(object);
      frameObject(object);
      applyShading();
      setIsLoadingModel(false);
    };

    if (assetUrl.toLowerCase().endsWith(".stl") || format === "stl") {
      const loader = new STLLoader();
      loader.load(
        fullUrl,
        (geom) => {
          geom.computeVertexNormals();
          const mat = new THREE.MeshStandardMaterial({
            color: 0x8e9297,
            metalness: 0.8,
            roughness: 0.25,
          });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.name = assetName || "CAD_STL_Model";
          onModelLoaded(mesh);
        },
        undefined,
        (err) => {
          console.error("STL load error:", err);
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
          console.error("GLTF load error:", err);
          setIsLoadingModel(false);
        }
      );
    }
  }, [assetUrl, format, apiBase]);

  // Drag & Drop Handler
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
        while (rootGroup.children.length > 0) rootGroup.remove(rootGroup.children[0]);
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
        const mat = new THREE.MeshStandardMaterial({ color: 0x8e9297, metalness: 0.5, roughness: 0.35 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.name = file.name;
        finishLoad(mesh);
      } else if (fileName.endsWith(".glb") || fileName.endsWith(".gltf")) {
        const loader = new GLTFLoader();
        loader.parse(
          contents as ArrayBuffer,
          "",
          (gltf) => finishLoad(gltf.scene),
          (err) => {
            console.error("Error parsing GLTF:", err);
            setIsLoadingModel(false);
          }
        );
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Primitive Spawner (Shift+A)
  const spawnPrimitive = (type: "cube" | "sphere" | "cylinder" | "cone" | "torus" | "pyramid" | "plane") => {
    if (!rootModelGroupRef.current) return;
    const rootGroup = rootModelGroupRef.current;

    let geo: THREE.BufferGeometry;
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
    const mat = new THREE.MeshStandardMaterial({ color: 0x8e9297, roughness: 0.35, metalness: 0.25 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${type.toUpperCase()}_${Date.now().toString().slice(-4)}`;
    mesh.position.set(0, initialY, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    while (rootGroup.children.length > 0) rootGroup.remove(rootGroup.children[0]);
    rootGroup.add(mesh);
    currentModelRef.current = mesh;
    setSelectedMesh(mesh);

    updateMeshListAndStats(mesh);
    frameObject(mesh);
    applyShading();
    setActiveOverlay("none");
  };

  // Quick Mesh Transforms
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

  // Material Tweaker
  const handleUpdateMaterial = (color: string, roughness: number, metalness: number) => {
    setMatColor(color);
    setMatRoughness(roughness);
    setMatMetalness(metalness);

    const target = selectedMesh || currentModelRef.current;
    if (!target) return;

    target.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.color.set(color);
        child.material.roughness = roughness;
        child.material.metalness = metalness;
        child.material.needsUpdate = true;
      }
    });
  };

  // Camera Orientation
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

  // Export GLB
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

  // Snapshot PNG
  const handleRenderSnapshot = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${assetName || "kosh_render"}.png`;
    link.click();
  };

  return (
    <div
      className={`relative flex flex-col h-full w-full bg-[#141416] text-[#f4f4f5] overflow-hidden select-none ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Viewport Top Header Toolbar (Dense, Icon-driven CAD strip) */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#27272a] bg-[#18181b] text-xs">
        {/* Left tools: Mode, Shading & Matcaps */}
        <div className="flex items-center space-x-1">
          {/* Shading Icons */}
          <div className="flex items-center bg-[#1f1f23] border border-[#3f3f46] p-0.5 rounded-sm">
            {(["solid", "material", "wireframe", "normals"] as ShadingMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setShadingMode(mode)}
                title={`Shading: ${mode.toUpperCase()}`}
                className={`px-2 py-0.5 text-[11px] uppercase transition-colors rounded-sm ${
                  shadingMode === mode
                    ? "bg-[#3f3f46] text-[#f4f4f5] font-semibold"
                    : "text-[#a1a1aa] hover:text-[#f4f4f5]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Matcap quick selector (when solid) */}
          {shadingMode === "solid" && (
            <div className="hidden sm:flex items-center bg-[#1f1f23] border border-[#3f3f46] p-0.5 rounded-sm text-[10px]">
              {(["studio", "clay", "redwax", "chrome", "obsidian"] as MatcapPreset[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMatcap(m)}
                  className={`px-1.5 py-0.5 capitalize transition-colors rounded-sm ${
                    matcap === m
                      ? "bg-[#3f3f46] text-[#f4f4f5] font-medium"
                      : "text-[#71717a] hover:text-[#a1a1aa]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {/* Material Tweaker button */}
          <button
            onClick={() => setActiveOverlay(activeOverlay === "material" ? "none" : "material")}
            title="Material Tweaker (Color / Roughness / Metallic)"
            className={`tool-btn ${activeOverlay === "material" ? "active" : ""}`}
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center / Right tools: Overlays, Camera, Tools & Export */}
        <div className="flex items-center space-x-1">
          {/* Transform Gizmo Selector */}
          <div className="flex items-center bg-[#1f1f23] border border-[#3f3f46] p-0.5 rounded-sm">
            <button
              onClick={() => setTransformMode("translate")}
              title="Move / Translate (G)"
              className={`p-1 rounded-sm transition-colors ${
                transformMode === "translate" ? "bg-[#3f3f46] text-[#f4f4f5]" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
              }`}
            >
              <Move className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTransformMode("rotate")}
              title="Rotate (R)"
              className={`p-1 rounded-sm transition-colors ${
                transformMode === "rotate" ? "bg-[#3f3f46] text-[#f4f4f5]" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTransformMode("scale")}
              title="Scale (S)"
              className={`p-1 rounded-sm transition-colors ${
                transformMode === "scale" ? "bg-[#3f3f46] text-[#f4f4f5]" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Transform Inspector Drawer */}
          <button
            onClick={() => setActiveOverlay(activeOverlay === "transform" ? "none" : "transform")}
            title="Numeric Transform Inspector"
            className={`tool-btn ${activeOverlay === "transform" ? "active" : ""}`}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Add Primitive */}
          <button
            onClick={() => setActiveOverlay(activeOverlay === "add" ? "none" : "add")}
            title="Add Primitive Geometry (Shift+A)"
            className={`tool-btn ${activeOverlay === "add" ? "active" : ""}`}
          >
            <Plus className="w-3.5 h-3.5" />
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
              onClick={handleRenderSnapshot}
              title="Render Viewport Snapshot (PNG)"
              className="tool-btn"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Export Model / Direct Download */}
          {assetUrl ? (
            <a
              href={`${apiBase}${assetUrl}`}
              download={assetName || `model.${format}`}
              title={`Download Native Blender Asset (${format.toUpperCase()})`}
              className="tool-btn flex items-center space-x-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono">{format.toUpperCase()}</span>
            </a>
          ) : (
            <button
              onClick={handleExportGLB}
              title="Export Scene as GLB"
              className="tool-btn"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

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
        {/* Drag & Drop Visual Target */}
        {isDragOver && (
          <div className="absolute inset-0 z-30 bg-[#18181b]/90 border-2 border-dashed border-[#52525b] flex flex-col items-center justify-center pointer-events-none">
            <UploadCloud className="w-10 h-10 text-[#a1a1aa] mb-2" />
            <span className="text-xs font-semibold text-[#f4f4f5]">DROP 3D ASSET (.GLB / .STL)</span>
          </div>
        )}

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

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title="Toggle Turntable Rotation (Space)"
            className={`p-1 rounded-sm flex items-center justify-center ${
              autoRotate ? "text-[#f4f4f5] bg-[#27272a]" : "text-[#71717a] hover:text-[#a1a1aa]"
            }`}
          >
            <RotateCcw className={`w-3 h-3 ${autoRotate ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Material Tweaker Popover */}
        {activeOverlay === "material" && (
          <div className="absolute top-2 right-2 z-20 w-60 bg-[#1f1f23] border border-[#3f3f46] p-2.5 rounded-sm shadow-lg space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-1">
              <span className="font-semibold text-[#f4f4f5]">Material Properties</span>
              <button onClick={() => setActiveOverlay("none")} className="text-[#a1a1aa] hover:text-[#f4f4f5]">✕</button>
            </div>

            <div>
              <div className="text-[10px] text-[#a1a1aa] mb-1">BASE COLOR</div>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={matColor}
                  onChange={(e) => handleUpdateMaterial(e.target.value, matRoughness, matMetalness)}
                  className="w-7 h-7 border border-[#3f3f46] rounded-sm cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={matColor}
                  onChange={(e) => handleUpdateMaterial(e.target.value, matRoughness, matMetalness)}
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
                step="0.05"
                value={matRoughness}
                onChange={(e) => handleUpdateMaterial(matColor, parseFloat(e.target.value), matMetalness)}
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
                step="0.05"
                value={matMetalness}
                onChange={(e) => handleUpdateMaterial(matColor, matRoughness, parseFloat(e.target.value))}
                className="w-full accent-[#71717a] cursor-pointer"
              />
            </div>

            <div className="pt-1.5 border-t border-[#27272a] flex items-center justify-between">
              <span className="text-[10px] text-[#a1a1aa]">Wireframe Overlay</span>
              <button
                onClick={() => setShowWireOverlay(!showWireOverlay)}
                className={`px-2 py-0.5 text-[10px] font-mono border rounded-sm ${
                  showWireOverlay ? "bg-[#3f3f46] text-[#f4f4f5] border-[#52525b]" : "border-[#3f3f46] text-[#71717a]"
                }`}
              >
                {showWireOverlay ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        )}

        {/* Transform Inspector Popover */}
        {activeOverlay === "transform" && (
          <div className="absolute top-2 right-2 z-20 w-64 bg-[#1f1f23] border border-[#3f3f46] p-2.5 rounded-sm shadow-lg space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-1">
              <span className="font-semibold text-[#f4f4f5]">Numeric Transforms</span>
              <button onClick={() => setActiveOverlay("none")} className="text-[#a1a1aa] hover:text-[#f4f4f5]">✕</button>
            </div>

            <div>
              <div className="text-[10px] text-[#a1a1aa] mb-0.5">POSITION</div>
              <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
                <div className="bg-[#18181b] border border-[#3f3f46] px-1 py-0.5 text-center">X: {liveTransform.pos[0]}</div>
                <div className="bg-[#18181b] border border-[#3f3f46] px-1 py-0.5 text-center">Y: {liveTransform.pos[1]}</div>
                <div className="bg-[#18181b] border border-[#3f3f46] px-1 py-0.5 text-center">Z: {liveTransform.pos[2]}</div>
              </div>
            </div>

            <div>
              <div className="text-[10px] text-[#a1a1aa] mb-0.5">ROTATION</div>
              <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
                <div className="bg-[#18181b] border border-[#3f3f46] px-1 py-0.5 text-center">{liveTransform.rot[0]}°</div>
                <div className="bg-[#18181b] border border-[#3f3f46] px-1 py-0.5 text-center">{liveTransform.rot[1]}°</div>
                <div className="bg-[#18181b] border border-[#3f3f46] px-1 py-0.5 text-center">{liveTransform.rot[2]}°</div>
              </div>
            </div>

            <div>
              <div className="text-[10px] text-[#a1a1aa] mb-0.5">SCALE</div>
              <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
                <div className="bg-[#18181b] border border-[#3f3f46] px-1 py-0.5 text-center">{liveTransform.scale[0]}</div>
                <div className="bg-[#18181b] border border-[#3f3f46] px-1 py-0.5 text-center">{liveTransform.scale[1]}</div>
                <div className="bg-[#18181b] border border-[#3f3f46] px-1 py-0.5 text-center">{liveTransform.scale[2]}</div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#27272a] grid grid-cols-3 gap-1">
              <button
                onClick={snapToFloor}
                className="py-1 bg-[#18181b] border border-[#3f3f46] hover:bg-[#27272a] text-[10px] text-center rounded-sm"
              >
                Snap Z=0
              </button>
              <button
                onClick={centerToOrigin}
                className="py-1 bg-[#18181b] border border-[#3f3f46] hover:bg-[#27272a] text-[10px] text-center rounded-sm"
              >
                Center
              </button>
              <button
                onClick={clearTransforms}
                className="py-1 bg-[#18181b] border border-[#3f3f46] hover:bg-[#27272a] text-[10px] text-center rounded-sm"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Add Primitive Popover */}
        {activeOverlay === "add" && (
          <div className="absolute top-2 right-2 z-20 w-44 bg-[#1f1f23] border border-[#3f3f46] p-1.5 rounded-sm shadow-lg space-y-0.5 text-xs">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-1 px-1">
              <span className="font-semibold text-[11px] text-[#f4f4f5]">Add Primitive</span>
              <button onClick={() => setActiveOverlay("none")} className="text-[#a1a1aa] hover:text-[#f4f4f5]">✕</button>
            </div>
            {(["cube", "sphere", "cylinder", "cone", "torus", "pyramid", "plane"] as const).map((p) => (
              <button
                key={p}
                onClick={() => spawnPrimitive(p)}
                className="w-full text-left px-2 py-1 hover:bg-[#27272a] capitalize text-[11px] text-[#f4f4f5] rounded-sm transition-colors"
              >
                + {p}
              </button>
            ))}
          </div>
        )}
      </div>

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
