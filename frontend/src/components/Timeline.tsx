"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Repeat,
  Plus,
  Layers,
  Spline,
  Sparkles,
  X,
} from "lucide-react";

export interface KeyframeMarker {
  id: string;
  frame: number;
  type: "transform" | "material" | "event";
  label?: string;
  data?: Record<string, any>;
}

export type InterpolationType = "linear" | "bezier" | "step";

export interface TimelineProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRewind: () => void;
  currentFrame: number;
  totalFrames?: number;
  onSeekFrame: (frame: number) => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  turntableMode: "loop" | "infinite";
  onToggleTurntableMode: (mode: "loop" | "infinite") => void;
  keyframes: KeyframeMarker[];
  onAddKeyframe: (frame: number) => void;
  onMoveKeyframe: (keyframeId: string, newFrame: number) => void;
  onDeleteKeyframe: (keyframeId: string) => void;
  activeObjectName?: string | null;
  interpolation: InterpolationType;
  onChangeInterpolation: (type: InterpolationType) => void;
  explodedFactor: number;
  onExplodedChange: (factor: number) => void;
}

export function Timeline({
  isOpen,
  onToggleOpen,
  isPlaying,
  onTogglePlay,
  onRewind,
  currentFrame,
  totalFrames = 120,
  onSeekFrame,
  isLooping,
  onToggleLoop,
  turntableMode,
  onToggleTurntableMode,
  keyframes,
  onAddKeyframe,
  onMoveKeyframe,
  onDeleteKeyframe,
  activeObjectName,
  interpolation,
  onChangeInterpolation,
  explodedFactor,
  onExplodedChange,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const [draggingKeyframeId, setDraggingKeyframeId] = useState<string | null>(null);
  const [isEditingFrameInput, setIsEditingFrameInput] = useState(false);
  const [frameInputValue, setFrameInputValue] = useState(currentFrame.toString());

  useEffect(() => {
    setFrameInputValue(currentFrame.toString());
  }, [currentFrame]);

  // Handle Scrubbing Click / Drag
  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".keyframe-diamond")) return;

    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const targetFrame = Math.round((relX / rect.width) * totalFrames);
    onSeekFrame(targetFrame);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!trackRef.current) return;
      const moveRect = trackRef.current.getBoundingClientRect();
      const moveX = Math.max(0, Math.min(moveRect.width, moveEvent.clientX - moveRect.left));
      const newFrame = Math.round((moveX / moveRect.width) * totalFrames);
      onSeekFrame(newFrame);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Handle Keyframe Diamond Dragging to Retime
  const handleDiamondMouseDown = (e: React.MouseEvent, kf: KeyframeMarker) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedKeyframeId(kf.id);
    onSeekFrame(kf.frame);
    setDraggingKeyframeId(kf.id);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const relX = Math.max(0, Math.min(rect.width, moveEvent.clientX - rect.left));
      const targetFrame = Math.max(0, Math.min(totalFrames, Math.round((relX / rect.width) * totalFrames)));
      onMoveKeyframe(kf.id, targetFrame);
      onSeekFrame(targetFrame);
    };

    const handleMouseUp = () => {
      setDraggingKeyframeId(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Keyboard shortcut I for Insert Keyframe
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === "i" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onAddKeyframe(currentFrame);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentFrame, onAddKeyframe]);

  if (!isOpen) return null;

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
    <div className="border-t border-[#3f3f46] bg-[#18181b] text-xs z-30 select-none font-sans transition-all duration-150">
      {/* Top Track Header Strip */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#27272a] bg-[#141416]">
        {/* Left: Per-Object Track Header & Keyframe Insert Button */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 px-1.5 py-0.5 bg-[#27272a] border border-[#3f3f46] rounded-sm text-[11px] font-mono text-[#f4f4f5]">
            <Layers className="w-3 h-3 text-[#ea580c]" />
            <span className="font-semibold text-[#f4f4f5]">
              {activeObjectName ? activeObjectName : "Scene"}
            </span>
            <span className="text-[#71717a] text-[10px]">: Keyframe Track</span>
          </div>

          <button
            type="button"
            onClick={() => onAddKeyframe(currentFrame)}
            title="Record Keyframe at current frame (Hotkey: I)"
            className="px-2 py-0.5 bg-[#ea580c] hover:bg-[#f97316] text-white font-mono text-[10px] font-semibold rounded-sm flex items-center space-x-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>+ Keyframe (I)</span>
          </button>

          {selectedKeyframeId && (
            <button
              type="button"
              onClick={() => {
                onDeleteKeyframe(selectedKeyframeId);
                setSelectedKeyframeId(null);
              }}
              title="Delete Selected Keyframe Diamond"
              className="px-1.5 py-0.5 bg-[#27272a] hover:bg-[#ef4444] text-[#a1a1aa] hover:text-white font-mono text-[10px] rounded-sm flex items-center space-x-1 transition-colors"
            >
              <X className="w-3 h-3" />
              <span>Del Key</span>
            </button>
          )}
        </div>

        {/* Center: Playback / Turntable Mode Selector */}
        <div className="flex items-center space-x-1.5 bg-[#1f1f23] p-0.5 border border-[#3f3f46] rounded-sm">
          <button
            type="button"
            onClick={() => onToggleTurntableMode("loop")}
            className={`px-2 py-0.5 text-[10px] font-mono rounded-sm transition-colors ${
              turntableMode === "loop"
                ? "bg-[#3f3f46] text-[#f4f4f5] font-semibold"
                : "text-[#71717a] hover:text-[#a1a1aa]"
            }`}
          >
            Loop Scrub (1-120f)
          </button>
          <button
            type="button"
            onClick={() => onToggleTurntableMode("infinite")}
            className={`px-2 py-0.5 text-[10px] font-mono rounded-sm flex items-center space-x-1 transition-colors ${
              turntableMode === "infinite"
                ? "bg-[#ea580c] text-white font-semibold"
                : "text-[#71717a] hover:text-[#a1a1aa]"
            }`}
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>Infinite Spin</span>
          </button>
        </div>

        {/* Right: Interpolation / Easing Curves Selector */}
        <div className="flex items-center space-x-1">
          <span className="text-[10px] text-[#71717a] font-mono uppercase">Easing:</span>
          <div className="flex items-center space-x-0.5 bg-[#1f1f23] border border-[#3f3f46] rounded-sm p-0.5 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => onChangeInterpolation("linear")}
              title="Linear: Constant angular velocity (gears/wheels)"
              className={`px-1.5 py-0.5 rounded-sm transition-colors ${
                interpolation === "linear"
                  ? "bg-[#3f3f46] text-[#f4f4f5] font-semibold"
                  : "text-[#71717a] hover:text-[#a1a1aa]"
              }`}
            >
              Linear
            </button>
            <button
              type="button"
              onClick={() => onChangeInterpolation("bezier")}
              title="Bezier: Smooth acceleration & deceleration (Ease-in/out)"
              className={`px-1.5 py-0.5 rounded-sm transition-colors flex items-center space-x-1 ${
                interpolation === "bezier"
                  ? "bg-[#ea580c] text-white font-semibold"
                  : "text-[#71717a] hover:text-[#a1a1aa]"
              }`}
            >
              <Spline className="w-2.5 h-2.5" />
              <span>Bezier</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeInterpolation("step")}
              title="Constant / Step: Sudden pose snapping"
              className={`px-1.5 py-0.5 rounded-sm transition-colors ${
                interpolation === "step"
                  ? "bg-[#3f3f46] text-[#f4f4f5] font-semibold"
                  : "text-[#71717a] hover:text-[#a1a1aa]"
              }`}
            >
              Step
            </button>
          </div>
        </div>
      </div>

      {/* Main Dope Sheet Scrubber Area */}
      <div className="px-3 py-2 flex items-center space-x-3">
        {/* Playback Controls Cluster */}
        <div className="flex items-center space-x-1 shrink-0">
          <button
            type="button"
            onClick={onTogglePlay}
            className="p-1.5 bg-[#ea580c] hover:bg-[#f97316] text-white rounded-sm transition-colors shadow-sm"
            title="Play / Pause (Space)"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          </button>
          <button
            type="button"
            onClick={onRewind}
            className="p-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#a1a1aa] hover:text-[#f4f4f5] rounded-sm transition-colors"
            title="Rewind to Frame 0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleLoop}
            title={isLooping ? "Loop Enabled" : "Loop Disabled"}
            className={`p-1.5 rounded-sm border transition-colors ${
              isLooping ? "bg-[#27272a] text-[#f4f4f5] border-[#52525b]" : "text-[#71717a] border-[#3f3f46]"
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Current Frame Indicator / Input */}
          <div className="flex items-center space-x-0.5 px-1.5 py-0.5 bg-[#1f1f23] border border-[#3f3f46] rounded-sm font-mono text-[11px] text-[#f4f4f5]">
            {isEditingFrameInput ? (
              <input
                type="number"
                min="0"
                max={totalFrames}
                value={frameInputValue}
                onChange={(e) => setFrameInputValue(e.target.value)}
                onBlur={() => {
                  setIsEditingFrameInput(false);
                  const parsed = parseInt(frameInputValue, 10);
                  if (!isNaN(parsed)) onSeekFrame(Math.max(0, Math.min(totalFrames, parsed)));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setIsEditingFrameInput(false);
                    const parsed = parseInt(frameInputValue, 10);
                    if (!isNaN(parsed)) onSeekFrame(Math.max(0, Math.min(totalFrames, parsed)));
                  }
                }}
                className="w-8 bg-transparent text-center text-[#f4f4f5] border-b border-[#ea580c] focus:outline-none"
                autoFocus
              />
            ) : (
              <span
                onClick={() => setIsEditingFrameInput(true)}
                className="cursor-pointer font-bold text-[#ea580c] hover:underline"
                title="Click to jump to frame"
              >
                {currentFrame}
              </span>
            )}
            <span className="text-[#71717a]">/{totalFrames}f</span>
          </div>
        </div>

        {/* Dope Sheet Track with Keyframe Diamonds */}
        <div className="flex-1 flex flex-col justify-center relative select-none">
          {/* Frame Number Labels Strip */}
          <div className="relative h-3 text-[9px] font-mono text-[#71717a]">
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

          {/* Interactive Dope Sheet Ruler Track */}
          <div
            ref={trackRef}
            onMouseDown={handleTrackMouseDown}
            className="relative h-6 bg-[#1f1f23] border border-[#3f3f46] rounded-sm cursor-pointer overflow-visible flex items-center"
          >
            {/* Minor Tick Marks */}
            {minorTicks.map((tick) => (
              <div
                key={tick}
                className="absolute top-0 bottom-0 w-[1px] bg-[#27272a] pointer-events-none"
                style={{ left: `${(tick / totalFrames) * 100}%` }}
              />
            ))}

            {/* Major Tick Marks */}
            {majorTicks.map((tick) => (
              <div
                key={tick}
                className="absolute top-0 bottom-0 w-[1px] bg-[#3f3f46] pointer-events-none"
                style={{ left: `${(tick / totalFrames) * 100}%` }}
              />
            ))}

            {/* Progress Fill Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-[#ea580c]/15 pointer-events-none border-r border-[#ea580c]/40"
              style={{ width: `${(currentFrame / totalFrames) * 100}%` }}
            />

            {/* Keyframe Diamond Markers (◆) */}
            {keyframes.map((kf) => {
              const leftPct = (kf.frame / totalFrames) * 100;
              const isSelected = selectedKeyframeId === kf.id || currentFrame === kf.frame;
              const isEvent = kf.type === "event";

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
                        : isEvent
                        ? "bg-[#f59e0b] border-[#78350f]"
                        : "bg-[#e4e4e7] border-[#27272a]"
                    }`}
                  />
                </div>
              );
            })}

            {/* Scrubber Needle Head */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-[#ea580c] pointer-events-none z-30 transform -translate-x-1/2"
              style={{ left: `${(currentFrame / totalFrames) * 100}%` }}
            >
              {/* Scrubber Top Diamond Pip */}
              <div className="w-2.5 h-2.5 bg-[#ea580c] rotate-45 transform -translate-x-[4px] -translate-y-[5px] shadow-sm" />
            </div>
          </div>
        </div>

        {/* Exploded View Slider */}
        <div className="flex items-center space-x-2 w-48 bg-[#1f1f23] border border-[#3f3f46] px-2 py-1 rounded-sm shrink-0">
          <span className="text-[10px] text-[#a1a1aa] font-mono whitespace-nowrap">
            EXPLODE: {(explodedFactor * 100).toFixed(0)}%
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={explodedFactor}
            onChange={(e) => onExplodedChange(parseFloat(e.target.value))}
            className="w-full accent-[#38bdf8] cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
