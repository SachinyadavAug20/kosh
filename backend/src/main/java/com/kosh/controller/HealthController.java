package com.kosh.controller;

import com.kosh.service.BlenderExecutionService;
import com.kosh.service.McpToolRegistry;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final BlenderExecutionService blenderExecutionService;
    private final McpToolRegistry mcpToolRegistry;

    public HealthController(BlenderExecutionService blenderExecutionService,
                            McpToolRegistry mcpToolRegistry) {
        this.blenderExecutionService = blenderExecutionService;
        this.mcpToolRegistry = mcpToolRegistry;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getHealth() {
        boolean blenderReady = blenderExecutionService.isBlenderAvailable();
        String blenderVersion = blenderExecutionService.getBlenderVersion();

        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "Kosh MCP Creative Server",
                "blender", Map.of(
                        "available", blenderReady,
                        "executable", blenderExecutionService.getBlenderExecutable(),
                        "version", blenderVersion
                ),
                "storage", Map.of(
                        "path", blenderExecutionService.getStoragePath().toString()
                ),
                "toolsCount", mcpToolRegistry.listTools().size(),
                "trustScore", Map.of(
                        "index", "M8ven Trust Index",
                        "status", "Publisher Verified / Clean Code",
                        "codeQuality", 92,
                        "overallScore", 89,
                        "cves", 0,
                        "license", "Apache-2.0",
                        "url", "https://m8ven.ai/mcp/sachinyadavaug20-kosh-17wrcp"
                ),
                "timestamp", System.currentTimeMillis()
        ));
    }

    @GetMapping("/trust")
    public ResponseEntity<Map<String, Object>> getTrustStatus() {
        return ResponseEntity.ok(mcpToolRegistry.queryM8venToolCheck("SachinyadavAug20/kosh"));
    }

    @GetMapping("/tool-check")
    public ResponseEntity<Map<String, Object>> checkMcpTool(
            @org.springframework.web.bind.annotation.RequestParam(value = "identifier", defaultValue = "SachinyadavAug20/kosh") String identifier) {
        return ResponseEntity.ok(mcpToolRegistry.queryM8venToolCheck(identifier));
    }
}
