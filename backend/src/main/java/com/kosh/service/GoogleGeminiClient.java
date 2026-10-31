package com.kosh.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kosh.util.ScriptSanitizer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class GoogleGeminiClient {

    private final WebClient.Builder webClientBuilder;
    private final ScriptSanitizer scriptSanitizer;
    private final ObjectMapper objectMapper;

    @Value("${google.gemini.api.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String geminiBaseUrl;

    @Value("${google.gemini.model:gemini-1.5-flash}")
    private String primaryModel;

    @Value("${google.gemini.fallback-model:gemini-flash-latest}")
    private String fallbackModel;

    @Value("${kosh.gemini.api-key:}")
    private String defaultApiKey;

    private static final List<String> CASCADE_MODELS = List.of(
            "gemini-1.5-flash",
            "gemini-2.0-flash-exp",
            "gemini-1.5-pro",
            "gemini-flash-latest"
    );

    public GoogleGeminiClient(WebClient.Builder webClientBuilder,
                              ScriptSanitizer scriptSanitizer,
                              ObjectMapper objectMapper) {
        this.webClientBuilder = webClientBuilder;
        this.scriptSanitizer = scriptSanitizer;
        this.objectMapper = objectMapper;
    }

    public String generateBlenderScript(String prompt, String toolType, String apiKey, String exportFormat) {
        return generateBlenderScript(prompt, null, toolType, apiKey, exportFormat);
    }

    public String generateBlenderScript(String prompt, String previousScript, String toolType, String apiKey, String exportFormat) {
        String activeKey = (apiKey != null && !apiKey.isBlank()) ? apiKey.trim() : defaultApiKey;
        if (activeKey == null || activeKey.isBlank()) {
            activeKey = System.getenv("GEMINI_API_KEY");
        }

        if (activeKey == null || activeKey.isBlank()) {
            throw new IllegalArgumentException(
                "Google Gemini API key is required. Please paste your Google API key (from https://aistudio.google.com/app/apikey) in the top bar, set GEMINI_API_KEY in .env, or use 'demo' mode."
            );
        }

        String trimmedKey = activeKey.trim().replaceFirst("(?i)^Bearer\\s+", "");

        if ("demo".equalsIgnoreCase(trimmedKey) || "mock".equalsIgnoreCase(trimmedKey) || "offline".equalsIgnoreCase(trimmedKey)) {
            log.info("Generating procedural fallback script in demo mode for prompt: {}", prompt);
            return generateProceduralModelScript(prompt, toolType, exportFormat);
        }

        String systemPrompt = buildSystemPrompt(toolType, exportFormat);

        String effectivePrompt = prompt;
        if (previousScript != null && !previousScript.isBlank()) {
            effectivePrompt = """
                EXISTING SCENE SCRIPT:
                ```python
                %s
                ```
                
                USER REFINEMENT / DETAIL INSTRUCTION:
                "%s"
                
                TASK:
                Update and expand the existing script to incorporate the requested details while keeping existing components, materials, and geometry intact. Return ONLY the complete updated executable Python script.
                """.formatted(previousScript.trim(), prompt.trim());
        }

        List<String> modelsToTry = new ArrayList<>();
        if (primaryModel != null && !primaryModel.isBlank()) {
            modelsToTry.add(primaryModel.trim());
        }
        for (String m : CASCADE_MODELS) {
            if (!modelsToTry.contains(m)) {
                modelsToTry.add(m);
            }
        }

        for (String model : modelsToTry) {
            log.info("Attempting script generation with model: {}", model);
            int maxRetries = 2;
            for (int attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    return callGeminiGenerateContent(effectivePrompt, systemPrompt, model, trimmedKey);
                } catch (WebClientResponseException e) {
                    int statusCode = e.getStatusCode().value();

                    if (statusCode == 503 || statusCode == 429 || statusCode >= 500) {
                        log.warn("Model {} returned HTTP {} (attempt {}/{}). Response: {}",
                                model, statusCode, attempt, maxRetries, e.getResponseBodyAsString());
                        if (attempt < maxRetries) {
                            try {
                                long sleepMs = 600L * attempt;
                                Thread.sleep(sleepMs);
                            } catch (InterruptedException ie) {
                                Thread.currentThread().interrupt();
                            }
                            continue;
                        } else {
                            log.warn("Model {} exhausted retries on HTTP {}. Cascading...", model, statusCode);
                            break;
                        }
                    } else if (statusCode == 404 || statusCode == 400) {
                        log.warn("Model {} returned HTTP {}. Skipping to next model...", model, statusCode);
                        break;
                    } else {
                        throw new RuntimeException("Google Gemini API error (" + statusCode + "): " + e.getResponseBodyAsString(), e);
                    }
                } catch (Exception e) {
                    log.warn("Call to model {} failed: {}. Retrying or cascading...", model, e.getMessage());
                    if (attempt < maxRetries) {
                        try {
                            Thread.sleep(500);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                        }
                    }
                }
            }
        }

        log.warn("All Gemini models in cascade saturated. Providing deep procedural Blender script for prompt: '{}'", prompt);
        return generateProceduralModelScript(prompt, toolType, exportFormat);
    }

    private String callGeminiGenerateContent(String prompt, String systemPrompt, String model, String apiKey) {
        WebClient webClient = webClientBuilder
                .baseUrl(geminiBaseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        Map<String, Object> requestBody = Map.of(
                "system_instruction", Map.of(
                        "parts", List.of(Map.of("text", systemPrompt))
                ),
                "contents", List.of(
                        Map.of(
                                "role", "user",
                                "parts", List.of(Map.of("text", prompt))
                        )
                ),
                "generationConfig", Map.of(
                        "temperature", 0.2
                )
        );

        String uri = String.format("/models/%s:generateContent?key=%s", model, apiKey);

        log.info("Calling Google Gemini endpoint with model: {}", model);
        String responseBody = webClient.post()
                .uri(uri)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(30))
                .block();

        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode candidates = root.path("candidates");
            if (candidates.isArray() && !candidates.isEmpty()) {
                JsonNode parts = candidates.get(0).path("content").path("parts");
                if (parts.isArray() && !parts.isEmpty()) {
                    String rawText = parts.get(0).path("text").asText();
                    return scriptSanitizer.sanitize(rawText);
                }
            }
            throw new RuntimeException("Invalid response structure from Google Gemini API: " + responseBody);
        } catch (Exception e) {
            log.error("Failed to parse Gemini JSON response: {}", e.getMessage());
            throw new RuntimeException("Google Gemini parsing failed: " + e.getMessage(), e);
        }
    }

    private String buildSystemPrompt(String toolType, String exportFormat) {
        String format = (exportFormat != null && exportFormat.equalsIgnoreCase("stl")) ? "stl" : "glb";
        String normalizedTool = toolType != null ? toolType.trim().toLowerCase() : "blender_mesh";

        String specializedDirective = "";
        if ("blender_sculpt_op".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR DIGITAL SCULPTING & DYNAMIC TOPOLOGY (blender_sculpt_op):
                - Execute digital sculpting operations and organic deformation:
                  * Base geometry setup with high-subdivision Ico Sphere or Quad mesh.
                  * Organic clay/crease/inflate sculpting strokes modeled using BMesh vertex displacement along normals.
                  * Voxel Remeshing:
                    bpy.context.object.data.remesh_voxel_size = 0.04
                    bpy.ops.object.voxel_remesh()
                  * Apply smooth shading with sharp crease angle retention.
                """;
        } else if ("blender_mesh_ops".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR ADVANCED BMESH OPERATIONS (blender_mesh_ops):
                - Execute clean manifold geometric operations:
                  * Boolean CSG operations: Combine parts with type='BOOLEAN' (UNION, DIFFERENCE, INTERSECT) using solver='EXACT'.
                  * Vertex welding (remove_doubles):
                    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
                  * Decimation: Decimate modifier with ratio=0.5-0.8 preserving manifold topology.
                  * Precision Bevel: 3-5 segments for chamfered edge reflections.
                """;
        } else if ("blender_animate_pipeline".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR PROCEDURAL ANIMATION & PHYSICS (blender_animate_pipeline):
                - Create rich keyframed motion and simulated physics across 60 to 120 frames.
                - Set scene.frame_start = 1; scene.frame_end = 120; scene.frame_current = 1.
                - Rigid Body / Gravity drop: Ground collider plate with falling, tumbling, or bouncing active rigid bodies keyframed at impact.
                - Turntable spin & Exploded assembly view separation.
                - Mandatory: Export with animations:
                  bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', export_animations=True)
                """;
        } else if ("blender_uv_paint".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR UV UNWRAPPING & VERTEX COLORS (blender_uv_paint):
                - Automate Smart UV Project:
                  bpy.ops.uv.smart_project(angle_limit=math.radians(66))
                - Create and populate Vertex Color attribute layers:
                  color_layer = mesh.color_attributes.new(name="Col", type='BYTE_COLOR', domain='CORNER')
                  for loop in mesh.loops: color_layer.data[loop.index].color = (r, g, b, 1.0)
                - Export with vertex colors preserved so Three.js renders vertex shading.
                """;
        } else if ("blender_animation".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR ANIMATION ENGINE (blender_animation):
                - Create rich, production-grade keyframed animations across 60 to 120 frames.
                - Set scene.frame_start = 1; scene.frame_end = 120; scene.frame_current = 1.
                - Implement Kinematic Linkages & Parent-Child Hierarchies:
                  * Central driver (e.g. Sun_Gear) keyframed with continuous rotation across frames 1, 30, 60, 90, 120.
                  * Orbiting satellites/planet gears mathematically keyframed or parented to rotating empty carriers.
                  * Planet gears orbit around the driver center (location keyframes) while simultaneously spinning on their own axes (rotation_euler keyframes).
                - Mandatory: Export with animations preserved:
                  bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', export_animations=True)
                """;
        } else if ("mesh_modifier".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR MESH OPERATIONS & MODIFIERS (mesh_modifier):
                - Perform advanced parametric mesh transformations using Blender's deep modifier stack:
                  * Boolean CSG operations: Combine parts with type='BOOLEAN' (UNION, DIFFERENCE, INTERSECT) using solver='EXACT'.
                  * Remesh: type='REMESH' with mode='VOXEL' or 'QUAD'.
                  * Bevel: type='BEVEL' with width=0.03-0.08, segments=3-5.
                  * Subdivision: type='SUBSURF' with Catmull-Clark levels=2.
                  * Solidify: type='SOLIDIFY' for hollowed walls.
                  * Array: type='ARRAY' for radial turbine blades/spokes.
                  * Mirror: type='MIRROR' with clipping=True for bilateral symmetry.
                """;
        } else if ("blender_sculpt".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR SCULPTING & ORGANIC DEFORMATION (blender_sculpt):
                - Generate high-detail organic, sculpted, or natural surface topography:
                  * High-resolution base geometry with Subdivision Surface or Voxel Remesh.
                  * Procedural Displace modifier with 3D texture graphs (Voronoi, Musgrave, Clouds noise).
                  * BMesh organic deformation: displace vertices procedurally along vertex normals.
                  * Smooth shading with auto-smoothed sharp angle edge crease preservation.
                """;
        } else if ("material_shader".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR PBR SHADERS & COLORING (material_shader):
                - Construct advanced procedural material node graphs connected to Principled BSDF 2.0:
                  * Multi-color procedural textures using ShaderNodeTexNoise, ShaderNodeTexVoronoi, ShaderNodeValToRGB.
                  * Fine bump maps using ShaderNodeBump connecting noise height into BSDF Normal input.
                  * Metallic, Roughness, Subsurface Scattering, and Clearcoat variation maps.
                """;
        } else if ("lighting_studio".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR STUDIO LIGHTING & STAGING (lighting_studio):
                - Construct a professional photographic studio stage and lighting rig:
                  * 3-Point or 4-Point cinematic lighting: Key Light (warm 5500K area), Fill Light (cool 7000K soft), Rim Light (high-intensity contour highlight).
                  * Studio backdrop cyclorama seamless curved plane.
                  * Camera staging with depth-of-field (dof.use_dof = True).
                """;
        } else if ("geometry_nodes".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR GEOMETRY NODES & ALGORITHMIC LATTICES (geometry_nodes):
                - Construct procedural distributed lattices, point scattering, and algorithmic arrays:
                  * Mathematical instancing: Fibonacci spirals, geodesic coordinate distributions, radial matrix arrays.
                  * Geometry Node networks or procedural BMesh algorithmic lattices: instantiate micro-structures across curved surfaces.
                """;
        } else if ("physics_simulation".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR PHYSICS DYNAMICS & SIMULATION (physics_simulation):
                - Simulate dynamic physical interactions: Rigid bodies, falling cascade dominoes, kinetic impacts, or cloth drapery.
                - Mandatory: Export with export_animations=True so physics plays live in the 3D viewport.
                """;
        } else if ("rigging_armature".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR SKELETAL RIGGING & ARMATURES (rigging_armature):
                - Construct articulated skeletal hierarchies:
                  * Armature generation: Create bone hierarchies (Base -> Upper Arm -> Forearm -> End Effector).
                  * Mesh Parenting & Skinning: Bind mesh geometry to armatures.
                  * Pose Keyframing: Animate articulated joints in pose mode across 120 frames.
                  * Mandatory: Export with export_animations=True and export_skins=True.
                """;
        } else if ("camera_compositor".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR CINEMATIC CAMERA COMPOSITION (camera_compositor):
                - Architect a dedicated cinematic camera system:
                  * Focal length configuration: 24mm wide angle, 50mm human perspective, 85mm portrait.
                  * Depth of Field: Configure dof.use_dof = True with shallow aperture.
                  * Animated 360-degree orbital sweep or cinematic dolly-in tracking across 120 keyframes.
                  * Mandatory: Export with export_cameras=True and export_animations=True.
                """;
        } else if ("scene_assembler".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR COMPOUND SCENE ASSEMBLY (scene_assembler):
                - Assemble complex multi-asset environments into a unified cohesive composition:
                  * Foundation plaza or terraced topography.
                  * Architectural colonnades, canopy roofs, and central hero focus.
                  * Multi-material slotting: Maintain separate named objects with distinct PBR materials.
                """;
        } else if ("kosh_svg_to_3d".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR 2D VECTOR TO 3D BEVELED EMBLEMS (kosh_svg_to_3d):
                - Transform 2D vectors, curves, or emblem contours into watertight 3D models:
                  * Curve or mesh extrusion with customizable depth and bevel radius.
                  * Multi-material layering (brushed gold/chrome face with accent rims).
                  * Clean normals and manifold geometry.
                """;
        } else if ("kosh_audio_reactive".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR AUDIO-REACTIVE MOTION ENGINE (kosh_audio_reactive):
                - Procedural acoustic kinetic visualization across 120 keyframed frames:
                  * Concentric spectrum rings, equalizer frequency bars, or oscillating ripples.
                  * Sinusoidal frequency modulation on Z-translation and scale.
                  * Glowing emissive shader accents.
                  * Export with export_animations=True.
                """;
        } else if ("kosh_ascii_to_voxel".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR ASCII & PIXEL TO 3D VOXELS (kosh_ascii_to_voxel):
                - Convert ASCII matrix patterns or pixel grids into 3D voxel monuments:
                  * Instanced or merged bmesh cubes spaced by voxel_size.
                  * Multi-color palette mapping per ASCII symbol (steel, gold, gems, stone).
                  * Chamfered or beveled voxel edges for high-end digital look.
                """;
        } else if ("kosh_cad_export_step".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR PRECISION MECHANICAL CAD (kosh_cad_export_step):
                - Watertight mechanical engineering parts:
                  * Metric dimensions, center bores, bolt patterns, keyways, and turbine impellers.
                  * Manifold geometry suitable for CNC milling or 3D printing export (STL and GLB).
                  * Chamfered bevels for industrial metallic reflections.
                """;
        } else if ("create_parametric_primitive".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR PARAMETRIC CAD PRIMITIVES (create_parametric_primitive):
                - Construct precise parametric solid bodies (cube, cylinder, cone, sphere, torus, plane, grid):
                  * High-fidelity segment resolution (32-64 segments for circular profiles).
                  * Apply edge beveling (modifier or bmesh bevel with 3 segments, 0.02-0.05m radius).
                  * Recalculate face normals outward; ensure watertight closed manifold.
                  * Ground flush at Z=0 with base origin.
                """;
        } else if ("apply_boolean_op".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR CONSTRUCTIVE SOLID GEOMETRY (apply_boolean_op):
                - Execute clean CSG Boolean operations (UNION, DIFFERENCE, INTERSECT):
                  * Use modifier 'BOOLEAN' with solver='EXACT'.
                  * Apply modifier via bpy.ops.object.modifier_apply().
                  * Clean coplanar/overlapping vertices via bmesh.ops.remove_doubles(bm, dist=0.0005).
                  * Recalculate face normals; verify zero non-manifold edges.
                """;
        } else if ("extrude_profile_2d".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR 2D PROFILE EXTRUSION (extrude_profile_2d):
                - Create 2D closed polygon curve or BMesh face and extrude along Z vector:
                  * Add top and bottom cap faces.
                  * Apply bevel modifier on boundary perimeter edges (width=0.02, segments=3).
                  * Assign distinct materials to extruded perimeter vs top/bottom end caps.
                """;
        } else if ("inspect_geometry".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR GEOMETRY TOPOLOGY INSPECTION (inspect_geometry):
                - Compute exact bounding box extents, total volume, polygon count, and vertex count.
                - Print JSON telemetry into console stdout: {"triangles": tris, "vertices": verts, "dimensions": [dx, dy, dz], "watertight": True}.
                """;
        } else if ("apply_pbr_material".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR PBR CAD SHADING (apply_pbr_material):
                - Configure Principled BSDF 2.0 with physical PBR values:
                  * Base color, roughness, metalness, and optional clearcoat or emission.
                  * Enable smooth shading with auto-smoothed normals (35-degree angle).
                """;
        } else if ("export_cad_artifact".equals(normalizedTool)) {
            specializedDirective = """
                
                SPECIALIZED DIRECTIVE FOR WATERTIGHT CAD EXPORT (export_cad_artifact):
                - Export manifold geometry cleanly aligned to model base:
                  * Apply all rotation and scale transforms (bpy.ops.object.transform_apply).
                  * Export to GLB, OBJ, or binary STL format with clean vertex normals.
                """;
        }

        return """
            You are a senior technical 3D artist and CAD engineer creating production-grade Blender Python (`bpy`) scripts for headless execution.
            Generate ONLY executable Python code. No markdown fences, no preamble, no explanations.
            
            AUTONOMOUS RESEARCH & GENERATIVE SYNTHESIS PROTOCOL (MANDATORY):
            Before generating code, apply this 3-step structured engineering method:
            - STEP 1 (Engineering Breakdown): Decompose the object into high-density functional sub-assemblies (e.g. chassis, linkages, actuators, fasteners, housings, connectors). Every functional sub-assembly MUST be created as an individual named mesh object (e.g., `01_Base_Pedestal`, `02_Turntable_A1`).
            - STEP 2 (Mathematical Parametrization): Compute precise pivot origins, trigonometric transforms using `mathutils.Vector`, `mathutils.Euler`, and `mathutils.Matrix`, angular limits, and concentric alignments.
            - STEP 3 (Self-Validating BPY Code): Implement using safe, crash-proof Blender 5.x Python API. Always use `mathutils.Vector`, explicit clean materials, and proper parent/keyframe hierarchy.

            Strict Engineering Standards:
            1. Clean Scene Setup & Essential Imports:
               import bpy, sys, math, json, os
               import mathutils
               from mathutils import Vector, Euler, Matrix, Quaternion
               import bmesh

               bpy.ops.wm.read_factory_settings(use_empty=True)
               for col in list(bpy.data.collections):
                   bpy.data.collections.remove(col)
               scene = bpy.context.scene
            
            2. CRITICAL SYNTAX & CONTEXT RULES (ZERO RUNTIME CRASHES):
               - In Blender Python, 3D vectors and matrices are strictly in the `mathutils` module (`Vector`, `Euler`, `Matrix`, `Quaternion`).
               - NEVER EVER use `math.vector` or `math.Vector` (Python standard `math` has NO vector attributes and crashes with AttributeError).
               - Always use `Vector((x, y, z))` or `mathutils.Vector((x, y, z))`.
               - Context Override: Ensure active object exists before applying modifiers or ops:
                 if bpy.context.view_layer.objects.active is None and bpy.context.selected_objects:
                     bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
               - Operator Argument Rules:
                 * `bpy.ops.mesh.primitive_cone_add` takes `radius1=...` and `radius2=0.0` (tip). NEVER use `radius=...` (throws TypeError: keyword 'radius' unrecognized).
                 * `bpy.ops.mesh.primitive_cylinder_add` takes `radius=...` and `depth=...`.
                 * `bpy.ops.mesh.primitive_torus_add` takes `major_radius=...` and `minor_radius=...`.
                 * `bpy.ops.mesh.primitive_cube_add` takes `size=...`.
            
            3. CLI Output Parsing:
               argv = sys.argv
               output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"
            
            4. Geometry, Modifiers & BMesh Suite:
               - Primitives: Cube, Cylinder, Cone, Torus, UV Sphere, Ico Sphere, Monkey (Suzanne), or custom BMesh geometry.
               - Deep Modifiers Stack:
                 * Bevel (BEVEL) with width=0.04-0.08, segments=2-3 for chamfered industrial edges.
                 * Subdivision Surface (SUBSURF) with levels=1-2 for organic curved surfaces.
                 * Boolean (BOOLEAN) for CSG union, difference, and intersection between component parts.
                 * Mirror (MIRROR), Array (ARRAY), Solidify (SOLIDIFY), Decimate (DECIMATE), Remesh (REMESH).
               - Apply smooth shading (bpy.ops.object.shade_smooth) and compute vertex normals.
            
            5. Realistic Principled BSDF 2.0 Materials & Sub-Mesh Separation:
               - MULTI-MATERIAL SEPARATION (MANDATORY FOR WORKSTATION DCC):
                 * Distinct architectural, mechanical, or functional components MUST be created as separate Blender objects (e.g., `roof = ...`, `walls = ...`) and assigned distinct named materials:
                   mat_roof = bpy.data.materials.new(name="Roof_Material")
                   mat_walls = bpy.data.materials.new(name="Wall_Material")
                 * Do NOT boolean-union or join all components into a single merged mesh unless explicitly requested. Preserving separate sub-meshes allows individual part selection, live PBR painting, and exploded view assembly inspection in the Three.js viewport.
               - Setup real node trees: mat.use_nodes = True; bsdf = mat.node_tree.nodes.get("Principled BSDF")
               - Set realistic physical parameters:
                 * Metals: Metallic=0.85-0.95, Roughness=0.18-0.35, Base Color=(0.75, 0.78, 0.82, 1.0)
                 * Matte Polymers: Metallic=0.0, Roughness=0.3-0.5
                 * Architectural: Metallic=0.05, Roughness=0.65-0.85
               - Workstation Palette: Industrial charcoal, graphite, steel, safety orange (#ea580c) accents. NO neon glow effects.
            
            6. Lighting, Environment & Studio Staging:
               - 3-Point Studio Lights: Key light (1200W Area at (5, 8, 6)), Fill light (500W at (-6, 4, -3)), Rim light (700W at (0, -4, -6))
            
            7. Animation & Camera Rigging (When Requested):
               - Write clean F-curves with `keyframe_insert` so animations are exported to GLB.
            %s
            8. Export Pipeline:
               %s
            """.formatted(format, specializedDirective, getExportStatement(format));
    }

    private String getExportStatement(String format) {
        if ("stl".equalsIgnoreCase(format)) {
            return """
                try:
                    bpy.ops.wm.stl_export(filepath=output_path)
                except AttributeError:
                    bpy.ops.export_mesh.stl(filepath=output_path)
                """;
        }
        if ("blend".equalsIgnoreCase(format)) {
            return "bpy.ops.wm.save_as_mainfile(filepath=output_path)";
        }
        if ("obj".equalsIgnoreCase(format)) {
            return """
                try:
                    bpy.ops.wm.obj_export(filepath=output_path)
                except Exception:
                    bpy.ops.export_scene.obj(filepath=output_path)
                """;
        }
        return "bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')";
    }

    public String generateProceduralModelScript(String prompt, String toolType, String exportFormat) {
        String format = (exportFormat != null && (exportFormat.equalsIgnoreCase("stl") || exportFormat.equalsIgnoreCase("blend") || exportFormat.equalsIgnoreCase("obj"))) ? exportFormat.toLowerCase() : "glb";
        String exportCmd = getExportStatement(format);
        String lowerPrompt = (prompt != null) ? prompt.toLowerCase() : "";
        String normalizedTool = (toolType != null) ? toolType.toLowerCase() : "blender_mesh";

        // =============================================================
        // CAD & Object Modeling Generators (Multi-mesh, PBR, High-Detail)
        // =============================================================

        // 1. Sci-Fi Cargo Container Crate
        if (lowerPrompt.contains("crate") || lowerPrompt.contains("cargo") || lowerPrompt.contains("box") || lowerPrompt.contains("container")) {
            return """
                import bpy, sys, math, os, json
                import mathutils

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def make_mat(name, color, roughness=0.35, metallic=0.2, emission=None, emission_strength=1.0):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = color
                        bsdf.inputs["Roughness"].default_value = roughness
                        bsdf.inputs["Metallic"].default_value = metallic
                        if emission:
                            if "Emission Color" in bsdf.inputs:
                                bsdf.inputs["Emission Color"].default_value = emission
                                bsdf.inputs["Emission Strength"].default_value = emission_strength
                            elif "Emission" in bsdf.inputs:
                                bsdf.inputs["Emission"].default_value = emission
                    return mat

                mat_hull = make_mat("Crate_Hull_Orange", (0.92, 0.35, 0.05, 1.0), roughness=0.3, metallic=0.15)
                mat_armor = make_mat("Carbon_Armor_Dark", (0.08, 0.09, 0.11, 1.0), roughness=0.5, metallic=0.92)
                mat_brass = make_mat("Machined_Brass_Latch", (0.9, 0.72, 0.18, 1.0), roughness=0.2, metallic=0.95)
                mat_glow = make_mat("Cyan_Holo_Display", (0.1, 0.8, 1.0, 1.0), roughness=0.1, metallic=0.1, emission=(0.0, 0.75, 1.0, 1.0), emission_strength=5.0)
                mat_handle = make_mat("Titanium_Steel", (0.7, 0.75, 0.8, 1.0), roughness=0.25, metallic=0.9)
                mat_rubber = make_mat("Rubber_Pads", (0.04, 0.04, 0.04, 1.0), roughness=0.85, metallic=0.0)

                # Main Crate Hull
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.85))
                hull = bpy.context.active_object
                hull.name = "Crate_Main_Chassis"
                hull.scale = (1.8, 1.4, 1.4)
                bpy.ops.object.transform_apply(scale=True)
                bev_h = hull.modifiers.new("Bevel", type='BEVEL')
                bev_h.width = 0.04
                bev_h.segments = 3
                hull.data.materials.append(mat_hull)

                # 8 Corner Armor Reinforcement Brackets
                for sx in [-1, 1]:
                    for sy in [-1, 1]:
                        for sz in [-1, 1]:
                            bx = sx * 0.9
                            by = sy * 0.7
                            bz = 0.85 + sz * 0.7
                            bpy.ops.mesh.primitive_cube_add(size=0.32, location=(bx, by, bz))
                            bracket = bpy.context.active_object
                            bracket.name = f"Armor_Bracket_{sx}_{sy}_{sz}"
                            bev_b = bracket.modifiers.new("Bevel", type='BEVEL')
                            bev_b.width = 0.02
                            bev_b.segments = 2
                            bracket.data.materials.append(mat_armor)

                # Outer Reinforcement Ribs (Sides)
                for sy in [-0.72, 0.72]:
                    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, sy, 0.85))
                    rib = bpy.context.active_object
                    rib.name = f"Reinforcement_Rim_{sy}"
                    rib.scale = (1.6, 0.06, 1.2)
                    bpy.ops.object.transform_apply(scale=True)
                    rib.data.materials.append(mat_armor)

                # Center Holographic Status Screen
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.73, 0.95))
                disp = bpy.context.active_object
                disp.name = "Holographic_Status_Display"
                disp.scale = (0.5, 0.04, 0.25)
                bpy.ops.object.transform_apply(scale=True)
                disp.data.materials.append(mat_glow)

                # Golden Brass Locking Latches
                for sx in [-0.45, 0.45]:
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.3, location=(sx, -0.73, 0.65))
                    latch = bpy.context.active_object
                    latch.name = f"Brass_Locking_Latch_{sx}"
                    latch.rotation_euler = (math.pi / 2, 0, 0)
                    latch.data.materials.append(mat_brass)

                # Top Tubular Carry Handles
                for sx in [-0.5, 0.5]:
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=0.5, location=(sx, 0, 1.62))
                    handle = bpy.context.active_object
                    handle.name = f"Top_Handle_{sx}"
                    handle.rotation_euler = (0, math.pi / 2, 0)
                    handle.data.materials.append(mat_handle)

                # 4 Bottom Rubberized Grip Pads
                for sx in [-0.75, 0.75]:
                    for sy in [-0.55, 0.55]:
                        bpy.ops.mesh.primitive_cylinder_add(radius=0.1, depth=0.08, location=(sx, sy, 0.04))
                        pad = bpy.context.active_object
                        pad.name = f"Rubber_Foot_{sx}_{sy}"
                        pad.data.materials.append(mat_rubber)

                # Key and Fill Studio Lights
                klight = bpy.data.lights.new("KeyLight", type='AREA')
                klight.energy = 1200
                kobj = bpy.data.objects.new("KeyLight", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, -4, 6)

                flight = bpy.data.lights.new("FillLight", type='AREA')
                flight.energy = 600
                fobj = bpy.data.objects.new("FillLight", flight)
                bpy.context.collection.objects.link(fobj)
                fobj.location = (-4, 4, 3)

                %s
                """.formatted(format, exportCmd);
        }

        // 2. Aerodynamic Hover Drone
        if (lowerPrompt.contains("drone") || lowerPrompt.contains("hover") || lowerPrompt.contains("aircraft") || lowerPrompt.contains("copter")) {
            return """
                import bpy, sys, math, os, json
                import mathutils

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def make_mat(name, color, roughness=0.35, metallic=0.2, emission=None, emission_strength=1.0):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = color
                        bsdf.inputs["Roughness"].default_value = roughness
                        bsdf.inputs["Metallic"].default_value = metallic
                        if emission:
                            if "Emission Color" in bsdf.inputs:
                                bsdf.inputs["Emission Color"].default_value = emission
                                bsdf.inputs["Emission Strength"].default_value = emission_strength
                            elif "Emission" in bsdf.inputs:
                                bsdf.inputs["Emission"].default_value = emission
                    return mat

                mat_body = make_mat("Gloss_White_Hull", (0.95, 0.95, 0.98, 1.0), roughness=0.15, metallic=0.1)
                mat_carbon = make_mat("Carbon_Fiber_Black", (0.08, 0.09, 0.11, 1.0), roughness=0.5, metallic=0.85)
                mat_rotor = make_mat("Racing_Orange_Accents", (0.95, 0.35, 0.05, 1.0), roughness=0.25, metallic=0.4)
                mat_eye = make_mat("Glow_Cyan_Optics", (0.1, 0.8, 1.0, 1.0), roughness=0.05, metallic=0.1, emission=(0.0, 0.8, 1.0, 1.0), emission_strength=5.0)

                # Aerodynamic Main Fuselage
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.65))
                fuse = bpy.context.active_object
                fuse.name = "Drone_Main_Fuselage"
                fuse.scale = (0.9, 1.4, 0.35)
                bpy.ops.object.transform_apply(scale=True)
                bev = fuse.modifiers.new("Bevel", type='BEVEL')
                bev.width = 0.08
                bev.segments = 3
                fuse.data.materials.append(mat_body)

                # Cockpit Polarized Canopy
                bpy.ops.mesh.primitive_cylinder_add(radius=0.35, depth=0.18, location=(0, 0.1, 0.88))
                canopy = bpy.context.active_object
                canopy.name = "Canopy_Cockpit"
                canopy.data.materials.append(mat_carbon)

                # Front Gimbal Camera Sphere
                bpy.ops.mesh.primitive_uv_sphere_add(radius=0.18, location=(0, 0.72, 0.52))
                gimbal = bpy.context.active_object
                gimbal.name = "Gimbal_Camera_Sphere"
                gimbal.data.materials.append(mat_carbon)

                # Sensor Lens Eye
                bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.05, location=(0, 0.88, 0.52))
                lens = bpy.context.active_object
                lens.name = "Sensor_Eye_Lens"
                lens.rotation_euler = (math.pi / 2, 0, 0)
                lens.data.materials.append(mat_eye)

                # 4 Ducted Rotor Nacelles
                arms = [(-1.0, 0.9), (1.0, 0.9), (-1.0, -0.9), (1.0, -0.9)]
                for idx, (ax, ay) in enumerate(arms):
                    # Carbon Strut
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=1.1, location=(ax * 0.5, ay * 0.5, 0.65))
                    arm = bpy.context.active_object
                    arm.name = f"Rotor_Strut_{idx}"
                    arm.rotation_euler = (0, math.pi / 2, math.atan2(ay, ax))
                    arm.data.materials.append(mat_carbon)

                    # Circular Ducted Nacelle Housing
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.42, depth=0.16, location=(ax, ay, 0.72))
                    duct = bpy.context.active_object
                    duct.name = f"Ducted_Nacelle_{idx}"
                    duct.data.materials.append(mat_body)

                    # Orange Racing Rotor Disc
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.36, depth=0.02, location=(ax, ay, 0.75))
                    prop = bpy.context.active_object
                    prop.name = f"Rotor_Disc_{idx}"
                    prop.data.materials.append(mat_rotor)

                # Landing Skids
                for sx in [-0.55, 0.55]:
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=1.6, location=(sx, 0, 0.12))
                    skid = bpy.context.active_object
                    skid.name = f"Landing_Skid_{sx}"
                    skid.rotation_euler = (math.pi / 2, 0, 0)
                    skid.data.materials.append(mat_carbon)

                # Studio Lighting
                klight = bpy.data.lights.new("KeyLight", type='AREA')
                klight.energy = 1200
                kobj = bpy.data.objects.new("KeyLight", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, -4, 6)

                %s
                """.formatted(format, exportCmd);
        }

        // 3. Medieval Battleaxe
        if (lowerPrompt.contains("axe") || lowerPrompt.contains("battleaxe") || lowerPrompt.contains("hatchet")) {
            return """
                import bpy, sys, math, os, json
                import mathutils

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def make_mat(name, color, roughness=0.35, metallic=0.2):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = color
                        bsdf.inputs["Roughness"].default_value = roughness
                        bsdf.inputs["Metallic"].default_value = metallic
                    return mat

                mat_wood = make_mat("Rich_Walnut_Wood", (0.35, 0.18, 0.08, 1.0), roughness=0.75, metallic=0.05)
                mat_grip = make_mat("Dark_Leather_Wrap", (0.18, 0.08, 0.04, 1.0), roughness=0.85, metallic=0.1)
                mat_blade = make_mat("Damascus_Polished_Steel", (0.8, 0.85, 0.9, 1.0), roughness=0.15, metallic=0.98)
                mat_iron = make_mat("Dark_Forged_Iron", (0.15, 0.16, 0.18, 1.0), roughness=0.4, metallic=0.9)
                mat_brass = make_mat("Royal_Brass_Rings", (0.88, 0.70, 0.2, 1.0), roughness=0.25, metallic=0.9)

                # Wooden Haft
                bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=2.2, location=(0, 0, 1.1))
                haft = bpy.context.active_object
                haft.name = "Axe_Walnut_Haft"
                haft.data.materials.append(mat_wood)

                # Leather Bound Grip
                bpy.ops.mesh.primitive_cylinder_add(radius=0.065, depth=0.6, location=(0, 0, 0.55))
                grip = bpy.context.active_object
                grip.name = "Leather_Grip"
                grip.data.materials.append(mat_grip)

                # Central Forged Iron Collar
                bpy.ops.mesh.primitive_cylinder_add(radius=0.09, depth=0.45, location=(0, 0, 1.95))
                collar = bpy.context.active_object
                collar.name = "Forged_Iron_Collar"
                collar.data.materials.append(mat_iron)

                # Dual Crescent Damascus Blades
                for sx in [-1, 1]:
                    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx * 0.45, 0, 1.95))
                    blade = bpy.context.active_object
                    blade.name = f"Damascus_Blade_{sx}"
                    blade.scale = (0.75, 0.04, 0.55)
                    bpy.ops.object.transform_apply(scale=True)
                    blade.rotation_euler = (0, 0, sx * 0.08)
                    blade.data.materials.append(mat_blade)

                # Brass Reinforcement Rings
                for sz in [1.75, 2.15]:
                    bpy.ops.mesh.primitive_torus_add(major_radius=0.09, minor_radius=0.02, location=(0, 0, sz))
                    ring = bpy.context.active_object
                    ring.name = f"Brass_Ring_{sz}"
                    ring.data.materials.append(mat_brass)

                # Top Armor-Piercing Spike
                bpy.ops.mesh.primitive_cone_add(radius1=0.06, depth=0.35, location=(0, 0, 2.35))
                spike = bpy.context.active_object
                spike.name = "Armor_Piercing_Spike"
                spike.data.materials.append(mat_blade)

                # Lighting
                klight = bpy.data.lights.new("KeyLight", type='AREA')
                klight.energy = 1000
                kobj = bpy.data.objects.new("KeyLight", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, -4, 5)

                %s
                """.formatted(format, exportCmd);
        }

        // 4. Medieval Longsword
        if (lowerPrompt.contains("sword") || lowerPrompt.contains("blade") || lowerPrompt.contains("dagger") || lowerPrompt.contains("saber")) {
            return """
                import bpy, sys, math, os, json
                import mathutils

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def make_mat(name, color, roughness=0.35, metallic=0.2):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = color
                        bsdf.inputs["Roughness"].default_value = roughness
                        bsdf.inputs["Metallic"].default_value = metallic
                    return mat

                mat_steel = make_mat("Damascus_Polished_Steel", (0.82, 0.86, 0.9, 1.0), roughness=0.15, metallic=0.98)
                mat_brass = make_mat("Royal_Brass", (0.88, 0.70, 0.2, 1.0), roughness=0.25, metallic=0.9)
                mat_grip = make_mat("Dark_Leather_Wrap", (0.1, 0.1, 0.12, 1.0), roughness=0.8, metallic=0.1)

                # Blade
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 1.35))
                blade = bpy.context.active_object
                blade.name = "Longsword_Steel_Blade"
                blade.scale = (0.18, 0.03, 1.8)
                bpy.ops.object.transform_apply(scale=True)
                blade.data.materials.append(mat_steel)

                # Crossguard
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.45))
                guard = bpy.context.active_object
                guard.name = "Engraved_Crossguard"
                guard.scale = (0.7, 0.08, 0.08)
                bpy.ops.object.transform_apply(scale=True)
                guard.data.materials.append(mat_brass)

                # Leather Grip
                bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=0.35, location=(0, 0, 0.25))
                grip = bpy.context.active_object
                grip.name = "Leather_Grip"
                grip.data.materials.append(mat_grip)

                # Crown Pommel
                bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=(0, 0, 0.05))
                pommel = bpy.context.active_object
                pommel.name = "Crown_Pommel"
                pommel.data.materials.append(mat_brass)

                klight = bpy.data.lights.new("KeyLight", type='AREA')
                klight.energy = 950
                kobj = bpy.data.objects.new("KeyLight", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, -4, 5)

                %s
                """.formatted(format, exportCmd);
        }

        // 5. Mechanical Bevel Gear
        if (lowerPrompt.contains("gear")) {
            return """
                import bpy, sys, math, os, json
                import mathutils

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def make_mat(name, color, roughness=0.35, metallic=0.2):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = color
                        bsdf.inputs["Roughness"].default_value = roughness
                        bsdf.inputs["Metallic"].default_value = metallic
                    return mat

                mat_teeth = make_mat("Polished_Gold_Bronze", (0.85, 0.65, 0.12, 1.0), roughness=0.2, metallic=0.88)
                mat_hub = make_mat("Dark_Machined_Iron", (0.2, 0.22, 0.25, 1.0), roughness=0.35, metallic=0.9)

                # Central Hub
                bpy.ops.mesh.primitive_cylinder_add(radius=1.6, depth=0.9, location=(0, 0, 0.45))
                hub = bpy.context.active_object
                hub.name = "Gear_Hub_Core"
                hub.data.materials.append(mat_hub)

                # 24 Bevel Teeth
                for i in range(24):
                    ang = (i / 24) * math.pi * 2
                    tx = math.cos(ang) * 1.6
                    ty = math.sin(ang) * 1.6
                    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(tx, ty, 0.5))
                    tooth = bpy.context.active_object
                    tooth.name = f"Involute_Tooth_{i}"
                    tooth.scale = (0.22, 0.65, 0.75)
                    bpy.ops.object.transform_apply(scale=True)
                    tooth.rotation_euler = (0, 0, ang)
                    tooth.data.materials.append(mat_teeth)

                # Central Keyed Bore Difference
                bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=1.2, location=(0, 0, 0.45))
                bore = bpy.context.active_object
                bore.name = "Keyed_Bore_Cutter"
                mod = hub.modifiers.new("BoreDiff", type='BOOLEAN')
                mod.operation = 'DIFFERENCE'
                mod.object = bore
                bpy.context.view_layer.objects.active = hub
                bpy.ops.object.modifier_apply(modifier="BoreDiff")
                bpy.data.objects.remove(bore, do_unlink=True)

                klight = bpy.data.lights.new("KeyLight", type='AREA')
                klight.energy = 1100
                kobj = bpy.data.objects.new("KeyLight", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, -4, 5)

                %s
                """.formatted(format, exportCmd);
        }

        // 6. Ceramic Coffee Mug
        if (lowerPrompt.contains("mug") || lowerPrompt.contains("cup") || lowerPrompt.contains("coffee") || lowerPrompt.contains("tea")) {
            return """
                import bpy, sys, math, os, json
                import mathutils

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def make_mat(name, color, roughness=0.15, metallic=0.05):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = color
                        bsdf.inputs["Roughness"].default_value = roughness
                        bsdf.inputs["Metallic"].default_value = metallic
                    return mat

                mat_ceramic = make_mat("Cobalt_Gloss_Ceramic", (0.08, 0.45, 0.82, 1.0), roughness=0.12, metallic=0.05)
                mat_white = make_mat("Pure_White_Porcelain", (0.96, 0.97, 0.98, 1.0), roughness=0.15, metallic=0.02)

                # Outer Mug Body
                bpy.ops.mesh.primitive_cylinder_add(radius=0.8, depth=1.6, location=(0, 0, 0.8))
                body = bpy.context.active_object
                body.name = "Ceramic_Outer_Body"
                bev = body.modifiers.new("Bevel", type='BEVEL')
                bev.width = 0.05
                bev.segments = 3
                body.data.materials.append(mat_ceramic)

                # Inner Porcelain Core
                bpy.ops.mesh.primitive_cylinder_add(radius=0.7, depth=1.5, location=(0, 0, 0.85))
                inner = bpy.context.active_object
                inner.name = "Porcelain_Inner_Core"
                inner.data.materials.append(mat_white)

                # Curved Ergonomic Handle
                bpy.ops.mesh.primitive_torus_add(major_radius=0.45, minor_radius=0.1, location=(0.8, 0, 0.8))
                handle = bpy.context.active_object
                handle.name = "Ceramic_Curved_Handle"
                handle.rotation_euler = (0, math.pi / 2, 0)
                handle.data.materials.append(mat_ceramic)

                klight = bpy.data.lights.new("KeyLight", type='AREA')
                klight.energy = 950
                kobj = bpy.data.objects.new("KeyLight", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, -4, 5)

                %s
                """.formatted(format, exportCmd);
        }

        // 7. Aerodynamic Procedural Car / Vehicle
        if (lowerPrompt.contains("car") || lowerPrompt.contains("vehicle") || lowerPrompt.contains("automobile") || lowerPrompt.contains("sedan") || lowerPrompt.contains("truck")) {
            return """
                import bpy, sys, math, os, json
                import mathutils

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def make_mat(name, color, roughness=0.35, metallic=0.2, emission=None, emission_strength=1.0):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = color
                        bsdf.inputs["Roughness"].default_value = roughness
                        bsdf.inputs["Metallic"].default_value = metallic
                        if emission:
                            bsdf.inputs["Emission Color"].default_value = emission
                            bsdf.inputs["Emission Strength"].default_value = emission_strength
                    return mat

                mat_car_paint = make_mat("Gloss_Sport_Red", (0.85, 0.08, 0.12, 1.0), roughness=0.15, metallic=0.85)
                mat_cabin_glass = make_mat("Tinted_Obsidian_Glass", (0.05, 0.08, 0.12, 1.0), roughness=0.05, metallic=0.9)
                mat_tire = make_mat("Vulcanized_Tire_Rubber", (0.08, 0.08, 0.09, 1.0), roughness=0.85, metallic=0.0)
                mat_rim = make_mat("Machined_Billet_Alloy", (0.9, 0.92, 0.95, 1.0), roughness=0.2, metallic=0.98)
                mat_headlight = make_mat("Xenon_LED_Headlight", (1.0, 1.0, 1.0, 1.0), roughness=0.1, metallic=0.1, emission=(0.95, 0.98, 1.0, 1.0), emission_strength=8.0)
                mat_taillight = make_mat("Ruby_Taillight", (0.95, 0.05, 0.05, 1.0), roughness=0.1, metallic=0.1, emission=(1.0, 0.05, 0.05, 1.0), emission_strength=6.0)
                mat_trim = make_mat("Carbon_Trim", (0.04, 0.04, 0.05, 1.0), roughness=0.4, metallic=0.7)

                # Main Aerodynamic Chassis
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.55))
                chassis = bpy.context.active_object
                chassis.name = "Car_Chassis"
                chassis.scale = (1.8, 3.8, 0.5)
                bpy.ops.object.transform_apply(scale=True)
                chassis.data.materials.append(mat_car_paint)

                # Cabin / Greenhouse
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.2, 1.15))
                cabin = bpy.context.active_object
                cabin.name = "Cabin_Greenhouse"
                cabin.scale = (1.45, 1.9, 0.65)
                bpy.ops.object.transform_apply(scale=True)
                cabin.data.materials.append(mat_cabin_glass)

                # Front Hood Bevel Wedge
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 1.25, 0.65))
                hood = bpy.context.active_object
                hood.name = "Front_Hood"
                hood.scale = (1.65, 1.1, 0.35)
                bpy.ops.object.transform_apply(scale=True)
                hood.data.materials.append(mat_car_paint)

                # 4 Wheels & Billet Rims
                for wx, side in [(-0.95, "L"), (0.95, "R")]:
                    for wy, pos in [(1.1, "Front"), (-1.1, "Rear")]:
                        bpy.ops.mesh.primitive_cylinder_add(radius=0.42, depth=0.28, location=(wx, wy, 0.42))
                        tire = bpy.context.active_object
                        tire.name = f"Tire_{pos}_{side}"
                        tire.rotation_euler = (0, math.pi / 2, 0)
                        tire.data.materials.append(mat_tire)

                        bpy.ops.mesh.primitive_cylinder_add(radius=0.28, depth=0.3, location=(wx, wy, 0.42))
                        rim = bpy.context.active_object
                        rim.name = f"Rim_{pos}_{side}"
                        rim.rotation_euler = (0, math.pi / 2, 0)
                        rim.data.materials.append(mat_rim)

                # Headlights & Taillights
                for hx in [-0.65, 0.65]:
                    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(hx, 1.91, 0.58))
                    hl = bpy.context.active_object
                    hl.name = f"Headlight_{hx}"
                    hl.scale = (0.35, 0.08, 0.16)
                    bpy.ops.object.transform_apply(scale=True)
                    hl.data.materials.append(mat_headlight)

                for tx in [-0.65, 0.65]:
                    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(tx, -1.91, 0.65))
                    tl = bpy.context.active_object
                    tl.name = f"Taillight_{tx}"
                    tl.scale = (0.4, 0.08, 0.14)
                    bpy.ops.object.transform_apply(scale=True)
                    tl.data.materials.append(mat_taillight)

                # Rear Aerodynamic Spoiler Wing
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -1.75, 1.05))
                wing = bpy.context.active_object
                wing.name = "Rear_Spoiler_Wing"
                wing.scale = (1.7, 0.35, 0.06)
                bpy.ops.object.transform_apply(scale=True)
                wing.data.materials.append(mat_trim)

                # Studio 3-Point Lighting Rig
                klight = bpy.data.lights.new("KeyLight", type='AREA')
                klight.energy = 1400
                kobj = bpy.data.objects.new("KeyLight", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (5, 8, 7)

                %s
                """.formatted(format, exportCmd);
        }

        // 8. Procedural Jet Airplane / Aircraft
        if (lowerPrompt.contains("airplane") || lowerPrompt.contains("plane") || lowerPrompt.contains("jet")) {
            return """
                import bpy, sys, math, os, json
                import mathutils

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def make_mat(name, color, roughness=0.35, metallic=0.2):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = color
                        bsdf.inputs["Roughness"].default_value = roughness
                        bsdf.inputs["Metallic"].default_value = metallic
                    return mat

                mat_fuselage = make_mat("Aero_Titanium_White", (0.92, 0.93, 0.95, 1.0), roughness=0.2, metallic=0.7)
                mat_wings = make_mat("Carbon_Navy_Wings", (0.08, 0.15, 0.28, 1.0), roughness=0.25, metallic=0.8)
                mat_cockpit = make_mat("Aero_Glass_Tint", (0.05, 0.08, 0.15, 1.0), roughness=0.05, metallic=0.95)

                # Fuselage
                bpy.ops.mesh.primitive_cylinder_add(radius=0.65, depth=7.0, location=(0, 0, 1.8))
                fuse = bpy.context.active_object
                fuse.name = "Fuselage_Body"
                fuse.rotation_euler = (math.pi / 2, 0, 0)
                fuse.data.materials.append(mat_fuselage)

                # Nose Cone
                bpy.ops.mesh.primitive_cone_add(radius1=0.65, depth=1.6, location=(0, 4.3, 1.8))
                nose = bpy.context.active_object
                nose.name = "Nose_Radome"
                nose.rotation_euler = (-math.pi / 2, 0, 0)
                nose.data.materials.append(mat_fuselage)

                # Main Swept Wings
                for sx in [-1, 1]:
                    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx * 2.8, 0.2, 1.8))
                    wing = bpy.context.active_object
                    wing.name = f"Main_Wing_{'L' if sx < 0 else 'R'}"
                    wing.scale = (4.2, 1.2, 0.08)
                    wing.rotation_euler = (0, 0, -sx * 0.2)
                    bpy.ops.object.transform_apply(scale=True, rotation=True)
                    wing.data.materials.append(mat_wings)

                # Vertical Stabilizer Tail Fin
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -3.0, 2.7))
                fin = bpy.context.active_object
                fin.name = "Vertical_Tail_Fin"
                fin.scale = (0.08, 1.2, 1.6)
                bpy.ops.object.transform_apply(scale=True)
                fin.data.materials.append(mat_wings)

                # Cockpit Canopy
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 2.0, 2.4))
                canopy = bpy.context.active_object
                canopy.name = "Cockpit_Canopy"
                canopy.scale = (0.7, 1.8, 0.45)
                bpy.ops.object.transform_apply(scale=True)
                canopy.data.materials.append(mat_cockpit)

                # Key Light
                klight = bpy.data.lights.new("KeyLight", type='AREA')
                klight.energy = 1400
                kobj = bpy.data.objects.new("KeyLight", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (6, 6, 8)

                %s
                """.formatted(format, exportCmd);
        }

        // 9. Procedural Laptop / Workstation Computer
        if (lowerPrompt.contains("laptop") || lowerPrompt.contains("computer") || lowerPrompt.contains("notebook") || lowerPrompt.contains("macbook")) {
            return """
                import bpy, sys, math, os, json
                import mathutils

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def make_mat(name, color, roughness=0.35, metallic=0.2, emission=None, emission_strength=1.0):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = color
                        bsdf.inputs["Roughness"].default_value = roughness
                        bsdf.inputs["Metallic"].default_value = metallic
                        if emission:
                            bsdf.inputs["Emission Color"].default_value = emission
                            bsdf.inputs["Emission Strength"].default_value = emission_strength
                    return mat

                mat_body = make_mat("Anodized_Space_Grey", (0.18, 0.20, 0.22, 1.0), roughness=0.25, metallic=0.92)
                mat_keys = make_mat("Matte_Keyboard_Caps", (0.05, 0.05, 0.06, 1.0), roughness=0.6, metallic=0.1)
                mat_screen = make_mat("Retina_OLED_Display", (0.05, 0.12, 0.22, 1.0), roughness=0.08, metallic=0.2, emission=(0.1, 0.35, 0.65, 1.0), emission_strength=3.0)

                # Base Lower Deck
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.08))
                base = bpy.context.active_object
                base.name = "Laptop_Lower_Chassis"
                base.scale = (3.2, 2.2, 0.16)
                bpy.ops.object.transform_apply(scale=True)
                base.data.materials.append(mat_body)

                # Keyboard Plate Inset
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.15, 0.17))
                keys = bpy.context.active_object
                keys.name = "Keyboard_Island"
                keys.scale = (2.7, 1.2, 0.03)
                bpy.ops.object.transform_apply(scale=True)
                keys.data.materials.append(mat_keys)

                # Trackpad
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.72, 0.17))
                pad = bpy.context.active_object
                pad.name = "Glass_Trackpad"
                pad.scale = (1.1, 0.68, 0.02)
                bpy.ops.object.transform_apply(scale=True)
                pad.data.materials.append(mat_body)

                # Screen Display Lid (angled 115 degrees back)
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -1.05, 1.05))
                lid = bpy.context.active_object
                lid.name = "Screen_Lid_Bezel"
                lid.scale = (3.2, 0.12, 2.1)
                lid.rotation_euler = (0.26, 0, 0)
                bpy.ops.object.transform_apply(scale=True, rotation=True)
                lid.data.materials.append(mat_body)

                # Screen Active Matrix Display
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -1.0, 1.08))
                disp = bpy.context.active_object
                disp.name = "Active_OLED_Screen"
                disp.scale = (2.95, 0.04, 1.85)
                disp.rotation_euler = (0.26, 0, 0)
                bpy.ops.object.transform_apply(scale=True, rotation=True)
                disp.data.materials.append(mat_screen)

                # Key Light
                klight = bpy.data.lights.new("KeyLight", type='AREA')
                klight.energy = 1100
                kobj = bpy.data.objects.new("KeyLight", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (3, -3, 4)

                %s
                """.formatted(format, exportCmd);
        }

        // 10. Procedural Low-Poly Pine Tree / Nature
        if (lowerPrompt.contains("tree") || lowerPrompt.contains("plant") || lowerPrompt.contains("forest") || lowerPrompt.contains("pine")) {
            return """
                import bpy, sys, math, os, json

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def make_mat(name, color, roughness=0.6, metallic=0.0):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = color
                        bsdf.inputs["Roughness"].default_value = roughness
                        bsdf.inputs["Metallic"].default_value = metallic
                    return mat

                mat_wood = make_mat("Rough_Bark_Brown", (0.35, 0.20, 0.12, 1.0), roughness=0.85, metallic=0.0)
                mat_leaves = make_mat("Alpine_Forest_Green", (0.12, 0.45, 0.22, 1.0), roughness=0.6, metallic=0.0)

                # Tree Trunk
                bpy.ops.mesh.primitive_cylinder_add(radius=0.35, depth=2.0, location=(0, 0, 1.0))
                trunk = bpy.context.active_object
                trunk.name = "Tree_Trunk"
                trunk.data.materials.append(mat_wood)

                # Layered Foliage Cones
                for i, (cz, cr, ch) in enumerate([(2.2, 1.8, 2.0), (3.3, 1.4, 1.8), (4.3, 1.0, 1.5)]):
                    bpy.ops.mesh.primitive_cone_add(radius1=cr, depth=ch, location=(0, 0, cz))
                    cone = bpy.context.active_object
                    cone.name = f"Foliage_Layer_{i}"
                    cone.data.materials.append(mat_leaves)

                klight = bpy.data.lights.new("KeyLight", type='AREA')
                klight.energy = 1200
                kobj = bpy.data.objects.new("KeyLight", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, -4, 6)

                %s
                """.formatted(format, exportCmd);
        }

        // 10b. Procedural Cat / Feline / Kitty
        if (lowerPrompt.contains("cat") || lowerPrompt.contains("kitten") || lowerPrompt.contains("kitty") || lowerPrompt.contains("feline") || lowerPrompt.contains("meow")) {
            return """
                import bpy, sys, math, os, json
                import mathutils

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def make_mat(name, color, roughness=0.6, metallic=0.0, emission=None, emission_strength=1.0):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = color
                        bsdf.inputs["Roughness"].default_value = roughness
                        bsdf.inputs["Metallic"].default_value = metallic
                        if emission:
                            if "Emission Color" in bsdf.inputs:
                                bsdf.inputs["Emission Color"].default_value = emission
                                bsdf.inputs["Emission Strength"].default_value = emission_strength
                            elif "Emission" in bsdf.inputs:
                                bsdf.inputs["Emission"].default_value = emission
                    return mat

                mat_fur = make_mat("Cat_Ginger_Fur", (0.92, 0.35, 0.05, 1.0), roughness=0.65, metallic=0.05)
                mat_belly = make_mat("Cat_Cream_Belly", (0.98, 0.95, 0.85, 1.0), roughness=0.7, metallic=0.0)
                mat_pink = make_mat("Cat_Ears_Nose", (0.95, 0.45, 0.65, 1.0), roughness=0.5, metallic=0.0)
                mat_eyes = make_mat("Cat_Emerald_Eyes", (0.05, 0.72, 0.45, 1.0), roughness=0.1, metallic=0.1, emission=(0.02, 0.65, 0.38, 1.0), emission_strength=2.0)
                mat_collar = make_mat("Cat_Collar_Red", (0.85, 0.15, 0.15, 1.0), roughness=0.4, metallic=0.2)
                mat_bell = make_mat("Cat_Bell_Gold", (0.96, 0.65, 0.08, 1.0), roughness=0.2, metallic=0.95)

                # 1. Cat Body (curved horizontal cylinder)
                bpy.ops.mesh.primitive_cylinder_add(radius=0.36, depth=1.2, location=(0, 0, 0.65))
                body = bpy.context.active_object
                body.name = "Cat_Body"
                body.rotation_euler = (math.radians(90), 0, 0)
                bpy.ops.object.transform_apply(rotation=True)
                body.data.materials.append(mat_fur)

                # 2. Cream Belly Pad
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.05, 0.55))
                belly = bpy.context.active_object
                belly.name = "Cat_Belly"
                belly.scale = (0.48, 0.95, 0.35)
                bpy.ops.object.transform_apply(scale=True)
                belly.data.materials.append(mat_belly)

                # 3. Cat Head (Sphere)
                bpy.ops.mesh.primitive_uv_sphere_add(radius=0.36, location=(0, 0.68, 0.98))
                head = bpy.context.active_object
                head.name = "Cat_Head"
                head.scale = (1.0, 0.95, 0.92)
                bpy.ops.object.transform_apply(scale=True)
                head.data.materials.append(mat_fur)

                # 4. Pointy Triangular Ears (Left & Right)
                for sx, name in [(-0.2, "Left"), (0.2, "Right")]:
                    bpy.ops.mesh.primitive_cone_add(radius1=0.14, depth=0.28, location=(sx, 0.65, 1.35))
                    ear = bpy.context.active_object
                    ear.name = f"Cat_Ear_{name}"
                    ear.rotation_euler = (math.radians(-10), 0, math.radians(-15 if sx > 0 else 15))
                    ear.data.materials.append(mat_fur)

                    bpy.ops.mesh.primitive_cone_add(radius1=0.09, depth=0.2, location=(sx * 0.95, 0.68, 1.34))
                    inner = bpy.context.active_object
                    inner.name = f"Cat_Inner_Ear_{name}"
                    inner.rotation_euler = (math.radians(-10), 0, math.radians(-15 if sx > 0 else 15))
                    inner.data.materials.append(mat_pink)

                # 5. Snout & Nose
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 1.0, 0.88))
                snout = bpy.context.active_object
                snout.name = "Cat_Muzzle"
                snout.scale = (0.24, 0.16, 0.14)
                bpy.ops.object.transform_apply(scale=True)
                snout.data.materials.append(mat_belly)

                bpy.ops.mesh.primitive_cone_add(radius1=0.05, depth=0.06, location=(0, 1.08, 0.94))
                nose = bpy.context.active_object
                nose.name = "Cat_Nose"
                nose.rotation_euler = (math.radians(180), 0, 0)
                nose.data.materials.append(mat_pink)

                # 6. Eyes (Left & Right Emerald)
                for sx, name in [(-0.14, "Left"), (0.14, "Right")]:
                    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.065, location=(sx, 0.98, 1.04))
                    eye = bpy.context.active_object
                    eye.name = f"Cat_Eye_{name}"
                    eye.data.materials.append(mat_eyes)

                # 7. Four Paws & Legs
                legs = [
                    ("Cat_Leg_Front_Left", -0.22, 0.42, 0.32),
                    ("Cat_Leg_Front_Right", 0.22, 0.42, 0.32),
                    ("Cat_Leg_Back_Left", -0.24, -0.42, 0.32),
                    ("Cat_Leg_Back_Right", 0.24, -0.42, 0.32),
                ]
                for leg_name, lx, ly, lz in legs:
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.58, location=(lx, ly, lz))
                    leg = bpy.context.active_object
                    leg.name = leg_name
                    leg.data.materials.append(mat_fur)

                    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(lx, ly + 0.03, 0.05))
                    paw = bpy.context.active_object
                    paw.name = f"{leg_name}_Paw"
                    paw.scale = (0.16, 0.18, 0.09)
                    bpy.ops.object.transform_apply(scale=True)
                    paw.data.materials.append(mat_belly)

                # 8. Curved Arching Tail (4 segments)
                tail_pts = [
                    (0, -0.7, 0.72, -35),
                    (0, -0.85, 0.92, -20),
                    (0, -0.9, 1.15, 10),
                    (0, -0.8, 1.32, 45),
                ]
                for idx, (tx, ty, tz, rx) in enumerate(tail_pts):
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.055, depth=0.26, location=(tx, ty, tz))
                    tseg = bpy.context.active_object
                    tseg.name = f"Cat_Tail_{idx + 1}"
                    tseg.rotation_euler = (math.radians(rx), 0, 0)
                    tseg.data.materials.append(mat_fur)

                # 9. Collar with Golden Bell
                bpy.ops.mesh.primitive_torus_add(major_radius=0.35, minor_radius=0.035, location=(0, 0.62, 0.78))
                col = bpy.context.active_object
                col.name = "Cat_Collar"
                col.rotation_euler = (math.radians(90), 0, 0)
                col.data.materials.append(mat_collar)

                bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(0, 0.95, 0.72))
                bell = bpy.context.active_object
                bell.name = "Cat_Bell"
                bell.data.materials.append(mat_bell)

                # Studio Lights
                klight = bpy.data.lights.new("KeyLight", type='AREA')
                klight.energy = 1200
                kobj = bpy.data.objects.new("KeyLight", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, -4, 6)

                %s
                """.formatted(format, exportCmd);
        }

        // 11. Turbine Flange / Mechanical Coupling
        if (lowerPrompt.contains("turbine") || lowerPrompt.contains("flange")) {
            return """
                import bpy, sys, math, os, json
                import mathutils

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def make_mat(name, color, roughness=0.35, metallic=0.2):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = color
                        bsdf.inputs["Roughness"].default_value = roughness
                        bsdf.inputs["Metallic"].default_value = metallic
                    return mat

                mat_steel = make_mat("Brushed_Titanium_Alloy", (0.68, 0.72, 0.78, 1.0), roughness=0.2, metallic=0.95)
                mat_blue = make_mat("Electric_Anodized_Blue", (0.1, 0.35, 0.75, 1.0), roughness=0.25, metallic=0.92)
                mat_brass = make_mat("High_Torque_Brass_Studs", (0.88, 0.70, 0.2, 1.0), roughness=0.22, metallic=0.95)

                # Flange Disc Base
                bpy.ops.mesh.primitive_cylinder_add(radius=2.2, depth=0.45, location=(0, 0, 0.225))
                base = bpy.context.active_object
                base.name = "Flange_Base_Disc"
                base.data.materials.append(mat_steel)

                # Center Column Housing
                bpy.ops.mesh.primitive_cylinder_add(radius=1.35, depth=2.4, location=(0, 0, 1.4))
                col = bpy.context.active_object
                col.name = "Anodized_Center_Column"
                col.data.materials.append(mat_blue)

                # 8 Metric Golden Studs
                for i in range(8):
                    ang = (i / 8) * math.pi * 2
                    bx = math.cos(ang) * 1.8
                    by = math.sin(ang) * 1.8
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.14, depth=0.6, location=(bx, by, 0.45))
                    stud = bpy.context.active_object
                    stud.name = f"Metric_Stud_{i}"
                    stud.data.materials.append(mat_brass)

                klight = bpy.data.lights.new("KeyLight", type='AREA')
                klight.energy = 1100
                kobj = bpy.data.objects.new("KeyLight", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, -4, 6)

                %s
                """.formatted(format, exportCmd);
        }

        // 1. Tool: blender_sculpt_op
        if ("blender_sculpt_op".equals(normalizedTool)) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix
                import bmesh

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                # Base Organic Sculpt Bust
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1.5, location=(0, 0, 1.5))
                bust = bpy.context.active_object
                bust.name = "Sculpt_Bust"

                # Procedural BMesh Sculpt Displacements (Clay / Crease)
                bm = bmesh.new()
                bm.from_mesh(bust.data)
                for v in bm.verts:
                    p = v.co
                    clay = math.sin(p.x * 3.0) * math.cos(p.y * 3.0) * 0.22 + math.sin(p.z * 4.0) * 0.15
                    v.co += v.normal * clay
                bm.to_mesh(bust.data)
                bm.free()
                bust.data.update()

                # Voxel Remesh
                bust.data.remesh_voxel_size = 0.04
                bpy.ops.object.voxel_remesh()
                bpy.ops.object.shade_smooth()

                # Terracotta Sculpt Material
                mat = bpy.data.materials.new("Sculpt_Terracotta")
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (0.75, 0.38, 0.22, 1.0)
                    bsdf.inputs["Roughness"].default_value = 0.70
                    bsdf.inputs["Metallic"].default_value = 0.05
                bust.data.materials.append(mat)

                # Studio Lighting
                klight = bpy.data.lights.new("SculptKey", type='AREA')
                klight.energy = 1100
                kobj = bpy.data.objects.new("SculptKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, 5, 5)

                %s
                """.formatted(format, exportCmd);
        }

        // 2. Tool: blender_mesh_ops
        if ("blender_mesh_ops".equals(normalizedTool)) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix
                import bmesh

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                # Base Manifold Solid Block
                bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 1.0))
                base = bpy.context.active_object
                base.name = "Manifold_Solid"

                # Boolean Cylindrical Core Difference
                bpy.ops.mesh.primitive_cylinder_add(radius=0.7, depth=3.0, location=(0, 0, 1.0))
                cyl = bpy.context.active_object

                mod_b = base.modifiers.new(name="CoreDiff", type='BOOLEAN')
                mod_b.operation = 'DIFFERENCE'
                mod_b.solver = 'EXACT'
                mod_b.object = cyl
                bpy.context.view_layer.objects.active = base
                bpy.ops.object.modifier_apply(modifier="CoreDiff")
                bpy.data.objects.remove(cyl, do_unlink=True)

                # BMesh Weld (remove_doubles)
                bm = bmesh.new()
                bm.from_mesh(base.data)
                bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
                bm.to_mesh(base.data)
                bm.free()
                base.data.update()

                # Chamfer Bevel
                bev = base.modifiers.new("Bevel", type='BEVEL')
                bev.width = 0.05
                bev.segments = 3

                # Decimate Modifier
                dec = base.modifiers.new("Decimate", type='DECIMATE')
                dec.ratio = 0.85

                mat = bpy.data.materials.new("Mat_Machined_Steel")
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (0.75, 0.78, 0.82, 1.0)
                    bsdf.inputs["Metallic"].default_value = 0.92
                    bsdf.inputs["Roughness"].default_value = 0.22
                base.data.materials.append(mat)

                # Studio Lighting
                klight = bpy.data.lights.new("MeshKey", type='AREA')
                klight.energy = 950
                kobj = bpy.data.objects.new("MeshKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, 4, 5)

                %s
                """.formatted(format, exportCmd);
        }

        // Procedural Animation Fallback: House Blasting and Reverse Reassembly
        if (lowerPrompt.contains("house") || lowerPrompt.contains("blast") || lowerPrompt.contains("explod") || lowerPrompt.contains("shatter") || lowerPrompt.contains("demolish") || lowerPrompt.contains("reverse")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene
                scene.frame_start = 1
                scene.frame_end = 120

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def create_mat(name, color, metallic=0.0, roughness=0.5):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    b = mat.node_tree.nodes.get('Principled BSDF')
                    if b:
                        b.inputs['Base Color'].default_value = color
                        b.inputs['Metallic'].default_value = metallic
                        b.inputs['Roughness'].default_value = roughness
                    return mat

                mat_stone = create_mat('Mat_StoneFoundation', (0.25, 0.25, 0.28, 1.0), 0.1, 0.8)
                mat_walls = create_mat('Mat_PlasterWalls', (0.85, 0.82, 0.78, 1.0), 0.0, 0.6)
                mat_roof = create_mat('Mat_SlateRoof', (0.18, 0.22, 0.28, 1.0), 0.1, 0.45)
                mat_wood = create_mat('Mat_OakTrim', (0.45, 0.28, 0.15, 1.0), 0.05, 0.5)
                mat_brick = create_mat('Mat_RedBrick', (0.65, 0.25, 0.18, 1.0), 0.0, 0.75)

                parts = [
                    ('01_Foundation', 'cube', (0, 0, 0.15), (3.2, 3.2, 0.3), mat_stone, (0, 0, -0.4), (0, 0, 0)),
                    ('02_Wall_Front', 'cube', (0, -1.4, 1.2), (3.0, 0.25, 1.8), mat_walls, (0, -2.5, 1.2), (15, 0, -20)),
                    ('03_Wall_Back', 'cube', (0, 1.4, 1.2), (3.0, 0.25, 1.8), mat_walls, (0, 2.8, 1.5), (-25, 0, 15)),
                    ('04_Wall_Left', 'cube', (-1.4, 0, 1.2), (0.25, 2.6, 1.8), mat_walls, (-2.8, 0, 1.4), (0, 30, 25)),
                    ('05_Wall_Right', 'cube', (1.4, 0, 1.2), (0.25, 2.6, 1.8), mat_walls, (2.9, 0, 1.3), (0, -35, -20)),
                    ('06_Roof_Pitch_L', 'cube', (-0.9, 0, 2.6), (1.8, 3.4, 0.18), mat_roof, (-2.2, 0, 3.2), (10, 45, 40)),
                    ('07_Roof_Pitch_R', 'cube', (0.9, 0, 2.6), (1.8, 3.4, 0.18), mat_roof, (2.2, 0, 3.4), (-15, -45, -35)),
                    ('08_Chimney', 'cube', (0.8, 0.8, 3.2), (0.45, 0.45, 1.1), mat_brick, (1.8, 1.8, 4.5), (45, -30, 60)),
                    ('09_Door_Frame', 'cube', (0, -1.5, 0.8), (0.8, 0.15, 1.2), mat_wood, (0, -3.8, 0.5), (60, 0, 0)),
                    ('10_Column_L', 'cylinder', (-1.3, -1.8, 0.8), (0.15, 0.15, 1.2), mat_wood, (-3.2, -2.5, 0.9), (20, 45, 0)),
                    ('11_Column_R', 'cylinder', (1.3, -1.8, 0.8), (0.15, 0.15, 1.2), mat_wood, (3.2, -2.5, 0.8), (-20, -45, 0)),
                    ('12_Debris_A', 'cube', (-0.5, -0.6, 1.8), (0.35, 0.35, 0.35), mat_stone, (-3.5, -3.0, 3.0), (120, 45, 80)),
                    ('13_Debris_B', 'cube', (0.6, -0.4, 2.0), (0.4, 0.4, 0.3), mat_walls, (3.2, -2.8, 3.5), (-90, 80, -40)),
                    ('14_Debris_C', 'cube', (-0.4, 0.8, 2.2), (0.3, 0.3, 0.3), mat_roof, (-2.5, 3.2, 4.0), (70, -110, 50)),
                    ('15_Debris_D', 'cube', (0.5, 0.7, 2.1), (0.35, 0.35, 0.35), mat_brick, (2.8, 3.5, 3.8), (-60, 95, -75)),
                ]

                for name, ptype, loc, sz, mat, blast_offset, rot_deg in parts:
                    if ptype == 'cube':
                        bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
                    else:
                        bpy.ops.mesh.primitive_cylinder_add(radius=sz[0], depth=sz[2], location=loc)
                    obj = bpy.context.active_object
                    obj.name = name
                    if ptype == 'cube':
                        obj.scale = sz
                    obj.data.materials.append(mat)
                    obj.rotation_mode = 'XYZ'
                    
                    # Frame 1: Original assembled position
                    obj.keyframe_insert(data_path='location', frame=1)
                    obj.keyframe_insert(data_path='rotation_euler', frame=1)
                    
                    # Frame 60: Blasted outward along vector + tumbling rotation
                    blast_loc = (loc[0] + blast_offset[0], loc[1] + blast_offset[1], loc[2] + blast_offset[2])
                    obj.location = blast_loc
                    obj.rotation_euler = (math.radians(rot_deg[0]), math.radians(rot_deg[1]), math.radians(rot_deg[2]))
                    obj.keyframe_insert(data_path='location', frame=60)
                    obj.keyframe_insert(data_path='rotation_euler', frame=60)
                    
                    # Frame 120: Reverse reassembled back to initial state
                    obj.location = loc
                    obj.rotation_euler = (0, 0, 0)
                    obj.keyframe_insert(data_path='location', frame=120)
                    obj.keyframe_insert(data_path='rotation_euler', frame=120)

                klight = bpy.data.lights.new('BlastKey', type='AREA')
                klight.energy = 950
                kobj = bpy.data.objects.new('BlastKey', klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (5, 5, 8)

                bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', export_animations=True)
                """.formatted(format);
        }

        // 3. Tool: blender_animate_pipeline
        if ("blender_animate_pipeline".equals(normalizedTool)) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene
                scene.frame_start = 1
                scene.frame_end = 120

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                # Ground Plate Collider
                bpy.ops.mesh.primitive_cube_add(size=8.0, location=(0, 0, -0.2))
                floor_obj = bpy.context.active_object
                floor_obj.name = "Ground_Collider"
                floor_obj.scale = (1.0, 1.0, 0.05)

                # Physics Drop Rigid Bodies (Falling cubes with impact bounce)
                for i in range(4):
                    x = (i - 1.5) * 1.2
                    y = 0.0
                    z = 4.0 + i * 0.8
                    bpy.ops.mesh.primitive_cube_add(size=0.8, location=(x, y, z))
                    cube = bpy.context.active_object
                    cube.name = f"Physics_Cube_{i+1}"
                    
                    cube.keyframe_insert(data_path="location", frame=1)
                    impact_frame = 25 + i * 8
                    cube.location = (x, y, 0.4)
                    cube.keyframe_insert(data_path="location", frame=impact_frame)
                    cube.location = (x, y, 0.85)
                    cube.keyframe_insert(data_path="location", frame=impact_frame + 12)
                    cube.location = (x, y, 0.4)
                    cube.keyframe_insert(data_path="location", frame=impact_frame + 24)
                    cube.keyframe_insert(data_path="location", frame=120)

                # Ground Plate Material
                mat = bpy.data.materials.new("Mat_Ground_Plate")
                mat.use_nodes = True
                b = mat.node_tree.nodes.get("Principled BSDF")
                if b:
                    b.inputs["Base Color"].default_value = (0.2, 0.22, 0.25, 1.0)
                    b.inputs["Metallic"].default_value = 0.8
                    b.inputs["Roughness"].default_value = 0.35
                floor_obj.data.materials.append(mat)

                # Studio Lighting
                klight = bpy.data.lights.new("AnimKey", type='AREA')
                klight.energy = 950
                kobj = bpy.data.objects.new("AnimKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, 4, 6)

                bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', export_animations=True)
                """.formatted(format);
        }

        // 4. Tool: blender_uv_paint
        if ("blender_uv_paint".equals(normalizedTool)) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                # Hero Polyhedron
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.4, location=(0, 0, 1.4))
                obj = bpy.context.active_object
                obj.name = "UV_Paint_Mesh"

                # Smart UV Project Unwrapping
                bpy.context.view_layer.objects.active = obj
                bpy.ops.object.mode_set(mode='EDIT')
                bpy.ops.mesh.select_all(action='SELECT')
                bpy.ops.uv.smart_project(angle_limit=math.radians(66))
                bpy.ops.object.mode_set(mode='OBJECT')

                # Vertex Color Attribute Layer
                mesh = obj.data
                color_layer = mesh.color_attributes.new(
                    name="Col",
                    type='BYTE_COLOR',
                    domain='CORNER'
                )

                for poly in mesh.polygons:
                    for loop_index in poly.loop_indices:
                        v_idx = mesh.loops[loop_index].vertex_index
                        v_co = mesh.vertices[v_idx].co
                        r = 0.5 + 0.5 * math.sin(v_co.x * 2.0)
                        g = 0.5 + 0.5 * math.cos(v_co.y * 2.0)
                        b = (v_co.z - 0.0) / 2.8
                        color_layer.data[loop_index].color = (r, g, b, 1.0)

                # Studio Lighting
                klight = bpy.data.lights.new("UVKey", type='AREA')
                klight.energy = 950
                kobj = bpy.data.objects.new("UVKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, 4, 5)

                %s
                """.formatted(format, exportCmd);
        }

        // 5. Tool: blender_animation
        if ("blender_animation".equals(normalizedTool) || lowerPrompt.contains("animate") || lowerPrompt.contains("keyframe") || lowerPrompt.contains("gear train")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene
                scene.frame_start = 1
                scene.frame_end = 120

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=1.0, depth=0.4, location=(0, 0, 0.2))
                sun = bpy.context.active_object
                sun.name = "Sun_Gear"
                sun.rotation_mode = 'XYZ'
                for f_idx, f_num in enumerate([1, 30, 60, 90, 120]):
                    sun.rotation_euler = (0, 0, (f_idx / 4.0) * math.radians(720))
                    sun.keyframe_insert(data_path="rotation_euler", frame=f_num)

                for i in range(3):
                    base_angle = (i * 2.0 * math.pi) / 3.0
                    px = 2.2 * math.cos(base_angle)
                    py = 2.2 * math.sin(base_angle)
                    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.6, depth=0.35, location=(px, py, 0.2))
                    planet = bpy.context.active_object
                    planet.name = f"Planet_Gear_{i+1}"
                    planet.rotation_mode = 'XYZ'
                    for f_idx, f_num in enumerate([1, 30, 60, 90, 120]):
                        orbit_angle = base_angle + (f_idx / 4.0) * 2.0 * math.pi
                        ox = 2.2 * math.cos(orbit_angle)
                        oy = 2.2 * math.sin(orbit_angle)
                        planet.location = (ox, oy, 0.2)
                        planet.keyframe_insert(data_path="location", frame=f_num)
                        planet.rotation_euler = (0, 0, -(f_idx / 4.0) * 4.0 * math.pi)
                        planet.keyframe_insert(data_path="rotation_euler", frame=f_num)

                bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=3.2, depth=0.3, location=(0, 0, 0.15))
                ring = bpy.context.active_object
                ring.name = "Ring_Housing"

                m_sun = bpy.data.materials.new("Mat_SunGold")
                m_sun.use_nodes = True
                b_sun = m_sun.node_tree.nodes.get("Principled BSDF")
                if b_sun:
                    b_sun.inputs["Base Color"].default_value = (0.85, 0.65, 0.15, 1.0)
                    b_sun.inputs["Metallic"].default_value = 0.95
                    b_sun.inputs["Roughness"].default_value = 0.2
                sun.data.materials.append(m_sun)

                m_ring = bpy.data.materials.new("Mat_DarkSteel")
                m_ring.use_nodes = True
                b_ring = m_ring.node_tree.nodes.get("Principled BSDF")
                if b_ring:
                    b_ring.inputs["Base Color"].default_value = (0.2, 0.22, 0.25, 1.0)
                    b_ring.inputs["Metallic"].default_value = 0.85
                    b_ring.inputs["Roughness"].default_value = 0.35
                ring.data.materials.append(m_ring)

                klight = bpy.data.lights.new("Key", type='AREA')
                klight.energy = 1000
                kobj = bpy.data.objects.new("Key", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, 4, 6)

                flight = bpy.data.lights.new("Fill", type='AREA')
                flight.energy = 500
                fobj = bpy.data.objects.new("Fill", flight)
                bpy.context.collection.objects.link(fobj)
                fobj.location = (-4, -3, 3)

                bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', export_animations=True)
                """.formatted(format);
        }

        // 6. Tool: mesh_modifier
        if ("mesh_modifier".equals(normalizedTool) || lowerPrompt.contains("modifier") || lowerPrompt.contains("heat sink") || lowerPrompt.contains("fins")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 1.0))
                base = bpy.context.active_object
                base.name = "Modifier_Core_Block"
                base.scale = (1.5, 0.8, 0.5)

                for i in range(5):
                    bpy.ops.mesh.primitive_cube_add(size=1.0, location=((i - 2) * 0.5, 0, 1.2))
                    cutter = bpy.context.active_object
                    cutter.name = f"Cutter_{i}"
                    cutter.scale = (0.15, 1.2, 0.6)
                    mod_b = base.modifiers.new(name=f"Bool_Slot_{i}", type='BOOLEAN')
                    mod_b.operation = 'DIFFERENCE'
                    mod_b.object = cutter
                    bpy.context.view_layer.objects.active = base
                    bpy.ops.object.modifier_apply(modifier=f"Bool_Slot_{i}")
                    bpy.data.objects.remove(cutter, do_unlink=True)

                bev = base.modifiers.new(name="Precision_Bevel", type='BEVEL')
                bev.width = 0.04
                bev.segments = 3

                mat = bpy.data.materials.new("Mat_Anodized_Alu")
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (0.18, 0.20, 0.22, 1.0)
                    bsdf.inputs["Metallic"].default_value = 0.90
                    bsdf.inputs["Roughness"].default_value = 0.25
                base.data.materials.append(mat)

                klight = bpy.data.lights.new("ModKey", type='AREA')
                klight.energy = 900
                kobj = bpy.data.objects.new("ModKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, 4, 5)

                %s
                """.formatted(format, exportCmd);
        }

        // 7. Tool: blender_sculpt
        if ("blender_sculpt".equals(normalizedTool) || lowerPrompt.contains("sculpt") || lowerPrompt.contains("terrain") || lowerPrompt.contains("organic")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix
                import bmesh

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1.6, location=(0, 0, 1.2))
                obj = bpy.context.active_object
                obj.name = "Sculpted_Organic_Form"

                bm = bmesh.new()
                bm.from_mesh(obj.data)
                for v in bm.verts:
                    p = v.co
                    disp = math.sin(p.x * 2.5) * math.cos(p.y * 2.5) * 0.25 + math.sin(p.z * 3.0) * 0.18
                    v.co += v.normal * disp
                bm.to_mesh(obj.data)
                bm.free()
                obj.data.update()

                sub = obj.modifiers.new(name="Subsurf", type='SUBSURF')
                sub.levels = 1
                bpy.ops.object.shade_smooth()

                mat = bpy.data.materials.new("Sculpt_Terracotta")
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (0.75, 0.38, 0.22, 1.0)
                    bsdf.inputs["Roughness"].default_value = 0.65
                    bsdf.inputs["Metallic"].default_value = 0.05
                obj.data.materials.append(mat)

                klight = bpy.data.lights.new("SculptKey", type='AREA')
                klight.energy = 1100
                kobj = bpy.data.objects.new("SculptKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, 5, 5)

                %s
                """.formatted(format, exportCmd);
        }

        // 8. Tool: material_shader
        if ("material_shader".equals(normalizedTool)) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1.4, location=(0, 0, 1.6))
                orb = bpy.context.active_object
                orb.name = "PBR_Shader_Orb"
                bpy.ops.object.shade_smooth()

                bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1.8, depth=0.4, location=(0, 0, 0.2))
                pedestal = bpy.context.active_object
                pedestal.name = "Pedestal_Base"
                bev = pedestal.modifiers.new("Bevel", type='BEVEL')
                bev.width = 0.04
                bev.segments = 3

                m_orb = bpy.data.materials.new("Iridescent_Chrome_BSDF")
                m_orb.use_nodes = True
                bsdf = m_orb.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (0.2, 0.45, 0.85, 1.0)
                    bsdf.inputs["Metallic"].default_value = 0.95
                    bsdf.inputs["Roughness"].default_value = 0.12
                    if "Coat Weight" in bsdf.inputs:
                        bsdf.inputs["Coat Weight"].default_value = 1.0
                        bsdf.inputs["Coat Roughness"].default_value = 0.05
                    elif "Clearcoat" in bsdf.inputs:
                        bsdf.inputs["Clearcoat"].default_value = 1.0
                orb.data.materials.append(m_orb)

                m_ped = bpy.data.materials.new("Matte_Charcoal_Pedestal")
                m_ped.use_nodes = True
                b_ped = m_ped.node_tree.nodes.get("Principled BSDF")
                if b_ped:
                    b_ped.inputs["Base Color"].default_value = (0.12, 0.13, 0.15, 1.0)
                    b_ped.inputs["Roughness"].default_value = 0.7
                    b_ped.inputs["Metallic"].default_value = 0.1
                pedestal.data.materials.append(m_ped)

                klight = bpy.data.lights.new("StudioKey", type='AREA')
                klight.energy = 950
                kobj = bpy.data.objects.new("StudioKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, 4, 6)

                %s
                """.formatted(format, exportCmd);
        }

        // 9. Tool: lighting_studio
        if ("lighting_studio".equals(normalizedTool) || lowerPrompt.contains("lighting") || lowerPrompt.contains("softbox") || lowerPrompt.contains("cyclorama")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_torus_add(major_radius=1.3, minor_radius=0.45, location=(0, 0, 1.2))
                torus = bpy.context.active_object
                torus.name = "Showcase_Sculpture"
                torus.rotation_euler[0] = math.radians(45)
                bpy.ops.object.shade_smooth()

                bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 2, 0))
                cyc = bpy.context.active_object
                cyc.name = "Cyclorama_Backdrop"

                m_torus = bpy.data.materials.new("Studio_Brushed_Copper")
                m_torus.use_nodes = True
                b_torus = m_torus.node_tree.nodes.get("Principled BSDF")
                if b_torus:
                    b_torus.inputs["Base Color"].default_value = (0.85, 0.45, 0.28, 1.0)
                    b_torus.inputs["Metallic"].default_value = 0.92
                    b_torus.inputs["Roughness"].default_value = 0.25
                torus.data.materials.append(m_torus)

                m_cyc = bpy.data.materials.new("Studio_Cyc_Gray")
                m_cyc.use_nodes = True
                b_cyc = m_cyc.node_tree.nodes.get("Principled BSDF")
                if b_cyc:
                    b_cyc.inputs["Base Color"].default_value = (0.18, 0.19, 0.21, 1.0)
                    b_cyc.inputs["Roughness"].default_value = 0.85
                cyc.data.materials.append(m_cyc)

                key = bpy.data.lights.new("Softbox_Key", type='AREA')
                key.energy = 1200
                key.color = (1.0, 0.95, 0.88)
                k_obj = bpy.data.objects.new("Softbox_Key", key)
                bpy.context.collection.objects.link(k_obj)
                k_obj.location = (5, -4, 5)

                fill = bpy.data.lights.new("Softbox_Fill", type='AREA')
                fill.energy = 600
                fill.color = (0.88, 0.94, 1.0)
                f_obj = bpy.data.objects.new("Softbox_Fill", fill)
                bpy.context.collection.objects.link(f_obj)
                f_obj.location = (-5, -2, 4)

                rim = bpy.data.lights.new("Softbox_Rim", type='AREA')
                rim.energy = 850
                r_obj = bpy.data.objects.new("Softbox_Rim", rim)
                bpy.context.collection.objects.link(r_obj)
                r_obj.location = (0, 6, 4)

                %s
                """.formatted(format, exportCmd);
        }

        // 10. Tool: geometry_nodes
        if ("geometry_nodes".equals(normalizedTool) || lowerPrompt.contains("geometry node") || lowerPrompt.contains("lattice") || lowerPrompt.contains("dyson")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(0, 0, 1.5))
                core = bpy.context.active_object
                core.name = "Algorithmic_Core"

                num_pts = 24
                for i in range(num_pts):
                    phi = math.acos(1.0 - 2.0 * (i + 0.5) / num_pts)
                    theta = math.pi * (1.0 + 5.0**0.5) * (i + 0.5)
                    r = 2.4
                    x = r * math.sin(phi) * math.cos(theta)
                    y = r * math.sin(phi) * math.sin(theta)
                    z = 1.5 + r * math.cos(phi)
                    
                    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.25, radius2=0.0, depth=0.7, location=(x, y, z))
                    c = bpy.context.active_object
                    c.name = f"Lattice_Node_{i}"
                    v = Vector((x, y, z - 1.5)).normalized()
                    c.rotation_mode = 'QUATERNION'
                    c.rotation_quaternion = v.to_track_quat('Z', 'Y')

                m_core = bpy.data.materials.new("Mat_Core_Titanium")
                m_core.use_nodes = True
                b_c = m_core.node_tree.nodes.get("Principled BSDF")
                if b_c:
                    b_c.inputs["Base Color"].default_value = (0.75, 0.78, 0.82, 1.0)
                    b_c.inputs["Metallic"].default_value = 0.95
                    b_c.inputs["Roughness"].default_value = 0.15
                core.data.materials.append(m_core)

                klight = bpy.data.lights.new("GeomKey", type='AREA')
                klight.energy = 900
                kobj = bpy.data.objects.new("GeomKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, 4, 5)

                %s
                """.formatted(format, exportCmd);
        }

        // 11. Tool: physics_simulation
        if ("physics_simulation".equals(normalizedTool) || lowerPrompt.contains("physics") || lowerPrompt.contains("domino")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene
                scene.frame_start = 1
                scene.frame_end = 120

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_cube_add(size=8.0, location=(0, 0, -0.2))
                floor_obj = bpy.context.active_object
                floor_obj.name = "Physics_Ground_Plate"
                floor_obj.scale = (1.0, 1.0, 0.05)

                num_blocks = 8
                for i in range(num_blocks):
                    x = (i - 3.5) * 0.8
                    y = 0.0
                    z = 0.8
                    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, y, z))
                    blk = bpy.context.active_object
                    blk.name = f"Rigid_Monolith_{i+1}"
                    blk.scale = (0.15, 0.6, 0.8)
                    
                    blk.rotation_mode = 'XYZ'
                    blk.rotation_euler = (0, 0, 0)
                    start_frame = 1 + i * 8
                    hit_frame = start_frame + 18
                    
                    blk.keyframe_insert(data_path="rotation_euler", frame=1)
                    if start_frame > 1:
                        blk.keyframe_insert(data_path="rotation_euler", frame=start_frame)
                    blk.rotation_euler = (0, math.radians(72), 0)
                    blk.keyframe_insert(data_path="rotation_euler", frame=hit_frame)
                    blk.keyframe_insert(data_path="rotation_euler", frame=120)

                mat = bpy.data.materials.new("Mat_Monolith")
                mat.use_nodes = True
                b = mat.node_tree.nodes.get("Principled BSDF")
                if b:
                    b.inputs["Base Color"].default_value = (0.2, 0.22, 0.25, 1.0)
                    b.inputs["Metallic"].default_value = 0.8
                    b.inputs["Roughness"].default_value = 0.3
                floor_obj.data.materials.append(mat)

                klight = bpy.data.lights.new("PhysKey", type='AREA')
                klight.energy = 950
                kobj = bpy.data.objects.new("PhysKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, 4, 6)

                bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', export_animations=True)
                """.formatted(format);
        }

        // 12. Tool: rigging_armature or Articulated 6-Axis Industrial Robot Arm
        if ("rigging_armature".equals(normalizedTool) || lowerPrompt.contains("rig") || lowerPrompt.contains("armature") || lowerPrompt.contains("robot") || lowerPrompt.contains("arm") || lowerPrompt.contains("axis") || lowerPrompt.contains("hydraulic")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene
                scene.frame_start = 1
                scene.frame_end = 120

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def create_mat(name, color, metallic=0.0, roughness=0.5):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get('Principled BSDF')
                    if bsdf:
                        bsdf.inputs['Base Color'].default_value = color
                        bsdf.inputs['Metallic'].default_value = metallic
                        bsdf.inputs['Roughness'].default_value = roughness
                    return mat

                mat_orange = create_mat('Mat_RobotOrange', (0.917, 0.345, 0.047, 1.0), 0.15, 0.25)
                mat_cast = create_mat('Mat_GraphiteCast', (0.15, 0.15, 0.16, 1.0), 0.85, 0.4)
                mat_chrome = create_mat('Mat_PolishedChrome', (0.95, 0.95, 0.96, 1.0), 0.98, 0.08)
                mat_brass = create_mat('Mat_BrassFittings', (0.85, 0.55, 0.08, 1.0), 0.9, 0.25)

                # 1. Base Pedestal
                bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.9, depth=0.25, location=(0, 0, 0.125))
                base_plate = bpy.context.active_object
                base_plate.name = "01_Base_Pedestal"
                base_plate.data.materials.append(mat_cast)

                # 2. Turntable (Axis 1)
                bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.7, depth=0.4, location=(0, 0, 0.45))
                turntable = bpy.context.active_object
                turntable.name = "02_Turntable_A1"
                turntable.data.materials.append(mat_orange)
                turntable.rotation_mode = 'XYZ'
                turntable.keyframe_insert(data_path="rotation_euler", frame=1)
                turntable.rotation_euler = (0, 0, math.radians(45))
                turntable.keyframe_insert(data_path="rotation_euler", frame=60)
                turntable.rotation_euler = (0, 0, -math.radians(30))
                turntable.keyframe_insert(data_path="rotation_euler", frame=90)
                turntable.rotation_euler = (0, 0, 0)
                turntable.keyframe_insert(data_path="rotation_euler", frame=120)

                # 3. Lower Boom Arm (Axis 2)
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 1.45))
                boom = bpy.context.active_object
                boom.name = "03_Lower_Boom_A2"
                boom.scale = (0.35, 0.3, 1.5)
                boom.data.materials.append(mat_orange)
                boom.rotation_mode = 'XYZ'
                boom.keyframe_insert(data_path="rotation_euler", frame=1)
                boom.rotation_euler = (math.radians(20), 0, 0)
                boom.keyframe_insert(data_path="rotation_euler", frame=60)
                boom.rotation_euler = (-math.radians(15), 0, 0)
                boom.keyframe_insert(data_path="rotation_euler", frame=90)
                boom.rotation_euler = (0, 0, 0)
                boom.keyframe_insert(data_path="rotation_euler", frame=120)

                # 4. Hydraulic Lift Cylinder (Sleeve + Piston)
                bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=0.9, location=(0, -0.35, 1.05))
                cyl_sleeve = bpy.context.active_object
                cyl_sleeve.name = "04_Hydraulic_Sleeve"
                cyl_sleeve.rotation_euler = (math.radians(18), 0, 0)
                cyl_sleeve.data.materials.append(mat_cast)

                bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=0.7, location=(0, -0.28, 1.35))
                piston = bpy.context.active_object
                piston.name = "04b_Hydraulic_Piston"
                piston.rotation_euler = (math.radians(18), 0, 0)
                piston.data.materials.append(mat_chrome)

                # 5. Elbow Arm (Axis 3)
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.1, 2.55))
                elbow = bpy.context.active_object
                elbow.name = "05_Elbow_Arm_A3"
                elbow.scale = (0.28, 0.25, 1.1)
                elbow.data.materials.append(mat_orange)
                elbow.rotation_mode = 'XYZ'
                elbow.keyframe_insert(data_path="rotation_euler", frame=1)
                elbow.rotation_euler = (-math.radians(35), 0, 0)
                elbow.keyframe_insert(data_path="rotation_euler", frame=60)
                elbow.rotation_euler = (math.radians(25), 0, 0)
                elbow.keyframe_insert(data_path="rotation_euler", frame=90)
                elbow.rotation_euler = (0, 0, 0)
                elbow.keyframe_insert(data_path="rotation_euler", frame=120)

                # 6. Forearm Roll Housing (Axis 4)
                bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=0.6, location=(0, 0.35, 3.25))
                forearm = bpy.context.active_object
                forearm.name = "06_Forearm_Roll_A4"
                forearm.rotation_euler = (math.radians(90), 0, 0)
                forearm.data.materials.append(mat_cast)
                forearm.rotation_mode = 'XYZ'
                forearm.keyframe_insert(data_path="rotation_euler", frame=1)
                forearm.rotation_euler = (math.radians(90), 0, math.radians(60))
                forearm.keyframe_insert(data_path="rotation_euler", frame=60)
                forearm.rotation_euler = (math.radians(90), 0, -math.radians(60))
                forearm.keyframe_insert(data_path="rotation_euler", frame=120)

                # 7. Wrist Pitch Tilt Joint (Axis 5)
                bpy.ops.mesh.primitive_cube_add(size=0.28, location=(0, 0.72, 3.25))
                wrist = bpy.context.active_object
                wrist.name = "07_Wrist_Pitch_A5"
                wrist.data.materials.append(mat_orange)
                wrist.rotation_mode = 'XYZ'
                wrist.keyframe_insert(data_path="rotation_euler", frame=1)
                wrist.rotation_euler = (math.radians(30), 0, 0)
                wrist.keyframe_insert(data_path="rotation_euler", frame=60)
                wrist.rotation_euler = (-math.radians(30), 0, 0)
                wrist.keyframe_insert(data_path="rotation_euler", frame=120)

                # 8. Tool Flange & Gripper (Axis 6)
                bpy.ops.mesh.primitive_cylinder_add(radius=0.14, depth=0.1, location=(0, 0.92, 3.25))
                flange = bpy.context.active_object
                flange.name = "08_Tool_Flange_A6"
                flange.rotation_euler = (math.radians(90), 0, 0)
                flange.data.materials.append(mat_chrome)

                # Parallel Gripper body
                bpy.ops.mesh.primitive_cube_add(size=0.22, location=(0, 1.05, 3.25))
                grip_body = bpy.context.active_object
                grip_body.name = "09_Gripper_Chassis"
                grip_body.scale = (1.4, 0.6, 0.7)
                grip_body.data.materials.append(mat_cast)

                # Gripper Fingers
                bpy.ops.mesh.primitive_cube_add(size=0.08, location=(-0.1, 1.22, 3.25))
                finger_l = bpy.context.active_object
                finger_l.name = "10_Gripper_Finger_L"
                finger_l.scale = (0.5, 2.5, 0.8)
                finger_l.data.materials.append(mat_chrome)
                finger_l.keyframe_insert(data_path="location", frame=1)
                finger_l.location = (-0.05, 1.22, 3.25)
                finger_l.keyframe_insert(data_path="location", frame=60)
                finger_l.location = (-0.14, 1.22, 3.25)
                finger_l.keyframe_insert(data_path="location", frame=90)
                finger_l.location = (-0.1, 1.22, 3.25)
                finger_l.keyframe_insert(data_path="location", frame=120)

                bpy.ops.mesh.primitive_cube_add(size=0.08, location=(0.1, 1.22, 3.25))
                finger_r = bpy.context.active_object
                finger_r.name = "11_Gripper_Finger_R"
                finger_r.scale = (0.5, 2.5, 0.8)
                finger_r.data.materials.append(mat_chrome)
                finger_r.keyframe_insert(data_path="location", frame=1)
                finger_r.location = (0.05, 1.22, 3.25)
                finger_r.keyframe_insert(data_path="location", frame=60)
                finger_r.location = (0.14, 1.22, 3.25)
                finger_r.keyframe_insert(data_path="location", frame=90)
                finger_r.location = (0.1, 1.22, 3.25)
                finger_r.keyframe_insert(data_path="location", frame=120)

                # Studio Lights
                klight = bpy.data.lights.new("ArmKey", type='AREA')
                klight.energy = 900
                kobj = bpy.data.objects.new("ArmKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, 4, 6)

                bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', export_animations=True)
                """.formatted(format);
        }

        // 13. Tool: camera_compositor
        if ("camera_compositor".equals(normalizedTool) || lowerPrompt.contains("camera") || lowerPrompt.contains("director")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene
                scene.frame_start = 1
                scene.frame_end = 120

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=1.2, depth=3.0, location=(0, 0, 1.5))
                obelisk = bpy.context.active_object
                obelisk.name = "Subject_Obelisk"

                bev = obelisk.modifiers.new("Bevel", type='BEVEL')
                bev.width = 0.05
                bev.segments = 3

                cam_data = bpy.data.cameras.new("Director_Camera")
                cam_data.lens = 50.0
                cam_obj = bpy.data.objects.new("Director_Camera", cam_data)
                bpy.context.collection.objects.link(cam_obj)
                scene.camera = cam_obj

                for f in range(1, 121):
                    ang = (2.0 * math.pi * (f - 1)) / 120.0
                    cam_obj.location = (6.0 * math.cos(ang), 6.0 * math.sin(ang), 3.5)
                    cam_obj.keyframe_insert(data_path="location", frame=f)

                mat = bpy.data.materials.new("Mat_Titanium_Obelisk")
                mat.use_nodes = True
                b = mat.node_tree.nodes.get("Principled BSDF")
                if b:
                    b.inputs["Base Color"].default_value = (0.78, 0.82, 0.86, 1.0)
                    b.inputs["Metallic"].default_value = 0.95
                    b.inputs["Roughness"].default_value = 0.15
                obelisk.data.materials.append(mat)

                klight = bpy.data.lights.new("CamKey", type='AREA')
                klight.energy = 950
                kobj = bpy.data.objects.new("CamKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (5, 5, 6)

                bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', export_cameras=True, export_animations=True)
                """.formatted(format);
        }

        // 14. Tool: scene_assembler
        if ("scene_assembler".equals(normalizedTool) || lowerPrompt.contains("scene") || lowerPrompt.contains("pavilion") || lowerPrompt.contains("compound")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_cube_add(size=12.0, location=(0, 0, -0.25))
                plaza = bpy.context.active_object
                plaza.name = "Plaza_Foundation"
                plaza.scale = (1.0, 1.0, 0.04)

                for i, (px, py) in enumerate([(-3, -3), (3, -3), (-3, 3), (3, 3)]):
                    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.4, depth=4.0, location=(px, py, 2.0))
                    p = bpy.context.active_object
                    p.name = f"Pillar_{i+1}"

                bpy.ops.mesh.primitive_cube_add(size=7.5, location=(0, 0, 4.1))
                roof = bpy.context.active_object
                roof.name = "Cantilever_Roof"
                roof.scale = (1.0, 1.0, 0.05)

                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.2, location=(0, 0, 1.6))
                monolith = bpy.context.active_object
                monolith.name = "Central_Monolith"
                bpy.ops.object.shade_smooth()

                m_con = bpy.data.materials.new("Mat_Concrete")
                m_con.use_nodes = True
                b_con = m_con.node_tree.nodes.get("Principled BSDF")
                if b_con:
                    b_con.inputs["Base Color"].default_value = (0.28, 0.30, 0.33, 1.0)
                    b_con.inputs["Roughness"].default_value = 0.8
                plaza.data.materials.append(m_con)

                m_cop = bpy.data.materials.new("Mat_Sculpture_Copper")
                m_cop.use_nodes = True
                b_cop = m_cop.node_tree.nodes.get("Principled BSDF")
                if b_cop:
                    b_cop.inputs["Base Color"].default_value = (0.85, 0.45, 0.25, 1.0)
                    b_cop.inputs["Metallic"].default_value = 0.95
                    b_cop.inputs["Roughness"].default_value = 0.2
                monolith.data.materials.append(m_cop)

                klight = bpy.data.lights.new("SceneKey", type='AREA')
                klight.energy = 1100
                kobj = bpy.data.objects.new("SceneKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (6, 6, 8)

                %s
                """.formatted(format, exportCmd);
        }

        // Triangle / Triangular Prism
        if (lowerPrompt.contains("triangle") || lowerPrompt.contains("traingle") || lowerPrompt.contains("prism")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix, Quaternion
                import bmesh

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_cylinder_add(vertices=3, radius=1.8, depth=1.2, location=(0, 0, 0.6))
                tri = bpy.context.active_object
                tri.name = "Studio_Triangle_Prism"
                tri.rotation_euler[2] = math.radians(90)

                bev = tri.modifiers.new(name="Bevel", type='BEVEL')
                bev.width = 0.05
                bev.segments = 3

                mat = bpy.data.materials.new(name="Machined_Titanium_Triangle")
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (0.78, 0.82, 0.86, 1.0)
                    bsdf.inputs["Metallic"].default_value = 0.92
                    bsdf.inputs["Roughness"].default_value = 0.22
                tri.data.materials.append(mat)

                key_light = bpy.data.lights.new(name="KeyLight", type='AREA')
                key_light.energy = 900
                key_obj = bpy.data.objects.new("KeyLight", key_light)
                bpy.context.collection.objects.link(key_obj)
                key_obj.location = (4, 4, 5)

                fill_light = bpy.data.lights.new(name="FillLight", type='AREA')
                fill_light.energy = 450
                fill_obj = bpy.data.objects.new("FillLight", fill_light)
                bpy.context.collection.objects.link(fill_obj)
                fill_obj.location = (-4, -2, 3)

                %s
                """.formatted(format, exportCmd);
        }

        // Pyramid / Tetrahedron
        if (lowerPrompt.contains("pyramid") || lowerPrompt.contains("tetrahedron")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix, Quaternion
                import bmesh

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=1.8, radius2=0.0, depth=2.4, location=(0, 0, 1.2))
                pyramid = bpy.context.active_object
                pyramid.name = "Studio_Pyramid"
                pyramid.rotation_euler[2] = math.radians(45)

                color_palette = [
                    ("Face_Graphite", (0.22, 0.24, 0.28, 1.0), 0.1, 0.35),
                    ("Face_Terracotta", (0.75, 0.32, 0.18, 1.0), 0.05, 0.45),
                    ("Face_Cobalt", (0.18, 0.35, 0.65, 1.0), 0.15, 0.3),
                    ("Face_BrushedSteel", (0.82, 0.84, 0.86, 1.0), 0.9, 0.22),
                    ("Base_Charcoal", (0.15, 0.16, 0.18, 1.0), 0.3, 0.4)
                ]

                for name, col, met, rough in color_palette:
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = col
                        bsdf.inputs["Roughness"].default_value = rough
                        bsdf.inputs["Metallic"].default_value = met
                    pyramid.data.materials.append(mat)

                mesh = pyramid.data
                for i, poly in enumerate(mesh.polygons):
                    poly.material_index = i % len(color_palette)

                bevel = pyramid.modifiers.new(name="Bevel", type='BEVEL')
                bevel.width = 0.05
                bevel.segments = 2

                %s
                """.formatted(format, exportCmd);
        }

        // Turbine / Mechanical / CAD Flange
        if (lowerPrompt.contains("turbine") || lowerPrompt.contains("gear") || lowerPrompt.contains("flange")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix, Quaternion
                import bmesh

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_cylinder_add(radius=2.2, depth=0.45, location=(0, 0, 0.225))
                base = bpy.context.active_object
                base.name = "Turbine_Base_Flange"

                bpy.ops.mesh.primitive_cylinder_add(radius=1.3, depth=2.6, location=(0, 0, 1.5))
                housing = bpy.context.active_object
                housing.name = "Center_Housing"

                mod_u = base.modifiers.new(name="UnionHousing", type='BOOLEAN')
                mod_u.operation = 'UNION'
                mod_u.object = housing
                bpy.context.view_layer.objects.active = base
                bpy.ops.object.modifier_apply(modifier="UnionHousing")
                bpy.data.objects.remove(housing, do_unlink=True)

                bpy.ops.mesh.primitive_cylinder_add(radius=0.75, depth=4.0, location=(0, 0, 1.5))
                bore = bpy.context.active_object
                mod_b = base.modifiers.new(name="CenterBore", type='BOOLEAN')
                mod_b.operation = 'DIFFERENCE'
                mod_b.object = bore
                bpy.context.view_layer.objects.active = base
                bpy.ops.object.modifier_apply(modifier="CenterBore")
                bpy.data.objects.remove(bore, do_unlink=True)

                bolt_count = 8
                bolt_radius = 1.8
                for i in range(bolt_count):
                    ang = (2 * math.pi / bolt_count) * i
                    bx = bolt_radius * math.cos(ang)
                    by = bolt_radius * math.sin(ang)
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=1.2, location=(bx, by, 0.225))
                    bolt = bpy.context.active_object
                    mod = base.modifiers.new(name=f"Bolt_{i}", type='BOOLEAN')
                    mod.operation = 'DIFFERENCE'
                    mod.object = bolt
                    bpy.context.view_layer.objects.active = base
                    bpy.ops.object.modifier_apply(modifier=f"Bolt_{i}")
                    bpy.data.objects.remove(bolt, do_unlink=True)

                bev = base.modifiers.new(name="PrecisionBevel", type='BEVEL')
                bev.width = 0.04
                bev.segments = 2

                mat = bpy.data.materials.new(name="Machined_Titanium")
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (0.78, 0.80, 0.83, 1.0)
                    bsdf.inputs["Metallic"].default_value = 0.94
                    bsdf.inputs["Roughness"].default_value = 0.22
                base.data.materials.append(mat)

                %s
                """.formatted(format, exportCmd);
        }

        // Spheres / Geodesic Orbs
        if (lowerPrompt.contains("sphere") || lowerPrompt.contains("orb") || lowerPrompt.contains("planet")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix, Quaternion
                import bmesh

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1.6, location=(0, 0, 1.6))
                sphere = bpy.context.active_object
                sphere.name = "Studio_Sphere"

                bev = sphere.modifiers.new(name="Subsurf", type='SUBSURF')
                bev.levels = 1

                mat = bpy.data.materials.new(name="Frosted_Polymer")
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (0.85, 0.88, 0.92, 1.0)
                    bsdf.inputs["Metallic"].default_value = 0.1
                    bsdf.inputs["Roughness"].default_value = 0.15
                    try:
                        bsdf.inputs["Transmission Weight"].default_value = 0.85
                    except KeyError:
                        pass
                sphere.data.materials.append(mat)

                %s
                """.formatted(format, exportCmd);
        }

        // 17. Tool: kosh_svg_to_3d
        if ("kosh_svg_to_3d".equals(normalizedTool) || lowerPrompt.contains("svg") || lowerPrompt.contains("logo") || lowerPrompt.contains("emblem") || lowerPrompt.contains("badge")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix, Quaternion
                import bmesh

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                # Extruded Vector Shield Emblem / Badge
                curve_data = bpy.data.curves.new(name="SVG_Emblem_Curve", type='CURVE')
                curve_data.dimensions = '2D'
                curve_data.extrude = 0.12
                curve_data.bevel_depth = 0.02
                curve_data.bevel_resolution = 4

                spline = curve_data.splines.new('POLY')
                crest_pts = [
                    (0.0, 1.8, 0.0), (1.2, 1.4, 0.0), (1.4, 0.2, 0.0), 
                    (0.8, -1.0, 0.0), (0.0, -1.8, 0.0),
                    (-0.8, -1.0, 0.0), (-1.4, 0.2, 0.0), (-1.2, 1.4, 0.0)
                ]
                spline.points.add(len(crest_pts) - 1)
                for i, pt in enumerate(crest_pts):
                    spline.points[i].co = (pt[0], pt[1], pt[2], 1.0)
                spline.use_cyclic_u = True

                crest_obj = bpy.data.objects.new("01_Vector_Crest", curve_data)
                bpy.context.collection.objects.link(crest_obj)

                # Inner Chevron Star / Insignia
                bpy.ops.mesh.primitive_cylinder_add(vertices=5, radius=0.7, depth=0.28, location=(0, 0, 0.08))
                star = bpy.context.active_object
                star.name = "02_Emblem_Insignia"
                star.rotation_euler[2] = math.radians(18)

                # Rim Accent Ring
                bpy.ops.mesh.primitive_torus_add(major_radius=1.5, minor_radius=0.06, location=(0, 0, 0.0))
                ring = bpy.context.active_object
                ring.name = "03_Bezel_Trim"

                # Gold Brushed Material
                mat_gold = bpy.data.materials.new("Mat_Brushed_Gold")
                mat_gold.use_nodes = True
                bsdf_g = mat_gold.node_tree.nodes.get("Principled BSDF")
                if bsdf_g:
                    bsdf_g.inputs["Base Color"].default_value = (0.92, 0.75, 0.25, 1.0)
                    bsdf_g.inputs["Metallic"].default_value = 0.95
                    bsdf_g.inputs["Roughness"].default_value = 0.22
                crest_obj.data.materials.append(mat_gold)

                # Cyber Orange Accent Material
                mat_accent = bpy.data.materials.new("Mat_Orange_Accent")
                mat_accent.use_nodes = True
                bsdf_a = mat_accent.node_tree.nodes.get("Principled BSDF")
                if bsdf_a:
                    bsdf_a.inputs["Base Color"].default_value = (0.95, 0.38, 0.08, 1.0)
                    bsdf_a.inputs["Metallic"].default_value = 0.8
                    bsdf_a.inputs["Roughness"].default_value = 0.3
                star.data.materials.append(mat_accent)
                ring.data.materials.append(mat_gold)

                # Studio Lighting
                klight = bpy.data.lights.new("SvgKey", type='AREA')
                klight.energy = 950
                kobj = bpy.data.objects.new("SvgKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (3, 4, 5)

                %s
                """.formatted(format, exportCmd);
        }

        // 18. Tool: kosh_audio_reactive
        if ("kosh_audio_reactive".equals(normalizedTool) || lowerPrompt.contains("audio") || lowerPrompt.contains("waveform") || lowerPrompt.contains("sound") || lowerPrompt.contains("frequency") || lowerPrompt.contains("reactive") || lowerPrompt.contains("equalizer")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix, Quaternion

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene
                scene.frame_start = 1
                scene.frame_end = 120

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def create_emissive_mat(name, color, emission_strength=2.0):
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    b = mat.node_tree.nodes.get("Principled BSDF")
                    if b:
                        b.inputs["Base Color"].default_value = color
                        b.inputs["Metallic"].default_value = 0.8
                        b.inputs["Roughness"].default_value = 0.25
                        try:
                            b.inputs["Emission Color"].default_value = color
                            b.inputs["Emission Strength"].default_value = emission_strength
                        except KeyError:
                            pass
                    return mat

                mat_core = create_emissive_mat("Mat_AudioPulse_Core", (0.95, 0.38, 0.08, 1.0), 3.0)
                mat_mid = create_emissive_mat("Mat_AudioPulse_Mid", (0.15, 0.65, 0.95, 1.0), 2.2)
                mat_outer = create_emissive_mat("Mat_AudioPulse_Outer", (0.6, 0.2, 0.9, 1.0), 1.8)

                # Central pulsating orb
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.7, location=(0, 0, 0))
                core = bpy.context.active_object
                core.name = "00_Audio_Core_Pulsar"
                core.data.materials.append(mat_core)
                for f in [1, 30, 60, 90, 120]:
                    s = 1.0 + 0.35 * math.sin(f * math.pi / 30.0)
                    core.scale = (s, s, s)
                    core.keyframe_insert(data_path="scale", frame=f)

                # Concentric audio equalizer ring ripples (12 rings)
                num_rings = 12
                for i in range(num_rings):
                    rad = 1.1 + i * 0.28
                    bpy.ops.mesh.primitive_torus_add(
                        major_radius=rad,
                        minor_radius=0.035,
                        major_segments=36,
                        minor_segments=8,
                        location=(0, 0, 0)
                    )
                    ring = bpy.context.active_object
                    ring.name = f"Ring_Band_{i+1:02d}"
                    if i < 4:
                        ring.data.materials.append(mat_core)
                    elif i < 8:
                        ring.data.materials.append(mat_mid)
                    else:
                        ring.data.materials.append(mat_outer)

                    for f in [1, 30, 60, 90, 120]:
                        phase = (f / 120.0) * 4.0 * math.pi - i * 0.5
                        z_disp = math.sin(phase) * (0.35 + (i / num_rings) * 0.45)
                        scale_factor = 1.0 + 0.12 * math.cos(phase * 1.5)
                        ring.location = (0, 0, z_disp)
                        ring.scale = (scale_factor, scale_factor, 1.0 + abs(z_disp) * 1.5)
                        ring.keyframe_insert(data_path="location", frame=f)
                        ring.keyframe_insert(data_path="scale", frame=f)

                klight = bpy.data.lights.new("AudioKey", type='AREA')
                klight.energy = 900
                kobj = bpy.data.objects.new("AudioKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, 4, 5)

                bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', export_animations=True)
                """.formatted(format);
        }

        // 19. Tool: kosh_ascii_to_voxel
        if ("kosh_ascii_to_voxel".equals(normalizedTool) || lowerPrompt.contains("ascii") || lowerPrompt.contains("voxel") || lowerPrompt.contains("pixel") || lowerPrompt.contains("monument")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix, Quaternion
                import bmesh

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                def make_mat(name, col, met=0.2, rough=0.4):
                    m = bpy.data.materials.new(name)
                    m.use_nodes = True
                    b = m.node_tree.nodes.get("Principled BSDF")
                    if b:
                        b.inputs["Base Color"].default_value = col
                        b.inputs["Metallic"].default_value = met
                        b.inputs["Roughness"].default_value = rough
                    return m

                mat_steel = make_mat("Voxel_Blade_Steel", (0.85, 0.90, 0.95, 1.0), 0.9, 0.15)
                mat_gold  = make_mat("Voxel_Hilt_Gold", (0.95, 0.75, 0.20, 1.0), 0.95, 0.2)
                mat_ruby  = make_mat("Voxel_Gem_Ruby", (0.90, 0.15, 0.25, 1.0), 0.3, 0.25)
                mat_stone = make_mat("Voxel_Pedestal_Stone", (0.28, 0.30, 0.34, 1.0), 0.1, 0.8)

                grid = [
                    "    ..S..    ",
                    "    .SSS.    ",
                    "    .SSS.    ",
                    "    .SSS.    ",
                    "    .SSS.    ",
                    "    .SSS.    ",
                    "    .SSS.    ",
                    "    .SSS.    ",
                    "   GGGGGGG   ",
                    "     GGG     ",
                    "     GRG     ",
                    "     GGG     ",
                    "      G      ",
                    "  PPPPPPPPP  ",
                    " PPPPPPPPPPP ",
                    "PPPPPPPPPPPPP"
                ]

                voxel_size = 0.2
                rows = len(grid)
                cols = len(grid[0])

                voxels_by_mat = {'S': [], 'G': [], 'R': [], 'P': []}

                for r_idx, row in enumerate(grid):
                    z = (rows - 1 - r_idx) * voxel_size
                    for c_idx, ch in enumerate(row):
                        x = (c_idx - (cols / 2.0)) * voxel_size
                        if ch in voxels_by_mat:
                            voxels_by_mat[ch].append((x, 0.0, z))

                for key, coords in voxels_by_mat.items():
                    if not coords:
                        continue
                    mat = mat_steel if key == 'S' else (mat_gold if key == 'G' else (mat_ruby if key == 'R' else mat_stone))
                    bm = bmesh.new()
                    for pt in coords:
                        mat_trans = Matrix.Translation(Vector(pt))
                        mat_scale = Matrix.Scale(voxel_size * 0.92, 4)
                        bmesh.ops.create_cube(bm, size=1.0, matrix=mat_trans @ mat_scale)
                    mesh = bpy.data.meshes.new(f"Voxel_Layer_{key}")
                    bm.to_mesh(mesh)
                    bm.free()
                    obj = bpy.data.objects.new(f"Voxel_Mesh_{key}", mesh)
                    bpy.context.collection.objects.link(obj)
                    obj.data.materials.append(mat)

                klight = bpy.data.lights.new("VoxelKey", type='AREA')
                klight.energy = 950
                kobj = bpy.data.objects.new("VoxelKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (3, 4, 4)

                %s
                """.formatted(format, exportCmd);
        }

        // 20. Tool: kosh_cad_export_step
        if ("kosh_cad_export_step".equals(normalizedTool) || lowerPrompt.contains("cad_export") || lowerPrompt.contains("turbine") || lowerPrompt.contains("flange") || lowerPrompt.contains("bearing") || lowerPrompt.contains("step")) {
            return """
                import bpy, sys, math, os, json
                import mathutils
                from mathutils import Vector, Euler, Matrix, Quaternion
                import bmesh

                bpy.ops.wm.read_factory_settings(use_empty=True)
                for col in list(bpy.data.collections):
                    bpy.data.collections.remove(col)
                scene = bpy.context.scene

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                # Precision Engineering Flange Turbine with Keyed Bore & Bolt Circle
                # 1. Main Flange Disk
                bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=2.0, depth=0.4, location=(0, 0, 0.2))
                flange = bpy.context.active_object
                flange.name = "01_Flange_Disk"

                # 2. Central Hub
                bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.9, depth=0.8, location=(0, 0, 0.6))
                hub = bpy.context.active_object
                hub.name = "02_Central_Hub"

                m_u = flange.modifiers.new("UnionHub", type='BOOLEAN')
                m_u.operation = 'UNION'
                m_u.solver = 'EXACT'
                m_u.object = hub
                bpy.context.view_layer.objects.active = flange
                bpy.ops.object.modifier_apply(modifier="UnionHub")
                bpy.data.objects.remove(hub, do_unlink=True)

                # 3. Center Shaft Bore Hole (Diameter 0.8)
                bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.4, depth=2.0, location=(0, 0, 0.5))
                bore = bpy.context.active_object

                m_b = flange.modifiers.new("BoreHole", type='BOOLEAN')
                m_b.operation = 'DIFFERENCE'
                m_b.solver = 'EXACT'
                m_b.object = bore
                bpy.context.view_layer.objects.active = flange
                bpy.ops.object.modifier_apply(modifier="BoreHole")
                bpy.data.objects.remove(bore, do_unlink=True)

                # 4. Perimeter Bolt Circle (6 precision M10 clearance holes)
                for i in range(6):
                    ang = (i * 2.0 * math.pi) / 6.0
                    bx = 1.5 * math.cos(ang)
                    by = 1.5 * math.sin(ang)
                    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.15, depth=1.5, location=(bx, by, 0.2))
                    b_cyl = bpy.context.active_object
                    mod = flange.modifiers.new(f"BoltHole_{i}", type='BOOLEAN')
                    mod.operation = 'DIFFERENCE'
                    mod.solver = 'EXACT'
                    mod.object = b_cyl
                    bpy.context.view_layer.objects.active = flange
                    bpy.ops.object.modifier_apply(modifier=f"BoltHole_{i}")
                    bpy.data.objects.remove(b_cyl, do_unlink=True)

                # 5. Radial Turbine Impeller Blades (12 blades)
                for b_idx in range(12):
                    b_ang = (b_idx * 2.0 * math.pi) / 12.0
                    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(1.35 * math.cos(b_ang), 1.35 * math.sin(b_ang), 0.7))
                    blade = bpy.context.active_object
                    blade.name = f"Blade_{b_idx+1:02d}"
                    blade.scale = (0.5, 0.06, 0.35)
                    blade.rotation_euler = (0, math.radians(-25), b_ang)

                bev = flange.modifiers.new("MachinedBevel", type='BEVEL')
                bev.width = 0.03
                bev.segments = 3

                mat = bpy.data.materials.new("Mat_6061_Aluminum")
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (0.88, 0.89, 0.92, 1.0)
                    bsdf.inputs["Metallic"].default_value = 0.96
                    bsdf.inputs["Roughness"].default_value = 0.18
                flange.data.materials.append(mat)

                klight = bpy.data.lights.new("CadKey", type='AREA')
                klight.energy = 1100
                kobj = bpy.data.objects.new("CadKey", klight)
                bpy.context.collection.objects.link(kobj)
                kobj.location = (4, 4, 6)

                %s
                """.formatted(format, exportCmd);
        }


        // Default: Precision Chamfered Workstation Crate
        return """
            import bpy, sys, math, os, json
            import mathutils
            from mathutils import Vector, Euler, Matrix, Quaternion
            import bmesh

            bpy.ops.wm.read_factory_settings(use_empty=True)
            for col in list(bpy.data.collections):
                bpy.data.collections.remove(col)
            scene = bpy.context.scene

            argv = sys.argv
            output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

            bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 1.0))
            box = bpy.context.active_object
            box.name = "Workstation_Module"

            bev = box.modifiers.new(name="Bevel", type='BEVEL')
            bev.width = 0.08
            bev.segments = 3

            mat_box = bpy.data.materials.new(name="Industrial_Graphite")
            mat_box.use_nodes = True
            bsdf_box = mat_box.node_tree.nodes.get("Principled BSDF")
            if bsdf_box:
                bsdf_box.inputs["Base Color"].default_value = (0.22, 0.23, 0.26, 1.0)
                bsdf_box.inputs["Metallic"].default_value = 0.75
                bsdf_box.inputs["Roughness"].default_value = 0.32
            box.data.materials.append(mat_box)

            bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=0.15, location=(0, 0, 2.05))
            bezel = bpy.context.active_object
            bezel.name = "Accent_Collar"

            mat_bezel = bpy.data.materials.new(name="Safety_Orange")
            mat_bezel.use_nodes = True
            bsdf_b = mat_bezel.node_tree.nodes.get("Principled BSDF")
            if bsdf_b:
                bsdf_b.inputs["Base Color"].default_value = (0.92, 0.35, 0.05, 1.0)
                bsdf_b.inputs["Metallic"].default_value = 0.1
                bsdf_b.inputs["Roughness"].default_value = 0.4
            bezel.data.materials.append(mat_bezel)

            %s
            """.formatted(format, exportCmd);
    }
}
