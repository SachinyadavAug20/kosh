package com.kosh.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kosh.dto.ToolExecutionDto;
import com.kosh.util.ScriptSanitizer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
public class McpToolRegistry {

    public static final Set<String> SUPPORTED_TOOLS = Set.of(
            // Composable 3D CAD Tools Suite (Primary MCP Tools)
            "cad_create_primitive",
            "cad_boolean_operation",
            "cad_apply_modifier",
            "cad_inspect_scene",
            "cad_synthesize_composite",
            // Specialized DCC Pipeline Tools
            "blender_sculpt_op",
            "blender_mesh_ops",
            "blender_animate_pipeline",
            "blender_uv_paint",
            // Core & Domain Tools
            "blender_mesh",
            "cad_model",
            "blender_animation",
            "mesh_modifier",
            "blender_sculpt",
            "material_shader",
            "lighting_studio",
            "geometry_nodes",
            "physics_simulation",
            "rigging_armature",
            "camera_compositor",
            "scene_assembler",
            // Creative Multi-Domain Tools
            "kosh_svg_to_3d",
            "kosh_audio_reactive",
            "kosh_ascii_to_voxel",
            "kosh_cad_export_step",
            // Parametric Modeling Tools
            "create_parametric_primitive",
            "apply_boolean_op",
            "extrude_profile_2d",
            "inspect_geometry",
            "apply_pbr_material",
            "export_cad_artifact"
    );

    private final GoogleGeminiClient googleGeminiClient;
    private final BlenderExecutionService blenderExecutionService;
    private final ScriptSanitizer scriptSanitizer;
    private final McpSceneStateService mcpSceneStateService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public McpToolRegistry(GoogleGeminiClient googleGeminiClient,
                           BlenderExecutionService blenderExecutionService,
                           ScriptSanitizer scriptSanitizer,
                           McpSceneStateService mcpSceneStateService) {
        this.googleGeminiClient = googleGeminiClient;
        this.blenderExecutionService = blenderExecutionService;
        this.scriptSanitizer = scriptSanitizer;
        this.mcpSceneStateService = mcpSceneStateService;
    }

    private Map<String, Object> createToolSchema(String name, String description, Map<String, Object> extraProperties) {
        Map<String, Object> tool = new LinkedHashMap<>();
        tool.put("name", name);
        tool.put("description", description);

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("prompt", Map.of(
                "type", "string",
                "description", "Natural language instructions describing the 3D geometry, sculpting, physics, animation, or materials."
        ));
        properties.put("script", Map.of(
                "type", "string",
                "description", "Optional raw Blender Python (bpy) script. If provided, executes directly without LLM generation."
        ));
        properties.put("previousScript", Map.of(
                "type", "string",
                "description", "Optional previous bpy script for iterative refinement and secondary detail generation."
        ));
        properties.put("format", Map.of(
                "type", "string",
                "description", "Export format: 'glb' (default), 'blend', 'stl', 'obj', 'fbx', or 'usdz'",
                "enum", List.of("glb", "blend", "stl", "obj", "fbx", "usdz")
        ));

        if (extraProperties != null) {
            properties.putAll(extraProperties);
        }

        tool.put("inputSchema", Map.of(
                "type", "object",
                "properties", properties,
                "required", List.of()
        ));
        return tool;
    }

    /**
     * Lists registered MCP tools matching the JSON-RPC Model Context Protocol specification.
     */
    public List<Map<String, Object>> listTools() {
        List<Map<String, Object>> tools = new ArrayList<>();

        // 1. cad_create_primitive
        Map<String, Object> primTool = new LinkedHashMap<>();
        primTool.put("name", "cad_create_primitive");
        primTool.put("description", "Instantiates a precision parametric 3D CAD primitive (cube, cylinder, cone, sphere, torus) with dimensional constraints and PBR material.");
        primTool.put("inputSchema", Map.of(
                "type", "object",
                "properties", Map.of(
                        "type", Map.of("type", "string", "enum", List.of("cube", "cylinder", "cone", "sphere", "torus"), "description", "Primitive geometry type"),
                        "dimensions", Map.of("type", "array", "items", Map.of("type", "number"), "description", "Dimensions in meters: [width, height, depth] for cube, or [radius, depth] for cylinder/cone/torus"),
                        "location", Map.of("type", "array", "items", Map.of("type", "number"), "description", "World position [x, y, z] in meters (default: [0, 0, 0])"),
                        "name", Map.of("type", "string", "description", "Entity identifier name"),
                        "format", Map.of("type", "string", "enum", List.of("glb", "stl", "obj"), "description", "Export format (default: glb)")
                ),
                "required", List.of("type", "name")
        ));
        tools.add(primTool);

        // 2. cad_boolean_operation
        Map<String, Object> boolTool = new LinkedHashMap<>();
        boolTool.put("name", "cad_boolean_operation");
        boolTool.put("description", "Applies Constructive Solid Geometry (CSG) boolean operations (DIFFERENCE, UNION, INTERSECT) between two named meshes with exact manifold solver.");
        boolTool.put("inputSchema", Map.of(
                "type", "object",
                "properties", Map.of(
                        "baseMeshName", Map.of("type", "string", "description", "Target base mesh name to receive boolean cut or union"),
                        "cutterMeshName", Map.of("type", "string", "description", "Tool or cutter mesh name to apply to base"),
                        "operation", Map.of("type", "string", "enum", List.of("DIFFERENCE", "UNION", "INTERSECT"), "description", "CSG boolean operation type"),
                        "deleteCutter", Map.of("type", "boolean", "description", "Whether to delete the cutter object after applying (default: true)"),
                        "format", Map.of("type", "string", "enum", List.of("glb", "stl", "obj"), "description", "Export format (default: glb)")
                ),
                "required", List.of("baseMeshName", "cutterMeshName", "operation")
        ));
        tools.add(boolTool);

        // 3. cad_apply_modifier
        Map<String, Object> modTool = new LinkedHashMap<>();
        modTool.put("name", "cad_apply_modifier");
        modTool.put("description", "Applies parametric CAD modifier operations (BEVEL, SUBSURF, MIRROR, SOLIDIFY) to a named mesh with exact numerical parameters.");
        modTool.put("inputSchema", Map.of(
                "type", "object",
                "properties", Map.of(
                        "targetMeshName", Map.of("type", "string", "description", "Name of mesh to apply modifier to"),
                        "modifierType", Map.of("type", "string", "enum", List.of("BEVEL", "SUBSURF", "MIRROR", "SOLIDIFY"), "description", "Type of modifier to apply"),
                        "properties", Map.of("type", "object", "description", "Modifier attributes (e.g. {'width': 0.05, 'segments': 3} for BEVEL, {'thickness': 0.04} for SOLIDIFY)"),
                        "format", Map.of("type", "string", "enum", List.of("glb", "stl", "obj"), "description", "Export format (default: glb)")
                ),
                "required", List.of("targetMeshName", "modifierType")
        ));
        tools.add(modTool);

        // 4. cad_inspect_scene
        Map<String, Object> inspectTool = new LinkedHashMap<>();
        inspectTool.put("name", "cad_inspect_scene");
        inspectTool.put("description", "Inspects active 3D scene topology: returns mesh count, vertex count, face count, bounding boxes, dimensions, and manifold/watertight status without running exports.");
        inspectTool.put("inputSchema", Map.of(
                "type", "object",
                "properties", Map.of(
                        "targetMesh", Map.of("type", "string", "description", "Optional name of specific mesh to inspect; if omitted, inspects entire scene"),
                        "includeWatertightCheck", Map.of("type", "boolean", "description", "Whether to perform watertight manifold validation (default: true)")
                ),
                "required", List.of()
        ));
        tools.add(inspectTool);

        // 5. cad_synthesize_composite
        Map<String, Object> synthTool = new LinkedHashMap<>();
        synthTool.put("name", "cad_synthesize_composite");
        synthTool.put("description", "Synthesizes a complete multi-part 3D CAD composite assembly from natural language with specified aesthetic style and target export format.");
        synthTool.put("inputSchema", Map.of(
                "type", "object",
                "properties", Map.of(
                        "prompt", Map.of("type", "string", "description", "Natural language specification describing the assembly or product"),
                        "style", Map.of("type", "string", "enum", List.of("low_poly", "mechanical_cad", "smooth_organic"), "description", "Geometric aesthetic style"),
                        "targetFormat", Map.of("type", "string", "enum", List.of("glb", "stl", "obj"), "description", "Output format (default: glb)")
                ),
                "required", List.of("prompt")
        ));
        tools.add(synthTool);

        // Specialized DCC Pipeline Tools
        tools.add(createToolSchema(
                "blender_sculpt_op",
                "Digital Sculpting & Dynamic Topology Engine: Execute digital sculpting brushes or procedural BMesh organic displacement.",
                Map.of(
                        "brush_type", Map.of("type", "string", "enum", List.of("clay", "crease", "inflate", "grab", "smooth", "flatten", "pinch")),
                        "strength", Map.of("type", "number", "description", "Brush deformation strength (0.0 to 2.0)"),
                        "radius", Map.of("type", "number", "description", "Brush radius in meters"),
                        "voxel_remesh_size", Map.of("type", "number", "description", "Target voxel size for remeshing (e.g. 0.05m)")
                )
        ));

        tools.add(createToolSchema(
                "blender_mesh_ops",
                "Advanced BMesh Operations: Execute exact manifold CSG Booleans, chamfer bevels, wall solidification, remeshing, and decimation.",
                Map.of(
                        "operation", Map.of("type", "string", "enum", List.of("boolean", "bevel", "solidify", "remesh", "convex_hull", "weld", "decimate")),
                        "parameters_json", Map.of("type", "string", "description", "JSON-encoded parameters for operation")
                )
        ));

        tools.add(createToolSchema(
                "blender_animate_pipeline",
                "Procedural Animation & Physics Simulation Pipeline: Generate baked keyframed rigid body gravity drops, cloth drapery, and turntable sweeps.",
                Map.of(
                        "animation_type", Map.of("type", "string", "enum", List.of("turntable", "explode", "rigidbody_fall", "cloth_drop", "wave_deform")),
                        "frame_count", Map.of("type", "integer", "description", "Total animation duration in frames (default 120)"),
                        "loop", Map.of("type", "boolean", "description", "Whether the motion should form a seamless loop")
                )
        ));

        tools.add(createToolSchema(
                "blender_uv_paint",
                "Texture Baking & Vertex Colors: Automates Smart UV Project unwrapping, baking normal maps, and generating Vertex Color layers.",
                Map.of(
                        "unwrap_method", Map.of("type", "string", "enum", List.of("smart_project", "lightmap", "cube")),
                        "vertex_color_palette", Map.of("type", "string", "description", "Color theme or palette name"),
                        "bake_type", Map.of("type", "string", "enum", List.of("normals", "roughness", "ambient_occlusion"))
                )
        ));

        tools.add(createToolSchema(
                "blender_mesh",
                "Generate procedural 3D meshes, multi-part objects, and scenes in Blender using Google Gemini and headless bpy code.",
                null
        ));

        tools.add(createToolSchema(
                "cad_model",
                "Generate precision parametric mechanical CAD components with exact CSG boolean operations, metric dimensions, and bevels.",
                null
        ));

        tools.add(createToolSchema(
                "blender_animation",
                "Generate keyframed procedural 3D animations, skeletal armatures, gear trains, and kinetic motion tracks.",
                null
        ));

        tools.add(createToolSchema(
                "mesh_modifier",
                "Execute advanced parametric mesh transformations using Blender's modifier stack: Booleans, Subdivision, Solidify, Arrays, Mirror.",
                null
        ));

        tools.add(createToolSchema(
                "blender_sculpt",
                "Generate organic sculpted meshes, dynamic topology surfaces, procedural noise micro-displacements, and natural terrain.",
                null
        ));

        tools.add(createToolSchema(
                "material_shader",
                "Generate advanced procedural PBR shader node graphs using Principled BSDF 2.0, Voronoi/Noise textures, and metallic sheen.",
                null
        ));

        tools.add(createToolSchema(
                "lighting_studio",
                "Generate professional 3-point photographic studio lighting rigs, cyclorama infinity backdrops, and cinematic staging.",
                null
        ));

        tools.add(createToolSchema(
                "geometry_nodes",
                "Generate procedural Geometry Node networks, point scattering, and algorithmic distribution.",
                null
        ));

        tools.add(createToolSchema(
                "physics_simulation",
                "Simulate rigid body dynamics, falling polyhedra, passive colliders, and gravitational physics.",
                null
        ));

        tools.add(createToolSchema(
                "rigging_armature",
                "Construct skeletal bone armatures, kinematic chains, and automatic vertex skinning.",
                null
        ));

        tools.add(createToolSchema(
                "camera_compositor",
                "Deploy cinematic camera director rigs: 360-degree turntable orbits, dolly-in tracking shots, and macro lenses.",
                null
        ));

        tools.add(createToolSchema(
                "scene_assembler",
                "Assemble complex multi-asset 3D environments, compound modular architecture, and ambient lighting.",
                null
        ));

        tools.add(createToolSchema(
                "kosh_svg_to_3d",
                "Extrudes 2D SVG paths, bezier contours, or typography into watertight 3D models with customizable bevel depth.",
                Map.of(
                        "svg_data", Map.of("type", "string", "description", "Raw SVG XML path markup"),
                        "extrude_depth", Map.of("type", "number", "description", "Extrusion depth in meters (default 0.15m)"),
                        "bevel_radius", Map.of("type", "number", "description", "Edge bevel radius (default 0.02m)")
                )
        ));

        tools.add(createToolSchema(
                "kosh_audio_reactive",
                "Procedural Audio-Reactive Visualizer: Synthesizes kinetic 3D waveform rings or frequency spectrum bars.",
                Map.of(
                        "waveform_type", Map.of("type", "string", "enum", List.of("circular_spectrum", "frequency_bars", "pulsing_ring")),
                        "ring_count", Map.of("type", "integer", "description", "Number of concentric spectrum rings (default 12)"),
                        "amplitude", Map.of("type", "number", "description", "Peak amplitude scale (default 1.5)")
                )
        ));

        tools.add(createToolSchema(
                "kosh_ascii_to_voxel",
                "Transforms text-based ASCII matrix art or 2D pixel grids into multi-colored 3D voxel monuments.",
                Map.of(
                        "ascii_grid", Map.of("type", "string", "description", "Multi-line ASCII character grid"),
                        "palette_map", Map.of("type", "string", "description", "Color map for ASCII symbols")
                )
        ));

        tools.add(createToolSchema(
                "kosh_cad_export_step",
                "Universal Mechanical CAD Generator: Designs watertight engineering parts with metric bores and bolt circles.",
                Map.of(
                        "part_type", Map.of("type", "string", "enum", List.of("spur_gear", "flange_bearing", "stepper_mount", "heatsink_extrusion")),
                        "dimensions", Map.of("type", "string", "description", "JSON-encoded dimensional constraints in millimeters")
                )
        ));

        tools.add(createToolSchema(
                "create_parametric_primitive",
                "Creates parametric CAD primitives with dimensional constraints, bevel radius, and segment counts.",
                Map.of(
                        "primitive_type", Map.of("type", "string", "enum", List.of("cube", "cylinder", "cone", "sphere", "torus")),
                        "radius", Map.of("type", "number", "description", "Radius or half-width in meters"),
                        "depth", Map.of("type", "number", "description", "Extrusion depth in meters"),
                        "segments", Map.of("type", "integer", "description", "Radial resolution segment count (e.g. 32, 64)"),
                        "bevel_radius", Map.of("type", "number", "description", "Corner chamfer radius in meters")
                )
        ));

        tools.add(createToolSchema(
                "apply_boolean_op",
                "Applies CSG operations: difference, union, or intersect with exact manifold solver.",
                Map.of(
                        "operation", Map.of("type", "string", "enum", List.of("difference", "union", "intersect")),
                        "target_mesh", Map.of("type", "string", "description", "Base object to modify"),
                        "tool_mesh", Map.of("type", "string", "description", "Cutter or joiner object"),
                        "solver", Map.of("type", "string", "enum", List.of("EXACT", "FAST"))
                )
        ));

        tools.add(createToolSchema(
                "extrude_profile_2d",
                "Extrudes 2D coordinate polyline profiles along an axis vector with customizable bevel depth.",
                Map.of(
                        "profile_name", Map.of("type", "string", "description", "Descriptive profile geometry name"),
                        "extrude_height", Map.of("type", "number", "description", "Extrusion height in meters (default 0.5m)"),
                        "bevel_depth", Map.of("type", "number", "description", "Edge bevel depth in meters (default 0.02m)")
                )
        ));

        tools.add(createToolSchema(
                "inspect_geometry",
                "Analyzes 3D mesh manifold topology: calculates volume, bounding box, vertex count, and watertight status.",
                Map.of(
                        "target_mesh", Map.of("type", "string", "description", "Name of mesh to inspect")
                )
        ));

        tools.add(createToolSchema(
                "apply_pbr_material",
                "Configures and assigns PBR Principled BSDF shader attributes (color, roughness, metalness, emission).",
                Map.of(
                        "target_mesh", Map.of("type", "string", "description", "Target object name"),
                        "color", Map.of("type", "string", "description", "Hex color string (e.g. '#ea580c')"),
                        "roughness", Map.of("type", "number", "description", "Surface roughness from 0.0 to 1.0"),
                        "metalness", Map.of("type", "number", "description", "Metallic reflection from 0.0 to 1.0"),
                        "emission", Map.of("type", "string", "description", "Emissive glow color")
                )
        ));

        tools.add(createToolSchema(
                "export_cad_artifact",
                "Exports active CAD model or selected mesh to watertight .GLB, .OBJ, or .STL with clean normals.",
                Map.of(
                        "export_format", Map.of("type", "string", "enum", List.of("glb", "stl", "obj"))
                )
        ));

        return tools;
    }

    /**
     * Executes a tool invocation requested via MCP JSON-RPC with progress callback support.
     */
    public ToolExecutionDto.Result executeTool(String toolName, Map<String, Object> arguments, String token) {
        return executeTool(toolName, arguments, token, null, null);
    }

    /**
     * Executes a tool invocation requested via MCP JSON-RPC with progress streaming.
     */
    public ToolExecutionDto.Result executeTool(String toolName, Map<String, Object> arguments, String token,
                                              String progressToken, McpProgressListener progressListener) {
        String normalizedName = toolName != null ? toolName.trim().toLowerCase() : "";

        if (!SUPPORTED_TOOLS.contains(normalizedName)) {
            throw new IllegalArgumentException("Unknown tool name: " + toolName + ". Supported tools: " + String.join(", ", SUPPORTED_TOOLS));
        }

        // Special handling for cad_inspect_scene: returns structured summary without running exports
        if ("cad_inspect_scene".equals(normalizedName)) {
            if (progressListener != null && progressToken != null) {
                progressListener.onProgress(progressToken, 0.5, 1.0, "Inspecting scene topology and manifold geometry");
            }
            String targetMesh = arguments != null && arguments.containsKey("targetMesh") && arguments.get("targetMesh") != null
                    ? arguments.get("targetMesh").toString() : null;
            Map<String, Object> inspectionSummary = mcpSceneStateService.getSceneInspectionSummary(targetMesh);
            String jsonOutput = toJson(inspectionSummary);

            if (progressListener != null && progressToken != null) {
                progressListener.onProgress(progressToken, 1.0, 1.0, "Scene inspection complete");
            }

            return ToolExecutionDto.Result.builder()
                    .success(true)
                    .toolName("cad_inspect_scene")
                    .assetName("scene_inspection.json")
                    .format("json")
                    .stdout(jsonOutput)
                    .telemetry(inspectionSummary)
                    .executionTimeMs(15)
                    .build();
        }

        if (progressListener != null && progressToken != null) {
            progressListener.onProgress(progressToken, 0.2, 1.0, "Sanitizing and generating Python script");
        }

        String prompt = arguments != null && arguments.get("prompt") != null ? arguments.get("prompt").toString() : null;
        String rawScript = arguments != null && arguments.get("script") != null ? arguments.get("script").toString() : null;
        String previousScript = arguments != null && arguments.get("previousScript") != null ? arguments.get("previousScript").toString() : null;
        String format = arguments != null && arguments.get("format") != null ? arguments.get("format").toString() : "glb";

        String finalScript = null;

        // Route composable CAD tools to direct procedural Python builders for instant execution
        if (rawScript != null && !rawScript.isBlank()) {
            log.info("Executing user-provided script for tool: {}", normalizedName);
            finalScript = scriptSanitizer.sanitize(rawScript);
        } else if ("cad_create_primitive".equals(normalizedName)) {
            finalScript = buildCreatePrimitiveScript(arguments, format);
        } else if ("cad_boolean_operation".equals(normalizedName)) {
            finalScript = buildBooleanOperationScript(arguments, format);
        } else if ("cad_apply_modifier".equals(normalizedName)) {
            finalScript = buildApplyModifierScript(arguments, format);
        } else if ("cad_synthesize_composite".equals(normalizedName)) {
            String userPrompt = (prompt != null && !prompt.isBlank()) ? prompt : "Precision Parametric Mechanical CAD Component";
            String style = arguments != null && arguments.containsKey("style") && arguments.get("style") != null
                    ? arguments.get("style").toString() : "mechanical_cad";
            String targetFmt = arguments != null && arguments.containsKey("targetFormat") && arguments.get("targetFormat") != null
                    ? arguments.get("targetFormat").toString() : format;
            format = targetFmt;

            String styleDirective = switch (style.toLowerCase()) {
                case "mechanical_cad" -> "Style: Precision Mechanical CAD. Form watertight manifold bodies with exact CSG difference bores, chamfered bevels (2-3mm), metric proportions, and dark titanium PBR material.";
                case "low_poly" -> "Style: Faceted Low-Poly CAD. Use planar geometric polygons, flat shading, vivid color palette, and clean silhouette boundaries.";
                case "smooth_organic" -> "Style: Smooth Organic CAD. Use subdivision surfaces, continuous curvature fillets, soft organic transitions, and satin finish.";
                default -> "Style: Precision Engineering CAD.";
            };
            prompt = String.format("%s\n%s\nTarget Format: %s", userPrompt, styleDirective, targetFmt);
            finalScript = googleGeminiClient.generateBlenderScript(prompt, previousScript, normalizedName, token, format);
        } else if (prompt != null && !prompt.isBlank()) {
            log.info("Generating script from prompt (iterative={}) using Google Gemini for tool: {}", previousScript != null, normalizedName);
            finalScript = googleGeminiClient.generateBlenderScript(prompt, previousScript, normalizedName, token, format);
        } else {
            // Synthesize prompt from structured arguments if prompt is null
            prompt = synthesizePromptFromArgs(normalizedName, arguments);
            finalScript = googleGeminiClient.generateBlenderScript(prompt, previousScript, normalizedName, token, format);
        }

        if (finalScript == null || finalScript.isBlank()) {
            throw new IllegalArgumentException("Failed to construct script for tool: " + normalizedName);
        }

        finalScript = scriptSanitizer.sanitize(finalScript);

        if (progressListener != null && progressToken != null) {
            progressListener.onProgress(progressToken, 0.6, 1.0, "Executing headless Blender subprocess");
        }

        BlenderExecutionService.BlenderRunResult runResult = blenderExecutionService.executeScript(finalScript, format);

        // Self-Healing Fallback: If script failed execution, fall back to procedural CAD generator
        if (!runResult.isSuccess() && prompt != null && !prompt.isBlank()) {
            log.warn("Script failed execution (exit code {}). Initiating procedural self-healing fallback...", runResult.getExitCode());
            try {
                String fallbackScript = googleGeminiClient.generateProceduralModelScript(prompt, normalizedName, format);
                BlenderExecutionService.BlenderRunResult fallbackResult = blenderExecutionService.executeScript(fallbackScript, format);
                if (fallbackResult.isSuccess()) {
                    log.info("Self-healing fallback succeeded for tool: '{}'", normalizedName);
                    runResult = fallbackResult;
                    finalScript = fallbackScript;
                }
            } catch (Exception e) {
                log.error("Procedural fallback also failed: {}", e.getMessage());
            }
        }

        if (progressListener != null && progressToken != null) {
            progressListener.onProgress(progressToken, 0.9, 1.0, "Validating GLB output buffer");
        }

        // Record telemetry into the active scene state
        if (runResult.isSuccess()) {
            String assetName = arguments != null && arguments.containsKey("name") && arguments.get("name") != null
                    ? arguments.get("name").toString() : runResult.getAssetFileName();
            mcpSceneStateService.recordAssetGeneration(assetName, runResult.getTelemetry(), runResult.getFormat(), runResult.getSizeBytes());
        }

        if (progressListener != null && progressToken != null) {
            progressListener.onProgress(progressToken, 1.0, 1.0, "Completed and asset stored");
        }

        return ToolExecutionDto.Result.builder()
                .success(runResult.isSuccess())
                .toolName(normalizedName)
                .assetId(runResult.getAssetId())
                .assetName(runResult.getAssetFileName())
                .assetUrl(runResult.isSuccess() ? "/api/assets/" + runResult.getAssetFileName() : null)
                .snapshotUrl(runResult.isSuccess() ? runResult.getSnapshotUrl() : null)
                .telemetry(runResult.getTelemetry())
                .format(runResult.getFormat() != null ? runResult.getFormat() : format)
                .sizeBytes(runResult.getSizeBytes())
                .script(finalScript)
                .stdout(runResult.getStdout())
                .stderr(runResult.getStderr())
                .exitCode(runResult.getExitCode())
                .executionTimeMs(runResult.getExecutionTimeMs())
                .errorMessage(runResult.getErrorMessage())
                .build();
    }

    private String buildCreatePrimitiveScript(Map<String, Object> arguments, String format) {
        String type = arguments != null && arguments.get("type") != null ? arguments.get("type").toString().toLowerCase() : "cube";
        String name = arguments != null && arguments.get("name") != null ? arguments.get("name").toString() : "CAD_" + capitalize(type);

        List<Double> loc = parseDoubleList(arguments != null ? arguments.get("location") : null, List.of(0.0, 0.0, 0.0));
        List<Double> dims = parseDoubleList(arguments != null ? arguments.get("dimensions") : null, List.of(1.0, 1.0, 1.0));

        double lx = loc.size() > 0 ? loc.get(0) : 0.0;
        double ly = loc.size() > 1 ? loc.get(1) : 0.0;
        double lz = loc.size() > 2 ? loc.get(2) : 0.0;

        StringBuilder sb = new StringBuilder();
        sb.append("import bpy, mathutils\n\n");
        sb.append("for o in list(bpy.data.objects):\n    bpy.data.objects.remove(o, do_unlink=True)\n");
        sb.append("for m in list(bpy.data.meshes):\n    bpy.data.meshes.remove(m, do_unlink=True)\n\n");

        switch (type) {
            case "cylinder" -> {
                double r = dims.size() > 0 ? dims.get(0) : 1.0;
                double d = dims.size() > 1 ? dims.get(1) : 2.0;
                sb.append(String.format(Locale.US, "bpy.ops.mesh.primitive_cylinder_add(radius=%.4f, depth=%.4f, vertices=64, location=(%.4f, %.4f, %.4f))\n", r, d, lx, ly, lz));
            }
            case "cone" -> {
                double r = dims.size() > 0 ? dims.get(0) : 1.0;
                double d = dims.size() > 1 ? dims.get(1) : 2.0;
                sb.append(String.format(Locale.US, "bpy.ops.mesh.primitive_cone_add(radius1=%.4f, depth=%.4f, vertices=64, location=(%.4f, %.4f, %.4f))\n", r, d, lx, ly, lz));
            }
            case "sphere" -> {
                double r = dims.size() > 0 ? dims.get(0) : 1.0;
                sb.append(String.format(Locale.US, "bpy.ops.mesh.primitive_uv_sphere_add(radius=%.4f, segments=64, ring_count=32, location=(%.4f, %.4f, %.4f))\n", r, lx, ly, lz));
            }
            case "torus" -> {
                double mr = dims.size() > 0 ? dims.get(0) : 1.0;
                double mir = dims.size() > 1 ? dims.get(1) : 0.25;
                sb.append(String.format(Locale.US, "bpy.ops.mesh.primitive_torus_add(major_radius=%.4f, minor_radius=%.4f, major_segments=64, minor_segments=32, location=(%.4f, %.4f, %.4f))\n", mr, mir, lx, ly, lz));
            }
            default -> { // cube
                double dx = dims.size() > 0 ? dims.get(0) : 1.0;
                double dy = dims.size() > 1 ? dims.get(1) : (dims.size() == 1 ? dx : 1.0);
                double dz = dims.size() > 2 ? dims.get(2) : (dims.size() == 1 ? dx : 1.0);
                sb.append(String.format(Locale.US, "bpy.ops.mesh.primitive_cube_add(size=1.0, location=(%.4f, %.4f, %.4f))\n", lx, ly, lz));
                sb.append(String.format(Locale.US, "obj = bpy.context.active_object\nobj.dimensions = (%.4f, %.4f, %.4f)\nbpy.ops.object.transform_apply(location=False, rotation=False, scale=True)\n", dx, dy, dz));
            }
        }

        sb.append(String.format("obj = bpy.context.active_object\nobj.name = \"%s\"\n\n", name));
        sb.append("mat = bpy.data.materials.new(name=\"MatteTitanium\")\n");
        sb.append("if hasattr(mat, \"use_nodes\") and not mat.use_nodes:\n    mat.use_nodes = True\n");
        sb.append("if mat.node_tree:\n");
        sb.append("    bsdf = mat.node_tree.nodes.get(\"Principled BSDF\")\n");
        sb.append("    if bsdf:\n");
        sb.append("        if \"Base Color\" in bsdf.inputs:\n            bsdf.inputs[\"Base Color\"].default_value = (0.28, 0.33, 0.41, 1.0)\n");
        sb.append("        if \"Roughness\" in bsdf.inputs:\n            bsdf.inputs[\"Roughness\"].default_value = 0.28\n");
        sb.append("        if \"Metallic\" in bsdf.inputs:\n            bsdf.inputs[\"Metallic\"].default_value = 0.95\n");
        sb.append("if obj.data.materials:\n    obj.data.materials[0] = mat\nelse:\n    obj.data.materials.append(mat)\n");

        return sb.toString();
    }

    private String buildBooleanOperationScript(Map<String, Object> arguments, String format) {
        String baseName = arguments != null && arguments.get("baseMeshName") != null ? arguments.get("baseMeshName").toString() : "Base_Body";
        String cutterName = arguments != null && arguments.get("cutterMeshName") != null ? arguments.get("cutterMeshName").toString() : "Cutter_Tool";
        String op = arguments != null && arguments.get("operation") != null ? arguments.get("operation").toString().toUpperCase() : "DIFFERENCE";
        boolean deleteCutter = arguments == null || !arguments.containsKey("deleteCutter") || Boolean.TRUE.equals(arguments.get("deleteCutter"));

        StringBuilder sb = new StringBuilder();
        sb.append("import bpy\n\n");
        sb.append(String.format("base = bpy.data.objects.get(\"%s\")\n", baseName));
        sb.append(String.format("cutter = bpy.data.objects.get(\"%s\")\n\n", cutterName));

        sb.append(String.format("if not base:\n    bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0,0,1))\n    base = bpy.context.active_object\n    base.name = \"%s\"\n\n", baseName));
        sb.append(String.format("if not cutter:\n    bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=3.0, vertices=64, location=(0,0,1))\n    cutter = bpy.context.active_object\n    cutter.name = \"%s\"\n\n", cutterName));

        sb.append("mod = base.modifiers.new(name=\"CAD_Boolean\", type='BOOLEAN')\n");
        sb.append(String.format("mod.operation = \"%s\"\n", op));
        sb.append("mod.object = cutter\n");
        sb.append("mod.solver = 'EXACT'\n\n");

        sb.append("bpy.context.view_layer.objects.active = base\n");
        sb.append("bpy.ops.object.modifier_apply(modifier=mod.name)\n\n");

        if (deleteCutter) {
            sb.append("if cutter and cutter.name in bpy.data.objects:\n");
            sb.append("    bpy.data.objects.remove(cutter, do_unlink=True)\n");
        }

        return sb.toString();
    }

    private String buildApplyModifierScript(Map<String, Object> arguments, String format) {
        String targetName = arguments != null && arguments.get("targetMeshName") != null ? arguments.get("targetMeshName").toString() : "Target_Body";
        String modType = arguments != null && arguments.get("modifierType") != null ? arguments.get("modifierType").toString().toUpperCase() : "BEVEL";
        @SuppressWarnings("unchecked")
        Map<String, Object> props = arguments != null && arguments.get("properties") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();

        StringBuilder sb = new StringBuilder();
        sb.append("import bpy\n\n");
        sb.append(String.format("target = bpy.data.objects.get(\"%s\")\n", targetName));
        sb.append(String.format("if not target:\n    bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0,0,1))\n    target = bpy.context.active_object\n    target.name = \"%s\"\n\n", targetName));
        sb.append("bpy.context.view_layer.objects.active = target\n\n");

        switch (modType) {
            case "BEVEL" -> {
                double width = props.containsKey("width") && props.get("width") instanceof Number n ? n.doubleValue() : 0.05;
                int segments = props.containsKey("segments") && props.get("segments") instanceof Number n ? n.intValue() : 3;
                sb.append("mod = target.modifiers.new(name=\"CAD_Bevel\", type='BEVEL')\n");
                sb.append(String.format(Locale.US, "mod.width = %.4f\n", width));
                sb.append(String.format("mod.segments = %d\n", segments));
                sb.append("if hasattr(mod, 'clamp_overlap'):\n    mod.clamp_overlap = True\n");
            }
            case "SUBSURF", "SUBDIVISION" -> {
                int levels = props.containsKey("levels") && props.get("levels") instanceof Number n ? n.intValue() : 2;
                sb.append("mod = target.modifiers.new(name=\"CAD_Subsurf\", type='SUBSURF')\n");
                sb.append(String.format("mod.levels = %d\n", levels));
                sb.append(String.format("mod.render_levels = %d\n", levels));
            }
            case "SOLIDIFY" -> {
                double thickness = props.containsKey("thickness") && props.get("thickness") instanceof Number n ? n.doubleValue() : 0.05;
                sb.append("mod = target.modifiers.new(name=\"CAD_Solidify\", type='SOLIDIFY')\n");
                sb.append(String.format(Locale.US, "mod.thickness = %.4f\n", thickness));
            }
            case "MIRROR" -> {
                sb.append("mod = target.modifiers.new(name=\"CAD_Mirror\", type='MIRROR')\n");
                sb.append("mod.use_axis[0] = True\n");
            }
            default -> {
                sb.append("mod = target.modifiers.new(name=\"CAD_Mod\", type='BEVEL')\n");
            }
        }

        sb.append("bpy.ops.object.modifier_apply(modifier=mod.name)\n");
        return sb.toString();
    }

    private List<Double> parseDoubleList(Object raw, List<Double> defaults) {
        if (raw instanceof List<?> list) {
            List<Double> result = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Number n) {
                    result.add(n.doubleValue());
                }
            }
            return result.isEmpty() ? defaults : result;
        } else if (raw instanceof Number n) {
            return List.of(n.doubleValue());
        }
        return defaults;
    }

    private String capitalize(String str) {
        if (str == null || str.isEmpty()) return "Object";
        return str.substring(0, 1).toUpperCase() + str.substring(1).toLowerCase();
    }

    private String synthesizePromptFromArgs(String toolName, Map<String, Object> arguments) {
        return switch (toolName) {
            case "blender_sculpt_op" -> {
                String brush = arguments != null && arguments.get("brush_type") != null ? arguments.get("brush_type").toString() : "clay";
                Object strength = arguments != null ? arguments.get("strength") : "1.0";
                Object voxel = arguments != null ? arguments.get("voxel_remesh_size") : "0.04";
                yield String.format("Sculpt dynamic organic surface using %s brush with strength %s and voxel remesh size %s meters", brush, strength, voxel);
            }
            case "blender_mesh_ops" -> {
                String op = arguments != null && arguments.get("operation") != null ? arguments.get("operation").toString() : "boolean";
                yield String.format("Execute advanced BMesh operation %s with precision manifold geometry and clean normals", op);
            }
            case "blender_animate_pipeline" -> {
                String animType = arguments != null && arguments.get("animation_type") != null ? arguments.get("animation_type").toString() : "rigidbody_fall";
                Object frames = arguments != null && arguments.get("frame_count") != null ? arguments.get("frame_count") : "120";
                yield String.format("Generate procedural %s simulation across %s keyframed frames with ground colliders", animType, frames);
            }
            case "blender_uv_paint" -> {
                String unwrap = arguments != null && arguments.get("unwrap_method") != null ? arguments.get("unwrap_method").toString() : "smart_project";
                yield String.format("Smart UV unwrap using %s and generate vertex color attribute layer", unwrap);
            }
            case "kosh_svg_to_3d" -> {
                Object depth = arguments != null && arguments.get("extrude_depth") != null ? arguments.get("extrude_depth") : "0.15";
                Object bevel = arguments != null && arguments.get("bevel_radius") != null ? arguments.get("bevel_radius") : "0.02";
                yield String.format("Extrude 2D vector emblem with depth %sm, bevel radius %sm, and metallic brushed gold/chrome shader", depth, bevel);
            }
            case "kosh_audio_reactive" -> {
                String wf = arguments != null && arguments.get("waveform_type") != null ? arguments.get("waveform_type").toString() : "circular_spectrum";
                Object rings = arguments != null && arguments.get("ring_count") != null ? arguments.get("ring_count") : "12";
                Object amp = arguments != null && arguments.get("amplitude") != null ? arguments.get("amplitude") : "1.5";
                yield String.format("Generate procedural audio-reactive %s visualizer with %s concentric rings, amplitude %s, across 120 keyframed frames", wf, rings, amp);
            }
            case "kosh_ascii_to_voxel" -> "Construct 3D voxel monument from ASCII grid with multi-colored palette layers and bevelled voxel edges";
            case "kosh_cad_export_step" -> {
                String part = arguments != null && arguments.get("part_type") != null ? arguments.get("part_type").toString() : "flange_bearing";
                yield String.format("Model precision watertight mechanical CAD %s with metric bores, bolt holes, chamfered bevels", part);
            }
            case "create_parametric_primitive" -> {
                String prim = arguments != null && arguments.get("primitive_type") != null ? arguments.get("primitive_type").toString() : "cylinder";
                Object rad = arguments != null && arguments.get("radius") != null ? arguments.get("radius") : "1.0";
                Object dep = arguments != null && arguments.get("depth") != null ? arguments.get("depth") : "2.0";
                yield String.format("Model parametric CAD %s with radius %sm, depth %sm, with clean manifold topology", prim, rad, dep);
            }
            case "apply_boolean_op" -> {
                String op = arguments != null && arguments.get("operation") != null ? arguments.get("operation").toString() : "difference";
                yield String.format("Execute CSG %s with sharp manifold edges", op);
            }
            case "extrude_profile_2d" -> "Extrude 2D parametric sketch profile with solid end caps and smooth face normals";
            case "inspect_geometry" -> "Analyze 3D mesh geometry topology: calculate bounding box dimensions, vertex count, and watertight status";
            case "apply_pbr_material" -> {
                String color = arguments != null && arguments.get("color") != null ? arguments.get("color").toString() : "#ea580c";
                yield String.format("Create and assign studio PBR Principled BSDF material with base color %s", color);
            }
            case "export_cad_artifact" -> "Prepare and export clean watertight CAD geometry artifact";
            default -> "Generate clean parametric 3D CAD geometry with manifold topology";
        };
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
}
