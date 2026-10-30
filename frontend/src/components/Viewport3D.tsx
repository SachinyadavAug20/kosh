"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import {
  Download,
  RotateCw,
  Eye,
  Grid,
  Maximize2,
  Box,
  Layers,
  Sparkles,
} from "lucide-react";

interface Viewport3DProps {
  assetUrl?: string | null;
  assetName?: string | null;
  format?: "glb" | "stl";
  apiBase?: string;
}

export function Viewport3D({
  assetUrl,
  assetName,
  format = "glb",
  apiBase = "http://localhost:8080",
}: Viewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [stats, setStats] = useState<{ triangles: number; vertices: number; dimensions: string } | null>(null);

  // Scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const currentModelRef = useRef<THREE.Object3D | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x09090b);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(4, 3, 5);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.5;
    controlsRef.current = controls;

    // 5. Lights (Terminal Brutalist Lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight1.position.set(5, 10, 7);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x22c55e, 0.9); // phosphor rim light
    dirLight2.position.set(-5, -2, -5);
    scene.add(dirLight2);

    // 6. Ground Grid Helper
    const grid = new THREE.GridHelper(10, 20, 0x22c55e, 0x27272a);
    grid.position.y = 0;
    scene.add(grid);
    gridHelperRef.current = grid;

    // 7. Initial placeholder geometry
    const demoGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const demoMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      wireframe: false,
      roughness: 0.2,
      metalness: 0.8,
    });
    const placeholder = new THREE.Mesh(demoGeo, demoMat);
    placeholder.position.y = 0.75;
    placeholder.name = "placeholder";

    // Add wireframe cage overlay
    const wireGeo = new THREE.WireframeGeometry(demoGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x22c55e, linewidth: 1 });
    const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
    placeholder.add(wireMesh);

    scene.add(placeholder);
    currentModelRef.current = placeholder;

    // 8. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Listener
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update controls auto-rotation
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Update grid visibility
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Update wireframe property on current model
  useEffect(() => {
    if (!currentModelRef.current) return;
    currentModelRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => (m.wireframe = wireframe));
        } else if (child.material) {
          child.material.wireframe = wireframe;
        }
      }
    });
  }, [wireframe]);

  // Load new asset when assetUrl changes
  useEffect(() => {
    if (!assetUrl || !sceneRef.current || !cameraRef.current || !controlsRef.current) return;

    const fullUrl = assetUrl.startsWith("http") ? assetUrl : `${apiBase}${assetUrl}`;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    setIsLoadingModel(true);

    const onModelLoaded = (object: THREE.Object3D) => {
      // Remove old model
      if (currentModelRef.current) {
        scene.remove(currentModelRef.current);
      }

      currentModelRef.current = object;
      scene.add(object);

      // Compute statistics and bounding box
      let triangles = 0;
      let vertices = 0;
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const geom = child.geometry;
          if (geom.index) {
            triangles += geom.index.count / 3;
          } else if (geom.attributes.position) {
            triangles += geom.attributes.position.count / 3;
          }
          if (geom.attributes.position) {
            vertices += geom.attributes.position.count;
          }
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => (m.wireframe = wireframe));
          } else if (child.material) {
            child.material.wireframe = wireframe;
          }
        }
      });

      setStats({
        triangles: Math.round(triangles),
        vertices: Math.round(vertices),
        dimensions: `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`,
      });

      // Fit camera to object bounds
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8;
      cameraZ = Math.max(cameraZ, 2.5);

      camera.position.set(center.x + cameraZ * 0.8, center.y + cameraZ * 0.6, center.z + cameraZ * 0.8);
      camera.lookAt(center);
      controls.target.copy(center);
      controls.update();

      setIsLoadingModel(false);
    };

    if (assetUrl.toLowerCase().endsWith(".stl") || format === "stl") {
      const loader = new STLLoader();
      loader.load(
        fullUrl,
        (geometry) => {
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: 0x22c55e,
            metalness: 0.8,
            roughness: 0.3,
            wireframe,
          });
          const mesh = new THREE.Mesh(geometry, material);
          onModelLoaded(mesh);
        },
        undefined,
        (err) => {
          console.error("Failed to load STL:", err);
          setIsLoadingModel(false);
        }
      );
    } else {
      // Default to GLTF / GLB
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
  }, [assetUrl, format, apiBase]);

  const handleResetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    if (currentModelRef.current) {
      const box = new THREE.Box3().setFromObject(currentModelRef.current);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const cameraZ = Math.max(maxDim * 2, 4);

      cameraRef.current.position.set(center.x + cameraZ * 0.7, center.y + cameraZ * 0.5, center.z + cameraZ * 0.7);
      cameraRef.current.lookAt(center);
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    } else {
      cameraRef.current.position.set(4, 3, 5);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  const handleDownloadAsset = () => {
    if (!assetUrl) return;
    const fullUrl = assetUrl.startsWith("http") ? assetUrl : `${apiBase}${assetUrl}`;
    const a = document.createElement("a");
    a.href = fullUrl;
    a.download = assetName || "kosh_model." + format;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="relative w-full h-full bg-[#09090b] flex flex-col select-none overflow-hidden">
      {/* Viewport Top Overlay Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-[#09090b]/90 to-transparent pointer-events-none text-xs">
        {/* Model Meta / Status */}
        <div className="pointer-events-auto flex items-center space-x-2 bg-[#09090b]/80 border border-[#27272a] px-2.5 py-1">
          <Box className="w-3.5 h-3.5 text-[#22c55e]" />
          <span className="font-semibold text-[#f4f4f5]">
            {assetName ? assetName : "STANDBY_VIEWPORT"}
          </span>
          <span className="text-[10px] text-[#71717a] uppercase">({format})</span>
        </div>

        {/* Viewport Control Actions */}
        <div className="pointer-events-auto flex items-center space-x-1.5 bg-[#09090b]/80 border border-[#27272a] p-1">
          {/* Wireframe toggle */}
          <button
            onClick={() => setWireframe(!wireframe)}
            title="Toggle Wireframe mode"
            className={`p-1 border transition-colors ${
              wireframe
                ? "bg-[#27272a] border-[#22c55e] text-[#22c55e]"
                : "border-transparent text-[#71717a] hover:text-[#f4f4f5]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          {/* Auto Rotate Toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title="Toggle Auto Rotation"
            className={`p-1 border transition-colors ${
              autoRotate
                ? "bg-[#27272a] border-[#22c55e] text-[#22c55e]"
                : "border-transparent text-[#71717a] hover:text-[#f4f4f5]"
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Grid Ground"
            className={`p-1 border transition-colors ${
              showGrid
                ? "bg-[#27272a] border-[#22c55e] text-[#22c55e]"
                : "border-transparent text-[#71717a] hover:text-[#f4f4f5]"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleResetCamera}
            title="Reset Camera View"
            className="p-1 border border-transparent text-[#71717a] hover:text-[#f4f4f5] hover:border-[#27272a]"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Download Model Button */}
          {assetUrl && (
            <button
              onClick={handleDownloadAsset}
              title="Download 3D Asset"
              className="flex items-center space-x-1 px-2 py-0.5 bg-[#22c55e] text-[#09090b] font-bold text-[11px] hover:bg-[#4ade80] transition-colors ml-1"
            >
              <Download className="w-3 h-3" />
              <span>DOWNLOAD</span>
            </button>
          )}
        </div>
      </div>

      {/* Model Loading Spinner */}
      {isLoadingModel && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#09090b]/70 backdrop-blur-sm pointer-events-none">
          <div className="w-8 h-8 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs text-[#22c55e] font-mono tracking-wider">
            STREAMING 3D ASSET...
          </span>
        </div>
      )}

      {/* Three.js Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Bottom Stats Overlay */}
      <div className="absolute bottom-2 left-3 z-10 flex items-center space-x-3 text-[10px] text-[#71717a] bg-[#09090b]/80 border border-[#27272a] px-2.5 py-1 pointer-events-none font-mono">
        {stats ? (
          <>
            <div>
              TRIS: <span className="text-[#f4f4f5]">{stats.triangles.toLocaleString()}</span>
            </div>
            <div>
              VERTS: <span className="text-[#f4f4f5]">{stats.vertices.toLocaleString()}</span>
            </div>
            <div>
              BOUNDS: <span className="text-[#f4f4f5]">{stats.dimensions}</span>
            </div>
          </>
        ) : (
          <div className="text-[#71717a]">
            ORBIT: <span className="text-[#f4f4f5]">LEFT_DRAG</span> | ZOOM:{" "}
            <span className="text-[#f4f4f5]">SCROLL</span> | PAN:{" "}
            <span className="text-[#f4f4f5]">RIGHT_DRAG</span>
          </div>
        )}
      </div>
    </div>
  );
}
