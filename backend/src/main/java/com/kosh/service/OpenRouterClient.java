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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * OpenRouter AI Client for zero-cost and cutting-edge open models.
 * Supports free models such as nvidia/nemotron-3.5-lightning:free,
 * liquid/lfm-2.5-2.6b:free, and multimodal vision models like
 * nvidia/nemotron-3.5-super-vl:free for hand-drawn sketch to 3D synthesis.
 */
@Slf4j
@Service
public class OpenRouterClient {

    private final WebClient.Builder webClientBuilder;
    private final ScriptSanitizer scriptSanitizer;
    private final ObjectMapper objectMapper;

    @Value("${openrouter.api.base-url:https://openrouter.ai/api/v1}")
    private String openRouterBaseUrl;

    @Value("${openrouter.model:liquid/lfm-2.5-2.6b:free}")
    private String primaryModel;

    @Value("${openrouter.vision-model:nvidia/nemotron-3.5-super-vl:free}")
    private String visionModel;

    @Value("${openrouter.api-key:}")
    private String configuredApiKey;

    private static final List<String> FREE_MODELS_CASCADE = List.of(
            "liquid/lfm-2.5-2.6b:free",
            "liquid/lfm-3-1.7b:free",
            "nvidia/nemotron-3.5-lightning:free",
            "google/gemma-4-26b-a4b-it:free",
            "google/gemma-4-31b-it:free",
            "cohere/north-mini-code:free"
    );

    public OpenRouterClient(WebClient.Builder webClientBuilder,
                            ScriptSanitizer scriptSanitizer,
                            ObjectMapper objectMapper) {
        this.webClientBuilder = webClientBuilder;
        this.scriptSanitizer = scriptSanitizer;
        this.objectMapper = objectMapper;
    }

    public String resolveApiKey(String explicitKey) {
        if (explicitKey != null && !explicitKey.isBlank()) {
            return explicitKey.trim().replaceFirst("(?i)^Bearer\\s+", "");
        }
        if (configuredApiKey != null && !configuredApiKey.isBlank()) {
            return configuredApiKey.trim();
        }
        String envKey = System.getenv("OPENROUTER_API_KEY");
        if (envKey != null && !envKey.isBlank()) {
            return envKey.trim();
        }
        return null;
    }

    public boolean isAvailable(String explicitKey) {
        return resolveApiKey(explicitKey) != null;
    }

    /**
     * Generates a watertight Blender 5.x Python script from a text prompt.
     */
    public String generateBlenderScript(String prompt, String previousScript, String toolType, String apiKey, String exportFormat) {
        String activeKey = resolveApiKey(apiKey);
        if (activeKey == null) {
            throw new IllegalArgumentException("OpenRouter API key is required.");
        }

        String systemPrompt = buildSystemPrompt(toolType, exportFormat);
        String userContent = prompt;
        if (previousScript != null && !previousScript.isBlank()) {
            userContent = """
                EXISTING SCENE PYTHON CODE:
                ```python
                %s
                ```
                
                USER MODIFICATION REQUEST:
                "%s"
                
                Generate the complete updated Blender Python script incorporating the requested modifications.
                """.formatted(previousScript.trim(), prompt.trim());
        }

        List<String> models = new ArrayList<>();
        if (primaryModel != null && !primaryModel.isBlank()) {
            models.add(primaryModel.trim());
        }
        for (String m : FREE_MODELS_CASCADE) {
            if (!models.contains(m)) {
                models.add(m);
            }
        }

        for (String model : models) {
            try {
                log.info("Querying OpenRouter model '{}' for prompt: '{}'", model, prompt);
                String script = callOpenRouterChat(systemPrompt, userContent, model, activeKey, 45);
                if (script != null && !script.isBlank()) {
                    return scriptSanitizer.sanitize(script);
                }
            } catch (Exception e) {
                log.warn("OpenRouter model '{}' failed: {}. Trying fallback...", model, e.getMessage());
            }
        }

        throw new RuntimeException("All OpenRouter models failed to respond with valid script.");
    }

    /**
     * Multimodal Vision Analysis: Analyzes an uploaded image or hand-drawn sketch
     * and produces a clean watertight Blender 3D reconstruction script.
     */
    public String analyzeSketchToScript(String imageBase64, String userPrompt, String toolType, String apiKey, String exportFormat) {
        String activeKey = resolveApiKey(apiKey);
        if (activeKey == null) {
            throw new IllegalArgumentException("OpenRouter API key is required for sketch analysis.");
        }

        String systemPrompt = """
            You are an expert technical CAD engineer and 3D computer vision artist.
            You are given a hand-drawn sketch or reference image of a 3D physical object or component.
            
            YOUR TASK:
            1. Analyze the silhouette, contour, depth, proportions, geometric primitives (cylinders, boxes, curves, bevels), and functional sub-parts shown in the drawing.
            2. Write a complete, self-contained, crash-proof Blender 5.x Python script using `bpy` and `mathutils` to construct a watertight 3D solid model matching the sketch.
            3. Apply distinct named sub-mesh objects, bevel modifiers for smooth highlights, and PBR Principled BSDF materials with appropriate metallic and roughness.
            4. Export clean manifold geometry (grounded at Z=0) to the output file specified in sys.argv.
            
            OUTPUT RULES:
            Return ONLY raw executable Python code. No markdown fences, no explanatory text.
            """;

        String textPrompt = (userPrompt != null && !userPrompt.isBlank())
                ? "Reconstruct this hand-drawn sketch as a 3D model with prompt details: " + userPrompt
                : "Reconstruct this hand-drawn sketch into an accurate, watertight 3D CAD model.";

        // Form multimodal data URL if not already formatted
        String dataUrl = imageBase64.startsWith("data:")
                ? imageBase64
                : "data:image/png;base64," + imageBase64;

        List<Map<String, Object>> contentParts = List.of(
                Map.of("type", "text", "text", textPrompt),
                Map.of("type", "image_url", "image_url", Map.of("url", dataUrl))
        );

        List<String> visionModelsToTry = List.of(
                visionModel != null && !visionModel.isBlank() ? visionModel : "nvidia/nemotron-3.5-super-vl:free",
                "google/gemma-4-31b-it:free",
                "nvidia/nemotron-3.5-lightning:free"
        );

        for (String model : visionModelsToTry) {
            try {
                log.info("Querying OpenRouter Vision model '{}' for sketch analysis...", model);
                String script = callOpenRouterMultimodal(systemPrompt, contentParts, model, activeKey, 60);
                if (script != null && !script.isBlank()) {
                    return scriptSanitizer.sanitize(script);
                }
            } catch (Exception e) {
                log.warn("OpenRouter vision model '{}' failed: {}. Cascading...", model, e.getMessage());
            }
        }

        throw new RuntimeException("All OpenRouter vision models failed to reconstruct sketch.");
    }

    /**
     * Multimodal vision analysis returning structured plain text (never a Blender
     * script): object description, geometry breakdown, proportion estimates, and a
     * recommended reconstruction mode for {@code cad_image_to_model}.
     */
    public String analyzeImageToText(String imageBase64, String userPrompt, String apiKey) {
        String activeKey = resolveApiKey(apiKey);
        if (activeKey == null) {
            throw new IllegalArgumentException("OpenRouter API key is required for image analysis.");
        }

        String systemPrompt = """
            You are a technical CAD vision analyst. You receive a photo or hand-drawn sketch of a 3D object.

            Respond with concise structured plain text covering:
            1. OBJECT: one-sentence identification of what is shown.
            2. GEOMETRY: decompose into primitive solids (boxes, cylinders, spheres, cones, extrusions, fillets).
            3. PROPORTIONS: relative dimensions (e.g. 2:1.4:0.6) and suggested real-world size if inferable.
            4. FEATURES: holes, threads, bevels, seams, surface finishes, moving parts.
            5. MODE: recommend one reconstruction mode — vision_ai (detailed sketch with depth cues),
               base_match (looks like a real-world product that exists online), or
               contour_extrusion (flat silhouette / badge / logo shape).
            6. RISKS: ambiguity, occlusion, or missing views that will affect reconstruction.

            Keep it under 200 words. No code, no markdown fences.
            """;

        String textPrompt = (userPrompt != null && !userPrompt.isBlank())
                ? "Additional context from the user: " + userPrompt
                : "Analyze this image for 3D reconstruction.";

        String dataUrl = imageBase64.startsWith("data:")
                ? imageBase64
                : "data:image/png;base64," + imageBase64;

        List<Map<String, Object>> contentParts = List.of(
                Map.of("type", "text", "text", textPrompt),
                Map.of("type", "image_url", "image_url", Map.of("url", dataUrl))
        );

        List<String> visionModelsToTry = List.of(
                visionModel != null && !visionModel.isBlank() ? visionModel : "nvidia/nemotron-3.5-super-vl:free",
                "google/gemma-4-31b-it:free",
                "nvidia/nemotron-3.5-lightning:free"
        );

        for (String model : visionModelsToTry) {
            try {
                log.info("Querying OpenRouter vision model '{}' for image analysis...", model);
                String analysis = callOpenRouterMultimodal(systemPrompt, contentParts, model, activeKey, 60);
                if (analysis != null && !analysis.isBlank()) {
                    return analysis;
                }
            } catch (Exception e) {
                log.warn("OpenRouter vision model '{}' analysis failed: {}. Cascading...", model, e.getMessage());
            }
        }

        throw new RuntimeException("All OpenRouter vision models failed to analyze the image.");
    }

    private String callOpenRouterChat(String systemPrompt, String userPrompt, String model, String apiKey, int timeoutSec) {
        WebClient webClient = webClientBuilder
                .baseUrl(openRouterBaseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .defaultHeader("HTTP-Referer", "https://kosh.dev")
                .defaultHeader("X-Title", "Kosh 3D CAD Creative Hub")
                .build();

        Map<String, Object> requestBody = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userPrompt)
                ),
                "temperature", 0.2
        );

        String responseBody = webClient.post()
                .uri("/chat/completions")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(timeoutSec))
                .block();

        return extractContentFromResponse(responseBody);
    }

    private String callOpenRouterMultimodal(String systemPrompt, List<Map<String, Object>> contentParts, String model, String apiKey, int timeoutSec) {
        WebClient webClient = webClientBuilder
                .baseUrl(openRouterBaseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .defaultHeader("HTTP-Referer", "https://kosh.dev")
                .defaultHeader("X-Title", "Kosh 3D CAD Creative Hub")
                .build();

        Map<String, Object> requestBody = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", contentParts)
                ),
                "temperature", 0.2
        );

        String responseBody = webClient.post()
                .uri("/chat/completions")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(timeoutSec))
                .block();

        return extractContentFromResponse(responseBody);
    }

    private String extractContentFromResponse(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode choices = root.path("choices");
            if (choices.isArray() && !choices.isEmpty()) {
                JsonNode message = choices.get(0).path("message");
                String content = message.path("content").asText();
                if (content != null && !content.isBlank()) {
                    return content;
                }
            }
            if (root.has("error")) {
                log.error("OpenRouter returned error payload: {}", root.path("error").toString());
            }
        } catch (Exception e) {
            log.error("Failed to parse OpenRouter response: {}", e.getMessage());
        }
        return null;
    }

    private String buildSystemPrompt(String toolType, String exportFormat) {
        String format = (exportFormat != null && exportFormat.equalsIgnoreCase("stl")) ? "stl" : "glb";
        return """
            You are a senior technical 3D artist and CAD engineer creating production-grade Blender Python (bpy) scripts for headless execution in Blender 5.2 LTS.
            
            ENGINEERING GUIDELINES:
            1. Clear existing scenes:
               import bpy, sys, math, os, json, mathutils
               bpy.ops.wm.read_factory_settings(use_empty=True)
            2. Compute precise coordinates and alignments with mathutils.Vector and mathutils.Euler.
            3. Build distinct named sub-mesh components with dedicated PBR Principled BSDF materials.
            4. Ensure all solid geometry is watertight with manifold topology and clean face normals.
            5. Export cleanly at end:
               argv = sys.argv
               output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"
               if output_path.endswith('.stl'):
                   bpy.ops.wm.stl_export(filepath=output_path)
               else:
                   bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')
            
            OUTPUT CONSTRAINT:
            Generate ONLY raw executable Python code. No markdown fences (no ```python), no commentary, no preamble.
            """.formatted(format);
    }
}
