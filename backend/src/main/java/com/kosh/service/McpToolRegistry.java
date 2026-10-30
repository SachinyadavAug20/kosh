package com.kosh.service;

import com.kosh.dto.ToolExecutionDto;
import com.kosh.util.ScriptSanitizer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class McpToolRegistry {

    private final GoogleGeminiClient googleGeminiClient;
    private final BharatCodeClient bharatCodeClient;
    private final BlenderExecutionService blenderExecutionService;
    private final ScriptSanitizer scriptSanitizer;

    public McpToolRegistry(GoogleGeminiClient googleGeminiClient,
                           BharatCodeClient bharatCodeClient,
                           BlenderExecutionService blenderExecutionService,
                           ScriptSanitizer scriptSanitizer) {
        this.googleGeminiClient = googleGeminiClient;
        this.bharatCodeClient = bharatCodeClient;
        this.blenderExecutionService = blenderExecutionService;
        this.scriptSanitizer = scriptSanitizer;
    }

    /**
     * Lists registered MCP tools matching the JSON-RPC Model Context Protocol specification.
     */
    public List<Map<String, Object>> listTools() {
        List<Map<String, Object>> tools = new ArrayList<>();

        // 1. blender_mesh
        Map<String, Object> meshTool = new LinkedHashMap<>();
        meshTool.put("name", "blender_mesh");
        meshTool.put("description", "Generate procedural 3D meshes and scenes in Blender using natural language prompts or raw bpy code, exporting to optimized binary GLTF (.glb).");
        meshTool.put("inputSchema", Map.of(
                "type", "object",
                "properties", Map.of(
                        "prompt", Map.of(
                                "type", "string",
                                "description", "Natural language description of the 3D geometry, materials, and form."
                        ),
                        "script", Map.of(
                                "type", "string",
                                "description", "Optional raw Blender Python (bpy) script. If provided, bypasses LLM generation."
                        ),
                        "format", Map.of(
                                "type", "string",
                                "description", "Export format: 'glb' (default) or 'stl'",
                                "enum", List.of("glb", "stl")
                        )
                ),
                "required", List.of()
        ));
        tools.add(meshTool);

        // 2. cad_model
        Map<String, Object> cadTool = new LinkedHashMap<>();
        cadTool.put("name", "cad_model");
        cadTool.put("description", "Generate parametric mechanical CAD components and engineering parts with precise CSG boolean operations, exporting to .glb or .stl.");
        cadTool.put("inputSchema", Map.of(
                "type", "object",
                "properties", Map.of(
                        "prompt", Map.of(
                                "type", "string",
                                "description", "Engineering/CAD prompt with mechanical specifications (dimensions, bores, flanges, teeth, threads)."
                        ),
                        "script", Map.of(
                                "type", "string",
                                "description", "Optional raw bpy script with boolean modifiers."
                        ),
                        "format", Map.of(
                                "type", "string",
                                "description", "Export format: 'glb' (default) or 'stl'",
                                "enum", List.of("glb", "stl")
                        )
                ),
                "required", List.of()
        ));
        tools.add(cadTool);

        return tools;
    }

    /**
     * Executes a tool invocation requested via MCP JSON-RPC.
     */
    public ToolExecutionDto.Result executeTool(String toolName, Map<String, Object> arguments, String token) {
        if (!"blender_mesh".equalsIgnoreCase(toolName) && !"cad_model".equalsIgnoreCase(toolName)) {
            throw new IllegalArgumentException("Unknown tool name: " + toolName + ". Supported tools: blender_mesh, cad_model");
        }

        String prompt = arguments != null && arguments.get("prompt") != null ? arguments.get("prompt").toString() : null;
        String rawScript = arguments != null && arguments.get("script") != null ? arguments.get("script").toString() : null;
        String format = arguments != null && arguments.get("format") != null ? arguments.get("format").toString() : "glb";

        String finalScript;

        if (rawScript != null && !rawScript.isBlank()) {
            log.info("Executing user-provided script for tool: {}", toolName);
            finalScript = scriptSanitizer.sanitize(rawScript);
        } else if (prompt != null && !prompt.isBlank()) {
            // Determine whether to use Google Gemini or BharatCode based on key signature or default
            boolean isGoogleKey = token != null && (token.startsWith("AIzaSy") || token.contains("AIza"));
            if (isGoogleKey) {
                log.info("Generating script from prompt using Google Gemini for tool: {}", toolName);
                finalScript = googleGeminiClient.generateBlenderScript(prompt, toolName, token, format);
            } else {
                log.info("Generating script from prompt using BharatCode/OpenAI client for tool: {}", toolName);
                finalScript = bharatCodeClient.generateBlenderScript(prompt, toolName, token, format);
            }
        } else {
            throw new IllegalArgumentException("Either 'prompt' or 'script' must be supplied in tool arguments.");
        }

        BlenderExecutionService.BlenderRunResult runResult = blenderExecutionService.executeScript(finalScript, format);

        String assetUrl = runResult.isSuccess() ? "/api/assets/" + runResult.getAssetFileName() : null;

        return ToolExecutionDto.Result.builder()
                .success(runResult.isSuccess())
                .toolName(toolName)
                .assetId(runResult.getAssetId())
                .assetName(runResult.getAssetFileName())
                .assetUrl(assetUrl)
                .format(runResult.getFormat())
                .sizeBytes(runResult.getSizeBytes())
                .script(finalScript)
                .stdout(runResult.getStdout())
                .stderr(runResult.getStderr())
                .exitCode(runResult.getExitCode())
                .executionTimeMs(runResult.getExecutionTimeMs())
                .errorMessage(runResult.getErrorMessage())
                .build();
    }
}
