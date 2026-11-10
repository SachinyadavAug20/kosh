package com.kosh.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kosh.dto.McpRpcRequest;
import com.kosh.dto.McpRpcResponse;
import com.kosh.dto.ToolExecutionDto;
import com.kosh.service.McpProgressListener;
import com.kosh.service.McpPromptRegistry;
import com.kosh.service.McpResourceRegistry;
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

@Slf4j
@RestController
@RequestMapping("/mcp")
public class McpController {

    private final McpToolRegistry mcpToolRegistry;
    private final McpResourceRegistry mcpResourceRegistry;
    private final McpPromptRegistry mcpPromptRegistry;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, SseEmitter> activeSseSessions = new ConcurrentHashMap<>();
    private final ExecutorService asyncWorkerPool;

    @org.springframework.beans.factory.annotation.Value("${kosh.gemini.api-key:}")
    private String defaultGeminiApiKey;

    @org.springframework.beans.factory.annotation.Value("${kosh.bharatcode.api-key:}")
    private String defaultBharatCodeApiKey;

    public McpController(McpToolRegistry mcpToolRegistry,
                         McpResourceRegistry mcpResourceRegistry,
                         McpPromptRegistry mcpPromptRegistry,
                         @org.springframework.beans.factory.annotation.Qualifier("mcpWorkerPool")
                         ExecutorService asyncWorkerPool) {
        this.mcpToolRegistry = mcpToolRegistry;
        this.mcpResourceRegistry = mcpResourceRegistry;
        this.mcpPromptRegistry = mcpPromptRegistry;
        this.asyncWorkerPool = asyncWorkerPool;
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
                            "resources", mcpResourceRegistry.listResources()
                    ));

                case "resources/read":
                    Map<String, Object> readParams = request.getParams();
                    String resourceUri = readParams != null && readParams.get("uri") != null ? readParams.get("uri").toString() : "";
                    try {
                        String resourceText = mcpResourceRegistry.readResource(resourceUri);
                        return McpRpcResponse.success(id, Map.of(
                                "contents", List.of(
                                        Map.of(
                                                "uri", resourceUri,
                                                "mimeType", "application/json",
                                                "text", resourceText
                                        )
                                )
                        ));
                    } catch (IllegalArgumentException e) {
                        return McpRpcResponse.error(id, -32602, e.getMessage(), null);
                    }

                case "prompts/list":
                    return McpRpcResponse.success(id, Map.of("prompts", mcpPromptRegistry.listPrompts()));

                case "prompts/get":
                    Map<String, Object> promptParams = request.getParams();
                    if (promptParams == null || !promptParams.containsKey("name")) {
                        return McpRpcResponse.error(id, -32602, "Invalid params: 'name' is required for prompts/get", null);
                    }
                    String promptName = promptParams.get("name").toString();
                    @SuppressWarnings("unchecked")
                    Map<String, Object> promptArgs = promptParams.containsKey("arguments") && promptParams.get("arguments") instanceof Map<?, ?> m
                            ? (Map<String, Object>) m : Map.of();
                    try {
                        Map<String, Object> promptPayload = mcpPromptRegistry.getPrompt(promptName, promptArgs);
                        return McpRpcResponse.success(id, promptPayload);
                    } catch (IllegalArgumentException e) {
                        return McpRpcResponse.error(id, -32602, e.getMessage(), null);
                    }

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

                    // Procedural CAD tools compile deterministic bpy geometry directly
                    // and do not strictly require an external AI token.
                    boolean isProceduralTool = List.of(
                            "cad_create_primitive",
                            "cad_boolean_operation",
                            "cad_apply_modifier",
                            "cad_inspect_scene",
                            "cad_assemble_kit",
                            "cad_assemble_puzzle_pieces",
                            "cad_batch_csg",
                            "cad_apply_fillet_chamfer",
                            "cad_quick_fillet_chamfer",
                            "cad_measure_dimensions",
                            "cad_hollow_shell",
                            "cad_generate_threads",
                            "cad_apply_pbr_preset",
                            "cad_studio_lighting_preset",
                            "cad_batch_multiview_render",
                            "cad_lattice_infill",
                            "kosh_system_health",
                            "cad_convex_hull",
                            "cad_separate_loose_parts",
                            "cad_project_curve_cut",
                            "cad_generate_gear",
                            "cad_uv_unwrap_auto",
                            "cad_wireframe_cage",
                        "cad_point_cloud_surface",
                        "cad_export_engineering_drawing",
                        "cad_linear_array",
                        "cad_radial_array",
                        "cad_text_emboss",
                        "cad_check_manifold"
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

                    // Return stdout in content text if populated (e.g. JSON reports, SVGs, diagnostics)
                    String contentText = (result.getStdout() != null && !result.getStdout().isBlank())
                            ? result.getStdout()
                            : "Successfully generated 3D model: " + result.getAssetName() + " (" + result.getSizeBytes() + " bytes)";

                    Map<String, Object> respData = new LinkedHashMap<>();
                    respData.put("content", List.of(
                            Map.of(
                                    "type", "text",
                                    "text", contentText
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
}
