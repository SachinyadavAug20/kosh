"use client";

import React, { useState, useEffect } from "react";
import { TerminalHeader } from "@/components/TerminalHeader";
import { CommandConsole } from "@/components/CommandConsole";
import { CodeInspector } from "@/components/CodeInspector";
import { Viewport3D } from "@/components/Viewport3D";
import { useLocalStorageToken } from "@/hooks/useLocalStorageToken";
import { useMcpClient } from "@/hooks/useMcpClient";

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

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleExecute = (
    toolName: string,
    args: { prompt?: string; script?: string; format: "glb" | "stl" }
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
      />

      {/* 2. Main Workstation 3-Panel DCC Layout */}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden relative">
        {/* Left Panel: Compact Tool Parameters & Generator (300px, collapsible) */}
        {isLeftOpen && (
          <aside className="w-[300px] shrink-0 h-full overflow-hidden flex flex-col z-20">
            <CommandConsole
              tools={tools}
              isLoading={isLoading}
              onExecute={handleExecute}
              lastResult={lastResult}
              error={error}
              hasToken={!!token}
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
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#141416] text-[#71717a] font-mono text-xs">
              <div className="w-5 h-5 border border-[#52525b] border-t-transparent rounded-full animate-spin mb-2" />
              <span>INITIALIZING BLENDER THREE.JS CONTEXT...</span>
            </div>
          )}
        </section>

        {/* Right Panel: Scene Outliner, Python Script & Build Logs (320px, collapsible) */}
        {isRightOpen && (
          <aside className="w-[320px] shrink-0 h-full overflow-hidden flex flex-col z-20">
            <CodeInspector
              script={lastResult?.script || null}
              onExecuteScript={handleExecuteRawScript}
              isLoading={isLoading}
              stdout={lastResult?.stdout || null}
              stderr={lastResult?.stderr || null}
            />
          </aside>
        )}
      </div>
    </main>
  );
}
