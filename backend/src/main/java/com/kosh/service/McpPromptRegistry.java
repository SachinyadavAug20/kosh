package com.kosh.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Production MCP Prompt blueprints ({@code prompts/list} / {@code prompts/get}).
 *
 * <p>Hardened system prompts with few-shot CSG plans that any connected LLM client
 * (Claude Desktop, Cursor, Gemini) can pull in one click, so first-attempt parametric
 * scripts come out structured and error-free instead of hallucinated bpy syntax.</p>
 */
@Slf4j
@Service
public class McpPromptRegistry {

    /** Ordered prompt descriptors served by {@code prompts/list}. */
    private final List<Map<String, Object>> promptsList = new ArrayList<>();

    public McpPromptRegistry() {
        register(
                "scaffold_parametric_enclosure",
                "Prepares the LLM to design an electronic enclosure/chassis with snap fits, mounting standoffs, wall thickness, and a split lid.",
                List.of(
                        arg("lengthMm", "Internal enclosure length in millimeters", true),
                        arg("widthMm", "Internal enclosure width in millimeters", true),
                        arg("heightMm", "Internal enclosure height in millimeters", true),
                        arg("wallThicknessMm", "Wall thickness in millimeters (FDM minimum: 1.2)", true)
                )
        );
        register(
                "optimize_manifold_topology",
                "Evaluates a broken or non-manifold mesh, identifies degenerate faces, and applies self-healing routines to reach watertight status.",
                List.of(
                        arg("meshName", "Name of the mesh to inspect and repair", true)
                )
        );
        register(
                "lowpoly_stylized_environment",
                "Guides the model to create an indie game-ready low-poly composition without high triangle overhead.",
                List.of(
                        arg("theme", "Art direction theme (e.g. 'scifi hangar', 'forest village')", true),
                        arg("budgetTris", "Maximum triangle budget for the whole scene", true)
                )
        );
        register(
                "harden_mechanical_part",
                "Standardized mechanical hardening blueprint: inspects non-manifold edges, applies chamfers/bevels, and verifies metric dimensions.",
                List.of(
                        arg("mesh_name", "Name of the target mesh component to harden", true),
                        arg("tolerance_mm", "Machining tolerance or chamfer offset in millimeters (default: 1.0)", false)
                )
        );
        register(
                "decompose_narrative_object",
                "Sequential CSG CAD decomposition blueprint: guides the LLM to structure models into Primary Solids -> Subtractive Cuts -> Additive Detail -> PBR Finishes.",
                List.of(
                        arg("concept_description", "Natural language concept or product description to decompose into CAD operations", true)
                )
        );
        register(
                "design_spur_gear_train",
                "Prepares the LLM to design an interlocking 2-gear transmission mechanism with calculated gear ratio, module, center distance, and bore clearance.",
                List.of(
                        arg("gearRatio", "Transmission reduction ratio (e.g. 2.0)", false),
                        arg("module", "Gear module pitch in millimeters (e.g. 1.5)", false),
                        arg("driverTeeth", "Number of teeth on driving pinion gear (e.g. 15)", false),
                        arg("faceWidthMm", "Gear face width in millimeters (e.g. 10.0)", false)
                )
        );
        register(
                "photorealistic_product_hero_shot",
                "Guides the LLM through professional studio lighting, 85mm camera optics, PBR shader assignment, and 4-view blueprint rendering.",
                List.of(
                        arg("meshName", "Name of the target product mesh", true),
                        arg("materialPreset", "PBR material preset (Titanium, Carbon Fiber, Glass, Gold, Chrome, Obsidian, Copper, Ceramic, Car Paint)", false),
                        arg("lightingMood", "Studio lighting rig (3-Point Classic, Cyberpunk Neon, Product Softbox, Dramatic Rim, Daylight Studio)", false)
                )
        );
        register(
                "generative_drone_frame",
                "Prepares the LLM to architect a lightweight UAV quadcopter airframe with motor mounting PCDs, electronics bay, and weight reduction pockets.",
                List.of(
                        arg("propellerDiameterInch", "Propeller diameter in inches (e.g. 5.0)", false),
                        arg("motorPcdType", "Motor mount PCD standard (e.g. 16x19_M3 or 19x25_M3_M4)", false),
                        arg("armThicknessMm", "Carbon fiber arm plate thickness in millimeters (e.g. 5.0)", false)
                )
        );
        register(
                "procedural_architectural_pavilion",
                "Guides the LLM to generate a parametric architectural canopy with structural ribs, Voronoi skin perforation, and daylight staging.",
                List.of(
                        arg("spanMeters", "Total pavilion ground span in meters (e.g. 12.0)", false),
                        arg("ribCount", "Number of structural arch ribs (e.g. 8)", false),
                        arg("canopyStyle", "Canopy geometry style (ribbed_arch, voronoi_shell, tensile_membrane)", false)
                )
        );
        register(
                "reverse_engineering_blueprint_to_3d",
                "Instructions to reconstruct 100% watertight CSG solid geometry from orthographic blueprint dimensions and verify with digital calipers.",
                List.of(
                        arg("blueprintDescription", "Description and nominal dimensions of the mechanical drawing", true),
                        arg("nominalToleranceMm", "Machining tolerance in millimeters (e.g. 0.1)", false)
                )
        );
        register(
                "sculpt_creature_bust",
                "Multi-pass digital sculpting blueprint: anatomical blocking, voxel remeshing, dynamic brush deformation, symmetry mirroring, and clay shader.",
                List.of(
                        arg("creatureType", "Target creature or fantasy creature description", true),
                        arg("voxelResolutionMm", "Remeshing voxel size in millimeters (e.g. 2.0)", false)
                )
        );
        register(
                "generate_3d_printable_snapfit",
                "Standardized cantilever snap-fit joint engineering blueprint with calculated beam deflection, 30-degree lead-in angle, and strain relief fillet.",
                List.of(
                        arg("beamLengthMm", "Cantilever beam length in millimeters (e.g. 15.0)", false),
                        arg("wallThicknessMm", "Nominal wall thickness in millimeters (e.g. 2.0)", false),
                        arg("catchDepthMm", "Snap catch undercut retention depth in millimeters (e.g. 1.2)", false),
                        arg("entryAngleDeg", "Lead-in push entry angle in degrees (e.g. 30.0)", false)
                )
        );
        register(
                "assemble_modular_puzzle_recipe",
                "Guides the AI agent or LLM client to query the 'kosh://library/puzzle-pieces' catalog, select interlocking puzzle piece components, and stitch them together via 'cad_assemble_puzzle_pieces' to answer complex modular CAD queries.",
                List.of(
                        arg("recipeName", "Target composite puzzle recipe name (interlocking_dovetail_plate, robotic_articulated_arm, modular_cube_chassis, geodesic_hex_truss, bearing_transmission_carrier)", true),
                        arg("clearanceMm", "Mating slide-fit joint clearance in millimeters (default: 0.2 for FDM printing)", false),
                        arg("scaleMultiplier", "Uniform scaling factor applied across all assembled components (default: 1.0)", false)
                )
        );
        register(
                "optimize_model_for_3d_printing",
                "Print-readiness optimization blueprint: validates manifold topology, orients the part for minimal support, sizes walls/nozzles for the target filament, and verifies clearances.",
                List.of(
                        arg("meshName", "Name of the model to prepare for slicing", true),
                        arg("filament", "Target filament (PLA, PETG, ABS, ASA, TPU, Nylon, PC)", false),
                        arg("nozzleDiameterMm", "Printer nozzle diameter in millimeters (default: 0.4)", false),
                        arg("supportless", "If true, re-orient to avoid supports entirely (default: false)", false)
                )
        );
        register(
                "design_heat_set_insert_mount",
                "Designs printed bosses for brass heat-set threaded inserts using the kosh://specs/hardware/heat-set-inserts resource for hole sizing, wall thickness, and engagement.",
                List.of(
                        arg("threadSize", "Insert thread size (M2, M3, M4, M5, M6)", true),
                        arg("insertLengthMm", "Insert engagement length in millimeters (e.g. 5.0)", false),
                        arg("mountCount", "Number of insert bosses to place (e.g. 4)", false),
                        arg("patternPcdMm", "Bolt circle diameter for radial patterns in millimeters (optional)", false)
                )
        );
        register(
                "plan_linear_motion_stage",
                "Plans a linear motion sub-assembly: rail length, bearing blocks, stepper mount, belt/pulley or leadscrew drive, and end-stop clearances from build volume constraints.",
                List.of(
                        arg("travelMm", "Required travel in millimeters (e.g. 200)", true),
                        arg("payloadKg", "Moving payload mass in kilograms (e.g. 2.0)", false),
                        arg("driveType", "Drive mechanism (belt, leadscrew, rack_pinion)", false),
                        arg("buildVolumeMm", "Printer build volume as 'X,Y,Z' in millimeters for part sizing (e.g. '256,256,256')", false)
                )
        );

        log.info("McpPromptRegistry initialized with {} prompt blueprints", promptsList.size());
    }

    /** Returns ordered metadata for JSON-RPC {@code prompts/list}. */
    public List<Map<String, Object>> listPrompts() {
        return List.copyOf(promptsList);
    }

    /**
     * Materializes the requested prompt blueprint with concrete argument substitution.
     *
     * @throws IllegalArgumentException when the prompt name is unknown
     */
    public Map<String, Object> getPrompt(String name, Map<String, Object> arguments) {
        String normalized = name != null ? name.trim().toLowerCase() : "";
        Map<String, Object> args = arguments != null ? arguments : Map.of();

        return switch (normalized) {
            case "scaffold_parametric_enclosure" -> textPrompt(
                    "Parametric enclosure instructions for " + arg(args, "lengthMm", "80") + "x"
                            + arg(args, "widthMm", "60") + "x" + arg(args, "heightMm", "35") + "mm",
                    String.format("""
                            You are an expert Parametric Enclosure Engineer.
                            Target dimensions: %smm x %smm x %smm with %smm walls.
                            Execute the following plan using Kosh MCP tools:
                            1. Generate the outer bounding shell via 'cad_create_primitive' (cube) sized to the target dimensions, origin at bottom-center flush with Z=0.
                            2. Perform a CSG difference ('cad_boolean_operation', operation='DIFFERENCE') to create a hollow cavity offset inward by %smm.
                            3. Place 4 cylindrical screw bosses at the interior corners with M3 tap hole clearances (read 'kosh://specs/hardware/metric-fasteners' for the 2.5mm tap drill and 3.4mm clearance diameters).
                            4. Split the top lid at 70%% elevation with a 0.5mm stepped lip-and-groove joint.
                            5. Apply a 1.5mm fillet to all external vertical corners via 'cad_apply_fillet_chamfer' (offsetMm=1.5, segments=3).
                            6. Validate walls against 'kosh://guidelines/fdm-tolerances' (min 1.2mm) before exporting.
                            """,
                            arg(args, "lengthMm", "80"),
                            arg(args, "widthMm", "60"),
                            arg(args, "heightMm", "35"),
                            arg(args, "wallThicknessMm", "2.0"),
                            arg(args, "wallThicknessMm", "2.0")
                    )
            );

            case "optimize_manifold_topology" -> textPrompt(
                    "Mesh repair instructions for " + arg(args, "meshName", "Target_Mesh"),
                    String.format("""
                            You are an automated CAD Mesh Repair Agent.
                            Inspect mesh '%s' via 'cad_inspect_scene':
                            1. Detect duplicate co-located vertices (threshold: 0.0001m) and merge by distance.
                            2. Recalculate all face normals to point consistently outward.
                            3. Fill non-manifold edge holes and eliminate zero-area degenerate triangles.
                            4. Verify watertight status before returning success (isWatertight must be true).
                            5. If non-manifold regions persist, rebuild the body with 'cad_batch_csg' using a base primitive and DIFFERENCE/UNION operations instead of patching corrupt topology.
                            """,
                            arg(args, "meshName", "Target_Mesh")
                    )
            );

            case "lowpoly_stylized_environment" -> textPrompt(
                    "Low-poly environment blueprint for theme '" + arg(args, "theme", "stylized") + "'",
                    String.format("""
                            Generate a cohesive low-poly 3D scene adhering to the '%s' theme.
                            Triangle Budget: Maximum %s tris.
                            Rules:
                            - Use faceted geometry (flatShading: true) with no subdiv modifiers.
                            - Limit the palette to 4 harmonious hex colors (query 'kosh://materials/pbr-presets' for calibrated starting tokens).
                            - Anchor the composition to a subtle geometric base plinth.
                            - Prefer 'cad_assemble_kit' (lowpoly_tree, structural_truss) for repeated props to stay inside the triangle budget.
                            - Verify the final budget with 'cad_inspect_scene' before returning success.
                            """,
                            arg(args, "theme", "stylized"),
                            arg(args, "budgetTris", "5000")
                    )
            );

            case "harden_mechanical_part" -> {
                String meshName = arg(args, "mesh_name", "Target_Part");
                String tolerance = arg(args, "tolerance_mm", "1.0");
                yield textPrompt(
                        "Mechanical hardening instructions for " + meshName,
                        String.format("""
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
                                   - Verify all bore diameters provide precision ISO fit clearances (read 'kosh://specs/hardware/metric-fasteners').
                                4. Export & Artifact Validation:
                                   - Call 'cad_synthesize_composite' or 'export_cad_artifact' to compile a binary manifold GLB or STL.
                                """,
                                meshName, tolerance, meshName, tolerance, tolerance
                        )
                );
            }

            case "decompose_narrative_object" -> {
                String concept = arg(args, "concept_description", "Parametric Mechanical Assembly");
                yield textPrompt(
                        "Parametric CSG decomposition instructions for " + concept,
                        String.format("""
                                SYSTEM BLUEPRINT: SEQUENTIAL CSG PARAMETRIC CAD DECOMPOSITION
                                Target Concept: %s

                                Before writing code or executing tool calls, structure this object into an explicit Constructive Solid Geometry (CSG) tree:

                                Phase 1: Primary Envelope (Base Solid)
                                - Identify the foundational solid envelope (cube, cylinder, revolve profile).
                                - Establish real-world metric dimensions and position origin at bottom-center flush with Z=0.
                                - Invoke 'cad_create_primitive' to instantiate the foundational geometry.

                                Phase 2: Subtractive Features (Cavities, Bores, Slots)
                                - List all negative volumetric subtractions (internal bores, shaft clearances, weight-relief pockets).
                                - Apply via 'cad_boolean_operation' with operation='DIFFERENCE', or batch them in one round-trip with 'cad_batch_csg'.

                                Phase 3: Additive Features (Bosses, Flanges, Fasteners)
                                - List mounting bosses, structural ribs, and ergonomic ridges.
                                - Join via 'cad_boolean_operation' with operation='UNION'.

                                Phase 4: Fillets & Edge Transitions
                                - Apply chamfers or fillets to sharp edges via 'cad_apply_fillet_chamfer' (offsetMm, segments=3).

                                Phase 5: PBR Material Finishes
                                - Query 'kosh://materials/pbr-presets' and assign appropriate engineering shaders (e.g. AnodizedDarkTitanium, MachinedAluminum, MatteCarbonFiber).

                                Now proceed with the sequential tool invocations.
                                """,
                                concept
                        )
                );
            }

            case "design_spur_gear_train" -> {
                String ratio = arg(args, "gearRatio", "2.0");
                String mod = arg(args, "module", "1.5");
                String driverTeeth = arg(args, "driverTeeth", "15");
                String faceWidth = arg(args, "faceWidthMm", "10.0");
                yield textPrompt(
                        "Spur gear train engineering instructions for ratio " + ratio,
                        String.format("""
                                SYSTEM BLUEPRINT: PARAMETRIC SPUR GEAR TRANSMISSION PROTOCOL
                                Target Ratio: %s:1 | Module: %s mm | Driver Teeth: %s | Face Width: %s mm

                                Calculate gear parameters:
                                - Driven Teeth = %s * %s
                                - Driver Pitch Diameter = %s * %s mm
                                - Driven Pitch Diameter = Driven Teeth * %s mm
                                - Center Distance = (Driver Pitch Diameter + Driven Pitch Diameter) / 2

                                Execute the following sequence using Kosh MCP tools:
                                1. Generate Driver Pinion:
                                   - Invoke 'cad_generate_gear' with teeth=%s, module=%s, faceWidth=%s, boreDiameter=5.0, name='Pinion_Driver'.
                                2. Generate Driven Gear:
                                   - Invoke 'cad_generate_gear' with driven tooth count, module=%s, faceWidth=%s, boreDiameter=8.0, name='Spur_Driven'.
                                3. Position and Align:
                                   - Invoke 'cad_transform_object' to offset 'Spur_Driven' along X by calculated Center Distance.
                                   - Rotate 'Spur_Driven' by half pitch angle (360 / (2 * Driven Teeth)) degrees to mesh teeth accurately.
                                4. Verify and Validate:
                                   - Query 'kosh://specs/standards/iso-bearings' to confirm 608 and 625 bearing support fit.
                                   - Verify clearance with 'cad_measure_dimensions'.
                                """,
                                ratio, mod, driverTeeth, faceWidth,
                                driverTeeth, ratio,
                                driverTeeth, mod,
                                mod,
                                driverTeeth, mod, faceWidth,
                                mod, faceWidth
                        )
                );
            }

            case "photorealistic_product_hero_shot" -> {
                String meshName = arg(args, "meshName", "Product_Enclosure");
                String mat = arg(args, "materialPreset", "Titanium");
                String lighting = arg(args, "lightingMood", "Product Softbox");
                yield textPrompt(
                        "Photorealistic studio hero shot blueprint for " + meshName,
                        String.format("""
                                SYSTEM BLUEPRINT: PHOTOREALISTIC STUDIO HERO RENDERING PIPELINE
                                Target Mesh: %s | Material: %s | Lighting: %s

                                Execute the following sequential photographic pipeline:
                                1. Material Calibration:
                                   - Invoke 'cad_apply_pbr_preset' on target '%s' with preset='%s'.
                                   - Confirm shader parameters against 'kosh://materials/physical-constants'.
                                2. Studio Lighting and Cyclorama:
                                   - Invoke 'cad_studio_lighting_preset' with preset='%s', addCyclorama=true, lightIntensity=1.2.
                                3. Camera Framing and Optics:
                                   - Query 'kosh://specs/optics/studio-hdri-lighting' for camera lens guidelines.
                                   - Position 85mm portrait/product camera angled 30 degrees down focusing on the center of mass.
                                4. Production Multi-View Blueprint:
                                   - Invoke 'cad_batch_multiview_render' to generate Front, Top, Right, and Isometric views in a single pass.
                                """,
                                meshName, mat, lighting,
                                meshName, mat,
                                lighting
                        )
                );
            }

            case "generative_drone_frame" -> {
                String propDia = arg(args, "propellerDiameterInch", "5.0");
                String pcd = arg(args, "motorPcdType", "16x19_M3");
                String armThick = arg(args, "armThicknessMm", "5.0");
                yield textPrompt(
                        "Generative UAV airframe blueprint for " + propDia + " inch propellers",
                        String.format("""
                                SYSTEM BLUEPRINT: GENERATIVE UAV MULTIROTOR AIRFRAME DESIGN
                                Propeller Diameter: %s inch | Motor PCD: %s | Arm Thickness: %s mm

                                Query Design Rules:
                                - Read 'kosh://specs/aerospace/unmanned-airframe' for propeller tip clearance (>10%% prop dia) and CG alignment.
                                - Propeller radius = %s * 25.4 / 2 mm. Minimum tip clearance = %s * 2.54 mm.

                                Sequential CAD execution:
                                1. Central Core Envelope:
                                   - Create top and bottom electronics sandwich plates via 'cad_create_primitive' (cube).
                                   - Cut standard 30.5x30.5mm flight controller standoff holes (read 'kosh://specs/hardware/metric-fasteners' for M3 clearance).
                                2. Motor Arm Synthesis:
                                   - Extrude 4 symmetric arms angled at 45, 135, 225, and 315 degrees with thickness %s mm.
                                   - Place motor mount bolt circle with pattern %s at arm tips.
                                3. Weight-Relief Pocketing:
                                   - Apply CSG difference cuts along arm centerlines to reduce rotational inertia while preserving shear web strength.
                                4. Validation:
                                   - Call 'cad_measure_dimensions' to verify center of mass symmetry and overall diagonal wheelbase.
                                """,
                                propDia, pcd, armThick,
                                propDia, propDia,
                                armThick,
                                pcd
                        )
                );
            }

            case "procedural_architectural_pavilion" -> {
                String span = arg(args, "spanMeters", "12.0");
                String ribs = arg(args, "ribCount", "8");
                String style = arg(args, "canopyStyle", "ribbed_arch");
                yield textPrompt(
                        "Procedural architectural pavilion blueprint for span " + span + "m",
                        String.format("""
                                SYSTEM BLUEPRINT: PARAMETRIC ARCHITECTURAL PAVILION
                                Span: %s m | Arch Ribs: %s | Canopy Style: %s

                                Execution steps:
                                1. Base Ground Plinth:
                                   - Create foundation plinth with 'cad_create_primitive' sized to %s x %s m.
                                2. Structural Rib Array:
                                   - Generate parametric parabolic arch ribs sweeping across span %s m using 'cad_sweep_path' or 'cad_revolve_profile'.
                                   - Duplicate ribs with linear spacing using 'cad_array_pattern'.
                                3. Canopy Skinning and Perforation:
                                   - Loft membrane surface between ribs.
                                   - If style is voronoi_shell, apply procedural weight-reduction perforations with 'cad_lattice_infill'.
                                4. Daylight Staging:
                                   - Invoke 'cad_studio_lighting_preset' with preset='Daylight Studio'.
                                   - Assign Frosted Polycarbonate or Clear Glass PBR preset to canopy panels.
                                """,
                                span, ribs, style,
                                span, span,
                                span
                        )
                );
            }

            case "reverse_engineering_blueprint_to_3d" -> {
                String blueprint = arg(args, "blueprintDescription", "Cast Flange Bearing Housing");
                String tol = arg(args, "nominalToleranceMm", "0.1");
                yield textPrompt(
                        "Reverse engineering blueprint reconstruction for " + blueprint,
                        String.format("""
                                SYSTEM BLUEPRINT: 2D BLUEPRINT TO WATERTIGHT 3D CSG RECONSTRUCTION
                                Blueprint Subject: %s | Tolerance: %s mm

                                Sequential Re-Engineering Protocol:
                                1. Orthographic Projection Analysis:
                                   - Extract primary cylindrical and prismatic dimensions from Front, Top, and Side projections.
                                   - Cross-reference ISO bearing fits with 'kosh://specs/standards/iso-bearings'.
                                2. Primary Bounding Solid:
                                   - Instantiate foundational envelope via 'cad_create_primitive'.
                                3. Subtractive Machine Operations:
                                   - Call 'cad_boolean_operation' (DIFFERENCE) to cut bearing bore, shaft clearances, and counterbores.
                                   - Drill bolt hole circle with clearance holes from 'kosh://specs/hardware/metric-fasteners'.
                                4. Edge Stress Relieving:
                                   - Chamfer internal bore lead-ins and external transition corners with 'cad_apply_fillet_chamfer'.
                                5. Caliper Verification:
                                   - Invoke 'cad_measure_dimensions' to verify outer bounds, inner bore tolerance, and 100%% watertight manifold status.
                                """,
                                blueprint, tol
                        )
                );
            }

            case "sculpt_creature_bust" -> {
                String creature = arg(args, "creatureType", "Draconic Monster");
                String voxelSize = arg(args, "voxelResolutionMm", "2.0");
                yield textPrompt(
                        "Digital sculpting instructions for " + creature,
                        String.format("""
                                SYSTEM BLUEPRINT: DIGITAL SCULPTING AND DYNAMIC TOPOLOGY WORKFLOW
                                Creature Concept: %s | Voxel Remesh Resolution: %s mm

                                Sequential Sculpting Protocol:
                                1. Armature and Anatomical Primitive Blocking:
                                   - Create cranium (sphere), jaw (tapered cube), and neck (cylinder) primitives.
                                   - Position and scale to capture silhouette proportions.
                                   - Join into single compound object via 'cad_boolean_operation' (UNION).
                                2. Dynamic Voxel Remeshing:
                                   - Invoke 'cad_remesh_voxel' with voxelSize=%s mm to generate uniform manifold quad/tri surface topology.
                                3. Primary and Secondary Form Sculpting:
                                   - Call 'cad_sculpt_deform' with brush='clay' to build eyebrow ridges, zygomatic arches, and neck muscle strands.
                                   - Carve scale creases and horn wrinkles with brush='crease' and strength=0.8.
                                4. Symmetry Enforcement:
                                   - Call 'cad_symmetrize_mesh' along X axis to maintain anatomical symmetry.
                                5. MatCap Shader Assignment:
                                   - Query 'kosh://materials/catalog' and assign 'StudioClay' or 'Redwax Sculpt' shader for high-fidelity sculpting visualization.
                                """,
                                creature, voxelSize,
                                voxelSize
                        )
                );
            }

            case "generate_3d_printable_snapfit" -> {
                String beamLen = arg(args, "beamLengthMm", "15.0");
                String wall = arg(args, "wallThicknessMm", "2.0");
                String catchDepth = arg(args, "catchDepthMm", "1.2");
                String entryAngle = arg(args, "entryAngleDeg", "30.0");
                yield textPrompt(
                        "Parametric snap-fit engineering instructions for beam length " + beamLen + "mm",
                        String.format("""
                                SYSTEM BLUEPRINT: 3D PRINTABLE CANTILEVER SNAP-FIT JOINT PROTOCOL
                                Beam Length: %s mm | Wall: %s mm | Catch Depth: %s mm | Entry Angle: %s deg

                                Query Material Limits:
                                - Read 'kosh://guidelines/fdm-tolerances' (clearanceForMovingJointsMm: 0.4mm).
                                - Allowable strain limit for PLA/PETG is 1.0%% - 1.5%%. Max deflection Y = (epsilon * L^2) / (1.5 * h).

                                Sequential CAD Modeling:
                                1. Cantilever Beam Base:
                                   - Instantiate flexible cantilever arm of length %s mm and thickness %s mm via 'cad_create_primitive'.
                                2. Retention Hook Geometry:
                                   - Form retention catch with depth %s mm.
                                   - Slant entry lead-in face at %s degrees to minimize insertion force.
                                   - Set retention back-angle at 90 degrees for permanent lock, or 45 degrees for releasable joint.
                                3. Stress-Relief Root Fillet:
                                   - Apply a 1.0mm fillet to the cantilever beam root using 'cad_apply_fillet_chamfer' to eliminate stress risers.
                                4. Print Orientation Notice:
                                   - Orient the cantilever beam parallel to the 3D printer build plate (XY plane) so bending loads act along layer lines, preventing Z-seam layer delamination.
                                """,
                                beamLen, wall, catchDepth, entryAngle,
                                beamLen, wall,
                                catchDepth, entryAngle
                        )
                );
            }

            case "assemble_modular_puzzle_recipe" -> {
                String recipe = arg(args, "recipeName", "interlocking_dovetail_plate");
                String clearance = arg(args, "clearanceMm", "0.2");
                String scale = arg(args, "scaleMultiplier", "1.0");

                yield textPrompt(
                        "Modular puzzle piece assembly instructions for recipe '" + recipe + "'",
                        String.format("""
                                You are an expert Modular CAD Assembly and Kinematics Agent.
                                Target Recipe: %s (Clearance: %smm, Scale: %sx).

                                Assembly Protocol:
                                1. Inspect the Modular Puzzle Pieces catalog by querying resource 'kosh://library/puzzle-pieces'.
                                   - Note the exact socket mate normals, component envelope dimensions, and tolerance rules.
                                2. If the user's natural language request matches a turnkey compound assembly, invoke 'cad_assemble_puzzle_pieces':
                                   - recipe: '%s'
                                   - toleranceMm: %s
                                   - scale: %s
                                   - format: 'glb'
                                3. Inspect the resulting composite geometry via 'cad_inspect_scene':
                                   - Verify that all mating puzzle pieces form a single manifold solid with isWatertight=true.
                                   - Verify that slide clearances match the %smm tolerance for FDM 3D printing.
                                4. If custom puzzle pieces are requested that exceed pre-solved recipes:
                                   - Synthesize individual components with 'cad_create_primitive' and 'cad_boolean_operation'.
                                   - Align socket normals using transform offsets and join with 'cad_batch_csg' (operation='UNION').
                                """,
                                recipe, clearance, scale,
                                recipe, clearance, scale,
                                clearance
                        )
                );
            }

            case "optimize_model_for_3d_printing" -> {
                String meshName = arg(args, "meshName", "Part_A");
                String filament = arg(args, "filament", "PLA");
                String nozzle = arg(args, "nozzleDiameterMm", "0.4");
                String supportless = arg(args, "supportless", "false");

                yield textPrompt(
                        "3D print preparation workflow for '" + meshName + "' (" + filament + ")",
                        String.format("""
                                You are a 3D Print Preparation Agent. Target model: %s. Filament: %s. Nozzle: %smm. Supportless: %s.

                                Workflow:
                                1. Validate topology with 'cad_check_manifold' (targetMeshName='%s').
                                   - isWatertight must be true; if not, repair via 'cad_apply_modifier' (remesh) or boolean union with itself.
                                2. Derive print parameters from resource 'kosh://materials/filaments':
                                   - Nozzle/bed temperatures, shrinkage, and enclosure needs for %s.
                                   - Wall thickness >= 2x nozzle (%.1f mm minimum).
                                3. Fit check against resource 'kosh://specs/printers/build-volumes':
                                   - Confirm the bounding box fits the printer with a 5-10mm margin.
                                4. Orientation: if supportless=true, use 'Lay Flat' heuristics (largest flat face on bed, overhangs <= 45 deg)
                                   per resource 'kosh://guidelines/fdm-tolerances' (maxOverhangAngleDeg=45).
                                5. Apply terminal chamfers (0.3-0.5mm) on first-layer edges via 'cad_apply_fillet_chamfer' so elephant-foot is compensated.
                                6. Final gate: 'cad_inspect_scene' must report isWatertight=true before slicing.
                                """,
                                meshName, filament, nozzle, supportless,
                                meshName,
                                filament, Double.parseDouble(nozzle) * 2.0
                        )
                );
            }

            case "design_heat_set_insert_mount" -> {
                String threadSize = arg(args, "threadSize", "M3");
                String insertLen = arg(args, "insertLengthMm", "5.0");
                String mountCount = arg(args, "mountCount", "4");
                String pcd = arg(args, "patternPcdMm", "0");

                yield textPrompt(
                        "Heat-set insert boss design for " + threadSize + " inserts",
                        String.format("""
                                You are a Heat-Set Insert Mount Design Agent. Thread: %s. Insert length: %smm. Count: %s. PCD: %smm.

                                Protocol:
                                1. Read sizing ground truth from resource 'kosh://specs/hardware/heat-set-inserts':
                                   - holeDiaMm (printed hole), bossOuterDiaMm, engagementMm, wallMm for %s.
                                   - Installation: 230C iron, chamfered end first, 15s cooldown.
                                2. Model one boss with 'cad_create_primitive' (cylinder shell):
                                   - Inner hole = insert holeDiaMm; outer = bossOuterDiaMm; height >= insertLen + 1.0mm top cap clearance.
                                   - Leave wallMm of material to any free edge (see fitNotes).
                                3. Pattern: use 'cad_radial_array' if patternPcdMm > 0, else 'cad_linear_array'.
                                4. Union bosses into the mount body with 'cad_boolean_operation' (operation='UNION').
                                5. Validate with 'cad_check_manifold' (must be watertight) and export for printing with format 'stl'.
                                """,
                                threadSize, insertLen, mountCount, pcd, threadSize
                        )
                );
            }

            case "plan_linear_motion_stage" -> {
                String travel = arg(args, "travelMm", "200");
                String payload = arg(args, "payloadKg", "2.0");
                String drive = arg(args, "driveType", "belt");
                String buildVol = arg(args, "buildVolumeMm", "256,256,256");

                yield textPrompt(
                        "Linear motion stage planning for " + travel + "mm travel (" + drive + " drive)",
                        String.format("""
                                You are a Linear Motion Stage Architect. Travel: %smm. Payload: %skg. Drive: %s. Build volume: %smm.

                                Planning steps:
                                1. Size the rail/base: extrusion length >= travel + 2 x block length + 40mm for end-stops.
                                   - If extrusion exceeds the build volume (%s), split into printable segments and join with 'cad_batch_csg' (UNION).
                                2. Select drive from resource 'kosh://specs/hardware/metric-fasteners':
                                   - Belt: GT2 belt, 20T pulley (6.35mm/rev), NEMA17 mount with M3 clearance 3.4mm / tap 2.5mm.
                                   - Leadscrew: T8x2 or T8x8, anti-backlash nut, M3/M5 mounting pattern.
                                3. Rails: MGN9H for <= 2kg payload, MGN12H for 2-8kg; boss screw holes to 3.5mm clearance (M3).
                                4. Model in sub-assemblies with 'cad_create_primitive' + 'cad_assemble_kit':
                                   base extrusion, carriage plate, motor mount, idler bracket, end-stop tabs.
                                5. Verify full travel: 'cad_inspect_scene' sweep at 0%% and 100%% travel positions; no part may exceed build volume.
                                6. Export printable parts individually (format 'stl') via 'export_cad_artifact'.
                                """,
                                travel, payload, drive, buildVol,
                                buildVol
                        )
                );
            }

            default -> throw new IllegalArgumentException("Unknown prompt: " + name
                    + ". Call prompts/list to discover available blueprints.");
        };
    }

    private void register(String name, String description, List<Map<String, Object>> args) {
        Map<String, Object> prompt = new LinkedHashMap<>();
        prompt.put("name", name);
        prompt.put("description", description);
        prompt.put("arguments", args);
        promptsList.add(prompt);
    }

    private Map<String, Object> arg(String name, String description, boolean required) {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("name", name);
        a.put("description", description);
        a.put("required", required);
        return a;
    }

    private Map<String, Object> textPrompt(String description, String text) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("description", description);
        payload.put("messages", List.of(
                Map.of(
                        "role", "user",
                        "content", Map.of(
                                "type", "text",
                                "text", text.trim()
                        )
                )
        ));
        return payload;
    }

    private String arg(Map<String, Object> args, String key, String fallback) {
        Object v = args.get(key);
        return v != null && !v.toString().isBlank() ? v.toString() : fallback;
    }
}
