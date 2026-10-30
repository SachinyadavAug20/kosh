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
    private final BharatCodeClient fallbackDemoClient;

    @Value("${google.gemini.api.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String geminiBaseUrl;

    @Value("${google.gemini.model:gemini-2.5-flash}")
    private String primaryModel;

    @Value("${google.gemini.fallback-model:gemini-1.5-flash}")
    private String fallbackModel;

    public GoogleGeminiClient(WebClient.Builder webClientBuilder,
                              ScriptSanitizer scriptSanitizer,
                              ObjectMapper objectMapper,
                              BharatCodeClient fallbackDemoClient) {
        this.webClientBuilder = webClientBuilder;
        this.scriptSanitizer = scriptSanitizer;
        this.objectMapper = objectMapper;
        this.fallbackDemoClient = fallbackDemoClient;
    }

    /**
     * Calls Google Gemini API to generate a headless Blender Python script using a user-provided Google API key.
     *
     * @param prompt User prompt describing the 3D mesh or CAD model
     * @param toolType Tool identifier ("blender_mesh" or "cad_model")
     * @param apiKey User's Google API Key (e.g. AIzaSy...)
     * @param exportFormat Target export format ("glb" or "stl")
     * @return Clean Python script
     */
    public String generateBlenderScript(String prompt, String toolType, String apiKey, String exportFormat) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalArgumentException("Google API key is required. Pass via X-Google-Key or Authorization header.");
        }

        String trimmedKey = apiKey.trim().replaceFirst("(?i)^Bearer\\s+", "");

        // Demo / offline bypass
        if ("demo".equalsIgnoreCase(trimmedKey) || "mock".equalsIgnoreCase(trimmedKey) || "offline".equalsIgnoreCase(trimmedKey)) {
            log.info("Generating procedural fallback script in demo mode for prompt: {}", prompt);
            return fallbackDemoClient.generateDemoScript(prompt, toolType, exportFormat);
        }

        String systemPrompt = buildSystemPrompt(toolType, exportFormat);

        // Try primary model first, fallback if unavailable
        try {
            return callGeminiGenerateContent(prompt, systemPrompt, primaryModel, trimmedKey);
        } catch (WebClientResponseException e) {
            if (e.getStatusCode().value() == 404 && !primaryModel.equals(fallbackModel)) {
                log.warn("Model {} returned 404, retrying with fallback model: {}", primaryModel, fallbackModel);
                return callGeminiGenerateContent(prompt, systemPrompt, fallbackModel, trimmedKey);
            }
            throw e;
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
                    .timeout(Duration.ofSeconds(30))
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
}
