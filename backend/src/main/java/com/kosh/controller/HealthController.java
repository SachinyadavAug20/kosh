package com.kosh.controller;

import com.kosh.service.BlenderExecutionService;
import com.kosh.service.McpPromptRegistry;
import com.kosh.service.McpResourceRegistry;
import com.kosh.service.McpToolRegistry;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final BlenderExecutionService blenderExecutionService;
    private final McpToolRegistry mcpToolRegistry;
    private final McpResourceRegistry resourceRegistry;
    private final McpPromptRegistry promptRegistry;

    public HealthController(BlenderExecutionService blenderExecutionService,
                            McpToolRegistry mcpToolRegistry,
                            McpResourceRegistry resourceRegistry,
                            McpPromptRegistry promptRegistry) {
        this.blenderExecutionService = blenderExecutionService;
        this.mcpToolRegistry = mcpToolRegistry;
        this.resourceRegistry = resourceRegistry;
        this.promptRegistry = promptRegistry;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getHealth() {
        boolean blenderReady = blenderExecutionService.isBlenderAvailable();
        String blenderVersion = blenderExecutionService.getBlenderVersion();
        boolean daemonAlive = blenderReady && blenderExecutionService.isDaemonAlive();

        Path storagePath = blenderExecutionService.getStoragePath();
        boolean storageWritable = Files.isDirectory(storagePath) && Files.isWritable(storagePath);

        Runtime rt = Runtime.getRuntime();
        long usedHeapMb = (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024);
        long maxHeapMb = rt.maxMemory() / (1024 * 1024);
        long uptimeSeconds = ManagementFactory.getRuntimeMXBean().getUptime() / 1000;

        int toolsCount = mcpToolRegistry.listTools().size();
        int resourcesCount = resourceRegistry.listResources().size();
        int promptsCount = promptRegistry.listPrompts().size();

        String status = (toolsCount > 0 && resourcesCount > 0 && promptsCount > 0) ? "UP" : "DEGRADED";

        return ResponseEntity.ok(Map.of(
                "status", status,
                "service", "Kosh MCP Creative Server",
                "blender", Map.of(
                        "available", blenderReady,
                        "executable", blenderExecutionService.getBlenderExecutable(),
                        "version", blenderVersion,
                        "daemonAlive", daemonAlive
                ),
                "storage", Map.of(
                        "path", storagePath.toString(),
                        "writable", storageWritable
                ),
                "mcp", Map.of(
                        "toolsCount", toolsCount,
                        "resourcesCount", resourcesCount,
                        "promptsCount", promptsCount
                ),
                "runtime", Map.of(
                        "uptimeSeconds", uptimeSeconds,
                        "usedHeapMb", usedHeapMb,
                        "maxHeapMb", maxHeapMb,
                        "availableProcessors", rt.availableProcessors()
                ),
                "toolsCount", toolsCount,
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
