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
        registerStatic(
                "kosh://library/modular-models",
                "Modular Low-Poly 3D Model Catalog",
                "Instant procedural low-poly entities and compound scene composer presets (Cat, Dog, Elephant, Astronaut, Car, Spaceship, Compound Space Scenes)",
                """
                {
                    "categories": {
                        "animals": [
                            {"id": "cat", "name": "Ginger Tabby Cat", "parts": ["body", "head", "ears", "snout", "paws", "tail", "bell_collar"]},
                            {"id": "dog", "name": "Golden Retriever Dog", "parts": ["body", "head", "snout", "nose", "floppy_ears", "paws", "wagging_tail", "tag_collar"]},
                            {"id": "elephant", "name": "Majestic Elephant", "parts": ["barrel_body", "head", "fan_ears", "segmented_trunk", "ivory_tusks", "pillar_legs", "tufted_tail"]}
                        ],
                        "characters": [
                            {"id": "astronaut", "name": "Apollo EVA Astronaut", "parts": ["spacesuit_torso", "gold_bubble_visor", "plss_backpack", "oxygen_tanks", "moon_boots"]}
                        ],
                        "environments": [
                            {"id": "space", "name": "Cosmic Space", "elements": ["lunar_asteroid_pedestal", "craters", "planetary_dust_ring", "orbiting_crystals"]},
                            {"id": "studio", "name": "Photo Studio CAD", "elements": ["custom_grid", "backdrop", "3_point_lighting"]}
                        ],
                        "compound_presets": [
                            {"id": "cat_in_space", "prompt": "generate a cat in space", "composition": "Ginger cat with astronaut glass helmet on cratered lunar asteroid encircled by planetary dust ring and crystals"},
                            {"id": "dog_on_moon", "prompt": "dog on moon", "composition": "Golden retriever with bubble helmet on lunar pedestal with orbiting cosmic crystals"},
                            {"id": "elephant_in_orbit", "prompt": "elephant in space", "composition": "Majestic elephant with custom helmet on celestial rock"}
                        ]
                    }
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
        registerStatic(
                "kosh://specs/engineering/stepper-motors",
                "NEMA Stepper Motor Specifications",
                "Standard CAD dimensions, faceplate widths, mounting hole PCDs, pilot bosses, and shaft diameters for NEMA 14, 17, 23, and 34 motors",
                toJson(buildStepperMotorsSpec())
        );
        registerStatic(
                "kosh://specs/standards/iso-bearings",
                "ISO Deep Groove Ball Bearings",
                "Standard bearing dimensions (bore d, outer D, width B) and dynamic load ratings for 608, 623, 624, 625, 688, and 6900 series",
                toJson(buildIsoBearingsSpec())
        );
        registerStatic(
                "kosh://guidelines/sla-resin-tolerances",
                "SLA and DLP Photopolymer Resin Design Rules",
                "Minimum wall thickness, escape hole diameters, suction-cup prevention, and support overhang thresholds for resin 3D printing",
                toJson(buildSlaResinTolerancesSpec())
        );
        registerStatic(
                "kosh://materials/physical-constants",
                "Engineering Material Physical Constants",
                "Mass density, Young's modulus, Poisson's ratio, tensile yield strength, and thermal expansion for aerospace metals and engineering polymers",
                toJson(buildPhysicalConstantsSpec())
        );
        registerStatic(
                "kosh://standards/gdt-symbols",
                "Geometric Dimensioning and Tolerancing Reference",
                "ASME Y14.5 and ISO 1101 GD&T symbol definitions, tolerance zones, and datum feature control frame guidelines",
                toJson(buildGdtSymbolsSpec())
        );
        registerStatic(
                "kosh://specs/optics/studio-hdri-lighting",
                "Studio Photography and Lighting Rig Standards",
                "Key/fill/rim lighting ratios, Kelvin color temperatures, lux intensity targets, and cyclorama backdrop geometry parameters",
                toJson(buildStudioLightingSpec())
        );
        registerStatic(
                "kosh://presets/game-engine-lod",
                "Real-Time Game Engine LOD Polygon Budgets",
                "Target triangle counts, draw call limits, and texture map resolutions across LOD0 Hero to LOD3 Billboard stages for UE5 and Unity",
                toJson(buildGameEngineLodSpec())
        );
        registerStatic(
                "kosh://specs/aerospace/unmanned-airframe",
                "UAV Multirotor Airframe Design Rules",
                "Propeller tip clearance percentages, motor mount PCD patterns, center-of-gravity alignment rules, and carbon fiber arm sizing",
                toJson(buildUnmannedAirframeSpec())
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

    private Map<String, Object> buildStepperMotorsSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("units", "millimeters");
        spec.put("standard", "NEMA ICS 16-2001 Stepper Standards");
        spec.put("sizes", Map.of(
                "NEMA14", Map.of("faceWidthMm", 35.2, "pilotDiaMm", 22.0, "pilotDepthMm", 2.0, "holeSpacingMm", 26.0, "boltThread", "M3", "shaftDiaMm", 5.0),
                "NEMA17", Map.of("faceWidthMm", 42.3, "pilotDiaMm", 22.0, "pilotDepthMm", 2.0, "holeSpacingMm", 31.0, "boltThread", "M3", "shaftDiaMm", 5.0),
                "NEMA23", Map.of("faceWidthMm", 57.2, "pilotDiaMm", 38.1, "pilotDepthMm", 1.6, "holeSpacingMm", 47.1, "boltThread", "M5", "shaftDiaMm", 6.35),
                "NEMA34", Map.of("faceWidthMm", 86.4, "pilotDiaMm", 73.0, "pilotDepthMm", 1.6, "holeSpacingMm", 69.6, "boltThread", "M6", "shaftDiaMm", 12.7)
        ));
        return spec;
    }

    private Map<String, Object> buildIsoBearingsSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("units", "millimeters");
        spec.put("standard", "ISO 15 / DIN 625 Deep Groove Radial Ball Bearings");
        spec.put("bearings", Map.of(
                "608", Map.of("boreDiaMm", 8.0, "outerDiaMm", 22.0, "widthMm", 7.0, "dynamicLoadCr_kN", 3.3, "application", "Skateboard, 3D printer spool, roller"),
                "623", Map.of("boreDiaMm", 3.0, "outerDiaMm", 10.0, "widthMm", 4.0, "dynamicLoadCr_kN", 0.63, "application", "Miniature idler, RC micro-drives"),
                "624", Map.of("boreDiaMm", 4.0, "outerDiaMm", 13.0, "widthMm", 5.0, "dynamicLoadCr_kN", 1.3, "application", "V-slot guide wheels"),
                "625", Map.of("boreDiaMm", 5.0, "outerDiaMm", 16.0, "widthMm", 5.0, "dynamicLoadCr_kN", 1.75, "application", "OpenBuilds V-wheels, linear rails"),
                "688", Map.of("boreDiaMm", 8.0, "outerDiaMm", 16.0, "widthMm", 5.0, "dynamicLoadCr_kN", 1.6, "application", "Thin-section leadscrew support"),
                "6900", Map.of("boreDiaMm", 10.0, "outerDiaMm", 22.0, "widthMm", 6.0, "dynamicLoadCr_kN", 2.7, "application", "Robotics pivot joints")
        ));
        return spec;
    }

    private Map<String, Object> buildSlaResinTolerancesSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("units", "millimeters");
        spec.put("technology", "Stereolithography (SLA) and Digital Light Processing (DLP)");
        spec.put("minWallThicknessSupportedMm", 0.4);
        spec.put("minWallThicknessUnsupportedMm", 0.8);
        spec.put("minDrainHoleDiaMm", 3.0);
        spec.put("minHollowClearanceMm", 2.0);
        spec.put("maxOverhangWithoutSupportDeg", 35.0);
        spec.put("movingPartClearanceMm", 0.5);
        spec.put("rules", Map.of(
                "drainHoles", "Provide at least two 3.0mm drain holes opposite each other to prevent hydrostatic suction cup peel failures",
                "orientation", "Angle large flat surfaces at 30-45 degrees to build plate to minimize cross-sectional peel force",
                "hollowing", "Hollow thick solid sections to save resin and prevent exothermic shrinkage curling"
        ));
        return spec;
    }

    private Map<String, Object> buildPhysicalConstantsSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("materials", Map.of(
                "Aluminum_6061_T6", Map.of("densityKgM3", 2700, "youngsModulusGPa", 68.9, "yieldStrengthMPa", 276, "poissonsRatio", 0.33),
                "Titanium_Grade5_Ti6Al4V", Map.of("densityKgM3", 4430, "youngsModulusGPa", 113.8, "yieldStrengthMPa", 880, "poissonsRatio", 0.34),
                "Stainless_Steel_304", Map.of("densityKgM3", 8000, "youngsModulusGPa", 193.0, "yieldStrengthMPa", 215, "poissonsRatio", 0.29),
                "Brass_C360", Map.of("densityKgM3", 8500, "youngsModulusGPa", 100.0, "yieldStrengthMPa", 310, "poissonsRatio", 0.31),
                "PLA_Polymer", Map.of("densityKgM3", 1240, "youngsModulusGPa", 3.5, "yieldStrengthMPa", 50, "poissonsRatio", 0.36),
                "PETG_Polymer", Map.of("densityKgM3", 1270, "youngsModulusGPa", 2.1, "yieldStrengthMPa", 50, "poissonsRatio", 0.38),
                "Carbon_Fiber_Composite", Map.of("densityKgM3", 1550, "youngsModulusGPa", 135.0, "yieldStrengthMPa", 600, "poissonsRatio", 0.28)
        ));
        return spec;
    }

    private Map<String, Object> buildGdtSymbolsSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("standard", "ASME Y14.5-2018 / ISO 1101");
        spec.put("categories", Map.of(
                "form", Map.of("flatness", "Surface elements must lie between two parallel planes", "cylindricity", "Tolerance zone bounded by two coaxial cylinders"),
                "orientation", Map.of("perpendicularity", "Surface or axis exactly 90 degrees to datum", "parallelism", "Surface equidistant to datum plane"),
                "location", Map.of("position", "Theoretical exact location of hole/boss centerline", "concentricity", "Congruence of center points to datum axis"),
                "runout", Map.of("circularRunout", "FIM dial gauge variation during 360-degree rotation", "totalRunout", "Full surface variation along datum axis")
        ));
        return spec;
    }

    private Map<String, Object> buildStudioLightingSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("kelvinTemperatures", Map.of("daylightD56", 5600, "tungstenStudio", 3200, "overcastSky", 6500, "candlelight", 1900));
        spec.put("ratios", Map.of(
                "highKeyCommercial", "Key to Fill 2:1 (soft, clean, shadowless e-commerce photography)",
                "standardHeroShot", "Key to Fill 4:1 with Rim 2:1 (defined volumetric shape and edge contour)",
                "dramaticLowKey", "Key to Fill 8:1 with Rim 3:1 (deep cinematic contrast, silhouette edge)"
        ));
        spec.put("cycloramaDefaults", Map.of("floorRadiusM", 0.5, "bevelSegments", 16, "diffuseRoughness", 0.95));
        return spec;
    }

    private Map<String, Object> buildGameEngineLodSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("engines", List.of("Unreal Engine 5 (Nanite/LOD)", "Unity URP/HDRP", "Godot 4.x"));
        spec.put("stages", Map.of(
                "LOD0_Hero", Map.of("targetTris", "50,000 - 100,000", "distanceScreenPercentage", "50%+", "textureRes", "4096x4096"),
                "LOD1_Mid", Map.of("targetTris", "15,000 - 30,000", "distanceScreenPercentage", "25% - 50%", "textureRes", "2048x2048"),
                "LOD2_Far", Map.of("targetTris", "3,000 - 8,000", "distanceScreenPercentage", "10% - 25%", "textureRes", "1024x1024"),
                "LOD3_Impostor", Map.of("targetTris", "< 500", "distanceScreenPercentage", "< 10%", "textureRes", "512x512")
        ));
        return spec;
    }

    private Map<String, Object> buildUnmannedAirframeSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("units", "millimeters");
        spec.put("rules", Map.of(
                "propellerTipClearance", "Minimum 10% of propeller diameter between blade tips and fuselage/neighboring props",
                "motorMountPCD", Map.of("16x19_M3", "Standard 2207-2306 FPV motors", "19x25_M3_M4", "Standard 2806-3110 long range motors"),
                "cgAlignment", "Center of gravity must coincide with center of thrust within 2.0mm horizontal error",
                "carbonPlateThicknessMm", Map.of("topPlate", 2.0, "bottomPlate", 2.5, "arms", 5.0)
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
