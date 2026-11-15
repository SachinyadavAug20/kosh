package com.kosh;

import com.kosh.controller.HealthController;
import com.kosh.service.McpPromptRegistry;
import com.kosh.service.McpResourceRegistry;
import com.kosh.service.McpToolRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class HealthControllerTest {

    @Autowired
    private HealthController healthController;

    @Autowired
    private McpToolRegistry mcpToolRegistry;

    @Autowired
    private McpResourceRegistry resourceRegistry;

    @Autowired
    private McpPromptRegistry promptRegistry;

    @SuppressWarnings("unchecked")
    private Map<String, Object> health() {
        ResponseEntity<Map<String, Object>> response = healthController.getHealth();
        assertEquals(200, response.getStatusCode().value());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        return body;
    }

    @Test
    @DisplayName("Health endpoint reports UP with service identity")
    void testHealthStatus() {
        Map<String, Object> body = health();
        assertEquals("UP", body.get("status"));
        assertEquals("Kosh MCP Creative Server", body.get("service"));
        assertNotNull(body.get("timestamp"));
    }

    @Test
    @DisplayName("Health MCP counts stay consistent with live registries")
    @SuppressWarnings("unchecked")
    void testMcpCountsMatchRegistries() {
        Map<String, Object> body = health();
        Map<String, Object> mcp = (Map<String, Object>) body.get("mcp");
        assertNotNull(mcp, "mcp block missing");

        assertEquals(mcpToolRegistry.listTools().size(), mcp.get("toolsCount"));
        assertEquals(resourceRegistry.listResources().size(), mcp.get("resourcesCount"));
        assertEquals(promptRegistry.listPrompts().size(), mcp.get("promptsCount"));

        // Legacy top-level toolsCount must stay in sync for older clients
        assertEquals(mcp.get("toolsCount"), body.get("toolsCount"));

        assertTrue((Integer) mcp.get("toolsCount") >= 85, "expected the full CAD tool surface");
        assertTrue((Integer) mcp.get("resourcesCount") >= 26, "expected guide + scene resources");
        assertTrue((Integer) mcp.get("promptsCount") >= 19, "expected the prompt blueprint set");
    }

    @Test
    @DisplayName("Health blender block exposes daemon liveness flag")
    @SuppressWarnings("unchecked")
    void testBlenderBlock() {
        Map<String, Object> body = health();
        Map<String, Object> blender = (Map<String, Object>) body.get("blender");
        assertNotNull(blender, "blender block missing");
        assertNotNull(blender.get("available"));
        assertNotNull(blender.get("executable"));
        assertNotNull(blender.get("version"));
        assertNotNull(blender.get("daemonAlive"), "daemonAlive flag missing");
        assertTrue(blender.get("daemonAlive") instanceof Boolean);
    }

    @Test
    @DisplayName("Health runtime block reports heap, uptime, and storage writability")
    @SuppressWarnings("unchecked")
    void testRuntimeAndStorageBlocks() {
        Map<String, Object> body = health();

        Map<String, Object> runtime = (Map<String, Object>) body.get("runtime");
        assertNotNull(runtime, "runtime block missing");
        assertTrue((Long) runtime.get("uptimeSeconds") >= 0);
        assertTrue((Long) runtime.get("usedHeapMb") >= 0);
        assertTrue((Long) runtime.get("maxHeapMb") > 0);
        assertTrue((Integer) runtime.get("availableProcessors") > 0);

        Map<String, Object> storage = (Map<String, Object>) body.get("storage");
        assertNotNull(storage, "storage block missing");
        assertNotNull(storage.get("path"));
        assertTrue(storage.get("writable") instanceof Boolean);
    }

    @Test
    @DisplayName("Trust score payload is exposed with zero CVEs")
    @SuppressWarnings("unchecked")
    void testTrustScoreBlock() {
        Map<String, Object> body = health();
        Map<String, Object> trust = (Map<String, Object>) body.get("trustScore");
        assertNotNull(trust, "trustScore block missing");
        assertEquals(89, trust.get("overallScore"));
        assertEquals(0, trust.get("cves"));
        assertEquals("Apache-2.0", trust.get("license"));
    }

    @Test
    @DisplayName("Resource registry listings are immutable copies")
    void testResourceListingsAreCopies() {
        List<Map<String, Object>> resources = resourceRegistry.listResources();
        assertThrows(UnsupportedOperationException.class, () -> resources.add(Map.of()));
        List<Map<String, Object>> prompts = promptRegistry.listPrompts();
        assertThrows(UnsupportedOperationException.class, () -> prompts.add(Map.of()));
    }
}
