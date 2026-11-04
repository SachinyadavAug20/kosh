"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Download,
  Copy,
  Maximize2,
  Minimize2,
  RefreshCw,
  Image as ImageIcon,
  Check,
  Grid as GridIcon,
  Layers,
  Sparkles,
} from "lucide-react";

export interface RenderStats {
  resolution: string;
  engine: string;
  renderTimeMs: number;
  format: string;
  isTransparent: boolean;
  samples?: number;
}

export interface BlenderRenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  renderStats: RenderStats | null;
  onReRender?: () => void;
  isRendering?: boolean;
}

export function BlenderRenderModal({
  isOpen,
  onClose,
  imageUrl,
  renderStats,
  onReRender,
  isRendering = false,
}: BlenderRenderModalProps) {
  const [zoomFit, setZoomFit] = useState(true);
  const [showCheckerboard, setShowCheckerboard] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape" || e.key === "F11") {
        e.preventDefault();
        onClose();
      } else if (e.key === "F3" && imageUrl) {
        e.preventDefault();
        handleDownload();
      } else if (e.key === "F12" && onReRender && !isRendering) {
        e.preventDefault();
        onReRender();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, imageUrl, onReRender, isRendering, onClose]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    const ext = renderStats?.format?.toLowerCase() || "png";
    link.download = `kosh-render-${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || "image/png"]: blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy image data URL or link to clipboard
      try {
        await navigator.clipboard.writeText(imageUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  };

  const timeFormatted = renderStats?.renderTimeMs
    ? `${(renderStats.renderTimeMs / 1000).toFixed(2)}s`
    : "0.24s";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in font-mono select-none">
      <div className="relative flex flex-col w-[94vw] max-w-5xl h-[88vh] bg-[#141416] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden">
        {/* Top Header - Blender Render DCC Style */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#18181b] border-b border-[#27272a] text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#202024] border border-[#27272a] text-[#ea580c] font-bold text-[11px]">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>BLENDER RENDER</span>
            </div>
            <span className="text-[#a1a1aa] text-[11px]">|</span>
            <span className="text-[#f4f4f5] font-semibold text-[11px]">Render Result [Slot 1]</span>
          </div>

          {/* Stats Badges */}
          <div className="flex items-center space-x-2 text-[10px]">
            {renderStats && (
              <>
                <span className="px-2 py-0.5 rounded bg-[#202024] border border-[#27272a] text-[#a1a1aa]">
                  {renderStats.resolution}
                </span>
                <span className="px-2 py-0.5 rounded bg-[#202024] border border-[#27272a] text-[#38bdf8]">
                  {renderStats.engine}
                </span>
                <span className="px-2 py-0.5 rounded bg-[#202024] border border-[#27272a] text-[#a1a1aa]">
                  Time: {timeFormatted}
                </span>
                {renderStats.isTransparent && (
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                    Alpha PNG
                  </span>
                )}
              </>
            )}

            {/* Checkerboard toggle */}
            <button
              type="button"
              onClick={() => setShowCheckerboard(!showCheckerboard)}
              className={`p-1 rounded border transition-colors ${
                showCheckerboard
                  ? "bg-[#27272a] border-[#ea580c] text-[#ea580c]"
                  : "bg-[#202024] border-[#27272a] text-[#71717a] hover:text-white"
              }`}
              title="Toggle Transparency Checkerboard"
            >
              <GridIcon className="w-3.5 h-3.5" />
            </button>

            {/* Fit / 100% toggle */}
            <button
              type="button"
              onClick={() => setZoomFit(!zoomFit)}
              className="p-1 rounded bg-[#202024] border border-[#27272a] text-[#71717a] hover:text-white transition-colors"
              title={zoomFit ? "100% Zoom" : "Fit to Window"}
            >
              {zoomFit ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-[#71717a] hover:text-white hover:bg-[#27272a] transition-colors"
              title="Close (Esc / F11)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Render Viewport Canvas Area */}
        <div
          className={`relative flex-1 overflow-auto flex items-center justify-center p-4 select-none ${
            showCheckerboard
              ? "bg-[linear-gradient(45deg,#18181b_25%,transparent_25%),linear-gradient(-45deg,#18181b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#18181b_75%),linear-gradient(-45deg,transparent_75%,#18181b_75%)] bg-[size:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] bg-[#09090b]"
              : "bg-[#09090b]"
          }`}
        >
          {isRendering ? (
            <div className="flex flex-col items-center justify-center space-y-3 text-center">
              <div className="w-8 h-8 border-2 border-[#ea580c] border-t-transparent rounded-full animate-spin" />
              <div className="text-xs font-bold text-[#f4f4f5]">PHYSICALLY-BASED RENDERING IN PROGRESS...</div>
              <div className="text-[10px] text-[#71717a]">
                Calculating lighting bounces, ambient occlusion, and anti-aliasing
              </div>
            </div>
          ) : imageUrl ? (
            <div className="relative max-w-full max-h-full flex items-center justify-center">
              <img
                src={imageUrl}
                alt="Blender Render Result"
                className={`rounded shadow-2xl transition-all duration-150 ${
                  zoomFit ? "max-h-[calc(88vh-85px)] max-w-full object-contain" : "w-auto h-auto"
                }`}
              />
            </div>
          ) : (
            <div className="text-center text-[#71717a] text-xs space-y-2">
              <ImageIcon className="w-8 h-8 mx-auto opacity-40 text-[#71717a]" />
              <div>No render output available.</div>
              <div className="text-[10px]">Press F12 to trigger a new photorealistic render pass.</div>
            </div>
          )}
        </div>

        {/* Bottom Toolbar & Action Controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#18181b] border-t border-[#27272a] text-xs">
          <div className="flex items-center space-x-3 text-[11px] text-[#71717a]">
            <span>Blender 5.2.1 LTS DCC Render</span>
            <span>-</span>
            <span>No Viewport Overlays</span>
          </div>

          <div className="flex items-center space-x-2">
            {onReRender && (
              <button
                type="button"
                onClick={onReRender}
                disabled={isRendering}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#202024] hover:bg-[#27272a] border border-[#27272a] text-[#f4f4f5] text-[11px] font-bold transition-all disabled:opacity-50"
                title="Re-Render Frame (F12)"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#ea580c] ${isRendering ? "animate-spin" : ""}`} />
                <span>Render (F12)</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopy}
              disabled={!imageUrl || isRendering}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#202024] hover:bg-[#27272a] border border-[#27272a] text-[#f4f4f5] text-[11px] font-bold transition-all disabled:opacity-50"
              title="Copy Rendered Image to Clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!imageUrl || isRendering}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-gradient-to-r from-[#ea580c] to-[#f59e0b] hover:from-[#c2410c] hover:to-[#d97706] text-white text-[11px] font-bold shadow-md shadow-[#ea580c]/20 transition-all disabled:opacity-50 cursor-pointer"
              title="Save Image (F3)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save Image (F3)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
