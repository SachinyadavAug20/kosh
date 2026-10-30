"use client";

import React, { useState, useEffect } from "react";
import { TerminalHeader } from "@/components/TerminalHeader";
import { CommandConsole } from "@/components/CommandConsole";
import { CodeInspector } from "@/components/CodeInspector";
import { Viewport3D } from "@/components/Viewport3D";
import { useLocalStorageToken } from "@/hooks/useLocalStorageToken";
import { useMcpClient } from "@/hooks/useMcpClient";
import { Terminal, Code, Cpu } from "lucide-react";

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

  const [leftTab, setLeftTab] = useState<"console" | "code">("console");

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
    <main className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)] select-none font-mono">
      {/* 1. Header with System Health, BYOK Credentials & Themes */}
      <TerminalHeader
        health={health}
        isHealthChecking={isHealthChecking}
        onRefreshHealth={checkHealth}
        token={token}
        onSaveToken={saveToken}
        onClearToken={clearToken}
      />

      {/* 2. Main Studio Split Layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Left Pane (50%): MCP Studio, Logs & Code Inspector */}
        <div className="w-full md:w-1/2 flex flex-col min-h-0 border-r border-[var(--border)] bg-[var(--background)]">
          {/* Sub-nav switcher for Console vs Code */}
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-header)] px-3 py-1.5 text-xs">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setLeftTab("console")}
                className={`flex items-center space-x-1.5 px-3 py-1 border transition-colors ${
                  leftTab === "console"
                    ? "bg-[var(--background)] border-[var(--accent)] text-[var(--accent)] font-semibold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>COMMAND_CONSOLE</span>
              </button>

              <button
                onClick={() => setLeftTab("code")}
                className={`flex items-center space-x-1.5 px-3 py-1 border transition-colors ${
                  leftTab === "code"
                    ? "bg-[var(--background)] border-[var(--accent)] text-[var(--accent)] font-semibold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>CODE_INSPECTOR</span>
                {lastResult?.script && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                )}
              </button>
            </div>

            <div className="hidden sm:flex items-center space-x-2 text-[10px] text-[var(--text-muted)]">
              <Cpu className="w-3 h-3 text-[var(--accent)]" />
              <span>PID: MCP-8080</span>
            </div>
          </div>

          {/* Active Left View */}
          <div className="flex-1 min-h-0">
            {leftTab === "console" ? (
              <CommandConsole
                tools={tools}
                isLoading={isLoading}
                onExecute={handleExecute}
                lastResult={lastResult}
                error={error}
                hasToken={!!token}
              />
            ) : (
              <CodeInspector
                script={lastResult?.script || null}
                onExecuteScript={handleExecuteRawScript}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>

        {/* Right Pane (50%): Three.js Blender 3D Viewport */}
        <div className="w-full md:w-1/2 flex flex-col min-h-0 bg-[var(--background)]">
          {mounted ? (
            <Viewport3D
              assetUrl={lastResult?.assetUrl}
              assetName={lastResult?.assetName}
              format={lastResult?.format || "glb"}
              apiBase={apiBase}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--background)] text-[var(--text-muted)] font-mono text-xs">
              <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-3" />
              <span>INITIALIZING THREE.JS WEBGL CONTEXT...</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
