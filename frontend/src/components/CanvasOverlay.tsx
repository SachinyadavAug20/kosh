"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { CameraView } from "./Viewport3D";

export type SelectionTool = "tweak" | "box" | "circle" | "lasso";

export interface CanvasOverlayProps {
  camera: THREE.Camera | null;
  selectedMesh: THREE.Mesh | null;
  selectedMeshes?: THREE.Mesh[];
  currentModel: THREE.Object3D | null;
  meshList: Array<{ name: string; meshRef: THREE.Mesh }>;
  onSelectMesh: (name: string) => void;
  onSelectMultiple?: (names: string[], mode: "replace" | "add" | "remove") => void;
  selectionTool?: SelectionTool;
  onSetSelectionTool?: (tool: SelectionTool) => void;
  transformMode: "all" | "select" | "translate" | "rotate" | "scale";
  liveTransform: {
    pos: [number, number, number];
    rot: [number, number, number];
    scale: [number, number, number];
  };
  axisConstraint: "none" | "x" | "y" | "z" | "shift-x" | "shift-y" | "shift-z";
  showDimensions: boolean;
  onToggleDimensions: () => void;
  onSnapCameraView?: (view: CameraView) => void;
}

// Ray-casting point-in-polygon helper for Lasso selection
function isPointInPoly(pt: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function CanvasOverlay({
  camera,
  selectedMesh,
  selectedMeshes = [],
  currentModel,
  meshList,
  onSelectMesh,
  onSelectMultiple,
  selectionTool = "tweak",
  onSetSelectionTool,
  transformMode,
  liveTransform,
  axisConstraint,
  showDimensions,
  onToggleDimensions,
  onSnapCameraView,
}: CanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Dragging states for Selection Tools
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const currentPosRef = useRef<{ x: number; y: number } | null>(null);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const [circleRadius, setCircleRadius] = useState(45);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Key modifier tracking
  const [isShiftHeld, setIsShiftHeld] = useState(false);
  const [isCtrlHeld, setIsCtrlHeld] = useState(false);
  const [isAltHeld, setIsAltHeld] = useState(false);

  // Global hotkeys for Selection Modes and Dimensions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      setIsShiftHeld(e.shiftKey);
      setIsCtrlHeld(e.ctrlKey || e.metaKey);
      setIsAltHeld(e.altKey);

      // Hotkey B -> Activate Select Box
      if (e.key.toLowerCase() === "b" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onSetSelectionTool?.(selectionTool === "box" ? "tweak" : "box");
        return;
      }

      // Hotkey C -> Activate Circle Select
      if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onSetSelectionTool?.(selectionTool === "circle" ? "tweak" : "circle");
        return;
      }

      // Circle Radius adjustments [ or ]
      if (selectionTool === "circle") {
        if (e.key === "[") {
          e.preventDefault();
          setCircleRadius((r) => Math.max(15, r - 5));
          return;
        }
        if (e.key === "]") {
          e.preventDefault();
          setCircleRadius((r) => Math.min(200, r + 5));
          return;
        }
      }

      // Hotkey Esc -> Exit active selection tool back to Tweak
      if (e.key === "Escape" && selectionTool !== "tweak") {
        e.preventDefault();
        setIsDragging(false);
        lassoPointsRef.current = [];
        startPosRef.current = null;
        currentPosRef.current = null;
        onSetSelectionTool?.("tweak");
        return;
      }

      // Hotkey D for Dimensions
      if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onToggleDimensions();
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setIsShiftHeld(e.shiftKey);
      setIsCtrlHeld(e.ctrlKey || e.metaKey);
      setIsAltHeld(e.altKey);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectionTool, onSetSelectionTool, onToggleDimensions]);

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

  // Wheel event for Circle Select radius
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (selectionTool === "circle") {
        e.preventDefault();
        setCircleRadius((prev) => {
          const delta = e.deltaY < 0 ? 5 : -5;
          return Math.max(15, Math.min(200, prev + delta));
        });
      }
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [selectionTool]);

  // Main 2D Canvas Render Pass (HUD, Dimensions, Arc, and Selection Previews)
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

          const pMin = box.min;
          const pMax = box.max;

          const w1 = projectToScreen(new THREE.Vector3(pMin.x, pMin.y, pMax.z), width, height);
          const w2 = projectToScreen(new THREE.Vector3(pMax.x, pMin.y, pMax.z), width, height);
          const h1 = projectToScreen(new THREE.Vector3(pMax.x, pMin.y, pMax.z), width, height);
          const h2 = projectToScreen(new THREE.Vector3(pMax.x, pMax.y, pMax.z), width, height);
          const d1 = projectToScreen(new THREE.Vector3(pMax.x, pMin.y, pMin.z), width, height);
          const d2 = projectToScreen(new THREE.Vector3(pMax.x, pMin.y, pMax.z), width, height);

          ctx.font = "10px JetBrains Mono, monospace";

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

            ctx.beginPath();
            ctx.moveTo(pA.x, pA.y);
            ctx.lineTo(pB.x, pB.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(pA.x, pA.y, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(pB.x, pB.y, 2, 0, Math.PI * 2);
            ctx.fill();

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

          ctx.strokeStyle = "rgba(82, 82, 91, 0.5)";
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.arc(pivot2D.x, pivot2D.y, radius, 0, Math.PI * 2);
          ctx.stroke();

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

          ctx.beginPath();
          ctx.moveTo(pivot2D.x, pivot2D.y);
          ctx.arc(pivot2D.x, pivot2D.y, radius, 0, activeRotRad, activeRotRad < 0);
          ctx.closePath();
          ctx.fillStyle = "rgba(234, 88, 12, 0.18)";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(pivot2D.x, pivot2D.y, radius, 0, activeRotRad, activeRotRad < 0);
          ctx.strokeStyle = "#ea580c";
          ctx.lineWidth = 2;
          ctx.stroke();

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
      // 3. Selection Tools Visual Previews
      // -----------------------------------------------------------
      const strokeCol = isAltHeld ? "#ef4444" : isShiftHeld || isCtrlHeld ? "#38bdf8" : "#ea580c";
      const fillCol = isAltHeld
        ? "rgba(239, 68, 68, 0.10)"
        : isShiftHeld || isCtrlHeld
        ? "rgba(56, 189, 248, 0.10)"
        : "rgba(234, 88, 12, 0.10)";

      // A. SELECT BOX PREVIEW
      if (selectionTool === "box" && isDragging && startPosRef.current && currentPosRef.current) {
        const start = startPosRef.current;
        const curr = currentPosRef.current;
        const left = Math.min(start.x, curr.x);
        const top = Math.min(start.y, curr.y);
        const w = Math.abs(curr.x - start.x);
        const h = Math.abs(curr.y - start.y);

        ctx.setLineDash([4, 2]);
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(left, top, w, h);

        ctx.fillStyle = fillCol;
        ctx.fillRect(left, top, w, h);
        ctx.setLineDash([]);

        // Small indicator of action mode
        const modeLabel = isAltHeld ? "SUBTRACT" : isShiftHeld || isCtrlHeld ? "ADD" : "BOX SELECT";
        ctx.font = "9px JetBrains Mono, monospace";
        ctx.fillStyle = strokeCol;
        ctx.fillText(modeLabel, left + 4, top - 4);
      }

      // B. SELECT CIRCLE PREVIEW
      if (selectionTool === "circle") {
        const mx = mousePosRef.current.x;
        const my = mousePosRef.current.y;

        ctx.beginPath();
        ctx.arc(mx, my, circleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 2]);
        ctx.stroke();

        ctx.fillStyle = isDragging ? fillCol : "rgba(234, 88, 12, 0.04)";
        ctx.fill();
        ctx.setLineDash([]);

        // Radius Callout pill
        const rLabel = `R: ${circleRadius}px ${isAltHeld ? "[-]" : isShiftHeld || isCtrlHeld ? "[+]" : ""}`;
        ctx.font = "9px JetBrains Mono, monospace";
        ctx.fillStyle = strokeCol;
        ctx.fillText(rLabel, mx + circleRadius + 6, my + 3);
      }

      // C. SELECT LASSO PREVIEW
      if (selectionTool === "lasso" && isDragging && lassoPointsRef.current.length > 1) {
        const pts = lassoPointsRef.current;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();

        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.stroke();

        ctx.fillStyle = fillCol;
        ctx.fill();
        ctx.setLineDash([]);
      }

      ctx.restore();
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    camera,
    selectedMesh,
    selectedMeshes,
    currentModel,
    showDimensions,
    transformMode,
    liveTransform,
    axisConstraint,
    isDragging,
    selectionTool,
    circleRadius,
    isShiftHeld,
    isCtrlHeld,
    isAltHeld,
    projectToScreen,
  ]);

  // Determine which meshes intersect a query function
  const queryMeshes = useCallback(
    (testFn: (screenPt: { x: number; y: number }) => boolean): string[] => {
      if (!canvasRef.current || !camera) return [];
      const rect = canvasRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const matched: string[] = [];

      for (const item of meshList) {
        if (!item.meshRef) continue;
        const box = new THREE.Box3().setFromObject(item.meshRef);
        if (box.isEmpty()) continue;

        // 1. Test center point
        const center = new THREE.Vector3();
        box.getCenter(center);
        const center2D = projectToScreen(center, width, height);
        if (center2D.visible && testFn(center2D)) {
          matched.push(item.name);
          continue;
        }

        // 2. Test bounding box corners for accurate overlap
        const corners = [
          new THREE.Vector3(box.min.x, box.min.y, box.min.z),
          new THREE.Vector3(box.max.x, box.min.y, box.min.z),
          new THREE.Vector3(box.min.x, box.max.y, box.min.z),
          new THREE.Vector3(box.max.x, box.max.y, box.min.z),
          new THREE.Vector3(box.min.x, box.min.y, box.max.z),
          new THREE.Vector3(box.max.x, box.min.y, box.max.z),
          new THREE.Vector3(box.min.x, box.max.y, box.max.z),
          new THREE.Vector3(box.max.x, box.max.y, box.max.z),
        ];

        let cornerHit = false;
        for (const c of corners) {
          const pt = projectToScreen(c, width, height);
          if (pt.visible && testFn(pt)) {
            cornerHit = true;
            break;
          }
        }
        if (cornerHit) {
          matched.push(item.name);
        }
      }

      return matched;
    },
    [camera, meshList, projectToScreen]
  );

  // Handle Pointer Events for Active Tools (Box, Circle, Lasso)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mousePosRef.current = { x, y };

    // Right-click exits circle / lasso tool
    if (e.button === 2) {
      if (selectionTool !== "tweak") {
        onSetSelectionTool?.("tweak");
        setIsDragging(false);
        lassoPointsRef.current = [];
        return;
      }
    }

    if (selectionTool === "box") {
      setIsDragging(true);
      startPosRef.current = { x, y };
      currentPosRef.current = { x, y };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (selectionTool === "circle") {
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);

      // Perform circle brush paint on pointer down
      const mode = e.altKey ? "remove" : e.shiftKey || e.ctrlKey || e.metaKey ? "add" : "add";
      const hits = queryMeshes((pt) => Math.hypot(pt.x - x, pt.y - y) <= circleRadius);
      if (hits.length > 0 && onSelectMultiple) {
        onSelectMultiple(hits, mode);
      }
    } else if (selectionTool === "lasso") {
      setIsDragging(true);
      lassoPointsRef.current = [{ x, y }];
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mousePosRef.current = { x, y };

    if (selectionTool === "box" && isDragging) {
      currentPosRef.current = { x, y };
    } else if (selectionTool === "circle" && isDragging) {
      // Paint over objects as circle is dragged
      const mode = e.altKey ? "remove" : e.shiftKey || e.ctrlKey || e.metaKey ? "add" : "add";
      const hits = queryMeshes((pt) => Math.hypot(pt.x - x, pt.y - y) <= circleRadius);
      if (hits.length > 0 && onSelectMultiple) {
        onSelectMultiple(hits, mode);
      }
    } else if (selectionTool === "lasso" && isDragging) {
      // Add point if moved more than 3px
      const last = lassoPointsRef.current[lassoPointsRef.current.length - 1];
      if (!last || Math.hypot(last.x - x, last.y - y) > 3) {
        lassoPointsRef.current.push({ x, y });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    const mode = e.altKey ? "remove" : e.shiftKey || e.ctrlKey || e.metaKey ? "add" : "replace";

    if (selectionTool === "box" && startPosRef.current && currentPosRef.current) {
      const start = startPosRef.current;
      const curr = currentPosRef.current;
      const minX = Math.min(start.x, curr.x);
      const maxX = Math.max(start.x, curr.x);
      const minY = Math.min(start.y, curr.y);
      const maxY = Math.max(start.y, curr.y);

      // Require at least a 4px drag to register as marquee
      if (Math.abs(curr.x - start.x) > 4 || Math.abs(curr.y - start.y) > 4) {
        const hits = queryMeshes((pt) => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY);
        if (onSelectMultiple) {
          onSelectMultiple(hits, mode);
        } else if (hits.length > 0) {
          onSelectMesh(hits[0]);
        }
      }

      startPosRef.current = null;
      currentPosRef.current = null;
    } else if (selectionTool === "lasso" && lassoPointsRef.current.length > 2) {
      const poly = lassoPointsRef.current;
      const hits = queryMeshes((pt) => isPointInPoly(pt, poly));
      if (onSelectMultiple) {
        onSelectMultiple(hits, mode);
      } else if (hits.length > 0) {
        onSelectMesh(hits[0]);
      }
      lassoPointsRef.current = [];
    }
  };

  const isInteractiveSelection =
    selectionTool === "box" || selectionTool === "circle" || selectionTool === "lasso";

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => {
        if (isInteractiveSelection) e.preventDefault();
      }}
      className={`absolute inset-0 z-10 w-full h-full ${
        selectionTool === "box" || selectionTool === "lasso"
          ? "cursor-crosshair pointer-events-auto"
          : selectionTool === "circle"
          ? "cursor-none pointer-events-auto"
          : "pointer-events-none"
      }`}
      style={{
        pointerEvents: isInteractiveSelection ? "auto" : "none",
      }}
    />
  );
}
