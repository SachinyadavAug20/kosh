<p align="center">
  <img src="assets/kosh-logo.svg" alt="KOSH Logo" width="160" height="160" />
</p>

<h1 align="center">K O S H (कौश)</h1>

<p align="center">
  <strong>Minimalist Developer-First Creative Model Context Protocol (MCP) Workstation</strong><br />
  <em>Real-Time Parametric 3D CAD • Digital Sculpting • Procedural Animation • Headless Blender 5.2 LTS</em>
</p>

<p align="center">
  <a href="https://www.blender.org/"><img src="https://img.shields.io/badge/Blender-5.2%20LTS-E87D0D?style=flat-square&logo=blender&logoColor=white" alt="Blender 5.2" /></a>
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/Protocol-MCP%20JSON--RPC%202.0-blue?style=flat-square" alt="MCP Protocol" /></a>
  <a href="https://m8ven.ai/mcp/sachinyadavaug20-kosh-17wrcp?s=readme"><img src="https://m8ven.ai/badge/mcp/sachinyadavaug20-kosh-17wrcp?v=bdd3e7f44215f953664d683e149f2666" alt="M8ven Score" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15.5-black?style=flat-square&logo=next.js" alt="Next.js" /></a>
  <a href="https://spring.io/projects/spring-boot"><img src="https://img.shields.io/badge/Spring%20Boot-3.3-6DB33F?style=flat-square&logo=springboot&logoColor=white" alt="Spring Boot" /></a>
  <a href="https://openjdk.org/"><img src="https://img.shields.io/badge/Java-21%20LTS-ED8B00?style=flat-square&logo=openjdk&logoColor=white" alt="Java 21" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-gray?style=flat-square" alt="License" /></a>
</p>

<p align="center">
  <img src="assets/kosh-banner.svg" alt="KOSH Banner" width="100%" />
</p>

<p align="center">
  <img src="assets/demo.gif" alt="KOSH Live Demo Walkthrough" width="100%" />
</p>

> [!NOTE]
> **Live Demo Walkthrough**: Demonstrates real-time 3D model synthesis, interactive viewport manipulation, DCC inspector synchronization, and headless Blender MCP integration. High-resolution 60fps recording is also available at [assets/videos/demo.mp4](assets/videos/demo.mp4).

---

## Overview

**Kosh** (कौश — *treasury / vessel of creation*) is a high-performance, minimalist 3D workstation and **Model Context Protocol (MCP)** server hub. It bridges modern AI coding assistants with native desktop **Blender 5.2 LTS** in headless execution mode, allowing developers and designers to synthesize, manipulate, animate, and color 3D assets on the fly via JSON-RPC 2.0.

Built with a titanium-slate CAD workstation aesthetic, Kosh couples a **Spring Boot 3.3 / Java 21** MCP server with an interactive **Next.js 15 / Three.js** digital content creation (DCC) studio.

---

## Architecture

```text
 ┌─────────────────────────────────────────────────────────────┐
 │                LLM / AI Agent / MCP Client                  │
 │      (Claude Desktop / Antigravity / Cursor / Gemini)       │
 └──────────────────────────────┬──────────────────────────────┘
                                │ JSON-RPC 2.0 (POST /mcp)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │            Spring Boot 3.3 MCP Server (:8080)               │
 │  ├─ McpController (/mcp)        ├─ ShareController (/api)   │
 │  ├─ McpToolRegistry (55 Tools)  ├─ AssetController          │
 │  ├─ McpResourceRegistry (20)    ├─ McpPromptRegistry (13)   │
 │  └─ GoogleGeminiClient (BYOK)   └─ BlenderExecutionService  │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Subprocess Execution
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │           Headless Blender Engine 5.2.1 LTS                 │
 │  ├─ bpy / bmesh                 ├─ Dynamic Sculpting        │
 │  ├─ Geometry Nodes              ├─ Shader Graph / Matcaps   │
 │  ├─ Rigid Body / Particle Sim   └─ GLTF/GLB/STL Exporters   │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Compiled 3D Buffers (.glb)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │            Next.js 15 Terminal Studio (:3000)               │
 │  ├─ 3D Viewport Navigation Gizmo (6-Axis Depth-Projected)   │
 │  ├─ All-in-One Universal Transform Handles (Move/Rot/Scale) │
 │  ├─ Dope Sheet Animation Timeline with Keyframe Diamonds    │
 │  ├─ Multi-Palette CAD Theme Engine (Titanium/Blender/Nordic)│
 │  ├─ Standalone 1-File HTML Exporter & Share Route (/share)  │
 │  └─ Hardware-Accelerated Canvas Protractor & Marquee Engine │
 └─────────────────────────────────────────────────────────────┘
```

---

## Expanded Creative MCP Tools Suite

Kosh exposes a comprehensive suite of 55 native creative CAD and DCC tools over JSON-RPC 2.0 (`POST /mcp` and `GET /mcp/sse`), every single one declaring explicit boolean behavioral hints (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) for full M8ven Trust Index Grade A compliance:

### Precision 3D CAD & Engineering
| # | Tool Name | Domain | Description | Hints (RO, Destr, Idemp, OpenW) |
|---|---|---|---|---|
| 1 | `cad_create_primitive` | CAD Primitives | Precision parametric CAD solids (cube, cylinder, cone, sphere, torus) with constraints. | `false, false, false, false` |
| 2 | `cad_boolean_operation` | CSG Booleans | Exact manifold boolean operations (DIFFERENCE, UNION, INTERSECT). | `false, false, false, false` |
| 3 | `cad_apply_modifier` | CAD Modifiers | Numerical CAD modifiers (BEVEL, SUBSURF, MIRROR, SOLIDIFY). | `false, false, false, false` |
| 4 | `cad_inspect_scene` | Topology Audit | Vertex/face count, bounding box, dimensions, and watertight manifold status. | `true, false, true, false` |
| 5 | `cad_measure_dimensions`| Caliper Tool | Digital caliper measuring volume, bounding box, surface area, and 3D print readiness. | `true, false, true, false` |
| 6 | `cad_hollow_shell` | 3D Printing | Parametric hollow shelling with uniform wall thickness and resin drain holes. | `false, false, false, false` |
| 7 | `cad_generate_threads` | Fasteners | Precision ISO metric screw threads, bolts, and nuts with standardized pitch. | `false, false, false, false` |
| 8 | `cad_generate_gear` | Kinematics | Parametric spur, helical, and bevel gears with explicit tooth count and module. | `false, false, true, false` |
| 9 | `cad_convex_hull` | Collision Hull | Minimal convex bounding hull for physics colliders and robotic envelopes. | `false, false, true, false` |
| 10 | `cad_separate_loose_parts`| Multi-Body | Splits multi-body meshes into distinct child objects with centered origins. | `false, false, true, false` |
| 11 | `cad_project_curve_cut`| Stamping | Projects 2D profiles onto curved 3D surfaces to emboss, deboss, or knife cut. | `false, false, true, false` |
| 12 | `cad_lattice_infill` | Lightweight | Procedural structural lattice infills (gyroid, honeycomb, wireframe). | `false, false, false, false` |
| 13 | `cad_wireframe_cage` | Lattice Strut | Transforms solid geometry into open structural wireframe truss lattices. | `false, false, true, false` |
| 14 | `cad_point_cloud_surface`| Elevation | Parametric surface mesh synthesis from coordinate point clouds and heightmaps. | `false, false, true, false` |
| 15 | `cad_export_engineering_drawing`| Blueprint 2D | Exports SVG 2D technical orthographic blueprint drawings with title blocks. | `true, false, true, false` |
| 16 | `cad_apply_fillet_chamfer`| Edge Bevel | Metric edge rounding (fillet) or chamfer beveling via angle-limited modifier. | `false, false, false, false` |

### Instant Assembly & Kitbashing (Zero LLM Latency)
| # | Tool Name | Domain | Description | Hints (RO, Destr, Idemp, OpenW) |
|---|---|---|---|---|
| 17 | `cad_assemble_kit` | Assembly | Pre-baked parametric templates (flange, quadcopter, panel, truss, tree) in <10ms. | `false, false, true, false` |
| 18 | `cad_assemble_puzzle_pieces` | Puzzle Assembly | Joins modular puzzle pieces (dovetails, NEMA mounts, 2020 rails) to satisfy user query recipes. | `false, false, true, false` |
| 19 | `cad_batch_csg` | Batch Pipeline | Sequential CSG booleans executed in one single transaction round-trip. | `false, false, false, false` |
| 20 | `cad_synthesize_composite`| Generative CAD | Multi-part composite CAD assembly from natural language with aesthetic styles. | `false, false, false, false` |
| 21 | `cad_compose_compound_scene`| Environments | Multi-subject compositions situated in rich cosmic/orbital environments. | `false, false, false, false` |
| 22 | `scene_assembler` | Staging | Multi-asset modular architecture and compound scene assembly. | `false, false, false, false` |

### Photorealistic Rendering & Studio Lighting
| # | Tool Name | Domain | Description | Hints (RO, Destr, Idemp, OpenW) |
|---|---|---|---|---|
| 23 | `cad_render_frame` | Beauty Render | Physically-based raytraced render via Blender EEVEE or Cycles engine. | `true, false, true, false` |
| 24 | `blender_render_frame` | Studio Render | Frame capture with transparent background, studio lighting, and framing. | `true, false, true, false` |
| 25 | `cad_studio_lighting_preset`| Lighting Rigs | 3-Point Classic, Cyberpunk Neon, Product Softbox, and Dramatic Rim rigs. | `false, false, false, false` |
| 26 | `cad_apply_pbr_preset`| PBR Presets | Calibrated optical materials (Titanium, Carbon Fiber, Glass, Gold, Obsidian). | `false, false, false, false` |
| 27 | `cad_batch_multiview_render`| Blueprints | 4-view orthographic and isometric blueprint engineering frames. | `true, false, true, false` |
| 28 | `lighting_studio` | Custom Rig | Custom photographic lighting rigs, cyclorama infinity backdrops. | `false, false, false, false` |
| 29 | `material_shader` | Shader Graph | Procedural Principled BSDF node trees with micro-displacement. | `false, false, false, false` |
| 30 | `camera_compositor` | Director Rig | Cinematic camera rigs: 360-degree turntable orbits, dolly tracks, macro lenses. | `false, false, false, false` |

### Digital Sculpting, Animation & Multi-Domain
| # | Tool Name | Domain | Description | Hints (RO, Destr, Idemp, OpenW) |
|---|---|---|---|---|
| 31 | `cad_uv_unwrap_auto` | UV Mapping | Smart UV Project unwrapping with customizable angle limits and packing margins. | `false, false, true, false` |
| 32 | `blender_sculpt_op` | Sculpting | Digital sculpting brushes (clay, crease, inflate, grab) & dynamic remeshing. | `false, false, false, false` |
| 33 | `blender_mesh_ops` | BMesh Ops | Manifold CSG booleans, chamfer bevels, solidification, and decimation. | `false, false, false, false` |
| 34 | `blender_uv_paint` | Texturing | Smart UV Project unwrapping, normal map baking, and vertex colors. | `false, false, false, false` |
| 35 | `blender_animate_pipeline`| Kinematics | Baked keyframed rigid body falls, cloth drapery, wave deforms, turntables. | `false, false, false, false` |
| 36 | `geometry_nodes` | Algorithmic | Procedural Geometry Node networks, point scattering, and lattices. | `false, false, false, false` |
| 37 | `kosh_svg_to_3d` | 2D to 3D | Extrudes 2D vector SVG path coordinates into beveled 3D solids. | `false, false, false, false` |
| 38 | `kosh_audio_reactive` | Audio Motion | 16-band frequency equalizer bars and concentric spectrum rings. | `false, false, false, false` |
| 39 | `kosh_ascii_to_voxel` | Voxel Engine | Synthesizes multi-layered 3D voxel grid sculptures from ASCII templates. | `false, false, false, false` |
| 40 | `kosh_cad_export_step` | Engineering | Precision engineered CAD models (spur gears, flange bearings, mounts). | `false, false, false, false` |
| 41 | `mcp_check_tool` | Trust Index | Vets any MCP server across 120,000+ indexed servers via M8ven Trust Index. | `true, false, true, true` |
| 42 | `kosh_system_health` | Telemetry | Live operational diagnostics, Blender 5.2 LTS status, and daemon telemetry. | `true, false, true, true` |

---

## Enterprise MCP Resources (20 Direct In-Memory Schemas)

Kosh pre-serializes domain knowledge into JVM memory at startup for sub-2ms `resources/read` resolution, eliminating LLM dimension hallucinations:

| # | Resource URI | Category | Description |
|---|---|---|---|
| 1 | `kosh://scene/hierarchy` | Live Dynamic | Complete active scene graph tree, object transforms, and material IDs. |
| 2 | `kosh://engine/capabilities` | Live Dynamic | Blender 5.2 LTS version, Python packages (NumPy), supported formats, poly quotas. |
| 3 | `kosh://materials/catalog` | Live Dynamic | Ready-to-use studio PBR materials: MatteTitanium, ClearGlass, CastIron, CarbonFiber. |
| 4 | `kosh://materials/library` | Curated Presets | Built-in material presets (Titanium, Frosted Acrylic, Redwax, Chrome, Cyber Neon). |
| 5 | `kosh://scene/bounding-boxes` | Geometry | World-space Axis-Aligned Bounding Box (AABB) extents and dimensions. |
| 6 | `kosh://viewport/active-selection` | Selection | Selected mesh vertex counts, face counts, active modifier stacks, transforms. |
| 7 | `kosh://library/modular-models` | Catalog | Modular low-poly components and compound space/studio scene presets. |
| 8 | `kosh://specs/hardware/metric-fasteners` | Fasteners | ISO 4762 clearance holes, tap drill diameters, socket-cap dimensions for M2-M12. |
| 9 | `kosh://materials/pbr-presets` | Shaders | Disney Principled BSDF color hex, roughness, and metalness calibrated tokens. |
| 10 | `kosh://guidelines/fdm-tolerances` | 3D Printing | FDM print design rules: nozzle diameters, wall thickness, hole sizes, overhangs. |
| 11 | `kosh://specs/engineering/stepper-motors` | Robotics | NEMA 14, 17, 23, 34 CAD dimensions, faceplate widths, pilot bosses, shaft diameters. |
| 12 | `kosh://specs/standards/iso-bearings` | Bearings | ISO 15 deep groove ball bearings (608, 623, 624, 625, 688, 6900) bore/outer/width specs. |
| 13 | `kosh://guidelines/sla-resin-tolerances` | Resin 3D Print | SLA/DLP photopolymer design rules: drain holes, wall thickness, suction cup prevention. |
| 14 | `kosh://materials/physical-constants` | Physics | Mass density (kg/m3), Young's modulus, yield strength, Poisson's ratio for 7 materials. |
| 15 | `kosh://standards/gdt-symbols` | GD&T Standard | ASME Y14.5 and ISO 1101 geometric dimensioning symbols and tolerance zones. |
| 16 | `kosh://specs/optics/studio-hdri-lighting` | Photography | Photographic lighting ratios (2:1, 4:1, 8:1), Kelvin color temps, cyclorama curvature. |
| 17 | `kosh://presets/game-engine-lod` | Game Engine | Real-time poly budgets and texture map sizes across LOD0 Hero to LOD3 Billboard. |
| 18 | `kosh://specs/aerospace/unmanned-airframe` | Aerospace | UAV multirotor airframe design rules, prop tip clearances, motor PCD standards. |
| 19 | `kosh://library/puzzle-pieces` | Modular Library | 12 CAD puzzle pieces with mate sockets, dovetails, NEMA brackets, and compound recipes. |
| 20 | `kosh://library/saved-models` | Pre-Engineered | Complete multi-part assemblies: quadcopter drone, planetary gearbox, compound microscope. |

---

## Precision Engineering MCP Prompts (13 Standardized Blueprints)

Connected LLM clients (Claude Desktop, Cursor, Gemini) can query `prompts/list` and `prompts/get` to pull hardened step-by-step CAD plans with zero syntax hallucinations:

| # | Prompt Blueprint | Focus Domain | Key Arguments |
|---|---|---|---|
| 1 | `scaffold_parametric_enclosure` | Electronics Enclosures | `lengthMm`, `widthMm`, `heightMm`, `wallThicknessMm` |
| 2 | `optimize_manifold_topology` | Mesh Repair | `meshName` |
| 3 | `lowpoly_stylized_environment` | Game Environments | `theme`, `budgetTris` |
| 4 | `harden_mechanical_part` | Mechanical Hardening | `mesh_name`, `tolerance_mm` |
| 5 | `decompose_narrative_object` | CSG Tree Structuring | `concept_description` |
| 6 | `design_spur_gear_train` | Gear Transmission | `gearRatio`, `module`, `driverTeeth`, `faceWidthMm` |
| 7 | `photorealistic_product_hero_shot` | Studio Photography | `meshName`, `materialPreset`, `lightingMood` |
| 8 | `generative_drone_frame` | UAV Airframe | `propellerDiameterInch`, `motorPcdType`, `armThicknessMm` |
| 9 | `procedural_architectural_pavilion` | Parametric Architecture | `spanMeters`, `ribCount`, `canopyStyle` |
| 10 | `reverse_engineering_blueprint_to_3d` | 2D to 3D CAD | `blueprintDescription`, `nominalToleranceMm` |
| 11 | `sculpt_creature_bust` | Digital Sculpting | `creatureType`, `voxelResolutionMm` |
| 12 | `generate_3d_printable_snapfit` | Snap-Fit Engineering | `beamLengthMm`, `wallThicknessMm`, `catchDepthMm`, `entryAngleDeg` |
| 13 | `assemble_modular_puzzle_recipe` | Modular Assembly | `recipeName`, `clearanceMm`, `scaleMultiplier` |

---

## Modular Puzzle-Piece Assembly Engine & Saved Models Library

Kosh introduces a physical interlocking assembly subsystem where CAD components act like modular puzzle pieces with calibrated socket vectors, enabling AI agents and connected clients to stitch components together to satisfy complex user queries with zero manual CAD modeling.

### 1. Interlocking Puzzle Pieces (`kosh://library/puzzle-pieces`)

The resource exposes 12 parametric CAD puzzle pieces adhering to the Kosh Modular Interlocking Standard (KMIS-2026), each specifying exact envelope dimensions, socket connection points, normal vectors, and 0.2mm nominal slide-fit tolerances:

1. **`dovetail_male_plate`**: 30x30x6mm planar plate with male dovetail tongue on +X and female groove on -X (15-degree wedge angle).
2. **`dovetail_female_plate`**: 30x30x6mm planar plate with dual female dovetail grooves for bidirectional interlocking.
3. **`corner_gusset_90`**: 25x25x20mm structural right-angle gusset with dual M3 counterbored holes and internal stiffening rib.
4. **`t_slot_rail_2020`**: 20x20x100mm metric extrusion rail featuring standard 6mm slot profiles along 4 faces and central M5 tap core.
5. **`bearing_block_608`**: 36x36x12mm pillow block housing with press-fit pocket for 608 ball bearings (22mm outer diameter, 8mm bore).
6. **`nema17_motor_mount`**: 42.3x42.3x8mm stepper motor faceplate with 22.5mm pilot boss clearance and 31mm square PCD M3 bolt pattern.
7. **`cantilever_strut`**: 14x14x80mm lightweight I-beam linkage strut with clevis pin pivot ends.
8. **`ball_socket_joint`**: 20x20x28mm spherical ball-and-cup joint delivering +/- 35-degree conical articulation.
9. **`hex_hub_6way`**: 32x32x15mm isogrid anchor node radiating 6 structural sockets at 60-degree increments for space frames.
10. **`snap_fit_enclosure_base`**: 80x50x20mm perimeter snap-bead enclosure base with 4 internal PCB standoffs.
11. **`snap_fit_enclosure_lid`**: 80x50x6mm mating lid with flexible cantilever hooks (0.25mm retention engagement).
12. **`servo_horn_linkage`**: 40x12x5mm actuator arm featuring a standard 25T spline hub and M2 pushrod clevis hole.

### 2. Turnkey Composite Assembly Recipes

When an AI assistant receives natural language user requests, it matches them directly to pre-solved puzzle piece recipes executed deterministically via `cad_assemble_puzzle_pieces`:

- **`interlocking_dovetail_plate`** (*"puzzle floor tile", "modular interlocking plates"*): 4-tile planar lattice joined via 0.2mm slide dovetails with alternating dark titanium and brushed brass finishes.
- **`robotic_articulated_arm`** (*"robotic arm", "servo manipulator", "pick and place robot"*): Multi-jointed arm mating a NEMA 17 motor mount, 608 bearing pivot, twin linkage struts, and servo clevis horn.
- **`modular_cube_chassis`** (*"cube frame", "extrusion chassis", "3D printer cage"*): Rigid 3D cubic enclosure assembled from 12 2020 extrusion rails joined by 8 90-degree corner gussets.
- **`geodesic_hex_truss`** (*"hex truss", "space frame", "honeycomb lattice"*): Isogrid structural node radiating 60-degree interlocking struts into an outer tension perimeter.
- **`bearing_transmission_carrier`** (*"transmission plate", "gearbox carrier", "motor bearing mount"*): Mechanical powertrain sub-assembly mating a NEMA 17 faceplate to twin 608 pillow blocks across dual 2020 rails with a precision 8mm ground shaft.

### 3. Pre-Engineered Saved Complete Assemblies (`kosh://library/saved-models`)

For instant turn-key prototyping, Kosh pre-bakes complete multi-part CAD assemblies accessible directly through the resource registry:

1. **`drone_quadcopter_pro`**: Enterprise Pro Quadcopter Airframe (350x350x85mm) featuring carbon fiber arms, brushless motor mounts, avionics canopy, and landing skids.
2. **`planetary_gearbox_stage`**: Epicyclic Planetary 4:1 Gearbox (80x80x45mm) with 48T outer ring gear, 16T central sun gear, 3 planet gears on carrier plate, and 8mm input shaft.
3. **`biomedical_microscope_body`**: Laboratory Optical Compound Microscope (180x220x360mm) with cast iron arm, revolving quad objective turret, mechanical XY stage, and focus dials.
4. **`modular_electronics_housing`**: IP54 DIN-Rail Instrument Housing (120x80x40mm) with O-ring gasket groove, transparent polycarbonate lid, PG7 cable gland knockouts, and 35mm DIN-rail spring clip.
5. **`cosmic_astronaut_scene`**: Cinematic Apollo Astronaut Diorama (250x250x300mm) situated atop a cratered asteroid pedestal with dust rings and orbiting crystals.

---

## Core Studio Features

### 1. Modern 3D Viewport Navigation Gizmo
- **6-Axis Real-Time Depth Sorting:** Projects cardinal axes (`+X`, `-X`, `+Y`, `-Y`, `+Z`, `-Z`) via `camera.matrixWorldInverse`. Back axes render with subtle dashed stems and muted dots; front axes render with solid stems and sharp circular pill badges.
- **Smooth Easing Snap:** Clicking any axis animates the viewport camera into orthogonal alignment over 300ms using ease-out cubic interpolation (`1 - (1 - t)³`).
- **Interactive Drag Orbit:** Dragging anywhere on the gizmo background disc smoothly orbits the scene in spherical coordinates.
- **Center Isometric Hub:** Center dot resets the camera view smoothly to Isometric (`iso`).
- **HUD Mode Pill:** Displays current view (e.g. `FRONT ORTHO`, `USER PERSPECTIVE`) with 1-click Perspective / Orthographic projection toggle.

### 2. Universal Transform Gizmo
- **Unified Axis Progression:**
  - `(0, 0, 0)`: Chamfered Zinc-white cube for uniform 3-axis scaling (`0.18`).
  - `0.28`: Planar drag squares (XY Amber, XZ Cyan, YZ Purple) for smooth 2D sliding.
  - `0.65`: Scale cubes positioned cleanly along shafts inside the rotation ring envelope.
  - `0.85`: Rotation arc torus rings (`0.016` tube radius, 64 segments).
  - `1.15`: Translation arrow cones (`0.075` radius).
- **Dedicated Modes:** Seamlessly switch between `All (Q)`, `Select (V)`, `Move (W)`, `Rotate (E)`, and `Scale (R)`.
- **Z-Fighting Prevention:** Visual handles render with `renderOrder = 99999` and `depthTest = false`.

### 3. Dope Sheet Animation Timeline
- **Keyframe Diamond Markers (`◆`):** Visual indicators at transformation keyframes. Click diamonds to snap the scrubber head; drag diamonds to retime the sequence.
- **Parametric Exploded View Slider:** 0% to 100% real-time disassembly slider using bounding box radial displacement vectors.
- **Playback Controls:** Play/Pause, Rewind, Looping, Frame counter, and Timecode display (`00:00:00`).

### 4. 2-Way Blender Script Ingestion & Standalone HTML Export
- **Paste `bpy` Script:** Paste raw Python scripts copied from Blender's Scripting workspace. The backend executes them headlessly and streams the resulting `.glb` directly into the viewport.
- **Standalone 1-File HTML Exporter:** Exports an autonomous, self-contained single `.html` file embedding the model buffer (Base64) and Three.js from CDN with OrbitControls, directional lighting, and turntable rotation—zero server required.
- **Community Model Sharing & 1-Click Forking:** Share creations via `/share/[id]` with 3D cards, metadata, and an instant `[ Fork in Kosh Studio ]` workflow.

---

## Prerequisites

Ensure the following tools are installed and available in `$PATH`:

| Requirement | Minimum Version | Verification |
|---|---|---|
| **Java** | OpenJDK 21+ | `java -version` |
| **Maven** | 3.9+ | `mvn -version` |
| **Node.js** | 20+ (20.x, 22.x, or newer) | `node -v` |
| **npm** | 10+ | `npm -v` |
| **Blender** | 4.x / 5.x LTS | `blender --version` |

---

## Quickstart

### Automated 1-Click Boot
Run the bootloader script, which verifies prerequisites, compiles the backend, and boots both services:
```bash
chmod +x run.sh
./run.sh
```

- **Web Studio:** [http://localhost:3000](http://localhost:3000)
- **MCP Server:** [http://localhost:8080](http://localhost:8080)
- **Health Check:** `curl http://localhost:8080/api/health`

### Manual Run

#### 1. Backend MCP Server (Port 8080)
```bash
cd backend
mvn clean spring-boot:run
```

#### 2. Frontend Terminal Studio (Port 3000)
```bash
cd frontend
npm install
npm run dev
```

---

## MCP Usage (JSON-RPC 2.0)

### 1. List Available Tools
```bash
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }' | jq
```

### 2. Execute 3D Mesh Tool (`blender_mesh`)
```bash
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "X-Google-Key: YOUR_GEMINI_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "cad_model",
      "arguments": {
        "prompt": "Precision billet aluminum impeller with keyed center bore and perimeter bolt circle",
        "format": "glb"
      }
    }
  }' | jq
```

---

## Keyboard Shortcuts Cheat Sheet

| Key | Action |
|---|---|
| `Q` | All-In-One Universal Gizmo (Move, Rotate, Scale) |
| `V` | Select Mode (Pure raycast selection) |
| `W` | Move / Translate Gizmo |
| `E` | Rotate Gizmo |
| `R` | Scale Gizmo |
| `G` / `R` / `S` | Blender Modal Transform (Grab, Rotate, Scale with numeric input) |
| `Enter` | Commit Active Modal Transform |
| `Esc` | Cancel Modal Transform or Deselect |
| `A` / `Alt + A` | Select All / Deselect All |
| `Numpad 1` / `Ctrl + 1` | Front View (+Z) / Back View (-Z) |
| `Numpad 3` / `Ctrl + 3` | Right View (+X) / Left View (-X) |
| `Numpad 7` / `Ctrl + 7` | Top View (+Y) / Bottom View (-Y) |
| `Numpad 0` | Reset to Isometric Perspective View |
| `Numpad 5` | Toggle Perspective / Orthographic Projection |
| `F` / `.` | Frame / Focus Camera on Selected Mesh |
| `Alt + Z` | Toggle X-Ray Transparency |
| `Z` | Shading Pie Menu (Solid, Wireframe, Material, Normals) |
| `T` | Toggle Left Generator Panel |
| `N` | Toggle Right Code Inspector Drawer |
| `F1` or `?` | Open Hotkeys Cheat Sheet |

---

## Author & Security Verification
 
- **Project:** KOSH (Minimalist Creative MCP Hub)
- **Author:** Sachin SureshChandra Yadav ([@SachinyadavAug20](https://github.com/SachinyadavAug20))
- **Event:** BharatCode Build League 2026
- **License:** Apache 2.0 ([LICENSE](LICENSE))
- **Privacy Policy:** [PRIVACY.md](PRIVACY.md)
- **M8ven Trust Index Verification:**
  [![M8ven Score](https://m8ven.ai/badge/mcp/sachinyadavaug20-kosh-17wrcp?v=bdd3e7f44215f953664d683e149f2666)](https://m8ven.ai/mcp/sachinyadavaug20-kosh-17wrcp?s=readme)
- **Recursive MCP Vetting:** Built-in `mcp_check_tool` against 120,000+ indexed Model Context Protocol servers
