"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
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
} from "lucide-react";

export type ShadingMode = "material" | "solid" | "wireframe" | "xray" | "normals";
export type MatcapPreset = "clay" | "obsidian" | "redwax" | "chrome";
export type LightingPreset = "studio" | "phosphor" | "flat" | "sunset";
export type TransformMode = "select" | "translate" | "rotate" | "scale";
export type CameraView = "iso" | "front" | "top" | "right";

interface Viewport3DProps {
  assetUrl?: string | null;
  assetName?: string | null;
  format?: "glb" | "stl";
  apiBase?: string;
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

  // Viewport Settings
  const [shadingMode, setShadingMode] = useState<ShadingMode>("material");
  const [matcap, setMatcap] = useState<MatcapPreset>("obsidian");
  const [transformMode, setTransformMode] = useState<TransformMode>("select");
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>("phosphor");
  const [isOrtho, setIsOrtho] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [showBoundingBox, setShowBoundingBox] = useState<boolean>(false);
  const [lightIntensity, setLightIntensity] = useState<number>(1.2);
  const [smoothShading, setSmoothShading] = useState<boolean>(true);

  // UI Panels
  const [activePanel, setActivePanel] = useState<"none" | "transform" | "lighting" | "outliner" | "add">("none");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);

  // Mesh & Scene Stats
  const [stats, setStats] = useState<{
    triangles: number;
    vertices: number;
    dimensions: string;
    volumeMm3: number;
    surfaceAreaMm2: number;
  } | null>(null);

  const [meshList, setMeshList] = useState<MeshNodeInfo[]>([]);
  const [selectedMeshId, setSelectedMeshId] = useState<string | null>(null);

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
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null);
  const boxHelperRef = useRef<THREE.BoxHelper | null>(null);

  // Lights
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const dirLight1Ref = useRef<THREE.DirectionalLight | null>(null);
  const dirLight2Ref = useRef<THREE.DirectionalLight | null>(null);

  // 1. Initialize Scene, Cameras, Renderer, and Controls
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // A. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x09090b);
    sceneRef.current = scene;

    // B. Cameras
    const aspect = width / height;
    const perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    perspCamera.position.set(4, 3, 5);
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
    orthoCamera.position.set(4, 3, 5);
    orthoCameraRef.current = orthoCamera;

    // C. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // D. Orbit Controls
    const orbit = new OrbitControls(perspCamera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.05;
    orbit.autoRotate = autoRotate;
    orbit.autoRotateSpeed = 1.5;
    orbitControlsRef.current = orbit;

    // E. Transform Controls (Blender G / R / S Gizmo)
    const transform = new TransformControls(perspCamera, renderer.domElement);
    transform.size = 0.85;
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

    // F. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight1.position.set(6, 12, 8);
    dirLight1.castShadow = true;
    scene.add(dirLight1);
    dirLight1Ref.current = dirLight1;

    const dirLight2 = new THREE.DirectionalLight(0x22c55e, 1.0); // Phosphor accent
    dirLight2.position.set(-6, -3, -6);
    scene.add(dirLight2);
    dirLight2Ref.current = dirLight2;

    // G. Blender Overlays: Floor Grid & Axes
    const grid = new THREE.GridHelper(16, 32, 0x22c55e, 0x27272a);
    grid.position.y = 0;
    scene.add(grid);
    gridHelperRef.current = grid;

    const axes = new THREE.AxesHelper(3.5);
    (axes.material as THREE.Material).depthTest = false;
    axes.renderOrder = 1;
    scene.add(axes);
    axesHelperRef.current = axes;

    // Root Group for Models
    const rootGroup = new THREE.Group();
    rootGroup.name = "RootModelGroup";
    scene.add(rootGroup);
    rootModelGroupRef.current = rootGroup;

    // Initial placeholder mesh
    const placeholderGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const placeholderMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.25,
      metalness: 0.85,
    });
    const placeholder = new THREE.Mesh(placeholderGeo, placeholderMat);
    placeholder.position.y = 0.8;
    placeholder.name = "Kosh_Default_Cube";

    // Add wireframe cage
    const wireGeo = new THREE.WireframeGeometry(placeholderGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x22c55e, linewidth: 1 });
    const wireSegments = new THREE.LineSegments(wireGeo, wireMat);
    placeholder.add(wireSegments);

    rootGroup.add(placeholder);
    currentModelRef.current = placeholder;
    transform.attach(placeholder);

    // Bounding Box Helper
    const boxHelper = new THREE.BoxHelper(placeholder, 0x4ade80);
    boxHelper.visible = false;
    scene.add(boxHelper);
    boxHelperRef.current = boxHelper;

    // H. Animation Loop
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

    // I. Window Resize
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

  // Update OrbitControls camera target when projection toggles
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
  }, [showGrid, showAxes, showBoundingBox]);

  // Update Transform Mode (G / R / S)
  useEffect(() => {
    if (!transformControlsRef.current) return;
    const tc = transformControlsRef.current;
    if (transformMode === "select") {
      tc.enabled = false;
      tc.detach();
    } else {
      tc.enabled = true;
      tc.setMode(transformMode);
      const target = currentModelRef.current;
      if (target) {
        tc.attach(target);
      }
    }
  }, [transformMode]);

  // Update Lighting Presets
  useEffect(() => {
    if (!ambientLightRef.current || !dirLight1Ref.current || !dirLight2Ref.current) return;
    const amb = ambientLightRef.current;
    const d1 = dirLight1Ref.current;
    const d2 = dirLight2Ref.current;

    switch (lightingPreset) {
      case "studio":
        amb.color.setHex(0xffffff);
        amb.intensity = 0.9 * lightIntensity;
        d1.color.setHex(0xffffff);
        d1.intensity = 1.8 * lightIntensity;
        d2.color.setHex(0xe0e7ff);
        d2.intensity = 0.6 * lightIntensity;
        break;
      case "phosphor":
        amb.color.setHex(0xffffff);
        amb.intensity = 0.6 * lightIntensity;
        d1.color.setHex(0xffffff);
        d1.intensity = 1.5 * lightIntensity;
        d2.color.setHex(0x22c55e); // Kosh phosphor green rim
        d2.intensity = 1.4 * lightIntensity;
        break;
      case "flat":
        amb.color.setHex(0xffffff);
        amb.intensity = 2.0 * lightIntensity;
        d1.intensity = 0.2;
        d2.intensity = 0.2;
        break;
      case "sunset":
        amb.color.setHex(0x4a1d96);
        amb.intensity = 0.5 * lightIntensity;
        d1.color.setHex(0xf97316);
        d1.intensity = 2.0 * lightIntensity;
        d2.color.setHex(0x38bdf8);
        d2.intensity = 1.0 * lightIntensity;
        break;
    }
  }, [lightingPreset, lightIntensity]);

  // Apply Shading Modes (Solid, Material, Wireframe, X-Ray, Normals)
  const applyShading = useCallback(() => {
    if (!currentModelRef.current) return;

    currentModelRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Save original material for Material Preview restoration
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material;
        }

        switch (shadingMode) {
          case "wireframe":
            child.material = new THREE.MeshBasicMaterial({
              color: 0x22c55e,
              wireframe: true,
            });
            break;

          case "xray":
            child.material = new THREE.MeshStandardMaterial({
              color: 0x06b6d4,
              transparent: true,
              opacity: 0.45,
              roughness: 0.1,
              metalness: 0.9,
              depthWrite: false,
            });
            break;

          case "normals":
            child.material = new THREE.MeshNormalMaterial();
            break;

          case "solid":
            let solidColor = 0x27272a;
            let roughness = 0.3;
            let metalness = 0.5;

            if (matcap === "clay") {
              solidColor = 0xb45309; // Terracotta clay
              roughness = 0.9;
              metalness = 0.05;
            } else if (matcap === "redwax") {
              solidColor = 0xbe123c; // Red sculpting wax
              roughness = 0.4;
              metalness = 0.2;
            } else if (matcap === "chrome") {
              solidColor = 0xe4e4e7;
              roughness = 0.05;
              metalness = 0.98;
            } else {
              // obsidian
              solidColor = 0x18181b;
              roughness = 0.2;
              metalness = 0.9;
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
            // Restore original loaded materials
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

        // Apply smooth / flat normal shading
        if (child.geometry) {
          if (smoothShading) {
            child.geometry.computeVertexNormals();
          } else {
            child.geometry.computeVertexNormals();
          }
        }
      }
    });
  }, [shadingMode, matcap, smoothShading]);

  useEffect(() => {
    applyShading();
  }, [applyShading]);

  // Load 3D Asset
  useEffect(() => {
    if (!assetUrl || !sceneRef.current || !rootModelGroupRef.current) return;

    const fullUrl = assetUrl.startsWith("http") ? assetUrl : `${apiBase}${assetUrl}`;
    const rootGroup = rootModelGroupRef.current;
    setIsLoadingModel(true);

    const onModelLoaded = (object: THREE.Object3D) => {
      // Clear previous model from rootGroup
      while (rootGroup.children.length > 0) {
        rootGroup.remove(rootGroup.children[0]);
      }

      rootGroup.add(object);
      currentModelRef.current = object;

      // Extract mesh list for outliner
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

      // Compute bounding box and dimensions
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Approximate volume and surface area in mm3 / mm2 (assuming 1 unit = 10mm)
      const volume = size.x * size.y * size.z * 1000;
      const surface = 2 * (size.x * size.y + size.y * size.z + size.z * size.x) * 100;

      setStats({
        triangles: totalTris,
        vertices: totalVerts,
        dimensions: `${(size.x * 10).toFixed(1)} × ${(size.y * 10).toFixed(1)} × ${(size.z * 10).toFixed(1)} mm`,
        volumeMm3: Math.round(volume),
        surfaceAreaMm2: Math.round(surface),
      });

      // Fit Camera to View
      frameObject(object);

      // Attach TransformControls to root model
      if (transformControlsRef.current) {
        transformControlsRef.current.attach(object);
      }

      // Update Bounding Box helper
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
          const mat = new THREE.MeshStandardMaterial({
            color: 0x22c55e,
            metalness: 0.85,
            roughness: 0.25,
          });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.name = assetName || "CAD_STL_Model";
          onModelLoaded(mesh);
        },
        undefined,
        (err) => {
          console.error("Failed to load STL:", err);
          setIsLoadingModel(false);
        }
      );
    } else {
      const loader = new GLTFLoader();
      loader.load(
        fullUrl,
        (gltf) => {
          onModelLoaded(gltf.scene);
        },
        undefined,
        (err) => {
          console.error("Failed to load GLTF:", err);
          setIsLoadingModel(false);
        }
      );
    }
  }, [assetUrl, format, apiBase, applyShading]);

  // Frame / Focus on object
  const frameObject = (object: THREE.Object3D) => {
    const camera = cameraRef.current;
    const controls = orbitControlsRef.current;
    if (!camera || !controls) return;

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8;
    cameraZ = Math.max(cameraZ, 3);

    camera.position.set(center.x + cameraZ * 0.8, center.y + cameraZ * 0.6, center.z + cameraZ * 0.8);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
  };

  // Blender Camera Views (Numpad 1, 3, 7, Iso)
  const setCameraView = (view: CameraView) => {
    const camera = cameraRef.current;
    const controls = orbitControlsRef.current;
    const target = currentModelRef.current;
    if (!camera || !controls) return;

    const center = new THREE.Vector3(0, 0, 0);
    let dist = 6;

    if (target) {
      const box = new THREE.Box3().setFromObject(target);
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);
      dist = Math.max(size.x, size.y, size.z) * 2.5;
    }

    switch (view) {
      case "front": // Numpad 1
        camera.position.set(center.x, center.y, center.z + dist);
        break;
      case "right": // Numpad 3
        camera.position.set(center.x + dist, center.y, center.z);
        break;
      case "top": // Numpad 7
        camera.position.set(center.x, center.y + dist, center.z + 0.001);
        break;
      case "iso":
      default:
        camera.position.set(center.x + dist * 0.7, center.y + dist * 0.5, center.z + dist * 0.7);
        break;
    }

    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
  };

  // Keyboard Shortcuts (Blender Standard G, R, S, 1, 3, 7, 5, ., Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;

      switch (e.key.toLowerCase()) {
        case "g":
          setTransformMode("translate");
          break;
        case "r":
          setTransformMode("rotate");
          break;
        case "s":
          setTransformMode("scale");
          break;
        case "escape":
          setTransformMode("select");
          break;
        case "1":
          setCameraView("front");
          break;
        case "3":
          setCameraView("right");
          break;
        case "7":
          setCameraView("top");
          break;
        case "5":
          setIsOrtho((prev) => !prev);
          break;
        case ".":
          if (currentModelRef.current) frameObject(currentModelRef.current);
          break;
        case " ":
          e.preventDefault();
          setAutoRotate((prev) => !prev);
          break;
        case "z":
          // Cycle shading modes
          setShadingMode((prev) => {
            if (prev === "material") return "solid";
            if (prev === "solid") return "wireframe";
            if (prev === "wireframe") return "xray";
            return "material";
          });
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Mesh Operations (Blender actions)
  const handleCenterOrigin = () => {
    if (!currentModelRef.current) return;
    const box = new THREE.Box3().setFromObject(currentModelRef.current);
    const center = new THREE.Vector3();
    box.getCenter(center);
    currentModelRef.current.position.sub(center);
  };

  const handleSnapToFloor = () => {
    if (!currentModelRef.current) return;
    const box = new THREE.Box3().setFromObject(currentModelRef.current);
    currentModelRef.current.position.y -= box.min.y;
  };

  const handleResetTransforms = () => {
    if (!currentModelRef.current) return;
    currentModelRef.current.position.set(0, 0, 0);
    currentModelRef.current.rotation.set(0, 0, 0);
    currentModelRef.current.scale.set(1, 1, 1);
    setLiveTransform({ pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] });
  };

  // Add Geometric Primitives (Blender Shift+A)
  const handleAddPrimitive = (type: "cube" | "cylinder" | "sphere" | "torus" | "cone") => {
    if (!rootModelGroupRef.current) return;
    let geom: THREE.BufferGeometry;

    switch (type) {
      case "cylinder":
        geom = new THREE.CylinderGeometry(0.8, 0.8, 2, 24);
        break;
      case "sphere":
        geom = new THREE.SphereGeometry(1, 32, 24);
        break;
      case "torus":
        geom = new THREE.TorusGeometry(1, 0.35, 16, 48);
        break;
      case "cone":
        geom = new THREE.ConeGeometry(1, 2, 24);
        break;
      case "cube":
      default:
        geom = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        break;
    }

    const mat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.3,
      metalness: 0.8,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = `Primitive_${type}_${Date.now().toString().slice(-4)}`;
    mesh.position.set(0, 1, 0);

    // Replace scene or append
    while (rootModelGroupRef.current.children.length > 0) {
      rootModelGroupRef.current.remove(rootModelGroupRef.current.children[0]);
    }
    rootModelGroupRef.current.add(mesh);
    currentModelRef.current = mesh;

    if (transformControlsRef.current) {
      transformControlsRef.current.attach(mesh);
    }

    applyShading();
    setActivePanel("none");
  };

  // High-Res Viewport Snapshot Capture
  const handleTakeSnapshot = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `kosh_viewport_${assetName || "render"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download Asset
  const handleDownloadAsset = () => {
    if (!assetUrl) return;
    const fullUrl = assetUrl.startsWith("http") ? assetUrl : `${apiBase}${assetUrl}`;
    const a = document.createElement("a");
    a.href = fullUrl;
    a.download = assetName || `kosh_model.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className={`relative w-full h-full bg-[#09090b] flex flex-col select-none overflow-hidden font-mono ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
    >
      {/* 1. BLENDER WORKSPACE TOP TOOLBAR */}
      <div className="absolute top-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between p-2 bg-[#09090b]/90 border-b border-[#27272a] backdrop-blur-sm text-xs">
        {/* Left: Model Name & Format */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-[#121215] border border-[#27272a]">
            <Box className="w-3.5 h-3.5 text-[#22c55e]" />
            <span className="font-semibold text-[#f4f4f5] max-w-[140px] truncate">
              {assetName || "Blender_Viewport"}
            </span>
            <span className="text-[10px] text-[#71717a] uppercase">({format})</span>
          </div>

          {/* Shading Mode Selector (Blender Z Menu) */}
          <div className="flex items-center bg-[#121215] border border-[#27272a] p-0.5">
            <button
              onClick={() => setShadingMode("material")}
              title="Material Preview (PBR)"
              className={`px-2 py-0.5 text-[10px] ${
                shadingMode === "material"
                  ? "bg-[#27272a] text-[#22c55e] font-bold"
                  : "text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              MATERIAL
            </button>
            <button
              onClick={() => setShadingMode("solid")}
              title="Solid Shading / Matcap"
              className={`px-2 py-0.5 text-[10px] ${
                shadingMode === "solid"
                  ? "bg-[#27272a] text-[#22c55e] font-bold"
                  : "text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              SOLID
            </button>
            <button
              onClick={() => setShadingMode("wireframe")}
              title="Wireframe View"
              className={`px-2 py-0.5 text-[10px] ${
                shadingMode === "wireframe"
                  ? "bg-[#27272a] text-[#22c55e] font-bold"
                  : "text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              WIREFRAME
            </button>
            <button
              onClick={() => setShadingMode("xray")}
              title="X-Ray Ghost Mode"
              className={`px-2 py-0.5 text-[10px] ${
                shadingMode === "xray"
                  ? "bg-[#27272a] text-[#06b6d4] font-bold"
                  : "text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              X-RAY
            </button>
            <button
              onClick={() => setShadingMode("normals")}
              title="Inspect Surface Normals"
              className={`px-2 py-0.5 text-[10px] ${
                shadingMode === "normals"
                  ? "bg-[#27272a] text-[#f59e0b] font-bold"
                  : "text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              NORMALS
            </button>
          </div>
        </div>

        {/* Right: Transform Gizmos (G / R / S) & Action Drawers */}
        <div className="flex items-center space-x-1">
          {/* Gizmo Tools */}
          <div className="flex items-center bg-[#121215] border border-[#27272a] p-0.5">
            <button
              onClick={() => setTransformMode("select")}
              title="Orbit / Select Mode (Esc)"
              className={`p-1 border ${
                transformMode === "select"
                  ? "bg-[#27272a] border-[#22c55e] text-[#22c55e]"
                  : "border-transparent text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTransformMode("translate")}
              title="Move / Grab Gizmo (G)"
              className={`p-1 border ${
                transformMode === "translate"
                  ? "bg-[#27272a] border-[#22c55e] text-[#22c55e]"
                  : "border-transparent text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              <Move className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTransformMode("rotate")}
              title="Rotate Gizmo (R)"
              className={`p-1 border ${
                transformMode === "rotate"
                  ? "bg-[#27272a] border-[#22c55e] text-[#22c55e]"
                  : "border-transparent text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTransformMode("scale")}
              title="Scale Gizmo (S)"
              className={`p-1 border ${
                transformMode === "scale"
                  ? "bg-[#27272a] border-[#22c55e] text-[#22c55e]"
                  : "border-transparent text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Drawer toggles */}
          <button
            onClick={() => setActivePanel(activePanel === "transform" ? "none" : "transform")}
            title="Transform Coordinates Inspector (N)"
            className={`px-2 py-1 text-[11px] border ${
              activePanel === "transform"
                ? "bg-[#22c55e] text-[#09090b] font-bold border-[#22c55e]"
                : "bg-[#121215] border-[#27272a] text-[#71717a] hover:text-[#f4f4f5]"
            }`}
          >
            TRANSFORM
          </button>

          <button
            onClick={() => setActivePanel(activePanel === "outliner" ? "none" : "outliner")}
            title="Scene Outliner / Meshes Hierarchy"
            className={`px-2 py-1 text-[11px] border ${
              activePanel === "outliner"
                ? "bg-[#22c55e] text-[#09090b] font-bold border-[#22c55e]"
                : "bg-[#121215] border-[#27272a] text-[#71717a] hover:text-[#f4f4f5]"
            }`}
          >
            OUTLINER
          </button>

          <button
            onClick={() => setActivePanel(activePanel === "add" ? "none" : "add")}
            title="Add Mesh Primitive (Shift+A)"
            className={`p-1 border ${
              activePanel === "add"
                ? "bg-[#22c55e] text-[#09090b] border-[#22c55e]"
                : "bg-[#121215] border-[#27272a] text-[#71717a] hover:text-[#f4f4f5]"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActivePanel(activePanel === "lighting" ? "none" : "lighting")}
            title="Lighting & Environment Settings"
            className={`p-1 border ${
              activePanel === "lighting"
                ? "bg-[#22c55e] text-[#09090b] border-[#22c55e]"
                : "bg-[#121215] border-[#27272a] text-[#71717a] hover:text-[#f4f4f5]"
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. LEFT FLOATING BLENDER VIEWPORT TOOLS */}
      <div className="absolute left-3 top-16 z-20 flex flex-col space-y-1 bg-[#09090b]/80 border border-[#27272a] p-1 text-xs">
        {/* Camera Views */}
        <button
          onClick={() => setCameraView("front")}
          title="Front View (Numpad 1)"
          className="px-2 py-1 text-[10px] text-[#71717a] hover:text-[#22c55e] hover:bg-[#121215] text-left"
        >
          FRONT
        </button>
        <button
          onClick={() => setCameraView("right")}
          title="Right Side View (Numpad 3)"
          className="px-2 py-1 text-[10px] text-[#71717a] hover:text-[#22c55e] hover:bg-[#121215] text-left"
        >
          RIGHT
        </button>
        <button
          onClick={() => setCameraView("top")}
          title="Top View (Numpad 7)"
          className="px-2 py-1 text-[10px] text-[#71717a] hover:text-[#22c55e] hover:bg-[#121215] text-left"
        >
          TOP
        </button>
        <button
          onClick={() => setCameraView("iso")}
          title="Isometric View"
          className="px-2 py-1 text-[10px] text-[#71717a] hover:text-[#22c55e] hover:bg-[#121215] text-left"
        >
          ISO
        </button>

        <div className="h-[1px] bg-[#27272a] my-1" />

        {/* Ortho / Persp Toggle */}
        <button
          onClick={() => setIsOrtho(!isOrtho)}
          title="Toggle Perspective / Orthographic (Numpad 5)"
          className={`px-2 py-1 text-[10px] font-bold ${
            isOrtho ? "text-[#22c55e]" : "text-[#71717a] hover:text-[#f4f4f5]"
          }`}
        >
          {isOrtho ? "ORTHO" : "PERSP"}
        </button>

        {/* Frame / Focus */}
        <button
          onClick={() => currentModelRef.current && frameObject(currentModelRef.current)}
          title="Frame Selected (Numpad .)"
          className="p-1 text-[#71717a] hover:text-[#22c55e] hover:bg-[#121215] flex justify-center"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>

        <div className="h-[1px] bg-[#27272a] my-1" />

        {/* Overlays */}
        <button
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle Floor Grid"
          className={`p-1 flex justify-center ${
            showGrid ? "text-[#22c55e]" : "text-[#71717a] hover:text-[#f4f4f5]"
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setShowBoundingBox(!showBoundingBox)}
          title="Toggle Bounding Box Cage"
          className={`p-1 flex justify-center ${
            showBoundingBox ? "text-[#22c55e]" : "text-[#71717a] hover:text-[#f4f4f5]"
          }`}
        >
          <Box className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setAutoRotate(!autoRotate)}
          title="Toggle Auto Turntable (Space)"
          className={`p-1 flex justify-center ${
            autoRotate ? "text-[#22c55e]" : "text-[#71717a] hover:text-[#f4f4f5]"
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. RIGHT FLOATING ACTION DRAWER */}
      {activePanel !== "none" && (
        <div className="absolute right-3 top-16 z-20 w-64 bg-[#09090b]/95 border border-[#27272a] p-3 text-xs shadow-2xl backdrop-blur-md">
          {/* Panel Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#27272a]">
            <span className="font-bold text-[#f4f4f5] tracking-wider uppercase text-[11px]">
              {activePanel} PANEL
            </span>
            <button
              onClick={() => setActivePanel("none")}
              className="text-[#71717a] hover:text-[#f4f4f5]"
            >
              ✕
            </button>
          </div>

          {/* TRANSFORM INSPECTOR PANEL */}
          {activePanel === "transform" && (
            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-[#71717a] font-bold block mb-1">
                  LOCATION (X, Y, Z)
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <div className="bg-[#121215] border border-[#27272a] px-1.5 py-0.5 text-center">
                    <span className="text-[#ef4444] text-[10px] mr-1">X:</span>
                    <span>{liveTransform.pos[0]}</span>
                  </div>
                  <div className="bg-[#121215] border border-[#27272a] px-1.5 py-0.5 text-center">
                    <span className="text-[#22c55e] text-[10px] mr-1">Y:</span>
                    <span>{liveTransform.pos[1]}</span>
                  </div>
                  <div className="bg-[#121215] border border-[#27272a] px-1.5 py-0.5 text-center">
                    <span className="text-[#3b82f6] text-[10px] mr-1">Z:</span>
                    <span>{liveTransform.pos[2]}</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-[#71717a] font-bold block mb-1">
                  ROTATION (DEG)
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <div className="bg-[#121215] border border-[#27272a] px-1.5 py-0.5 text-center">
                    <span className="text-[#ef4444] text-[10px] mr-1">X:</span>
                    <span>{liveTransform.rot[0]}°</span>
                  </div>
                  <div className="bg-[#121215] border border-[#27272a] px-1.5 py-0.5 text-center">
                    <span className="text-[#22c55e] text-[10px] mr-1">Y:</span>
                    <span>{liveTransform.rot[1]}°</span>
                  </div>
                  <div className="bg-[#121215] border border-[#27272a] px-1.5 py-0.5 text-center">
                    <span className="text-[#3b82f6] text-[10px] mr-1">Z:</span>
                    <span>{liveTransform.rot[2]}°</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-[#71717a] font-bold block mb-1">SCALE</span>
                <div className="grid grid-cols-3 gap-1">
                  <div className="bg-[#121215] border border-[#27272a] px-1.5 py-0.5 text-center">
                    <span>{liveTransform.scale[0]}</span>
                  </div>
                  <div className="bg-[#121215] border border-[#27272a] px-1.5 py-0.5 text-center">
                    <span>{liveTransform.scale[1]}</span>
                  </div>
                  <div className="bg-[#121215] border border-[#27272a] px-1.5 py-0.5 text-center">
                    <span>{liveTransform.scale[2]}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#27272a] space-y-1.5">
                <button
                  onClick={handleCenterOrigin}
                  className="w-full py-1 bg-[#121215] border border-[#27272a] hover:border-[#22c55e] text-[#a1a1aa] hover:text-[#f4f4f5] text-[11px]"
                >
                  Origin to Geometry Center
                </button>
                <button
                  onClick={handleSnapToFloor}
                  className="w-full py-1 bg-[#121215] border border-[#27272a] hover:border-[#22c55e] text-[#a1a1aa] hover:text-[#f4f4f5] text-[11px]"
                >
                  Snap Geometry to Floor (Y=0)
                </button>
                <button
                  onClick={handleResetTransforms}
                  className="w-full py-1 bg-[#18181b] border border-[#27272a] hover:border-[#ef4444] text-[#ef4444] text-[11px]"
                >
                  Clear Transforms (Alt+G/R/S)
                </button>
              </div>
            </div>
          )}

          {/* LIGHTING & SHADING PANEL */}
          {activePanel === "lighting" && (
            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-[#71717a] font-bold block mb-1">
                  STUDIO LIGHT PRESET
                </span>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  {(["phosphor", "studio", "flat", "sunset"] as LightingPreset[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setLightingPreset(p)}
                      className={`py-1 border uppercase ${
                        lightingPreset === p
                          ? "bg-[#27272a] border-[#22c55e] text-[#22c55e] font-bold"
                          : "border-[#27272a] text-[#71717a] hover:text-[#f4f4f5]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-[#71717a] mb-1">
                  <span>EXPOSURE INTENSITY</span>
                  <span>{lightIntensity.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="3.0"
                  step="0.1"
                  value={lightIntensity}
                  onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
                  className="w-full accent-[#22c55e] cursor-pointer"
                />
              </div>

              <div>
                <span className="text-[10px] text-[#71717a] font-bold block mb-1">
                  MATCAP COLOR PALETTE
                </span>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  {(["obsidian", "clay", "redwax", "chrome"] as MatcapPreset[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMatcap(m);
                        setShadingMode("solid");
                      }}
                      className={`py-1 border uppercase ${
                        matcap === m && shadingMode === "solid"
                          ? "bg-[#27272a] border-[#22c55e] text-[#22c55e] font-bold"
                          : "border-[#27272a] text-[#71717a] hover:text-[#f4f4f5]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-[#27272a]">
                <button
                  onClick={() => setSmoothShading(!smoothShading)}
                  className={`w-full py-1 text-[11px] border ${
                    smoothShading
                      ? "bg-[#27272a] border-[#22c55e] text-[#22c55e]"
                      : "border-[#27272a] text-[#71717a]"
                  }`}
                >
                  {smoothShading ? "Shade Smooth [Active]" : "Shade Flat [Active]"}
                </button>
              </div>
            </div>
          )}

          {/* SCENE OUTLINER PANEL */}
          {activePanel === "outliner" && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <span className="text-[10px] text-[#71717a] font-bold block">
                MESHES IN SCENE ({meshList.length})
              </span>
              {meshList.length === 0 ? (
                <div className="text-[#3f3f46] italic text-[11px]">No child meshes detected.</div>
              ) : (
                meshList.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedMeshId(m.id);
                      if (transformControlsRef.current) {
                        transformControlsRef.current.attach(m.meshRef);
                      }
                    }}
                    className={`flex items-center justify-between p-1.5 border cursor-pointer transition-colors ${
                      selectedMeshId === m.id
                        ? "bg-[#18181b] border-[#22c55e] text-[#22c55e]"
                        : "bg-[#121215] border-[#27272a] text-[#a1a1aa] hover:border-[#3f3f46]"
                    }`}
                  >
                    <div className="truncate max-w-[130px]">
                      <span className="font-semibold">{m.name}</span>
                      <div className="text-[9px] text-[#71717a]">{m.triangles.toLocaleString()} tris</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        m.meshRef.visible = !m.meshRef.visible;
                        setMeshList([...meshList]);
                      }}
                      className="p-1 text-[#71717a] hover:text-[#f4f4f5]"
                    >
                      {m.meshRef.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ADD MESH PRIMITIVES (Shift+A) */}
          {activePanel === "add" && (
            <div className="space-y-1.5 text-[11px]">
              <span className="text-[10px] text-[#71717a] font-bold block mb-1">
                SPAWN PRIMITIVE MESH
              </span>
              <button
                onClick={() => handleAddPrimitive("cube")}
                className="w-full py-1.5 px-2 bg-[#121215] border border-[#27272a] hover:border-[#22c55e] text-left hover:text-[#22c55e]"
              >
                + Cube (1.5 × 1.5 × 1.5)
              </button>
              <button
                onClick={() => handleAddPrimitive("cylinder")}
                className="w-full py-1.5 px-2 bg-[#121215] border border-[#27272a] hover:border-[#22c55e] text-left hover:text-[#22c55e]"
              >
                + Cylinder (Radius: 0.8, Depth: 2)
              </button>
              <button
                onClick={() => handleAddPrimitive("sphere")}
                className="w-full py-1.5 px-2 bg-[#121215] border border-[#27272a] hover:border-[#22c55e] text-left hover:text-[#22c55e]"
              >
                + UV Sphere (Radius: 1)
              </button>
              <button
                onClick={() => handleAddPrimitive("torus")}
                className="w-full py-1.5 px-2 bg-[#121215] border border-[#27272a] hover:border-[#22c55e] text-left hover:text-[#22c55e]"
              >
                + Torus (Major: 1, Tube: 0.35)
              </button>
              <button
                onClick={() => handleAddPrimitive("cone")}
                className="w-full py-1.5 px-2 bg-[#121215] border border-[#27272a] hover:border-[#22c55e] text-left hover:text-[#22c55e]"
              >
                + Cone (Radius: 1, Depth: 2)
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. LOADING INDICATOR */}
      {isLoadingModel && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#09090b]/80 backdrop-blur-sm pointer-events-none">
          <div className="w-8 h-8 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs text-[#22c55e] font-mono tracking-wider">
            STREAMING 3D MESH GEOMETRY...
          </span>
        </div>
      )}

      {/* 5. THREE.JS CANVAS CONTAINER */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing outline-none"
        tabIndex={0}
      />

      {/* 6. BOTTOM STATUS BAR & SHORTCUTS HELP */}
      <div className="absolute bottom-2 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none text-[10px] text-[#71717a]">
        {/* Model Metrics */}
        <div className="pointer-events-auto flex items-center space-x-3 bg-[#09090b]/90 border border-[#27272a] px-2.5 py-1 backdrop-blur-sm">
          {stats ? (
            <>
              <div>
                TRIS: <span className="text-[#f4f4f5] font-semibold">{stats.triangles.toLocaleString()}</span>
              </div>
              <div>
                VERTS: <span className="text-[#f4f4f5] font-semibold">{stats.vertices.toLocaleString()}</span>
              </div>
              <div>
                BOUNDS: <span className="text-[#22c55e]">{stats.dimensions}</span>
              </div>
              <div className="hidden sm:inline-block">
                VOL: <span className="text-[#f4f4f5]">{stats.volumeMm3.toLocaleString()} mm³</span>
              </div>
            </>
          ) : (
            <div>
              SHORTCUTS: <span className="text-[#f4f4f5]">G</span> Move |{" "}
              <span className="text-[#f4f4f5]">R</span> Rotate |{" "}
              <span className="text-[#f4f4f5]">S</span> Scale |{" "}
              <span className="text-[#f4f4f5]">Z</span> Shading |{" "}
              <span className="text-[#f4f4f5]">1/3/7</span> Views
            </div>
          )}
        </div>

        {/* Viewport Action Buttons */}
        <div className="pointer-events-auto flex items-center space-x-1.5 bg-[#09090b]/90 border border-[#27272a] p-1 backdrop-blur-sm">
          {/* Snapshot Button */}
          <button
            onClick={handleTakeSnapshot}
            title="Render & Save High-Res PNG Snapshot"
            className="flex items-center space-x-1 px-2 py-0.5 border border-[#27272a] text-[#71717a] hover:text-[#f4f4f5] hover:border-[#3f3f46]"
          >
            <Camera className="w-3 h-3 text-[#22c55e]" />
            <span>RENDER PNG</span>
          </button>

          {/* Download Model Button */}
          {assetUrl && (
            <button
              onClick={handleDownloadAsset}
              title={`Download 3D Asset (${format.toUpperCase()})`}
              className="flex items-center space-x-1 px-2.5 py-0.5 bg-[#22c55e] text-[#09090b] font-bold hover:bg-[#4ade80] transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>EXPORT {format.toUpperCase()}</span>
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Toggle Viewport Fullscreen"
            className="p-1 border border-[#27272a] text-[#71717a] hover:text-[#f4f4f5] hover:border-[#3f3f46]"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
