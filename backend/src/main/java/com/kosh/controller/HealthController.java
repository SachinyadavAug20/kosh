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
                "timestamp", System.currentTimeMillis()
        ));
    }
}
