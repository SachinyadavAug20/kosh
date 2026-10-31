"use client";

import { useState, useCallback, useEffect } from "react";
import {
  BackendHealth,
  McpRpcRequest,
  McpRpcResponse,
  McpToolDefinition,
  ToolExecutionResult,
  ExportFormat,
} from "@/types/mcp";

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "http://localhost:8080/mcp";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || MCP_URL.replace(/\/mcp\/?$/, "");
const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_URL || `${API_BASE}/api/assets`;

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
