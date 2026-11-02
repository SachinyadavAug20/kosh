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
