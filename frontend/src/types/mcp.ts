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

export interface McpToolDefinition {
  name: string;
  description: string;
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
  };
  storage: {
    path: string;
  };
  toolsCount: number;
  timestamp: number;
}
