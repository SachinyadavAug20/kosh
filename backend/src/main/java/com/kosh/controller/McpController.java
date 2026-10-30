package com.kosh.controller;

import com.kosh.dto.McpRpcRequest;
import com.kosh.dto.McpRpcResponse;
import com.kosh.dto.ToolExecutionDto;
import com.kosh.service.McpToolRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/mcp")
public class McpController {

    private final McpToolRegistry mcpToolRegistry;

    @org.springframework.beans.factory.annotation.Value("${kosh.gemini.api-key:}")
    private String defaultGeminiApiKey;

    @org.springframework.beans.factory.annotation.Value("${kosh.bharatcode.api-key:}")
    private String defaultBharatCodeApiKey;

    public McpController(McpToolRegistry mcpToolRegistry) {
        this.mcpToolRegistry = mcpToolRegistry;
    }

    @PostMapping
    public ResponseEntity<McpRpcResponse> handleRpcRequest(
            @RequestBody McpRpcRequest request,
            @RequestHeader(value = "X-Google-Key", required = false) String googleKeyHeader,
            @RequestHeader(value = "X-Gemini-Key", required = false) String geminiKeyHeader,
            @RequestHeader(value = "X-BharatCode-Token", required = false) String tokenHeader,
            @RequestHeader(value = "X-BharatCode-Key", required = false) String keyHeader,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Object id = request.getId();
        String method = request.getMethod();

        log.info("Received MCP JSON-RPC call: method={}, id={}", method, id);

        if (method == null || method.isBlank()) {
            return ResponseEntity.badRequest().body(
                    McpRpcResponse.error(id, -32600, "Invalid Request: 'method' is required", null)
            );
        }

        // Determine user API token (BYOK session headers prioritized; falls back to environment defaults)
        String activeToken = null;
        if (googleKeyHeader != null && !googleKeyHeader.isBlank()) {
            activeToken = googleKeyHeader.trim();
        } else if (geminiKeyHeader != null && !geminiKeyHeader.isBlank()) {
            activeToken = geminiKeyHeader.trim();
        } else if (tokenHeader != null && !tokenHeader.isBlank()) {
            activeToken = tokenHeader.trim();
        } else if (keyHeader != null && !keyHeader.isBlank()) {
            activeToken = keyHeader.trim();
        } else if (authHeader != null && !authHeader.isBlank()) {
            activeToken = authHeader.replaceFirst("(?i)^Bearer\\s+", "").trim();
        }

        if (activeToken == null || activeToken.isBlank()) {
            if (defaultGeminiApiKey != null && !defaultGeminiApiKey.isBlank()) {
                activeToken = defaultGeminiApiKey.trim();
            } else if (defaultBharatCodeApiKey != null && !defaultBharatCodeApiKey.isBlank()) {
                activeToken = defaultBharatCodeApiKey.trim();
            }
        }

        try {
            switch (method) {
                case "initialize":
                    return ResponseEntity.ok(McpRpcResponse.success(id, Map.of(
                            "protocolVersion", "2024-11-05",
                            "capabilities", Map.of(
                                    "tools", Map.of("listChanged", false)
                            ),
                            "serverInfo", Map.of(
                                    "name", "kosh-creative-hub",
                                    "version", "1.0.0"
                            )
                    )));

                case "notifications/initialized":
                case "ping":
                    return ResponseEntity.ok(McpRpcResponse.success(id, Map.of("status", "pong")));

                case "tools/list":
                    List<Map<String, Object>> tools = mcpToolRegistry.listTools();
                    return ResponseEntity.ok(McpRpcResponse.success(id, Map.of("tools", tools)));

                case "tools/call":
                    Map<String, Object> params = request.getParams();
                    if (params == null || !params.containsKey("name")) {
                        return ResponseEntity.ok(McpRpcResponse.error(id, -32602, "Invalid params: 'name' is required for tools/call", null));
                    }

                    String toolName = (String) params.get("name");
                    @SuppressWarnings("unchecked")
                    Map<String, Object> arguments = (Map<String, Object>) params.getOrDefault("arguments", Map.of());

                    // Check if token is required (when prompt is provided without raw script)
                    boolean hasRawScript = arguments.containsKey("script") && arguments.get("script") != null && !arguments.get("script").toString().isBlank();
                    if (!hasRawScript && (activeToken == null || activeToken.isBlank())) {
                        log.warn("Unauthorized tools/call: Missing API key");
                        return ResponseEntity.status(401).body(McpRpcResponse.error(
                                id,
                                -32001,
                                "Unauthorized: Missing API key. Provide your Google Gemini API key or BharatCode token via headers ('X-Google-Key', 'X-BharatCode-Token', or 'Authorization: Bearer <key>') or the UI key drawer.",
                                Map.of("supportedProviders", List.of("Google Gemini (Free via AI Studio)", "BharatCode", "OpenAI"))
                        ));
                    }

                    ToolExecutionDto.Result result = mcpToolRegistry.executeTool(toolName, arguments, activeToken);

                    if (!result.isSuccess()) {
                        return ResponseEntity.ok(McpRpcResponse.error(
                                id,
                                -32000,
                                "Tool execution failed: " + result.getErrorMessage(),
                                result
                        ));
                    }

                    // Standard MCP tool result response structure
                    return ResponseEntity.ok(McpRpcResponse.success(id, Map.of(
                            "content", List.of(
                                    Map.of(
                                            "type", "text",
                                            "text", "Successfully generated 3D model: " + result.getAssetName() + " (" + result.getSizeBytes() + " bytes)"
                                    )
                            ),
                            "isError", false,
                            "execution", result
                    )));

                default:
                    return ResponseEntity.ok(McpRpcResponse.error(
                            id,
                            -32601,
                            "Method not found: " + method,
                            null
                    ));
            }
        } catch (IllegalArgumentException e) {
            log.error("Invalid arguments in MCP call: {}", e.getMessage());
            return ResponseEntity.ok(McpRpcResponse.error(id, -32602, e.getMessage(), null));
        } catch (Exception e) {
            log.error("Internal error processing MCP call: {}", e.getMessage(), e);
            return ResponseEntity.ok(McpRpcResponse.error(id, -32603, "Internal server error: " + e.getMessage(), null));
        }
    }
}
