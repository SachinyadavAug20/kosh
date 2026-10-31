"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Maximize2,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Check,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import {
  AnimationChannel,
  KeyframeHandle,
  FcurveInterpolation,
  createDefaultAnimationChannels,
  sampleChannel,
  addKeyframeToChannel,
  removeKeyframeFromChannel,
  updateKeyframePoint,
} from "../../lib/animation/FcurveChannel";

export interface GraphEditorCanvasProps {
  currentFrame: number;
  totalFrames?: number;
  onSeekFrame?: (frame: number) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onRewind?: () => void;
  channels?: AnimationChannel[];
  onChannelsChange?: (channels: AnimationChannel[]) => void;
}

interface DragTarget {
  channelId: string;
  keyframeId: string;
  type: "point" | "handleLeft" | "handleRight";
  initialFrame: number;
  initialValue: number;
  startMouseX: number;
  startMouseY: number;
  lockedAxis?: "x" | "y" | null;
}

export function GraphEditorCanvas({
  currentFrame,
  totalFrames = 180,
  onSeekFrame,
  isPlaying = false,
  onTogglePlay,
  onRewind,
  channels: propChannels,
  onChannelsChange,
}: GraphEditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Local state for channels if not externally controlled
  const [channels, setChannels] = useState<AnimationChannel[]>(
    propChannels || createDefaultAnimationChannels()
  );

  useEffect(() => {
    if (propChannels) {
      setChannels(propChannels);
    }
  }, [propChannels]);

  const updateChannels = (newChannels: AnimationChannel[]) => {
    setChannels(newChannels);
    onChannelsChange?.(newChannels);
  };

  const [activeChannelId, setActiveChannelId] = useState<string>(
    channels[0]?.id || "chan_cam_dolly"
  );
  const [selectedKeyframe, setSelectedKeyframe] = useState<{
    channelId: string;
    keyframeId: string;
  } | null>(null);

  // Canvas Viewport Transforms
  // world (frame, value) <-> screen (x, y)
  // screenX = (frame - viewOffsetFrame) * scaleX
  // screenY = height - (value - viewOffsetVal) * scaleY
  const [viewOffsetFrame, setViewOffsetFrame] = useState<number>(-10);
  const [viewOffsetVal, setViewOffsetVal] = useState<number>(-2);
  const [scaleX, setScaleX] = useState<number>(5.5); // px per frame
  const [scaleY, setScaleY] = useState<number>(35.0); // px per value unit

  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; offsetF: number; offsetV: number }>({
    x: 0,
    y: 0,
    offsetF: 0,
    offsetV: 0,
  });

  const dragTargetRef = useRef<DragTarget | null>(null);

  // Auto-fit framing
  const handleAutoFrame = useCallback(() => {
    const activeChan = channels.find((c) => c.id === activeChannelId);
    if (!activeChan || activeChan.keyframes.length === 0) {
      setViewOffsetFrame(-10);
      setViewOffsetVal(-2);
      setScaleX(5.5);
      setScaleY(35.0);
      return;
    }

    let minF = Infinity;
    let maxF = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;

    activeChan.keyframes.forEach((k) => {
      minF = Math.min(minF, k.frame, k.handleLeft.frame, k.handleRight.frame);
      maxF = Math.max(maxF, k.frame, k.handleLeft.frame, k.handleRight.frame);
      minV = Math.min(minV, k.value, k.handleLeft.value, k.handleRight.value);
      maxV = Math.max(maxV, k.value, k.handleLeft.value, k.handleRight.value);
    });

    const canvas = canvasRef.current;
    if (!canvas) return;

    const padF = (maxF - minF) * 0.15 || 10;
    const padV = (maxV - minV) * 0.2 || 2;

    const spanF = maxF - minF + padF * 2;
    const spanV = maxV - minV + padV * 2;

    const newScaleX = canvas.width / Math.max(spanF, 20);
    const newScaleY = canvas.height / Math.max(spanV, 4);

    setScaleX(newScaleX);
    setScaleY(newScaleY);
    setViewOffsetFrame(minF - padF);
    setViewOffsetVal(minV - padV);
  }, [channels, activeChannelId]);

  // Coordinate conversion helpers
  const frameToScreenX = (f: number) => (f - viewOffsetFrame) * scaleX;
  const valToScreenY = (v: number, h: number) => h - (v - viewOffsetVal) * scaleY;
  const screenXToFrame = (x: number) => x / scaleX + viewOffsetFrame;
  const screenYToVal = (y: number, h: number) => (h - y) / scaleY + viewOffsetVal;

  // -------------------------------------------------------------
  // Render Canvas Pass
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = "#141416";
    ctx.fillRect(0, 0, width, height);

    // 1. Grid Lines (Frames & Values)
    ctx.lineWidth = 1;

    // Frame vertical lines
    const startF = Math.floor(screenXToFrame(0));
    const endF = Math.ceil(screenXToFrame(width));
    const stepF = scaleX > 8 ? 5 : scaleX > 3 ? 10 : 30;

    for (let f = Math.floor(startF / stepF) * stepF; f <= endF; f += stepF) {
      const sx = Math.round(frameToScreenX(f)) + 0.5;
      const isMajor = f % (stepF * 2) === 0;

      ctx.strokeStyle = isMajor ? "#27272a" : "#1e1e22";
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();

      // Frame text
      if (isMajor) {
        ctx.fillStyle = "#52525b";
        ctx.font = "9px monospace";
        ctx.fillText(`${f}`, sx + 3, height - 6);
      }
    }

    // Zero frame axis
    const zeroX = Math.round(frameToScreenX(0)) + 0.5;
    ctx.strokeStyle = "#3f3f46";
    ctx.beginPath();
    ctx.moveTo(zeroX, 0);
    ctx.lineTo(zeroX, height);
    ctx.stroke();

    // Value horizontal lines
    const startV = screenYToVal(height, height);
    const endV = screenYToVal(0, height);
    const rawStepV = (endV - startV) / 8;
    const stepV = Math.pow(10, Math.floor(Math.log10(rawStepV))) || 1;

    const firstV = Math.floor(startV / stepV) * stepV;
    for (let v = firstV; v <= endV; v += stepV) {
      const sy = Math.round(valToScreenY(v, height)) + 0.5;
      const isZero = Math.abs(v) < 1e-4;

      ctx.strokeStyle = isZero ? "#52525b" : "#222226";
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();

      ctx.fillStyle = isZero ? "#ea580c" : "#52525b";
      ctx.font = "9px monospace";
      ctx.fillText(v.toFixed(1), 6, sy - 3);
    }

    // 2. Draw F-Curves
    channels.forEach((channel) => {
      if (!channel.visible) return;
      const isActive = channel.id === activeChannelId;
      const kfs = channel.keyframes;
      if (kfs.length === 0) return;

      ctx.strokeStyle = channel.color;
      ctx.lineWidth = isActive ? 2.5 : 1.2;
      ctx.globalAlpha = channel.muted ? 0.35 : 1.0;

      // Draw continuous Bézier curve
      ctx.beginPath();
      const firstX = frameToScreenX(kfs[0].frame);
      const firstY = valToScreenY(kfs[0].value, height);

      // Pre-extrapolation line
      ctx.moveTo(0, firstY);
      ctx.lineTo(firstX, firstY);

      for (let i = 0; i < kfs.length - 1; i++) {
        const k0 = kfs[i];
        const k1 = kfs[i + 1];

        const p0x = frameToScreenX(k0.frame);
        const p0y = valToScreenY(k0.value, height);
        const p1x = frameToScreenX(k0.handleRight.frame);
        const p1y = valToScreenY(k0.handleRight.value, height);
        const p2x = frameToScreenX(k1.handleLeft.frame);
        const p2y = valToScreenY(k1.handleLeft.value, height);
        const p3x = frameToScreenX(k1.frame);
        const p3y = valToScreenY(k1.value, height);

        if (k0.interpolation === "CONSTANT") {
          ctx.lineTo(p3x, p0y);
          ctx.lineTo(p3x, p3y);
        } else if (k0.interpolation === "LINEAR") {
          ctx.lineTo(p3x, p3y);
        } else {
          // Affine transformation of Bézier curve matches canvas bezierCurveTo!
          ctx.bezierCurveTo(p1x, p1y, p2x, p2y, p3x, p3y);
        }
      }

      // Post-extrapolation line
      const lastKf = kfs[kfs.length - 1];
      const lastX = frameToScreenX(lastKf.frame);
      const lastY = valToScreenY(lastKf.value, height);
      ctx.lineTo(width, lastY);
      ctx.stroke();

      // 3. Draw Handles & Keyframe Knobs (if active channel)
      if (isActive) {
        kfs.forEach((k) => {
          const kx = frameToScreenX(k.frame);
          const ky = valToScreenY(k.value, height);
          const isKfSelected =
            selectedKeyframe?.channelId === channel.id &&
            selectedKeyframe?.keyframeId === k.id;

          if (k.interpolation === "BEZIER") {
            const hlx = frameToScreenX(k.handleLeft.frame);
            const hly = valToScreenY(k.handleLeft.value, height);
            const hrx = frameToScreenX(k.handleRight.frame);
            const hry = valToScreenY(k.handleRight.value, height);

            // Handle guide lines
            ctx.strokeStyle = "#71717a";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hlx, hly);
            ctx.lineTo(kx, ky);
            ctx.lineTo(hrx, hry);
            ctx.stroke();

            // Left handle knob
            ctx.fillStyle = "#38bdf8";
            ctx.beginPath();
            ctx.arc(hlx, hly, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Right handle knob
            ctx.fillStyle = "#38bdf8";
            ctx.beginPath();
            ctx.arc(hrx, hry, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Keyframe diamond / circle
          ctx.fillStyle = isKfSelected ? "#ffffff" : channel.color;
          ctx.strokeStyle = "#09090b";
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          // Draw rotated square (diamond)
          const sz = isKfSelected ? 5.5 : 4.5;
          ctx.moveTo(kx, ky - sz);
          ctx.lineTo(kx + sz, ky);
          ctx.lineTo(kx, ky + sz);
          ctx.lineTo(kx - sz, ky);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
      }

      ctx.globalAlpha = 1.0;
    });

    // 4. Playhead Current Frame Needle
    const needleX = Math.round(frameToScreenX(currentFrame)) + 0.5;
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(needleX, 0);
    ctx.lineTo(needleX, height);
    ctx.stroke();

    // Needle frame indicator pill
    ctx.fillStyle = "#ea580c";
    ctx.fillRect(needleX - 16, 2, 32, 14);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${currentFrame}`, needleX, 12);
    ctx.textAlign = "left";
  }, [
    channels,
    activeChannelId,
    selectedKeyframe,
    currentFrame,
    viewOffsetFrame,
    viewOffsetVal,
    scaleX,
    scaleY,
  ]);

  // Handle Resize of Canvas
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // -------------------------------------------------------------
  // Mouse & Gesture Handlers: Pan, Zoom & Dragging
  // -------------------------------------------------------------
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mouseF = screenXToFrame(mouseX);
    const mouseV = screenYToVal(mouseY, canvas.height);

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;

    if (e.shiftKey) {
      // Zoom horizontal only
      const newScaleX = Math.max(0.5, Math.min(50, scaleX * zoomFactor));
      setScaleX(newScaleX);
      setViewOffsetFrame(mouseF - mouseX / newScaleX);
    } else if (e.ctrlKey || e.metaKey) {
      // Zoom vertical only
      const newScaleY = Math.max(2, Math.min(300, scaleY * zoomFactor));
      setScaleY(newScaleY);
      setViewOffsetVal(mouseV - (canvas.height - mouseY) / newScaleY);
    } else {
      // Zoom both
      const newScaleX = Math.max(0.5, Math.min(50, scaleX * zoomFactor));
      const newScaleY = Math.max(2, Math.min(300, scaleY * zoomFactor));
      setScaleX(newScaleX);
      setScaleY(newScaleY);
      setViewOffsetFrame(mouseF - mouseX / newScaleX);
      setViewOffsetVal(mouseV - (canvas.height - mouseY) / newScaleY);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Middle Mouse or Alt/Space + Click -> Pan
    if (e.button === 1 || e.altKey) {
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        offsetF: viewOffsetFrame,
        offsetV: viewOffsetVal,
      };
      return;
    }

    // Check hit test against Keyframe points or handles on the active channel
    const activeChan = channels.find((c) => c.id === activeChannelId);
    if (activeChan) {
      for (const k of activeChan.keyframes) {
        const kx = frameToScreenX(k.frame);
        const ky = valToScreenY(k.value, canvas.height);

        // Hit test Keyframe diamond (radius 8px)
        if (Math.hypot(mouseX - kx, mouseY - ky) <= 8) {
          setSelectedKeyframe({ channelId: activeChan.id, keyframeId: k.id });
          onSeekFrame?.(k.frame);

          dragTargetRef.current = {
            channelId: activeChan.id,
            keyframeId: k.id,
            type: "point",
            initialFrame: k.frame,
            initialValue: k.value,
            startMouseX: e.clientX,
            startMouseY: e.clientY,
          };
          return;
        }

        // Hit test handles if Bézier
        if (k.interpolation === "BEZIER") {
          const hlx = frameToScreenX(k.handleLeft.frame);
          const hly = valToScreenY(k.handleLeft.value, canvas.height);
          if (Math.hypot(mouseX - hlx, mouseY - hly) <= 6) {
            dragTargetRef.current = {
              channelId: activeChan.id,
              keyframeId: k.id,
              type: "handleLeft",
              initialFrame: k.handleLeft.frame,
              initialValue: k.handleLeft.value,
              startMouseX: e.clientX,
              startMouseY: e.clientY,
            };
            return;
          }

          const hrx = frameToScreenX(k.handleRight.frame);
          const hry = valToScreenY(k.handleRight.value, canvas.height);
          if (Math.hypot(mouseX - hrx, mouseY - hry) <= 6) {
            dragTargetRef.current = {
              channelId: activeChan.id,
              keyframeId: k.id,
              type: "handleRight",
              initialFrame: k.handleRight.frame,
              initialValue: k.handleRight.value,
              startMouseX: e.clientX,
              startMouseY: e.clientY,
            };
            return;
          }
        }
      }
    }

    // Clicked in empty space -> scrub timeline needle to clicked frame
    const clickedFrame = Math.round(screenXToFrame(mouseX));
    onSeekFrame?.(Math.max(0, Math.min(totalFrames, clickedFrame)));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 1. Pan handling
    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setViewOffsetFrame(panStartRef.current.offsetF - dx / scaleX);
      setViewOffsetVal(panStartRef.current.offsetV + dy / scaleY);
      return;
    }

    // 2. Dragging point or handle
    const dt = dragTargetRef.current;
    if (dt && canvasRef.current) {
      let dx = e.clientX - dt.startMouseX;
      let dy = e.clientY - dt.startMouseY;

      // Shift key axis-locking constraint
      if (e.shiftKey) {
        if (!dt.lockedAxis) {
          dt.lockedAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        }
        if (dt.lockedAxis === "x") {
          dy = 0;
        } else {
          dx = 0;
        }
      } else {
        dt.lockedAxis = null;
      }

      const dFrame = Math.round(dx / scaleX);
      const dVal = -dy / scaleY;

      const targetFrame = dt.initialFrame + dFrame;
      const targetVal = parseFloat((dt.initialValue + dVal).toFixed(3));

      const updated = channels.map((c) => {
        if (c.id !== dt.channelId) return c;
        if (dt.type === "point") {
          return updateKeyframePoint(c, dt.keyframeId, targetFrame, targetVal);
        } else {
          // Update tangent handle
          const kfs = c.keyframes.map((k) => {
            if (k.id !== dt.keyframeId) return k;
            if (dt.type === "handleLeft") {
              return {
                ...k,
                handleLeft: { frame: targetFrame, value: targetVal },
              };
            } else {
              return {
                ...k,
                handleRight: { frame: targetFrame, value: targetVal },
              };
            }
          });
          return { ...c, keyframes: kfs };
        }
      });

      updateChannels(updated);
      if (dt.type === "point") {
        onSeekFrame?.(targetFrame);
      }
    }
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
    dragTargetRef.current = null;
  };

  // -------------------------------------------------------------
  // Toolbar Actions: Add, Delete, Interpolation
  // -------------------------------------------------------------
  const handleAddKeyframeAtPlayhead = () => {
    const activeChan = channels.find((c) => c.id === activeChannelId);
    if (!activeChan) return;

    const val = sampleChannel(activeChan, currentFrame);
    const updated = channels.map((c) => {
      if (c.id !== activeChan.id) return c;
      return addKeyframeToChannel(c, currentFrame, val, "BEZIER");
    });
    updateChannels(updated);
  };

  const handleDeleteSelectedKeyframe = () => {
    if (!selectedKeyframe) return;
    const updated = channels.map((c) => {
      if (c.id !== selectedKeyframe.channelId) return c;
      return removeKeyframeFromChannel(c, selectedKeyframe.keyframeId);
    });
    updateChannels(updated);
    setSelectedKeyframe(null);
  };

  const handleChangeInterpolation = (interp: FcurveInterpolation) => {
    if (!selectedKeyframe) return;
    const updated = channels.map((c) => {
      if (c.id !== selectedKeyframe.channelId) return c;
      return {
        ...c,
        keyframes: c.keyframes.map((k) =>
          k.id === selectedKeyframe.keyframeId ? { ...k, interpolation: interp } : k
        ),
      };
    });
    updateChannels(updated);
  };

  const toggleChannelVisible = (channelId: string) => {
    const updated = channels.map((c) =>
      c.id === channelId ? { ...c, visible: !c.visible } : c
    );
    updateChannels(updated);
  };

  const toggleChannelMute = (channelId: string) => {
    const updated = channels.map((c) =>
      c.id === channelId ? { ...c, muted: !c.muted } : c
    );
    updateChannels(updated);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#18181b] select-none overflow-hidden font-mono text-xs">
      {/* 1. Header Toolbar */}
      <div className="h-7 px-2 flex items-center justify-between border-b border-[#27272a] bg-[#141416] text-[#a1a1aa] shrink-0">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-emerald-400 font-bold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-[11px] text-[#f4f4f5]">F-Curve Graph Editor</span>
          </div>

          <div className="h-3 w-px bg-[#27272a]" />

          {/* Interpolation buttons */}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => handleChangeInterpolation("BEZIER")}
              className="px-1.5 py-0.5 rounded text-[10px] bg-[#202024] hover:bg-[#27272a] text-[#f4f4f5]"
              title="Cubic Bézier Interpolation"
            >
              Bézier
            </button>
            <button
              type="button"
              onClick={() => handleChangeInterpolation("LINEAR")}
              className="px-1.5 py-0.5 rounded text-[10px] bg-[#202024] hover:bg-[#27272a] text-[#f4f4f5]"
              title="Linear Interpolation"
            >
              Linear
            </button>
            <button
              type="button"
              onClick={() => handleChangeInterpolation("CONSTANT")}
              className="px-1.5 py-0.5 rounded text-[10px] bg-[#202024] hover:bg-[#27272a] text-[#f4f4f5]"
              title="Constant Hold"
            >
              Hold
            </button>
          </div>

          <div className="h-3 w-px bg-[#27272a]" />

          {/* Keyframe Operations */}
          <button
            type="button"
            onClick={handleAddKeyframeAtPlayhead}
            className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-orange-600/20 text-[#ea580c] hover:bg-orange-600/30 text-[10px] border border-orange-500/30 font-bold"
            title="Add Keyframe at Playhead (I)"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>Keyframe</span>
          </button>

          <button
            type="button"
            onClick={handleDeleteSelectedKeyframe}
            disabled={!selectedKeyframe}
            className="p-1 rounded text-[#71717a] hover:text-red-400 disabled:opacity-30"
            title="Delete Selected Keyframe (X / Del)"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Transport Controls & View Tools */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={onRewind}
              className="p-1 rounded text-[#a1a1aa] hover:bg-[#27272a] hover:text-white"
              title="Rewind to Frame 0"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onTogglePlay}
              className={`p-1 rounded ${
                isPlaying ? "bg-orange-600 text-white" : "text-[#a1a1aa] hover:bg-[#27272a] hover:text-white"
              }`}
              title="Play / Pause (Space)"
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
          </div>

          <div className="h-3 w-px bg-[#27272a]" />

          <button
            type="button"
            onClick={handleAutoFrame}
            className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#202024] hover:bg-[#27272a] text-[10px] text-[#e4e4e7]"
            title="Frame Selected Curve (Home / Numpad .)"
          >
            <Maximize2 className="w-2.5 h-2.5 text-zinc-400" />
            <span>Frame All</span>
          </button>

          <span className="text-[10px] text-[#71717a]">
            Frame: <span className="text-white font-bold">{currentFrame}</span> / {totalFrames}
          </span>
        </div>
      </div>

      {/* 2. Main Body: Left Channel Tree + 2D Canvas */}
      <div className="flex-1 flex min-h-0">
        {/* Left Channel Sidebar */}
        <div className="w-52 border-r border-[#27272a] bg-[#141416] flex flex-col shrink-0">
          <div className="h-6 px-2 flex items-center justify-between text-[10px] text-[#71717a] border-b border-[#27272a] uppercase tracking-wider font-semibold">
            <span>F-Curve Channels</span>
            <span>{channels.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
            {channels.map((chan) => {
              const isSelected = chan.id === activeChannelId;
              const val = sampleChannel(chan, currentFrame);

              return (
                <div
                  key={chan.id}
                  onClick={() => setActiveChannelId(chan.id)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[#27272a] text-white"
                      : "text-[#a1a1aa] hover:bg-[#1f1f23] hover:text-[#f4f4f5]"
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: chan.color }}
                    />
                    <div className="truncate">
                      <div className="text-[11px] font-medium truncate">{chan.name}</div>
                      <div className="text-[9px] text-[#71717a]">{val.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 ml-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleChannelVisible(chan.id);
                      }}
                      className="p-0.5 text-[#71717a] hover:text-white"
                      title={chan.visible ? "Hide Channel" : "Show Channel"}
                    >
                      {chan.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-zinc-600" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleChannelMute(chan.id);
                      }}
                      className="p-0.5 text-[#71717a] hover:text-white"
                      title={chan.muted ? "Unmute Channel" : "Mute Channel"}
                    >
                      {chan.muted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Info Footer */}
          <div className="p-2 border-t border-[#27272a] text-[9px] text-[#71717a] space-y-1">
            <div className="flex justify-between">
              <span>Shift+Drag:</span>
              <span className="text-zinc-400">Lock X/Y Axis</span>
            </div>
            <div className="flex justify-between">
              <span>Alt+Drag:</span>
              <span className="text-zinc-400">Pan Viewport</span>
            </div>
            <div className="flex justify-between">
              <span>Wheel:</span>
              <span className="text-zinc-400">Zoom Canvas</span>
            </div>
          </div>
        </div>

        {/* Right Canvas Area */}
        <div ref={containerRef} className="flex-1 relative h-full w-full overflow-hidden">
          <canvas
            ref={canvasRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="absolute inset-0 cursor-crosshair"
          />
        </div>
      </div>
    </div>
  );
}
