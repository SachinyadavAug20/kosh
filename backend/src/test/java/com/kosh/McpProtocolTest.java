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

@SpringBootTest
class McpProtocolTest {

    @Autowired
    private McpController mcpController;

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
 

}
