"use client";

import React, { useState } from "react";
import {
  Code,
  Copy,
  Check,
  Download,
  Play,
  Layers,
  Terminal,
  FileCode,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Info,
  MousePointer,
} from "lucide-react";

interface CodeInspectorProps {
  script: string | null;
  assetUrl?: string | null;
  onExecuteScript?: (script: string) => void;
  isLoading?: boolean;
  stdout?: string | null;
  stderr?: string | null;
  meshList?: Array<{ id: string; name: string; triangles: number; vertices: number; visible?: boolean }>;
  selectedMeshName?: string | null;
  onSelectMesh?: (meshName: string) => void;
  onToggleMeshVisibility?: (meshName: string) => void;
  lockedMeshes?: Set<string>;
  onToggleMeshLock?: (meshName: string) => void;
}

export function CodeInspector({
  script,
  assetUrl,
  onExecuteScript,
  isLoading,
  stdout,
  stderr,
  meshList = [],
  selectedMeshName,
  onSelectMesh,
  onToggleMeshVisibility,
  lockedMeshes,
  onToggleMeshLock,
}: CodeInspectorProps) {
  const [activeTab, setActiveTab] = useState<"script" | "outliner" | "logs">("script");
  const [copied, setCopied] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const [editableScript, setEditableScript] = useState("");

  const handleCopyStandaloneHtml = () => {
    const fullUrl = assetUrl
      ? (assetUrl.startsWith("http") ? assetUrl : `http://localhost:8080${assetUrl}`)
      : "";

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kosh 3D Model</title>
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
  <div class="badge">Kosh Standalone 3D Export</div>
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

    scene.add(new THREE.HemisphereLight(0xffffff, 0x22222a, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(5, 8, 5);
    scene.add(key);

    const grid = new THREE.GridHelper(10, 20, 0x3f3f46, 0x27272a);
    scene.add(grid);

    let mixer = null;
    const loader = new GLTFLoader();
    loader.load('${fullUrl}', (gltf) => {
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

  React.useEffect(() => {
    if (script) {
      setEditableScript(script);
    }
  }, [script]);

  const handleCopy = () => {
    const textToCopy = isEditable ? editableScript : script || "";
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = isEditable ? editableScript : script || "";
    if (!text) return;
    const blob = new Blob([text], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kosh_scene_script.py";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRunModified = () => {
    if (onExecuteScript && editableScript.trim()) {
      onExecuteScript(editableScript.trim());
    }
  };

  const activeContent = isEditable ? editableScript : script;
  const lines = activeContent ? activeContent.split("\n") : [];

  return (
    <div className="flex flex-col h-full bg-[#18181b] text-xs font-sans border-l border-[#3f3f46]">
      {/* Inspector Top Tabs Strip */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#3f3f46] bg-[#1f1f23]">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab("script")}
            className={`tool-btn ${activeTab === "script" ? "active" : ""}`}
          >
            <Code className="w-3 h-3 mr-1" />
            <span>Script</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("outliner")}
            className={`tool-btn ${activeTab === "outliner" ? "active" : ""}`}
          >
            <Layers className="w-3 h-3 mr-1" />
            <span>Outliner</span>
            {meshList.length > 0 && (
              <span className="ml-1 px-1 bg-[#18181b] rounded-sm text-[9px] font-mono">{meshList.length}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`tool-btn ${activeTab === "logs" ? "active" : ""}`}
          >
            <Terminal className="w-3 h-3 mr-1" />
            <span>Build Logs</span>
            {stderr && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
            )}
          </button>
        </div>

        {/* Script Actions */}
        {activeTab === "script" && (
          <div className="flex items-center space-x-1">
            {onExecuteScript && (
              <button
                onClick={() => setIsEditable(!isEditable)}
                className={`tool-btn ${isEditable ? "active" : ""}`}
              >
                {isEditable ? "Lock" : "Edit"}
              </button>
            )}

            {isEditable && onExecuteScript && (
              <button
                onClick={handleRunModified}
                disabled={isLoading || !editableScript.trim()}
                className="tool-btn bg-[#ea580c] hover:bg-[#f97316] text-[#ffffff] font-semibold border-[#c2410c]"
              >
                <Play className="w-3 h-3 fill-current mr-1" />
                <span>Run</span>
              </button>
            )}

            <button onClick={handleCopy} disabled={!activeContent} className="tool-btn p-1" title="Copy script">
              {copied ? <Check className="w-3 h-3 text-[#f4f4f5]" /> : <Copy className="w-3 h-3" />}
            </button>

            <button onClick={handleDownload} disabled={!activeContent} className="tool-btn p-1" title="Download script">
              <Download className="w-3 h-3" />
            </button>

            <button
              onClick={handleCopyStandaloneHtml}
              disabled={!assetUrl}
              className="tool-btn px-1.5 py-0.5 space-x-1 border-[#ea580c]/50 hover:border-[#ea580c]"
              title="Copy 1-File Standalone HTML Embed"
            >
              {copiedHtml ? (
                <>
                  <Check className="w-3 h-3 text-[#10b981]" />
                  <span className="text-[10px] text-[#10b981]">HTML Copied</span>
                </>
              ) : (
                <>
                  <FileCode className="w-3 h-3 text-[#ea580c]" />
                  <span className="text-[10px] font-mono">HTML</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-auto bg-[#18181b]">
        {activeTab === "script" ? (
          activeContent ? (
            isEditable ? (
              <textarea
                value={editableScript}
                onChange={(e) => setEditableScript(e.target.value)}
                className="w-full h-full bg-[#141416] text-[#f4f4f5] p-3 font-mono text-[11px] leading-relaxed border-none focus:outline-none resize-none"
                spellCheck={false}
              />
            ) : (
              <div className="table w-full font-mono text-[11px] leading-relaxed">
                {lines.map((line, idx) => (
                  <div key={idx} className="table-row hover:bg-[#1f1f23]">
                    <span className="table-cell select-none pr-3 pl-2 py-0.5 text-right text-[#52525b] border-r border-[#27272a] w-8">
                      {idx + 1}
                    </span>
                    <span className="table-cell pl-3 py-0.5 text-[#f4f4f5] whitespace-pre select-text">
                      {line}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="p-4 text-[#71717a] font-mono text-xs italic">
              // No Blender bpy script generated yet. Compile a prompt to view Python execution code.
            </div>
          )
        ) : activeTab === "outliner" ? (
          <div className="p-2 space-y-1">
            <div className="text-[10px] text-[#71717a] font-mono uppercase px-1 pb-1 border-b border-[#27272a]">
              Scene Hierarchy ({meshList.length} objects)
            </div>
            {meshList.length === 0 ? (
              <div className="text-[#71717a] py-4 text-center font-mono text-xs">No objects in scene</div>
            ) : (
              meshList.map((m, i) => {
                const isSelected = selectedMeshName === m.name;
                const isVisible = m.visible !== false;
                const isLocked = lockedMeshes?.has(m.name) ?? false;
                return (
                  <div
                    key={m.id || i}
                    onClick={() => {
                      if (!isLocked) onSelectMesh?.(m.name);
                    }}
                    className={`flex items-center justify-between p-1.5 border rounded-sm text-xs cursor-pointer transition-colors group ${
                      isSelected
                        ? "bg-[#27272a] border-[#ea580c] text-[#f4f4f5]"
                        : "bg-[#1f1f23] border-[#3f3f46] hover:bg-[#27272a] text-[#a1a1aa]"
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <Layers className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-[#ea580c]" : "text-[#a1a1aa]"}`} />
                      <span className={`font-mono truncate ${isSelected ? "font-bold text-[#f4f4f5]" : ""} ${!isVisible ? "line-through text-[#71717a]" : ""}`}>
                        {m.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-[#71717a]">
                        {m.triangles.toLocaleString()} tris
                      </span>
                      {/* Visibility Eye Toggle */}
                      <button
                        type="button"
                        title={isVisible ? "Hide in viewport" : "Show in viewport"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMeshVisibility?.(m.name);
                        }}
                        className={`p-1 rounded hover:bg-[#3f3f46] transition-colors ${
                          isVisible ? "text-[#a1a1aa] hover:text-[#f4f4f5]" : "text-[#ea580c]"
                        }`}
                      >
                        {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                      {/* Lock Toggle */}
                      <button
                        type="button"
                        title={isLocked ? "Unlock object" : "Lock object"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMeshLock?.(m.name);
                        }}
                        className={`p-1 rounded hover:bg-[#3f3f46] transition-colors ${
                          isLocked ? "text-[#ea580c]" : "text-[#71717a] hover:text-[#a1a1aa]"
                        }`}
                      >
                        {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      </button>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ea580c] ml-0.5" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="p-3 font-mono text-[11px] leading-relaxed space-y-2 select-text">
            {stdout && (
              <div>
                <div className="text-[10px] text-[#71717a] uppercase mb-1">STDOUT</div>
                <pre className="text-[#a1a1aa] whitespace-pre-wrap">{stdout}</pre>
              </div>
            )}
            {stderr && (
              <div className="pt-2 border-t border-[#3f3f46]">
                <div className="text-[10px] text-[#ef4444] uppercase mb-1">STDERR / TRACE</div>
                <pre className="text-[#f87171] whitespace-pre-wrap">{stderr}</pre>
              </div>
            )}
            {!stdout && !stderr && (
              <div className="text-[#71717a] italic">// No process logs recorded.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
