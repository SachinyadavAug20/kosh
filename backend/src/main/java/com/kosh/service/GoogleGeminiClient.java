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

    @Value("${google.gemini.model:gemini-2.5-flash}")
    private String primaryModel;

    @Value("${google.gemini.fallback-model:gemini-flash-latest}")
    private String fallbackModel;

    @Value("${kosh.gemini.api-key:}")
    private String defaultApiKey;

    private static final List<String> CASCADE_MODELS = List.of(
            "gemini-2.5-flash",
            "gemini-flash-latest",
            "gemini-2.5-flash-lite",
            "gemini-3.5-flash",
            "gemini-2.5-pro"
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
                - Rig dynamic motion with keyframes on location, rotation_euler, or scale.
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
        }

        return """
            You are a senior technical 3D artist and CAD engineer creating production-grade Blender Python (`bpy`) scripts for headless execution.
            Generate ONLY executable Python code. No markdown fences, no preamble, no explanations.
            
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
        return "bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')";
    }

    public String generateProceduralModelScript(String prompt, String toolType, String exportFormat) {
        String format = (exportFormat != null && exportFormat.equalsIgnoreCase("stl")) ? "stl" : "glb";
        String exportCmd = getExportStatement(format);
        String lowerPrompt = (prompt != null) ? prompt.toLowerCase() : "";
        String normalizedTool = (toolType != null) ? toolType.toLowerCase() : "blender_mesh";

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
                sun.rotation_euler = (0, 0, 0)
                sun.keyframe_insert(data_path="rotation_euler", frame=1)
                sun.rotation_euler = (0, 0, math.radians(720))
                sun.keyframe_insert(data_path="rotation_euler", frame=120)

                for i in range(3):
                    angle = (i * 2.0 * math.pi) / 3.0
                    px = 2.2 * math.cos(angle)
                    py = 2.2 * math.sin(angle)
                    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.6, depth=0.35, location=(px, py, 0.2))
                    planet = bpy.context.active_object
                    planet.name = f"Planet_Gear_{i+1}"
                    planet.rotation_mode = 'XYZ'
                    planet.rotation_euler = (0, 0, 0)
                    planet.keyframe_insert(data_path="rotation_euler", frame=1)
                    planet.rotation_euler = (0, 0, -math.radians(1440))
                    planet.keyframe_insert(data_path="rotation_euler", frame=120)

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
        if ("material_shader".equals(normalizedTool) || lowerPrompt.contains("shader") || lowerPrompt.contains("pbr") || lowerPrompt.contains("iridescent")) {
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

        // 12. Tool: rigging_armature
        if ("rigging_armature".equals(normalizedTool) || lowerPrompt.contains("rig") || lowerPrompt.contains("armature") || lowerPrompt.contains("robot arm")) {
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

                bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=0.4, location=(0, 0, 0.2))
                base = bpy.context.active_object
                base.name = "Arm_Turntable_Base"

                bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=1.6, location=(0, 0, 1.2))
                limb1 = bpy.context.active_object
                limb1.name = "Limb_Upper"
                limb1.rotation_mode = 'XYZ'
                limb1.keyframe_insert(data_path="rotation_euler", frame=1)
                limb1.rotation_euler = (math.radians(25), 0, math.radians(45))
                limb1.keyframe_insert(data_path="rotation_euler", frame=60)
                limb1.rotation_euler = (0, 0, 0)
                limb1.keyframe_insert(data_path="rotation_euler", frame=120)

                bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=1.4, location=(0, 0.4, 2.4))
                limb2 = bpy.context.active_object
                limb2.name = "Limb_Forearm"
                limb2.rotation_mode = 'XYZ'
                limb2.keyframe_insert(data_path="rotation_euler", frame=1)
                limb2.rotation_euler = (-math.radians(40), 0, math.radians(90))
                limb2.keyframe_insert(data_path="rotation_euler", frame=60)
                limb2.rotation_euler = (0, 0, 0)
                limb2.keyframe_insert(data_path="rotation_euler", frame=120)

                bpy.ops.mesh.primitive_torus_add(major_radius=0.3, minor_radius=0.08, location=(0, 0.6, 3.2))
                claw = bpy.context.active_object
                claw.name = "End_Effector_Gripper"

                mat = bpy.data.materials.new("Mat_KukaOrange")
                mat.use_nodes = True
                b = mat.node_tree.nodes.get("Principled BSDF")
                if b:
                    b.inputs["Base Color"].default_value = (0.92, 0.35, 0.05, 1.0)
                    b.inputs["Metallic"].default_value = 0.2
                    b.inputs["Roughness"].default_value = 0.35
                limb1.data.materials.append(mat)
                limb2.data.materials.append(mat)

                klight = bpy.data.lights.new("ArmKey", type='AREA')
                klight.energy = 950
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
        if ("cad_model".equalsIgnoreCase(toolType) || lowerPrompt.contains("turbine") || lowerPrompt.contains("gear") || lowerPrompt.contains("flange")) {
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
