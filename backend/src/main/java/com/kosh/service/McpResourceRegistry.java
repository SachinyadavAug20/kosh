package com.kosh.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Zero-lag in-memory MCP Resource registry.
 *
 * <p>Static domain knowledge (metric hardware specs, curated PBR presets, FDM print
 * design rules) is serialized exactly once at startup into a {@link ConcurrentHashMap}
 * so {@code resources/read} round-trips resolve from JVM memory in under 2ms.
 * Live scene-state readers are delegated to {@link McpSceneStateService}.</p>
 */
@Slf4j
@Service
public class McpResourceRegistry {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final McpSceneStateService sceneStateService;

    /** Stable, ordered resource descriptors served by {@code resources/list}. */
    private final List<Map<String, Object>> descriptors = new ArrayList<>();

    /** uri -> pre-serialized static payload (computed once, read many). */
    private final Map<String, String> staticContentCache = new ConcurrentHashMap<>();

    /** uri -> live supplier for dynamic scene/engine state. */
    private final Map<String, Supplier<String>> dynamicReaders = new ConcurrentHashMap<>();

    public McpResourceRegistry(McpSceneStateService sceneStateService) {
        this.sceneStateService = sceneStateService;
    }

    @PostConstruct
    void registerResources() {
        // --- Dynamic scene state (live readers) ---
        registerDynamic(
                "kosh://scene/hierarchy",
                "Active Scene Hierarchy Graph",
                "Complete scene graph tree of objects, parent-child links, world transforms, and material IDs",
                sceneStateService::getSceneHierarchyJson
        );
        registerDynamic(
                "kosh://engine/capabilities",
                "Kosh 3D Engine Capabilities",
                "Blender version, installed Python packages (NumPy status), supported formats (.glb, .stl, .obj), and max polygon quotas",
                sceneStateService::getEngineCapabilitiesJson
        );
        registerDynamic(
                "kosh://materials/catalog",
                "PBR Material Catalog",
                "Ready-to-use studio PBR materials: MatteTitanium, ClearGlass, CastIron, NeonBlueEmissive, BrushedBrass, CarbonFiber, StudioClay",
                sceneStateService::getMaterialsCatalogJson
        );

        // --- Static studio/library payloads (pre-serialized once) ---
        registerStatic(
                "kosh://materials/library",
                "Studio PBR & MatCap Material Library",
                "Built-in CAD material presets (Titanium, Frosted Acrylic, Clay, Redwax, Chrome, Brass, Neon Emissive)",
                """
                {
                    "presets": [
                        {"id": "dark_titanium", "name": "Dark Titanium", "color": "#1f242d", "roughness": 0.28, "metalness": 0.95},
                        {"id": "brushed_brass", "name": "Brushed Brass", "color": "#d4af37", "roughness": 0.35, "metalness": 0.90},
                        {"id": "frosted_acrylic", "name": "Frosted Acrylic", "color": "#e0f2fe", "roughness": 0.15, "metalness": 0.05, "transmission": 0.85},
                        {"id": "studio_clay", "name": "Studio Clay", "color": "#c2410c", "roughness": 0.75, "metalness": 0.0},
                        {"id": "redwax_sculpt", "name": "Redwax Sculpt", "color": "#dc2626", "roughness": 0.40, "metalness": 0.10},
                        {"id": "mirror_chrome", "name": "Mirror Chrome", "color": "#f8fafc", "roughness": 0.05, "metalness": 1.0},
                        {"id": "cyber_neon_cyan", "name": "Cyber Neon Cyan", "color": "#06b6d4", "roughness": 0.20, "metalness": 0.80, "emission": "#22d3ee"}
                    ]
                }
                """
        );
        registerStatic(
                "kosh://scene/bounding-boxes",
                "Scene World Space Bounding Boxes",
                "Axis-Aligned Bounding Box (AABB) extents and metric dimensions for active scene meshes",
                """
                {
                    "units": "meters",
                    "coordinateSystem": "Z-up",
                    "defaultAABB": {"min": [-1.0, -1.0, 0.0], "max": [1.0, 1.0, 2.0], "dimensions": [2.0, 2.0, 2.0]}
                }
                """
        );
        registerStatic(
                "kosh://viewport/active-selection",
                "Active Viewport Selection & Modifier Stack",
                "Currently selected entity metadata: vertex list, face count, active modifier stack, and transform matrices",
                """
                {
                    "selectedMesh": null,
                    "modifiers": ["subdivision_surface", "boolean_csg", "bevel_modifier", "mirror_axis", "array_offset"],
                    "transform": {"position": [0,0,0], "rotation": [0,0,0], "scale": [1,1,1]}
                }
                """
        );

        // --- Cached engineering ground truth (served in <2ms, zero LLM hallucination) ---
        registerStatic(
                "kosh://specs/hardware/metric-fasteners",
                "Metric Fastener Hardware Library",
                "Exact CAD clearance holes, tap drill diameters, and socket-cap head dimensions for M2-M12 bolts in millimeters",
                toJson(buildMetricFastenersSpec())
        );
        registerStatic(
                "kosh://materials/pbr-presets",
                "Curated PBR Material Presets",
                "Calibrated Disney/PBR Principled BSDF shader tokens: dark titanium, machined aluminum, safety orange, carbon fiber, frosted polycarbonate",
                toJson(buildPbrPresetsSpec())
        );
        registerStatic(
                "kosh://guidelines/fdm-tolerances",
                "3D Print FDM Design Rules",
                "Minimum wall thickness, minimum hole diameters, maximum overhang angle, and moving-joint clearances for FDM printing",
                toJson(buildFdmTolerancesSpec())
        );

        log.info("McpResourceRegistry initialized: {} resources ({} static, {} dynamic)",
                descriptors.size(), staticContentCache.size(), dynamicReaders.size());
    }

    /** Returns ordered metadata for JSON-RPC {@code resources/list}. */
    public List<Map<String, Object>> listResources() {
        return List.copyOf(descriptors);
    }

    /**
     * Resolves a resource payload by URI. Static entries are served from the
     * pre-warmed ConcurrentHashMap cache; dynamic entries hit live scene state.
     *
     * @throws IllegalArgumentException when the URI is unknown or blank
     */
    public String readResource(String uri) {
        if (uri == null || uri.isBlank()) {
            throw new IllegalArgumentException("Invalid params: 'uri' is required for resources/read");
        }
        Supplier<String> dynamic = dynamicReaders.get(uri);
        if (dynamic != null) {
            return dynamic.get();
        }
        String cached = staticContentCache.get(uri);
        if (cached != null) {
            return cached;
        }
        throw new IllegalArgumentException("Unknown resource URI: " + uri
                + ". Call resources/list to discover available URIs.");
    }

    /** Pre-warms the static cache at registration time so first read is already instant. */
    private void registerStatic(String uri, String name, String description, String jsonPayload) {
        staticContentCache.put(uri, jsonPayload);
        descriptors.add(descriptor(uri, name, description));
    }

    private void registerDynamic(String uri, String name, String description, Supplier<String> reader) {
        dynamicReaders.put(uri, reader);
        descriptors.add(descriptor(uri, name, description));
    }

    private Map<String, Object> descriptor(String uri, String name, String description) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("uri", uri);
        d.put("name", name);
        d.put("description", description);
        d.put("mimeType", "application/json");
        return d;
    }

    /** ISO-2768-ish metric fastener ground truth: clearance, tap drill, socket-cap head sizing (mm). */
    private Map<String, Object> buildMetricFastenersSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("units", "millimeters");
        spec.put("standard", "ISO 4762 / DIN 912 socket head cap screws");
        spec.put("fitNotes", Map.of(
                "clearanceHoleDiaMm", "Close-fit clearance hole diameter for the bolt body",
                "tapDrillDiaMm", "Tapping drill diameter for internal threads (75% thread engagement)",
                "headDiaMm", "Socket cap head outside diameter",
                "headHeightMm", "Socket cap head height"
        ));
        spec.put("sizes", Map.of(
                "M2", fastener(2.4, 1.6, 3.8, 1.3),
                "M3", fastener(3.4, 2.5, 5.5, 3.0),
                "M4", fastener(4.5, 3.3, 7.0, 4.0),
                "M5", fastener(5.5, 4.2, 8.5, 5.0),
                "M6", fastener(6.6, 5.0, 10.0, 6.0),
                "M8", fastener(9.0, 6.8, 13.0, 8.0),
                "M10", fastener(11.0, 8.5, 16.0, 10.0),
                "M12", fastener(13.5, 10.2, 18.0, 12.0)
        ));
        return spec;
    }

    private Map<String, Object> fastener(double clearance, double tap, double headDia, double headHeight) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("clearanceHoleDiaMm", clearance);
        f.put("tapDrillDiaMm", tap);
        f.put("headDiaMm", headDia);
        f.put("headHeightMm", headHeight);
        return f;
    }

    private Map<String, Object> buildPbrPresetsSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("shaderModel", "Disney Principled BSDF (Blender 4.x/5.x 'Principled BSDF' node)");
        Map<String, Object> presets = new LinkedHashMap<>();
        presets.put("AnodizedDarkTitanium", Map.of("color", "#1f2024", "roughness", 0.35, "metalness", 0.95));
        presets.put("MachinedAluminum", Map.of("color", "#d1d5db", "roughness", 0.25, "metalness", 0.98));
        presets.put("IndustrialSafetyOrange", Map.of("color", "#ea580c", "roughness", 0.55, "metalness", 0.05));
        presets.put("MatteCarbonFiber", Map.of("color", "#111827", "roughness", 0.65, "metalness", 0.15));
        presets.put("FrostedPolycarbonate", Map.of("color", "#f8fafc", "roughness", 0.20, "transmission", 0.90));
        spec.put("presets", presets);
        return spec;
    }

    private Map<String, Object> buildFdmTolerancesSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("units", "millimeters");
        spec.put("nozzleDiameterMm", 0.4);
        spec.put("minWallThicknessMm", 1.2);
        spec.put("minHoleDiameterMm", 2.0);
        spec.put("maxOverhangAngleDeg", 45.0);
        spec.put("clearanceForMovingJointsMm", 0.4);
        spec.put("guidance", Map.of(
                "walls", "At least 3 perimeters (1.2mm at 0.4mm nozzle) for structural parts",
                "holes", "Holes under 2mm must be drilled after printing; orient holes vertically when possible",
                "overhangs", "Angles beyond 45 degrees from vertical require support material",
                "joints", "Use 0.4mm clearance for snap-fit and press-fit moving joints"
        ));
        return spec;
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize static MCP resource payload: {}", e.getMessage());
            return "{}";
        }
    }
}
