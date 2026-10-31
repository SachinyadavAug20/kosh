"use client";

import React, { useEffect, useState, useRef } from "react";
import { AspectRatioType, ASPECT_RATIO_CONFIGS } from "../../lib/video/VideoExportEngine";

export type FramingMode = "full" | AspectRatioType;

interface AspectRatioFramerProps {
  mode: FramingMode;
  showGuides?: boolean;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const AspectRatioFramer: React.FC<AspectRatioFramerProps> = ({
  mode,
  showGuides = true,
  containerRef,
}) => {
  const [bounds, setBounds] = useState<{ width: number; height: number; left: number; top: number }>({
    width: 0,
    height: 0,
    left: 0,
    top: 0,
  });

  useEffect(() => {
    if (mode === "full") return;

    const updateBounds = () => {
      const container = containerRef?.current || document.body;
      const cW = container.clientWidth;
      const cH = container.clientHeight;

      if (!cW || !cH) return;

      let targetAspect = 16 / 9;
      if (mode === "9:16") targetAspect = 9 / 16;
      else if (mode === "1:1") targetAspect = 1;
      else if (mode === "2.39:1") targetAspect = 2.39 / 1;
      else if (mode === "4:3") targetAspect = 4 / 3;

      const containerAspect = cW / cH;

      let frameW = cW;
      let frameH = cH;

      if (containerAspect > targetAspect) {
        // Container is wider than target aspect -> pillarbox (black bars on left/right)
        frameH = cH;
        frameW = cH * targetAspect;
      } else {
        // Container is taller than target aspect -> letterbox (black bars on top/bottom)
        frameW = cW;
        frameH = cW / targetAspect;
      }

      const left = (cW - frameW) / 2;
      const top = (cH - frameH) / 2;

      setBounds({ width: frameW, height: frameH, left, top });
    };

    updateBounds();
    window.addEventListener("resize", updateBounds);
    return () => window.removeEventListener("resize", updateBounds);
  }, [mode, containerRef]);

  if (mode === "full") return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden select-none">
      {/* Matte Letterbox Bars (Top, Bottom, Left, Right) */}
      <div
        className="absolute bg-black/85 transition-all duration-150"
        style={{ top: 0, left: 0, right: 0, height: `${bounds.top}px` }}
      />
      <div
        className="absolute bg-black/85 transition-all duration-150"
        style={{ bottom: 0, left: 0, right: 0, height: `${bounds.top}px` }}
      />
      <div
        className="absolute bg-black/85 transition-all duration-150"
        style={{
          top: `${bounds.top}px`,
          bottom: `${bounds.top}px`,
          left: 0,
          width: `${bounds.left}px`,
        }}
      />
      <div
        className="absolute bg-black/85 transition-all duration-150"
        style={{
          top: `${bounds.top}px`,
          bottom: `${bounds.top}px`,
          right: 0,
          width: `${bounds.left}px`,
        }}
      />

      {/* Active Framing Box */}
      <div
        className="absolute border border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.15)] transition-all duration-150"
        style={{
          left: `${bounds.left}px`,
          top: `${bounds.top}px`,
          width: `${bounds.width}px`,
          height: `${bounds.height}px`,
        }}
      >
        {/* Aspect Ratio Badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-950/80 border border-zinc-800 text-[10px] font-mono text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span>{mode}</span>
          <span className="text-zinc-500">|</span>
          <span className="text-zinc-400">
            {ASPECT_RATIO_CONFIGS[mode as AspectRatioType]["1080p"].label.split(" ")[0]}
          </span>
        </div>

        {/* Rule of Thirds Grid Guides */}
        {showGuides && (
          <div className="absolute inset-0 pointer-events-none opacity-30">
            {/* Vertical grid lines */}
            <div className="absolute top-0 bottom-0 left-1/3 border-r border-dashed border-zinc-300/60" />
            <div className="absolute top-0 bottom-0 left-2/3 border-r border-dashed border-zinc-300/60" />
            {/* Horizontal grid lines */}
            <div className="absolute left-0 right-0 top-1/3 border-b border-dashed border-zinc-300/60" />
            <div className="absolute left-0 right-0 top-2/3 border-b border-dashed border-zinc-300/60" />
          </div>
        )}
      </div>
    </div>
  );
};
