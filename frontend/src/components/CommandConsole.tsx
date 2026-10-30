"use client";

import React, { useState } from "react";
import { McpToolDefinition, ToolExecutionResult } from "@/types/mcp";
import { Play, Terminal, Box, Cog, Loader2, Sparkles, Check, AlertTriangle } from "lucide-react";

interface CommandConsoleProps {
  tools: McpToolDefinition[];
  isLoading: boolean;
  onExecute: (
    toolName: string,
    args: { prompt?: string; script?: string; format: "glb" | "stl" }
  ) => void;
  lastResult: ToolExecutionResult | null;
  error: string | null;
  hasToken: boolean;
}

const PRESETS = [
  {
    tool: "blender_mesh",
    label: "Sci-Fi Crate",
    format: "glb" as const,
    prompt: "Procedural sci-fi shipping container with beveled chamfers, glowing phosphor seams, and metallic dark plating",
  },
  {
    tool: "cad_model",
    label: "Flange Coupling",
    format: "glb" as const,
    prompt: "Precision industrial flange coupling with center drive bore, keyway slot, and 6 bolt clearance holes",
  },
  {
    tool: "cad_model",
    label: "Bevel Gear (STL)",
    format: "stl" as const,
    prompt: "Parametric mechanical spur gear with 18 teeth, 40mm pitch diameter, 10mm central shaft bore",
  },
  {
    tool: "blender_mesh",
    label: "Monolith Pedestal",
    format: "glb" as const,
    prompt: "Brutalist obsidian geometric monument on tiered stone plinths with engraved circuitry",
  },
];

export function CommandConsole({
  tools,
  isLoading,
  onExecute,
  lastResult,
  error,
  hasToken,
}: CommandConsoleProps) {
  const [selectedTool, setSelectedTool] = useState<string>("blender_mesh");
  const [format, setFormat] = useState<"glb" | "stl">("glb");
  const [prompt, setPrompt] = useState<string>(
    "Procedural sci-fi shipping container with beveled chamfers, glowing phosphor seams, and metallic dark plating"
  );
  const [activeTab, setActiveTab] = useState<"stdout" | "stderr">("stdout");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onExecute(selectedTool, { prompt: prompt.trim(), format });
  };

  const handleSelectPreset = (p: typeof PRESETS[0]) => {
    setSelectedTool(p.tool);
    setFormat(p.format);
    setPrompt(p.prompt);
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-xs">
      {/* Console Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-[#27272a] bg-[#121215]">
        {/* Tool Selectors */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setSelectedTool("blender_mesh")}
            className={`flex items-center space-x-1 px-2.5 py-1 text-xs border transition-colors ${
              selectedTool === "blender_mesh"
                ? "bg-[#09090b] border-[#22c55e] text-[#22c55e] font-semibold"
                : "border-[#27272a] text-[#71717a] hover:border-[#3f3f46] hover:text-[#f4f4f5]"
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>blender_mesh</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTool("cad_model")}
            className={`flex items-center space-x-1 px-2.5 py-1 text-xs border transition-colors ${
              selectedTool === "cad_model"
                ? "bg-[#09090b] border-[#22c55e] text-[#22c55e] font-semibold"
                : "border-[#27272a] text-[#71717a] hover:border-[#3f3f46] hover:text-[#f4f4f5]"
            }`}
          >
            <Cog className="w-3.5 h-3.5" />
            <span>cad_model</span>
          </button>
        </div>

        {/* Format Selector */}
        <div className="flex items-center space-x-1 bg-[#09090b] border border-[#27272a] p-0.5">
          <button
            type="button"
            onClick={() => setFormat("glb")}
            className={`px-2 py-0.5 text-[11px] ${
              format === "glb" ? "bg-[#27272a] text-[#22c55e] font-bold" : "text-[#71717a]"
            }`}
          >
            GLB
          </button>
          <button
            type="button"
            onClick={() => setFormat("stl")}
            className={`px-2 py-0.5 text-[11px] ${
              format === "stl" ? "bg-[#27272a] text-[#22c55e] font-bold" : "text-[#71717a]"
            }`}
          >
            STL
          </button>
        </div>
      </div>

      {/* Preset Chips */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#27272a] bg-[#09090b] overflow-x-auto text-[11px]">
        <span className="text-[#71717a] flex items-center gap-1 shrink-0">
          <Sparkles className="w-3 h-3 text-[#22c55e]" /> PRESETS:
        </span>
        {PRESETS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSelectPreset(p)}
            className="px-2 py-0.5 bg-[#121215] border border-[#27272a] hover:border-[#22c55e] text-[#a1a1aa] hover:text-[#f4f4f5] shrink-0 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Prompt Form */}
      <form onSubmit={handleSubmit} className="p-3 border-b border-[#27272a] bg-[#09090b] space-y-2">
        <div className="flex items-center justify-between text-[#71717a] text-[11px]">
          <span className="flex items-center gap-1">
            <span className="text-[#22c55e] font-bold">&gt;</span> PROMPT INPUT //{" "}
            {selectedTool.toUpperCase()}
          </span>
          {!hasToken && (
            <span className="text-[#f59e0b] flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> BYOK Key recommended (or use demo mode)
            </span>
          )}
        </div>

        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your 3D mesh geometry, materials, dimensions, or CAD boolean operations..."
          className="w-full bg-[#121215] border border-[#27272a] focus:border-[#22c55e] focus:outline-none p-2.5 text-xs text-[#f4f4f5] font-mono resize-none"
        />

        <div className="flex items-center justify-between">
          <div className="text-[11px] text-[#71717a]">
            Protocol: <span className="text-[#f4f4f5]">JSON-RPC 2.0</span> / Engine:{" "}
            <span className="text-[#f4f4f5]">Blender 5.x Headless</span>
          </div>

          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#22c55e] text-[#09090b] font-bold text-xs hover:bg-[#4ade80] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>EXECUTING MCP...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>GENERATE 3D</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Terminal Stream Logs Section */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#09090b]">
        {/* Stream Tab Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#27272a] bg-[#121215] text-[11px]">
          <div className="flex items-center space-x-2">
            <Terminal className="w-3.5 h-3.5 text-[#22c55e]" />
            <span className="font-semibold text-[#f4f4f5]">EXECUTION LOG STREAM</span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab("stdout")}
              className={`px-2 py-0.5 border ${
                activeTab === "stdout"
                  ? "bg-[#09090b] border-[#27272a] text-[#22c55e]"
                  : "border-transparent text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              stdout
            </button>
            <button
              onClick={() => setActiveTab("stderr")}
              className={`px-2 py-0.5 border ${
                activeTab === "stderr"
                  ? "bg-[#09090b] border-[#27272a] text-[#ef4444]"
                  : "border-transparent text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              stderr
            </button>
          </div>
        </div>

        {/* Execution Status Bar */}
        {lastResult && (
          <div className="flex items-center justify-between px-3 py-1 bg-[#121215]/80 border-b border-[#27272a] text-[11px]">
            <div className="flex items-center space-x-2">
              <span
                className={`flex items-center gap-1 font-semibold ${
                  lastResult.success ? "text-[#22c55e]" : "text-[#ef4444]"
                }`}
              >
                {lastResult.success ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {lastResult.success ? "EXECUTION SUCCESS" : "EXECUTION FAILED"}
              </span>
              <span className="text-[#3f3f46]">|</span>
              <span className="text-[#71717a]">{lastResult.assetName}</span>
              <span className="text-[#71717a]">
                ({(lastResult.sizeBytes / 1024).toFixed(1)} KB)
              </span>
            </div>
            <div className="text-[#71717a]">{lastResult.executionTimeMs}ms</div>
          </div>
        )}

        {/* Console Log Body */}
        <div className="flex-1 p-3 font-mono text-[11px] overflow-y-auto leading-relaxed space-y-1">
          {error && (
            <div className="p-2 border border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444] mb-2">
              [MCP ERROR] {error}
            </div>
          )}

          {activeTab === "stdout" ? (
            lastResult?.stdout ? (
              <pre className="text-[#a1a1aa] whitespace-pre-wrap font-mono selection:bg-[#22c55e] selection:text-[#09090b]">
                {lastResult.stdout}
              </pre>
            ) : (
              <div className="text-[#3f3f46] italic">
                // System ready. Select a preset or enter a prompt above and click GENERATE 3D.
              </div>
            )
          ) : lastResult?.stderr ? (
            <pre className="text-[#f59e0b] whitespace-pre-wrap font-mono">
              {lastResult.stderr}
            </pre>
          ) : (
            <div className="text-[#3f3f46] italic">// No standard error messages.</div>
          )}
        </div>
      </div>
    </div>
  );
}
