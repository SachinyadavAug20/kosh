"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { CameraView } from "./Viewport3D";

export interface CanvasOverlayProps {
  camera: THREE.Camera | null;
  selectedMesh: THREE.Mesh | null;
  currentModel: THREE.Object3D | null;
  meshList: Array<{ name: string; meshRef: THREE.Mesh }>;
  onSelectMesh: (name: string) => void;
  transformMode: "select" | "translate" | "rotate" | "scale";
  liveTransform: {
    pos: [number, number, number];
    rot: [number, number, number];
    scale: [number, number, number];
  };
  axisConstraint: "none" | "x" | "y" | "z" | "shift-x" | "shift-y" | "shift-z";
  showDimensions: boolean;
  onToggleDimensions: () => void;
  onSnapCameraView: (view: CameraView) => void;
}

export function CanvasOverlay({
  camera,
  selectedMesh,
  currentModel,
  meshList,
  onSelectMesh,
  transformMode,
  liveTransform,
  axisConstraint,
  showDimensions,
  onToggleDimensions,
  onSnapCameraView,
}: CanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Marquee Selection Box State (B hotkey)
  const [isMarqueeMode, setIsMarqueeMode] = useState(false);
  const [isDraggingMarquee, setIsDraggingMarquee] = useState(false);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeCurrentRef = useRef<{ x: number; y: number } | null>(null);

  // Hotkey B for Marquee Box Select, D for Dimensions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key.toLowerCase() === "b" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setIsMarqueeMode((prev) => !prev);
        return;
      }

      if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onToggleDimensions();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleDimensions]);

  // Project 3D vector to 2D Canvas coordinate
  const projectToScreen = useCallback(
    (worldVec: THREE.Vector3, width: number, height: number): { x: number; y: number; visible: boolean } => {
      if (!camera) return { x: 0, y: 0, visible: false };
      const v = worldVec.clone();
      v.project(camera);
      return {
        x: ((v.x + 1) * width) / 2,
        y: ((-v.y + 1) * height) / 2,
        visible: v.z < 1.0, // In front of near plane
      };
    },
    [camera]
  );

  // Main 2D Canvas Render Pass (executed on animation frame)
  useEffect(() => {
    let animId: number;

    const render = () => {
      animId = requestAnimationFrame(render);
      const canvas = canvasRef.current;
      if (!canvas || !camera) return;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const targetObj = selectedMesh || currentModel;

      // -----------------------------------------------------------
      // 1. Screen-Space Dimension & Measurement Callouts (Hotkey: D)
      // -----------------------------------------------------------
      if (showDimensions && targetObj) {
        const box = new THREE.Box3().setFromObject(targetObj);
        if (!box.isEmpty()) {
          const size = new THREE.Vector3();
          box.getSize(size);

          // 3D key vertices
          const pMin = box.min;
          const pMax = box.max;

          // Bottom edge (Width / X)
          const w1 = projectToScreen(new THREE.Vector3(pMin.x, pMin.y, pMax.z), width, height);
          const w2 = projectToScreen(new THREE.Vector3(pMax.x, pMin.y, pMax.z), width, height);

          // Vertical edge (Height / Y)
          const h1 = projectToScreen(new THREE.Vector3(pMax.x, pMin.y, pMax.z), width, height);
          const h2 = projectToScreen(new THREE.Vector3(pMax.x, pMax.y, pMax.z), width, height);

          // Depth edge (Depth / Z)
          const d1 = projectToScreen(new THREE.Vector3(pMax.x, pMin.y, pMin.z), width, height);
          const d2 = projectToScreen(new THREE.Vector3(pMax.x, pMin.y, pMax.z), width, height);

          ctx.font = "10px JetBrains Mono, monospace";

          // Helper to draw CAD leader line with end-ticks
          const drawMeasureLine = (
            pA: { x: number; y: number; visible: boolean },
            pB: { x: number; y: number; visible: boolean },
            label: string,
            color = "#ea580c"
          ) => {
            if (!pA.visible || !pB.visible) return;

            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 1;
            ctx.setLineDash([]);

            // Main line
            ctx.beginPath();
            ctx.moveTo(pA.x, pA.y);
            ctx.lineTo(pB.x, pB.y);
            ctx.stroke();

            // End tick 1
            ctx.beginPath();
            ctx.arc(pA.x, pA.y, 2, 0, Math.PI * 2);
            ctx.fill();

            // End tick 2
            ctx.beginPath();
            ctx.arc(pB.x, pB.y, 2, 0, Math.PI * 2);
            ctx.fill();

            // Label Badge
            const midX = (pA.x + pB.x) / 2;
            const midY = (pA.y + pB.y) / 2;
            const textWidth = ctx.measureText(label).width;

            ctx.fillStyle = "rgba(24, 24, 27, 0.9)";
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.fillRect(midX - textWidth / 2 - 4, midY - 7, textWidth + 8, 14);
            ctx.strokeRect(midX - textWidth / 2 - 4, midY - 7, textWidth + 8, 14);

            ctx.fillStyle = "#f4f4f5";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, midX, midY);
          };

          drawMeasureLine(w1, w2, `W: ${size.x.toFixed(2)}m`, "#ea580c");
          drawMeasureLine(h1, h2, `H: ${size.y.toFixed(2)}m`, "#38bdf8");
          drawMeasureLine(d1, d2, `D: ${size.z.toFixed(2)}m`, "#a1a1aa");
        }
      }

      // -----------------------------------------------------------
      // 2. In-Viewport Transformation Protractor / Angle Arc (Hotkey: R)
      // -----------------------------------------------------------
      if (transformMode === "rotate" && targetObj) {
        const pivotBox = new THREE.Box3().setFromObject(targetObj);
        const center = new THREE.Vector3();
        pivotBox.getCenter(center);
        const pivot2D = projectToScreen(center, width, height);

        if (pivot2D.visible) {
          const radius = 64;
          const activeRotDeg =
            axisConstraint === "x"
              ? liveTransform.rot[0]
              : axisConstraint === "y"
              ? liveTransform.rot[1]
              : liveTransform.rot[2];
          const activeRotRad = THREE.MathUtils.degToRad(activeRotDeg);

          // Background dial
          ctx.strokeStyle = "rgba(82, 82, 91, 0.5)";
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.arc(pivot2D.x, pivot2D.y, radius, 0, Math.PI * 2);
          ctx.stroke();

          // 45-degree angle ticks
          ctx.setLineDash([]);
          ctx.strokeStyle = "rgba(161, 161, 170, 0.6)";
          for (let deg = 0; deg < 360; deg += 45) {
            const rad = THREE.MathUtils.degToRad(deg);
            const x1 = pivot2D.x + Math.cos(rad) * (radius - 5);
            const y1 = pivot2D.y + Math.sin(rad) * (radius - 5);
            const x2 = pivot2D.x + Math.cos(rad) * (radius + 5);
            const y2 = pivot2D.y + Math.sin(rad) * (radius + 5);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }

          // Active angle arc fill
          ctx.beginPath();
          ctx.moveTo(pivot2D.x, pivot2D.y);
          ctx.arc(pivot2D.x, pivot2D.y, radius, 0, activeRotRad, activeRotRad < 0);
          ctx.closePath();
          ctx.fillStyle = "rgba(234, 88, 12, 0.18)";
          ctx.fill();

          // Active arc border
          ctx.beginPath();
          ctx.arc(pivot2D.x, pivot2D.y, radius, 0, activeRotRad, activeRotRad < 0);
          ctx.strokeStyle = "#ea580c";
          ctx.lineWidth = 2;
          ctx.stroke();

          // Live Angle readout badge
          const labelX = pivot2D.x + Math.cos(activeRotRad / 2) * (radius + 20);
          const labelY = pivot2D.y + Math.sin(activeRotRad / 2) * (radius + 20);
          const angleText = `∡ ${activeRotDeg.toFixed(1)}°`;

          ctx.font = "bold 11px JetBrains Mono, monospace";
          const tw = ctx.measureText(angleText).width;
          ctx.fillStyle = "#18181b";
          ctx.strokeStyle = "#ea580c";
          ctx.lineWidth = 1;
          ctx.fillRect(labelX - tw / 2 - 4, labelY - 8, tw + 8, 16);
          ctx.strokeRect(labelX - tw / 2 - 4, labelY - 8, tw + 8, 16);

          ctx.fillStyle = "#ea580c";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(angleText, labelX, labelY);
        }
      }

      // -----------------------------------------------------------
      // 3. Interactive Marquee Selection Box (Hotkey: B)
      // -----------------------------------------------------------
      if (isDraggingMarquee && marqueeStartRef.current && marqueeCurrentRef.current) {
        const start = marqueeStartRef.current;
        const curr = marqueeCurrentRef.current;

        const left = Math.min(start.x, curr.x);
        const top = Math.min(start.y, curr.y);
        const w = Math.abs(curr.x - start.x);
        const h = Math.abs(curr.y - start.y);

        ctx.setLineDash([4, 2]);
        ctx.strokeStyle = "#ea580c";
        ctx.lineWidth = 1;
        ctx.strokeRect(left, top, w, h);

        ctx.fillStyle = "rgba(234, 88, 12, 0.08)";
        ctx.fillRect(left, top, w, h);

        ctx.setLineDash([]);
      }

      // -----------------------------------------------------------
      // 4. Dynamic Camera Orientation Compass (Top-Right Gizmo)
      // -----------------------------------------------------------
      const compassX = width - 42;
      const compassY = 42;
      const compassR = 24;

      // Base disc
      ctx.beginPath();
      ctx.arc(compassX, compassY, compassR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(24, 24, 27, 0.75)";
      ctx.strokeStyle = "#3f3f46";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.fill();
      ctx.stroke();

      // Camera inverse matrix orientation projection
      const m = camera.matrixWorldInverse;
      const vX = new THREE.Vector3(1, 0, 0).applyMatrix4(m);
      const vY = new THREE.Vector3(0, 1, 0).applyMatrix4(m);
      const vZ = new THREE.Vector3(0, 0, 1).applyMatrix4(m);

      const drawCompassAxis = (dir: THREE.Vector3, label: string, color: string) => {
        const endX = compassX + dir.x * 18;
        const endY = compassY - dir.y * 18; // Canvas Y is inverted

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(compassX, compassY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(endX, endY, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "bold 8px sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, endX, endY);
      };

      drawCompassAxis(vX, "X", "#ef4444"); // Red X
      drawCompassAxis(vY, "Y", "#22c55e"); // Green Y
      drawCompassAxis(vZ, "Z", "#38bdf8"); // Blue Z

      ctx.restore();
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    camera,
    selectedMesh,
    currentModel,
    showDimensions,
    transformMode,
    liveTransform,
    axisConstraint,
    isDraggingMarquee,
    projectToScreen,
  ]);

  // Handle Marquee Pointer Events
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicked the Top-Right Camera Compass to snap view
    const compassX = rect.width - 42;
    const compassY = 42;
    const dist = Math.hypot(x - compassX, y - compassY);
    if (dist <= 26) {
      // Snap camera based on click quad
      if (Math.abs(x - compassX) > Math.abs(y - compassY)) {
        onSnapCameraView(x > compassX ? "right" : "left");
      } else {
        onSnapCameraView(y < compassY ? "top" : "front");
      }
      return;
    }

    if (isMarqueeMode) {
      setIsDraggingMarquee(true);
      marqueeStartRef.current = { x, y };
      marqueeCurrentRef.current = { x, y };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingMarquee || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    marqueeCurrentRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingMarquee || !canvasRef.current || !marqueeStartRef.current || !marqueeCurrentRef.current) {
      setIsDraggingMarquee(false);
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const start = marqueeStartRef.current;
    const curr = marqueeCurrentRef.current;
    const minX = Math.min(start.x, curr.x);
    const maxX = Math.max(start.x, curr.x);
    const minY = Math.min(start.y, curr.y);
    const maxY = Math.max(start.y, curr.y);

    // Frustum box selection: check which sub-meshes fall inside marquee rect
    for (const item of meshList) {
      if (item.meshRef) {
        const box = new THREE.Box3().setFromObject(item.meshRef);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const pt = projectToScreen(center, width, height);

        if (pt.visible && pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
          onSelectMesh(item.name);
          break; // Select primary hit
        }
      }
    }

    setIsDraggingMarquee(false);
    setIsMarqueeMode(false);
    marqueeStartRef.current = null;
    marqueeCurrentRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`absolute inset-0 z-10 w-full h-full ${
        isMarqueeMode ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
      }`}
      style={{
        pointerEvents: isMarqueeMode || isDraggingMarquee ? "auto" : "none",
      }}
    />
  );
}
