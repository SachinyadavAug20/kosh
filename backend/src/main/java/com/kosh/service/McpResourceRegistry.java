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
        registerStatic(
                "kosh://library/puzzle-pieces",
                "Modular CAD Puzzle Pieces and Sockets Library",
                "Interlocking parametric CAD puzzle pieces with mate sockets, dovetails, NEMA brackets, and pre-solved compound assembly recipes",
                toJson(buildPuzzlePiecesSpec())
        );
        registerStatic(
                "kosh://library/saved-models",
                "Pre-Engineered Complete Assembly Models Library",
                "Turnkey multi-part engineering and cinematic assemblies: quadcopter drone, planetary gearbox, compound microscope, electronics chassis, astronaut scene",
                toJson(buildSavedModelsSpec())
        );
        registerStatic(
                "kosh://specs/hardware/heat-set-inserts",
                "Heat-Set Threaded Insert Specifications",
                "Brass heat-set insert sizing for FDM plastics: hole diameter, boss wall thickness, engagement length, and installation temperature by thread size",
                toJson(buildHeatSetInsertsSpec())
        );
        registerStatic(
                "kosh://materials/filaments",
                "3D Printing Filament Material Library",
                "FDM filament properties: nozzle/bed temperatures, shrinkage, strength, layer adhesion, and typical use cases for common engineering filaments",
                toJson(buildFilamentsSpec())
        );
        registerStatic(
                "kosh://specs/printers/build-volumes",
                "3D Printer Build Volume Database",
                "Popular printer build volumes and nozzle limits for fit checking: Prusa, Bambu Lab, Creality, Printrbot, and Voron class machines",
                toJson(buildPrinterBuildVolumesSpec())
        );
        registerStatic(
                "kosh://standards/iso-2768-tolerances",
                "ISO 2768 General Tolerances Standard",
                "Linear and angular tolerance classes (f, m, c, v) for machined and printed parts, plus derived geographic fits for holes and shafts",
                toJson(buildIso2768TolerancesSpec())
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

    private Map<String, Object> buildPuzzlePiecesSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("units", "millimeters");
        spec.put("toleranceNominalMm", 0.2);
        spec.put("standard", "Kosh Modular Interlocking Standard (KMIS-2026)");
        spec.put("description", "Library of 12 modular parametric puzzle-piece components with mate socket normals and 5 compound assembly recipes answering natural language queries.");

        Map<String, Object> pieces = new LinkedHashMap<>();
        pieces.put("dovetail_male_plate", Map.of(
                "name", "Dovetail Tongue Joint Plate",
                "envelopeMm", List.of(30.0, 30.0, 6.0),
                "sockets", List.of(
                        Map.of("id", "male_tongue_posX", "type", "dovetail_male", "normal", List.of(1, 0, 0), "angleDeg", 15.0, "widthMm", 8.0, "depthMm", 4.0),
                        Map.of("id", "female_groove_negX", "type", "dovetail_female", "normal", List.of(-1, 0, 0), "angleDeg", 15.0, "widthMm", 8.2, "depthMm", 4.2)
                ),
                "features", "0.2mm slide tolerance, chamfered entry lead-in, bottom counterbore"
        ));
        pieces.put("dovetail_female_plate", Map.of(
                "name", "Dovetail Double-Groove Plate",
                "envelopeMm", List.of(30.0, 30.0, 6.0),
                "sockets", List.of(
                        Map.of("id", "female_groove_posX", "type", "dovetail_female", "normal", List.of(1, 0, 0), "angleDeg", 15.0, "widthMm", 8.2, "depthMm", 4.2),
                        Map.of("id", "female_groove_negX", "type", "dovetail_female", "normal", List.of(-1, 0, 0), "angleDeg", 15.0, "widthMm", 8.2, "depthMm", 4.2)
                ),
                "features", "Dual female receivers for bridge interlocking"
        ));
        pieces.put("corner_gusset_90", Map.of(
                "name", "90-Degree Structural Corner Gusset",
                "envelopeMm", List.of(25.0, 25.0, 20.0),
                "sockets", List.of(
                        Map.of("id", "face_posX", "type", "m3_counterbore", "normal", List.of(1, 0, 0), "holeDiaMm", 3.4, "recessDiaMm", 6.0),
                        Map.of("id", "face_posY", "type", "m3_counterbore", "normal", List.of(0, 1, 0), "holeDiaMm", 3.4, "recessDiaMm", 6.0)
                ),
                "features", "Right-angle bracket with internal stiffening rib and dual M3 fastener seats"
        ));
        pieces.put("t_slot_rail_2020", Map.of(
                "name", "2020 Metric Aluminum Extrusion Rail",
                "envelopeMm", List.of(20.0, 20.0, 100.0),
                "sockets", List.of(
                        Map.of("id", "slot_posX", "type", "t_slot_6mm", "normal", List.of(1, 0, 0), "slotWidthMm", 6.2),
                        Map.of("id", "slot_negX", "type", "t_slot_6mm", "normal", List.of(-1, 0, 0), "slotWidthMm", 6.2),
                        Map.of("id", "slot_posY", "type", "t_slot_6mm", "normal", List.of(0, 1, 0), "slotWidthMm", 6.2),
                        Map.of("id", "slot_negY", "type", "t_slot_6mm", "normal", List.of(0, -1, 0), "slotWidthMm", 6.2)
                ),
                "features", "Standard 6mm slot track along four faces with 4.2mm central M5 tap core"
        ));
        pieces.put("bearing_block_608", Map.of(
                "name", "608 Pillow Block Bearing Housing",
                "envelopeMm", List.of(36.0, 36.0, 12.0),
                "sockets", List.of(
                        Map.of("id", "center_bore", "type", "bearing_pressfit", "normal", List.of(0, 0, 1), "boreDiaMm", 22.0, "depthMm", 7.0),
                        Map.of("id", "mount_ear_posX", "type", "m3_through", "normal", List.of(1, 0, 0), "holeDiaMm", 3.4),
                        Map.of("id", "mount_ear_negX", "type", "m3_through", "normal", List.of(-1, 0, 0), "holeDiaMm", 3.4)
                ),
                "features", "Press-fit pocket for 608 ball bearing (8x22x7mm) with retaining circlip rim"
        ));
        pieces.put("nema17_motor_mount", Map.of(
                "name", "NEMA 17 Faceplate Motor Mount",
                "envelopeMm", List.of(42.3, 42.3, 8.0),
                "sockets", List.of(
                        Map.of("id", "pilot_hole", "type", "pilot_boss_clearance", "normal", List.of(0, 0, 1), "boreDiaMm", 22.5),
                        Map.of("id", "bolt_pattern_pcd", "type", "m3_quad_pattern", "normal", List.of(0, 0, 1), "pcdSquareMm", 31.0, "holeDiaMm", 3.4)
                ),
                "features", "Standard NEMA 17 square mount with slot adjusters and heat sink ventilation channels"
        ));
        pieces.put("cantilever_strut", Map.of(
                "name", "Modular Linkage Cantilever Strut",
                "envelopeMm", List.of(14.0, 14.0, 80.0),
                "sockets", List.of(
                        Map.of("id", "pivot_root", "type", "clevis_pin_male", "normal", List.of(0, 0, -1), "pinDiaMm", 5.0, "pinLengthMm", 8.0),
                        Map.of("id", "pivot_tip", "type", "clevis_fork_female", "normal", List.of(0, 0, 1), "slotWidthMm", 5.4, "holeDiaMm", 5.0)
                ),
                "features", "Lightweight I-beam section with clevis pin pivot ends for articulated linkages"
        ));
        pieces.put("ball_socket_joint", Map.of(
                "name", "35-Degree Articulated Ball and Socket Joint",
                "envelopeMm", List.of(20.0, 20.0, 28.0),
                "sockets", List.of(
                        Map.of("id", "ball_stem", "type", "spherical_ball_male", "normal", List.of(0, 0, -1), "ballDiaMm", 16.0),
                        Map.of("id", "socket_cup", "type", "spherical_cup_female", "normal", List.of(0, 0, 1), "cupDiaMm", 16.4, "retentionReliefSegments", 4)
                ),
                "features", "Snap-fit spherical socket providing +/- 35-degree conical articulation with tension slit relief"
        ));
        pieces.put("hex_hub_6way", Map.of(
                "name", "6-Way Isogrid Hexagonal Radial Hub",
                "envelopeMm", List.of(32.0, 32.0, 15.0),
                "sockets", List.of(
                        Map.of("id", "port_0_deg", "type", "strut_socket_female", "radialAngleDeg", 0.0, "pocketDiaMm", 6.2),
                        Map.of("id", "port_60_deg", "type", "strut_socket_female", "radialAngleDeg", 60.0, "pocketDiaMm", 6.2),
                        Map.of("id", "port_120_deg", "type", "strut_socket_female", "radialAngleDeg", 120.0, "pocketDiaMm", 6.2),
                        Map.of("id", "port_180_deg", "type", "strut_socket_female", "radialAngleDeg", 180.0, "pocketDiaMm", 6.2),
                        Map.of("id", "port_240_deg", "type", "strut_socket_female", "radialAngleDeg", 240.0, "pocketDiaMm", 6.2),
                        Map.of("id", "port_300_deg", "type", "strut_socket_female", "radialAngleDeg", 300.0, "pocketDiaMm", 6.2)
                ),
                "features", "Central hexagonal anchor node radiating 6 structural sockets for geodesic space frame assemblies"
        ));
        pieces.put("snap_fit_enclosure_base", Map.of(
                "name", "Perimeter Snap-Bead Enclosure Base",
                "envelopeMm", List.of(80.0, 50.0, 20.0),
                "sockets", List.of(
                        Map.of("id", "snap_groove_perimeter", "type", "snap_catch_continuous", "normal", List.of(0, 0, 1), "grooveDepthMm", 1.2),
                        Map.of("id", "pcb_bosses_x4", "type", "m2_5_standoff", "normal", List.of(0, 0, 1), "spacingXyMm", List.of(70.0, 40.0))
                ),
                "features", "Watertight rim base with 4 interior PCB standoffs and perimeter retention snap channel"
        ));
        pieces.put("snap_fit_enclosure_lid", Map.of(
                "name", "Cantilever Hook Mating Enclosure Lid",
                "envelopeMm", List.of(80.0, 50.0, 6.0),
                "sockets", List.of(
                        Map.of("id", "snap_lugs_perimeter", "type", "cantilever_hook_male", "normal", List.of(0, 0, -1), "lugOffsetMm", 1.2)
                ),
                "features", "Flexible cantilever perimeter hooks matching snap_fit_enclosure_base with 0.25mm engagement"
        ));
        pieces.put("servo_horn_linkage", Map.of(
                "name", "Micro-Servo Spline Horn Linkage Arm",
                "envelopeMm", List.of(40.0, 12.0, 5.0),
                "sockets", List.of(
                        Map.of("id", "spline_hub", "type", "servo_spline_25t", "normal", List.of(0, 0, 1), "splineDiaMm", 5.9),
                        Map.of("id", "pushrod_eye_tip", "type", "m2_clevis_hole", "normal", List.of(0, 0, 1), "holeDiaMm", 2.1)
                ),
                "features", "Standard 25T spline socket interface for servo actuators with M2 pushrod linkage endpoints"
        ));
        spec.put("components", pieces);

        Map<String, Object> recipes = new LinkedHashMap<>();
        recipes.put("interlocking_dovetail_plate", Map.of(
                "name", "Interlocking Dovetail Modular Plate",
                "userQueryKeywords", List.of("puzzle floor tile", "modular interlocking plates", "dovetail joint lattice"),
                "componentsRequired", List.of("dovetail_male_plate", "dovetail_female_plate", "dovetail_male_plate", "dovetail_female_plate"),
                "assemblyDescription", "4-tile planar interlocking floor lattice joined via 0.2mm tolerance dovetail tongues and grooves",
                "estimatedEnvelopeMm", List.of(60.0, 60.0, 6.0)
        ));
        recipes.put("robotic_articulated_arm", Map.of(
                "name", "3-Axis Articulated Robotic Arm Mechanism",
                "userQueryKeywords", List.of("robotic arm", "articulated arm", "servo manipulator", "pick and place robot"),
                "componentsRequired", List.of("nema17_motor_mount", "cantilever_strut", "bearing_block_608", "cantilever_strut", "servo_horn_linkage"),
                "assemblyDescription", "Pivoting mechanical arm with motorized NEMA 17 base, 608 bearing joint, twin linkage struts, and pushrod clevis horn",
                "estimatedEnvelopeMm", List.of(90.0, 60.0, 180.0)
        ));
        recipes.put("modular_cube_chassis", Map.of(
                "name", "Rigid 2020 Extrusion Modular Cube Chassis",
                "userQueryKeywords", List.of("cube frame", "extrusion chassis", "modular box frame", "3d printer cage"),
                "componentsRequired", List.of("t_slot_rail_2020", "corner_gusset_90", "t_slot_rail_2020", "corner_gusset_90"),
                "assemblyDescription", "Rigid structural cube frame assembled from 2020 T-slot extrusion rails and 90-degree corner gussets",
                "estimatedEnvelopeMm", List.of(100.0, 100.0, 100.0)
        ));
        recipes.put("geodesic_hex_truss", Map.of(
                "name", "Geodesic Isogrid Hexagonal Space Truss",
                "userQueryKeywords", List.of("hex truss", "space frame", "honeycomb lattice", "aerospace truss structure"),
                "componentsRequired", List.of("hex_hub_6way", "cantilever_strut", "hex_hub_6way", "cantilever_strut"),
                "assemblyDescription", "High strength-to-weight structural truss radiating 60-degree interlocking struts from 6-way hex hubs",
                "estimatedEnvelopeMm", List.of(160.0, 160.0, 40.0)
        ));
        recipes.put("bearing_transmission_carrier", Map.of(
                "name", "Motorized Shaft Transmission Carrier Sub-Assembly",
                "userQueryKeywords", List.of("transmission plate", "gearbox carrier", "motor bearing mount", "drivetrain support"),
                "componentsRequired", List.of("nema17_motor_mount", "bearing_block_608", "t_slot_rail_2020", "corner_gusset_90"),
                "assemblyDescription", "Drivetrain carrier mating a NEMA 17 stepper faceplate to twin 608 pillow block bearing housings via 2020 rails",
                "estimatedEnvelopeMm", List.of(120.0, 50.0, 60.0)
        ));
        spec.put("compositeRecipes", recipes);

        return spec;
    }

    private Map<String, Object> buildSavedModelsSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("units", "millimeters");
        spec.put("description", "Curated catalog of 5 complete pre-engineered CAD assemblies ready for immediate headless spawning, validation, and rendering.");

        Map<String, Object> models = new LinkedHashMap<>();
        models.put("drone_quadcopter_pro", Map.of(
                "id", "drone_quadcopter_pro",
                "name", "Enterprise Pro Quadcopter Airframe",
                "category", "Aerospace / UAV Robotics",
                "parts", List.of("central_unibody_chassis", "carbon_fiber_arms_x4", "brushless_motors_x4", "propeller_blades_x4", "avionics_canopy", "landing_skids"),
                "boundingBoxMm", List.of(350.0, 350.0, 85.0),
                "defaultMaterial", "Carbon_Fiber_Composite and Anodized_Titanium",
                "description", "Lightweight X-configuration UAV drone chassis with integrated motor mounts, camera canopy, and propeller clearance."
        ));
        models.put("planetary_gearbox_stage", Map.of(
                "id", "planetary_gearbox_stage",
                "name", "Epicyclic Planetary Gearbox 4:1 Stage",
                "category", "Mechanical Powertrain",
                "parts", List.of("outer_ring_gear_48t", "central_sun_gear_16t", "planet_gears_16t_x3", "planet_carrier_plate", "input_shaft_8mm", "output_drive_hex"),
                "boundingBoxMm", List.of(80.0, 80.0, 45.0),
                "defaultMaterial", "Machined_Brass and Hardened_Steel",
                "description", "Compact epicyclic gear train with 3 planet gears on a carrier plate delivering a 4:1 speed reduction ratio."
        ));
        models.put("biomedical_microscope_body", Map.of(
                "id", "biomedical_microscope_body",
                "name", "Laboratory Compound Optical Microscope",
                "category", "Scientific Instrumentation",
                "parts", List.of("cast_iron_curved_arm", "horseshoe_base", "revolving_nosepiece_quad", "objective_lenses_x4", "coaxial_focus_knobs", "xy_mechanical_stage", "binocular_eyepiece_tubes"),
                "boundingBoxMm", List.of(180.0, 220.0, 360.0),
                "defaultMaterial", "Studio_White_Enamel and Chrome",
                "description", "High-detail laboratory microscope with revolving quad objective turret, mechanical stage, and focus dials."
        ));
        models.put("modular_electronics_housing", Map.of(
                "id", "modular_electronics_housing",
                "name", "IP54 Modular DIN-Rail Instrument Housing",
                "category", "Industrial Electronics",
                "parts", List.of("flanged_enclosure_base", "o_ring_gasket_channel", "transparent_polycarbonate_lid", "pg7_cable_glands_x2", "pcb_standoff_posts_x4", "din_rail_spring_clip"),
                "boundingBoxMm", List.of(120.0, 80.0, 40.0),
                "defaultMaterial", "Flame_Retardant_ABS and Polycarbonate",
                "description", "Industrial sealed instrument enclosure featuring snap-close lid, cable gland knockouts, and standard 35mm DIN-rail mount."
        ));
        models.put("cosmic_astronaut_scene", Map.of(
                "id", "cosmic_astronaut_scene",
                "name", "Cinematic Apollo Astronaut on Cratered Asteroid",
                "category", "Cinematic / Character",
                "parts", List.of("spacesuit_torso", "bubble_visor_gold_reflective", "life_support_backpack", "lunar_cratered_pedestal", "celestial_dust_ring", "orbiting_crystals_x8"),
                "boundingBoxMm", List.of(250.0, 250.0, 300.0),
                "defaultMaterial", "Studio_Clay and Gold_Reflective",
                "description", "Stylized astronaut exploration diorama situated atop an asteroid pedestal with dust rings and orbiting floating minerals."
        ));
        spec.put("models", models);

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

    /** Brass heat-set insert sizing for FDM printed bosses (mm). */
    private Map<String, Object> buildHeatSetInsertsSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("units", "millimeters");
        spec.put("process", "Soldering-iron heat-set installation into FDM printed bosses");
        spec.put("installation", Map.of(
                "ironTemperatureC", 230,
                "insertOrientation", "Perpendicular to surface, chamfered end first",
                "coolDownSeconds", 15,
                "recommendedBossWallMm", "Insert OD / 2 + 1.5 mm minimum")
        );
        spec.put("sizes", Map.of(
                "M2x3", heatSetInsert(3.2, 4.0, 3.0, 4.5),
                "M3x5", heatSetInsert(4.0, 5.6, 5.0, 6.0),
                "M3x8", heatSetInsert(4.0, 5.6, 8.0, 6.0),
                "M4x6", heatSetInsert(5.6, 7.1, 6.0, 8.0),
                "M5x8", heatSetInsert(6.4, 8.0, 8.0, 9.0),
                "M6x10", heatSetInsert(8.0, 9.6, 10.0, 11.0)
        ));
        spec.put("fitNotes", Map.of(
                "holeDiaMm", "Printed hole diameter for press-fit before heating",
                "bossOuterDiaMm", "Minimum outer diameter of the surrounding boss",
                "engagementMm", "Usable thread engagement length of the insert",
                "wallMm", "Minimum wall of plastic between hole and nearest free edge"
        ));
        return spec;
    }

    private Map<String, Object> heatSetInsert(double hole, double bossOuter, double engagement, double wall) {
        Map<String, Object> i = new LinkedHashMap<>();
        i.put("holeDiaMm", hole);
        i.put("bossOuterDiaMm", bossOuter);
        i.put("engagementMm", engagement);
        i.put("wallMm", wall);
        return i;
    }

    /** Common FDM filament print parameters and mechanical trade-offs. */
    private Map<String, Object> buildFilamentsSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("units", List.of("degC", "MPa", "%"));
        spec.put("nozzleTempC", Map.of(
                "PLA", List.of(200, 215),
                "PETG", List.of(230, 250),
                "ABS", List.of(235, 255),
                "ASA", List.of(240, 260),
                "TPU", List.of(220, 235),
                "Nylon", List.of(250, 275),
                "PC", List.of(280, 300)
        ));
        spec.put("bedTempC", Map.of(
                "PLA", List.of(55, 65),
                "PETG", List.of(70, 85),
                "ABS", List.of(95, 110),
                "ASA", List.of(95, 110),
                "TPU", List.of(35, 45),
                "Nylon", List.of(70, 90),
                "PC", List.of(90, 110)
        ));
        Map<String, Object> materials = new LinkedHashMap<>();
        materials.put("PLA", filament(58.0, 0.3, "Low warp, brittle, best for prototypes and display parts"));
        materials.put("PETG", filament(49.0, 1.0, "Tough, chemically resistant, mild flexibility, good layer adhesion"));
        materials.put("ABS", filament(40.0, 0.5, "Impact resistant, acetone-soluble, warps without enclosure"));
        materials.put("ASA", filament(44.0, 0.5, "UV-stable ABS alternative for outdoor parts"));
        materials.put("TPU", filament(26.0, 3.0, "Flexible rubber-like, prints slow, Shore 95A typical"));
        materials.put("Nylon", filament(70.0, 1.5, "Strong and wear resistant, hygroscopic, needs drybox"));
        materials.put("PC", filament(64.0, 0.6, "High temp stiffness, transparent grades available"));
        spec.put("properties", materials);
        spec.put("notes", Map.of(
                "enclosure", "ABS, ASA, Nylon, PC benefit from a heated enclosure",
                "shrinkage", "PLA < PETG < ABS < Nylon; compensate critical fits",
                "retraction", "Direct drive 0.5-1.0 mm; Bowden 4.0-6.0 mm")
        );
        return spec;
    }

    private Map<String, Object> filament(double tensileMpa, double shrinkPercent, String useCase) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("tensileStrengthMpa", tensileMpa);
        f.put("shrinkagePercent", shrinkPercent);
        f.put("useCase", useCase);
        return f;
    }

    /** Printer build volumes (mm) for part fit-checking. */
    private Map<String, Object> buildPrinterBuildVolumesSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("units", "millimeters");
        Map<String, Object> printers = new LinkedHashMap<>();
        printers.put("prusa_mk4", printer(250, 210, 220, 0.4));
        printers.put("bambu_lab_p1s", printer(256, 256, 256, 0.4));
        printers.put("bambu_lab_a1_mini", printer(180, 180, 180, 0.4));
        printers.put("creality_ender3_v3", printer(220, 220, 250, 0.4));
        printers.put("voron_24_r2", printer(350, 350, 340, 0.4));
        printers.put("bambu_lab_x1c", printer(256, 256, 256, 0.4));
        spec.put("printers", printers);
        spec.put("notes", "Volumes are usable axis extents; subtract 5-10 mm margin for brims and clips.");
        return spec;
    }

    private Map<String, Object> printer(double x, double y, double z, double nozzle) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("buildVolumeMm", List.of(x, y, z));
        p.put("standardNozzleMm", nozzle);
        return p;
    }

    /** ISO 2768 general tolerance classes for linear dimensions. */
    private Map<String, Object> buildIso2768TolerancesSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("standard", "ISO 2768-1/2 (general tolerances)");
        spec.put("units", "millimeters");
        spec.put("classes", Map.of(
                "f", Map.of("description", "fine — precision fits and inspection parts",
                        "ranges", List.of(
                                toleranceRange(0.5, 3.0, 0.05),
                                toleranceRange(3.0, 6.0, 0.05),
                                toleranceRange(6.0, 30.0, 0.10),
                                toleranceRange(30.0, 120.0, 0.15),
                                toleranceRange(120.0, 400.0, 0.20))),
                "m", Map.of("description", "medium — general machining default",
                        "ranges", List.of(
                                toleranceRange(0.5, 3.0, 0.10),
                                toleranceRange(3.0, 6.0, 0.10),
                                toleranceRange(6.0, 30.0, 0.20),
                                toleranceRange(30.0, 120.0, 0.30),
                                toleranceRange(120.0, 400.0, 0.50))),
                "c", Map.of("description", "coarse — sheet metal and castings",
                        "ranges", List.of(
                                toleranceRange(0.5, 3.0, 0.20),
                                toleranceRange(3.0, 6.0, 0.30),
                                toleranceRange(6.0, 30.0, 0.50),
                                toleranceRange(30.0, 120.0, 0.80),
                                toleranceRange(120.0, 400.0, 1.20))),
                "v", Map.of("description", "very coarse — raw stock and weldments",
                        "ranges", List.of(
                                toleranceRange(0.5, 3.0, 0.50),
                                toleranceRange(3.0, 6.0, 1.00),
                                toleranceRange(6.0, 30.0, 1.50),
                                toleranceRange(30.0, 120.0, 2.50),
                                toleranceRange(120.0, 400.0, 4.00)))
        ));
        spec.put("angular", Map.of("defaultClass", "m",
                "degrees", List.of(10.0, 30.0, 120.0),
                "toleranceDeg", List.of(1.0, 0.5, 0.25)));
        spec.put("fitNotes", "3D printed parts: design to class 'c' or looser; compensate FDM hole shrinkage separately.");
        return spec;
    }

    private Map<String, Object> toleranceRange(double over, double upTo, double tol) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("overMm", over);
        r.put("upToMm", upTo);
        r.put("toleranceMm", tol);
        return r;
    }
}
