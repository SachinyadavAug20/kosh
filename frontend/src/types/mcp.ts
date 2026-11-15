export interface McpRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

export interface McpRpcError {
  code: number;
  message: string;
  data?: any;
}

export interface McpRpcResponse<T = any> {
  jsonrpc: "2.0";
  id: string | number;
  result?: T;
  error?: McpRpcError;
}

export interface McpToolProperty {
  type: string;
  description?: string;
  enum?: string[];
}

export interface McpToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  annotations?: McpToolAnnotations;
  inputSchema: {
    type: "object";
    properties: Record<string, McpToolProperty>;
    required?: string[];
  };
}

export type ExportFormat = "glb" | "stl" | "obj" | "fbx" | "usdz" | "blend";

export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  assetId?: string;
  assetName: string;
  assetUrl?: string;
  snapshotUrl?: string;
  telemetry?: {
    triangles: number;
    vertices: number;
    edges: number;
    dimensions: [number, number, number];
    materials: string[];
    objects: string[];
  };
  format: ExportFormat;
  sizeBytes?: number;
  script?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  executionTimeMs?: number;
  errorMessage?: string;
}

export interface BackendHealth {
  status: string;
  service: string;
  blender: {
    available: boolean;
    executable: string;
    version: string;
    /** Warm daemon socket liveness (false on hosts without Blender, e.g. Render). */
    daemonAlive: boolean;
  };
  storage: {
    path: string;
    writable: boolean;
  };
  mcp: {
    toolsCount: number;
    resourcesCount: number;
    promptsCount: number;
  };
  runtime: {
    uptimeSeconds: number;
    usedHeapMb: number;
    maxHeapMb: number;
    availableProcessors: number;
  };
  /** Legacy top-level count kept in sync with mcp.toolsCount. */
  toolsCount: number;
  trustScore?: {
    overallScore: number;
    cves: number;
    license: string;
    status: string;
    codeQuality?: number;
    url?: string;
  };
  timestamp: number;
}
