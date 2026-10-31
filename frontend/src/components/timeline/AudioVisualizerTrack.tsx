"use client";

import React, { useRef, useState } from "react";
import {
  Mic,
  Upload,
  Volume2,
  VolumeX,
  Sparkles,
  Music,
  Check,
  Activity,
} from "lucide-react";
import { AudioVisemeSynthesizer, VisemeFrame } from "../../lib/audio/AudioVisemeSynthesizer";

export interface AudioVisualizerTrackProps {
  currentFrame: number;
  totalFrames?: number;
  fps?: number;
  synthesizer: AudioVisemeSynthesizer;
  onFramesUpdated?: (frames: VisemeFrame[]) => void;
  onSeekFrame?: (frame: number) => void;
}

export function AudioVisualizerTrack({
  currentFrame,
  totalFrames = 180,
  fps = 30,
  synthesizer,
  onFramesUpdated,
  onSeekFrame,
}: AudioVisualizerTrackProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const frames = synthesizer.bakedFrames;
  const currentViseme = synthesizer.getVisemeAtFrame(currentFrame);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setAudioName(file.name);

    try {
      const baked = await synthesizer.loadAudio(file, fps, totalFrames);
      onFramesUpdated?.(baked);
    } catch (err) {
      console.error("Audio load error:", err);
      alert("Failed to load audio file: " + (err as any)?.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateDemo = () => {
    setAudioName("Procedural_Narration_Track.wav");
    const demo = synthesizer.generateDemoSpeech(fps, totalFrames);
    onFramesUpdated?.(demo);
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const targetF = Math.round((relX / rect.width) * totalFrames);
    onSeekFrame?.(targetF);
    synthesizer.seek(targetF, fps);
  };

  return (
    <div className="flex items-center h-8 bg-[#141416] border-t border-[#27272a] text-[10px] font-mono text-[#a1a1aa] px-2 space-x-2 select-none shrink-0">
      {/* 1. Track Label & Upload */}
      <div className="flex items-center space-x-1.5 shrink-0">
        <Mic className="w-3.5 h-3.5 text-orange-400" />
        <span className="font-semibold text-white uppercase text-[9px] tracking-wide">
          Narration Track
        </span>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#202024] hover:bg-[#27272a] text-[#f4f4f5] text-[9px] transition-colors"
          title="Upload Audio File (.wav, .mp3)"
        >
          <Upload className="w-2.5 h-2.5" />
          <span>{isLoading ? "Baking..." : "Audio"}</span>
        </button>

        <button
          type="button"
          onClick={handleGenerateDemo}
          className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#ea580c]/20 hover:bg-[#ea580c]/30 text-[#ea580c] border border-[#ea580c]/30 text-[9px] transition-colors"
          title="Generate Procedural Speech Cadence"
        >
          <Sparkles className="w-2.5 h-2.5" />
          <span>Demo Voice</span>
        </button>
      </div>

      {/* 2. Waveform Visualizer Bar */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="flex-1 h-5 bg-[#09090b] rounded border border-[#27272a] relative overflow-hidden flex items-end cursor-pointer group"
      >
        {/* Render audio waveform peaks */}
        {frames.length > 0 ? (
          <div className="flex items-end w-full h-full px-0.5">
            {frames.map((f, i) => {
              const hPct = Math.max(8, Math.min(100, f.energy * 250));
              const isPassed = f.frame <= currentFrame;
              return (
                <div
                  key={i}
                  className="flex-1 mx-[0.5px] rounded-t-xs transition-colors"
                  style={{
                    height: `${hPct}%`,
                    backgroundColor: isPassed ? "#ea580c" : "#52525b",
                    opacity: isPassed ? 0.9 : 0.45,
                  }}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center w-full h-full text-[9px] text-[#52525b] italic">
            Click &apos;Demo Voice&apos; or upload audio to bake real-time lip-sync
          </div>
        )}

        {/* Current Playhead Needle */}
        {totalFrames > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm pointer-events-none"
            style={{
              left: `${(currentFrame / totalFrames) * 100}%`,
            }}
          />
        )}
      </div>

      {/* 3. Live Viseme Telemetry Meters */}
      <div className="flex items-center space-x-2 shrink-0 bg-[#18181b] px-2 py-0.5 rounded border border-[#27272a]">
        <div className="flex items-center space-x-1">
          <span className="text-[9px] text-zinc-500">JAW:</span>
          <div className="w-8 h-2 bg-[#09090b] rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-emerald-500 transition-all duration-75"
              style={{ width: `${Math.round(currentViseme.jawDrop * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <span className="text-[9px] text-zinc-500">MOUTH:</span>
          <div className="w-8 h-2 bg-[#09090b] rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-sky-500 transition-all duration-75"
              style={{ width: `${Math.round(currentViseme.mouthWide * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
