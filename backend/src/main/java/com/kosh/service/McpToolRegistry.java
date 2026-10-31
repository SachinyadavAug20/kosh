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
            "scene_assembler",
            // Creative Multi-Domain Tools (Task 10)
            "kosh_svg_to_3d",
            "kosh_audio_reactive",
            "kosh_ascii_to_voxel",
            "kosh_cad_export_step",
            // Pure CAD & Parametric Modeling Suite
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

        // 17. kosh_svg_to_3d
        tools.add(createToolSchema(
                "kosh_svg_to_3d",
                "2D Vector Path to Precision 3D Beveled Sign & Emblem: Extrudes 2D SVG paths, bezier contours, or typography into watertight 3D models with customizable bevel depth and brushed materials.",
                Map.of(
                        "svg_data", Map.of("type", "string", "description", "Raw SVG XML path markup or coordinates to extrude"),
                        "extrude_depth", Map.of("type", "number", "description", "Extrusion depth in meters (default 0.15m)"),
                        "bevel_radius", Map.of("type", "number", "description", "Edge bevel roundness radius (default 0.02m)")
                )
        ));

        // 18. kosh_audio_reactive
        tools.add(createToolSchema(
                "kosh_audio_reactive",
                "Procedural Audio-Reactive Visualizer Engine: Synthesizes kinetic 3D waveform rings, frequency spectrum bars, or pulsing audio matrices with keyframed oscillations across 120 frames.",
                Map.of(
                        "waveform_type", Map.of("type", "string", "enum", List.of("circular_spectrum", "frequency_bars", "pulsing_ring", "surface_ripple")),
                        "ring_count", Map.of("type", "integer", "description", "Number of concentric spectrum rings or bars (default 12)"),
                        "amplitude", Map.of("type", "number", "description", "Peak amplitude oscillation scale (default 1.5)")
                )
        ));

        // 19. kosh_ascii_to_voxel
        tools.add(createToolSchema(
                "kosh_ascii_to_voxel",
                "ASCII & Pixel Art to 3D Voxel Monument: Transforms text-based ASCII matrix art or 2D pixel grids into multi-colored 3D voxel monuments with palette mapping.",
                Map.of(
                        "ascii_grid", Map.of("type", "string", "description", "Multi-line ASCII character grid defining the voxel cross-section"),
                        "palette_map", Map.of("type", "string", "description", "JSON or color map for ASCII symbols")
                )
        ));

        // 20. kosh_cad_export_step
        tools.add(createToolSchema(
                "kosh_cad_export_step",
                "Universal Mechanical CAD Generator: Designs watertight engineering parts (gears, bearings, flanges, threaded couplings) with metric bores and bolt circles, exporting to .stl or .glb.",
                Map.of(
                        "part_type", Map.of("type", "string", "enum", List.of("spur_gear", "flange_bearing", "stepper_mount", "heatsink_extrusion")),
                        "dimensions", Map.of("type", "string", "description", "JSON-encoded dimensional constraints in millimeters")
                )
        ));

        // 21. create_parametric_primitive
        tools.add(createToolSchema(
                "create_parametric_primitive",
                "Creates parametric CAD primitives (cube, cylinder, cone, sphere, torus, plane, grid) with dimensional constraints, bevel radius, and segment counts.",
                Map.of(
                        "primitive_type", Map.of("type", "string", "enum", List.of("cube", "cylinder", "cone", "sphere", "torus", "plane", "grid")),
                        "radius", Map.of("type", "number", "description", "Radius or half-width in meters"),
                        "depth", Map.of("type", "number", "description", "Height or extrusion depth in meters"),
                        "segments", Map.of("type", "integer", "description", "Radial resolution segment count (e.g. 32, 64)"),
                        "bevel_radius", Map.of("type", "number", "description", "Corner chamfer or bevel radius in meters")
                )
        ));

        // 22. apply_boolean_op
        tools.add(createToolSchema(
                "apply_boolean_op",
                "Applies Constructive Solid Geometry (CSG) operations: difference (A - B), union (A ∪ B), or intersection (A ∩ B) with exact manifold solver.",
                Map.of(
                        "operation", Map.of("type", "string", "enum", List.of("difference", "union", "intersect")),
                        "target_mesh", Map.of("type", "string", "description", "Base object to modify"),
                        "tool_mesh", Map.of("type", "string", "description", "Cutter or joiner object"),
                        "solver", Map.of("type", "string", "enum", List.of("EXACT", "FAST"))
                )
        ));

        // 23. extrude_profile_2d
        tools.add(createToolSchema(
                "extrude_profile_2d",
                "Extrudes 2D coordinate polyline/polygon profiles along an axis vector with customizable bevel depth, taper, and watertight end caps.",
                Map.of(
                        "profile_name", Map.of("type", "string", "description", "Descriptive profile geometry name"),
                        "extrude_height", Map.of("type", "number", "description", "Extrusion height in meters (default 0.5m)"),
                        "bevel_depth", Map.of("type", "number", "description", "Edge bevel depth in meters (default 0.02m)"),
                        "taper", Map.of("type", "number", "description", "Taper scaling factor along extrusion axis")
                )
        ));

        // 24. inspect_geometry
        tools.add(createToolSchema(
                "inspect_geometry",
                "Analyzes 3D mesh manifold topology: calculates volume, surface area, bounding box extents [min, max], vertex count, and watertight status.",
                Map.of(
                        "target_mesh", Map.of("type", "string", "description", "Name of mesh to inspect"),
                        "include_volume", Map.of("type", "boolean", "description", "Whether to compute exact numerical volume")
                )
        ));

        // 25. apply_pbr_material
        tools.add(createToolSchema(
                "apply_pbr_material",
                "Configures and assigns PBR Principled BSDF shader attributes (albedo color, roughness, metalness, clearcoat, transmission, and emission).",
                Map.of(
                        "target_mesh", Map.of("type", "string", "description", "Target object name"),
                        "color", Map.of("type", "string", "description", "Hex color string (e.g. '#ea580c') or RGB"),
                        "roughness", Map.of("type", "number", "description", "Surface roughness from 0.0 (mirror) to 1.0 (diffuse)"),
                        "metalness", Map.of("type", "number", "description", "Metallic reflection from 0.0 (dielectric) to 1.0 (metal)"),
                        "emission", Map.of("type", "string", "description", "Optional emissive glow color")
                )
        ));

        // 26. export_cad_artifact
        tools.add(createToolSchema(
                "export_cad_artifact",
                "Exports active CAD model or selected mesh to watertight .GLB, .OBJ, or .STL with clean normals and origin centered at model base.",
                Map.of(
                        "export_format", Map.of("type", "string", "enum", List.of("glb", "stl", "obj")),
                        "triangulate", Map.of("type", "boolean", "description", "Whether to triangulate mesh faces before export")
                )
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
            } else if ("kosh_svg_to_3d".equals(normalizedName)) {
                Object depth = arguments != null && arguments.get("extrude_depth") != null ? arguments.get("extrude_depth") : "0.15";
                Object bevel = arguments != null && arguments.get("bevel_radius") != null ? arguments.get("bevel_radius") : "0.02";
                prompt = String.format("Extrude 2D vector emblem with depth %sm, bevel radius %sm, and metallic brushed gold/chrome shader", depth, bevel);
            } else if ("kosh_audio_reactive".equals(normalizedName)) {
                String wf = arguments != null && arguments.get("waveform_type") != null ? arguments.get("waveform_type").toString() : "circular_spectrum";
                Object rings = arguments != null && arguments.get("ring_count") != null ? arguments.get("ring_count") : "12";
                Object amp = arguments != null && arguments.get("amplitude") != null ? arguments.get("amplitude") : "1.5";
                prompt = String.format("Generate procedural audio-reactive %s visualizer with %s concentric rings, amplitude %s, across 120 keyframed frames", wf, rings, amp);
            } else if ("kosh_ascii_to_voxel".equals(normalizedName)) {
                prompt = "Construct 3D voxel monument from ASCII grid with multi-colored palette layers and bevelled voxel edges";
            } else if ("kosh_cad_export_step".equals(normalizedName)) {
                String part = arguments != null && arguments.get("part_type") != null ? arguments.get("part_type").toString() : "flange_bearing";
                prompt = String.format("Model precision watertight mechanical CAD %s with metric bores, bolt holes, chamfered bevels", part);
            } else if ("create_parametric_primitive".equals(normalizedName)) {
                String prim = arguments != null && arguments.get("primitive_type") != null ? arguments.get("primitive_type").toString() : "cylinder";
                Object rad = arguments != null && arguments.get("radius") != null ? arguments.get("radius") : "1.0";
                Object dep = arguments != null && arguments.get("depth") != null ? arguments.get("depth") : "2.0";
                Object seg = arguments != null && arguments.get("segments") != null ? arguments.get("segments") : "32";
                Object bev = arguments != null && arguments.get("bevel_radius") != null ? arguments.get("bevel_radius") : "0.05";
                prompt = String.format("Model parametric CAD %s with radius %sm, depth %sm, %s radial segments, and %sm bevel chamfer with clean manifold topology", prim, rad, dep, seg, bev);
            } else if ("apply_boolean_op".equals(normalizedName)) {
                String op = arguments != null && arguments.get("operation") != null ? arguments.get("operation").toString() : "difference";
                String solver = arguments != null && arguments.get("solver") != null ? arguments.get("solver").toString() : "EXACT";
                prompt = String.format("Execute Constructive Solid Geometry (CSG) %s between primary target and cutter mesh using %s solver with sharp manifold edges", op, solver);
            } else if ("extrude_profile_2d".equals(normalizedName)) {
                Object height = arguments != null && arguments.get("extrude_height") != null ? arguments.get("extrude_height") : "0.5";
                Object bev = arguments != null && arguments.get("bevel_depth") != null ? arguments.get("bevel_depth") : "0.02";
                prompt = String.format("Extrude 2D parametric sketch profile with height %sm, bevel depth %sm, solid end caps, and smooth face normals", height, bev);
            } else if ("inspect_geometry".equals(normalizedName)) {
                prompt = "Analyze 3D mesh geometry topology: calculate bounding box dimensions, vertex count, face count, volume, and manifold watertightness";
            } else if ("apply_pbr_material".equals(normalizedName)) {
                String color = arguments != null && arguments.get("color") != null ? arguments.get("color").toString() : "#ea580c";
                Object rough = arguments != null && arguments.get("roughness") != null ? arguments.get("roughness") : "0.3";
                Object metal = arguments != null && arguments.get("metalness") != null ? arguments.get("metalness") : "0.8";
                prompt = String.format("Create and assign studio PBR Principled BSDF material with base color %s, roughness %s, metalness %s, and subtle normal micro-facets", color, rough, metal);
            } else if ("export_cad_artifact".equals(normalizedName)) {
                String expFmt = arguments != null && arguments.get("export_format") != null ? arguments.get("export_format").toString() : format;
                prompt = String.format("Prepare and export clean watertight CAD geometry artifact to %s format with origin set to model base", expFmt);
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
