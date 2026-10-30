package com.kosh.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kosh.dto.ShareDto;
import com.kosh.service.BlenderExecutionService;
import com.kosh.service.GoogleGeminiClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Stream;

@Slf4j
@RestController
@RequestMapping("/api/shares")
public class ShareController {

    private final BlenderExecutionService blenderExecutionService;
    private final GoogleGeminiClient googleGeminiClient;
    private final ObjectMapper objectMapper;

    public ShareController(BlenderExecutionService blenderExecutionService,
                           GoogleGeminiClient googleGeminiClient,
                           ObjectMapper objectMapper) {
        this.blenderExecutionService = blenderExecutionService;
        this.googleGeminiClient = googleGeminiClient;
        this.objectMapper = objectMapper;
    }

    private Path getSharesDir() {
        Path dir = blenderExecutionService.getStoragePath().resolve("shares");
        if (!Files.exists(dir)) {
            try {
                Files.createDirectories(dir);
            } catch (IOException e) {
                log.error("Failed to create shares directory: {}", e.getMessage());
            }
        }
        return dir;
    }

    /**
     * Create a new share record
     */
    @PostMapping
    public ResponseEntity<ShareDto> createShare(@RequestBody ShareDto request) {
        String id = "s_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        long now = System.currentTimeMillis();

        ShareDto share = ShareDto.builder()
                .id(id)
                .title(request.getTitle() != null && !request.getTitle().isBlank() ? request.getTitle().trim() : "Untitled 3D Creation")
                .description(request.getDescription() != null ? request.getDescription() : "Shared via Kosh 3D Workstation")
                .author(request.getAuthor() != null && !request.getAuthor().isBlank() ? request.getAuthor().trim() : "Community Creator")
                .assetUrl(request.getAssetUrl())
                .assetName(request.getAssetName())
                .snapshotUrl(request.getSnapshotUrl())
                .script(request.getScript())
                .format(request.getFormat() != null ? request.getFormat() : "glb")
                .theme(request.getTheme() != null ? request.getTheme() : "titanium-slate")
                .createdAt(now)
                .shareUrl("/share/" + id)
                .cameraPosition(request.getCameraPosition())
                .metadata(request.getMetadata())
                .build();

        Path shareFile = getSharesDir().resolve(id + ".json");
        try {
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(shareFile.toFile(), share);
            log.info("Saved share record {} to {}", id, shareFile);
        } catch (IOException e) {
            log.error("Failed to write share record: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }

        return ResponseEntity.ok(share);
    }

    /**
     * Retrieve a share record by ID (or a featured showcase model)
     */
    @GetMapping("/{id}")
    public ResponseEntity<ShareDto> getShare(@PathVariable String id) {
        // 1. Check disk for user shares
        Path shareFile = getSharesDir().resolve(id + ".json");
        if (Files.exists(shareFile)) {
            try {
                ShareDto share = objectMapper.readValue(shareFile.toFile(), ShareDto.class);
                return ResponseEntity.ok(share);
            } catch (IOException e) {
                log.error("Failed to read share record {}: {}", id, e.getMessage());
            }
        }

        // 2. Check featured models
        for (ShareDto feat : getFeaturedModels()) {
            if (feat.getId().equalsIgnoreCase(id)) {
                ensureFeaturedModelAsset(feat);
                return ResponseEntity.ok(feat);
            }
        }

        return ResponseEntity.notFound().build();
    }

    /**
     * List all shares (user shares + featured community models)
     */
    @GetMapping
    public ResponseEntity<List<ShareDto>> listShares() {
        List<ShareDto> result = new ArrayList<>();

        // Add featured models first
        List<ShareDto> featured = getFeaturedModels();
        result.addAll(featured);

        // Load custom user shares
        Path dir = getSharesDir();
        if (Files.exists(dir)) {
            try (Stream<Path> stream = Files.list(dir)) {
                stream.filter(p -> p.toString().endsWith(".json"))
                        .forEach(p -> {
                            try {
                                ShareDto share = objectMapper.readValue(p.toFile(), ShareDto.class);
                                result.add(share);
                            } catch (Exception e) {
                                log.warn("Failed to parse share file {}: {}", p, e.getMessage());
                            }
                        });
            } catch (IOException e) {
                log.error("Failed to list shares: {}", e.getMessage());
            }
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Lazy compilation for featured models if asset does not exist on disk
     */
    private void ensureFeaturedModelAsset(ShareDto feat) {
        if (feat.getAssetUrl() != null && !feat.getAssetUrl().isBlank()) {
            String filename = feat.getAssetUrl().replace("/api/assets/", "");
            Path assetPath = blenderExecutionService.getStoragePath().resolve(filename);
            if (Files.exists(assetPath)) {
                return; // Asset is already compiled and present
            }
        }

        // Generate procedural asset on the fly
        if (feat.getScript() != null && !feat.getScript().isBlank()) {
            try {
                BlenderExecutionService.BlenderRunResult res = blenderExecutionService.executeScript(feat.getScript(), feat.getFormat() != null ? feat.getFormat() : "glb");
                if (res.isSuccess()) {
                    feat.setAssetUrl("/api/assets/" + res.getAssetFileName());
                    feat.setAssetName(res.getAssetFileName());
                    feat.setSnapshotUrl(res.getSnapshotUrl());
                }
            } catch (Exception e) {
                log.warn("Failed to compile asset for featured model {}: {}", feat.getId(), e.getMessage());
            }
        }
    }

    /**
     * Pre-defined featured models in the Community Showcase
     */
    private List<ShareDto> getFeaturedModels() {
        List<ShareDto> models = new ArrayList<>();

        // 1. House Blasting & Reverse Assembly
        String houseScript = googleGeminiClient.generateProceduralModelScript("house blasting explosion reverse reassembly", "blender_animation", "glb");
        models.add(ShareDto.builder()
                .id("feat_house_blast")
                .title("House Blasting & Reverse Assembly")
                .description("15-piece kinematic architecture that shatters outward into dynamic debris trajectories, then magically reassembles back together.")
                .author("Kosh Kinetic Lab")
                .format("glb")
                .theme("titanium-slate")
                .createdAt(1730000001000L)
                .shareUrl("/share/feat_house_blast")
                .script(houseScript)
                .assetUrl("/api/assets/kosh_0d826ae0-677.glb")
                .assetName("kosh_0d826ae0-677.glb")
                .build());

        // 2. Procedural Flange Turbine
        String turbineScript = googleGeminiClient.generateProceduralModelScript("procedural flange turbine bearing CAD", "kosh_cad_export_step", "glb");
        models.add(ShareDto.builder()
                .id("feat_turbine")
                .title("Procedural Flange Turbine")
                .description("Precision billet 6061-T6 aluminum impeller with keyed center bore and perimeter bolt circle.")
                .author("AeroDynamics CAD")
                .format("glb")
                .theme("titanium-slate")
                .createdAt(1730000002000L)
                .shareUrl("/share/feat_turbine")
                .script(turbineScript)
                .build());

        // 3. 2x2 Rubik's Cube with Layer Rotation
        String rubiksScript = googleGeminiClient.generateProceduralModelScript("2x2 rubik's cube animated layer rotation", "blender_animation", "glb");
        models.add(ShareDto.builder()
                .id("feat_rubiks")
                .title("2x2 Rubik's Cube with Layer Rotation")
                .description("Dual-layer kinetic Rubik's puzzle with chamfered cubies and authentic tournament colorway.")
                .author("Retro Puzzle Lab")
                .format("glb")
                .theme("titanium-slate")
                .createdAt(1730000003000L)
                .shareUrl("/share/feat_rubiks")
                .script(rubiksScript)
                .build());

        // 4. Low-Poly Cyberpunk Drone
        String droneScript = googleGeminiClient.generateProceduralModelScript("low poly cyberpunk quadcopter drone with rotors", "blender_mesh", "glb");
        models.add(ShareDto.builder()
                .id("feat_drone")
                .title("Low-Poly Cyberpunk Drone")
                .description("High-agility tactical quad-rotor with ducted carbon props and directional avionics lights.")
                .author("NeoTokyo 3D")
                .format("glb")
                .theme("titanium-slate")
                .createdAt(1730000004000L)
                .shareUrl("/share/feat_drone")
                .script(droneScript)
                .build());

        // 5. Extruded Logo Badge
        String emblemScript = googleGeminiClient.generateProceduralModelScript("vector emblem logo badge gold extruded", "kosh_svg_to_3d", "glb");
        models.add(ShareDto.builder()
                .id("feat_emblem")
                .title("Extruded Logo Badge")
                .description("Precision beveled vector heraldic crest with brushed gold finish and chevron star insignia.")
                .author("Vector Works")
                .format("glb")
                .theme("titanium-slate")
                .createdAt(1730000005000L)
                .shareUrl("/share/feat_emblem")
                .script(emblemScript)
                .build());

        // 6. Articulated 6-Axis Robot Arm
        String robotScript = googleGeminiClient.generateProceduralModelScript("6-axis articulated industrial robotic arm", "rigging_armature", "glb");
        models.add(ShareDto.builder()
                .id("feat_robot_arm")
                .title("Articulated 6-Axis Robot Arm")
                .description("Industrial heavy-payload articulated robotic arm with revolute kinematic joints and end-effector gripper.")
                .author("Industrial Robotics")
                .format("glb")
                .theme("titanium-slate")
                .createdAt(1730000006000L)
                .shareUrl("/share/feat_robot_arm")
                .script(robotScript)
                .build());

        return models;
    }
}
