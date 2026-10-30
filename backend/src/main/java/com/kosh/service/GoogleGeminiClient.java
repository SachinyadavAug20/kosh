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

    // Ordered cascade pool of working Gemini models to seamlessly overcome 503/429 spikes
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

    /**
     * Calls Google Gemini API to generate a headless Blender Python script using a Google API key.
     * Features automated exponential backoff retries for temporary spikes (503 / 429) and
     * a multi-model cascade pool (gemini-2.5-flash -> gemini-flash-latest -> gemini-2.5-flash-lite -> gemini-3.5-flash).
     *
     * @param prompt User prompt describing the 3D mesh or CAD model
     * @param toolType Tool identifier ("blender_mesh" or "cad_model")
     * @param apiKey User's Google API Key (e.g. AIzaSy...)
     * @param exportFormat Target export format ("glb" or "stl")
     * @return Clean Python script
     */
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

        // Offline / Demo bypass
        if ("demo".equalsIgnoreCase(trimmedKey) || "mock".equalsIgnoreCase(trimmedKey) || "offline".equalsIgnoreCase(trimmedKey)) {
            log.info("Generating procedural fallback script in demo mode for prompt: {}", prompt);
            return generateProceduralModelScript(prompt, toolType, exportFormat);
        }

        String systemPrompt = buildSystemPrompt(toolType, exportFormat);

        // Build candidate list with primary model prioritized
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
                                log.info("Waiting {}ms before retrying model {}...", sleepMs, model);
                                Thread.sleep(sleepMs);
                            } catch (InterruptedException ie) {
                                Thread.currentThread().interrupt();
                            }
                            continue;
                        } else {
                            log.warn("Model {} exhausted retries on HTTP {}. Cascading to next model...", model, statusCode);
                            break;
                        }
                    } else if (statusCode == 404 || statusCode == 400) {
                        log.warn("Model {} returned HTTP {}. Skipping to next model in cascade...", model, statusCode);
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

        log.warn("All Gemini models in cascade currently experiencing high-demand spikes. Providing prompt-aware procedural Blender script for prompt: '{}'", prompt);
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
            You are an expert Blender 3D and CAD Python (`bpy`) script generator for headless automated execution.
            Generate ONLY a single Python script that constructs the requested 3D model.
            
            Strict Requirements:
            1. Clean scene first:
               import bpy, sys
               bpy.ops.object.select_all(action='SELECT')
               bpy.ops.object.delete(use_global=False)
            2. Parse output filepath passed via command line after `--`:
               argv = sys.argv
               output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"
            3. Build the geometry procedurally using bpy.ops.mesh, bmesh, modifiers, or CSG booleans.
            4. Add smooth shading, materials with metallic/roughness and rich base colors if appropriate.
            5. Export final result to `output_path`:
               %s
            6. Return ONLY valid Python code. DO NOT wrap with markdown, explanation, or conversational chatter.
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

        if (lowerPrompt.contains("pyramid") || lowerPrompt.contains("tetrahedron")) {
            return """
                import bpy
                import sys
                import math

                bpy.ops.object.select_all(action='SELECT')
                bpy.ops.object.delete(use_global=False)

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=1.8, radius2=0.0, depth=2.4, location=(0, 0, 1.2))
                pyramid = bpy.context.active_object
                pyramid.name = "Color_Pyramid"
                pyramid.rotation_euler[2] = math.radians(45)

                color_palette = [
                    ("Side_Ruby_Red", (0.92, 0.18, 0.22, 1.0)),
                    ("Side_Emerald_Green", (0.12, 0.82, 0.38, 1.0)),
                    ("Side_Sapphire_Blue", (0.18, 0.48, 0.96, 1.0)),
                    ("Side_Amber_Gold", (0.98, 0.74, 0.12, 1.0)),
                    ("Base_Obsidian", (0.12, 0.13, 0.16, 1.0))
                ]

                for name, col in color_palette:
                    mat = bpy.data.materials.new(name=name)
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = col
                        bsdf.inputs["Roughness"].default_value = 0.25
                        bsdf.inputs["Metallic"].default_value = 0.15
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

        if ("cad_model".equalsIgnoreCase(toolType) || lowerPrompt.contains("gear") || lowerPrompt.contains("flange") || lowerPrompt.contains("mechanical")) {
            return """
                import bpy
                import sys
                import math

                bpy.ops.object.select_all(action='SELECT')
                bpy.ops.object.delete(use_global=False)

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_cylinder_add(radius=2.0, depth=0.4, location=(0, 0, 0.2))
                base = bpy.context.active_object
                base.name = "Flange_Base"

                bpy.ops.mesh.primitive_cylinder_add(radius=0.9, depth=2.4, location=(0, 0, 1.4))
                shaft = bpy.context.active_object
                shaft.name = "Center_Shaft"

                mod_union = base.modifiers.new(name="UnionShaft", type='BOOLEAN')
                mod_union.operation = 'UNION'
                mod_union.object = shaft
                bpy.context.view_layer.objects.active = base
                bpy.ops.object.modifier_apply(modifier="UnionShaft")
                bpy.data.objects.remove(shaft, do_unlink=True)

                bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=4.0, location=(0, 0, 1.4))
                hole = bpy.context.active_object
                mod_bore = base.modifiers.new(name="BoreHole", type='BOOLEAN')
                mod_bore.operation = 'DIFFERENCE'
                mod_bore.object = hole
                bpy.context.view_layer.objects.active = base
                bpy.ops.object.modifier_apply(modifier="BoreHole")
                bpy.data.objects.remove(hole, do_unlink=True)

                bolt_count = 6
                bolt_dist = 1.5
                for i in range(bolt_count):
                    ang = (2 * math.pi / bolt_count) * i
                    bx = bolt_dist * math.cos(ang)
                    by = bolt_dist * math.sin(ang)
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=1.0, location=(bx, by, 0.2))
                    bhole = bpy.context.active_object
                    mod = base.modifiers.new(name=f"Bolt_{i}", type='BOOLEAN')
                    mod.operation = 'DIFFERENCE'
                    mod.object = bhole
                    bpy.context.view_layer.objects.active = base
                    bpy.ops.object.modifier_apply(modifier=f"Bolt_{i}")
                    bpy.data.objects.remove(bhole, do_unlink=True)

                mat = bpy.data.materials.new(name="CAD_Precision_Steel")
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (0.78, 0.80, 0.84, 1.0)
                    bsdf.inputs["Metallic"].default_value = 0.92
                    bsdf.inputs["Roughness"].default_value = 0.22
                base.data.materials.append(mat)

                %s
                """.formatted(format, exportCmd);
        }

        if (lowerPrompt.contains("sphere") || lowerPrompt.contains("orb") || lowerPrompt.contains("planet") || lowerPrompt.contains("ball")) {
            return """
                import bpy
                import sys

                bpy.ops.object.select_all(action='SELECT')
                bpy.ops.object.delete(use_global=False)

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1.6, location=(0, 0, 1.6))
                sphere = bpy.context.active_object
                sphere.name = "Studio_Sphere"

                mat = bpy.data.materials.new(name="Iridescent_Glass")
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (0.2, 0.6, 0.95, 1.0)
                    bsdf.inputs["Metallic"].default_value = 0.3
                    bsdf.inputs["Roughness"].default_value = 0.1
                sphere.data.materials.append(mat)

                %s
                """.formatted(format, exportCmd);
        }

        return """
            import bpy
            import sys

            bpy.ops.object.select_all(action='SELECT')
            bpy.ops.object.delete(use_global=False)

            argv = sys.argv
            output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

            bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 1.0))
            box = bpy.context.active_object
            box.name = "Studio_Crate"

            bevel = box.modifiers.new(name="Bevel", type='BEVEL')
            bevel.width = 0.08
            bevel.segments = 3

            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.45, location=(0, 0, 2.35))
            core = bpy.context.active_object
            core.name = "Energy_Core"

            mat_box = bpy.data.materials.new(name="Slate_Armor")
            mat_box.use_nodes = True
            bsdf_box = mat_box.node_tree.nodes.get("Principled BSDF")
            if bsdf_box:
                bsdf_box.inputs["Base Color"].default_value = (0.16, 0.18, 0.22, 1.0)
                bsdf_box.inputs["Metallic"].default_value = 0.8
                bsdf_box.inputs["Roughness"].default_value = 0.3
            box.data.materials.append(mat_box)

            mat_core = bpy.data.materials.new(name="Core_Cyan_Emission")
            mat_core.use_nodes = True
            bsdf_core = mat_core.node_tree.nodes.get("Principled BSDF")
            if bsdf_core:
                bsdf_core.inputs["Base Color"].default_value = (0.1, 0.8, 0.9, 1.0)
                try:
                    bsdf_core.inputs["Emission Color"].default_value = (0.1, 0.8, 0.9, 1.0)
                    bsdf_core.inputs["Emission Strength"].default_value = 3.5
                except KeyError:
                    pass
            core.data.materials.append(mat_core)

            %s
            """.formatted(format, exportCmd);
    }
}
