package com.kosh.controller;

import com.kosh.service.BlenderExecutionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

@Slf4j
@RestController
@RequestMapping("/api/assets")
public class AssetController {

    private final BlenderExecutionService blenderExecutionService;

    public AssetController(BlenderExecutionService blenderExecutionService) {
        this.blenderExecutionService = blenderExecutionService;
    }

    /**
     * Serves generated .glb and .stl artifacts.
     */
    @GetMapping("/{filename:.+}")
    public ResponseEntity<Resource> getAsset(@PathVariable String filename) {
        Path storageDir = blenderExecutionService.getStoragePath();
        Path targetPath = storageDir.resolve(filename).normalize();

        // Prevent path traversal
        if (!targetPath.startsWith(storageDir)) {
            log.warn("Path traversal attempt detected: {}", filename);
            return ResponseEntity.badRequest().build();
        }

        File file = targetPath.toFile();
        if (!file.exists() || !file.isFile()) {
            log.warn("Requested asset not found: {}", filename);
            return ResponseEntity.notFound().build();
        }

        MediaType mediaType;
        if (filename.toLowerCase().endsWith(".glb")) {
            mediaType = MediaType.parseMediaType("model/gltf-binary");
        } else if (filename.toLowerCase().endsWith(".gltf")) {
            mediaType = MediaType.parseMediaType("model/gltf+json");
        } else if (filename.toLowerCase().endsWith(".stl")) {
            mediaType = MediaType.parseMediaType("model/stl");
        } else if (filename.toLowerCase().endsWith(".png")) {
            mediaType = MediaType.IMAGE_PNG;
        } else if (filename.toLowerCase().endsWith(".json")) {
            mediaType = MediaType.APPLICATION_JSON;
        } else {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        Resource resource = new FileSystemResource(file);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                .contentType(mediaType)
                .contentLength(file.length())
                .body(resource);
    }

    /**
     * Lists all generated 3D assets in storage.
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listAssets() {
        Path storageDir = blenderExecutionService.getStoragePath();
        List<Map<String, Object>> assets = new ArrayList<>();

        if (Files.exists(storageDir)) {
            try (Stream<Path> stream = Files.list(storageDir)) {
                stream.filter(Files::isRegularFile)
                        .filter(p -> p.toString().endsWith(".glb") || p.toString().endsWith(".stl") || p.toString().endsWith(".gltf"))
                        .sorted(Comparator.comparingLong((Path p) -> {
                            try {
                                return Files.getLastModifiedTime(p).toMillis();
                            } catch (IOException e) {
                                return 0L;
                            }
                        }).reversed())
                        .forEach(p -> {
                            try {
                                assets.add(Map.of(
                                        "name", p.getFileName().toString(),
                                        "url", "/api/assets/" + p.getFileName().toString(),
                                        "sizeBytes", Files.size(p),
                                        "lastModified", Files.getLastModifiedTime(p).toMillis()
                                ));
                            } catch (IOException ignored) {
                            }
                        });
            } catch (IOException e) {
                log.error("Error listing storage assets: {}", e.getMessage());
            }
        }

        return ResponseEntity.ok(assets);
    }
}
