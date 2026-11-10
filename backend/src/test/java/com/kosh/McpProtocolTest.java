package com.kosh;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kosh.controller.McpController;
import com.kosh.dto.McpRpcRequest;
import com.kosh.dto.McpRpcResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

@SpringBootTest
class McpProtocolTest {

    @Autowired
    private McpController mcpController;

    @Autowired
    private com.kosh.service.BlenderExecutionService blenderExecutionService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("MCP initialize should return protocol version and capabilities")
    void testInitialize() {
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id(1)
                .method("initialize")
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());

        McpRpcResponse body = response.getBody();
        assertNotNull(body);
        assertEquals("2.0", body.getJsonrpc());
        assertEquals(1, body.getId());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        assertNotNull(result);
        assertEquals("2024-11-05", result.get("protocolVersion"));

        @SuppressWarnings("unchecked")
        Map<String, Object> caps = (Map<String, Object>) result.get("capabilities");
        assertNotNull(caps);
        assertTrue(caps.containsKey("tools"));
        assertTrue(caps.containsKey("resources"));
        assertTrue(caps.containsKey("prompts"));

        @SuppressWarnings("unchecked")
        Map<String, Object> serverInfo = (Map<String, Object>) result.get("serverInfo");
        assertEquals("kosh-creative-hub", serverInfo.get("name"));
    }

    @Test
    @DisplayName("MCP tools/list should expose modular CAD tools suite")
    void testListTools() {
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("tools-1")
                .method("tools/list")
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> tools = (List<Map<String, Object>>) result.get("tools");
        assertNotNull(tools);
        assertTrue(tools.size() >= 5);

        List<String> toolNames = tools.stream().map(t -> t.get("name").toString()).toList();
        assertTrue(toolNames.contains("cad_create_primitive"));
        assertTrue(toolNames.contains("cad_boolean_operation"));
        assertTrue(toolNames.contains("cad_apply_modifier"));
        assertTrue(toolNames.contains("cad_inspect_scene"));
        assertTrue(toolNames.contains("cad_synthesize_composite"));
        assertTrue(toolNames.contains("cad_assemble_kit"));
        assertTrue(toolNames.contains("cad_batch_csg"));
        assertTrue(toolNames.contains("cad_apply_fillet_chamfer"));
        assertTrue(toolNames.contains("cad_compose_compound_scene"));
        assertTrue(toolNames.contains("cad_render_frame"));
        assertTrue(toolNames.contains("cad_measure_dimensions"));
        assertTrue(toolNames.contains("cad_hollow_shell"));
        assertTrue(toolNames.contains("cad_generate_threads"));
        assertTrue(toolNames.contains("cad_apply_pbr_preset"));
        assertTrue(toolNames.contains("cad_studio_lighting_preset"));
        assertTrue(toolNames.contains("cad_batch_multiview_render"));
        assertTrue(toolNames.contains("cad_lattice_infill"));
        assertTrue(toolNames.contains("kosh_system_health"));
        assertTrue(toolNames.contains("cad_convex_hull"));
        assertTrue(toolNames.contains("cad_separate_loose_parts"));
        assertTrue(toolNames.contains("cad_project_curve_cut"));
        assertTrue(toolNames.contains("cad_generate_gear"));
        assertTrue(toolNames.contains("cad_uv_unwrap_auto"));
        assertTrue(toolNames.contains("cad_wireframe_cage"));
        assertTrue(toolNames.contains("cad_point_cloud_surface"));
        assertTrue(toolNames.contains("cad_export_engineering_drawing"));
        assertTrue(toolNames.contains("cad_assemble_puzzle_pieces"));
    }

    @Test
    @DisplayName("MCP tools/list should expose exactly the SUPPORTED_TOOLS set (no drift between registry and protocol)")
    void testListToolsMatchesSupportedSetExactly() {
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("tools-set-1")
                .method("tools/list")
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> tools = (List<Map<String, Object>>) result.get("tools");
        assertNotNull(tools);

        List<String> toolNames = tools.stream().map(t -> t.get("name").toString()).toList();

        // tools/list must be unique
        assertEquals(toolNames.size(), toolNames.stream().distinct().count(), "tools/list contains duplicate tool names");

        // Set equality: every supported tool is listed, and nothing extra is listed
        for (String supported : com.kosh.service.McpToolRegistry.SUPPORTED_TOOLS) {
            assertTrue(toolNames.contains(supported),
                    "SUPPORTED_TOOLS entry missing from tools/list: " + supported);
        }
        for (String listed : toolNames) {
            assertTrue(com.kosh.service.McpToolRegistry.SUPPORTED_TOOLS.contains(listed),
                    "tools/list entry missing from SUPPORTED_TOOLS: " + listed);
        }
        assertEquals(com.kosh.service.McpToolRegistry.SUPPORTED_TOOLS.size(), toolNames.size());

        // Newly added external-agent tooling must be present
        assertTrue(toolNames.contains("cad_linear_array"));
        assertTrue(toolNames.contains("cad_radial_array"));
        assertTrue(toolNames.contains("cad_text_emboss"));
        assertTrue(toolNames.contains("cad_check_manifold"));
    }

    @Test
    @DisplayName("MCP resources/read metric-fasteners should return cached M3 clearance data (3.4mm / 2.5mm)")
    void testReadMetricFastenerClearanceResource() throws Exception {
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("read-fasteners-m3")
                .method("resources/read")
                .params(Map.of("uri", "kosh://specs/hardware/metric-fasteners"))
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);
        assertNull(body.getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contents = (List<Map<String, Object>>) result.get("contents");
        assertFalse(contents.isEmpty());

        Map<?, ?> payload = objectMapper.readValue(contents.get(0).get("text").toString(), Map.class);
        assertTrue(payload.containsKey("sizes"));
        @SuppressWarnings("unchecked")
        Map<String, Object> sizes = (Map<String, Object>) payload.get("sizes");
        @SuppressWarnings("unchecked")
        Map<String, Object> m3 = (Map<String, Object>) sizes.get("M3");
        assertNotNull(m3, "M3 fastener sizing must be present");
        assertEquals(3.4, ((Number) m3.get("clearanceHoleDiaMm")).doubleValue(),
                "M3 close-fit clearance hole must be 3.4mm");
        assertEquals(2.5, ((Number) m3.get("tapDrillDiaMm")).doubleValue(),
                "M3 tap drill must be 2.5mm");
        assertEquals(5.5, ((Number) m3.get("headDiaMm")).doubleValue(),
                "M3 socket cap head diameter must be 5.5mm");
        assertEquals(3.0, ((Number) m3.get("headHeightMm")).doubleValue(),
                "M3 socket cap head height must be 3.0mm");
    }

    @Test
    @DisplayName("MCP resources/list should list scene hierarchy, capabilities, and materials")
    void testListResources() {
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("res-list-1")
                .method("resources/list")
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> resources = (List<Map<String, Object>>) result.get("resources");
        assertNotNull(resources);

        List<String> uris = resources.stream().map(r -> r.get("uri").toString()).toList();
        assertTrue(uris.contains("kosh://scene/hierarchy"));
        assertTrue(uris.contains("kosh://engine/capabilities"));
        assertTrue(uris.contains("kosh://materials/catalog"));
        assertTrue(uris.contains("kosh://specs/hardware/metric-fasteners"));
        assertTrue(uris.contains("kosh://materials/pbr-presets"));
        assertTrue(uris.contains("kosh://guidelines/fdm-tolerances"));
        assertTrue(uris.contains("kosh://library/modular-models"));
        assertTrue(uris.contains("kosh://specs/engineering/stepper-motors"));
        assertTrue(uris.contains("kosh://specs/standards/iso-bearings"));
        assertTrue(uris.contains("kosh://guidelines/sla-resin-tolerances"));
        assertTrue(uris.contains("kosh://materials/physical-constants"));
        assertTrue(uris.contains("kosh://standards/gdt-symbols"));
        assertTrue(uris.contains("kosh://specs/optics/studio-hdri-lighting"));
        assertTrue(uris.contains("kosh://presets/game-engine-lod"));
        assertTrue(uris.contains("kosh://specs/aerospace/unmanned-airframe"));
        assertTrue(uris.contains("kosh://library/puzzle-pieces"));
        assertTrue(uris.contains("kosh://library/saved-models"));
        assertTrue(uris.contains("kosh://specs/hardware/heat-set-inserts"));
        assertTrue(uris.contains("kosh://materials/filaments"));
        assertTrue(uris.contains("kosh://specs/printers/build-volumes"));
        assertTrue(uris.contains("kosh://standards/iso-2768-tolerances"));
        assertEquals(24, resources.size());
    }

    @Test
    @DisplayName("MCP resources/read should return valid JSON for engine capabilities and material catalog")
    void testReadResources() throws Exception {
        // Read kosh://engine/capabilities
        McpRpcRequest reqCap = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("read-cap")
                .method("resources/read")
                .params(Map.of("uri", "kosh://engine/capabilities"))
                .build();

        ResponseEntity<McpRpcResponse> respCap = mcpController.handleRpcRequest(null, reqCap, null, null, null, null, null);
        assertNotNull(respCap.getBody());
        @SuppressWarnings("unchecked")
        Map<String, Object> resCap = (Map<String, Object>) respCap.getBody().getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contentsCap = (List<Map<String, Object>>) resCap.get("contents");
        assertFalse(contentsCap.isEmpty());
        String textCap = contentsCap.get(0).get("text").toString();
        Map<?, ?> capMap = objectMapper.readValue(textCap, Map.class);
        assertTrue(capMap.containsKey("engine"));
        assertTrue(capMap.containsKey("pythonPackages"));

        // Read kosh://materials/catalog
        McpRpcRequest reqMat = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("read-mat")
                .method("resources/read")
                .params(Map.of("uri", "kosh://materials/catalog"))
                .build();

        ResponseEntity<McpRpcResponse> respMat = mcpController.handleRpcRequest(null, reqMat, null, null, null, null, null);
        assertNotNull(respMat.getBody());
        @SuppressWarnings("unchecked")
        Map<String, Object> resMat = (Map<String, Object>) respMat.getBody().getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contentsMat = (List<Map<String, Object>>) resMat.get("contents");
        assertFalse(contentsMat.isEmpty());
        String textMat = contentsMat.get(0).get("text").toString();
        Map<?, ?> matMap = objectMapper.readValue(textMat, Map.class);
        assertTrue(matMap.containsKey("catalog"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> catalog = (List<Map<String, Object>>) matMap.get("catalog");
        List<String> matNames = catalog.stream().map(m -> m.get("name").toString()).toList();
        assertTrue(matNames.contains("MatteTitanium"));
        assertTrue(matNames.contains("ClearGlass"));
        assertTrue(matNames.contains("CastIron"));
        assertTrue(matNames.contains("NeonBlueEmissive"));
    }

    @Test
    @DisplayName("MCP prompts/list should expose standardized CAD blueprints")
    void testListPrompts() {
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("prompt-list-1")
                .method("prompts/list")
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> prompts = (List<Map<String, Object>>) result.get("prompts");
        assertNotNull(prompts);

        List<String> promptNames = prompts.stream().map(p -> p.get("name").toString()).toList();
        assertTrue(promptNames.contains("harden_mechanical_part"));
        assertTrue(promptNames.contains("decompose_narrative_object"));
        assertTrue(promptNames.contains("scaffold_parametric_enclosure"));
        assertTrue(promptNames.contains("optimize_manifold_topology"));
        assertTrue(promptNames.contains("lowpoly_stylized_environment"));
        assertTrue(promptNames.contains("design_spur_gear_train"));
        assertTrue(promptNames.contains("photorealistic_product_hero_shot"));
        assertTrue(promptNames.contains("generative_drone_frame"));
        assertTrue(promptNames.contains("procedural_architectural_pavilion"));
        assertTrue(promptNames.contains("reverse_engineering_blueprint_to_3d"));
        assertTrue(promptNames.contains("sculpt_creature_bust"));
        assertTrue(promptNames.contains("generate_3d_printable_snapfit"));
        assertTrue(promptNames.contains("assemble_modular_puzzle_recipe"));
        assertTrue(promptNames.contains("optimize_model_for_3d_printing"));
        assertTrue(promptNames.contains("design_heat_set_insert_mount"));
        assertTrue(promptNames.contains("plan_linear_motion_stage"));
        assertEquals(16, prompts.size());
    }

    @Test
    @DisplayName("MCP prompts/get should generate mechanical hardening and CSG decomposition instructions")
    void testGetPrompt() {
        // Test harden_mechanical_part
        McpRpcRequest reqHarden = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("prompt-get-1")
                .method("prompts/get")
                .params(Map.of("name", "harden_mechanical_part", "arguments", Map.of("mesh_name", "Coupling_Flange", "tolerance_mm", "0.5")))
                .build();

        ResponseEntity<McpRpcResponse> respHarden = mcpController.handleRpcRequest(null, reqHarden, null, null, null, null, null);
        assertNotNull(respHarden.getBody());
        @SuppressWarnings("unchecked")
        Map<String, Object> resultHarden = (Map<String, Object>) respHarden.getBody().getResult();
        assertNotNull(resultHarden);
        assertTrue(resultHarden.containsKey("messages"));

        // Test decompose_narrative_object
        McpRpcRequest reqDecomp = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("prompt-get-2")
                .method("prompts/get")
                .params(Map.of("name", "decompose_narrative_object", "arguments", Map.of("concept_description", "Drone Arm Bracket")))
                .build();

        ResponseEntity<McpRpcResponse> respDecomp = mcpController.handleRpcRequest(null, reqDecomp, null, null, null, null, null);
        assertNotNull(respDecomp.getBody());
        @SuppressWarnings("unchecked")
        Map<String, Object> resultDecomp = (Map<String, Object>) respDecomp.getBody().getResult();
        assertNotNull(resultDecomp);
        assertTrue(resultDecomp.containsKey("messages"));
    }

    @Test
    @DisplayName("cad_inspect_scene tool should return structured JSON summary without running exports")
    void testInspectSceneTool() {
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("inspect-1")
                .method("tools/call")
                .params(Map.of("name", "cad_inspect_scene", "arguments", Map.of()))
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);
        assertNull(body.getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        assertNotNull(result);
        assertEquals(false, result.get("isError"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) result.get("content");
        assertNotNull(content);
        assertFalse(content.isEmpty());
        String text = content.get(0).get("text").toString();
        assertTrue(text.contains("meshCount"));
        assertTrue(text.contains("totalVertices"));
        assertTrue(text.contains("isWatertight"));
    }

    @Test
    @DisplayName("MCP SSE connection should establish emitter and send endpoint event")
    void testSseConnection() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        SseEmitter emitter = mcpController.handleSseConnection(request);
        assertNotNull(emitter);
    }
 

    @Test
    @DisplayName("cad_create_primitive should generate a 3D model with progress token tracking")
    void testCreatePrimitiveToolWithProgressToken() {
        assumeTrue(blenderExecutionService.isBlenderAvailable(), "Blender runtime is not available; skipping live render test");
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("call-prim-1")
                .method("tools/call")
                .params(Map.of(
                        "name", "cad_create_primitive",
                        "_meta", Map.of("progressToken", "pt-123"),
                        "arguments", Map.of(
                                "type", "cylinder",
                                "name", "Hydraulic_Piston",
                                "dimensions", List.of(0.4, 1.8),
                                "location", List.of(0.0, 0.0, 0.9),
                                "format", "glb"
                        )
                ))
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);
        assertNull(body.getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        assertNotNull(result);
        assertEquals(false, result.get("isError"));

        @SuppressWarnings("unchecked")
        Map<String, Object> meta = (Map<String, Object>) result.get("_meta");
        assertNotNull(meta);
        assertEquals("pt-123", meta.get("progressToken"));
        assertEquals(1.0, ((Number) meta.get("progress")).doubleValue());

        com.kosh.dto.ToolExecutionDto.Result execution = (com.kosh.dto.ToolExecutionDto.Result) result.get("execution");
        assertNotNull(execution);
        assertTrue(execution.isSuccess());
        assertNotNull(execution.getAssetName());
    }

    @Test
    @DisplayName("Engineering spec resources should serve cached ground truth (fasteners, PBR, FDM)")
    void testReadEngineeringSpecResources() throws Exception {
        // Metric fasteners: M3 close-fit clearance hole must be 3.4mm
        McpRpcRequest reqFasteners = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("read-fasteners")
                .method("resources/read")
                .params(Map.of("uri", "kosh://specs/hardware/metric-fasteners"))
                .build();
        ResponseEntity<McpRpcResponse> respFasteners = mcpController.handleRpcRequest(null, reqFasteners, null, null, null, null, null);
        assertNotNull(respFasteners.getBody());
        assertNull(respFasteners.getBody().getError());
        @SuppressWarnings("unchecked")
        Map<String, Object> resFasteners = (Map<String, Object>) respFasteners.getBody().getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contentsFasteners = (List<Map<String, Object>>) resFasteners.get("contents");
        Map<?, ?> fastenersMap = objectMapper.readValue(contentsFasteners.get(0).get("text").toString(), Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> sizes = (Map<String, Object>) fastenersMap.get("sizes");
        @SuppressWarnings("unchecked")
        Map<String, Object> m3 = (Map<String, Object>) sizes.get("M3");
        assertEquals(3.4, ((Number) m3.get("clearanceHoleDiaMm")).doubleValue());
        assertEquals(2.5, ((Number) m3.get("tapDrillDiaMm")).doubleValue());

        // Curated PBR presets must include AnodizedDarkTitanium
        McpRpcRequest reqPbr = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("read-pbr")
                .method("resources/read")
                .params(Map.of("uri", "kosh://materials/pbr-presets"))
                .build();
        ResponseEntity<McpRpcResponse> respPbr = mcpController.handleRpcRequest(null, reqPbr, null, null, null, null, null);
        assertNotNull(respPbr.getBody());
        assertNull(respPbr.getBody().getError());
        @SuppressWarnings("unchecked")
        Map<String, Object> resPbr = (Map<String, Object>) respPbr.getBody().getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contentsPbr = (List<Map<String, Object>>) resPbr.get("contents");
        Map<?, ?> pbrMap = objectMapper.readValue(contentsPbr.get(0).get("text").toString(), Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> presets = (Map<String, Object>) pbrMap.get("presets");
        assertTrue(presets.containsKey("AnodizedDarkTitanium"));
        assertTrue(presets.containsKey("MachinedAluminum"));
        assertTrue(presets.containsKey("MatteCarbonFiber"));

        // FDM design rules must enforce 1.2mm minimum wall thickness
        McpRpcRequest reqFdm = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("read-fdm")
                .method("resources/read")
                .params(Map.of("uri", "kosh://guidelines/fdm-tolerances"))
                .build();
        ResponseEntity<McpRpcResponse> respFdm = mcpController.handleRpcRequest(null, reqFdm, null, null, null, null, null);
        assertNotNull(respFdm.getBody());
        assertNull(respFdm.getBody().getError());
        @SuppressWarnings("unchecked")
        Map<String, Object> resFdm = (Map<String, Object>) respFdm.getBody().getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contentsFdm = (List<Map<String, Object>>) resFdm.get("contents");
        Map<?, ?> fdmMap = objectMapper.readValue(contentsFdm.get(0).get("text").toString(), Map.class);
        assertEquals(1.2, ((Number) fdmMap.get("minWallThicknessMm")).doubleValue());
        assertEquals(45.0, ((Number) fdmMap.get("maxOverhangAngleDeg")).doubleValue());
    }

    @Test
    @DisplayName("resources/read with unknown URI should return JSON-RPC error")
    void testReadUnknownResourceReturnsError() {
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("read-unknown")
                .method("resources/read")
                .params(Map.of("uri", "kosh://does/not/exist"))
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response.getBody());
        assertNotNull(response.getBody().getError());
        assertTrue(response.getBody().getError().getMessage().contains("Unknown resource URI"));
    }

    @Test
    @DisplayName("scaffold_parametric_enclosure prompt should return filled enclosure blueprint")
    void testGetScaffoldEnclosurePrompt() {
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("prompt-scaffold-1")
                .method("prompts/get")
                .params(Map.of(
                        "name", "scaffold_parametric_enclosure",
                        "arguments", Map.of(
                                "lengthMm", "100",
                                "widthMm", "60",
                                "heightMm", "40",
                                "wallThicknessMm", "2.4"
                        )
                ))
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response.getBody());
        assertNull(response.getBody().getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) response.getBody().getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> messages = (List<Map<String, Object>>) result.get("messages");
        assertNotNull(messages);
        assertFalse(messages.isEmpty());

        @SuppressWarnings("unchecked")
        Map<String, Object> content = (Map<String, Object>) messages.get(0).get("content");
        String text = content.get("text").toString();
        assertTrue(text.contains("Parametric Enclosure Engineer"));
        assertTrue(text.contains("100mm x 60mm x 40mm"));
        assertTrue(text.contains("2.4mm walls"));
        assertTrue(text.contains("cad_apply_fillet_chamfer"));
        assertTrue(text.contains("kosh://specs/hardware/metric-fasteners"));
    }

    @Test
    @DisplayName("cad_assemble_kit should spawn a pre-baked flange kit without LLM round-trip")
    void testAssembleKitTool() {
        assumeTrue(blenderExecutionService.isBlenderAvailable(), "Blender runtime is not available; skipping live render test");
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("kit-1")
                .method("tools/call")
                .params(Map.of(
                        "name", "cad_assemble_kit",
                        "arguments", Map.of(
                                "kitCategory", "industrial_flange",
                                "parameters", Map.of("scale", 0.5, "boltCount", 8, "hollow", true),
                                "targetPosition", List.of(0.0, 0.0, 0.1),
                                "format", "glb"
                        )
                ))
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);
        assertNull(body.getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        assertEquals(false, result.get("isError"));

        com.kosh.dto.ToolExecutionDto.Result execution = (com.kosh.dto.ToolExecutionDto.Result) result.get("execution");
        assertNotNull(execution);
        assertTrue(execution.isSuccess(), "kit assembly failed: " + execution.getStderr());
        assertNotNull(execution.getAssetName());
    }

    @Test
    @DisplayName("cad_batch_csg should run base plus boolean pipeline in one round-trip")
    void testBatchCsgTool() {
        assumeTrue(blenderExecutionService.isBlenderAvailable(), "Blender runtime is not available; skipping live render test");
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("batch-csg-1")
                .method("tools/call")
                .params(Map.of(
                        "name", "cad_batch_csg",
                        "arguments", Map.of(
                                "baseShape", "box",
                                "baseDimensions", List.of(0.8, 0.8, 0.4),
                                "operations", List.of(
                                        Map.of(
                                                "op", "DIFFERENCE",
                                                "shape", "cylinder",
                                                "transform", List.of(0.0, 0.0, 0.4),
                                                "scale", List.of(0.25, 1.0)
                                        ),
                                        Map.of(
                                                "op", "DIFFERENCE",
                                                "shape", "box",
                                                "transform", List.of(0.0, 0.0, 0.4),
                                                "scale", List.of(0.15, 0.15, 1.0)
                                        )
                                ),
                                "format", "glb"
                        )
                ))
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);
        assertNull(body.getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        assertEquals(false, result.get("isError"));

        com.kosh.dto.ToolExecutionDto.Result execution = (com.kosh.dto.ToolExecutionDto.Result) result.get("execution");
        assertNotNull(execution);
        assertTrue(execution.isSuccess(), "batch CSG failed: " + execution.getStderr());
        assertNotNull(execution.getAssetName());
    }

    @Test
    @DisplayName("cad_quick_fillet_chamfer alias should apply parametric bevel modifier")
    void testFilletChamferToolAlias() {
        assumeTrue(blenderExecutionService.isBlenderAvailable(), "Blender runtime is not available; skipping live render test");
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("fillet-1")
                .method("tools/call")
                .params(Map.of(
                        "name", "cad_quick_fillet_chamfer",
                        "arguments", Map.of(
                                "targetObjectName", "Bevel_Test_Part",
                                "offsetMm", 2.5,
                                "segments", 3,
                                "affectOnlyEdges", true,
                                "format", "glb"
                        )
                ))
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);
        assertNull(body.getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        assertEquals(false, result.get("isError"));

        com.kosh.dto.ToolExecutionDto.Result execution = (com.kosh.dto.ToolExecutionDto.Result) result.get("execution");
        assertNotNull(execution);
        assertTrue(execution.isSuccess(), "fillet/chamfer failed: " + execution.getStderr());
        assertNotNull(execution.getAssetName());
    }

    @Test
    @DisplayName("MCP tools/call cad_measure_dimensions should return digital caliper telemetry")
    void testMeasureDimensionsTool() {
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("measure-1")
                .method("tools/call")
                .params(Map.of(
                        "name", "cad_measure_dimensions",
                        "arguments", Map.of("unit", "mm")
                ))
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);
        assertNull(body.getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        assertNotNull(result);
        assertEquals(false, result.get("isError"));
    }

    @Test
    @DisplayName("MCP tools/call kosh_system_health should return live diagnostic status")
    void testSystemHealthTool() {
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("health-diag-1")
                .method("tools/call")
                .params(Map.of(
                        "name", "kosh_system_health",
                        "arguments", Map.of()
                ))
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);
        assertNull(body.getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        assertNotNull(result);
        assertEquals(false, result.get("isError"));
    }

    @Test
    @DisplayName("MCP resources/read should return valid JSON for stepper motors and physical constants")
    void testReadNewEngineeringResources() throws Exception {
        // Read kosh://specs/engineering/stepper-motors
        McpRpcRequest reqStepper = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("read-stepper")
                .method("resources/read")
                .params(Map.of("uri", "kosh://specs/engineering/stepper-motors"))
                .build();

        ResponseEntity<McpRpcResponse> respStepper = mcpController.handleRpcRequest(null, reqStepper, null, null, null, null, null);
        assertNotNull(respStepper.getBody());
        @SuppressWarnings("unchecked")
        Map<String, Object> resStepper = (Map<String, Object>) respStepper.getBody().getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contentsStepper = (List<Map<String, Object>>) resStepper.get("contents");
        assertFalse(contentsStepper.isEmpty());
        String textStepper = contentsStepper.get(0).get("text").toString();
        Map<?, ?> stepperMap = objectMapper.readValue(textStepper, Map.class);
        assertTrue(stepperMap.containsKey("sizes"));

        // Read kosh://materials/physical-constants
        McpRpcRequest reqConstants = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("read-constants")
                .method("resources/read")
                .params(Map.of("uri", "kosh://materials/physical-constants"))
                .build();

        ResponseEntity<McpRpcResponse> respConstants = mcpController.handleRpcRequest(null, reqConstants, null, null, null, null, null);
        assertNotNull(respConstants.getBody());
        @SuppressWarnings("unchecked")
        Map<String, Object> resConstants = (Map<String, Object>) respConstants.getBody().getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contentsConstants = (List<Map<String, Object>>) resConstants.get("contents");
        assertFalse(contentsConstants.isEmpty());
        String textConstants = contentsConstants.get(0).get("text").toString();
        Map<?, ?> constantsMap = objectMapper.readValue(textConstants, Map.class);
        assertTrue(constantsMap.containsKey("materials"));
    }

    @Test
    @DisplayName("MCP prompts/get should generate spur gear train and hero shot blueprints")
    void testGetNewEngineeringPrompts() {
        // Test design_spur_gear_train
        McpRpcRequest reqGear = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("prompt-gear-1")
                .method("prompts/get")
                .params(Map.of("name", "design_spur_gear_train", "arguments", Map.of("gearRatio", "3.0", "module", "2.0")))
                .build();

        ResponseEntity<McpRpcResponse> respGear = mcpController.handleRpcRequest(null, reqGear, null, null, null, null, null);
        assertNotNull(respGear.getBody());
        @SuppressWarnings("unchecked")
        Map<String, Object> resultGear = (Map<String, Object>) respGear.getBody().getResult();
        assertNotNull(resultGear);
        assertTrue(resultGear.containsKey("messages"));

        // Test photorealistic_product_hero_shot
        McpRpcRequest reqHero = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("prompt-hero-1")
                .method("prompts/get")
                .params(Map.of("name", "photorealistic_product_hero_shot", "arguments", Map.of("meshName", "Camera_Body")))
                .build();

        ResponseEntity<McpRpcResponse> respHero = mcpController.handleRpcRequest(null, reqHero, null, null, null, null, null);
        assertNotNull(respHero.getBody());
        @SuppressWarnings("unchecked")
        Map<String, Object> resultHero = (Map<String, Object>) respHero.getBody().getResult();
        assertNotNull(resultHero);
        assertTrue(resultHero.containsKey("messages"));
    }

    @Test
    @DisplayName("MCP tools/call cad_export_engineering_drawing should generate SVG lineart blueprint")
    void testExportEngineeringDrawingTool() {
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("drawing-call-1")
                .method("tools/call")
                .params(Map.of(
                        "name", "cad_export_engineering_drawing",
                        "arguments", Map.of("targetMesh", "Test_Pinion", "drawingStandard", "ISO")
                ))
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);
        assertNull(body.getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        assertNotNull(result);
        assertEquals(false, result.get("isError"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) result.get("content");
        assertNotNull(content);
        assertFalse(content.isEmpty());
        String text = content.get(0).get("text").toString();
        assertTrue(text.contains("<svg"));
        assertTrue(text.contains("KOSH CAD WORKSTATION"));
    }

    @Test
    @DisplayName("MCP resources/read should return puzzle pieces catalog and saved models")
    void testReadPuzzlePiecesAndSavedModelsResources() throws Exception {
        // Read kosh://library/puzzle-pieces
        McpRpcRequest reqPuzzle = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("read-puzzle")
                .method("resources/read")
                .params(Map.of("uri", "kosh://library/puzzle-pieces"))
                .build();

        ResponseEntity<McpRpcResponse> respPuzzle = mcpController.handleRpcRequest(null, reqPuzzle, null, null, null, null, null);
        assertNotNull(respPuzzle.getBody());
        @SuppressWarnings("unchecked")
        Map<String, Object> resPuzzle = (Map<String, Object>) respPuzzle.getBody().getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contentsPuzzle = (List<Map<String, Object>>) resPuzzle.get("contents");
        assertFalse(contentsPuzzle.isEmpty());
        String textPuzzle = contentsPuzzle.get(0).get("text").toString();
        Map<?, ?> puzzleMap = objectMapper.readValue(textPuzzle, Map.class);
        assertTrue(puzzleMap.containsKey("components"));
        assertTrue(puzzleMap.containsKey("compositeRecipes"));

        @SuppressWarnings("unchecked")
        Map<String, Object> components = (Map<String, Object>) puzzleMap.get("components");
        assertTrue(components.containsKey("dovetail_male_plate"));
        assertTrue(components.containsKey("nema17_motor_mount"));
        assertTrue(components.containsKey("bearing_block_608"));
        assertTrue(components.containsKey("corner_gusset_90"));
        assertTrue(components.containsKey("t_slot_rail_2020"));

        @SuppressWarnings("unchecked")
        Map<String, Object> recipes = (Map<String, Object>) puzzleMap.get("compositeRecipes");
        assertTrue(recipes.containsKey("interlocking_dovetail_plate"));
        assertTrue(recipes.containsKey("robotic_articulated_arm"));
        assertTrue(recipes.containsKey("modular_cube_chassis"));

        // Read kosh://library/saved-models
        McpRpcRequest reqModels = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("read-models")
                .method("resources/read")
                .params(Map.of("uri", "kosh://library/saved-models"))
                .build();

        ResponseEntity<McpRpcResponse> respModels = mcpController.handleRpcRequest(null, reqModels, null, null, null, null, null);
        assertNotNull(respModels.getBody());
        @SuppressWarnings("unchecked")
        Map<String, Object> resModels = (Map<String, Object>) respModels.getBody().getResult();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contentsModels = (List<Map<String, Object>>) resModels.get("contents");
        assertFalse(contentsModels.isEmpty());
        String textModels = contentsModels.get(0).get("text").toString();
        Map<?, ?> modelsMap = objectMapper.readValue(textModels, Map.class);
        assertTrue(modelsMap.containsKey("models"));

        @SuppressWarnings("unchecked")
        Map<String, Object> models = (Map<String, Object>) modelsMap.get("models");
        assertTrue(models.containsKey("drone_quadcopter_pro"));
        assertTrue(models.containsKey("planetary_gearbox_stage"));
        assertTrue(models.containsKey("biomedical_microscope_body"));
        assertTrue(models.containsKey("modular_electronics_housing"));
        assertTrue(models.containsKey("cosmic_astronaut_scene"));
    }

    @Test
    @DisplayName("MCP prompts/get should generate assemble_modular_puzzle_recipe instructions")
    void testAssembleModularPuzzleRecipePrompt() {
        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("prompt-puzzle-1")
                .method("prompts/get")
                .params(Map.of("name", "assemble_modular_puzzle_recipe", "arguments", Map.of(
                        "recipeName", "robotic_articulated_arm",
                        "clearanceMm", "0.2"
                )))
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);
        assertNull(body.getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        assertNotNull(result);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> messages = (List<Map<String, Object>>) result.get("messages");
        assertNotNull(messages);
        assertFalse(messages.isEmpty());

        @SuppressWarnings("unchecked")
        Map<String, Object> content = (Map<String, Object>) messages.get(0).get("content");
        String text = content.get("text").toString();
        assertTrue(text.contains("kosh://library/puzzle-pieces"));
        assertTrue(text.contains("cad_assemble_puzzle_pieces"));
        assertTrue(text.contains("robotic_articulated_arm"));
    }

    @Test
    @DisplayName("MCP tools/call cad_assemble_puzzle_pieces should execute procedural assembly")
    void testAssemblePuzzlePiecesTool() {
        assumeTrue(blenderExecutionService.isBlenderAvailable(), "Blender runtime is not available; skipping live test");

        McpRpcRequest req = McpRpcRequest.builder()
                .jsonrpc("2.0")
                .id("puzzle-call-1")
                .method("tools/call")
                .params(Map.of(
                        "name", "cad_assemble_puzzle_pieces",
                        "arguments", Map.of("recipe", "interlocking_dovetail_plate", "toleranceMm", 0.2, "scale", 1.0)
                ))
                .build();

        ResponseEntity<McpRpcResponse> response = mcpController.handleRpcRequest(null, req, null, null, null, null, null);
        assertNotNull(response);
        McpRpcResponse body = response.getBody();
        assertNotNull(body);
        assertNull(body.getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.getResult();
        assertNotNull(result);
        assertEquals(false, result.get("isError"));
    }

}

