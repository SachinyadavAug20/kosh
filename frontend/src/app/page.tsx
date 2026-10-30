"use client";

import React, { useState, useEffect } from "react";
import { TerminalHeader } from "@/components/TerminalHeader";
import { CommandConsole } from "@/components/CommandConsole";
import { CodeInspector } from "@/components/CodeInspector";
import { Viewport3D, MeshNodeInfo } from "@/components/Viewport3D";
import { ShortcutsModal } from "@/components/ShortcutsModal";
import { useLocalStorageToken } from "@/hooks/useLocalStorageToken";
import { useMcpClient } from "@/hooks/useMcpClient";
import { ExportFormat } from "@/types/mcp";

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

  // Workstation Panel State (Left generator open 300px, Right inspector collapsible)
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(false);

  // Shortcuts Cheat Sheet Modal State
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Sub-Mesh Selection & Scene Hierarchy Synchronization
  const [selectedMeshName, setSelectedMeshName] = useState<string | null>(null);
  const [meshList, setMeshList] = useState<MeshNodeInfo[]>([]);
  const [lockedMeshes, setLockedMeshes] = useState<Set<string>>(new Set());

  const handleToggleMeshVisibility = (meshName: string) => {
    setMeshList((prevList) =>
      prevList.map((m) => {
        if (m.name === meshName) {
          const nextVis = !m.visible;
          if (m.meshRef) {
            m.meshRef.visible = nextVis;
          }
          return { ...m, visible: nextVis };
        }
        return m;
      })
    );
  };

  const handleToggleMeshLock = (meshName: string) => {
    setLockedMeshes((prev) => {
      const next = new Set(prev);
      if (next.has(meshName)) {
        next.delete(meshName);
      } else {
        next.add(meshName);
      }
      return next;
    });
  };

  const handleMeshSelect = (meshName: string | null) => {
    if (meshName && lockedMeshes.has(meshName)) return;
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
  }, []);

  // Global Editor Panes & Shortcuts Hotkeys (T, N, F1, ?)
  useEffect(() => {
    const handleGlobalHotkeys = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // F1 or ? -> Open Shortcuts Cheat Sheet
      if (e.key === "F1" || (e.shiftKey && (e.key === "?" || e.key === "/"))) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // T -> Toggle Left Tool/Generator Panel
      if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsLeftOpen((prev) => !prev);
        return;
      }

      // N -> Toggle Right Inspector/Outliner Panel
      if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsRightOpen((prev) => !prev);
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
    executeTool(toolName, args, token);
  };

  const handleExecuteRawScript = (rawScript: string) => {
    executeTool("blender_mesh", { script: rawScript, format: "glb" }, token);
  };

  return (
    <main className="flex flex-col h-screen w-screen overflow-hidden bg-[#18181b] text-[#f4f4f5] select-none font-sans">
      {/* 1. Sleek Workstation Menu / Header */}
      <TerminalHeader
        health={health}
        isHealthChecking={isHealthChecking}
        onRefreshHealth={checkHealth}
        token={token}
        onSaveToken={saveToken}
        onClearToken={clearToken}
        isLeftOpen={isLeftOpen}
        onToggleLeft={() => setIsLeftOpen(!isLeftOpen)}
        isRightOpen={isRightOpen}
        onToggleRight={() => setIsRightOpen(!isRightOpen)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* 2. Main Workstation 3-Panel DCC Layout */}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden relative">
        {/* Left Panel: Compact Tool Parameters & Generator (300px, collapsible with T) */}
        {isLeftOpen && (
          <aside className="w-[300px] shrink-0 h-full overflow-hidden flex flex-col z-20">
            <CommandConsole
              tools={tools}
              isLoading={isLoading}
              onExecute={handleExecute}
              lastResult={lastResult}
              error={error}
              hasToken={!!token}
              selectedMeshName={selectedMeshName}
              meshList={meshList}
              onSelectMesh={setSelectedMeshName}
              onLiveMaterialUpdate={setLiveMaterialUpdate}
              onLiveExplodedViewChange={setLiveExplodedFactor}
              onLiveTurntableChange={setLiveTurntable}
              onLiveHoverChange={setLiveHover}
            />
          </aside>
        )}

        {/* Center Panel: 3D Viewport DOMINATES THE ENTIRE SCREEN */}
        <section className="flex-1 min-w-0 h-full flex flex-col bg-[#141416] relative">
          {mounted ? (
            <Viewport3D
              assetUrl={lastResult?.assetUrl}
              assetName={lastResult?.assetName}
              snapshotUrl={lastResult?.snapshotUrl}
              telemetry={lastResult?.telemetry}
              format={lastResult?.format || "glb"}
              apiBase={apiBase}
              onMeshSelect={handleMeshSelect}
              onMeshListUpdate={setMeshList}
              externalSelectedMeshName={selectedMeshName}
              onOpenShortcuts={() => setIsShortcutsOpen(true)}
              liveMaterialUpdate={liveMaterialUpdate}
              liveExplodedFactor={liveExplodedFactor}
              liveTurntable={liveTurntable}
              liveHover={liveHover}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#141416] text-[#71717a] font-mono text-xs">
              <div className="w-5 h-5 border border-[#52525b] border-t-transparent rounded-full animate-spin mb-2" />
              <span>INITIALIZING BLENDER THREE.JS CONTEXT...</span>
            </div>
          )}
        </section>

        {/* Right Panel: Scene Outliner, Python Script & Build Logs (320px, collapsible with N) */}
        {isRightOpen && (
          <aside className="w-[320px] shrink-0 h-full overflow-hidden flex flex-col z-20">
            <CodeInspector
              script={lastResult?.script || null}
              onExecuteScript={handleExecuteRawScript}
              isLoading={isLoading}
              stdout={lastResult?.stdout || null}
              stderr={lastResult?.stderr || null}
              meshList={meshList}
              selectedMeshName={selectedMeshName}
              onSelectMesh={handleMeshSelect}
              onToggleMeshVisibility={handleToggleMeshVisibility}
              lockedMeshes={lockedMeshes}
              onToggleMeshLock={handleToggleMeshLock}
            />
          </aside>
        )}
      </div>

      {/* 3. Blender Shortcuts Modal Overlay */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </main>
  );
}
