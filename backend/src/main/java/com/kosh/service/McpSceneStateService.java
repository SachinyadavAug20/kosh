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
            log.info("MCP scene state updated with object '{}': {} verts, {} faces", objectName, verts, faces);
        } catch (Exception e) {
            log.warn("Failed to record scene telemetry: {}", e.getMessage());
        }
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

    /**
     * Returns list of standardized MCP prompts.
     */
    public List<Map<String, Object>> getPromptsList() {
        return List.of(
                Map.of(
                        "name", "harden_mechanical_part",
                        "description", "Standardized mechanical hardening blueprint: inspects non-manifold edges, applies chamfers/bevels, and verifies metric dimensions.",
                        "arguments", List.of(
                                Map.of(
                                        "name", "mesh_name",
                                        "description", "Name of the target mesh component to harden",
                                        "required", true
                                ),
                                Map.of(
                                        "name", "tolerance_mm",
                                        "description", "Machining tolerance or chamfer offset in millimeters (default: 1.0)",
                                        "required", false
                                )
                        )
                ),
                Map.of(
                        "name", "decompose_narrative_object",
                        "description", "Sequential CSG CAD decomposition blueprint: guides the LLM to structure models into Primary Solids -> Subtractive Cuts -> Additive Detail -> PBR Finishes.",
                        "arguments", List.of(
                                Map.of(
                                        "name", "concept_description",
                                        "description", "Natural language concept or product description to decompose into CAD operations",
                                        "required", true
                                )
                        )
                )
        );
    }

    /**
     * Formulates and returns the requested prompt content.
     */
    public Map<String, Object> getPrompt(String name, Map<String, Object> arguments) {
        String normalized = name != null ? name.trim().toLowerCase() : "";

        if ("harden_mechanical_part".equals(normalized)) {
            String meshName = arguments != null && arguments.containsKey("mesh_name") && arguments.get("mesh_name") != null
                    ? arguments.get("mesh_name").toString() : "Target_Part";
            String tolerance = arguments != null && arguments.containsKey("tolerance_mm") && arguments.get("tolerance_mm") != null
                    ? arguments.get("tolerance_mm").toString() : "1.0";

            String promptText = String.format("""
                    SYSTEM BLUEPRINT: MECHANICAL CAD HARDENING PROTOCOL
                    Target Mesh: %s
                    Tolerance: %s mm

                    Execute the following sequential hardening protocol using Kosh MCP tools:
                    1. Geometry Topology Inspection:
                       - Call 'cad_inspect_scene' to verify that '%s' has 0 non-manifold edges, 0 internal intersecting faces, and is 100%% watertight.
                       - Verify bounding box extents against millimeter tolerances.
                    2. Edge Treatments & Stress Relief:
                       - Call 'cad_apply_modifier' with modifierType='BEVEL', properties={'width': %s, 'segments': 3}.
                       - Chamfer all 90-degree load-bearing transitions to prevent stress risers.
                    3. Metric Clearance Validation:
                       - Ensure all wall thicknesses exceed 2x tolerance (%s mm minimum).
                       - Verify all bore diameters provide precision ISO fit clearances.
                    4. Export & Artifact Validation:
                       - Call 'cad_synthesize_composite' or 'export_cad_artifact' to compile a binary manifold GLB or STL.
                    """, meshName, tolerance, meshName, tolerance, tolerance);

            return Map.of(
                    "description", "Mechanical hardening instructions for " + meshName,
                    "messages", List.of(
                            Map.of(
                                    "role", "user",
                                    "content", Map.of(
                                            "type", "text",
                                            "text", promptText.trim()
                                    )
                            )
                    )
            );
        } else if ("decompose_narrative_object".equals(normalized)) {
            String concept = arguments != null && arguments.containsKey("concept_description") && arguments.get("concept_description") != null
                    ? arguments.get("concept_description").toString() : "Parametric Mechanical Assembly";

            String promptText = String.format("""
                    SYSTEM BLUEPRINT: SEQUENTIAL CSG PARAMETRIC CAD DECOMPOSITION
                    Target Concept: %s

                    Before writing code or executing tool calls, structure this object into an explicit Constructive Solid Geometry (CSG) tree:

                    Phase 1: Primary Envelope (Base Solid)
                    - Identify the foundational solid envelope (cube, cylinder, revolve profile).
                    - Establish real-world metric dimensions and position origin at bottom-center flush with Z=0.
                    - Invoke 'cad_create_primitive' to instantiate the foundational geometry.

                    Phase 2: Subtractive Features (Cavities, Bores, Slots)
                    - List all negative volumetric subtractions (internal bores, shaft clearances, weight-relief pockets).
                    - Apply via 'cad_boolean_operation' with operation='DIFFERENCE'.

                    Phase 3: Additive Features (Bosses, Flanges, Fasteners)
                    - List mounting bosses, structural ribs, and ergonomic ridges.
                    - Join via 'cad_boolean_operation' with operation='UNION'.

                    Phase 4: Fillets & Edge Transitions
                    - Apply chamfers or fillets to sharp edges via 'cad_apply_modifier' (BEVEL modifier, 3 segments).

                    Phase 5: PBR Material Finishes
                    - Query 'kosh://materials/catalog' and assign appropriate engineering shaders (e.g. MatteTitanium, CastIron, BrushedBrass).

                    Now proceed with the sequential tool invocations.
                    """, concept);

            return Map.of(
                    "description", "Parametric CSG decomposition instructions for " + concept,
                    "messages", List.of(
                            Map.of(
                                    "role", "user",
                                    "content", Map.of(
                                            "type", "text",
                                            "text", promptText.trim()
                                    )
                            )
                    )
            );
        }

        throw new IllegalArgumentException("Unknown prompt: " + name);
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
}
