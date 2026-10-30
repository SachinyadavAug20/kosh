"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import {
  Box,
  GitFork,
  Download,
  Code,
  Play,
  Pause,
  RotateCw,
  Eye,
  Copy,
  Check,
  ChevronLeft,
  Share2,
  Maximize2,
  Grid,
} from "lucide-react";

interface ShareRecord {
  id: string;
  title: string;
  description?: string;
  author?: string;
  assetUrl?: string;
  assetName?: string;
  snapshotUrl?: string;
  script?: string;
  format?: string;
  theme?: string;
  createdAt?: number;
  shareUrl?: string;
}

export default function ShareViewPage() {
  const params = useParams();
  const router = useRouter();
  const shareId = params?.id as string;

  const [share, setShare] = useState<ShareRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Viewport Controls
  const [isPlaying, setIsPlaying] = useState(true);
  const [isTurntable, setIsTurntable] = useState(false);
  const [isWireframe, setIsWireframe] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  // 1. Fetch Share Record
  useEffect(() => {
    if (!shareId) return;
    setLoading(true);
    fetch(`http://localhost:8080/api/shares/${shareId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Share not found (${res.status})`);
        return res.json();
      })
      .then((data: ShareRecord) => {
        setShare(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || "Failed to load shared model");
        setLoading(false);
      });
  }, [shareId]);

  // 2. Setup Three.js WebGL Scene
  useEffect(() => {
    if (!containerRef.current || !share) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#141416");
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(4, 3, 5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1, 0);
    controlsRef.current = controls;

    // Lighting (Studio CAD Rig)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x22222a, 0.7);
    scene.add(hemiLight);

    const dirKey = new THREE.DirectionalLight(0xffffff, 1.4);
    dirKey.position.set(5, 8, 5);
    scene.add(dirKey);

    const dirFill = new THREE.DirectionalLight(0x90b0e0, 0.6);
    dirFill.position.set(-5, 4, -4);
    scene.add(dirFill);

    const dirRim = new THREE.DirectionalLight(0xea580c, 0.4);
    dirRim.position.set(0, -5, -5);
    scene.add(dirRim);

    // Grid Floor
    const grid = new THREE.GridHelper(10, 20, 0x3f3f46, 0x27272a);
    grid.position.y = 0;
    scene.add(grid);

    // Model Group
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // Load Model
    if (share.assetUrl) {
      const fullUrl = share.assetUrl.startsWith("http")
        ? share.assetUrl
        : `http://localhost:8080${share.assetUrl}`;

      if (share.format === "stl") {
        const stlLoader = new STLLoader();
        stlLoader.load(fullUrl, (geometry) => {
          geometry.computeVertexNormals();
          const mat = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            metalness: 0.8,
            roughness: 0.25,
          });
          const mesh = new THREE.Mesh(geometry, mat);
          mesh.position.y = 0;
          modelGroup.add(mesh);

          geometry.computeBoundingBox();
          if (geometry.boundingBox) {
            const center = new THREE.Vector3();
            geometry.boundingBox.getCenter(center);
            controls.target.copy(center);
            camera.position.set(center.x + 3, center.y + 2, center.z + 4);
          }
        });
      } else {
        const gltfLoader = new GLTFLoader();
        gltfLoader.load(
          fullUrl,
          (gltf) => {
            modelGroup.add(gltf.scene);

            // Compute Bounding Box
            const bbox = new THREE.Box3().setFromObject(gltf.scene);
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            bbox.getCenter(center);
            bbox.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z) || 2;
            controls.target.copy(center);
            camera.position.set(center.x + maxDim * 1.6, center.y + maxDim * 1.1, center.z + maxDim * 1.8);
            controls.update();

            // Setup Animation Mixer
            if (gltf.animations && gltf.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(gltf.scene);
              mixerRef.current = mixer;
              gltf.animations.forEach((clip) => {
                const action = mixer.clipAction(clip);
                action.play();
              });
            }
          },
          undefined,
          (err) => console.error("Error loading shared model:", err)
        );
      }
    }

    // Render Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();

      if (mixerRef.current && isPlaying) {
        mixerRef.current.update(delta);
      }

      if (modelGroupRef.current && isTurntable) {
        modelGroupRef.current.rotation.y += delta * 0.4;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [share, isTurntable, isPlaying]);

  // Wireframe Toggle
  const handleToggleWireframe = () => {
    const next = !isWireframe;
    setIsWireframe(next);
    if (modelGroupRef.current) {
      modelGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => (m.wireframe = next));
          } else {
            child.material.wireframe = next;
          }
        }
      });
    }
  };

  // Fork into Kosh Studio
  const handleForkInStudio = () => {
    if (!share) return;
    try {
      localStorage.setItem(
        "kosh_forked_scene",
        JSON.stringify({
          title: share.title,
          assetUrl: share.assetUrl,
          assetName: share.assetName,
          script: share.script,
          format: share.format || "glb",
        })
      );
      router.push("/");
    } catch (e) {
      console.error(e);
      router.push("/");
    }
  };

  // Download Asset File
  const handleDownloadAsset = () => {
    if (!share?.assetUrl) return;
    const url = share.assetUrl.startsWith("http")
      ? share.assetUrl
      : `http://localhost:8080${share.assetUrl}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = share.assetName || `kosh_model.${share.format || "glb"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Copy Share Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Copy Script
  const handleCopyScript = () => {
    if (!share?.script) return;
    navigator.clipboard.writeText(share.script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#141416] text-[#f4f4f5] font-sans select-none">
      {/* 1. Sleek Top Bar */}
      <header className="h-12 border-b border-[#333338] bg-[#1a1a1e] px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#202024] hover:bg-[#2c2c32] border border-[#383840] rounded text-xs text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Kosh Studio</span>
          </button>

          <div className="h-4 w-[1px] bg-[#333338]" />

          <div className="flex items-center space-x-2">
            <Box className="w-4 h-4 text-[#ea580c]" />
            <span className="font-bold text-sm tracking-tight">{share?.title || "Shared 3D Creation"}</span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#202024] border border-[#383840] text-[#a1a1aa] rounded uppercase">
              {share?.format || "GLB"}
            </span>
            {share?.author && (
              <span className="text-xs text-[#71717a]">by {share.author}</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center space-x-1.5 px-3 py-1 bg-[#202024] hover:bg-[#2c2c32] border border-[#383840] rounded text-xs text-[#f4f4f5] transition-colors"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Share2 className="w-3.5 h-3.5 text-[#a1a1aa]" />}
            <span>{copiedLink ? "Link Copied!" : "Share Link"}</span>
          </button>

          {share?.script && (
            <button
              onClick={() => setShowScriptModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1 bg-[#202024] hover:bg-[#2c2c32] border border-[#383840] rounded text-xs text-[#f4f4f5] transition-colors"
            >
              <Code className="w-3.5 h-3.5 text-[#ea580c]" />
              <span>Blender Script</span>
            </button>
          )}

          <button
            onClick={handleDownloadAsset}
            className="flex items-center space-x-1.5 px-3 py-1 bg-[#202024] hover:bg-[#2c2c32] border border-[#383840] rounded text-xs text-[#f4f4f5] transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#a1a1aa]" />
            <span>Download {share?.format?.toUpperCase() || "GLB"}</span>
          </button>

          <button
            onClick={handleForkInStudio}
            className="flex items-center space-x-1.5 px-3.5 py-1 bg-[#ea580c] hover:bg-[#f97316] text-[#ffffff] font-semibold rounded text-xs shadow-md transition-colors"
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Fork in Kosh Studio</span>
          </button>
        </div>
      </header>

      {/* 2. Main 3D Canvas */}
      <div className="flex-1 relative w-full h-full">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#141416] z-20">
            <div className="w-8 h-8 border-2 border-[#ea580c] border-t-transparent rounded-full animate-spin mb-3" />
            <span className="font-mono text-xs text-[#a1a1aa] tracking-wider">RETRIEVING SHARED 3D ASSET...</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#141416] z-20">
            <span className="text-[#ef4444] font-semibold mb-2">Error Loading Shared Scene</span>
            <span className="text-xs text-[#71717a] font-mono mb-4">{error}</span>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-1.5 bg-[#202024] border border-[#383840] rounded text-xs text-[#f4f4f5]"
            >
              Back to Studio
            </button>
          </div>
        )}

        <div ref={containerRef} className="w-full h-full" />

        {/* Viewport Overlay Controls Pill */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center space-x-2 bg-[#1a1a1e]/90 backdrop-blur border border-[#333338] px-3 py-1.5 rounded-full shadow-2xl z-20">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pause Animation" : "Play Animation"}
            className="p-1.5 text-[#a1a1aa] hover:text-[#f4f4f5] rounded hover:bg-[#2c2c32] transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4 text-[#ea580c]" /> : <Play className="w-4 h-4" />}
          </button>

          <div className="h-4 w-[1px] bg-[#333338]" />

          <button
            onClick={() => setIsTurntable(!isTurntable)}
            title="Toggle 360 Turntable Spin"
            className={`p-1.5 rounded hover:bg-[#2c2c32] transition-colors ${
              isTurntable ? "text-[#ea580c]" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
            }`}
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleToggleWireframe}
            title="Toggle Wireframe"
            className={`p-1.5 rounded hover:bg-[#2c2c32] transition-colors ${
              isWireframe ? "text-[#ea580c]" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Blender Python Script Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1e] border border-[#333338] w-full max-w-3xl rounded-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#333338]">
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4 text-[#ea580c]" />
                <span className="font-semibold text-sm">Blender Python Script (`bpy`)</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyScript}
                  className="flex items-center space-x-1 px-3 py-1 bg-[#202024] hover:bg-[#2c2c32] border border-[#383840] rounded text-xs text-[#f4f4f5]"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScript ? "Copied" : "Copy bpy Script"}</span>
                </button>
                <button
                  onClick={() => setShowScriptModal(false)}
                  className="px-2.5 py-1 text-xs text-[#a1a1aa] hover:text-[#f4f4f5]"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-[#141416]">
              <pre className="text-xs font-mono text-[#d4d4d8] leading-relaxed whitespace-pre select-text">
                {share?.script || "// No script source available"}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
