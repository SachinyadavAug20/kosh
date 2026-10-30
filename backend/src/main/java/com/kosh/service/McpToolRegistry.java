package com.kosh.service;

import com.kosh.dto.ToolExecutionDto;
import com.kosh.util.ScriptSanitizer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
public class McpToolRegistry {

    public static final Set<String> SUPPORTED_TOOLS = Set.of(
            // Primary Specialized DCC Pipeline Tools (Task 1)
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
            "scene_assembler"
    );

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
                "description", "Export format: 'glb' (default), 'stl', 'obj', 'fbx', or 'usdz'",
                "enum", List.of("glb", "stl", "obj", "fbx", "usdz")
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

        // 1. blender_sculpt_op
        tools.add(createToolSchema(
                "blender_sculpt_op",
                "Digital Sculpting & Dynamic Topology Engine: Execute digital sculpting brushes (clay, crease, inflate, grab, smooth, flatten, pinch) or procedural BMesh organic displacement and voxel remeshing.",
                Map.of(
                        "brush_type", Map.of("type", "string", "enum", List.of("clay", "crease", "inflate", "grab", "smooth", "flatten", "pinch")),
                        "strength", Map.of("type", "number", "description", "Brush stroke deformation strength (0.0 to 2.0)"),
                        "radius", Map.of("type", "number", "description", "Brush radius in meters"),
                        "voxel_remesh_size", Map.of("type", "number", "description", "Target voxel size for remeshing (e.g. 0.05m)")
                )
        ));

        // 2. blender_mesh_ops
        tools.add(createToolSchema(
                "blender_mesh_ops",
                "Advanced BMesh Operations: Execute exact manifold CSG Booleans, chamfer bevels, wall solidification, voxel remeshing, convex hulls, vertex welding (remove_doubles), and decimation.",
                Map.of(
                        "operation", Map.of("type", "string", "enum", List.of("boolean", "bevel", "solidify", "remesh", "convex_hull", "weld", "decimate")),
                        "parameters_json", Map.of("type", "string", "description", "JSON-encoded parameters for operation (e.g. {'ratio': 0.5, 'width': 0.04})")
                )
        ));

        // 3. blender_animate_pipeline
        tools.add(createToolSchema(
                "blender_animate_pipeline",
                "Procedural Animation & Physics Simulation Pipeline: Generate baked keyframed rigid body gravity drops, domino cascades, pinned cloth drapery over obstacles, turntable sweeps, and exploded assembly views.",
                Map.of(
                        "animation_type", Map.of("type", "string", "enum", List.of("turntable", "explode", "rigidbody_fall", "cloth_drop", "wave_deform")),
                        "frame_count", Map.of("type", "integer", "description", "Total animation duration in frames (default 120)"),
                        "loop", Map.of("type", "boolean", "description", "Whether the motion should form a seamless cyclic loop")
                )
        ));

        // 4. blender_uv_paint
        tools.add(createToolSchema(
                "blender_uv_paint",
                "Texture Baking & Vertex Colors: Automates Smart UV Project unwrapping, baking normal/roughness maps, and generating Vertex Color layers accessible by Three.js shaders.",
                Map.of(
                        "unwrap_method", Map.of("type", "string", "enum", List.of("smart_project", "lightmap", "cube")),
                        "vertex_color_palette", Map.of("type", "string", "description", "Color theme or palette name for vertex color layers"),
                        "bake_type", Map.of("type", "string", "enum", List.of("normals", "roughness", "ambient_occlusion"))
                )
        ));

        // 5. blender_mesh
        tools.add(createToolSchema(
                "blender_mesh",
                "Generate procedural 3D meshes, multi-part objects, and scenes in Blender using Google Gemini and headless bpy code, exporting to optimized binary GLTF (.glb).",
                null
        ));

        // 6. cad_model
        tools.add(createToolSchema(
                "cad_model",
                "Generate precision parametric mechanical CAD components with exact CSG boolean operations, metric dimensions, flanges, bores, and bevels, exporting to .glb or .stl.",
                null
        ));

        // 7. blender_animation
        tools.add(createToolSchema(
                "blender_animation",
                "Generate keyframed procedural 3D animations, skeletal armatures, bone poses, gear trains, camera sweeps, and kinetic motion tracks, exporting to animated binary GLTF (.glb).",
                null
        ));

        // 8. mesh_modifier
        tools.add(createToolSchema(
                "mesh_modifier",
                "Execute advanced parametric mesh transformations using Blender's deep modifier stack: CSG Booleans, Remeshing, Decimation, Subdivision, Solidify, Arrays, and Mirror symmetry.",
                null
        ));

        // 9. blender_sculpt
        tools.add(createToolSchema(
                "blender_sculpt",
                "Generate organic sculpted meshes, dynamic topology surfaces, procedural noise micro-displacements, cloth drapery folds, and natural terrain elevations.",
                null
        ));

        // 10. material_shader
        tools.add(createToolSchema(
                "material_shader",
                "Generate advanced procedural PBR shader node graphs using Principled BSDF 2.0, Voronoi/Noise textures, subsurface scattering, metallic sheen, and clearcoats.",
                null
        ));

        // 11. lighting_studio
        tools.add(createToolSchema(
                "lighting_studio",
                "Generate professional 3-point photographic studio lighting rigs, Nishita physical sky simulations, cyclorama infinity backdrops, and cinematic camera staging.",
                null
        ));

        // 12. geometry_nodes
        tools.add(createToolSchema(
                "geometry_nodes",
                "Generate procedural Geometry Node networks, point scattering, algorithmic distribution, voronoi crystal lattices, and instanced architectural elements.",
                null
        ));

        // 13. physics_simulation
        tools.add(createToolSchema(
                "physics_simulation",
                "Simulate rigid body dynamics, falling active dominoes/polyhedra, passive ground colliders, cloth draping, and gravitational physics with keyframe caching.",
                null
        ));

        // 14. rigging_armature
        tools.add(createToolSchema(
                "rigging_armature",
                "Construct skeletal bone armatures, hierarchical kinematic chains, automatic vertex group skinning, and articulated limb/piston mechanics.",
                null
        ));

        // 15. camera_compositor
        tools.add(createToolSchema(
                "camera_compositor",
                "Deploy cinematic camera director rigs: 360-degree turntable orbits, dolly-in tracking shots, macro/wide-angle focal length lenses, and studio composition.",
                null
        ));

        // 16. scene_assembler
        tools.add(createToolSchema(
                "scene_assembler",
                "Assemble complex multi-asset 3D environments, compound modular architecture, ground topography, props, and ambient lighting into a unified scene.",
                null
        ));

        return tools;
    }

    /**
     * Executes a tool invocation requested via MCP JSON-RPC.
     */
    public ToolExecutionDto.Result executeTool(String toolName, Map<String, Object> arguments, String token) {
        String normalizedName = toolName != null ? toolName.trim().toLowerCase() : "";

        if (!SUPPORTED_TOOLS.contains(normalizedName)) {
            throw new IllegalArgumentException("Unknown tool name: " + toolName + ". Supported tools: " + String.join(", ", SUPPORTED_TOOLS));
        }

        String prompt = arguments != null && arguments.get("prompt") != null ? arguments.get("prompt").toString() : null;
        String rawScript = arguments != null && arguments.get("script") != null ? arguments.get("script").toString() : null;
        String previousScript = arguments != null && arguments.get("previousScript") != null ? arguments.get("previousScript").toString() : null;
        String format = arguments != null && arguments.get("format") != null ? arguments.get("format").toString() : "glb";

        // Synthesize prompt from structured arguments if prompt is null
        if ((prompt == null || prompt.isBlank()) && (rawScript == null || rawScript.isBlank())) {
            if ("blender_sculpt_op".equals(normalizedName)) {
                String brush = arguments != null && arguments.get("brush_type") != null ? arguments.get("brush_type").toString() : "clay";
                Object strength = arguments != null ? arguments.get("strength") : "1.0";
                Object voxel = arguments != null ? arguments.get("voxel_remesh_size") : "0.04";
                prompt = String.format("Sculpt dynamic organic surface using %s brush with strength %s and voxel remesh size %s meters", brush, strength, voxel);
            } else if ("blender_mesh_ops".equals(normalizedName)) {
                String op = arguments != null && arguments.get("operation") != null ? arguments.get("operation").toString() : "boolean";
                prompt = String.format("Execute advanced BMesh operation %s with precision manifold geometry and clean normals", op);
            } else if ("blender_animate_pipeline".equals(normalizedName)) {
                String animType = arguments != null && arguments.get("animation_type") != null ? arguments.get("animation_type").toString() : "rigidbody_fall";
                Object frames = arguments != null && arguments.get("frame_count") != null ? arguments.get("frame_count") : "120";
                prompt = String.format("Generate procedural %s simulation across %s keyframed frames with ground colliders", animType, frames);
            } else if ("blender_uv_paint".equals(normalizedName)) {
                String unwrap = arguments != null && arguments.get("unwrap_method") != null ? arguments.get("unwrap_method").toString() : "smart_project";
                prompt = String.format("Smart UV unwrap using %s and generate vertex color attribute layer", unwrap);
            }
        }

        String finalScript;

        if (rawScript != null && !rawScript.isBlank()) {
            log.info("Executing user-provided script for tool: {}", normalizedName);
            finalScript = scriptSanitizer.sanitize(rawScript);
        } else if (prompt != null && !prompt.isBlank()) {
            log.info("Generating script from prompt (iterative={}) using Google Gemini for tool: {}", previousScript != null, normalizedName);
            finalScript = googleGeminiClient.generateBlenderScript(prompt, previousScript, normalizedName, token, format);
        } else {
            throw new IllegalArgumentException("Either 'prompt', 'script', or tool-specific parameters must be supplied.");
        }

        BlenderExecutionService.BlenderRunResult runResult = blenderExecutionService.executeScript(finalScript, format);

        // Self-Healing Fallback: If AI-generated script failed execution, fall back to procedural CAD generator
        if (!runResult.isSuccess() && prompt != null && !prompt.isBlank()) {
            log.warn("AI-generated script failed execution (exit code {}). Error: {}. Initiating procedural self-healing fallback...",
                    runResult.getExitCode(), runResult.getErrorMessage());
            try {
                String fallbackScript = googleGeminiClient.generateProceduralModelScript(prompt, normalizedName, format);
                BlenderExecutionService.BlenderRunResult fallbackResult = blenderExecutionService.executeScript(fallbackScript, format);
                if (fallbackResult.isSuccess()) {
                    log.info("Self-healing fallback succeeded for tool: '{}', prompt: '{}'", normalizedName, prompt);
                    runResult = fallbackResult;
                    finalScript = fallbackScript;
                }
            } catch (Exception e) {
                log.error("Procedural fallback also failed: {}", e.getMessage());
            }
        }

        return ToolExecutionDto.Result.builder()
                .success(runResult.isSuccess())
                .toolName(normalizedName)
                .assetId(runResult.getAssetId())
                .assetName(runResult.getAssetFileName())
                .assetUrl(runResult.isSuccess() ? "/api/assets/" + runResult.getAssetFileName() : null)
                .snapshotUrl(runResult.isSuccess() ? runResult.getSnapshotUrl() : null)
                .telemetry(runResult.getTelemetry())
                .format(format)
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
