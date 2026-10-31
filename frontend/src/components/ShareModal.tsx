"use client";

import React, { useState } from "react";
import { Share2, X, Check, Copy, ExternalLink, Globe, FileCode, CheckCircle2 } from "lucide-react";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetUrl?: string | null;
  assetName?: string | null;
  script?: string | null;
  format?: string;
}

export function ShareModal({
  isOpen,
  onClose,
  assetUrl,
  assetName,
  script,
  format = "glb",
}: ShareModalProps) {
  const [title, setTitle] = useState(assetName ? assetName.replace(/\.[^/.]+$/, "") : "My 3D Creation");
  const [author, setAuthor] = useState("Kosh Creator");
  const [description, setDescription] = useState("Created with Kosh 3D Workstation");
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareResult, setShareResult] = useState<{ id: string; shareUrl: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  if (!isOpen) return null;

  const handleCreateShare = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("http://localhost:8080/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          description,
          assetUrl,
          assetName,
          script,
          format,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate share link");
      const data = await res.json();
      setShareResult({
        id: data.id,
        shareUrl: `${window.location.origin}${data.shareUrl}`,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareResult?.shareUrl) return;
    navigator.clipboard.writeText(shareResult.shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyStandaloneHtml = () => {
    if (!assetUrl) return;
    const modelFullUrl = assetUrl.startsWith("http")
      ? assetUrl
      : `http://localhost:8080${assetUrl}`;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — 3D Viewer</title>
  <style>
    body { margin: 0; overflow: hidden; background: #141416; font-family: sans-serif; }
    #canvas-container { width: 100vw; height: 100vh; }
    .badge { position: absolute; bottom: 20px; left: 20px; background: rgba(26,26,30,0.85); color: #f4f4f5; padding: 8px 14px; border-radius: 6px; font-size: 12px; border: 1px solid #333338; backdrop-filter: blur(4px); }
  </style>
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
      }
    }
  </script>
</head>
<body>
  <div id="canvas-container"></div>
  <div class="badge"><strong>${title}</strong> &bull; Kosh 3D Workstation</div>

  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141416);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(4, 3, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Studio Lights
    scene.add(new THREE.HemisphereLight(0xffffff, 0x22222a, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(5, 8, 5);
    scene.add(key);

    const grid = new THREE.GridHelper(10, 20, 0x3f3f46, 0x27272a);
    scene.add(grid);

    // Load Model
    let mixer = null;
    const loader = new GLTFLoader();
    loader.load('${modelFullUrl}', (gltf) => {
      scene.add(gltf.scene);
      const bbox = new THREE.Box3().setFromObject(gltf.scene);
      const center = bbox.getCenter(new THREE.Vector3());
      controls.target.copy(center);
      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
      }
    });

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (mixer) mixer.update(delta);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;

    navigator.clipboard.writeText(htmlContent);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 select-none font-sans text-xs">
      <div className="bg-[#1a1a1e] border border-[#333338] w-full max-w-lg rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333338] bg-[#202024]">
          <div className="flex items-center space-x-2">
            <Share2 className="w-4 h-4 text-[#ea580c]" />
            <span className="font-semibold text-sm text-[#f4f4f5]">Share 3D Model Card</span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#141416] border border-[#333338] text-[#a1a1aa] rounded">
              COMMUNITY READY
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#2c2c32] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 bg-[#18181b]">
          {!shareResult ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-[#a1a1aa] mb-1 font-medium">Model Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#141416] border border-[#333338] focus:border-[#ea580c] focus:outline-none px-3 py-1.5 text-xs text-[#f4f4f5] rounded"
                  placeholder="e.g. Kinetic Flange Assembly"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#a1a1aa] mb-1 font-medium">Author Name / Handle</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full bg-[#141416] border border-[#333338] focus:border-[#ea580c] focus:outline-none px-3 py-1.5 text-xs text-[#f4f4f5] rounded"
                  placeholder="e.g. Satoshi_3D"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#a1a1aa] mb-1 font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-[#141416] border border-[#333338] focus:border-[#ea580c] focus:outline-none px-3 py-1.5 text-xs text-[#f4f4f5] rounded resize-none"
                  placeholder="Briefly describe this model..."
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 bg-[#202024] hover:bg-[#2c2c32] border border-[#383840] rounded text-xs text-[#a1a1aa]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleCreateShare}
                  disabled={isGenerating || !assetUrl}
                  className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#ea580c] hover:bg-[#f97316] text-white font-semibold rounded text-xs transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isGenerating ? "Publishing..." : "Generate Share Link"}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center space-x-2 text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/30 p-2.5 rounded">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">Permanent 3D Share Link Active!</span>
              </div>

              <div>
                <label className="block text-[11px] text-[#a1a1aa] mb-1">Interactive 3D Web URL</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={shareResult.shareUrl}
                    className="flex-1 bg-[#141416] border border-[#333338] px-3 py-1.5 text-xs text-[#e4e4e7] font-mono rounded select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-[#202024] hover:bg-[#2c2c32] border border-[#383840] rounded text-xs font-semibold text-[#f4f4f5]"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#333338]">
                <a
                  href={shareResult.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 bg-[#ea580c] hover:bg-[#f97316] text-white font-semibold rounded text-xs transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Open Interactive 3D Viewer</span>
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>

                <button
                  onClick={handleCopyStandaloneHtml}
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 bg-[#202024] hover:bg-[#2c2c32] border border-[#383840] text-[#f4f4f5] rounded text-xs transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5 text-[#ea580c]" />
                  <span>{copiedHtml ? "Copied 1-File HTML!" : "Copy Standalone 1-File HTML"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
