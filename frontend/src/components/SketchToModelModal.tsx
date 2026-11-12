"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Pencil,
  Eraser,
  RotateCcw,
  UploadCloud,
  Sparkles,
  Download,
  Loader2,
  CheckCircle2,
  Sliders,
  Layers,
  Wand2,
  Globe,
  Grid,
} from "lucide-react";
import { ExportFormat } from "@/types/mcp";

export interface SketchToModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadModel: (assetUrl: string, script?: string) => void;
  token?: string;
  apiBase?: string;
}

export function SketchToModelModal({
  isOpen,
  onClose,
  onLoadModel,
  token,
  apiBase = "http://localhost:8080",
}: SketchToModelModalProps) {
  const [activeTab, setActiveTab] = useState<"draw" | "upload">("draw");
  const [prompt, setPrompt] = useState<string>("");
  const [mode, setMode] = useState<"vision_ai" | "base_match" | "contour_extrusion">("vision_ai");
  const [format, setFormat] = useState<ExportFormat>("glb");
  const [brushSize, setBrushSize] = useState<number>(4);
  const [brushColor, setBrushColor] = useState<string>("#ffffff");
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineSteps, setPipelineSteps] = useState<string[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const historyRef = useRef<ImageData[]>([]);

  // Initialize canvas
  useEffect(() => {
    if (!isOpen || activeTab !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fill with dark canvas background
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save initial state for undo
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = isEraser ? "#18181b" : brushColor;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.closePath();

    // Push to undo stack
    if (historyRef.current.length >= 20) {
      historyRef.current.shift();
    }
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  };

  const handleUndo = () => {
    if (historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const previous = historyRef.current[historyRef.current.length - 1];
    const canvas = canvasRef.current;
    if (!canvas || !previous) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(previous, 0, 0);
  };

  // Image File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setUploadedImageBase64(result);
    };
    reader.readAsDataURL(file);
  };

  // Submit & Synthesize 3D Model
  const handleSynthesize = async () => {
    setError(null);
    setIsLoading(true);
    setPipelineSteps(["Extracting image canvas pixels..."]);

    let imageBase64: string | null = null;
    if (activeTab === "draw") {
      const canvas = canvasRef.current;
      if (!canvas) {
        setError("Canvas is empty");
        setIsLoading(false);
        return;
      }
      imageBase64 = canvas.toDataURL("image/png");
    } else {
      if (!uploadedImageBase64) {
        setError("Please select an image file to upload");
        setIsLoading(false);
        return;
      }
      imageBase64 = uploadedImageBase64;
    }

    try {
      setPipelineSteps((prev) => [...prev, "Dispatching to Kosh Multimodal Vision Pipeline..."]);

      const effectiveToken = token || process.env.NEXT_PUBLIC_OPENROUTER_KEY || "";
      const res = await fetch(`${apiBase}/api/assets/sketch-to-3d`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
        },
        body: JSON.stringify({
          imageBase64,
          prompt: prompt.trim(),
          mode,
          format,
          apiKey: effectiveToken,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server returned HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      if (!data.success || !data.assetUrl) {
        throw new Error(data.error || "Failed to generate 3D model from sketch");
      }

      setPipelineSteps((prev) => [...prev, "Model compiled successfully. Loading into viewport..."]);
      setTimeout(() => {
        onLoadModel(`${apiBase}${data.assetUrl}`, data.script);
        setIsLoading(false);
        onClose();
      }, 400);
    } catch (err: any) {
      logError(err);
      setError(err.message || "Synthesis failed");
      setIsLoading(false);
    }
  };

  function logError(e: any) {
    console.error("Sketch to 3D error:", e);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none font-mono">
      <div className="bg-[#141416] border border-[#27272a] shadow-2xl rounded-sm w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#18181b]">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded bg-[#ea580c]/15 border border-[#ea580c]/40 flex items-center justify-center text-[#ea580c]">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#f4f4f5] tracking-wide">
                Hand-Drawn Sketch to 3D Model
              </h2>
              <p className="text-[10px] text-[#71717a]">
                Draw by hand or upload a sketch to synthesize watertight CAD solids
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#71717a] hover:text-[#f4f4f5] p-1 rounded hover:bg-[#202024] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Controls: Draw vs Upload */}
        <div className="flex items-center border-b border-[#27272a] bg-[#18181b]/50 px-4 pt-2 space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab("draw")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t border-t border-l border-r transition-colors flex items-center space-x-1.5 ${
              activeTab === "draw"
                ? "bg-[#141416] border-[#27272a] text-[#ea580c] border-b-transparent"
                : "border-transparent text-[#71717a] hover:text-[#a1a1aa]"
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Interactive Sketch Canvas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t border-t border-l border-r transition-colors flex items-center space-x-1.5 ${
              activeTab === "upload"
                ? "bg-[#141416] border-[#27272a] text-[#ea580c] border-b-transparent"
                : "border-transparent text-[#71717a] hover:text-[#a1a1aa]"
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Image or Drawing</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-3 overflow-y-auto min-h-0 flex-1">
          {/* TAB 1: DRAW CANVAS */}
          {activeTab === "draw" && (
            <div className="space-y-2">
              {/* Drawing Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-[#18181b] border border-[#27272a] rounded text-xs">
                {/* Tools: Pen vs Eraser */}
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setIsEraser(false)}
                    className={`px-2 py-1 rounded text-[11px] flex items-center space-x-1 transition-colors ${
                      !isEraser ? "bg-[#ea580c] text-white" : "bg-[#202024] text-[#a1a1aa] hover:bg-[#27272a]"
                    }`}
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Pen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEraser(true)}
                    className={`px-2 py-1 rounded text-[11px] flex items-center space-x-1 transition-colors ${
                      isEraser ? "bg-[#ea580c] text-white" : "bg-[#202024] text-[#a1a1aa] hover:bg-[#27272a]"
                    }`}
                  >
                    <Eraser className="w-3 h-3" />
                    <span>Eraser</span>
                  </button>
                </div>

                {/* Color Swatches */}
                {!isEraser && (
                  <div className="flex items-center space-x-1">
                    {[
                      { color: "#ffffff", label: "White" },
                      { color: "#ea580c", label: "Orange" },
                      { color: "#38bdf8", label: "Cyan" },
                      { color: "#4ade80", label: "Green" },
                      { color: "#f87171", label: "Red" },
                    ].map((swatch) => (
                      <button
                        key={swatch.color}
                        type="button"
                        onClick={() => setBrushColor(swatch.color)}
                        style={{ backgroundColor: swatch.color }}
                        className={`w-4 h-4 rounded-full border transition-transform ${
                          brushColor === swatch.color ? "scale-125 border-white" : "border-black/50 hover:scale-110"
                        }`}
                        title={swatch.label}
                      />
                    ))}
                  </div>
                )}

                {/* Brush Size Slider */}
                <div className="flex items-center space-x-1.5 text-[11px] text-[#71717a]">
                  <span>Size:</span>
                  <input
                    type="range"
                    min="1"
                    max="16"
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                    className="w-16 accent-[#ea580c]"
                  />
                  <span className="w-4 font-mono text-[#e4e4e7]">{brushSize}</span>
                </div>

                {/* Utility Actions: Undo & Clear */}
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="p-1 rounded bg-[#202024] hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                    title="Undo stroke"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClearCanvas}
                    className="px-2 py-1 rounded bg-[#202024] hover:bg-red-950/40 text-[#a1a1aa] hover:text-red-400 border border-transparent hover:border-red-800/40 transition-colors text-[10px]"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* HTML5 Canvas Container */}
              <div className="relative border border-[#27272a] rounded overflow-hidden bg-[#18181b] cursor-crosshair">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={320}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-64 touch-none block"
                />
                <div className="absolute bottom-2 right-2 text-[9px] text-[#52525b] pointer-events-none font-mono">
                  600 x 320 px · Precision Grid
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD IMAGE */}
          {activeTab === "upload" && (
            <div className="space-y-2">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#27272a] hover:border-[#ea580c]/60 rounded-md p-6 bg-[#18181b]/50 cursor-pointer transition-colors group">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-[#71717a] group-hover:text-[#ea580c] transition-colors mb-2" />
                <span className="text-xs font-bold text-[#e4e4e7] group-hover:text-white">
                  {uploadedFileName ? uploadedFileName : "Click or drag drawing to upload"}
                </span>
                <span className="text-[10px] text-[#71717a] mt-0.5">
                  Supports PNG, JPEG, SVG, WebP up to 10MB
                </span>
              </label>

              {/* Uploaded Preview */}
              {uploadedImageBase64 && (
                <div className="p-2 border border-[#27272a] rounded bg-[#18181b] flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={uploadedImageBase64}
                      alt="Uploaded Sketch Preview"
                      className="w-16 h-16 object-contain rounded border border-[#3f3f46] bg-black/40"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#f4f4f5]">{uploadedFileName}</div>
                      <div className="text-[10px] text-emerald-400 flex items-center space-x-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Ready for 3D Multimodal Reconstruction</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedImageBase64(null);
                      setUploadedFileName(null);
                    }}
                    className="text-[#71717a] hover:text-red-400 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Prompt Refinement Input */}
          <div className="space-y-1">
            <label className="text-[11px] text-[#a1a1aa] font-semibold flex items-center justify-between">
              <span>Guidance & Detail Refinement (Optional)</span>
              <span className="text-[9px] text-[#71717a]">E.g. Dimensions, hole bores, colors</span>
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g. Mechanical bracket with 4 corner mounting holes, brushed steel"
              className="w-full px-3 py-1.5 rounded bg-[#18181b] border border-[#27272a] focus:border-[#ea580c] text-xs text-[#f4f4f5] outline-none placeholder:text-[#52525b]"
            />
          </div>

          {/* Engine & Format Selectors */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Reconstruction Engine */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">
                Reconstruction Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="w-full px-2 py-1.5 rounded bg-[#18181b] border border-[#27272a] text-xs text-[#f4f4f5] outline-none"
              >
                <option value="vision_ai">AI Multimodal Vision (OpenRouter/Gemini)</option>
                <option value="base_match">Internet Base Model Search & Adapt</option>
                <option value="contour_extrusion">2D Contour Profile Extrusion (Offline)</option>
              </select>
            </div>

            {/* Target Export Format */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">
                Target Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="w-full px-2 py-1.5 rounded bg-[#18181b] border border-[#27272a] text-xs text-[#f4f4f5] outline-none"
              >
                <option value="glb">GLB (Real-Time Web 3D & Three.js)</option>
                <option value="stl">STL (3D Printing & CNC Mill)</option>
              </select>
            </div>
          </div>

          {/* Active Pipeline Progress */}
          {isLoading && (
            <div className="p-3 rounded bg-[#18181b] border border-[#ea580c]/50 space-y-2">
              <div className="flex items-center space-x-2 text-xs text-[#ea580c] font-bold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Synthesizing Watertight 3D Geometry...</span>
              </div>
              <div className="space-y-1">
                {pipelineSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center space-x-2 text-[10px] text-[#a1a1aa]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#27272a] bg-[#18181b]">
          <div className="text-[10px] text-[#71717a]">
            Watertight Manifold · Automatic Normals · PBR Shaders
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3 py-1.5 rounded bg-[#202024] hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSynthesize}
              disabled={isLoading}
              className="px-4 py-1.5 rounded bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Create 3D Model</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
