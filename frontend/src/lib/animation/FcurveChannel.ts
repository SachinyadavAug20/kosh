/**
 * FcurveChannel.ts
 * Mathematical Cubic Bézier F-Curve Engine for Kosh.
 * 
 * Provides continuous mathematical curve evaluation via Newton-Raphson
 * root finding for parametric cubic Bézier segments B(s) = (Bx(s), By(s)),
 * matching Blender's internal animation curve evaluation kernel.
 */

export type FcurveInterpolation = "BEZIER" | "LINEAR" | "CONSTANT";

export interface KeyframePoint {
  frame: number;
  value: number;
}

export interface KeyframeHandle {
  id: string;
  frame: number;
  value: number;
  handleLeft: KeyframePoint;
  handleRight: KeyframePoint;
  interpolation: FcurveInterpolation;
  selected?: boolean;
}

export interface AnimationChannel {
  id: string;
  name: string;
  targetId?: string;
  property: string; // e.g. 'position.x', 'camera.dolly', 'head.jawDrop'
  color: string;
  visible: boolean;
  muted: boolean;
  keyframes: KeyframeHandle[];
  defaultValue: number;
  minLimit?: number;
  maxLimit?: number;
}

// -------------------------------------------------------------
// Newton-Raphson Cubic Bézier Root Solver
// -------------------------------------------------------------

/**
 * Evaluates the cubic Bézier polynomial at parameter s:
 * B(s) = (1-s)³ P0 + 3(1-s)²s P1 + 3(1-s)s² P2 + s³ P3
 */
function cubicBezier(p0: number, p1: number, p2: number, p3: number, s: number): number {
  const inv = 1 - s;
  return (
    inv * inv * inv * p0 +
    3 * inv * inv * s * p1 +
    3 * inv * s * s * p2 +
    s * s * s * p3
  );
}

/**
 * First derivative of cubic Bézier polynomial with respect to s:
 * B'(s) = 3(1-s)²(P1 - P0) + 6(1-s)s(P2 - P1) + 3s²(P3 - P2)
 */
function cubicBezierDerivative(p0: number, p1: number, p2: number, p3: number, s: number): number {
  const inv = 1 - s;
  return (
    3 * inv * inv * (p1 - p0) +
    6 * inv * s * (p2 - p1) +
    3 * s * s * (p3 - p2)
  );
}

/**
 * Solves Bx(s) = targetFrame for parameter s ∈ [0, 1] using Newton-Raphson.
 * Iterates up to 8 times with 1e-6 precision tolerance.
 */
export function solveBezierTime(
  p0x: number,
  p1x: number,
  p2x: number,
  p3x: number,
  targetFrame: number,
  maxIterations: number = 8,
  tolerance: number = 1e-6
): number {
  if (p3x - p0x === 0) return 0;

  // Initial estimate: linear interpolation
  let s = (targetFrame - p0x) / (p3x - p0x);
  s = Math.max(0, Math.min(1, s));

  for (let i = 0; i < maxIterations; i++) {
    const currentX = cubicBezier(p0x, p1x, p2x, p3x, s);
    const error = currentX - targetFrame;

    if (Math.abs(error) < tolerance) {
      return s;
    }

    const dX = cubicBezierDerivative(p0x, p1x, p2x, p3x, s);
    if (Math.abs(dX) < 1e-7) {
      // Near stationary slope, fallback to bisection step
      break;
    }

    const nextS = s - error / dX;
    s = Math.max(0, Math.min(1, nextS));
  }

  // Fallback bisection if Newton-Raphson hit a local stationary point
  let low = 0;
  let high = 1;
  for (let i = 0; i < 10; i++) {
    const mid = (low + high) * 0.5;
    const currentX = cubicBezier(p0x, p1x, p2x, p3x, mid);
    if (Math.abs(currentX - targetFrame) < tolerance) return mid;
    if (currentX < targetFrame) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) * 0.5;
}

// -------------------------------------------------------------
// Channel Evaluation
// -------------------------------------------------------------

/**
 * Samples an AnimationChannel at an arbitrary continuous frame timestamp.
 */
export function sampleChannel(channel: AnimationChannel, currentFrame: number): number {
  if (channel.muted) {
    return channel.defaultValue;
  }

  const kfs = channel.keyframes;
  if (!kfs || kfs.length === 0) {
    return channel.defaultValue;
  }

  // Sorted keyframes check
  if (kfs.length === 1) {
    return kfs[0].value;
  }

  // Before first keyframe
  if (currentFrame <= kfs[0].frame) {
    return kfs[0].value;
  }

  // After last keyframe
  const lastIndex = kfs.length - 1;
  if (currentFrame >= kfs[lastIndex].frame) {
    return kfs[lastIndex].value;
  }

  // Binary search for surrounding keyframe segment [k0, k1]
  let low = 0;
  let high = lastIndex;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (kfs[mid].frame <= currentFrame && kfs[mid + 1].frame >= currentFrame) {
      const k0 = kfs[mid];
      const k1 = kfs[mid + 1];

      // Exact match
      if (k0.frame === currentFrame) return k0.value;
      if (k1.frame === currentFrame) return k1.value;

      // Constant Hold
      if (k0.interpolation === "CONSTANT") {
        return k0.value;
      }

      // Linear Lerp
      if (k0.interpolation === "LINEAR") {
        const t = (currentFrame - k0.frame) / (k1.frame - k0.frame);
        return k0.value + (k1.value - k0.value) * t;
      }

      // Cubic Bézier
      const p0x = k0.frame;
      const p0y = k0.value;
      const p1x = k0.handleRight.frame;
      const p1y = k0.handleRight.value;
      const p2x = k1.handleLeft.frame;
      const p2y = k1.handleLeft.value;
      const p3x = k1.frame;
      const p3y = k1.value;

      const s = solveBezierTime(p0x, p1x, p2x, p3x, currentFrame);
      return cubicBezier(p0y, p1y, p2y, p3y, s);
    }

    if (kfs[mid].frame < currentFrame) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return channel.defaultValue;
}

// -------------------------------------------------------------
// Keyframe Management Helpers
// -------------------------------------------------------------

export function createKeyframe(
  frame: number,
  value: number,
  interpolation: FcurveInterpolation = "BEZIER",
  handleLength: number = 5
): KeyframeHandle {
  const id = "kf_" + Math.random().toString(36).substring(2, 9);
  return {
    id,
    frame,
    value,
    handleLeft: { frame: frame - handleLength, value },
    handleRight: { frame: frame + handleLength, value },
    interpolation,
    selected: false,
  };
}

export function sortKeyframes(kfs: KeyframeHandle[]): KeyframeHandle[] {
  return [...kfs].sort((a, b) => a.frame - b.frame);
}

export function addKeyframeToChannel(
  channel: AnimationChannel,
  frame: number,
  value: number,
  interpolation: FcurveInterpolation = "BEZIER"
): AnimationChannel {
  const existingIdx = channel.keyframes.findIndex((k) => k.frame === frame);
  const newKf = createKeyframe(frame, value, interpolation);

  let newKeyframes: KeyframeHandle[];
  if (existingIdx >= 0) {
    newKeyframes = [...channel.keyframes];
    newKeyframes[existingIdx] = {
      ...newKf,
      id: channel.keyframes[existingIdx].id,
    };
  } else {
    newKeyframes = sortKeyframes([...channel.keyframes, newKf]);
  }

  return {
    ...channel,
    keyframes: newKeyframes,
  };
}

export function removeKeyframeFromChannel(
  channel: AnimationChannel,
  keyframeId: string
): AnimationChannel {
  return {
    ...channel,
    keyframes: channel.keyframes.filter((k) => k.id !== keyframeId),
  };
}

export function updateKeyframePoint(
  channel: AnimationChannel,
  keyframeId: string,
  newFrame: number,
  newValue: number
): AnimationChannel {
  const kf = channel.keyframes.find((k) => k.id === keyframeId);
  if (!kf) return channel;

  const dFrame = newFrame - kf.frame;
  const dVal = newValue - kf.value;

  const updatedKfs = channel.keyframes.map((k) => {
    if (k.id === keyframeId) {
      return {
        ...k,
        frame: newFrame,
        value: newValue,
        handleLeft: {
          frame: k.handleLeft.frame + dFrame,
          value: k.handleLeft.value + dVal,
        },
        handleRight: {
          frame: k.handleRight.frame + dFrame,
          value: k.handleRight.value + dVal,
        },
      };
    }
    return k;
  });

  return {
    ...channel,
    keyframes: sortKeyframes(updatedKfs),
  };
}

// -------------------------------------------------------------
// Preset Channels
// -------------------------------------------------------------

export function createDefaultAnimationChannels(): AnimationChannel[] {
  return [
    {
      id: "chan_cam_dolly",
      name: "Camera Dolly (Z)",
      property: "camera.dolly",
      color: "#f97316", // Orange
      visible: true,
      muted: false,
      defaultValue: 10,
      keyframes: [
        {
          id: "kf_cd_1",
          frame: 0,
          value: 14,
          handleLeft: { frame: -10, value: 14 },
          handleRight: { frame: 25, value: 13.5 },
          interpolation: "BEZIER",
        },
        {
          id: "kf_cd_2",
          frame: 90,
          value: 9,
          handleLeft: { frame: 65, value: 10 },
          handleRight: { frame: 120, value: 8 },
          interpolation: "BEZIER",
        },
        {
          id: "kf_cd_3",
          frame: 180,
          value: 6.5,
          handleLeft: { frame: 150, value: 7.2 },
          handleRight: { frame: 200, value: 6.5 },
          interpolation: "BEZIER",
        },
      ],
    },
    {
      id: "chan_cam_height",
      name: "Camera Height (Y)",
      property: "camera.height",
      color: "#38bdf8", // Sky blue
      visible: true,
      muted: false,
      defaultValue: 3,
      keyframes: [
        {
          id: "kf_ch_1",
          frame: 0,
          value: 2.5,
          handleLeft: { frame: -10, value: 2.5 },
          handleRight: { frame: 30, value: 2.8 },
          interpolation: "BEZIER",
        },
        {
          id: "kf_ch_2",
          frame: 90,
          value: 4.2,
          handleLeft: { frame: 60, value: 3.5 },
          handleRight: { frame: 130, value: 4.0 },
          interpolation: "BEZIER",
        },
        {
          id: "kf_ch_3",
          frame: 180,
          value: 2.0,
          handleLeft: { frame: 150, value: 2.5 },
          handleRight: { frame: 200, value: 2.0 },
          interpolation: "BEZIER",
        },
      ],
    },
    {
      id: "chan_actor_speed",
      name: "Actor Velocity",
      property: "actor.velocity",
      color: "#a855f7", // Purple
      visible: true,
      muted: false,
      defaultValue: 1.0,
      keyframes: [
        {
          id: "kf_as_1",
          frame: 0,
          value: 0.0,
          handleLeft: { frame: -10, value: 0 },
          handleRight: { frame: 20, value: 0.2 },
          interpolation: "BEZIER",
        },
        {
          id: "kf_as_2",
          frame: 40,
          value: 1.5,
          handleLeft: { frame: 25, value: 1.0 },
          handleRight: { frame: 80, value: 1.5 },
          interpolation: "BEZIER",
        },
        {
          id: "kf_as_3",
          frame: 140,
          value: 1.5,
          handleLeft: { frame: 110, value: 1.5 },
          handleRight: { frame: 160, value: 0.8 },
          interpolation: "BEZIER",
        },
        {
          id: "kf_as_4",
          frame: 180,
          value: 0.0,
          handleLeft: { frame: 165, value: 0.2 },
          handleRight: { frame: 195, value: 0 },
          interpolation: "BEZIER",
        },
      ],
    },
    {
      id: "chan_jaw_drop",
      name: "Viseme: Jaw Drop",
      property: "head.jawDrop",
      color: "#22c55e", // Green
      visible: false,
      muted: false,
      defaultValue: 0.0,
      keyframes: [
        {
          id: "kf_jd_1",
          frame: 0,
          value: 0.0,
          handleLeft: { frame: -5, value: 0 },
          handleRight: { frame: 10, value: 0 },
          interpolation: "BEZIER",
        },
        {
          id: "kf_jd_2",
          frame: 30,
          value: 0.8,
          handleLeft: { frame: 22, value: 0.3 },
          handleRight: { frame: 38, value: 0.3 },
          interpolation: "BEZIER",
        },
        {
          id: "kf_jd_3",
          frame: 50,
          value: 0.1,
          handleLeft: { frame: 42, value: 0.5 },
          handleRight: { frame: 60, value: 0.1 },
          interpolation: "BEZIER",
        },
        {
          id: "kf_jd_4",
          frame: 75,
          value: 0.7,
          handleLeft: { frame: 68, value: 0.2 },
          handleRight: { frame: 82, value: 0.2 },
          interpolation: "BEZIER",
        },
        {
          id: "kf_jd_5",
          frame: 100,
          value: 0.0,
          handleLeft: { frame: 92, value: 0.3 },
          handleRight: { frame: 110, value: 0 },
          interpolation: "BEZIER",
        },
      ],
    },
  ];
}
