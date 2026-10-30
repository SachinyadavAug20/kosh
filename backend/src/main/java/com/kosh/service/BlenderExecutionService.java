package com.kosh.service;

import jakarta.annotation.PostConstruct;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Slf4j
@Service
public class BlenderExecutionService {

    @Value("${blender.executable:blender}")
    private String blenderExecutable;

    @Value("${blender.timeout-seconds:45}")
    private long timeoutSeconds;

    @Value("${app.storage.dir:storage}")
    private String storageDirProperty;

    private Path storagePath;

    @PostConstruct
    public void init() {
        try {
            this.storagePath = Paths.get(storageDirProperty).toAbsolutePath().normalize();
            Files.createDirectories(this.storagePath);
            log.info("Initialized Kosh asset storage directory at: {}", this.storagePath);
        } catch (Exception e) {
            log.error("Failed to initialize storage directory: {}", e.getMessage(), e);
            throw new IllegalStateException("Storage directory initialization failed", e);
        }
    }

    public Path getStoragePath() {
        return storagePath;
    }

    public String getBlenderExecutable() {
        return blenderExecutable;
    }

    public boolean isBlenderAvailable() {
        try {
            Process process = new ProcessBuilder(blenderExecutable, "--version").start();
            boolean finished = process.waitFor(5, TimeUnit.SECONDS);
            return finished && process.exitValue() == 0;
        } catch (Exception e) {
            log.warn("Blender check failed: {}", e.getMessage());
            return false;
        }
    }

    public String getBlenderVersion() {
        try {
            Process process = new ProcessBuilder(blenderExecutable, "--version").start();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line = reader.readLine();
                return line != null ? line.trim() : "Unknown";
            }
        } catch (Exception e) {
            return "Unavailable";
        }
    }

    /**
     * Executes the Python script in headless Blender and exports the resulting asset.
     *
     * @param script Python bpy script to execute
     * @param format "glb" or "stl"
     * @return Execution result with asset details and log outputs
     */
    public BlenderRunResult executeScript(String script, String format) {
        String ext = (format != null && format.equalsIgnoreCase("stl")) ? "stl" : "glb";
        String assetId = UUID.randomUUID().toString().substring(0, 12);
        String assetFileName = "kosh_" + assetId + "." + ext;
        Path outputFile = storagePath.resolve(assetFileName);
        Path scriptFile = storagePath.resolve("script_" + assetId + ".py");

        long startTime = System.currentTimeMillis();

        try {
            String executableScript = script;
            boolean hasExport = script.contains("export_scene.gltf") ||
                    script.contains("wm.stl_export") ||
                    script.contains("export_mesh.stl");

            if (!hasExport) {
                String autoExport = """
                    
                    # --- AUTO-APPENDED KOSH EXPORT & TELEMETRY ---
                    import sys, os, json
                    import bpy
                    import mathutils
                    from mathutils import Vector
                    
                    _argv = sys.argv
                    if "--" in _argv:
                        _out = _argv[_argv.index("--") + 1]
                        _bdir = os.path.dirname(_out)
                        _bname = os.path.splitext(os.path.basename(_out))[0]
                        _snap = os.path.join(_bdir, _bname + ".png")
                        _telem = os.path.join(_bdir, _bname + ".json")
                        
                        _tot_verts = 0
                        _tot_faces = 0
                        _tot_edges = 0
                        _dx, _dy, _dz = 0.0, 0.0, 0.0
                        _mats = []
                        _objs = []
                        
                        for _o in bpy.data.objects:
                            _objs.append(_o.name)
                            if _o.type == 'MESH' and _o.data:
                                _tot_verts += len(_o.data.vertices)
                                _tot_faces += len(_o.data.polygons)
                                _tot_edges += len(_o.data.edges)
                                _dx = max(_dx, _o.dimensions.x)
                                _dy = max(_dy, _o.dimensions.y)
                                _dz = max(_dz, _o.dimensions.z)
                                for _m in _o.data.materials:
                                    if _m and _m.name not in _mats:
                                        _mats.append(_m.name)
                        
                        try:
                            with open(_telem, "w") as _tf:
                                json.dump({
                                    "triangles": _tot_faces,
                                    "vertices": _tot_verts,
                                    "edges": _tot_edges,
                                    "dimensions": [round(_dx, 3), round(_dy, 3), round(_dz, 3)],
                                    "materials": _mats,
                                    "objects": _objs
                                }, _tf)
                        except Exception:
                            pass
                        
                        if _out.lower().endswith(".stl"):
                            try:
                                bpy.ops.wm.stl_export(filepath=_out)
                            except Exception:
                                bpy.ops.export_mesh.stl(filepath=_out)
                        else:
                            bpy.ops.export_scene.gltf(filepath=_out, export_format='GLB')
                    """;
                executableScript = executableScript + "\n" + autoExport;
            }

            // Write script to temporary file
            Files.writeString(scriptFile, executableScript, StandardCharsets.UTF_8);

            ProcessBuilder pb = new ProcessBuilder(
                    blenderExecutable,
                    "-b",
                    "-P", scriptFile.toString(),
                    "--", outputFile.toString()
            );

            // Redirect error stream or capture concurrently
            log.info("Spawning Blender process: {} -b -P {} -- {}", blenderExecutable, scriptFile, outputFile);
            Process process = pb.start();

            CompletableFuture<String> stdoutFuture = CompletableFuture.supplyAsync(() -> readStream(process.getInputStream()));
            CompletableFuture<String> stderrFuture = CompletableFuture.supplyAsync(() -> readStream(process.getErrorStream()));

            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);

            if (!finished) {
                process.destroyForcibly();
                throw new TimeoutException("Blender process exceeded timeout of " + timeoutSeconds + " seconds.");
            }

            int exitCode = process.exitValue();
            String stdout = stdoutFuture.get(5, TimeUnit.SECONDS);
            String stderr = stderrFuture.get(5, TimeUnit.SECONDS);
            long duration = System.currentTimeMillis() - startTime;

            log.info("Blender process finished with exit code {} in {}ms", exitCode, duration);

            // Validate generated binary file
            if (!Files.exists(outputFile) || Files.size(outputFile) == 0) {
                throw new IllegalStateException("Blender execution completed with exit code " + exitCode +
                        ", but expected asset was not generated or has zero bytes. Stderr: " + stderr);
            }

            long fileSize = Files.size(outputFile);
            log.info("Validated generated 3D asset: {} ({} bytes)", assetFileName, fileSize);

            // Check for rendered snapshot image
            Path snapshotFile = storagePath.resolve("kosh_" + assetId + ".png");
            String snapshotUrl = (Files.exists(snapshotFile) && Files.size(snapshotFile) > 0)
                    ? "/api/assets/kosh_" + assetId + ".png" : null;

            // Check for scene telemetry JSON
            Path telemetryFile = storagePath.resolve("kosh_" + assetId + ".json");
            Map<String, Object> telemetry = null;
            if (Files.exists(telemetryFile) && Files.size(telemetryFile) > 0) {
                try {
                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    telemetry = mapper.readValue(telemetryFile.toFile(), Map.class);
                } catch (Exception te) {
                    log.warn("Failed to parse telemetry JSON: {}", te.getMessage());
                }
            }

            return BlenderRunResult.builder()
                    .success(exitCode == 0)
                    .assetId(assetId)
                    .assetFileName(assetFileName)
                    .assetPath(outputFile)
                    .snapshotUrl(snapshotUrl)
                    .telemetry(telemetry)
                    .format(ext)
                    .sizeBytes(fileSize)
                    .stdout(stdout)
                    .stderr(stderr)
                    .exitCode(exitCode)
                    .executionTimeMs(duration)
                    .script(script)
                    .build();

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Blender execution error: {}", e.getMessage());
            return BlenderRunResult.builder()
                    .success(false)
                    .assetId(assetId)
                    .assetFileName(assetFileName)
                    .format(ext)
                    .sizeBytes(0)
                    .stdout("")
                    .stderr(e.getMessage())
                    .exitCode(-1)
                    .executionTimeMs(duration)
                    .script(script)
                    .errorMessage(e.getMessage())
                    .build();
        } finally {
            // Clean up temporary script
            try {
                Files.deleteIfExists(scriptFile);
            } catch (Exception ignored) {
            }
        }
    }

    private String readStream(InputStream inputStream) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            return sb.toString();
        } catch (Exception e) {
            return "Error reading process stream: " + e.getMessage();
        }
    }

    @Data
    @Builder
    public static class BlenderRunResult {
        private boolean success;
        private String assetId;
        private String assetFileName;
        private Path assetPath;
        private String snapshotUrl;
        private java.util.Map<String, Object> telemetry;
        private String format;
        private long sizeBytes;
        private String stdout;
        private String stderr;
        private int exitCode;
        private long executionTimeMs;
        private String script;
        private String errorMessage;
    }
}
