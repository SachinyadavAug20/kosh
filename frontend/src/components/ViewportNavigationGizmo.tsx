"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type CameraViewPreset =
  | "front"
  | "back"
  | "right"
  | "left"
  | "top"
  | "bottom"
  | "iso";

interface AxisDefinition {
  id: string;
  vector: THREE.Vector3;
  label: string;
  view: CameraViewPreset;
  color: string;
  tooltip: string;
}

const AXES: AxisDefinition[] = [
  {
    id: "+x",
    vector: new THREE.Vector3(1, 0, 0),
    label: "X",
    view: "right",
    color: "#ef4444",
    tooltip: "Right (+X) [Numpad 3]",
  },
  {
    id: "-x",
    vector: new THREE.Vector3(-1, 0, 0),
    label: "-X",
    view: "left",
    color: "#ef4444",
    tooltip: "Left (-X) [Ctrl + Numpad 3]",
  },
  {
    id: "+y",
    vector: new THREE.Vector3(0, 1, 0),
    label: "Y",
    view: "top",
    color: "#22c55e",
    tooltip: "Top (+Y) [Numpad 7]",
  },
  {
    id: "-y",
    vector: new THREE.Vector3(0, -1, 0),
    label: "-Y",
    view: "bottom",
    color: "#22c55e",
    tooltip: "Bottom (-Y) [Ctrl + Numpad 7]",
  },
  {
    id: "+z",
    vector: new THREE.Vector3(0, 0, 1),
    label: "Z",
    view: "front",
    color: "#3b82f6",
    tooltip: "Front (+Z) [Numpad 1]",
  },
  {
    id: "-z",
    vector: new THREE.Vector3(0, 0, -1),
    label: "-Z",
    view: "back",
    color: "#3b82f6",
    tooltip: "Back (-Z) [Ctrl + Numpad 1]",
  },
];

interface ViewportNavigationGizmoProps {
  camera: THREE.Camera | null;
  orbitControls: OrbitControls | null;
  onSnapView: (view: CameraViewPreset) => void;
  isOrtho: boolean;
  onToggleOrtho: () => void;
  className?: string;
}

interface ProjectedAxis {
  axis: AxisDefinition;
  screenX: number;
  screenY: number;
  depth: number; // positive = towards camera, negative = away
  isFront: boolean;
}

export function ViewportNavigationGizmo({
  camera,
  orbitControls,
  onSnapView,
  isOrtho,
  onToggleOrtho,
  className = "",
}: ViewportNavigationGizmoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [projectedAxes, setProjectedAxes] = useState<ProjectedAxis[]>([]);
  const [hoveredAxisId, setHoveredAxisId] = useState<string | null>(null);
  const [isHoveredCenter, setIsHoveredCenter] = useState<boolean>(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Drag-to-orbit state
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Camera tween animation state
  const tweenRef = useRef<number | null>(null);

  const GIZMO_SIZE = 104;
  const CENTER = GIZMO_SIZE / 2;
  const ARM_RADIUS = 34;

  // Real-time projection loop
  useEffect(() => {
    let animId: number;

    const updateProjection = () => {
      if (camera) {
        camera.updateMatrixWorld();
        const invMatrix = camera.matrixWorldInverse;

        const projected: ProjectedAxis[] = AXES.map((axis) => {
          // In Three.js camera space:
          // X is right, Y is up, -Z is looking direction (away into screen), +Z is towards camera
          const camVec = axis.vector.clone().applyMatrix4(invMatrix);

          return {
            axis,
            screenX: CENTER + camVec.x * ARM_RADIUS,
            screenY: CENTER - camVec.y * ARM_RADIUS,
            depth: camVec.z,
            isFront: camVec.z >= -0.05,
          };
        });

        // Depth sort: back axes first, front axes last
        projected.sort((a, b) => a.depth - b.depth);
        setProjectedAxes(projected);
      }
      animId = requestAnimationFrame(updateProjection);
    };

    animId = requestAnimationFrame(updateProjection);
    return () => cancelAnimationFrame(animId);
  }, [camera, CENTER, ARM_RADIUS]);

  // Smooth camera view snap with cubic easing
  const handleSnapView = useCallback(
    (view: CameraViewPreset) => {
      if (!camera || !orbitControls) {
        onSnapView(view);
        return;
      }

      if (tweenRef.current !== null) {
        cancelAnimationFrame(tweenRef.current);
        tweenRef.current = null;
      }

      const target = orbitControls.target.clone();
      const currentPos = camera.position.clone();
      const dist = Math.max(3.5, currentPos.distanceTo(target));

      const targetPos = new THREE.Vector3();
      switch (view) {
        case "front":
          targetPos.set(target.x, target.y, target.z + dist);
          break;
        case "back":
          targetPos.set(target.x, target.y, target.z - dist);
          break;
        case "right":
          targetPos.set(target.x + dist, target.y, target.z);
          break;
        case "left":
          targetPos.set(target.x - dist, target.y, target.z);
          break;
        case "top":
          targetPos.set(target.x, target.y + dist, target.z + 0.0001);
          break;
        case "bottom":
          targetPos.set(target.x, target.y - dist, target.z + 0.0001);
          break;
        case "iso":
        default:
          targetPos.set(
            target.x + dist * 0.7,
            target.y + dist * 0.5,
            target.z + dist * 0.7
          );
          break;
      }

      const startTime = performance.now();
      const duration = 300; // ms

      const animateCamera = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1.0, elapsed / duration);
        // Ease-out cubic
        const ease = 1 - Math.pow(1 - progress, 3);

        camera.position.lerpVectors(currentPos, targetPos, ease);
        camera.lookAt(target);
        orbitControls.update();

        if (progress < 1.0) {
          tweenRef.current = requestAnimationFrame(animateCamera);
        } else {
          camera.position.copy(targetPos);
          camera.lookAt(target);
          orbitControls.update();
          tweenRef.current = null;
          onSnapView(view);
        }
      };

      tweenRef.current = requestAnimationFrame(animateCamera);
    },
    [camera, orbitControls, onSnapView]
  );

  // Drag to orbit camera around target
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !camera || !orbitControls) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    const target = orbitControls.target;
    const offset = camera.position.clone().sub(target);

    // Convert to spherical coordinates
    const spherical = new THREE.Spherical().setFromVector3(offset);
    const speed = 0.015;

    spherical.theta -= dx * speed;
    spherical.phi -= dy * speed;
    spherical.phi = Math.max(0.02, Math.min(Math.PI - 0.02, spherical.phi));

    offset.setFromSpherical(spherical);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    orbitControls.update();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  // Determine current active view label
  const getViewLabel = (): string => {
    if (!camera || !orbitControls) return "PERSPECTIVE";
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);

    const threshold = 0.985;
    if (Math.abs(dir.y) > threshold) {
      return dir.y < 0 ? "TOP ORTHO" : "BOTTOM ORTHO";
    }
    if (Math.abs(dir.x) > threshold) {
      return dir.x < 0 ? "RIGHT ORTHO" : "LEFT ORTHO";
    }
    if (Math.abs(dir.z) > threshold) {
      return dir.z < 0 ? "FRONT ORTHO" : "BACK ORTHO";
    }
    return isOrtho ? "USER ORTHO" : "USER PERSPECTIVE";
  };

  return (
    <div
      ref={containerRef}
      className={`absolute top-3 right-3 z-30 select-none ${className}`}
      style={{ width: GIZMO_SIZE, height: GIZMO_SIZE }}
    >
      {/* 3D Navigation Triad - Completely Transparent (No dark disc, no blur) */}
      <div
        className="relative cursor-grab active:cursor-grabbing group"
        style={{
          width: GIZMO_SIZE,
          height: GIZMO_SIZE,
          background: "transparent",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <svg
          width={GIZMO_SIZE - 8}
          height={GIZMO_SIZE - 8}
          viewBox={`0 0 ${GIZMO_SIZE} ${GIZMO_SIZE}`}
          className="overflow-visible"
        >
          <defs>
            {/* Subtle Drop Shadow for Axis Badges */}
            <filter id="gizmo-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.6" />
            </filter>
            <radialGradient id="hub-gradient" cx="35%" cy="35%">
              <stop offset="0%" stopColor="#71717a" />
              <stop offset="100%" stopColor="#27272a" />
            </radialGradient>
          </defs>

          {/* Central Hub Base (Iso Click Target) */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={isHoveredCenter ? 7.5 : 5.5}
            fill={isHoveredCenter ? "#ea580c" : "url(#hub-gradient)"}
            stroke={isHoveredCenter ? "#ffffff" : "#52525b"}
            strokeWidth={1.2}
            className="cursor-pointer transition-all duration-150"
            onMouseEnter={() => {
              setIsHoveredCenter(true);
              setActiveTooltip("Isometric Perspective View (Numpad 0)");
            }}
            onMouseLeave={() => {
              setIsHoveredCenter(false);
              setActiveTooltip(null);
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleSnapView("iso");
            }}
          />

          {/* Render 6 Depth-Sorted Axes */}
          {projectedAxes.map(({ axis, screenX, screenY, isFront, depth }) => {
            const isHovered = hoveredAxisId === axis.id;

            if (!isFront) {
              // Negative / Back Axis: Dimmed dashed stem + subtle dot
              return (
                <g
                  key={axis.id}
                  className="cursor-pointer"
                  onMouseEnter={() => {
                    setHoveredAxisId(axis.id);
                    setActiveTooltip(axis.tooltip);
                  }}
                  onMouseLeave={() => {
                    setHoveredAxisId(null);
                    setActiveTooltip(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSnapView(axis.view);
                  }}
                >
                  {/* Stem Line to Center */}
                  <line
                    x1={CENTER}
                    y1={CENTER}
                    x2={screenX}
                    y2={screenY}
                    stroke={axis.color}
                    strokeWidth={isHovered ? 1.8 : 1.0}
                    strokeDasharray="2, 2"
                    strokeOpacity={isHovered ? 0.75 : 0.3}
                  />
                  {/* Terminal Dot */}
                  <circle
                    cx={screenX}
                    cy={screenY}
                    r={isHovered ? 6 : 4}
                    fill={axis.color}
                    fillOpacity={isHovered ? 0.9 : 0.45}
                    stroke={isHovered ? "#ffffff" : "none"}
                    strokeWidth={1}
                  />
                </g>
              );
            }

            // Positive / Front Axis: Solid vibrant stem + Shaded pill head with sharp letter
            return (
              <g
                key={axis.id}
                className="cursor-pointer"
                onMouseEnter={() => {
                  setHoveredAxisId(axis.id);
                  setActiveTooltip(axis.tooltip);
                }}
                onMouseLeave={() => {
                  setHoveredAxisId(null);
                  setActiveTooltip(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSnapView(axis.view);
                }}
              >
                {/* Connecting Stem Line */}
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={screenX}
                  y2={screenY}
                  stroke={axis.color}
                  strokeWidth={isHovered ? 3.0 : 2.2}
                  strokeLinecap="round"
                  strokeOpacity={0.95}
                />
                {/* Pill Head */}
                <circle
                  cx={screenX}
                  cy={screenY}
                  r={isHovered ? 12.5 : 10.5}
                  fill={axis.color}
                  stroke={isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.4)"}
                  strokeWidth={isHovered ? 2 : 1}
                  filter="url(#gizmo-shadow)"
                  className="transition-all duration-150"
                />
                {/* Axis Letter Label */}
                <text
                  x={screenX}
                  y={screenY + 0.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  pointerEvents="none"
                >
                  {axis.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Floating Tooltip Pill on Hover Only */}
      {activeTooltip && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-[#18181b] border border-[#3f3f46] px-2 py-0.5 rounded text-[10px] font-mono text-[#f4f4f5] whitespace-nowrap shadow-lg pointer-events-none">
          {activeTooltip}
        </div>
      )}
    </div>
  );
}
