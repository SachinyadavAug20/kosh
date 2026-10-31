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
            } else if (System.getenv("GEMINI_API_KEY") != null && !System.getenv("GEMINI_API_KEY").isBlank()) {
                activeToken = System.getenv("GEMINI_API_KEY").trim();
            } else {
                activeToken = "demo";
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

                case "resources/list":
                    return ResponseEntity.ok(McpRpcResponse.success(id, Map.of(
                            "resources", List.of(
                                    Map.of(
                                            "uri", "kosh://scene/hierarchy",
                                            "name", "Active Scene Hierarchy Graph",
                                            "description", "Complete scene graph tree of objects, UUIDs, names, parents, and matrix transforms",
                                            "mimeType", "application/json"
                                    ),
                                    Map.of(
                                            "uri", "kosh://scene/bounding-boxes",
                                            "name", "Scene World Space Bounding Boxes",
                                            "description", "Axis-Aligned Bounding Box (AABB) extents and millimeter/meter dimensions for all active meshes",
                                            "mimeType", "application/json"
                                    ),
                                    Map.of(
                                            "uri", "kosh://materials/library",
                                            "name", "Studio PBR & MatCap Material Library",
                                            "description", "Built-in CAD material presets (Titanium, Frosted Acrylic, Clay, Redwax, Chrome, Brass, Neon Emissive)",
                                            "mimeType", "application/json"
                                    ),
                                    Map.of(
                                            "uri", "kosh://viewport/active-selection",
                                            "name", "Active Viewport Selection & Modifier Stack",
                                            "description", "Currently selected entity metadata: vertex list, face count, active modifier stack, and transform matrices",
                                            "mimeType", "application/json"
                                    )
                            )
                    )));

                case "resources/read":
                    Map<String, Object> readParams = request.getParams();
                    String resourceUri = readParams != null && readParams.get("uri") != null ? readParams.get("uri").toString() : "";
                    return ResponseEntity.ok(McpRpcResponse.success(id, Map.of(
                            "contents", List.of(
                                    Map.of(
                                            "uri", resourceUri,
                                            "mimeType", "application/json",
                                            "text", getResourceContentJson(resourceUri)
                                    )
                            )
                    )));

                case "tools/call":
                    Map<String, Object> params = request.getParams();
                    if (params == null || !params.containsKey("name")) {
                        return ResponseEntity.ok(McpRpcResponse.error(id, -32602, "Invalid params: 'name' is required for tools/call", null));
                    }

                    String toolName = (String) params.get("name");
                    @SuppressWarnings("unchecked")
                    Map<String, Object> arguments = new java.util.LinkedHashMap<>((Map<String, Object>) params.getOrDefault("arguments", Map.of()));

                    // Smart Prompt Enhancer: pre-flight CAD decomposition if prompt is provided
                    if (arguments.containsKey("prompt") && arguments.get("prompt") != null) {
                        String rawPrompt = arguments.get("prompt").toString();
                        arguments.put("prompt", enhanceCadPrompt(rawPrompt));
                    }

                    // Check if token is required (when prompt is provided without raw script)
                    boolean hasRawScript = arguments.containsKey("script") && arguments.get("script") != null && !arguments.get("script").toString().isBlank();
                    if (!hasRawScript && (activeToken == null || activeToken.isBlank())) {
                        log.warn("Unauthorized tools/call: Missing Google Gemini API key");
                        return ResponseEntity.status(401).body(McpRpcResponse.error(
                                id,
                                -32001,
                                "Unauthorized: Missing Google Gemini API key. Provide header 'X-Google-Key', set GEMINI_API_KEY in .env, or use the UI key drawer.",
                                Map.of("provider", "Google Gemini (Free tier from https://aistudio.google.com/app/apikey)")
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

    private String enhanceCadPrompt(String userPrompt) {
        if (userPrompt == null || userPrompt.isBlank()) return userPrompt;
        String trimmed = userPrompt.trim();
        if (trimmed.length() > 150 && trimmed.contains("bpy.ops")) return trimmed;

        return String.format(
            "CAD PARAMETRIC DECOMPOSITION SPECIFICATION:\n" +
            "- Target Model: \"%s\"\n" +
            "- Primary Body: Construct clean primary solid volumes with real-world proportions in meters.\n" +
            "- Subtractive Cuts: Apply difference booleans for precision bores, hollows, cavities, and weight-reduction slots.\n" +
            "- Additive Detail: Join functional accents, rims, bezels, fasteners, and ergonomic grips using union.\n" +
            "- Edge Treatments: Chamfer/bevel sharp mechanical corners (3 segments, 0.01-0.03m radius).\n" +
            "- Materials: Assign high-contrast PBR Principled BSDF shaders with realistic roughness, metallic sheen, and accent highlights.\n" +
            "- Origin & Floor: Align model bottom flush with ground plane (Z=0) with origin at bottom-center.",
            trimmed
        );
    }

    private String getResourceContentJson(String uri) {
        if ("kosh://materials/library".equals(uri)) {
            return """
                {
                    "presets": [
                        {"id": "dark_titanium", "name": "Dark Titanium", "color": "#1f242d", "roughness": 0.28, "metalness": 0.95},
                        {"id": "brushed_brass", "name": "Brushed Brass", "color": "#d4af37", "roughness": 0.35, "metalness": 0.90},
                        {"id": "frosted_acrylic", "name": "Frosted Acrylic", "color": "#e0f2fe", "roughness": 0.15, "metalness": 0.05, "transmission": 0.85},
                        {"id": "studio_clay", "name": "Studio Clay", "color": "#c2410c", "roughness": 0.75, "metalness": 0.0},
                        {"id": "redwax_sculpt", "name": "Redwax Sculpt", "color": "#dc2626", "roughness": 0.40, "metalness": 0.10},
                        {"id": "mirror_chrome", "name": "Mirror Chrome", "color": "#f8fafc", "roughness": 0.05, "metalness": 1.0},
                        {"id": "cyber_neon_cyan", "name": "Cyber Neon Cyan", "color": "#06b6d4", "roughness": 0.20, "metalness": 0.80, "emission": "#22d3ee"}
                    ]
                }
                """;
        } else if ("kosh://scene/bounding-boxes".equals(uri)) {
            return """
                {
                    "units": "meters",
                    "coordinateSystem": "Z-up",
                    "defaultAABB": {"min": [-1.0, -1.0, 0.0], "max": [1.0, 1.0, 2.0], "dimensions": [2.0, 2.0, 2.0]}
                }
                """;
        } else if ("kosh://viewport/active-selection".equals(uri)) {
            return """
                {
                    "selectedMesh": null,
                    "modifiers": ["subdivision_surface", "boolean_csg", "bevel_modifier", "mirror_axis", "array_offset"],
                    "transform": {"position": [0,0,0], "rotation": [0,0,0], "scale": [1,1,1]}
                }
                """;
        } else {
            return """
                {
                    "root": "Scene",
                    "entities": [],
                    "camera": {"fov": 50, "projection": "perspective"},
                    "environment": {"lighting": "studio_cad", "grid": "infinite_metric"}
                }
                """;
        }
    }
}
