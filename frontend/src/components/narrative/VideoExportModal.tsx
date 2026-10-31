"use client";

import React, { useState, useRef } from "react";
import * as THREE from "three";
import {
  VideoExportEngine,
  AspectRatioType,
  ASPECT_RATIO_CONFIGS,
  ExportProgress,
} from "../../lib/video/VideoExportEngine";
import { LowPolyCharacter } from "../../lib/narrative/LowPolyCharacterRig";
import { DirectorCameraRig } from "../../lib/narrative/DirectorCameraRig";
import { NarrativeSceneDescriptor } from "../../lib/narrative/NarrativeSceneSchema";

interface VideoExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneDescriptor: NarrativeSceneDescriptor | null;
  scene: THREE.Scene | null;
  character: LowPolyCharacter | null;
  cameraRig: DirectorCameraRig | null;
}

export const VideoExportModal: React.FC<VideoExportModalProps> = ({
  isOpen,
  onClose,
  sceneDescriptor,
  scene,
  character,
  cameraRig,
}) => {
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>("16:9");
  const [quality, setQuality] = useState<"720p" | "1080p">("720p");
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [preferredFormat, setPreferredFormat] = useState<"mp4" | "webm">("mp4");
  const [exportedFormat, setExportedFormat] = useState<"mp4" | "webm">("mp4");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  const totalFrames = sceneDescriptor?.meta?.durationFrames || sceneDescriptor?.durationFrames || 180;

  const handleStartExport = async () => {
    if (!scene || !cameraRig) {
      setErrorMessage("3D Scene or Camera Rig is not initialized.");
      return;
    }

    setErrorMessage(null);
    setVideoBlobUrl(null);
    setIsExporting(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const result = await VideoExportEngine.renderAnimationToVideo({
        aspectRatio,
        quality,
        fps,
        totalFrames,
        scene,
        character,
        cameraRig,
        preferredFormat,
        onProgress: (p) => setProgress(p),
        signal: abortController.signal,
      });

      setExportedFormat(result.format);
      const url = URL.createObjectURL(result.blob);
      setVideoBlobUrl(url);
      setIsExporting(false);
    } catch (err: any) {
      if (err.message !== "Video export cancelled by user") {
        setErrorMessage(err.message || "Failed to render video.");
      }
      setIsExporting(false);
    }
  };

  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsExporting(false);
  };

  const handleDownload = () => {
    if (!videoBlobUrl) return;
    const a = document.createElement("a");
    a.href = videoBlobUrl;
    const cleanTitle = (sceneDescriptor?.meta?.title || sceneDescriptor?.title || "kosh_animation")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");
    a.download = `${cleanTitle}_${aspectRatio.replace(":", "x")}_${quality}.${exportedFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-xl border border-zinc-800 bg-[#141416] text-zinc-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4 bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 text-sm">
              🎬
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-zinc-100">
                Narrative Video Renderer
              </h2>
              <p className="text-xs text-zinc-400">
                Deterministic WebCodecs / MP4 Muxer frame-by-frame engine (Zero frame drops)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800/60 transition disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Scene Summary */}
          {sceneDescriptor && (
            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs space-y-1">
              <div className="flex justify-between items-center text-zinc-300 font-medium">
                <span>{sceneDescriptor.meta?.title || sceneDescriptor.title}</span>
                <span className="text-[11px] font-mono text-orange-400">
                  {totalFrames} frames ({Math.round(totalFrames / fps)}s)
                </span>
              </div>
              <p className="text-zinc-400 italic line-clamp-2">
                &ldquo;{sceneDescriptor.prompt || sceneDescriptor.meta?.title}&rdquo;
              </p>
            </div>
          )}

          {/* Settings Section (When not rendering or previewing) */}
          {!isExporting && !videoBlobUrl && (
            <div className="space-y-4">
              {/* Aspect Ratio Options */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-2">
                  Target Aspect Ratio
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(["16:9", "9:16", "1:1", "2.39:1", "4:3"] as AspectRatioType[]).map((ar) => (
                    <button
                      key={ar}
                      onClick={() => setAspectRatio(ar)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-mono transition-all ${
                        aspectRatio === ar
                          ? "border-orange-500 bg-orange-500/10 text-orange-300 font-semibold shadow-[0_0_12px_rgba(234,88,12,0.15)]"
                          : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <span className="text-xs font-bold">{ar}</span>
                      <span className="text-[9px] text-zinc-500 mt-1 whitespace-nowrap">
                        {ar === "16:9"
                          ? "Landscape"
                          : ar === "9:16"
                          ? "TikTok"
                          : ar === "1:1"
                          ? "Square"
                          : ar === "2.39:1"
                          ? "Cinema"
                          : "Classic"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Format & Quality Selection */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Container Format
                  </label>
                  <div className="flex gap-2">
                    {(["mp4", "webm"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setPreferredFormat(fmt)}
                        className={`flex-1 py-2 px-2 rounded-lg border text-xs font-mono uppercase transition ${
                          preferredFormat === fmt
                            ? "border-orange-500 bg-orange-500/10 text-orange-300 font-medium"
                            : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {preferredFormat === "mp4" ? "H.264 AVC (Muxer)" : "VP9 WebM"}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Resolution Quality
                  </label>
                  <div className="flex gap-2">
                    {(["720p", "1080p"] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => setQuality(q)}
                        className={`flex-1 py-2 px-2 rounded-lg border text-xs font-mono transition ${
                          quality === q
                            ? "border-orange-500 bg-orange-500/10 text-orange-300 font-medium"
                            : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        {q.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1 truncate">
                    {ASPECT_RATIO_CONFIGS[aspectRatio][quality].label.split(" ")[0]}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Frame Rate (FPS)
                  </label>
                  <div className="flex gap-1.5">
                    {([24, 30, 60] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFps(f)}
                        className={`flex-1 py-2 px-1 rounded-lg border text-xs font-mono transition ${
                          fps === f
                            ? "border-orange-500 bg-orange-500/10 text-orange-300 font-medium"
                            : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {fps === 24 ? "Cinematic" : fps === 30 ? "Standard" : "60 FPS Pro"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Exporting Progress View */}
          {isExporting && progress && (
            <div className="py-6 space-y-4 text-center">
              <div className="flex justify-between items-center text-xs font-mono text-zinc-400">
                <span className="capitalize">
                  {progress.status} ({progress.format?.toUpperCase() || "MP4"})...
                </span>
                <span className="text-orange-400 font-semibold">{progress.percent}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-orange-600 to-amber-500 transition-all duration-150"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              <div className="text-xs text-zinc-500 font-mono">
                Frame {progress.currentFrame} / {progress.totalFrames} • Resolution{" "}
                {ASPECT_RATIO_CONFIGS[aspectRatio][quality].width}×
                {ASPECT_RATIO_CONFIGS[aspectRatio][quality].height}
              </div>

              <button
                onClick={handleCancelExport}
                className="mt-4 px-4 py-1.5 rounded-lg border border-red-800/80 bg-red-950/30 text-red-400 text-xs hover:bg-red-900/40 transition"
              >
                Cancel Export
              </button>
            </div>
          )}

          {/* Video Preview View */}
          {videoBlobUrl && (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border border-zinc-800 bg-black flex items-center justify-center max-h-[300px]">
                <video
                  src={videoBlobUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="max-h-[300px] w-auto max-w-full"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <span>📥</span>
                  <span>Download Video (.{exportedFormat})</span>
                </button>
                <button
                  onClick={() => setVideoBlobUrl(null)}
                  className="py-2.5 px-4 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition"
                >
                  Re-Render
                </button>
              </div>
            </div>
          )}

          {/* Error notice */}
          {errorMessage && (
            <div className="p-3 rounded-lg border border-red-800 bg-red-950/40 text-red-300 text-xs">
              ⚠️ {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-5 py-3.5 bg-zinc-900/30 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500 font-mono">
            Pipeline: WebCodecs + MP4 Muxer (Zero Frame Drops)
          </div>
          {!isExporting && !videoBlobUrl && (
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition"
              >
                Close
              </button>
              <button
                onClick={handleStartExport}
                className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition"
              >
                <span>🎬</span>
                <span>Start Deterministic Render</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
