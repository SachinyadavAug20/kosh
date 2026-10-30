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
    private final BlenderExecutionService blenderExecutionService;
    private final ScriptSanitizer scriptSanitizer;

    public McpToolRegistry(GoogleGeminiClient googleGeminiClient,
                           BlenderExecutionService blenderExecutionService,
                           ScriptSanitizer scriptSanitizer) {
        this.googleGeminiClient = googleGeminiClient;
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
        meshTool.put("description", "Generate procedural 3D meshes and scenes in Blender using Google Gemini and headless bpy code, exporting to optimized binary GLTF (.glb).");
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
        String previousScript = arguments != null && arguments.get("previousScript") != null ? arguments.get("previousScript").toString() : null;
        String format = arguments != null && arguments.get("format") != null ? arguments.get("format").toString() : "glb";

        String finalScript;

        if (rawScript != null && !rawScript.isBlank()) {
            log.info("Executing user-provided script for tool: {}", toolName);
            finalScript = scriptSanitizer.sanitize(rawScript);
        } else if (prompt != null && !prompt.isBlank()) {
            log.info("Generating script from prompt (iterative={}) using Google Gemini for tool: {}", previousScript != null, toolName);
            finalScript = googleGeminiClient.generateBlenderScript(prompt, previousScript, toolName, token, format);
        } else {
            throw new IllegalArgumentException("Either 'prompt' or 'script' must be supplied in tool arguments.");
        }

        BlenderExecutionService.BlenderRunResult runResult = blenderExecutionService.executeScript(finalScript, format);

        // Self-Healing Fallback: If AI-generated script failed execution, fall back to procedural CAD generator
        if (!runResult.isSuccess() && prompt != null && !prompt.isBlank()) {
            log.warn("AI-generated script failed execution (exit code {}). Error: {}. Initiating procedural self-healing fallback...",
                    runResult.getExitCode(), runResult.getErrorMessage());
            try {
                String fallbackScript = googleGeminiClient.generateProceduralModelScript(prompt, toolName, format);
                BlenderExecutionService.BlenderRunResult fallbackResult = blenderExecutionService.executeScript(fallbackScript, format);
                if (fallbackResult.isSuccess()) {
                    log.info("Self-healing fallback succeeded for prompt: '{}'", prompt);
                    runResult = fallbackResult;
                    finalScript = fallbackScript;
                }
            } catch (Exception fallbackErr) {
                log.error("Self-healing procedural fallback also encountered an error: {}", fallbackErr.getMessage());
            }
        }

        String assetUrl = runResult.isSuccess() ? "/api/assets/" + runResult.getAssetFileName() : null;

        return ToolExecutionDto.Result.builder()
                .success(runResult.isSuccess())
                .toolName(toolName)
                .assetId(runResult.getAssetId())
                .assetName(runResult.getAssetFileName())
                .assetUrl(assetUrl)
                .snapshotUrl(runResult.getSnapshotUrl())
                .telemetry(runResult.getTelemetry())
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
