"use client";

import React, { useState } from "react";
import { McpToolDefinition, ToolExecutionResult } from "@/types/mcp";
import {
  Play,
  Terminal,
  Box,
  Cog,
  Loader2,
  Sparkles,
  Check,
  AlertTriangle,
  RotateCcw,
  History,
  Layers,
  ChevronDown,
} from "lucide-react";

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
    label: "Color Pyramid",
    format: "glb" as const,
    prompt: "make simple pyramid of colors with distinct vibrant colored faces and beveled edges",
  },
  {
    tool: "blender_mesh",
    label: "Sci-Fi Crate",
    format: "glb" as const,
    prompt: "Procedural sci-fi shipping container with beveled chamfers, glowing core, and slate armor plating",
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
    label: "Iridescent Orb",
    format: "glb" as const,
    prompt: "Stylized faceted geodesic sphere with glass materials and metallic reflections",
  },
];

const MODELS = [
  { id: "auto", name: "Auto Cascade Pool (Recommended)" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "gemini-flash-latest", name: "Gemini Flash Latest" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite (Low Latency)" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
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
    "make simple pyramid of colors with distinct vibrant colored faces and beveled edges"
  );
  const [selectedModel, setSelectedModel] = useState<string>("auto");
  const [activeTab, setActiveTab] = useState<"stdout" | "stderr">("stdout");
  const [history, setHistory] = useState<
    Array<{ prompt: string; tool: string; format: "glb" | "stl"; timestamp: string }>
  >([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    // Track in session history
    setHistory((prev) => [
      {
        prompt: prompt.trim(),
        tool: selectedTool,
        format,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 15),
    ]);

    onExecute(selectedTool, { prompt: prompt.trim(), format });
  };

  const handleSelectPreset = (p: (typeof PRESETS)[0]) => {
    setSelectedTool(p.tool);
    setFormat(p.format);
    setPrompt(p.prompt);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--background)] text-xs text-[var(--foreground)] font-mono">
      {/* Console Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-header)]">
        {/* Tool Selectors */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setSelectedTool("blender_mesh")}
            className={`flex items-center space-x-1 px-2.5 py-1 text-xs border transition-colors ${
              selectedTool === "blender_mesh"
                ? "bg-[var(--background)] border-[var(--accent)] text-[var(--accent)] font-semibold shadow-sm"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-light)] hover:text-[var(--foreground)]"
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
                ? "bg-[var(--background)] border-[var(--accent)] text-[var(--accent)] font-semibold shadow-sm"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-light)] hover:text-[var(--foreground)]"
            }`}
          >
            <Cog className="w-3.5 h-3.5" />
            <span>cad_model</span>
          </button>
        </div>

        {/* Format Selector & History Button */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="flex items-center space-x-1 px-2 py-0.5 border border-[var(--border)] bg-[var(--bg-subpanel)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
          >
            <History className="w-3 h-3 text-[var(--accent)]" />
            <span>HISTORY ({history.length})</span>
          </button>

          <div className="flex items-center bg-[var(--bg-subpanel)] border border-[var(--border)] p-0.5">
            <button
              type="button"
              onClick={() => setFormat("glb")}
              className={`px-2 py-0.5 font-bold uppercase transition-colors ${
                format === "glb"
                  ? "bg-[var(--accent)] text-[var(--background)]"
                  : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              GLB
            </button>
            <button
              type="button"
              onClick={() => setFormat("stl")}
              className={`px-2 py-0.5 font-bold uppercase transition-colors ${
                format === "stl"
                  ? "bg-[var(--accent)] text-[var(--background)]"
                  : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              STL
            </button>
          </div>
        </div>
      </div>

      {/* History Slide-down Drawer */}
      {isHistoryOpen && (
        <div className="border-b border-[var(--border)] bg-[var(--bg-subpanel)] p-2.5 max-h-44 overflow-y-auto space-y-1">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pb-1 border-b border-[var(--border)]">
            <span>SESSION RUN HISTORY</span>
            <button onClick={() => setIsHistoryOpen(false)} className="hover:text-[var(--foreground)]">✕</button>
          </div>
          {history.length === 0 ? (
            <div className="text-[var(--text-muted)] py-2 text-center text-[10px]">No past prompt runs in this session</div>
          ) : (
            history.map((h, i) => (
              <div
                key={i}
                onClick={() => {
                  setPrompt(h.prompt);
                  setSelectedTool(h.tool);
                  setFormat(h.format);
                  setIsHistoryOpen(false);
                }}
                className="flex items-center justify-between p-1 bg-[var(--bg-panel)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer text-[10px]"
              >
                <span className="truncate flex-1 mr-2">{h.prompt}</span>
                <span className="text-[var(--text-muted)]">{h.timestamp}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Presets Bar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--background)] overflow-x-auto text-[11px]">
        <span className="text-[var(--text-muted)] flex items-center gap-1 shrink-0">
          <Sparkles className="w-3 h-3 text-[var(--accent)]" /> PRESETS:
        </span>
        {PRESETS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSelectPreset(p)}
            className="px-2 py-0.5 bg-[var(--bg-panel)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-muted)] hover:text-[var(--foreground)] shrink-0 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Prompt Form */}
      <form onSubmit={handleSubmit} className="p-3 border-b border-[var(--border)] bg-[var(--background)] space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 text-[var(--text-muted)]">
            <span className="text-[var(--accent)] font-bold">&gt;</span> PROMPT INPUT //{" "}
            <span className="font-semibold text-[var(--foreground)]">{selectedTool.toUpperCase()}</span>
          </span>

          {/* Model Cascade Pool Selector */}
          <div className="flex items-center space-x-1 text-[10px]">
            <span className="text-[var(--text-muted)]">ENGINE:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--accent)] px-1.5 py-0.5 rounded-none font-mono focus:outline-none focus:border-[var(--accent)]"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-[var(--bg-panel)] text-[var(--foreground)]">
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your 3D mesh geometry, materials, dimensions, or CAD boolean operations..."
          className="w-full bg-[var(--bg-panel)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none p-2.5 text-xs text-[var(--foreground)] font-mono resize-none"
        />

        <div className="flex items-center justify-between">
          <div className="text-[11px] text-[var(--text-muted)] flex items-center space-x-1.5">
            <span>AI: <strong className="text-[var(--accent)]">Gemini 2.5 Flash / Cascade</strong></span>
            <span>•</span>
            <span>Engine: <strong>Blender 5.2 LTS</strong></span>
          </div>

          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-[var(--accent)] text-[var(--background)] font-bold text-xs hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow"
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
      <div className="flex-1 flex flex-col min-h-0 bg-[var(--background)]">
        {/* Stream Tab Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-header)] text-[11px]">
          <div className="flex items-center space-x-2">
            <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="font-semibold text-[var(--foreground)]">EXECUTION LOG STREAM</span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab("stdout")}
              className={`px-2 py-0.5 border ${
                activeTab === "stdout"
                  ? "bg-[var(--background)] border-[var(--border)] text-[var(--accent)] font-semibold"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              stdout
            </button>
            <button
              onClick={() => setActiveTab("stderr")}
              className={`px-2 py-0.5 border ${
                activeTab === "stderr"
                  ? "bg-[var(--background)] border-[var(--border)] text-[#ef4444] font-semibold"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              stderr
            </button>
          </div>
        </div>

        {/* Stream Logs Body */}
        <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed bg-[var(--background)] space-y-2">
          {/* Prominent Error Banner with RETRY MECHANISM */}
          {error && (
            <div className="p-3 bg-[#450a0a]/40 border border-[#dc2626] text-[#fca5a5] space-y-2">
              <div className="flex items-center space-x-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
                <span>[MCP ERROR] Generation halted</span>
              </div>
              <div className="text-[10px] break-all leading-normal opacity-90">{error}</div>

              {/* Dedicated RETRY Button */}
              <div className="pt-1 flex items-center justify-between">
                <span className="text-[10px] text-[#f87171]">Auto-retry failover cascade ready</span>
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={isLoading}
                  className="flex items-center space-x-1.5 px-3 py-1 bg-[#dc2626] text-[#ffffff] font-bold text-[11px] hover:bg-[#ef4444] transition-colors"
                >
                  <RotateCcw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                  <span>RETRY GENERATION</span>
                </button>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {lastResult && lastResult.success && (
            <div className="p-2.5 bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--foreground)] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Model generated: <strong>{lastResult.assetName}</strong></span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)]">{lastResult.executionTimeMs}ms</span>
            </div>
          )}

          {/* Raw stdout/stderr terminal output */}
          {activeTab === "stdout" ? (
            lastResult?.stdout ? (
              <pre className="text-[var(--text-muted)] whitespace-pre-wrap select-text">
                {lastResult.stdout}
              </pre>
            ) : (
              <div className="text-[var(--text-muted)] italic">
                // System ready. Select a preset or enter a prompt above and click GENERATE 3D.
              </div>
            )
          ) : lastResult?.stderr ? (
            <pre className="text-[#f87171] whitespace-pre-wrap select-text">
              {lastResult.stderr}
            </pre>
          ) : (
            <div className="text-[var(--text-muted)] italic">// No stderr output reported.</div>
          )}
        </div>
      </div>
    </div>
  );
}
