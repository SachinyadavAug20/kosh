package com.kosh;

import com.kosh.service.AiAgentService;
import com.kosh.service.ImageToModelService;
import com.kosh.service.OnlineModelService;
import com.kosh.service.OpenRouterClient;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

@SpringBootTest
class AiAgentToolExecutionTest {

    @Autowired
    private OnlineModelService onlineModelService;

    @Autowired
    private ImageToModelService imageToModelService;

    @Autowired
    private AiAgentService aiAgentService;

    @Autowired
    private OpenRouterClient openRouterClient;

    @Test
    @DisplayName("Online Model Catalog: Search internet base 3D models")
    void testOnlineModelCatalogSearch() {
        // 1. Search for helmets
        List<OnlineModelService.OnlineModelEntry> helmets = onlineModelService.search("helmet");
        assertNotNull(helmets);
        assertFalse(helmets.isEmpty(), "Expected to find online helmet models");
        assertTrue(helmets.stream().anyMatch(h -> h.getId().contains("helmet")),
                "Expected helmet model in search results");

        // 2. Search for vehicles
        List<OnlineModelService.OnlineModelEntry> vehicles = onlineModelService.search("car");
        assertNotNull(vehicles);
        assertFalse(vehicles.isEmpty(), "Expected to find vehicle models for 'car'");

        // 3. Search for animals
        List<OnlineModelService.OnlineModelEntry> ducks = onlineModelService.search("duck");
        assertNotNull(ducks);
        assertEquals("base_duck", ducks.get(0).getId());
    }

    @Test
    @DisplayName("Online Model Download: Caches real 3D model from internet")
    void testOnlineModelDownloadAndCache() {
        Path downloaded = onlineModelService.downloadModel("base_duck");
        assertNotNull(downloaded);
        assertTrue(Files.exists(downloaded), "Downloaded GLB model must exist in local cache");
        assertTrue(downloaded.toFile().length() > 500, "GLB model file size must be non-empty");

        // Verify adaptation script generation
        String script = onlineModelService.buildAdaptationScript(downloaded, "Make it gold with bevels", "glb");
        assertNotNull(script);
        assertTrue(script.contains("import bpy"));
        assertTrue(script.contains("bpy.ops.import_scene.gltf"));
        assertTrue(script.contains("export_scene.gltf"));
    }

    @Test
    @DisplayName("Hand-Drawn Sketch Extrusion: Translates 2D drawing to watertight 3D solid")
    void testHandDrawnContourExtrusion() {
        // Create 64x64 dummy base64 PNG representing a circular sketch
        byte[] dummyPng = createDummyPngBytes();
        String base64Image = Base64.getEncoder().encodeToString(dummyPng);

        String script = imageToModelService.buildContourExtrusionScript(base64Image, "A blue aerodynamic spoiler", "glb");
        assertNotNull(script);
        assertTrue(script.contains("import bmesh"));
        assertTrue(script.contains("contour_pts = ["));
        assertTrue(script.contains("extrude_face_region"));
        assertTrue(script.contains("SmoothBevel"));
        assertTrue(script.contains("Electric_Blue"));
        assertFalse(script.contains("Workstation_Module"), "Must not drop to generic workstation box");
    }

    @Test
    @DisplayName("AI Agent Multi-Tool Pipeline: Coordinates autonomous 3D generation")
    void testAiAgentAutonomousPipeline() {
        List<AiAgentService.AgentToolDefinition> tools = aiAgentService.listAgentTools();
        assertNotNull(tools);
        assertTrue(tools.size() >= 8, "Agent must expose at least 8 specialized CAD tools");

        // Execute agent task
        Map<String, Object> result = aiAgentService.executeAgentTask(
                "Create a red futuristic helmet based on online model with smooth bevels",
                null,
                "base_scifi_helmet",
                "glb",
                null
        );

        assertNotNull(result);
        assertTrue((Boolean) result.get("success"), "Agent execution must succeed");
        assertNotNull(result.get("assetUrl"));

        @SuppressWarnings("unchecked")
        List<AiAgentService.ToolInvocationStep> trail =
                (List<AiAgentService.ToolInvocationStep>) result.get("executionTrail");
        assertNotNull(trail);
        assertFalse(trail.isEmpty(), "Agent must record execution trail of tools used");

        List<String> toolNames = trail.stream().map(AiAgentService.ToolInvocationStep::getToolName).toList();
        assertTrue(toolNames.contains("search_online_model"));
        assertTrue(toolNames.contains("download_base_model"));
        assertTrue(toolNames.contains("apply_pbr_material"));
        assertTrue(toolNames.contains("fillet_chamfer_edges"));
        assertTrue(toolNames.contains("export_cad_scene"));
    }

    @Test
    @DisplayName("OpenRouter Free Model: Real AI model generation test")
    void testOpenRouterFreeModelGeneration() {
        String key = openRouterClient.resolveApiKey(null);
        assumeTrue(key != null && !key.isBlank(), "OpenRouter API key is required for live AI test");

        // Test with OpenRouter free model
        String script = openRouterClient.generateBlenderScript(
                "A minimalist coffee mug with cylindrical body, hollow center, and curved loop handle",
                null,
                "cad_model",
                key,
                "glb"
        );

        assertNotNull(script, "OpenRouter must generate a valid script");
        assertTrue(script.contains("import bpy"), "Generated script must import bpy");
        assertTrue(script.contains("export_format='GLB'") || script.contains("gltf"), "Script must export GLB");
    }

    private byte[] createDummyPngBytes() {
        // Minimal 1x1 transparent PNG binary bytes
        return new byte[]{
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
                0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, (byte) 0xC4,
                (byte) 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
                0x54, 0x78, (byte) 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
                0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, (byte) 0xB4, 0x00,
                0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, (byte) 0xAE,
                0x42, 0x60, (byte) 0x82
        };
    }
}
