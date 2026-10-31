"use client";

import React, { useState } from "react";
import { FramingMode } from "./AspectRatioFramer";
import { AspectRatioType } from "../../lib/video/VideoExportEngine";
import { PRESET_STORYBOARDS } from "../../lib/narrative/NarrativePromptParser";

interface DirectorPromptBarProps {
  onGenerate: (prompt: string) => void;
  framingMode: FramingMode;
  onSetFramingMode: (mode: FramingMode) => void;
  onOpenExportModal: () => void;
  hasActiveScene: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentFrame: number;
  totalFrames: number;
  onScrubFrame: (frame: number) => void;
  onResetScene: () => void;
  isGenerating?: boolean;
}

export const DirectorPromptBar: React.FC<DirectorPromptBarProps> = ({
  onGenerate,
  framingMode,
  onSetFramingMode,
  onOpenExportModal,
  hasActiveScene,
  isPlaying,
  onTogglePlay,
  currentFrame,
  totalFrames,
  onScrubFrame,
  onResetScene,
  isGenerating = false,
}) => {
  const [prompt, setPrompt] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt.trim());
  };

  const handleSelectPreset = (presetKey: string) => {
    const preset = PRESET_STORYBOARDS[presetKey];
    if (preset && preset.prompt) {
      setPrompt(preset.prompt);
      onGenerate(preset.prompt);
    }
  };

  const cycleFramingMode = () => {
    const modes: FramingMode[] = ["full", "16:9", "9:16", "1:1", "2.39:1", "4:3"];
    const currentIndex = modes.indexOf(framingMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    onSetFramingMode(modes[nextIndex]);
  };

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-4xl transition-all duration-200">
      <div className="rounded-xl border border-zinc-800 bg-[#141416]/92 backdrop-blur-md shadow-2xl p-2.5 space-y-2">
        {/* Main Row: Input + Action buttons */}
        <div className="flex items-center gap-2">
          {/* Director Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-600/15 border border-orange-500/30 text-orange-400 font-mono text-xs font-semibold select-none">
            <span>🎬</span>
            <span className="hidden sm:inline">DIRECTOR</span>
          </div>

          {/* Form input */}
          <form onSubmit={handleSubmit} className="flex-1 flex items-center relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe a 3D scene (e.g. 'A traveler walking towards a warm cabin at sunset')..."
              className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition shadow-inner font-sans"
              disabled={isGenerating}
            />
          </form>

          {/* Generate Button */}
          <button
            onClick={() => handleSubmit()}
            disabled={!prompt.trim() || isGenerating}
            className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin text-xs">⟳</span>
                <span className="hidden sm:inline">Synthesizing...</span>
              </>
            ) : (
              <>
                <span>🪄</span>
                <span>Generate</span>
              </>
            )}
          </button>

          {/* Framing Mode Toggle */}
          <button
            onClick={cycleFramingMode}
            title="Cycle Aspect Ratio Framing (Full, 16:9, 9:16, 1:1, 4:3)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:text-white hover:border-zinc-700 text-xs font-mono transition shrink-0"
          >
            <span>📐</span>
            <span className="uppercase font-semibold">{framingMode}</span>
          </button>

          {/* Export Video Trigger */}
          {hasActiveScene && (
            <button
              onClick={onOpenExportModal}
              title="Export Deterministic Video Clip"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-600/50 bg-amber-600/15 text-amber-300 hover:bg-amber-600/25 text-xs font-semibold shadow-sm transition shrink-0"
            >
              <span>🎥</span>
              <span className="hidden sm:inline">Export Video</span>
            </button>
          )}

          {/* Collapse/Expand toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition text-xs"
            title={isExpanded ? "Collapse presets" : "Expand presets"}
          >
            {isExpanded ? "▲" : "▼"}
          </button>
        </div>

        {/* Storyboard Presets Row */}
        {isExpanded && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/60 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
              <span className="text-zinc-500 font-mono select-none mr-1">Presets:</span>
              <button
                onClick={() => handleSelectPreset("sunset_cabin")}
                className="px-2 py-0.5 rounded-md border border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-orange-500/50 hover:text-orange-300 transition whitespace-nowrap"
              >
                🌅 Sunset Cabin
              </button>
              <button
                onClick={() => handleSelectPreset("starry_ruins")}
                className="px-2 py-0.5 rounded-md border border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-indigo-500/50 hover:text-indigo-300 transition whitespace-nowrap"
              >
                🌌 Starry Ruins
              </button>
              <button
                onClick={() => handleSelectPreset("misty_street")}
                className="px-2 py-0.5 rounded-md border border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-slate-500/50 hover:text-slate-200 transition whitespace-nowrap"
              >
                🌫️ Misty Street
              </button>
              <button
                onClick={() => handleSelectPreset("robot_desert")}
                className="px-2 py-0.5 rounded-md border border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-amber-500/50 hover:text-amber-300 transition whitespace-nowrap"
              >
                🤖 Desert Robot
              </button>
            </div>

            {hasActiveScene && (
              <button
                onClick={onResetScene}
                className="text-zinc-500 hover:text-red-400 text-[11px] font-mono transition shrink-0 ml-2"
                title="Clear narrative scene"
              >
                Reset Scene
              </button>
            )}
          </div>
        )}

        {/* Narrative Playback & Scrub Bar (When Scene is Active) */}
        {hasActiveScene && (
          <div className="flex items-center gap-3 pt-1.5 border-t border-zinc-800/60">
            <button
              onClick={onTogglePlay}
              className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-xs text-zinc-100 transition shadow-sm"
              title={isPlaying ? "Pause Timeline" : "Play Timeline"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            {/* Scrub Slider */}
            <div className="flex-1 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={Math.max(totalFrames - 1, 1)}
                value={currentFrame}
                onChange={(e) => onScrubFrame(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <span className="text-[11px] font-mono text-zinc-400 shrink-0 min-w-[70px] text-right">
                {currentFrame} / {totalFrames}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
