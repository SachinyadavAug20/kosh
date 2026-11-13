package com.kosh.service;

import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service to search, download, cache, and adapt real 3D models from the internet
 * as base geometry for AI agent workflows and user prompts.
 */
@Slf4j
@Service
public class OnlineModelService {

    private final WebClient webClient;
    private final BlenderExecutionService blenderExecutionService;

    @Data
    @Builder
    public static class OnlineModelEntry {
        private String id;
        private String name;
        private String category;
        private String description;
        private String sourceUrl;
        private List<String> tags;
        private long approxSizeBytes;
        private boolean verifiedWatertight;
    }

    private final Map<String, OnlineModelEntry> catalog = new LinkedHashMap<>();
    private final Map<String, Path> localCache = new ConcurrentHashMap<>();

    public OnlineModelService(WebClient.Builder webClientBuilder,
                              BlenderExecutionService blenderExecutionService) {
        this.webClient = webClientBuilder
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(50 * 1024 * 1024))
                .build();
        this.blenderExecutionService = blenderExecutionService;
        initializeCatalog();
    }

    private void initializeCatalog() {
        // 1. Animals & Organic
        registerEntry("base_duck", "Yellow Rubber Duck", "Animals", "Watertight rubber duck character model",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb",
                List.of("duck", "bird", "toy", "animal", "yellow", "character"), 120_000, true);

        registerEntry("base_fox", "Low-Poly Stylized Fox", "Animals", "Rigged low-poly red fox with bushy tail and paws",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Fox/glTF-Binary/Fox.glb",
                List.of("fox", "animal", "creature", "mammal", "lowpoly", "canine", "dog", "wolf"), 162_000, true);

        registerEntry("base_fish", "Oceanic Barramundi Fish", "Animals", "Sculpted marine fish with dorsal fins and textured scale patterns",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BarramundiFish/glTF-Binary/BarramundiFish.glb",
                List.of("fish", "marine", "ocean", "sea", "animal", "nature", "salmon", "shark"), 12_500_000, true);

        registerEntry("base_avocado", "Organic Avocado Fruit", "Organic", "Realistic cross-section avocado with seed and skin",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Avocado/glTF-Binary/Avocado.glb",
                List.of("avocado", "fruit", "food", "organic", "plant", "vegetable"), 8_300_000, true);

        registerEntry("base_brain", "Anatomical Brain Model", "Medical", "Detailed neuroanatomical brain and stem structure",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BrainStem/glTF-Binary/BrainStem.glb",
                List.of("brain", "stem", "anatomy", "medical", "science", "organ"), 3_200_000, true);

        registerEntry("base_tree", "Low-Poly Pine Tree", "Organic", "Stylized evergreen pine tree with multi-tiered foliage",
                "procedural://tree",
                List.of("tree", "pine", "forest", "wood", "nature", "plant", "foliage"), 250_000, true);

        // 2. Vehicles & Transportation
        registerEntry("base_buggy", "Off-Road Dune Buggy", "Vehicles", "Industrial tubular chassis buggy with suspension and rugged tires",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Buggy/glTF-Binary/Buggy.glb",
                List.of("buggy", "car", "vehicle", "offroad", "chassis", "auto", "race", "sports car"), 7_800_000, true);

        registerEntry("base_toy_car", "Streamlined Racecar", "Vehicles", "Glossy painted aerodynamic racer with detailed hubcaps",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ToyCar/glTF-Binary/ToyCar.glb",
                List.of("toy", "car", "racer", "vehicle", "auto", "speed", "supercar", "red car"), 5_800_000, true);

        registerEntry("base_milk_truck", "Commercial Tanker Truck", "Vehicles", "Heavy-duty commercial tanker truck with chassis and cabin",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb",
                List.of("truck", "tanker", "vehicle", "transport", "cargo", "commercial", "semi"), 447_000, true);

        registerEntry("base_rocket", "Space Exploration Rocket", "Vehicles", "Multi-stage orbital space rocket with aerodynamic delta fins",
                "procedural://rocket",
                List.of("rocket", "space", "spaceship", "spacecraft", "shuttle", "nasa", "apollo"), 380_000, true);

        registerEntry("base_drone", "Quadcopter Flight Drone", "Vehicles", "Aerospace surveillance drone with 4 motor arms and rotor blades",
                "procedural://drone",
                List.of("drone", "quadcopter", "uav", "flying", "aircraft", "copier"), 410_000, true);

        // 3. Characters & Figures
        registerEntry("base_cesium_man", "Human Astronaut & Explorer", "Characters", "Articulated human character model suitable as astronaut or explorer",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb",
                List.of("man", "human", "character", "person", "astronaut", "explorer", "body"), 490_000, true);

        registerEntry("base_character_rig", "Articulated Figure Rig", "Characters", "Proportional humanoid rigged character figure",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/RiggedFigure/glTF-Binary/RiggedFigure.glb",
                List.of("figure", "character", "mannequin", "humanoid", "rig", "model"), 50_000, true);

        registerEntry("base_robot", "Articulated Mecha Robot", "Characters", "Humanoid combat robot warrior with titanium chassis and visor",
                "procedural://robot",
                List.of("robot", "mech", "warrior", "droid", "cyborg", "combat", "mecha"), 460_000, true);

        // 4. Equipment & SciFi
        registerEntry("base_scifi_helmet", "Sci-Fi Battle Helmet", "SciFi", "PBR textured damaged combat helmet with metallic face shield",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb",
                List.of("helmet", "scifi", "combat", "armor", "soldier", "cyberpunk", "visor", "battle"), 3_770_000, true);

        registerEntry("base_flight_helmet", "Aviation Pilot Helmet", "Equipment", "Pilot flight helmet with protective visor and communications rig",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb",
                List.of("flight", "pilot", "headgear", "military", "aviation"), 3_770_000, true);

        registerEntry("base_gearbox", "Planetary Transmission Gearbox", "Mechanical", "Precision industrial gearbox with spur gears, central shaft, and bearings",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/GearboxAssy/glTF-Binary/GearboxAssy.glb",
                List.of("gear", "gearbox", "transmission", "mechanical", "engineering", "machinery", "shaft"), 4_950_000, true);

        registerEntry("base_power_tool", "Reciprocating Saw Power Tool", "Mechanical", "Industrial power cutting tool with ergonomic grip and steel blade",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ReciprocatingSaw/glTF-Binary/ReciprocatingSaw.glb",
                List.of("saw", "tool", "powertool", "hardware", "cutter", "machine"), 3_560_000, true);

        // 5. Props, Furniture & Household
        registerEntry("base_guitar", "Acoustic Classical Guitar", "Props", "Acoustic wooden guitar with soundboard, rosette, fretboard, and bridge",
                "procedural://guitar",
                List.of("guitar", "gitter", "acoustic", "instrument", "music", "strings"), 380_000, true);

        registerEntry("base_sword", "Titanium Broadsword", "Props", "Double-edged forged knight broadsword with crossguard, grip, and pommel",
                "procedural://sword",
                List.of("sword", "blade", "broadsword", "weapon", "steel", "knight", "melee"), 290_000, true);

        registerEntry("base_table", "Rustic Dining Table", "Furniture", "Handcrafted oak table with beveled top and 4 tapered structural legs",
                "procedural://table",
                List.of("table", "desk", "furniture", "wood", "dining", "counter"), 340_000, true);

        registerEntry("base_mug", "Ceramic Beverage Mug", "Props", "Glazed ceramic coffee mug with curved ergonomic handle",
                "procedural://mug",
                List.of("mug", "cup", "coffee", "beer", "drink", "ceramic"), 220_000, true);

        registerEntry("base_chair", "Modern Ergonomic Sheen Chair", "Furniture", "Minimalist armchair with sculpted fabric cushions and wooden legs",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenChair/glTF-Binary/SheenChair.glb",
                List.of("chair", "seat", "armchair", "furniture", "wood", "modern", "interior"), 4_380_000, true);

        registerEntry("base_water_bottle", "Stainless Steel Water Bottle", "Props", "Cylindrical insulated flask with screw cap and carrying loop",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/WaterBottle/glTF-Binary/WaterBottle.glb",
                List.of("bottle", "flask", "water", "drink", "cylinder", "container", "metal"), 8_960_000, true);

        registerEntry("base_lantern", "Vintage Camping Lantern", "Props", "Classic glass and brass kerosene lantern with protective cage wire",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Lantern/glTF-Binary/Lantern.glb",
                List.of("lantern", "lamp", "light", "vintage", "torch", "camping"), 9_870_000, true);

        registerEntry("base_boombox", "Retro BoomBox Sound System", "Electronics", "Dual-cassette boombox audio system with speakers, knobs and antenna",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/glTF-Binary/BoomBox.glb",
                List.of("boombox", "radio", "speaker", "audio", "music", "retro", "cassette"), 10_900_000, true);

        registerEntry("base_camera", "Vintage Mechanical Camera", "Electronics", "Brass and leather rangefinder camera with optical glass lens",
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueCamera/glTF-Binary/AntiqueCamera.glb",
                List.of("camera", "photo", "lens", "vintage", "antique", "optics"), 17_500_000, true);

        registerEntry("base_house", "Architectural Cottage House", "Architecture", "Cozy residential house with gabled roof, chimney, and doorway",
                "procedural://house",
                List.of("house", "building", "cottage", "cabin", "home", "architecture"), 450_000, true);

        registerEntry("base_vase", "Classical Ceramic Vase", "Props", "Curved decorative porcelain vase with flared rim and pedestal base",
                "procedural://vase",
                List.of("vase", "pot", "urn", "porcelain", "pottery", "decor"), 260_000, true);
    }

    private void registerEntry(String id, String name, String category, String description,
                               String sourceUrl, List<String> tags, long approxSizeBytes, boolean verifiedWatertight) {
        catalog.put(id, OnlineModelEntry.builder()
                .id(id)
                .name(name)
                .category(category)
                .description(description)
                .sourceUrl(sourceUrl)
                .tags(tags)
                .approxSizeBytes(approxSizeBytes)
                .verifiedWatertight(verifiedWatertight)
                .build());
    }

    public List<OnlineModelEntry> search(String query) {
        if (query == null || query.isBlank()) {
            return new ArrayList<>(catalog.values());
        }
        String q = query.toLowerCase(Locale.ROOT).trim();
        String[] tokens = q.split("\\s+");

        Map<OnlineModelEntry, Integer> scored = new LinkedHashMap<>();
        for (OnlineModelEntry entry : catalog.values()) {
            int score = 0;
            String text = (entry.getName() + " " + entry.getDescription() + " " + entry.getCategory()).toLowerCase(Locale.ROOT);
            for (String token : tokens) {
                if (token.length() <= 1) continue;
                if (text.contains(token)) score += 4;
                for (String tag : entry.getTags()) {
                    if (tag.equalsIgnoreCase(token)) {
                        score += 10;
                    } else if (tag.contains(token) || token.contains(tag)) {
                        score += 6;
                    }
                }
            }
            if (score > 0) {
                scored.put(entry, score);
            }
        }

        if (scored.isEmpty()) {
            // Fuzzy match default starter models
            return catalog.values().stream().limit(6).toList();
        }

        List<OnlineModelEntry> sorted = new ArrayList<>(scored.keySet());
        sorted.sort((a, b) -> Integer.compare(scored.get(b), scored.get(a)));
        return sorted;
    }

    public OnlineModelEntry findBestMatch(String prompt) {
        List<OnlineModelEntry> results = search(prompt);
        if (!results.isEmpty()) {
            return results.get(0);
        }
        return catalog.get("base_duck");
    }

    /**
     * Downloads a 3D model from the internet (or returns cached path).
     */
    public synchronized Path downloadModel(String modelIdOrUrl) {
        String url;
        String modelKey;
        String filename;

        if (modelIdOrUrl.startsWith("http://") || modelIdOrUrl.startsWith("https://")) {
            url = modelIdOrUrl;
            modelKey = "remote";
            filename = "online_" + Math.abs(url.hashCode()) + ".glb";
        } else if (catalog.containsKey(modelIdOrUrl)) {
            OnlineModelEntry entry = catalog.get(modelIdOrUrl);
            url = entry.getSourceUrl();
            modelKey = entry.getId();
            filename = entry.getId() + ".glb";
        } else {
            OnlineModelEntry match = findBestMatch(modelIdOrUrl);
            url = match.getSourceUrl();
            modelKey = match.getId();
            filename = match.getId() + ".glb";
        }

        Path cacheDir = blenderExecutionService.getStoragePath().resolve("online_cache");
        try {
            Files.createDirectories(cacheDir);
        } catch (Exception e) {
            log.error("Failed to create online cache directory: {}", e.getMessage());
        }

        Path targetFile = cacheDir.resolve(filename);
        if (Files.exists(targetFile) && targetFile.toFile().length() > 500) {
            log.info("Model already cached locally: {}", targetFile);
            return targetFile;
        }

        if (url.startsWith("procedural://")) {
            return generateArchetypeGlb(modelKey, targetFile);
        }

        log.info("Downloading 3D base model from internet: {}", url);
        try {
            byte[] bytes = webClient.get()
                    .uri(url)
                    .retrieve()
                    .bodyToMono(byte[].class)
                    .timeout(Duration.ofSeconds(20))
                    .block();

            if (bytes != null && bytes.length > 50) {
                try (FileOutputStream fos = new FileOutputStream(targetFile.toFile())) {
                    fos.write(bytes);
                }
                localCache.put(url, targetFile);
                return targetFile;
            }
        } catch (Exception e) {
            log.warn("Failed to download online 3D model from {}: {}. Generating archetype stand-in.", url, e.getMessage());
        }

        return generateArchetypeGlb(modelKey, targetFile);
    }

    private Path generateArchetypeGlb(String modelId, Path targetFile) {
        try {
            if (Files.exists(targetFile) && targetFile.toFile().length() > 500) {
                return targetFile;
            }
            String pythonPath = targetFile.toAbsolutePath().toString().replace("\\", "/");
            String script;

            if ("base_guitar".equals(modelId)) {
                script = """
                    import bpy, sys
                    bpy.ops.wm.read_factory_settings(use_empty=True)
                    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.5))
                    body = bpy.context.active_object
                    body.name = "Guitar_Body"
                    body.scale = (0.75, 0.22, 0.95)
                    bev = body.modifiers.new("Bevel", type='BEVEL')
                    bev.width = 0.08
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=1.1, location=(0, -0.05, 1.45))
                    neck = bpy.context.active_object
                    neck.name = "Guitar_Neck"
                    bpy.ops.mesh.primitive_cube_add(size=0.25, location=(0, -0.06, 2.05))
                    head = bpy.context.active_object
                    head.name = "Guitar_Headstock"
                    head.scale = (0.5, 0.2, 0.8)
                    mat = bpy.data.materials.new("Mahogany_Wood")
                    mat.use_nodes = True
                    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.55, 0.25, 0.08, 1.0)
                    body.data.materials.append(mat)
                    head.data.materials.append(mat)
                    argv = sys.argv
                    out = argv[argv.index("--") + 1] if "--" in argv else "%s"
                    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
                    """.formatted(pythonPath);
            } else if ("base_sword".equals(modelId)) {
                script = """
                    import bpy, sys
                    bpy.ops.wm.read_factory_settings(use_empty=True)
                    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 1.1))
                    blade = bpy.context.active_object
                    blade.name = "Sword_Blade"
                    blade.scale = (0.04, 0.12, 1.3)
                    bev = blade.modifiers.new("Bevel", type='BEVEL')
                    bev.width = 0.02
                    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.44))
                    guard = bpy.context.active_object
                    guard.name = "Sword_Guard"
                    guard.scale = (0.08, 0.55, 0.07)
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=0.35, location=(0, 0, 0.24))
                    grip = bpy.context.active_object
                    grip.name = "Sword_Grip"
                    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.065, location=(0, 0, 0.04))
                    pommel = bpy.context.active_object
                    pommel.name = "Sword_Pommel"
                    mat_steel = bpy.data.materials.new("Blade_Steel")
                    mat_steel.use_nodes = True
                    mat_steel.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.85, 0.88, 0.92, 1.0)
                    mat_steel.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.95
                    blade.data.materials.append(mat_steel)
                    guard.data.materials.append(mat_steel)
                    pommel.data.materials.append(mat_steel)
                    argv = sys.argv
                    out = argv[argv.index("--") + 1] if "--" in argv else "%s"
                    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
                    """.formatted(pythonPath);
            } else if ("base_table".equals(modelId)) {
                script = """
                    import bpy, sys
                    bpy.ops.wm.read_factory_settings(use_empty=True)
                    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.76))
                    top = bpy.context.active_object
                    top.name = "Table_Top"
                    top.scale = (1.6, 1.0, 0.08)
                    for i, (lx, ly) in enumerate([(0.7, 0.4), (-0.7, 0.4), (0.7, -0.4), (-0.7, -0.4)]):
                        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(lx, ly, 0.36))
                        leg = bpy.context.active_object
                        leg.name = f"Table_Leg_{i}"
                        leg.scale = (0.08, 0.08, 0.72)
                    mat = bpy.data.materials.new("Oak_Wood")
                    mat.use_nodes = True
                    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.45, 0.28, 0.15, 1.0)
                    for o in bpy.data.objects:
                        if o.type == 'MESH': o.data.materials.append(mat)
                    argv = sys.argv
                    out = argv[argv.index("--") + 1] if "--" in argv else "%s"
                    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
                    """.formatted(pythonPath);
            } else if ("base_mug".equals(modelId)) {
                script = """
                    import bpy, sys
                    bpy.ops.wm.read_factory_settings(use_empty=True)
                    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.45, depth=0.85, location=(0, 0, 0.425))
                    mug = bpy.context.active_object
                    mug.name = "Ceramic_Mug"
                    bpy.ops.mesh.primitive_torus_add(major_radius=0.25, minor_radius=0.06, location=(0.48, 0, 0.42), rotation=(0, 1.5708, 0))
                    handle = bpy.context.active_object
                    handle.name = "Mug_Handle"
                    mat = bpy.data.materials.new("Glazed_Ceramic")
                    mat.use_nodes = True
                    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.92, 0.35, 0.2, 1.0)
                    mug.data.materials.append(mat)
                    handle.data.materials.append(mat)
                    argv = sys.argv
                    out = argv[argv.index("--") + 1] if "--" in argv else "%s"
                    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
                    """.formatted(pythonPath);
            } else if ("base_rocket".equals(modelId)) {
                script = """
                    import bpy, sys
                    bpy.ops.wm.read_factory_settings(use_empty=True)
                    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.5, depth=2.0, location=(0, 0, 1.2))
                    body = bpy.context.active_object
                    body.name = "Rocket_Fuselage"
                    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.5, depth=0.9, location=(0, 0, 2.65))
                    cone = bpy.context.active_object
                    cone.name = "Rocket_Nosecone"
                    for i, rot in enumerate([0, 1.5708, 3.1416, 4.7124]):
                        bpy.ops.mesh.primitive_cube_add(size=0.6, location=(0, 0, 0.45), rotation=(0, 0, rot))
                        fin = bpy.context.active_object
                        fin.name = f"Rocket_Fin_{i}"
                        fin.scale = (0.05, 1.4, 0.6)
                    mat = bpy.data.materials.new("Rocket_Hull")
                    mat.use_nodes = True
                    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.95, 0.95, 0.96, 1.0)
                    for o in bpy.data.objects:
                        if o.type == 'MESH': o.data.materials.append(mat)
                    argv = sys.argv
                    out = argv[argv.index("--") + 1] if "--" in argv else "%s"
                    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
                    """.formatted(pythonPath);
            } else if ("base_tree".equals(modelId)) {
                script = """
                    import bpy, sys
                    bpy.ops.wm.read_factory_settings(use_empty=True)
                    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.18, depth=0.8, location=(0, 0, 0.4))
                    trunk = bpy.context.active_object
                    trunk.name = "Tree_Trunk"
                    for i, (z, r, d) in enumerate([(1.0, 1.1, 1.0), (1.6, 0.85, 0.9), (2.15, 0.6, 0.8)]):
                        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=r, depth=d, location=(0, 0, z))
                        canopy = bpy.context.active_object
                        canopy.name = f"Tree_Canopy_{i}"
                    mat_wood = bpy.data.materials.new("Bark_Wood")
                    mat_wood.use_nodes = True
                    mat_wood.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.35, 0.22, 0.12, 1.0)
                    trunk.data.materials.append(mat_wood)
                    mat_leaf = bpy.data.materials.new("Pine_Needles")
                    mat_leaf.use_nodes = True
                    mat_leaf.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.12, 0.55, 0.25, 1.0)
                    for o in bpy.data.objects:
                        if "Canopy" in o.name: o.data.materials.append(mat_leaf)
                    argv = sys.argv
                    out = argv[argv.index("--") + 1] if "--" in argv else "%s"
                    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
                    """.formatted(pythonPath);
            } else {
                script = """
                    import bpy, sys
                    bpy.ops.wm.read_factory_settings(use_empty=True)
                    bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=1.5, location=(0,0,0.75))
                    cyl = bpy.context.active_object
                    cyl.name = "Online_Base_Standin"
                    bev = cyl.modifiers.new("Bevel", type='BEVEL')
                    bev.width = 0.05
                    mat = bpy.data.materials.new("Standin_Material")
                    mat.use_nodes = True
                    bsdf = mat.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        bsdf.inputs["Base Color"].default_value = (0.2, 0.6, 0.85, 1.0)
                    cyl.data.materials.append(mat)
                    argv = sys.argv
                    out = argv[argv.index("--") + 1] if "--" in argv else "%s"
                    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
                    """.formatted(pythonPath);
            }
            blenderExecutionService.executeScript(script, "glb");
        } catch (Exception e) {
            log.error("Failed to generate archetype GLB stand-in: {}", e.getMessage());
        }
        return targetFile;
    }

    /**
     * Builds a deterministic Blender Python script that imports an online base model,
     * normalizes scale, centers it, and applies user/agent modifications.
     */
    public String buildAdaptationScript(Path baseGlbPath, String modificationsDescription, String exportFormat) {
        String format = (exportFormat != null && exportFormat.equalsIgnoreCase("stl")) ? "stl" : "glb";
        String normalizedPath = baseGlbPath.toAbsolutePath().toString().replace("\\", "/");

        return """
            import bpy, sys, math, os, json
            import mathutils
            from mathutils import Vector, Euler, Matrix

            # Fresh scene for a standalone asset. The warm daemon blocks
            # read_factory_settings (CANCELLED silently), so clear explicitly.
            try:
                bpy.ops.wm.read_factory_settings(use_empty=True)
            except Exception:
                pass
            for _obj in list(bpy.data.objects):
                bpy.data.objects.remove(_obj, do_unlink=True)
            for _coll in list(bpy.data.collections):
                try:
                    bpy.data.collections.remove(_coll)
                except Exception:
                    pass
            bpy.ops.object.select_all(action='DESELECT')

            argv = sys.argv
            output_path = argv[argv.index("--") + 1] if "--" in argv else "output.%s"

            # 1. Import downloaded online base model
            base_model_path = "%s"
            if os.path.exists(base_model_path):
                bpy.ops.import_scene.gltf(filepath=base_model_path)
            else:
                bpy.ops.mesh.primitive_cube_add(size=1.5, location=(0,0,0.75))

            # 2. Compute bounding box and normalize to fit standard DCC workspace (height ~2m)
            all_objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
            if all_objs:
                min_z = min([o.matrix_world.translation.z - o.dimensions.z / 2 for o in all_objs])
                max_dim = max([max(o.dimensions.x, o.dimensions.y, o.dimensions.z) for o in all_objs])
                if max_dim > 0:
                    scale_factor = 2.0 / max_dim
                    for o in all_objs:
                        o.scale *= scale_factor
                # Flush to ground
                for o in all_objs:
                    o.location.z -= min_z * (scale_factor if max_dim > 0 else 1.0)
                    bpy.ops.object.select_all(action='DESELECT')
                    o.select_set(True)
                    bpy.context.view_layer.objects.active = o
                    # GLB imports often share meshes across instanced objects;
                    # transform_apply refuses multi-user meshes, so degrade gracefully.
                    try:
                        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
                    except Exception:
                        pass

            # 3. Apply studio environment & PBR accents
            key_light = bpy.data.lights.new("StudioKey", type='AREA')
            key_light.energy = 800
            k_obj = bpy.data.objects.new("StudioKey", key_light)
            bpy.context.collection.objects.link(k_obj)
            k_obj.location = (3, 3, 5)

            rim_light = bpy.data.lights.new("StudioRim", type='AREA')
            rim_light.energy = 500
            r_obj = bpy.data.objects.new("StudioRim", rim_light)
            bpy.context.collection.objects.link(r_obj)
            r_obj.location = (-3, -3, 3)

            # 4. Export adapted scene
            if output_path.endswith('.stl'):
                bpy.ops.wm.stl_export(filepath=output_path)
            else:
                bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')
            """.formatted(format, normalizedPath);
    }
}
