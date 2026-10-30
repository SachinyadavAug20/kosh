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

    public McpController(McpToolRegistry mcpToolRegistry) {
        this.mcpToolRegistry = mcpToolRegistry;
    }

    @PostMapping
    public ResponseEntity<McpRpcResponse> handleRpcRequest(
            @RequestBody McpRpcRequest request,
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

        // Determine user API token (BYOK)
        String activeToken = null;
        if (tokenHeader != null && !tokenHeader.isBlank()) {
            activeToken = tokenHeader.trim();
        } else if (keyHeader != null && !keyHeader.isBlank()) {
            activeToken = keyHeader.trim();
        } else if (authHeader != null && !authHeader.isBlank()) {
            activeToken = authHeader.replaceFirst("(?i)^Bearer\\s+", "").trim();
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
                        log.warn("Unauthorized tools/call: Missing BharatCode API token");
                        return ResponseEntity.status(401).body(McpRpcResponse.error(
                                id,
                                -32001,
                                "Unauthorized: Missing BharatCode API token. Provide header 'X-BharatCode-Token', 'X-BharatCode-Key', or 'Authorization: Bearer <token>'",
                                Map.of("requiredHeader", "X-BharatCode-Token")
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
