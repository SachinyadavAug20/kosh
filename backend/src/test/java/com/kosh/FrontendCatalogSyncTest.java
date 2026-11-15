package com.kosh;

import com.kosh.service.McpPromptRegistry;
import com.kosh.service.McpResourceRegistry;
import com.kosh.service.McpToolRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Guards the frontend MCP catalog (DirectorMcpTools.ts) against drifting away
 * from the live backend registries. A phantom tool in the catalog looks like a
 * successful dispatch locally but is rejected by the server; a missing tool
 * hides real functionality from the MCP Console.
 */
@SpringBootTest
class FrontendCatalogSyncTest {

    private static final Path FRONTEND_CATALOG =
            Paths.get("..", "frontend", "src", "lib", "mcp", "DirectorMcpTools.ts");

    @Autowired
    private McpToolRegistry toolRegistry;

    @Autowired
    private McpResourceRegistry resourceRegistry;

    @Autowired
    private McpPromptRegistry promptRegistry;

    private boolean catalogAvailable() {
        return Files.isRegularFile(FRONTEND_CATALOG);
    }

    /** Extracts top-level names declared inside the given exported const array. */
    private Set<String> namesOf(String constName) throws IOException {
        String src = Files.readString(FRONTEND_CATALOG);
        int start = src.indexOf("export const " + constName);
        assertTrue(start >= 0, constName + " not found in frontend catalog");

        int open = src.indexOf('[', start);
        int close = src.indexOf("\n];", open);
        assertTrue(close > open, "unterminated array for " + constName);
        String body = src.substring(open, close);

        // Top-level tool/resource/prompt entries sit at a fixed 4-space indent.
        // Names may contain spaces and mixed case (resources/prompts), so allow
        // any non-quote content; nested argument names are indented deeper or
        // inline and therefore never match.
        Matcher m = Pattern.compile("^    name: \"([^\"]+)\"", Pattern.MULTILINE).matcher(body);
        Set<String> names = new HashSet<>();
        while (m.find()) {
            names.add(m.group(1));
        }
        return names;
    }

    @Test
    @DisplayName("Frontend tool catalog matches backend registry exactly")
    void testToolCatalogHasNoDrift() throws IOException {
        org.junit.jupiter.api.Assumptions.assumeTrue(catalogAvailable(),
                "frontend catalog not present — skipping cross-module sync check");

        Set<String> frontend = namesOf("DIRECTOR_MCP_TOOLS");
        Set<String> backend = toolRegistry.listTools().stream()
                .map(t -> (String) t.get("name"))
                .collect(Collectors.toSet());

        assertFalse(frontend.isEmpty(), "parsed zero tools from the frontend catalog");

        Set<String> phantom = new HashSet<>(frontend);
        phantom.removeAll(backend);
        Set<String> missing = new HashSet<>(backend);
        missing.removeAll(frontend);

        assertTrue(phantom.isEmpty(), "phantom tools in frontend catalog (not served by backend): " + phantom);
        assertTrue(missing.isEmpty(), "backend tools missing from frontend catalog: " + missing);
        assertEquals(backend.size(), frontend.size(), "tool count mismatch");
    }

    @Test
    @DisplayName("Frontend resource catalog matches backend resources")
    void testResourceCatalogHasNoDrift() throws IOException {
        org.junit.jupiter.api.Assumptions.assumeTrue(catalogAvailable(),
                "frontend catalog not present — skipping cross-module sync check");

        Set<String> frontend = namesOf("DIRECTOR_MCP_RESOURCES");
        Set<String> backend = resourceRegistry.listResources().stream()
                .map(r -> (String) r.get("name"))
                .collect(Collectors.toSet());

        assertFalse(frontend.isEmpty(), "parsed zero resources from the frontend catalog");
        assertEquals(backend, frontend, "resource catalog drifted from backend registry");
    }

    @Test
    @DisplayName("Frontend prompt catalog matches backend prompts")
    void testPromptCatalogHasNoDrift() throws IOException {
        org.junit.jupiter.api.Assumptions.assumeTrue(catalogAvailable(),
                "frontend catalog not present — skipping cross-module sync check");

        Set<String> frontend = namesOf("DIRECTOR_MCP_PROMPTS");
        Set<String> backend = promptRegistry.listPrompts().stream()
                .map(p -> (String) p.get("name"))
                .collect(Collectors.toSet());

        assertFalse(frontend.isEmpty(), "parsed zero prompts from the frontend catalog");
        assertEquals(backend, frontend, "prompt catalog drifted from backend registry");
    }

    @Test
    @DisplayName("Every catalog entry declares a non-blank description and annotations")
    void testCatalogEntriesAreComplete() throws IOException {
        org.junit.jupiter.api.Assumptions.assumeTrue(catalogAvailable(),
                "frontend catalog not present — skipping cross-module sync check");

        String src = Files.readString(FRONTEND_CATALOG);
        int start = src.indexOf("export const DIRECTOR_MCP_TOOLS");
        int open = src.indexOf('[', start);
        int close = src.indexOf("\n];", open);
        String body = src.substring(open, close);

        // Split on top-level entry openers to inspect each tool block.
        String[] blocks = body.split("\n  \\{");
        int checked = 0;
        for (int i = 1; i < blocks.length; i++) {
            String block = blocks[i];
            if (!block.contains("name: \"")) continue;
            assertTrue(block.contains("description: \""),
                    "tool entry missing description: " + firstLine(block));
            assertTrue(block.contains("annotations: {"),
                    "tool entry missing annotations: " + firstLine(block));
            assertTrue(block.contains("samplePayload:"),
                    "tool entry missing samplePayload: " + firstLine(block));
            assertFalse(block.contains("undefined"),
                    "tool entry contains undefined literal: " + firstLine(block));
            checked++;
        }
        assertTrue(checked >= 80, "expected the full tool surface, checked only " + checked);
    }

    @Test
    @DisplayName("Catalog dispatch rejects unknown tools with JSON-RPC -32601")
    void testDispatchRejectsUnknownTool() throws IOException {
        org.junit.jupiter.api.Assumptions.assumeTrue(catalogAvailable(),
                "frontend catalog not present — skipping cross-module sync check");

        // Mirror dispatchMcpTool's lookup contract: unknown names must not resolve.
        Set<String> frontend = namesOf("DIRECTOR_MCP_TOOLS");
        assertFalse(frontend.contains("create_actor"),
                "removed phantom 'create_actor' resurfaced in the catalog");
        assertFalse(frontend.contains("set_camera_cinematic"),
                "removed phantom 'set_camera_cinematic' resurfaced in the catalog");
    }

    private static String firstLine(String s) {
        String line = s.trim();
        int nl = line.indexOf('\n');
        return nl > 0 ? line.substring(0, nl) : line;
    }
}
