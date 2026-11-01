package com.kosh.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kosh.dto.McpRpcRequest;
import com.kosh.dto.McpRpcResponse;
import com.kosh.dto.ToolExecutionDto;
import com.kosh.service.McpProgressListener;
import com.kosh.service.McpSceneStateService;
import com.kosh.service.McpToolRegistry;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@RestController
@RequestMapping("/mcp")
public class McpController {

    private final McpToolRegistry mcpToolRegistry;
    private final McpSceneStateService mcpSceneStateService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, SseEmitter> activeSseSessions = new ConcurrentHashMap<>();
    private final ExecutorService asyncWorkerPool = Executors.newCachedThreadPool();

    @org.springframework.beans.factory.annotation.Value("${kosh.gemini.api-key:}")
    private String defaultGeminiApiKey;

    @org.springframework.beans.factory.annotation.Value("${kosh.bharatcode.api-key:}")
    private String defaultBharatCodeApiKey;

    public McpController(McpToolRegistry mcpToolRegistry, McpSceneStateService mcpSceneStateService) {
        this.mcpToolRegistry = mcpToolRegistry;
        this.mcpSceneStateService = mcpSceneStateService;
    }

    /**
     * Server-Sent Events (SSE) connection endpoint for desktop agents (Claude Desktop, Cursor, Zed, Cline).
     * Dispatches the initial 'endpoint' event specifying where the client must POST JSON-RPC messages.
     */
    @GetMapping(value = {"/sse"}, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter handleSseConnection(HttpServletRequest request) {
        String sessionId = UUID.randomUUID().toString();
        // 30 minute timeout for persistent desktop agent sessions
        SseEmitter emitter = new SseEmitter(1800_000L);
        activeSseSessions.put(sessionId, emitter);

        emitter.onCompletion(() -> {
            log.info("MCP SSE session completed: {}", sessionId);
            activeSseSessions.remove(sessionId);
        });
        emitter.onTimeout(() -> {
            log.info("MCP SSE session timed out: {}", sessionId);
            activeSseSessions.remove(sessionId);
            emitter.complete();
        });
        emitter.onError(e -> {
            log.debug("MCP SSE session error for {}: {}", sessionId, e.getMessage());
            activeSseSessions.remove(sessionId);
            emitter.complete();
        });

        try {
            // Standard MCP SSE Specification: emit initial endpoint event
            String endpointUri = "/mcp/message?sessionId=" + sessionId;
            emitter.send(SseEmitter.event()
                    .name("endpoint")
                    .data(endpointUri));
            log.info("MCP SSE client connected: sessionId={}, endpoint={}", sessionId, endpointUri);
        } catch (IOException e) {
            log.warn("Failed to dispatch initial SSE endpoint event: {}", e.getMessage());
            emitter.complete();
        }

        return emitter;
    }

    /**
     * Top-level alias for GET /sse as required by desktop agent configurations.
     */
    @GetMapping(value = {"", "/"}, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter handleRootSse(HttpServletRequest request) {
        return handleSseConnection(request);
    }

    /**
     * Endpoint for SSE-connected clients to post JSON-RPC messages.
     * Intermediate progress notifications and final responses are streamed back over the SSE channel.
     */
    @PostMapping("/message")
    public ResponseEntity<?> handleSseMessage(
            @RequestParam(value = "sessionId", required = false) String sessionId,
            @RequestBody McpRpcRequest request,
            @RequestHeader(value = "X-Google-Key", required = false) String googleKeyHeader,
            @RequestHeader(value = "X-Gemini-Key", required = false) String geminiKeyHeader,
            @RequestHeader(value = "X-BharatCode-Token", required = false) String tokenHeader,
            @RequestHeader(value = "X-BharatCode-Key", required = false) String keyHeader,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        if (sessionId != null && activeSseSessions.containsKey(sessionId)) {
            SseEmitter emitter = activeSseSessions.get(sessionId);
            String activeToken = resolveApiToken(googleKeyHeader, geminiKeyHeader, tokenHeader, keyHeader, authHeader);

            // Execute asynchronously and stream notifications & response via SSE
            asyncWorkerPool.submit(() -> {
                try {
                    McpProgressListener progressListener = (progressToken, progress, total, message) -> {
                        sendSseNotification(emitter, McpRpcResponse.notification("notifications/progress", Map.of(
                                "progressToken", progressToken,
                                "progress", progress,
                                "total", total,
                                "message", message
                        )));
                    };

                    McpRpcResponse response = processRpcRequest(request, activeToken, progressListener);
                    sendSseMessage(emitter, response);
                } catch (Exception e) {
                    log.error("Error executing SSE request for session {}: {}", sessionId, e.getMessage(), e);
                    sendSseMessage(emitter, McpRpcResponse.error(request.getId(), -32603, "Internal server error: " + e.getMessage(), null));
                }
            });

            // Per MCP SSE specification, message receipt responds with HTTP 202 Accepted
            return ResponseEntity.accepted().body(Map.of("status", "accepted", "sessionId", sessionId));
        }

        // Fallback to synchronous HTTP execution if session is not active
        String activeToken = resolveApiToken(googleKeyHeader, geminiKeyHeader, tokenHeader, keyHeader, authHeader);
        McpRpcResponse response = processRpcRequest(request, activeToken, null);
        return ResponseEntity.ok(response);
    }

    /**
     * Standard synchronous JSON-RPC 2.0 HTTP POST endpoint.
     */
    @PostMapping
    public ResponseEntity<McpRpcResponse> handleRpcRequest(
            @RequestParam(value = "sessionId", required = false) String sessionId,
            @RequestBody McpRpcRequest request,
            @RequestHeader(value = "X-Google-Key", required = false) String googleKeyHeader,
            @RequestHeader(value = "X-Gemini-Key", required = false) String geminiKeyHeader,
            @RequestHeader(value = "X-BharatCode-Token", required = false) String tokenHeader,
            @RequestHeader(value = "X-BharatCode-Key", required = false) String keyHeader,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String activeToken = resolveApiToken(googleKeyHeader, geminiKeyHeader, tokenHeader, keyHeader, authHeader);

        McpProgressListener progressListener = null;
        if (sessionId != null && activeSseSessions.containsKey(sessionId)) {
            SseEmitter emitter = activeSseSessions.get(sessionId);
            progressListener = (progressToken, progress, total, message) -> {
                sendSseNotification(emitter, McpRpcResponse.notification("notifications/progress", Map.of(
                        "progressToken", progressToken,
                        "progress", progress,
                        "total", total,
                        "message", message
                )));
            };
        }

        McpRpcResponse response = processRpcRequest(request, activeToken, progressListener);
        return ResponseEntity.ok(response);
    }

    private McpRpcResponse processRpcRequest(McpRpcRequest request, String activeToken, McpProgressListener progressListener) {
        Object id = request.getId();
        String method = request.getMethod();

        log.info("Processing MCP JSON-RPC call: method={}, id={}", method, id);

        if (method == null || method.isBlank()) {
            return McpRpcResponse.error(id, -32600, "Invalid Request: 'method' is required", null);
        }

        try {
            switch (method) {
                case "initialize":
                    return McpRpcResponse.success(id, Map.of(
                            "protocolVersion", "2024-11-05",
                            "capabilities", Map.of(
                                    "tools", Map.of("listChanged", false),
                                    "resources", Map.of("subscribe", false, "listChanged", false),
                                    "prompts", Map.of("listChanged", false),
                                    "logging", Map.of()
                            ),
                            "serverInfo", Map.of(
                                    "name", "kosh-creative-hub",
                                    "version", "1.0.0"
                            )
                    ));

                case "notifications/initialized":
                case "ping":
                    return McpRpcResponse.success(id, Map.of("status", "pong"));

                case "tools/list":
                    List<Map<String, Object>> tools = mcpToolRegistry.listTools();
                    return McpRpcResponse.success(id, Map.of("tools", tools));

                case "resources/list":
                    return McpRpcResponse.success(id, Map.of(
                            "resources", List.of(
                                    Map.of(
                                            "uri", "kosh://scene/hierarchy",
                                            "name", "Active Scene Hierarchy Graph",
                                            "description", "Complete scene graph tree of objects, parent-child links, world transforms, and material IDs",
                                            "mimeType", "application/json"
                                    ),
                                    Map.of(
                                            "uri", "kosh://engine/capabilities",
                                            "name", "Kosh 3D Engine Capabilities",
                                            "description", "Blender version, installed Python packages (NumPy status), supported formats (.glb, .stl, .obj), and max polygon quotas",
                                            "mimeType", "application/json"
                                    ),
                                    Map.of(
                                            "uri", "kosh://materials/catalog",
                                            "name", "PBR Material Catalog",
                                            "description", "Ready-to-use studio PBR materials: MatteTitanium, ClearGlass, CastIron, NeonBlueEmissive, BrushedBrass, CarbonFiber, StudioClay",
                                            "mimeType", "application/json"
                                    ),
                                    Map.of(
                                            "uri", "kosh://scene/bounding-boxes",
                                            "name", "Scene World Space Bounding Boxes",
                                            "description", "Axis-Aligned Bounding Box (AABB) extents and metric dimensions for active scene meshes",
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
                    ));

                case "resources/read":
                    Map<String, Object> readParams = request.getParams();
                    String resourceUri = readParams != null && readParams.get("uri") != null ? readParams.get("uri").toString() : "";
                    return McpRpcResponse.success(id, Map.of(
                            "contents", List.of(
                                    Map.of(
                                            "uri", resourceUri,
                                            "mimeType", "application/json",
                                            "text", resolveResourceContent(resourceUri)
                                    )
                            )
                    ));

                case "prompts/list":
                    List<Map<String, Object>> prompts = mcpSceneStateService.getPromptsList();
                    return McpRpcResponse.success(id, Map.of("prompts", prompts));

                case "prompts/get":
                    Map<String, Object> promptParams = request.getParams();
                    if (promptParams == null || !promptParams.containsKey("name")) {
                        return McpRpcResponse.error(id, -32602, "Invalid params: 'name' is required for prompts/get", null);
                    }
                    String promptName = promptParams.get("name").toString();
                    @SuppressWarnings("unchecked")
                    Map<String, Object> promptArgs = promptParams.containsKey("arguments") && promptParams.get("arguments") instanceof Map<?, ?> m
                            ? (Map<String, Object>) m : Map.of();
                    Map<String, Object> promptPayload = mcpSceneStateService.getPrompt(promptName, promptArgs);
                    return McpRpcResponse.success(id, promptPayload);

                case "tools/call":
                    Map<String, Object> params = request.getParams();
                    if (params == null || !params.containsKey("name")) {
                        return McpRpcResponse.error(id, -32602, "Invalid params: 'name' is required for tools/call", null);
                    }

                    String toolName = (String) params.get("name");
                    @SuppressWarnings("unchecked")
                    Map<String, Object> arguments = new LinkedHashMap<>((Map<String, Object>) params.getOrDefault("arguments", Map.of()));

                    // Extract progressToken from _meta or params
                    String progressToken = null;
                    if (params.containsKey("_meta") && params.get("_meta") instanceof Map<?, ?> meta) {
                        Object pt = meta.get("progressToken");
                        if (pt != null) progressToken = pt.toString();
                    } else if (params.containsKey("progressToken")) {
                        progressToken = params.get("progressToken").toString();
                    }

                    // Smart CAD decomposition prompt enhancer
                    if (arguments.containsKey("prompt") && arguments.get("prompt") != null) {
                        String rawPrompt = arguments.get("prompt").toString();
                        arguments.put("prompt", enhanceCadPrompt(rawPrompt));
                    }

                    // Procedural CAD tools (cad_create_primitive, cad_boolean_operation, cad_apply_modifier, cad_inspect_scene)
                    // do not strictly require an AI token since they compile deterministic bpy geometry directly
                    boolean isProceduralTool = List.of(
                            "cad_create_primitive",
                            "cad_boolean_operation",
                            "cad_apply_modifier",
                            "cad_inspect_scene"
                    ).contains(toolName.toLowerCase());

                    boolean hasRawScript = arguments.containsKey("script") && arguments.get("script") != null && !arguments.get("script").toString().isBlank();

                    if (!isProceduralTool && !hasRawScript && (activeToken == null || activeToken.isBlank())) {
                        log.warn("Unauthorized tools/call: Missing Google Gemini API key");
                        return McpRpcResponse.error(
                                id,
                                -32001,
                                "Unauthorized: Missing Google Gemini API key. Provide header 'X-Google-Key', set GEMINI_API_KEY in .env, or use the UI key drawer.",
                                Map.of("provider", "Google Gemini (Free tier from https://aistudio.google.com/app/apikey)")
                        );
                    }

                    ToolExecutionDto.Result result = mcpToolRegistry.executeTool(toolName, arguments, activeToken, progressToken, progressListener);

                    if (!result.isSuccess()) {
                        return McpRpcResponse.error(
                                id,
                                -32000,
                                "Tool execution failed: " + result.getErrorMessage(),
                                result
                        );
                    }

                    // Return structured JSON text for inspection tool
                    if ("cad_inspect_scene".equalsIgnoreCase(toolName)) {
                        Map<String, Object> respData = new LinkedHashMap<>();
                        respData.put("content", List.of(
                                Map.of(
                                        "type", "text",
                                        "text", result.getStdout() != null ? result.getStdout() : "{}"
                                )
                        ));
                        respData.put("isError", false);
                        respData.put("execution", result);
                        if (progressToken != null) {
                            respData.put("_meta", Map.of("progressToken", progressToken, "progress", 1.0, "status", "completed"));
                        }
                        return McpRpcResponse.success(id, respData);
                    }

                    // Standard MCP tool result response structure
                    Map<String, Object> respData = new LinkedHashMap<>();
                    respData.put("content", List.of(
                            Map.of(
                                    "type", "text",
                                    "text", "Successfully generated 3D model: " + result.getAssetName() + " (" + result.getSizeBytes() + " bytes)"
                            )
                    ));
                    respData.put("isError", false);
                    respData.put("execution", result);
                    if (progressToken != null) {
                        respData.put("_meta", Map.of("progressToken", progressToken, "progress", 1.0, "status", "completed"));
                    }

                    return McpRpcResponse.success(id, respData);

                default:
                    return McpRpcResponse.error(id, -32601, "Method not found: " + method, null);
            }
        } catch (IllegalArgumentException e) {
            log.error("Invalid arguments in MCP call: {}", e.getMessage());
            return McpRpcResponse.error(id, -32602, e.getMessage(), null);
        } catch (Exception e) {
            log.error("Internal error processing MCP call: {}", e.getMessage(), e);
            return McpRpcResponse.error(id, -32603, "Internal server error: " + e.getMessage(), null);
        }
    }

    private void sendSseNotification(SseEmitter emitter, McpRpcResponse notification) {
        try {
            emitter.send(SseEmitter.event()
                    .name("message")
                    .data(objectMapper.writeValueAsString(notification)));
        } catch (Exception e) {
            log.debug("Failed to send SSE notification: {}", e.getMessage());
        }
    }

    private void sendSseMessage(SseEmitter emitter, McpRpcResponse response) {
        try {
            emitter.send(SseEmitter.event()
                    .name("message")
                    .data(objectMapper.writeValueAsString(response)));
        } catch (Exception e) {
            log.debug("Failed to send SSE message: {}", e.getMessage());
        }
    }

    private String resolveApiToken(String googleKey, String geminiKey, String token, String key, String auth) {
        if (googleKey != null && !googleKey.isBlank()) return googleKey.trim();
        if (geminiKey != null && !geminiKey.isBlank()) return geminiKey.trim();
        if (token != null && !token.isBlank()) return token.trim();
        if (key != null && !key.isBlank()) return key.trim();
        if (auth != null && !auth.isBlank()) return auth.replaceFirst("(?i)^Bearer\\s+", "").trim();

        if (defaultGeminiApiKey != null && !defaultGeminiApiKey.isBlank()) return defaultGeminiApiKey.trim();
        if (System.getenv("GEMINI_API_KEY") != null && !System.getenv("GEMINI_API_KEY").isBlank()) {
            return System.getenv("GEMINI_API_KEY").trim();
        }
        return "demo";
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

    private String resolveResourceContent(String uri) {
        if ("kosh://scene/hierarchy".equals(uri)) {
            return mcpSceneStateService.getSceneHierarchyJson();
        } else if ("kosh://engine/capabilities".equals(uri)) {
            return mcpSceneStateService.getEngineCapabilitiesJson();
        } else if ("kosh://materials/catalog".equals(uri)) {
            return mcpSceneStateService.getMaterialsCatalogJson();
        } else if ("kosh://materials/library".equals(uri)) {
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
            return mcpSceneStateService.getSceneHierarchyJson();
        }
    }
}
