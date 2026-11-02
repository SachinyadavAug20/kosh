"use client";

import { useState, useCallback, useEffect } from "react";
import * as THREE from "three";
import {
  BackendHealth,
  McpRpcRequest,
  McpRpcResponse,
  McpToolDefinition,
  ToolExecutionResult,
  ExportFormat,
} from "@/types/mcp";
import { buildBatchCsgGeometry, buildKitGeometry } from "@/lib/cad/ManifoldEngine";
import { executeNamedBoolean } from "@/lib/cad/ClientCsgEngine";
import { geometryToGlbObjectUrl } from "@/lib/cad/glbExport";
import { getCachedAsset, putCachedAsset, hashCacheKey } from "@/lib/cache/ModelCache";

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "http://localhost:8080/mcp";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || MCP_URL.replace(/\/mcp\/?$/, "");
const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_URL || `${API_BASE}/api/assets`;

async function maybeBuildLocalCsg(
  toolName: string,
  args: Record<string, unknown>
): Promise<THREE.BufferGeometry | null> {
  try {
    if (toolName === "cad_batch_csg") {
      return await buildBatchCsgGeometry(args);
    }
    if (toolName === "cad_assemble_kit") {
      return await buildKitGeometry(args);
    }
    if (toolName === "cad_boolean_operation") {
      const mesh = executeNamedBoolean(args);
      if (mesh) return mesh.geometry;
    }
  } catch (e) {
    console.warn(`Local client CSG failed for ${toolName}, falling back to backend:`, e);
  }
  return null;
}

function localResult(
  toolName: string,
  assetUrl: string,
  format: ExportFormat,
  startedAt: number,
  sizeBytes = 0
): ToolExecutionResult {
  return {
    success: true,
    toolName,
    assetId: `local_${Date.now()}`,
    assetName: `kosh_local_${Date.now()}.glb`,
    assetUrl,
    format,
    sizeBytes,
    exitCode: 0,
    executionTimeMs: Math.round(performance.now() - startedAt),
  };
}

export function useMcpClient() {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [tools, setTools] = useState<McpToolDefinition[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isHealthChecking, setIsHealthChecking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ToolExecutionResult | null>(null);

  // Check backend health
  const checkHealth = useCallback(async () => {
    setIsHealthChecking(true);
    try {
      const res = await fetch(`${API_BASE}/api/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data: BackendHealth = await res.json();
        setHealth(data);
        setError(null);
      } else {
        setHealth(null);
        setError(`Backend responded with status ${res.status}`);
      }
    } catch (e: any) {
      setHealth(null);
      setError(`Cannot connect to Kosh MCP backend at ${API_BASE}`);
    } finally {
      setIsHealthChecking(false);
    }
  }, []);

  // Fetch registered tools via MCP tools/list
  const fetchTools = useCallback(async () => {
    try {
      const payload: McpRpcRequest = {
        jsonrpc: "2.0",
        id: "list-tools-" + Date.now(),
        method: "tools/list",
      };

      const res = await fetch(MCP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) return;

      const data: McpRpcResponse<{ tools: McpToolDefinition[] }> = await res.json();
      if (data.result?.tools) {
        setTools(data.result.tools);
      }
    } catch (e) {
      console.warn("Failed to fetch MCP tools:", e);
    }
  }, []);

  // Execute MCP tool call
  const executeTool = useCallback(
    async (
      toolName: string,
      args: { prompt?: string; script?: string; previousScript?: string; format?: ExportFormat },
      token?: string
    ): Promise<ToolExecutionResult | null> => {
      setIsLoading(true);
      setError(null);
      const startedAt = performance.now();
      const rawArgs = args as unknown as Record<string, unknown>;

      // Instant client-side CSG: no network round-trip, no Blender subprocess
      const localGeometry = await maybeBuildLocalCsg(toolName, rawArgs);
      if (localGeometry) {
        try {
          const assetUrl = await geometryToGlbObjectUrl(localGeometry);
          const execution = localResult(toolName, assetUrl, args.format || "glb", startedAt);
          setLastResult(execution);
          setIsLoading(false);
          return execution;
        } catch (e) {
          console.warn("Local GLB export failed, falling back to backend:", e);
        }
      }

      // IndexedDB model cache: identical prompts/scripts resolve without a server hit
      const isGenerationCall = Boolean(args.prompt || args.script) || toolName === "cad_model";
      const cacheKey = isGenerationCall ? hashCacheKey(toolName, args) : null;
      if (cacheKey) {
        const cached = await getCachedAsset(cacheKey);
        if (cached) {
          const assetUrl = URL.createObjectURL(
            new Blob([cached], { type: "model/gltf-binary" })
          );
          const execution = localResult(toolName, assetUrl, args.format || "glb", startedAt, cached.byteLength);
          execution.assetId = "cache_hit";
          execution.assetName = `kosh_cached_${Date.now()}.glb`;
          setLastResult(execution);
          setIsLoading(false);
          return execution;
        }
      }

      const payload: McpRpcRequest = {
        jsonrpc: "2.0",
        id: "call-" + Date.now(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token && token.trim()) {
        const cleanToken = token.trim();
        headers["Authorization"] = `Bearer ${cleanToken}`;
        headers["X-Google-Key"] = cleanToken;
        headers["X-BharatCode-Token"] = cleanToken;
      }

      try {
        const res = await fetch(MCP_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        const rpcResponse: McpRpcResponse = await res.json();

        if (rpcResponse.error) {
          const errMsg = rpcResponse.error.message || "MCP execution failed";
          setError(errMsg);
          if (rpcResponse.error.data && (rpcResponse.error.data as any).stderr) {
            setLastResult(rpcResponse.error.data as ToolExecutionResult);
          }
          return null;
        }

        const execution: ToolExecutionResult =
          rpcResponse.result?.execution || {
            success: true,
            toolName,
            assetId: "unknown",
            assetName: "model.glb",
            format: args.format || "glb",
            sizeBytes: 0,
            exitCode: 0,
            executionTimeMs: 0,
          };

        if (cacheKey && execution.success && execution.assetUrl) {
          const absoluteUrl = /^https?:/.test(execution.assetUrl)
            ? execution.assetUrl
            : `${API_BASE}${execution.assetUrl}`;
          fetch(absoluteUrl)
            .then((res) => (res.ok ? res.arrayBuffer() : null))
            .then((buffer) => {
              if (buffer) void putCachedAsset(cacheKey, buffer);
            })
            .catch(() => {});
        }

        setLastResult(execution);
        return execution;
      } catch (e: any) {
        const msg = e.message || "Network error connecting to MCP server";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    checkHealth();
    fetchTools();
  }, [checkHealth, fetchTools]);

  return {
    health,
    tools,
    isLoading,
    isHealthChecking,
    error,
    lastResult,
    checkHealth,
    fetchTools,
    executeTool,
    apiBase: API_BASE,
  };
}
