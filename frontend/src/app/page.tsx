"use client";

import React, { useState, useEffect } from "react";
import { Viewport3D, MeshNodeInfo } from "@/components/Viewport3D";
import { ShortcutsModal } from "@/components/ShortcutsModal";
import { PasteBpyModal } from "@/components/PasteBpyModal";
import { ShareModal } from "@/components/ShareModal";
import { CommunityShowcaseDrawer, CommunityModelItem } from "@/components/CommunityShowcaseDrawer";
import { useLocalStorageToken } from "@/hooks/useLocalStorageToken";
import { useMcpClient } from "@/hooks/useMcpClient";
import { ExportFormat, ToolExecutionResult } from "@/types/mcp";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { token, saveToken, clearToken } = useLocalStorageToken();
  const {
    health,
    tools,
    isLoading,
    isHealthChecking,
    error,
    lastResult,
    checkHealth,
    executeTool,
    apiBase,
  } = useMcpClient();

  // Custom loaded scene (from Fork, Showcase, or Community Share)
  const [customLoadedResult, setCustomLoadedResult] = useState<ToolExecutionResult | null>(null);

  // Modals & Drawers
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isPasteBpyOpen, setIsPasteBpyOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isShowcaseOpen, setIsShowcaseOpen] = useState(false);

  // Sub-Mesh Selection & Scene Hierarchy Synchronization
  const [selectedMeshName, setSelectedMeshName] = useState<string | null>(null);
  const [meshList, setMeshList] = useState<MeshNodeInfo[]>([]);

  const handleMeshSelect = (meshName: string | null) => {
    setSelectedMeshName(meshName);
  };

  // Real-Time In-Viewport Material & Animation Controls
  const [liveMaterialUpdate, setLiveMaterialUpdate] = useState<{
    color: string;
    roughness: number;
    metalness: number;
    transmission?: number;
    clearcoat?: number;
    emissive?: string;
    timestamp: number;
  } | null>(null);
  const [liveExplodedFactor, setLiveExplodedFactor] = useState<number>(0.0);
  const [liveTurntable, setLiveTurntable] = useState<boolean>(false);
  const [liveHover, setLiveHover] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    // Check if user came from Fork in Kosh Studio (/share/[id])
    try {
      const forked = localStorage.getItem("kosh_forked_scene");
      let restored = false;
      if (forked) {
        const parsed = JSON.parse(forked);
        localStorage.removeItem("kosh_forked_scene");
        if (parsed.assetUrl) {
          setCustomLoadedResult({
            toolName: "forked_scene",
            assetId: "forked",
            assetUrl: parsed.assetUrl,
            assetName: parsed.assetName || "forked_model.glb",
            script: parsed.script || undefined,
            format: (parsed.format || "glb") as ExportFormat,
            sizeBytes: 0,
            exitCode: 0,
            executionTimeMs: 0,
            success: true,
          });
          restored = true;
        }
      }

      // If no forked scene restored, auto-load featured starter model so viewport is alive immediately
      if (!restored) {
        fetch(`${apiBase}/api/shares/feat_turbine`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.assetUrl) {
              setCustomLoadedResult({
                toolName: "cad_model",
                assetId: data.id,
                assetUrl: `${apiBase}${data.assetUrl}`,
                assetName: data.assetName || "feat_turbine.glb",
                script: data.script,
                format: "glb",
                sizeBytes: 0,
                exitCode: 0,
                executionTimeMs: 0,
                success: true,
              });
            }
          })
          .catch((err) => console.log("Default model auto-load standby:", err));
      }
    } catch (e) {
      console.warn("Failed to restore or load scene:", e);
    }
  }, [apiBase]);

  // Global Editor Panes & Shortcuts Hotkeys (F1, ?)
  useEffect(() => {
    const handleGlobalHotkeys = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // F1 or ? -> Open Shortcuts Cheat Sheet
      if (e.key === "F1" || (e.shiftKey && (e.key === "?" || e.key === "/"))) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalHotkeys);
    return () => window.removeEventListener("keydown", handleGlobalHotkeys);
  }, []);

  const handleExecute = (
    toolName: string,
    args: { prompt?: string; script?: string; format: ExportFormat; previousScript?: string }
  ) => {
    setCustomLoadedResult(null);
    executeTool(toolName, args, token);
  };

  const handleExecuteRawScript = (rawScript: string) => {
    setCustomLoadedResult(null);
    executeTool("blender_mesh", { script: rawScript, format: "glb" }, token);
  };

  const handleLoadCommunityModel = (item: CommunityModelItem) => {
    if (item.assetUrl) {
      setCustomLoadedResult({
        toolName: "community_showcase",
        assetId: item.id || "showcase",
        assetUrl: item.assetUrl,
        assetName: item.assetName || `${item.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.${item.format || "glb"}`,
        script: item.script || undefined,
        format: (item.format || "glb") as ExportFormat,
        sizeBytes: 0,
        exitCode: 0,
        executionTimeMs: 0,
        success: true,
      });
    } else if (item.script) {
      setCustomLoadedResult(null);
      executeTool("blender_mesh", { script: item.script, format: (item.format || "glb") as ExportFormat }, token);
    }
  };

  const effectiveResult = customLoadedResult || lastResult;

  return (
    <main className="flex flex-col h-screen w-screen overflow-hidden bg-[#141416] text-[#f4f4f5] select-none font-sans">
      {/* 100% Viewport Real Estate - Blender DCC Workstation */}
      {mounted ? (
        <Viewport3D
          assetUrl={effectiveResult?.assetUrl}
          assetName={effectiveResult?.assetName}
          snapshotUrl={effectiveResult?.snapshotUrl}
          telemetry={effectiveResult?.telemetry}
          format={effectiveResult?.format || "glb"}
          apiBase={apiBase}
          onMeshSelect={handleMeshSelect}
          onMeshListUpdate={setMeshList}
          externalSelectedMeshName={selectedMeshName}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          liveMaterialUpdate={liveMaterialUpdate}
          liveExplodedFactor={liveExplodedFactor}
          liveTurntable={liveTurntable}
          liveHover={liveHover}
          health={health}
          isHealthChecking={isHealthChecking}
          onRefreshHealth={checkHealth}
          token={token}
          onSaveToken={saveToken}
          onClearToken={clearToken}
          onOpenPasteBpy={() => setIsPasteBpyOpen(true)}
          onOpenShare={() => setIsShareOpen(true)}
          onOpenShowcase={() => setIsShowcaseOpen(true)}
          tools={tools}
          isLoading={isLoading}
          onExecuteTool={handleExecute}
          onExecuteRawScript={handleExecuteRawScript}
          script={effectiveResult?.script || null}
          stdout={effectiveResult?.stdout || null}
          stderr={effectiveResult?.stderr || null}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#141416] text-[#71717a] font-mono text-xs">
          <div className="w-5 h-5 border border-[#52525b] border-t-transparent rounded-full animate-spin mb-2" />
          <span>INITIALIZING BLENDER THREE.JS CONTEXT...</span>
        </div>
      )}

      {/* Blender Shortcuts Modal Overlay */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Paste Blender Python Code Modal */}
      <PasteBpyModal
        isOpen={isPasteBpyOpen}
        onClose={() => setIsPasteBpyOpen(false)}
        onExecute={handleExecuteRawScript}
        isLoading={isLoading}
      />

      {/* 3D Model Share Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        assetUrl={effectiveResult?.assetUrl}
        assetName={effectiveResult?.assetName}
        script={effectiveResult?.script}
        format={effectiveResult?.format || "glb"}
      />

      {/* Community Showcase Drawer */}
      <CommunityShowcaseDrawer
        isOpen={isShowcaseOpen}
        onClose={() => setIsShowcaseOpen(false)}
        onLoadModel={handleLoadCommunityModel}
      />
    </main>
  );
}
