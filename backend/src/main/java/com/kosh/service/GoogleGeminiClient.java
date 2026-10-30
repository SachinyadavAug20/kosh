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
                    return callGeminiGenerateContent(prompt, systemPrompt, model, trimmedKey);
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
                 * Deform: Displace (DISPLACE with procedural Voronoi/Noise), Simple Deform (BEND, TWIST).
                 * Curves & Extrusions: Bezier curves with bevel depth, 3D text.
               - Apply smooth shading (bpy.ops.object.shade_smooth) and compute vertex normals.
            
            5. Realistic Principled BSDF 2.0 Materials:
               - Setup real node trees: mat.use_nodes = True; bsdf = mat.node_tree.nodes.get("Principled BSDF")
               - Set realistic physical parameters:
                 * Metals (Steel, Aluminium, Titanium, Chrome): Metallic=0.85-0.95, Roughness=0.18-0.35, Base Color=(0.75, 0.78, 0.82, 1.0)
                 * Matte Polymers / Industrial Plastics: Metallic=0.0, Roughness=0.3-0.5
                 * Architectural (Concrete, Ceramic Tile): Metallic=0.05, Roughness=0.65-0.85
                 * Glass / Refraction: Transmission Weight=1.0, Roughness=0.04, IOR=1.45
                 * Procedural Node Graphs: ShaderNodeTexNoise, ShaderNodeTexVoronoi, ShaderNodeValToRGB, ShaderNodeBump
               - Workstation Palette: Industrial charcoal, graphite, steel, safety orange (#ea580c) accents. NO neon glow effects.
            
            6. Lighting, Environment & Studio Staging:
               - 3-Point Studio Lights: Key light (1200W Area/Sun at (5, 8, 6)), Fill light (500W at (-6, 4, -3)), Rim light (700W at (0, -4, -6))
               - Headless Nishita Sky: World node tree with ShaderNodeTexSky if outdoor environment requested.
            
            7. Animation & Camera Rigging (When Requested):
               - Turntable spin: 360-degree rotation across 60 frames (obj.rotation_euler.z keyframes from 0 to 2*pi).
               - Floating hover: Sine wave z-position oscillation keyframes.
               - Camera: 50mm or 85mm focal length pointed at target using track-to constraint or Vector math.
            
            8. Export Pipeline:
               %s
            """.formatted(format, getExportStatement(format));
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

        // 0. Triangle / Traingle / Triangular Prism / Wedge
        if (lowerPrompt.contains("triangle") || lowerPrompt.contains("traingle") || lowerPrompt.contains("prism") || lowerPrompt.contains("wedge")) {
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

                # High-precision 3-sided prism / triangle
                bpy.ops.mesh.primitive_cylinder_add(vertices=3, radius=1.8, depth=1.2, location=(0, 0, 0.6))
                tri = bpy.context.active_object
                tri.name = "Studio_Triangle_Prism"
                tri.rotation_euler[2] = math.radians(90)

                # Chamfered bevel modifier
                bev = tri.modifiers.new(name="Bevel", type='BEVEL')
                bev.width = 0.05
                bev.segments = 3

                # Studio Titanium BSDF Material
                mat = bpy.data.materials.new(name="Machined_Titanium_Triangle")
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (0.78, 0.82, 0.86, 1.0)
                    bsdf.inputs["Metallic"].default_value = 0.92
                    bsdf.inputs["Roughness"].default_value = 0.22
                tri.data.materials.append(mat)

                # Studio 3-point lighting
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

        // 1. Pyramid / Tetrahedron (clean studio finish)
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
                    poly.material_index = i %% len(color_palette)

                bevel = pyramid.modifiers.new(name="Bevel", type='BEVEL')
                bevel.width = 0.05
                bevel.segments = 2

                %s
                """.formatted(format, exportCmd);
        }

        // 2. Turbine / Mechanical / CAD Flange / Gear
        if ("cad_model".equalsIgnoreCase(toolType) || lowerPrompt.contains("turbine") || lowerPrompt.contains("gear") || lowerPrompt.contains("flange") || lowerPrompt.contains("mechanical")) {
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

                # Base flange ring
                bpy.ops.mesh.primitive_cylinder_add(radius=2.2, depth=0.45, location=(0, 0, 0.225))
                base = bpy.context.active_object
                base.name = "Turbine_Base_Flange"

                # Central housing
                bpy.ops.mesh.primitive_cylinder_add(radius=1.3, depth=2.6, location=(0, 0, 1.5))
                housing = bpy.context.active_object
                housing.name = "Center_Housing"

                # Union
                mod_u = base.modifiers.new(name="UnionHousing", type='BOOLEAN')
                mod_u.operation = 'UNION'
                mod_u.object = housing
                bpy.context.view_layer.objects.active = base
                bpy.ops.object.modifier_apply(modifier="UnionHousing")
                bpy.data.objects.remove(housing, do_unlink=True)

                # Bore hole
                bpy.ops.mesh.primitive_cylinder_add(radius=0.75, depth=4.0, location=(0, 0, 1.5))
                bore = bpy.context.active_object
                mod_b = base.modifiers.new(name="CenterBore", type='BOOLEAN')
                mod_b.operation = 'DIFFERENCE'
                mod_b.object = bore
                bpy.context.view_layer.objects.active = base
                bpy.ops.object.modifier_apply(modifier="CenterBore")
                bpy.data.objects.remove(bore, do_unlink=True)

                # Bolt clearance circle
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

                # Precision Bevel Chamfer
                bev = base.modifiers.new(name="PrecisionBevel", type='BEVEL')
                bev.width = 0.04
                bev.segments = 2

                # Material - Titanium / Precision Machined Steel
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

        // 3. Spheres / Geodesic Orbs
        if (lowerPrompt.contains("sphere") || lowerPrompt.contains("orb") || lowerPrompt.contains("planet") || lowerPrompt.contains("ball")) {
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

        // 4. Default: Precision Chamfered Workstation Crate
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

            # Safety orange accent bezel
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
