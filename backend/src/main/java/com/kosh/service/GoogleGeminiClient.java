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

    public GoogleGeminiClient(WebClient.Builder webClientBuilder,
                              ScriptSanitizer scriptSanitizer,
                              ObjectMapper objectMapper) {
        this.webClientBuilder = webClientBuilder;
        this.scriptSanitizer = scriptSanitizer;
        this.objectMapper = objectMapper;
    }

    /**
     * Calls Google Gemini API to generate a headless Blender Python script using a Google API key.
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

        // Demo / offline bypass
        if ("demo".equalsIgnoreCase(trimmedKey) || "mock".equalsIgnoreCase(trimmedKey) || "offline".equalsIgnoreCase(trimmedKey)) {
            log.info("Generating procedural fallback script in demo mode for prompt: {}", prompt);
            return generateDemoScript(prompt, toolType, exportFormat);
        }

        String systemPrompt = buildSystemPrompt(toolType, exportFormat);

        // Try primary model first (gemini-2.5-flash), fallback if unavailable
        try {
            return callGeminiGenerateContent(prompt, systemPrompt, primaryModel, trimmedKey);
        } catch (Exception e) {
            if (!primaryModel.equals(fallbackModel)) {
                log.warn("Model {} failed ({}), retrying with fallback model: {}", primaryModel, e.getMessage(), fallbackModel);
                try {
                    return callGeminiGenerateContent(prompt, systemPrompt, fallbackModel, trimmedKey);
                } catch (Exception fallbackErr) {
                    log.error("Fallback model {} also failed: {}", fallbackModel, fallbackErr.getMessage());
                }
            }
            if (e instanceof RuntimeException re) {
                throw re;
            }
            throw new RuntimeException(e);
        }
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

        try {
            log.info("Calling Google Gemini endpoint with model: {}", model);
            String responseBody = webClient.post()
                    .uri(uri)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(35))
                    .block();

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
        } catch (WebClientResponseException e) {
            log.error("Google Gemini API error: HTTP {} - {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Google Gemini API error (" + e.getStatusCode() + "): " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            log.error("Failed to generate script via Google Gemini: {}", e.getMessage());
            throw new RuntimeException("Google Gemini generation failed: " + e.getMessage(), e);
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
            4. Add smooth shading, materials with metallic/roughness and base color if appropriate.
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

    /**
     * Deterministic procedural fallback script generator for offline / demo mode.
     */
    public String generateDemoScript(String prompt, String toolType, String exportFormat) {
        String format = (exportFormat != null && exportFormat.equalsIgnoreCase("stl")) ? "stl" : "glb";
        String exportCmd = getExportStatement(format);

        if ("cad_model".equalsIgnoreCase(toolType)) {
            return """
                import bpy
                import sys
                import math

                # Clear scene
                bpy.ops.object.select_all(action='SELECT')
                bpy.ops.object.delete(use_global=False)

                argv = sys.argv
                output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

                # Create CAD base cylinder (Flange)
                bpy.ops.mesh.primitive_cylinder_add(radius=2.0, depth=0.4, location=(0, 0, 0.2))
                base = bpy.context.active_object
                base.name = "Flange_Base"

                # Central shaft
                bpy.ops.mesh.primitive_cylinder_add(radius=0.9, depth=2.5, location=(0, 0, 1.45))
                shaft = bpy.context.active_object
                shaft.name = "Center_Shaft"

                # Union shaft to base
                bool_union = base.modifiers.new(name="UnionShaft", type='BOOLEAN')
                bool_union.operation = 'UNION'
                bool_union.object = shaft
                bpy.context.view_layer.objects.active = base
                bpy.ops.object.modifier_apply(modifier="UnionShaft")
                bpy.data.objects.remove(shaft, do_unlink=True)

                # Bore hole through center
                bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=4.0, location=(0, 0, 1.5))
                hole = bpy.context.active_object
                bool_hole = base.modifiers.new(name="BoreHole", type='BOOLEAN')
                bool_hole.operation = 'DIFFERENCE'
                bool_hole.object = hole
                bpy.context.view_layer.objects.active = base
                bpy.ops.object.modifier_apply(modifier="BoreHole")
                bpy.data.objects.remove(hole, do_unlink=True)

                # Bolt circle holes
                bolt_count = 6
                bolt_radius = 1.5
                for i in range(bolt_count):
                    angle = (2 * math.pi / bolt_count) * i
                    bx = bolt_radius * math.cos(angle)
                    by = bolt_radius * math.sin(angle)
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=1.0, location=(bx, by, 0.2))
                    bolt = bpy.context.active_object
                    mod = base.modifiers.new(name=f"BoltHole_{i}", type='BOOLEAN')
                    mod.operation = 'DIFFERENCE'
                    mod.object = bolt
                    bpy.context.view_layer.objects.active = base
                    bpy.ops.object.modifier_apply(modifier=f"BoltHole_{i}")
                    bpy.data.objects.remove(bolt, do_unlink=True)

                # Material
                mat = bpy.data.materials.new(name="CAD_Steel")
                mat.use_nodes = True
                nodes = mat.node_tree.nodes
                bsdf = nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (0.2, 0.25, 0.3, 1.0)
                    bsdf.inputs["Metallic"].default_value = 0.95
                    bsdf.inputs["Roughness"].default_value = 0.2
                base.data.materials.append(mat)

                # Export
                %s
                """.formatted(format, exportCmd);
        }

        return """
            import bpy
            import sys
            import math

            # Clear scene
            bpy.ops.object.select_all(action='SELECT')
            bpy.ops.object.delete(use_global=False)

            argv = sys.argv
            output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

            # Create main cube
            bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 1.0))
            box = bpy.context.active_object
            box.name = "SciFi_Container"

            # Bevel modifier
            bevel = box.modifiers.new(name="Bevel", type='BEVEL')
            bevel.width = 0.08
            bevel.segments = 3

            # Subdivisions
            sub = box.modifiers.new(name="Subsurf", type='SUBSURF')
            sub.levels = 1

            # Top accent gem
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.45, location=(0, 0, 2.35))
            core = bpy.context.active_object
            core.name = "Energy_Core"

            # Materials
            mat_box = bpy.data.materials.new(name="Obsidian_Metal")
            mat_box.use_nodes = True
            bsdf_box = mat_box.node_tree.nodes.get("Principled BSDF")
            if bsdf_box:
                bsdf_box.inputs["Base Color"].default_value = (0.05, 0.06, 0.08, 1.0)
                bsdf_box.inputs["Metallic"].default_value = 0.8
                bsdf_box.inputs["Roughness"].default_value = 0.35
            box.data.materials.append(mat_box)

            mat_core = bpy.data.materials.new(name="Phosphor_Emission")
            mat_core.use_nodes = True
            bsdf_core = mat_core.node_tree.nodes.get("Principled BSDF")
            if bsdf_core:
                bsdf_core.inputs["Base Color"].default_value = (0.1, 0.9, 0.4, 1.0)
                try:
                    bsdf_core.inputs["Emission Color"].default_value = (0.1, 0.9, 0.4, 1.0)
                    bsdf_core.inputs["Emission Strength"].default_value = 4.0
                except KeyError:
                    pass
            core.data.materials.append(mat_core)

            # Export
            %s
            """.formatted(format, exportCmd);
    }
}
