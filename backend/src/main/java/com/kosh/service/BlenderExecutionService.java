package com.kosh.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.InetSocketAddress;
import java.net.Socket;
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

    @Value("${blender.timeout-seconds:4}")
    private long timeoutSeconds;

    @Value("${app.storage.dir:storage}")
    private String storageDirProperty;

    @Value("${kosh.blender.daemon.enabled:true}")
    private boolean daemonEnabled;

    @Value("${kosh.blender.daemon.port:9091}")
    private int daemonPort;

    @Value("${kosh.blender.daemon.host:127.0.0.1}")
    private String daemonHost;

    private Path storagePath;
    private Process daemonProcess;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostConstruct
    public void init() {
        try {
            this.storagePath = Paths.get(storageDirProperty).toAbsolutePath().normalize();
            Files.createDirectories(this.storagePath);
            log.info("Initialized Kosh asset storage directory at: {}", this.storagePath);

            if (daemonEnabled) {
                CompletableFuture.runAsync(this::ensureDaemonStarted);
            }
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
        String requestedExt = (format != null) ? format.trim().toLowerCase() : "glb";
        String ext;
        if (java.util.Set.of("stl", "obj", "fbx", "usdz", "usd", "blend").contains(requestedExt)) {
            ext = requestedExt;
        } else {
            ext = "glb";
        }
        String assetId = UUID.randomUUID().toString().substring(0, 12);
        String assetFileName = "kosh_" + assetId + "." + ext;
        Path outputFile = storagePath.resolve(assetFileName);

        // Fix deprecation: mat.use_nodes = True -> safe node activation check
        // DeprecationWarning: 'Material.use_nodes' is expected to be removed in Blender 6.0
        String sanitizedScript = (script != null) ? script.replaceAll("(?m)^(\\s*)([a-zA-Z0-9_]+)\\.use_nodes\\s*=\\s*True\\b",
                "$1if hasattr($2, \"use_nodes\") and not $2.use_nodes:\n$1    $2.use_nodes = True") : "";

        // Tier 1: Warm Blender Daemon Execution (~400ms turnaround)
        if (daemonEnabled) {
            try {
                BlenderRunResult daemonResult = executeViaDaemon(sanitizedScript, ext, assetId, assetFileName, outputFile);
                if (daemonResult != null && daemonResult.isSuccess()) {
                    return daemonResult;
                }
            } catch (Exception e) {
                log.warn("Blender warm daemon execution failed or timed out: {}. Cascading to direct process with strict {}s timeout...",
                        e.getMessage(), timeoutSeconds);
            }
        }

        // Tier 2: Direct Process Execution with Strict 4s Timeout
        return executeViaDirectProcess(sanitizedScript, ext, assetId, assetFileName, outputFile);
    }

    private BlenderRunResult executeViaDaemon(String script, String ext, String assetId, String assetFileName, Path outputFile) throws Exception {
        if (!isDaemonAlive()) {
            ensureDaemonStarted();
            if (!isDaemonAlive()) {
                throw new IllegalStateException("Blender warm daemon is not reachable on " + daemonHost + ":" + daemonPort);
            }
        }

        long startTime = System.currentTimeMillis();
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(daemonHost, daemonPort), 1500);
            socket.setSoTimeout(4000); // Strict 4-second socket timeout

            Map<String, Object> req = Map.of(
                    "assetId", assetId,
                    "script", script,
                    "format", ext,
                    "outputPath", outputFile.toAbsolutePath().toString()
            );

            byte[] jsonBytes = objectMapper.writeValueAsBytes(req);
            DataOutputStream dos = new DataOutputStream(socket.getOutputStream());
            dos.writeInt(jsonBytes.length);
            dos.write(jsonBytes);
            dos.flush();

            DataInputStream dis = new DataInputStream(socket.getInputStream());
            int respLen = dis.readInt();
            byte[] respBytes = new byte[respLen];
            dis.readFully(respBytes);

            Map<String, Object> resp = objectMapper.readValue(respBytes, Map.class);
            boolean success = Boolean.TRUE.equals(resp.get("success"));
            long executionTimeMs = resp.containsKey("executionTimeMs")
                    ? ((Number) resp.get("executionTimeMs")).longValue()
                    : (System.currentTimeMillis() - startTime);

            Path effectiveOutputFile = outputFile;
            String effectiveExt = ext;
            String effectiveFileName = assetFileName;

            String respOut = resp.containsKey("outputPath") ? String.valueOf(resp.get("outputPath")) : null;
            String respFmt = resp.containsKey("format") ? String.valueOf(resp.get("format")) : null;

            if (respOut != null && respFmt != null) {
                Path returnedPath = Paths.get(respOut);
                if (Files.exists(returnedPath) && Files.size(returnedPath) > 0) {
                    effectiveOutputFile = returnedPath;
                    effectiveExt = respFmt.toLowerCase();
                    effectiveFileName = returnedPath.getFileName().toString();
                    if (!effectiveExt.equalsIgnoreCase(ext)) {
                        log.info("Blender daemon used fallback export format: {} -> {}", ext, effectiveExt);
                    }
                }
            }

            if (!Files.exists(effectiveOutputFile) || Files.size(effectiveOutputFile) == 0) {
                Path fallbackObj = storagePath.resolve("kosh_" + assetId + ".obj");
                Path fallbackStl = storagePath.resolve("kosh_" + assetId + ".stl");
                if (Files.exists(fallbackObj) && Files.size(fallbackObj) > 0) {
                    effectiveOutputFile = fallbackObj;
                    effectiveExt = "obj";
                    effectiveFileName = "kosh_" + assetId + ".obj";
                    log.info("Recovered emergency fallback OBJ from disk: {}", fallbackObj);
                } else if (Files.exists(fallbackStl) && Files.size(fallbackStl) > 0) {
                    effectiveOutputFile = fallbackStl;
                    effectiveExt = "stl";
                    effectiveFileName = "kosh_" + assetId + ".stl";
                    log.info("Recovered emergency fallback STL from disk: {}", fallbackStl);
                }
            }

            if (!success || !Files.exists(effectiveOutputFile) || Files.size(effectiveOutputFile) == 0) {
                String err = resp.containsKey("errorMessage") ? String.valueOf(resp.get("errorMessage")) : "Asset not written";
                log.warn("Blender daemon generation unsuccessful: {}", err);
                return BlenderRunResult.builder()
                        .success(false)
                        .assetId(assetId)
                        .assetFileName(effectiveFileName)
                        .format(effectiveExt)
                        .executionTimeMs(executionTimeMs)
                        .errorMessage(err)
                        .stderr(err)
                        .build();
            }

            long fileSize = Files.size(effectiveOutputFile);
            Map<String, Object> telemetry = resp.containsKey("telemetry") ? (Map<String, Object>) resp.get("telemetry") : null;
            String stdout = resp.containsKey("stdout") ? String.valueOf(resp.get("stdout")) : "";
            String stderr = resp.containsKey("stderr") ? String.valueOf(resp.get("stderr")) : "";

            Path snapshotFile = storagePath.resolve("kosh_" + assetId + ".png");
            String snapshotUrl = (Files.exists(snapshotFile) && Files.size(snapshotFile) > 0)
                    ? "/api/assets/kosh_" + assetId + ".png" : null;

            log.info("Blender warm daemon generated asset in {}ms: {} ({} bytes)", executionTimeMs, effectiveFileName, fileSize);

            return BlenderRunResult.builder()
                    .success(true)
                    .assetId(assetId)
                    .assetFileName(effectiveFileName)
                    .assetPath(effectiveOutputFile)
                    .snapshotUrl(snapshotUrl)
                    .telemetry(telemetry)
                    .format(effectiveExt)
                    .sizeBytes(fileSize)
                    .stdout(stdout)
                    .stderr(stderr)
                    .exitCode(0)
                    .executionTimeMs(executionTimeMs)
                    .script(script)
                    .build();
        }
    }

    private BlenderRunResult executeViaDirectProcess(String script, String ext, String assetId, String assetFileName, Path outputFile) {
        Path scriptFile = storagePath.resolve("script_" + assetId + ".py");
        long startTime = System.currentTimeMillis();

        try {
            String executableScript = script;
            boolean hasExport = script.contains("export_scene.gltf") ||
                    script.contains("save_as_mainfile") ||
                    script.contains("wm.stl_export") ||
                    script.contains("export_mesh.stl") ||
                    script.contains("obj_export") ||
                    script.contains("export_scene.obj") ||
                    script.contains("export_scene.fbx") ||
                    script.contains("usd_export");

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
                        
                        if _out.lower().endsWith(".blend"):
                            try:
                                bpy.ops.wm.save_as_mainfile(filepath=_out)
                            except Exception as _be:
                                print(f"Error saving blend file: {_be}")
                        elif _out.lower().endsWith(".stl"):
                            try:
                                bpy.ops.wm.stl_export(filepath=_out)
                            except Exception:
                                bpy.ops.export_mesh.stl(filepath=_out)
                        elif _out.lower().endsWith(".obj"):
                            try:
                                bpy.ops.wm.obj_export(filepath=_out)
                            except Exception:
                                bpy.ops.export_scene.obj(filepath=_out)
                        elif _out.lower().endsWith(".fbx"):
                            try:
                                bpy.ops.export_scene.fbx(filepath=_out)
                            except Exception:
                                pass
                        elif _out.lower().endsWith(".usdz") or _out.lower().endsWith(".usd"):
                            try:
                                bpy.ops.wm.usd_export(filepath=_out)
                            except Exception:
                                pass
                        else:
                            try:
                                import numpy
                            except ImportError:
                                import sys, subprocess
                                try:
                                    subprocess.check_call([sys.executable, "-m", "pip", "install", "numpy"])
                                except Exception as _ne:
                                    print(f"Failed to auto-install numpy: {_ne}", file=sys.stderr)
                            
                            try:
                                bpy.ops.export_scene.gltf(filepath=_out, export_format='GLB', export_animations=True)
                            except Exception as _ge:
                                print(f"GLTF export failed: {_ge}, falling back to OBJ", file=sys.stderr)
                                _obj_out = _out.replace(".glb", ".obj")
                                try:
                                    if hasattr(bpy.ops.wm, "obj_export"):
                                        bpy.ops.wm.obj_export(filepath=_obj_out)
                                    elif hasattr(bpy.ops.export_scene, "obj"):
                                        bpy.ops.export_scene.obj(filepath=_obj_out)
                                except Exception:
                                    _stl_out = _out.replace(".glb", ".stl")
                                    try:
                                        if hasattr(bpy.ops.wm, "stl_export"):
                                            bpy.ops.wm.stl_export(filepath=_stl_out)
                                        else:
                                            bpy.ops.export_mesh.stl(filepath=_stl_out)
                                    except Exception:
                                        pass
                    """;
                executableScript = executableScript + "\n" + autoExport;
            }

            Files.writeString(scriptFile, executableScript, StandardCharsets.UTF_8);

            ProcessBuilder pb = new ProcessBuilder(
                    blenderExecutable,
                    "-b",
                    "-P", scriptFile.toString(),
                    "--", outputFile.toString()
            );

            log.info("Spawning direct Blender process with strict {}s timeout: {}", timeoutSeconds, scriptFile);
            Process process = pb.start();

            CompletableFuture<String> stdoutFuture = CompletableFuture.supplyAsync(() -> readStream(process.getInputStream()));
            CompletableFuture<String> stderrFuture = CompletableFuture.supplyAsync(() -> readStream(process.getErrorStream()));

            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);

            if (!finished) {
                process.destroyForcibly();
                throw new TimeoutException("Direct Blender process exceeded strict timeout of " + timeoutSeconds + " seconds.");
            }

            int exitCode = process.exitValue();
            String stdout = stdoutFuture.get(2, TimeUnit.SECONDS);
            String stderr = stderrFuture.get(2, TimeUnit.SECONDS);
            long duration = System.currentTimeMillis() - startTime;

            Path effectiveOutputFile = outputFile;
            String effectiveExt = ext;
            String effectiveFileName = assetFileName;

            if (!Files.exists(effectiveOutputFile) || Files.size(effectiveOutputFile) == 0) {
                Path fallbackObj = storagePath.resolve("kosh_" + assetId + ".obj");
                Path fallbackStl = storagePath.resolve("kosh_" + assetId + ".stl");
                if (Files.exists(fallbackObj) && Files.size(fallbackObj) > 0) {
                    effectiveOutputFile = fallbackObj;
                    effectiveExt = "obj";
                    effectiveFileName = "kosh_" + assetId + ".obj";
                    log.info("Direct process fallback OBJ used: {}", fallbackObj);
                } else if (Files.exists(fallbackStl) && Files.size(fallbackStl) > 0) {
                    effectiveOutputFile = fallbackStl;
                    effectiveExt = "stl";
                    effectiveFileName = "kosh_" + assetId + ".stl";
                    log.info("Direct process fallback STL used: {}", fallbackStl);
                } else {
                    throw new IllegalStateException("Blender execution completed with exit code " + exitCode +
                            ", but expected asset was not generated. Stderr: " + stderr);
                }
            }

            long fileSize = Files.size(effectiveOutputFile);
            Path snapshotFile = storagePath.resolve("kosh_" + assetId + ".png");
            String snapshotUrl = (Files.exists(snapshotFile) && Files.size(snapshotFile) > 0)
                    ? "/api/assets/kosh_" + assetId + ".png" : null;

            Path telemetryFile = storagePath.resolve("kosh_" + assetId + ".json");
            Map<String, Object> telemetry = null;
            if (Files.exists(telemetryFile) && Files.size(telemetryFile) > 0) {
                try {
                    telemetry = objectMapper.readValue(telemetryFile.toFile(), Map.class);
                } catch (Exception te) {
                    log.warn("Failed to parse telemetry JSON: {}", te.getMessage());
                }
            }

            return BlenderRunResult.builder()
                    .success(exitCode == 0)
                    .assetId(assetId)
                    .assetFileName(effectiveFileName)
                    .assetPath(effectiveOutputFile)
                    .snapshotUrl(snapshotUrl)
                    .telemetry(telemetry)
                    .format(effectiveExt)
                    .sizeBytes(fileSize)
                    .stdout(stdout)
                    .stderr(stderr)
                    .exitCode(exitCode)
                    .executionTimeMs(duration)
                    .script(script)
                    .build();

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.warn("Direct Blender process error or timeout ({}ms): {}", duration, e.getMessage());
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
            try {
                Files.deleteIfExists(scriptFile);
            } catch (Exception ignored) {
            }
        }
    }

    public boolean isDaemonAlive() {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(daemonHost, daemonPort), 400);
            socket.setSoTimeout(600);
            DataOutputStream dos = new DataOutputStream(socket.getOutputStream());
            byte[] ping = "{\"action\":\"ping\"}".getBytes(StandardCharsets.UTF_8);
            dos.writeInt(ping.length);
            dos.write(ping);
            dos.flush();

            DataInputStream dis = new DataInputStream(socket.getInputStream());
            int len = dis.readInt();
            byte[] buf = new byte[len];
            dis.readFully(buf);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private synchronized void ensureDaemonStarted() {
        if (isDaemonAlive()) return;
        if (!isBlenderAvailable()) {
            log.warn("Blender executable '{}' is not available. Warm daemon cannot start.", blenderExecutable);
            return;
        }

        try {
            Path daemonScript = storagePath.resolve("blender_daemon.py");
            try (InputStream is = getClass().getResourceAsStream("/scripts/blender_daemon.py")) {
                if (is != null) {
                    Files.copy(is, daemonScript, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }
            }

            if (!Files.exists(daemonScript)) {
                log.warn("blender_daemon.py not found at {}", daemonScript);
                return;
            }

            log.info("Starting persistent warm Blender daemon on {}:{}", daemonHost, daemonPort);
            ProcessBuilder pb = new ProcessBuilder(
                    blenderExecutable,
                    "-b",
                    "--python", daemonScript.toString(),
                    "--",
                    "--host", daemonHost,
                    "--port", String.valueOf(daemonPort)
            );
            pb.redirectErrorStream(true);
            this.daemonProcess = pb.start();

            CompletableFuture.runAsync(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(daemonProcess.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (line.contains("KOSH_BLENDER_DAEMON_READY")) {
                            log.info("Blender daemon worker is ready: {}", line);
                        } else {
                            log.debug("[Blender Daemon] {}", line);
                        }
                    }
                } catch (Exception ignored) {
                }
            });

            for (int i = 0; i < 20; i++) {
                if (isDaemonAlive()) {
                    log.info("Warm Blender daemon successfully connected on port {}", daemonPort);
                    return;
                }
                Thread.sleep(200);
            }
        } catch (Exception e) {
            log.warn("Failed to launch Blender daemon: {}", e.getMessage());
        }
    }

    @PreDestroy
    public void cleanup() {
        if (daemonProcess != null && daemonProcess.isAlive()) {
            log.info("Shutting down Blender daemon process...");
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(daemonHost, daemonPort), 500);
                DataOutputStream dos = new DataOutputStream(socket.getOutputStream());
                byte[] req = "{\"action\":\"shutdown\"}".getBytes(StandardCharsets.UTF_8);
                dos.writeInt(req.length);
                dos.write(req);
                dos.flush();
            } catch (Exception ignored) {
            }
            daemonProcess.destroy();
            try {
                daemonProcess.waitFor(2, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {
            }
            if (daemonProcess.isAlive()) {
                daemonProcess.destroyForcibly();
            }
        }
    }

    /**
     * Converts raw GLB scene bytes into a native .blend mainfile using headless Blender.
     */
    public Path convertGlbToBlend(byte[] glbBytes, String baseName) throws IOException, InterruptedException {
        String assetId = UUID.randomUUID().toString().substring(0, 12);
        String name = (baseName != null && !baseName.isBlank())
                ? baseName.replaceAll("[^a-zA-Z0-9_\\-]", "_")
                : "kosh_scene_" + assetId;
        Path tempGlb = storagePath.resolve("temp_" + assetId + ".glb");
        Path outputBlend = storagePath.resolve(name + ".blend");
        Path convertScript = storagePath.resolve("convert_" + assetId + ".py");

        Files.write(tempGlb, glbBytes);

        String pythonScript = """
            import bpy, sys
            argv = sys.argv
            glb_path = argv[argv.index("--") + 1]
            blend_path = argv[argv.index("--") + 2]
            
            # Reset factory scene to clear default cube/lights
            bpy.ops.wm.read_factory_settings(use_empty=True)
            
            # Import GLTF / GLB scene
            bpy.ops.import_scene.gltf(filepath=glb_path)
            
            # Ensure studio camera and light exist if scene is empty of them
            has_camera = any(o.type == 'CAMERA' for o in bpy.data.objects)
            if not has_camera:
                cam_data = bpy.data.cameras.new(name="Camera")
                cam_obj = bpy.data.objects.new("Camera", cam_data)
                bpy.context.collection.objects.link(cam_obj)
                cam_obj.location = (4.0, -4.0, 3.0)
                cam_obj.rotation_euler = (1.1, 0.0, 0.785)
                bpy.context.scene.camera = cam_obj
                
            has_light = any(o.type == 'LIGHT' for o in bpy.data.objects)
            if not has_light:
                light_data = bpy.data.lights.new(name="Studio_Sun", type='SUN')
                light_data.energy = 3.5
                light_obj = bpy.data.objects.new("Studio_Sun", light_data)
                bpy.context.collection.objects.link(light_obj)
                light_obj.location = (5.0, -5.0, 8.0)
                light_obj.rotation_euler = (0.785, 0.3, 0.5)

            # Save full native .blend mainfile
            bpy.ops.wm.save_as_mainfile(filepath=blend_path)
            """;

        Files.writeString(convertScript, pythonScript);

        ProcessBuilder pb = new ProcessBuilder(
                blenderExecutable,
                "-b",
                "-P", convertScript.toString(),
                "--", tempGlb.toString(), outputBlend.toString()
        );
        Process process = pb.start();
        boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new RuntimeException("Blender GLB to BLEND conversion timed out");
        }

        try {
            Files.deleteIfExists(tempGlb);
            Files.deleteIfExists(convertScript);
        } catch (Exception ignored) {}

        if (!Files.exists(outputBlend) || Files.size(outputBlend) == 0) {
            throw new RuntimeException("Failed to generate .blend file from GLB");
        }

        return outputBlend;
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
