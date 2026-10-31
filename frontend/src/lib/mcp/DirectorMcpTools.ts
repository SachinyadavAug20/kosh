/**
 * DirectorMcpTools.ts
 * MCP (Model Context Protocol) Tool Registry & JSON-RPC 2.0 Dispatcher for Kosh.
 * 
 * Provides standard tools for AI Narrative Direction:
 * - create_actor
 * - set_actor_path
 * - set_camera_cinematic
 * - trigger_deterministic_render
 * - evaluate_fcurve
 * - sync_audio_narration
 */

import { NarrativeActor, CharacterType, ActorAction } from "../narrative/NarrativeSceneSchema";
import { CameraShotStyle } from "../narrative/DirectorCameraRig";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  samplePayload: Record<string, any>;
}

export const DIRECTOR_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "create_actor",
    description: "Spawns a new rigged 3D character actor in the low-poly narrative scene.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Unique actor identifier (e.g. 'actor_hero')" },
        name: { type: "string", description: "Display name of the actor" },
        characterType: {
          type: "string",
          enum: ["humanoid", "robot", "creature"],
          description: "Rig archetype",
        },
        position: {
          type: "array",
          items: { type: "number" },
          description: "[x, y, z] initial coordinates",
        },
        colors: {
          type: "object",
          properties: {
            skin: { type: "string" },
            shirt: { type: "string" },
            pants: { type: "string" },
          },
        },
        motion: {
          type: "string",
          enum: ["walk", "run", "idle", "wave", "look_around"],
          description: "Initial action state",
        },
      },
      required: ["id", "name"],
    },
    samplePayload: {
      id: "actor_courier",
      name: "Cyberpunk Courier",
      characterType: "humanoid",
      position: [0, 0, 5],
      colors: {
        skin: "#f8c291",
        shirt: "#e11d48",
        pants: "#1e1b4b",
      },
      motion: "walk",
    },
  },
  {
    name: "set_actor_path",
    description: "Configures Catmull-Rom spline navigation waypoints and gait kinematics for an actor.",
    inputSchema: {
      type: "object",
      properties: {
        actorId: { type: "string", description: "ID of the actor to direct" },
        waypoints: {
          type: "array",
          items: {
            type: "array",
            items: { type: "number" },
          },
          description: "List of [x, y, z] 3D coordinates defining the spline path",
        },
        motion: {
          type: "string",
          enum: ["walk", "run", "idle", "wave", "look_around"],
          description: "Kinematic gait action along the curve",
        },
        speed: { type: "number", description: "Velocity scalar (1.0 = normal)" },
      },
      required: ["actorId", "waypoints"],
    },
    samplePayload: {
      actorId: "actor_courier",
      waypoints: [
        [0, 0, 6],
        [-2, 0, 2],
        [1, 0, -3],
        [3, 0, -6],
      ],
      motion: "run",
      speed: 1.4,
    },
  },
  {
    name: "set_camera_cinematic",
    description: "Directs camera kinematics, focal length, tracking target, and shot style.",
    inputSchema: {
      type: "object",
      properties: {
        style: {
          type: "string",
          enum: ["orbit", "dolly", "shoulder_track", "static", "flyby"],
          description: "Cinematic shot formulation",
        },
        targetActorId: { type: "string", description: "Optional actor ID to track" },
        distance: { type: "number", description: "Distance from subject in meters" },
        height: { type: "number", description: "Camera elevation in meters" },
        fov: { type: "number", description: "Lens Field-of-View in degrees" },
        durationFrames: { type: "number", description: "Shot length in frames" },
      },
      required: ["style"],
    },
    samplePayload: {
      style: "dolly",
      targetActorId: "actor_courier",
      distance: 8.5,
      height: 3.2,
      fov: 35,
      durationFrames: 180,
    },
  },
  {
    name: "trigger_deterministic_render",
    description: "Executes an offline, frame-accurate video render using WebCodecs and muxers.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["mp4", "webm"],
          description: "Video container format",
        },
        aspectRatio: {
          type: "string",
          enum: ["16:9", "9:16", "1:1", "2.39:1"],
          description: "Framing ratio",
        },
        resolution: {
          type: "string",
          enum: ["720p", "1080p"],
          description: "Target render resolution",
        },
        fps: { type: "number", enum: [24, 30, 60], description: "Framerate" },
        durationFrames: { type: "number", description: "Total frames to bake" },
        filename: { type: "string", description: "Output file basename" },
      },
      required: ["format"],
    },
    samplePayload: {
      format: "mp4",
      aspectRatio: "16:9",
      resolution: "1080p",
      fps: 30,
      durationFrames: 180,
      filename: "Kosh_Narrative_Shot_01",
    },
  },
  {
    name: "evaluate_fcurve",
    description: "Samples a Bézier animation curve channel value at an arbitrary frame timestamp.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Target F-Curve channel ID" },
        frame: { type: "number", description: "Frame timestamp to evaluate" },
      },
      required: ["channelId", "frame"],
    },
    samplePayload: {
      channelId: "chan_cam_dolly",
      frame: 45,
    },
  },
  {
    name: "sync_audio_narration",
    description: "Bakes speech audio formant frequencies into jaw drop and mouth wide viseme keyframes.",
    inputSchema: {
      type: "object",
      properties: {
        audioUrl: { type: "string", description: "URL to audio file" },
        fps: { type: "number", description: "Animation framerate" },
        totalFrames: { type: "number", description: "Duration frames" },
      },
      required: ["audioUrl"],
    },
    samplePayload: {
      audioUrl: "/audio/narration_demo.wav",
      fps: 30,
      totalFrames: 180,
    },
  },
];

export interface McpDispatchResult {
  jsonrpc: "2.0";
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export function dispatchMcpTool(
  toolName: string,
  params: Record<string, any>,
  requestId: string | number = 1
): McpDispatchResult {
  const tool = DIRECTOR_MCP_TOOLS.find((t) => t.name === toolName);

  if (!tool) {
    return {
      jsonrpc: "2.0",
      id: requestId,
      error: {
        code: -32601,
        message: `Method '${toolName}' not found in Director MCP Tool Registry`,
      },
    };
  }

  // Validate required params
  const required = tool.inputSchema.required || [];
  for (const field of required) {
    if (params[field] === undefined) {
      return {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          code: -32602,
          message: `Invalid params: missing required property '${field}' for tool '${toolName}'`,
        },
      };
    }
  }

  // Simulated execution return
  return {
    jsonrpc: "2.0",
    id: requestId,
    result: {
      status: "SUCCESS",
      tool: toolName,
      timestamp: new Date().toISOString(),
      dispatchedParams: params,
    },
  };
}
