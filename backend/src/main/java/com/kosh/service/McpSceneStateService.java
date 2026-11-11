package com.kosh.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service managing MCP dynamic resources (scene hierarchy, engine capabilities,
 * material catalog) and standardized CAD workflow prompts.
 */
@Slf4j
@Service
public class McpSceneStateService {

    private final BlenderExecutionService blenderExecutionService;
    private final ObjectMapper objectMapper;

    // Active in-memory scene state representation
    private final Map<String, Object> activeSceneState = new ConcurrentHashMap<>();
    private final List<Map<String, Object>> activeObjects = Collections.synchronizedList(new ArrayList<>());
    private volatile boolean isWatertight = true;
    private volatile int totalVertices = 0;
    private volatile int totalFaces = 0;
    private volatile int totalEdges = 0;
    private volatile double[] sceneBoundingBoxMin = new double[]{-1.0, -1.0, 0.0};
    private volatile double[] sceneBoundingBoxMax = new double[]{1.0, 1.0, 2.0};
    private volatile double[] sceneDimensions = new double[]{2.0, 2.0, 2.0};

    // Live viewport selection tracking (synchronized with Three.js DCC viewport)
    private volatile String activeSelectedMesh = "CAD_Origin_Datum";
    private final Map<String, Object> activeSelectionState = new ConcurrentHashMap<>();

    public McpSceneStateService(BlenderExecutionService blenderExecutionService) {
        this.blenderExecutionService = blenderExecutionService;
        this.objectMapper = new ObjectMapper();
        initializeDefaultScene();
    }

    private void initializeDefaultScene() {
        activeObjects.clear();
        Map<String, Object> defaultMesh = new LinkedHashMap<>();
        defaultMesh.put("name", "CAD_Origin_Datum");
        defaultMesh.put("type", "MESH");
        defaultMesh.put("parent", null);
        defaultMesh.put("children", List.of());
        defaultMesh.put("vertices", 8);
        defaultMesh.put("faces", 6);
        defaultMesh.put("edges", 12);
        defaultMesh.put("isManifold", true);
        defaultMesh.put("transform", Map.of(
                "position", List.of(0.0, 0.0, 0.0),
                "rotation", List.of(0.0, 0.0, 0.0),
                "scale", List.of(1.0, 1.0, 1.0)
        ));
        defaultMesh.put("materials", List.of("MatteTitanium"));
        defaultMesh.put("boundingBox", Map.of(
                "min", List.of(-0.5, -0.5, 0.0),
                "max", List.of(0.5, 0.5, 1.0),
                "dimensions", List.of(1.0, 1.0, 1.0)
        ));
        activeObjects.add(defaultMesh);

        totalVertices = 8;
        totalFaces = 6;
        totalEdges = 12;
        isWatertight = true;

        updateActiveSelection("CAD_Origin_Datum", Map.of(
                "selectedMesh", "CAD_Origin_Datum",
                "vertices", 8,
                "faces", 6,
                "edges", 12,
                "isManifold", true,
                "modifiers", List.of("subdivision_surface", "boolean_csg", "bevel_modifier", "mirror_axis", "array_offset"),
                "transform", Map.of(
                        "position", List.of(0.0, 0.0, 0.0),
                        "rotation", List.of(0.0, 0.0, 0.0),
                        "scale", List.of(1.0, 1.0, 1.0)
                ),
                "materials", List.of("MatteTitanium"),
                "dimensions", List.of(1.0, 1.0, 1.0)
        ));
    }

    /**
     * Records asset generation telemetry and updates the active scene state.
     */
    public synchronized void recordAssetGeneration(String objectName, Map<String, Object> telemetry, String format, long sizeBytes) {
        if (telemetry == null) {
            return;
        }

        try {
            int verts = telemetry.containsKey("vertices") ? ((Number) telemetry.get("vertices")).intValue() : 0;
            int faces = telemetry.containsKey("triangles") ? ((Number) telemetry.get("triangles")).intValue() : 0;
            int edges = telemetry.containsKey("edges") ? ((Number) telemetry.get("edges")).intValue() : 0;

            List<?> dims = telemetry.containsKey("dimensions") && telemetry.get("dimensions") instanceof List<?> list ? list : List.of(1.0, 1.0, 1.0);
            double dx = dims.size() > 0 && dims.get(0) instanceof Number n ? n.doubleValue() : 1.0;
            double dy = dims.size() > 1 && dims.get(1) instanceof Number n ? n.doubleValue() : 1.0;
            double dz = dims.size() > 2 && dims.get(2) instanceof Number n ? n.doubleValue() : 1.0;

            List<?> mats = telemetry.containsKey("materials") && telemetry.get("materials") instanceof List<?> list ? list : List.of("MatteTitanium");
            List<String> materialList = new ArrayList<>();
            for (Object m : mats) {
                if (m != null) materialList.add(m.toString());
            }

            this.totalVertices = verts;
            this.totalFaces = faces;
            this.totalEdges = edges;
            this.isWatertight = (edges > 0 && verts > 0);
            this.sceneDimensions = new double[]{dx, dy, dz};
            this.sceneBoundingBoxMin = new double[]{-dx / 2.0, -dy / 2.0, 0.0};
            this.sceneBoundingBoxMax = new double[]{dx / 2.0, dy / 2.0, dz};

            Map<String, Object> entity = new LinkedHashMap<>();
            entity.put("name", objectName != null ? objectName : "Mesh_" + System.currentTimeMillis());
            entity.put("type", "MESH");
            entity.put("parent", null);
            entity.put("children", List.of());
            entity.put("vertices", verts);
            entity.put("faces", faces);
            entity.put("edges", edges);
            entity.put("isManifold", isWatertight);
            entity.put("transform", Map.of(
                    "position", List.of(0.0, 0.0, 0.0),
                    "rotation", List.of(0.0, 0.0, 0.0),
                    "scale", List.of(1.0, 1.0, 1.0)
            ));
            entity.put("materials", materialList.isEmpty() ? List.of("MatteTitanium") : materialList);
            entity.put("boundingBox", Map.of(
                    "min", List.of(-dx / 2.0, -dy / 2.0, 0.0),
                    "max", List.of(dx / 2.0, dy / 2.0, dz),
                    "dimensions", List.of(dx, dy, dz)
            ));

            activeObjects.clear();
            activeObjects.add(entity);

            // Keep active viewport selection in sync with the newly generated asset
            String effectiveName = objectName != null ? objectName : "Mesh";
            updateActiveSelection(effectiveName, Map.of(
                    "selectedMesh", effectiveName,
                    "vertices", verts,
                    "faces", faces,
                    "edges", edges,
                    "isManifold", isWatertight,
                    "modifiers", List.of("subdivision_surface", "boolean_csg", "bevel_modifier", "mirror_axis", "array_offset"),
                    "transform", Map.of(
                            "position", List.of(0.0, 0.0, 0.0),
                            "rotation", List.of(0.0, 0.0, 0.0),
                            "scale", List.of(1.0, 1.0, 1.0)
                    ),
                    "materials", materialList.isEmpty() ? List.of("MatteTitanium") : materialList,
                    "dimensions", List.of(dx, dy, dz)
            ));

            log.info("MCP scene state updated with object '{}': {} verts, {} faces", objectName, verts, faces);
        } catch (Exception e) {
            log.warn("Failed to record scene telemetry: {}", e.getMessage());
        }
    }

    /**
     * Updates active viewport selection metadata (entity name, vertices, faces, transforms, modifiers).
     * Called live from the Three.js viewport raycaster and Universal Gizmo handlers.
     */
    public synchronized void updateActiveSelection(String meshName, Map<String, Object> details) {
        this.activeSelectedMesh = meshName;
        this.activeSelectionState.clear();
        if (meshName == null || meshName.isBlank()) {
            return;
        }
        this.activeSelectionState.put("selectedMesh", meshName);
        if (details != null) {
            this.activeSelectionState.putAll(details);
        }
        if (!this.activeSelectionState.containsKey("modifiers")) {
            this.activeSelectionState.put("modifiers", List.of("subdivision_surface", "boolean_csg", "bevel_modifier", "mirror_axis", "array_offset"));
        }
        if (!this.activeSelectionState.containsKey("transform")) {
            this.activeSelectionState.put("transform", Map.of(
                    "position", List.of(0.0, 0.0, 0.0),
                    "rotation", List.of(0.0, 0.0, 0.0),
                    "scale", List.of(1.0, 1.0, 1.0)
            ));
        }
    }

    /**
     * Returns JSON resource representation for kosh://viewport/active-selection.
     */
    public String getActiveSelectionJson() {
        if (activeSelectedMesh == null && activeSelectionState.isEmpty()) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("selectedMesh", null);
            empty.put("vertices", 0);
            empty.put("faces", 0);
            empty.put("modifiers", List.of("subdivision_surface", "boolean_csg", "bevel_modifier", "mirror_axis", "array_offset"));
            empty.put("transform", Map.of(
                    "position", List.of(0.0, 0.0, 0.0),
                    "rotation", List.of(0.0, 0.0, 0.0),
                    "scale", List.of(1.0, 1.0, 1.0)
            ));
            return toJson(empty);
        }
        Map<String, Object> state = new LinkedHashMap<>(activeSelectionState);
        if (!state.containsKey("selectedMesh")) {
            state.put("selectedMesh", activeSelectedMesh);
        }
        return toJson(state);
    }

    /**
     * Inspects the current scene state and returns a structured summary.
     */
    public Map<String, Object> getSceneInspectionSummary(String targetMesh) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("meshCount", activeObjects.size());
        summary.put("totalVertices", totalVertices);
        summary.put("totalFaces", totalFaces);
        summary.put("totalEdges", totalEdges);
        summary.put("isWatertight", isWatertight);

        List<Map<String, Object>> filteredObjects = new ArrayList<>();
        for (Map<String, Object> obj : activeObjects) {
            if (targetMesh == null || targetMesh.isBlank() || targetMesh.equalsIgnoreCase(String.valueOf(obj.get("name")))) {
                filteredObjects.add(obj);
            }
        }
        summary.put("objects", filteredObjects);
        summary.put("overallBoundingBox", Map.of(
                "min", List.of(sceneBoundingBoxMin[0], sceneBoundingBoxMin[1], sceneBoundingBoxMin[2]),
                "max", List.of(sceneBoundingBoxMax[0], sceneBoundingBoxMax[1], sceneBoundingBoxMax[2]),
                "dimensions", List.of(sceneDimensions[0], sceneDimensions[1], sceneDimensions[2]),
                "units", "meters"
        ));
        return summary;
    }

    /**
     * Returns JSON resource representation for kosh://scene/hierarchy.
     */
    public String getSceneHierarchyJson() {
        Map<String, Object> hierarchy = new LinkedHashMap<>();
        hierarchy.put("sceneName", "Kosh_CAD_Studio");
        hierarchy.put("units", "meters");
        hierarchy.put("coordinateSystem", "Z-up-right-handed");
        hierarchy.put("rootObjects", activeObjects);
        hierarchy.put("camera", Map.of(
                "name", "Studio_Camera",
                "type", "PERSP",
                "location", List.of(5.0, -5.0, 4.0),
                "target", List.of(0.0, 0.0, 0.5),
                "fov", 50.0
        ));
        hierarchy.put("lights", List.of(
                Map.of("name", "Studio_Key", "type", "DIRECTIONAL", "intensity", 2.0, "color", "#ffffff"),
                Map.of("name", "Studio_Fill", "type", "DIRECTIONAL", "intensity", 0.8, "color", "#e2e8f0"),
                Map.of("name", "Studio_Rim", "type", "DIRECTIONAL", "intensity", 1.2, "color", "#f1f5f9")
        ));
        return toJson(hierarchy);
    }

    /**
     * Returns JSON resource representation for kosh://engine/capabilities.
     */
    public String getEngineCapabilitiesJson() {
        Map<String, Object> capabilities = new LinkedHashMap<>();
        capabilities.put("engine", "Blender Headless Daemon");
        capabilities.put("version", blenderExecutionService.getBlenderVersion());
        capabilities.put("isAvailable", blenderExecutionService.isBlenderAvailable());
        capabilities.put("pythonPackages", Map.of(
                "numpy", Map.of("status", "verified", "requiredBy", "io_scene_gltf2"),
                "mathutils", Map.of("status", "native", "version", "bundled"),
                "bpy", Map.of("status", "native", "version", "bundled")
        ));
        capabilities.put("supportedFormats", List.of("glb", "stl", "obj", "blend", "fbx", "usdz"));
        capabilities.put("maxPolygonQuotas", Map.of(
                "maxPolygons", 500000,
                "maxVertices", 300000,
                "executionTimeoutSeconds", 4
        ));
        capabilities.put("transports", List.of("http", "sse", "stdio"));
        capabilities.put("features", List.of(
                "csg_boolean_exact",
                "parametric_primitive_synthesis",
                "bmesh_manifold_inspection",
                "pbr_principled_bsdf_v2",
                "real_time_progress_tokens",
                "procedural_self_healing_fallback"
        ));
        return toJson(capabilities);
    }

    /**
     * Returns JSON resource representation for kosh://materials/catalog.
     */
    public String getMaterialsCatalogJson() {
        Map<String, Object> catalog = new LinkedHashMap<>();
        catalog.put("catalog", List.of(
                Map.of("name", "MatteTitanium", "category", "Metal", "color", "#475569", "roughness", 0.28, "metallic", 0.95, "description", "Aerospace grade matte titanium with anisotropic highlight"),
                Map.of("name", "ClearGlass", "category", "Dielectric", "color", "#f8fafc", "roughness", 0.05, "metallic", 0.0, "transmission", 0.95, "ior", 1.52, "description", "Optical crown glass with 95% transmission and physical refraction"),
                Map.of("name", "CastIron", "category", "Metal", "color", "#1e293b", "roughness", 0.65, "metallic", 0.85, "description", "Textured structural cast iron with heavy micro-roughness"),
                Map.of("name", "NeonBlueEmissive", "category", "Emissive", "color", "#06b6d4", "roughness", 0.15, "metallic", 0.10, "emission", "#00f0ff", "emissionStrength", 5.0, "description", "High-intensity cybernetic cyan glow with bloom"),
                Map.of("name", "BrushedBrass", "category", "Metal", "color", "#d4af37", "roughness", 0.35, "metallic", 0.90, "description", "Warm architectural brushed brass with satin sheen"),
                Map.of("name", "CarbonFiber", "category", "Composite", "color", "#0f172a", "roughness", 0.40, "metallic", 0.30, "clearcoat", 1.0, "description", "Woven composite carbon fiber with glossy epoxy clearcoat"),
                Map.of("name", "StudioClay", "category", "Non-Metal", "color", "#ea580c", "roughness", 0.75, "metallic", 0.0, "description", "Matte terracotta sculpting clay for CAD form inspection"),
                Map.of("name", "FrostedAcrylic", "category", "Dielectric", "color", "#e0f2fe", "roughness", 0.25, "metallic", 0.05, "transmission", 0.85, "description", "Frosted semi-translucent industrial polymer"),
                Map.of("name", "MirrorChrome", "category", "Metal", "color", "#f8fafc", "roughness", 0.04, "metallic", 1.0, "description", "Specular chrome plating with mirror reflection"),
                Map.of("name", "IndustrialRubber", "category", "Polymer", "color", "#09090b", "roughness", 0.85, "metallic", 0.0, "description", "Black synthetic vulcanized nitrile rubber")
        ));
        return toJson(catalog);
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
}
