"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Repeat,
  Plus,
  Layers,
  Sparkles,
  X,
  ChevronUp,
  ChevronDown,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Circle,
  Box,
  Compass,
} from "lucide-react";
import { KeyframeMarker, InterpolationType } from "./Timeline";
import { AudioVisualizerTrack } from "./timeline/AudioVisualizerTrack";
import { AudioVisemeSynthesizer, VisemeFrame } from "../lib/audio/AudioVisemeSynthesizer";

export interface BlenderTimelineProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRewind: () => void;
  currentFrame: number;
  totalFrames?: number;
  startFrame?: number;
  endFrame?: number;
  onSeekFrame: (frame: number) => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  turntableMode: "loop" | "infinite";
  onToggleTurntableMode: (mode: "loop" | "infinite") => void;
  keyframes: KeyframeMarker[];
  onAddKeyframe: (frame: number, channel?: "loc" | "rot" | "scale" | "all") => void;
  onMoveKeyframe: (keyframeId: string, newFrame: number) => void;
  onDeleteKeyframe: (keyframeId: string) => void;
  activeObjectName?: string | null;
  interpolation: InterpolationType;
  onChangeInterpolation: (type: InterpolationType) => void;
  explodedFactor: number;
  onExplodedChange: (factor: number) => void;
  audioSynthesizer?: AudioVisemeSynthesizer;
  onAudioFramesUpdated?: (frames: VisemeFrame[]) => void;
}

export function BlenderTimeline({
  isOpen,
  onToggleOpen,
  isPlaying,
  onTogglePlay,
  onRewind,
  currentFrame,
  totalFrames = 250,
  startFrame = 0,
  endFrame = 250,
  onSeekFrame,
  isLooping,
  onToggleLoop,
  turntableMode,
  onToggleTurntableMode,
  keyframes = [],
  onAddKeyframe,
  onMoveKeyframe,
  onDeleteKeyframe,
  activeObjectName,
  interpolation,
  onChangeInterpolation,
  explodedFactor,
  onExplodedChange,
  audioSynthesizer,
  onAudioFramesUpdated,
}: BlenderTimelineProps) {
  const localSynthesizerRef = useRef<AudioVisemeSynthesizer | null>(null);
  if (!localSynthesizerRef.current) {
    localSynthesizerRef.current = new AudioVisemeSynthesizer();
  }
  const synth = audioSynthesizer || localSynthesizerRef.current;

  const trackRef = useRef<HTMLDivElement | null>(null);
  const needleRef = useRef<HTMLDivElement | null>(null);

  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const [isEditingFrameInput, setIsEditingFrameInput] = useState(false);
  const [frameInputValue, setFrameInputValue] = useState(currentFrame.toString());
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [isAutoKey, setIsAutoKey] = useState(false);
  const [isReversePlaying, setIsReversePlaying] = useState(false);
  const [isInsertMenuOpen, setIsInsertMenuOpen] = useState(false);

  useEffect(() => {
    setFrameInputValue(currentFrame.toString());
    // Direct needle position DOM update for 60fps performance
    if (needleRef.current && totalFrames > 0) {
      const pct = (currentFrame / totalFrames) * 100;
      needleRef.current.style.left = `${pct}%`;
    }
  }, [currentFrame, totalFrames]);

  // Scrubbing with mouse drag
  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".keyframe-diamond")) return;
    if (!trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const targetFrame = Math.round((relX / rect.width) * totalFrames);
    onSeekFrame(targetFrame);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!trackRef.current) return;
      const moveX = Math.max(0, Math.min(rect.width, moveEvent.clientX - rect.left));
      const newFrame = Math.round((moveX / rect.width) * totalFrames);
      onSeekFrame(newFrame);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Dragging keyframe diamond to retime
  const handleDiamondMouseDown = (e: React.MouseEvent, kf: KeyframeMarker) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedKeyframeId(kf.id);
    onSeekFrame(kf.frame);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const relX = Math.max(0, Math.min(rect.width, moveEvent.clientX - rect.left));
      const targetFrame = Math.max(startFrame, Math.min(endFrame, Math.round((relX / rect.width) * totalFrames)));
      onMoveKeyframe(kf.id, targetFrame);
      onSeekFrame(targetFrame);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Global Timeline Keyboard Shortcuts: Space, I, Left/Right Arrows, Shift+Left/Right
  useEffect(() => {
    const handleTimelineKeys = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Space -> Toggle Play
      if (e.key === " ") {
        e.preventDefault();
        onTogglePlay();
        return;
      }

      // I -> Insert Keyframe Menu
      if (e.key.toLowerCase() === "i" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setIsInsertMenuOpen((prev) => !prev);
        return;
      }

      // Left Arrow -> Step 1 Frame Back
      if (e.key === "ArrowLeft" && !e.shiftKey) {
        e.preventDefault();
        onSeekFrame(Math.max(startFrame, currentFrame - 1));
        return;
      }

      // Right Arrow -> Step 1 Frame Forward
      if (e.key === "ArrowRight" && !e.shiftKey) {
        e.preventDefault();
        onSeekFrame(Math.min(endFrame, currentFrame + 1));
        return;
      }

      // Shift + Left -> Jump to Start
      if (e.key === "ArrowLeft" && e.shiftKey) {
        e.preventDefault();
        onSeekFrame(startFrame);
        return;
      }

      // Shift + Right -> Jump to End
      if (e.key === "ArrowRight" && e.shiftKey) {
        e.preventDefault();
        onSeekFrame(endFrame);
        return;
      }
    };

    window.addEventListener("keydown", handleTimelineKeys);
    return () => window.removeEventListener("keydown", handleTimelineKeys);
  }, [currentFrame, startFrame, endFrame, onSeekFrame, onTogglePlay]);

  // Major ticks every 30 frames, minor ticks every 10 frames
  const majorTicks = [];
  for (let f = 0; f <= totalFrames; f += 30) {
    majorTicks.push(f);
  }
  const minorTicks = [];
  for (let f = 0; f <= totalFrames; f += 10) {
    if (f % 30 !== 0) minorTicks.push(f);
  }

  return (
    <div className="w-full bg-[#18181b] border-t border-[#27272a] shadow-2xl flex flex-col z-20 pointer-events-auto select-none font-sans text-xs text-[#f4f4f5]">
      {/* 1. Blender Standard Transport Header Bar (28px) */}
      <div className="h-7 px-3 flex items-center justify-between border-b border-[#27272a] bg-[#141416]/95">
        {/* Left: Playback Controls & Frame Indicators */}
        <div className="flex items-center space-x-1 shrink-0">
          {/* Jump to Start |◀ */}
          <button
            type="button"
            onClick={() => onSeekFrame(startFrame)}
            className="w-5 h-5 flex items-center justify-center hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] rounded transition-colors"
            title="Jump to Start Frame (Shift + Left Arrow)"
          >
            <SkipBack className="w-3 h-3" />
          </button>

          {/* Step Back 1 Frame ◀ */}
          <button
            type="button"
            onClick={() => onSeekFrame(Math.max(startFrame, currentFrame - 1))}
            className="w-5 h-5 flex items-center justify-center hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] rounded transition-colors"
            title="Step 1 Frame Back (Left Arrow)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Reverse Play ◀◀ */}
          <button
            type="button"
            onClick={() => setIsReversePlaying(!isReversePlaying)}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              isReversePlaying ? "bg-[#ea580c] text-white" : "hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5]"
            }`}
            title="Reverse Playback"
          >
            <Play className="w-2.5 h-2.5 transform rotate-180 fill-current" />
          </button>

          {/* Play / Pause ▶ / ⏸ */}
          <button
            type="button"
            onClick={onTogglePlay}
            className={`w-6 h-5 flex items-center justify-center rounded transition-colors ${
              isPlaying ? "bg-[#ea580c] text-white" : "bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5]"
            }`}
            title="Play / Pause Animation (Spacebar)"
          >
            {isPlaying ? (
              <Pause className="w-2.5 h-2.5 fill-current" />
            ) : (
              <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
            )}
          </button>

          {/* Step Forward 1 Frame ▶ */}
          <button
            type="button"
            onClick={() => onSeekFrame(Math.min(endFrame, currentFrame + 1))}
            className="w-5 h-5 flex items-center justify-center hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] rounded transition-colors"
            title="Step 1 Frame Forward (Right Arrow)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Jump to End ▶| */}
          <button
            type="button"
            onClick={() => onSeekFrame(endFrame)}
            className="w-5 h-5 flex items-center justify-center hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] rounded transition-colors"
            title="Jump to End Frame (Shift + Right Arrow)"
          >
            <SkipForward className="w-3 h-3" />
          </button>

          {/* Loop Toggle */}
          <button
            type="button"
            onClick={onToggleLoop}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              isLooping ? "text-[#ea580c]" : "text-[#52525b] hover:text-[#a1a1aa]"
            }`}
            title={isLooping ? "Loop Enabled" : "Loop Disabled"}
          >
            <Repeat className="w-3 h-3" />
          </button>

          {/* Auto-Keyframe Toggle */}
          <button
            type="button"
            onClick={() => setIsAutoKey(!isAutoKey)}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              isAutoKey ? "text-red-500 animate-pulse" : "text-[#52525b] hover:text-[#a1a1aa]"
            }`}
            title={isAutoKey ? "Auto-Keying ON (Records transforms)" : "Auto-Keying OFF"}
          >
            <Circle className="w-2.5 h-2.5 fill-current" />
          </button>

          {/* Frame Range Pills (Start, Current, End) */}
          <div className="flex items-center space-x-1 pl-1">
            <div className="px-1.5 py-0.5 bg-[#202024] border border-[#27272a] rounded font-mono text-[10px] text-[#71717a]">
              Start: {startFrame}
            </div>

            {/* Current Frame Pill */}
            <div className="flex items-center px-1.5 py-0.5 bg-[#202024] border border-[#27272a] rounded font-mono text-[10px] space-x-0.5">
              {isEditingFrameInput ? (
                <input
                  type="number"
                  min={startFrame}
                  max={endFrame}
                  value={frameInputValue}
                  onChange={(e) => setFrameInputValue(e.target.value)}
                  onBlur={() => {
                    setIsEditingFrameInput(false);
                    const parsed = parseInt(frameInputValue, 10);
                    if (!isNaN(parsed)) onSeekFrame(Math.max(startFrame, Math.min(endFrame, parsed)));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setIsEditingFrameInput(false);
                      const parsed = parseInt(frameInputValue, 10);
                      if (!isNaN(parsed)) onSeekFrame(Math.max(startFrame, Math.min(endFrame, parsed)));
                    }
                  }}
                  className="w-8 bg-transparent text-center text-[#ea580c] border-b border-[#ea580c] focus:outline-none"
                  autoFocus
                />
              ) : (
                <span
                  onClick={() => setIsEditingFrameInput(true)}
                  className="cursor-pointer font-bold text-[#ea580c] hover:underline"
                  title="Click to jump directly to frame"
                >
                  {currentFrame}
                </span>
              )}
            </div>

            <div className="px-1.5 py-0.5 bg-[#202024] border border-[#27272a] rounded font-mono text-[10px] text-[#71717a]">
              End: {endFrame}
            </div>

            {/* FPS Selector (24 / 30 / 60) */}
            <button
              type="button"
              onClick={() => setFps(fps === 24 ? 30 : fps === 30 ? 60 : 24)}
              className="px-1.5 py-0.5 bg-[#202024] hover:bg-[#27272a] border border-[#27272a] rounded font-mono text-[10px] text-[#a1a1aa] hover:text-white transition-colors"
              title="Toggle Framerate"
            >
              {fps} FPS
            </button>
          </div>
        </div>

        {/* Center: Active Object & Easing Curves */}
        <div className="flex items-center space-x-2">
          {activeObjectName && (
            <div className="hidden sm:flex items-center space-x-1 font-mono text-[10px] text-[#71717a]">
              <Box className="w-2.5 h-2.5 text-[#ea580c]" />
              <span className="truncate max-w-[120px] text-[#f4f4f5]">{activeObjectName}</span>
            </div>
          )}

          {/* Turntable Infinite Spin */}
          <button
            type="button"
            onClick={() => onToggleTurntableMode(turntableMode === "infinite" ? "loop" : "infinite")}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center space-x-1 transition-colors ${
              turntableMode === "infinite"
                ? "bg-[#ea580c] text-white font-bold"
                : "bg-[#202024] text-[#a1a1aa] hover:text-[#f4f4f5]"
            }`}
            title="Toggle 360° Continuous Turntable Rotation"
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>Turntable</span>
          </button>

          {/* Interpolation / Easing Curves */}
          <div className="hidden md:flex items-center bg-[#202024] border border-[#27272a] rounded p-0.5 text-[9px] font-mono">
            {(["linear", "bezier", "step"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onChangeInterpolation(mode)}
                className={`px-1.5 py-0.5 rounded capitalize transition-colors ${
                  interpolation === mode
                    ? "bg-[#333338] text-white font-bold"
                    : "text-[#71717a] hover:text-[#a1a1aa]"
                }`}
                title={`Interpolation: ${mode}`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Exploded View & Dope Sheet Toggle */}
        <div className="flex items-center space-x-2">
          {/* Exploded View Slider */}
          <div className="flex items-center space-x-1.5 font-mono text-[10px] text-[#71717a]">
            <span>Explode</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={explodedFactor}
              onChange={(e) => onExplodedChange(parseFloat(e.target.value))}
              className="w-16 sm:w-20 accent-[#ea580c] h-1 bg-[#27272a] rounded cursor-pointer"
              title={`Exploded View: ${Math.round(explodedFactor * 100)}%`}
            />
            <span className="w-6 text-right text-[#f4f4f5]">
              {Math.round(explodedFactor * 100)}%
            </span>
          </div>

          {/* Dope Sheet Expand / Collapse Chevron */}
          <button
            type="button"
            onClick={onToggleOpen}
            className={`w-6 h-5 flex items-center justify-center rounded border transition-colors ${
              isOpen
                ? "bg-[#ea580c] border-[#ea580c] text-white"
                : "bg-[#202024] border-[#27272a] text-[#71717a] hover:text-[#f4f4f5]"
            }`}
            title={isOpen ? "Collapse Dope Sheet Timeline" : "Expand Dope Sheet Keyframes"}
          >
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* 2. Expanded Dope Sheet Keyframe Track (When isOpen is true) */}
      {isOpen && (
        <div className="p-2 space-y-1.5 bg-[#18181b]/98 animate-in slide-in-from-bottom-2 duration-150 relative">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#71717a] px-1">
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-wider">DOPE SHEET</span>

              {/* Insert Keyframe Button with Channel Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsInsertMenuOpen(!isInsertMenuOpen)}
                  className="px-1.5 py-0.5 bg-[#ea580c] hover:bg-[#f97316] text-white rounded text-[9px] font-bold flex items-center space-x-0.5 transition-colors"
                  title="Insert Keyframe Menu (Hotkey: I)"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>+ Keyframe (I)</span>
                </button>

                {isInsertMenuOpen && (
                  <div className="absolute left-0 bottom-6 w-36 bg-[#18181b] border border-[#3f3f46] rounded shadow-2xl p-1 z-50 text-[10px] space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        onAddKeyframe(currentFrame, "all");
                        setIsInsertMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 hover:bg-[#27272a] rounded text-[#f4f4f5]"
                    >
                      LocRotScale (All)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAddKeyframe(currentFrame, "loc");
                        setIsInsertMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 hover:bg-[#27272a] rounded text-[#f4f4f5]"
                    >
                      Location Only
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAddKeyframe(currentFrame, "rot");
                        setIsInsertMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 hover:bg-[#27272a] rounded text-[#f4f4f5]"
                    >
                      Rotation Only
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAddKeyframe(currentFrame, "scale");
                        setIsInsertMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 hover:bg-[#27272a] rounded text-[#f4f4f5]"
                    >
                      Scale Only
                    </button>
                  </div>
                )}
              </div>

              {selectedKeyframeId && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteKeyframe(selectedKeyframeId);
                    setSelectedKeyframeId(null);
                  }}
                  className="px-1.5 py-0.5 bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white rounded text-[9px] flex items-center space-x-0.5 transition-colors"
                  title="Delete Selected Keyframe Diamond"
                >
                  <X className="w-2.5 h-2.5" />
                  <span>Del Key</span>
                </button>
              )}
            </div>

            <div className="text-[9px] text-[#52525b] hidden sm:block">
              Click ruler to scrub • Drag diamond ◆ to retime • Space to play
            </div>
          </div>

          {/* Dope Sheet Ruler Track */}
          <div className="relative pt-3 pb-1 select-none">
            {/* Ticks Numbers */}
            <div className="relative h-2 text-[8px] font-mono text-[#52525b]">
              {majorTicks.map((tick) => (
                <span
                  key={tick}
                  className="absolute transform -translate-x-1/2"
                  style={{ left: `${(tick / totalFrames) * 100}%` }}
                >
                  {tick}
                </span>
              ))}
            </div>

            {/* Interactive Scrubber Bar */}
            <div
              ref={trackRef}
              onMouseDown={handleTrackMouseDown}
              className="relative h-5 bg-[#141416] border border-[#27272a] rounded cursor-pointer overflow-visible flex items-center"
            >
              {/* Minor Tick Marks */}
              {minorTicks.map((tick) => (
                <div
                  key={tick}
                  className="absolute top-0 bottom-0 w-[1px] bg-[#202024] pointer-events-none"
                  style={{ left: `${(tick / totalFrames) * 100}%` }}
                />
              ))}

              {/* Major Tick Marks */}
              {majorTicks.map((tick) => (
                <div
                  key={tick}
                  className="absolute top-0 bottom-0 w-[1px] bg-[#27272a] pointer-events-none"
                  style={{ left: `${(tick / totalFrames) * 100}%` }}
                />
              ))}

              {/* Progress Fill Bar */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-[#ea580c]/15 pointer-events-none border-r border-[#ea580c]/50"
                style={{ width: `${(currentFrame / totalFrames) * 100}%` }}
              />

              {/* Keyframe Diamond Markers (◆) */}
              {keyframes.map((kf) => {
                const leftPct = (kf.frame / totalFrames) * 100;
                const isSelected = selectedKeyframeId === kf.id || currentFrame === kf.frame;

                return (
                  <div
                    key={kf.id}
                    onMouseDown={(e) => handleDiamondMouseDown(e, kf)}
                    title={`Keyframe at frame ${kf.frame}${kf.label ? `: ${kf.label}` : ""} (Drag to retime)`}
                    className="keyframe-diamond absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 cursor-grab active:cursor-grabbing p-1 group"
                    style={{ left: `${leftPct}%` }}
                  >
                    <div
                      className={`w-2.5 h-2.5 rotate-45 transform transition-transform group-hover:scale-125 border ${
                        isSelected
                          ? "bg-[#ea580c] border-white shadow-sm ring-1 ring-[#ea580c]"
                          : "bg-[#f4f4f5] border-[#27272a]"
                      }`}
                    />
                  </div>
                );
              })}

              {/* Scrubber Needle Head with direct ref */}
              <div
                ref={needleRef}
                className="absolute top-0 bottom-0 w-[2px] bg-[#ea580c] pointer-events-none z-30 transform -translate-x-1/2 transition-none"
                style={{ left: `${(currentFrame / totalFrames) * 100}%` }}
              >
                <div className="w-2.5 h-2.5 bg-[#ea580c] rotate-45 transform -translate-x-[4px] -translate-y-[5px] shadow-sm" />
              </div>
            </div>
          </div>

          {/* Narration Lip-Sync Audio Track */}
          <AudioVisualizerTrack
            currentFrame={currentFrame}
            totalFrames={totalFrames}
            fps={fps}
            synthesizer={synth}
            onFramesUpdated={onAudioFramesUpdated}
            onSeekFrame={onSeekFrame}
          />
        </div>
      )}
    </div>
  );
}
