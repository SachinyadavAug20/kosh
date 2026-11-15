/**
 * DirectorMcpTools.ts
 * MCP (Model Context Protocol) Tool Registry & JSON-RPC 2.0 Dispatcher for Kosh.
 * Exposes precision CAD, DCC sculpting, procedural animation, photoreal rendering,
 * and narrative direction tools conforming to the Model Context Protocol specification.
 */

export interface McpToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
  annotations: McpToolAnnotations;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  samplePayload: Record<string, any>;
}

export const DIRECTOR_MCP_TOOLS: McpToolDefinition[] = [
  // 1. Composable 3D CAD Tools
  {
    name: "cad_create_primitive",
    description: "Instantiates a precision parametric 3D CAD primitive (cube, cylinder, cone, sphere, torus) with dimensional constraints and PBR material.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["cube", "cylinder", "cone", "sphere", "torus"], description: "Primitive geometry type" },
        dimensions: { type: "array", items: { type: "number" }, description: "Dimensions in meters: [width, height, depth] for cube, or [radius, depth] for cylinder" },
        location: { type: "array", items: { type: "number" }, description: "World position [x, y, z] in meters" },
        name: { type: "string", description: "Entity identifier name" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format" },
      },
      required: ["type", "name"],
    },
    samplePayload: {
      type: "cylinder",
      dimensions: [0.5, 2.0],
      location: [0, 0, 1.0],
      name: "Hydraulic_Piston_Base",
      format: "glb",
    },
  },
  {
    name: "cad_boolean_operation",
    description: "Applies Constructive Solid Geometry (CSG) boolean operations (DIFFERENCE, UNION, INTERSECT) between two named meshes with exact manifold solver.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        baseMeshName: { type: "string", description: "Target base mesh name to receive boolean cut or union" },
        cutterMeshName: { type: "string", description: "Tool or cutter mesh name to apply to base" },
        operation: { type: "string", enum: ["DIFFERENCE", "UNION", "INTERSECT"], description: "CSG boolean operation type" },
        deleteCutter: { type: "boolean", description: "Whether to delete the cutter object after applying (default: true)" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format" },
      },
      required: ["baseMeshName", "cutterMeshName", "operation"],
    },
    samplePayload: {
      baseMeshName: "Hydraulic_Piston_Base",
      cutterMeshName: "Bore_Cutter",
      operation: "DIFFERENCE",
      deleteCutter: true,
      format: "glb",
    },
  },
  {
    name: "cad_apply_modifier",
    description: "Applies parametric CAD modifier operations (BEVEL, SUBSURF, MIRROR, SOLIDIFY) to a named mesh with exact numerical parameters.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of mesh to apply modifier to" },
        modifierType: { type: "string", enum: ["BEVEL", "SUBSURF", "MIRROR", "SOLIDIFY"], description: "Type of modifier to apply" },
        properties: { type: "object", description: "Modifier attributes (e.g. { width: 0.05, segments: 3 })" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format" },
      },
      required: ["targetMeshName", "modifierType"],
    },
    samplePayload: {
      targetMeshName: "Hydraulic_Piston_Base",
      modifierType: "BEVEL",
      properties: { width: 0.02, segments: 3 },
      format: "glb",
    },
  },
  {
    name: "cad_inspect_scene",
    description: "Inspects active 3D scene topology: returns mesh count, vertex count, face count, bounding boxes, dimensions, and manifold/watertight status.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMesh: { type: "string", description: "Optional name of specific mesh to inspect; if omitted, inspects entire scene" },
        includeWatertightCheck: { type: "boolean", description: "Whether to perform watertight manifold validation" },
      },
    },
    samplePayload: {
      targetMesh: "Hydraulic_Piston_Base",
      includeWatertightCheck: true,
    },
  },
  {
    name: "cad_measure_dimensions",
    description: "High-precision digital caliper measuring bounding box (X/Y/Z), surface area, volume, center of mass, and 3D printing overhang angle analysis.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMesh: { type: "string", description: "Optional name of mesh to measure" },
        unit: { type: "string", enum: ["mm", "cm", "m", "inches"], description: "Measurement units (default: mm)" },
      },
    },
    samplePayload: {
      targetMesh: "Hydraulic_Piston_Base",
      unit: "mm",
    },
  },
  {
    name: "cad_hollow_shell",
    description: "Creates a parametric hollow shell with uniform wall thickness and optional drain holes for resin/powder 3D printing.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Target mesh name to shell" },
        wallThicknessMm: { type: "number", description: "Uniform wall thickness in millimeters (default: 2.0)" },
        drainHoleRadiusMm: { type: "number", description: "Radius of optional drain hole in millimeters" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format" },
      },
      required: ["targetMeshName"],
    },
    samplePayload: {
      targetMeshName: "Hydraulic_Piston_Base",
      wallThicknessMm: 2.0,
      drainHoleRadiusMm: 2.5,
      format: "glb",
    },
  },
  {
    name: "cad_generate_threads",
    description: "Designs precision parametric ISO metric screw threads, bolts, and nuts with standardized pitch, root radius, and clearance.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        threadType: { type: "string", enum: ["bolt", "nut", "rod"], description: "Fastener geometry type (default: bolt)" },
        diameterMm: { type: "number", description: "Nominal major diameter in mm (e.g. 10 for M10)" },
        pitchMm: { type: "number", description: "Thread pitch in mm (default: 1.5)" },
        lengthMm: { type: "number", description: "Threaded shaft length in mm (default: 30.0)" },
        hexHead: { type: "boolean", description: "Whether to include ISO metric standard hexagonal drive head" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format" },
      },
    },
    samplePayload: {
      threadType: "bolt",
      diameterMm: 10.0,
      pitchMm: 1.5,
      lengthMm: 35.0,
      hexHead: true,
      format: "glb",
    },
  },
  {
    name: "cad_lattice_infill",
    description: "Synthesizes procedural internal lattice infills (gyroid, honeycomb, wireframe) for lightweight additive manufacturing and aerospace structures.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Target mesh name to apply lattice infill" },
        latticeType: { type: "string", enum: ["wireframe", "honeycomb", "voronoi"], description: "Lattice infill geometry type" },
        thicknessMm: { type: "number", description: "Strut or wireframe thickness in mm" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format" },
      },
      required: ["targetMeshName"],
    },
    samplePayload: {
      targetMeshName: "Structural_Support_Bracket",
      latticeType: "wireframe",
      thicknessMm: 1.5,
      format: "glb",
    },
  },
  {
    name: "cad_apply_fillet_chamfer",
    description: "Applies edge rounding (fillet) or metric beveling to an existing named mesh via a parametric BEVEL modifier, without rewriting the entire mesh.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetObjectName: { type: "string", description: "Name of the mesh object to bevel" },
        offsetMm: { type: "number", description: "Bevel distance in millimeters (default: 2.0)" },
        segments: { type: "integer", description: "Bevel segment count (1 = flat chamfer, 3+ = rounded fillet)" },
        affectOnlyEdges: { type: "boolean", description: "Limit bevel to sharp edges only" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format" },
      },
      required: ["targetObjectName"],
    },
    samplePayload: {
      targetObjectName: "Hydraulic_Piston_Base",
      offsetMm: 2.5,
      segments: 3,
      affectOnlyEdges: true,
      format: "glb",
    },
  },

  // 2. Instant Assembly & Kitbashing
  {
    name: "cad_assemble_kit",
    description: "Instantly assembles a pre-baked parametric kitbashing template (industrial flange, quadcopter frame, sci-fi panel, structural truss, low-poly tree) in <10ms with zero LLM latency.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        kitCategory: {
          type: "string",
          enum: ["industrial_flange", "quadcopter_frame", "scifi_panel", "structural_truss", "lowpoly_tree"],
          description: "Kit template category to spawn",
        },
        parameters: {
          type: "object",
          properties: {
            scale: { type: "number", description: "Uniform scale multiplier" },
            boltCount: { type: "integer", description: "Fastener count or bay count" },
            hollow: { type: "boolean", description: "Open/shell construction" },
          },
        },
        targetPosition: { type: "array", items: { type: "number" }, description: "World placement [x, y, z]" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format" },
      },
      required: ["kitCategory"],
    },
    samplePayload: {
      kitCategory: "industrial_flange",
      parameters: { scale: 1.0, boltCount: 8, hollow: true },
      targetPosition: [0, 0, 0],
      format: "glb",
    },
  },
  {
    name: "cad_assemble_puzzle_pieces",
    description: "Assembles modular CAD puzzle pieces into a composite solid matching pre-solved recipes (interlocking dovetail plate, articulated robot arm, modular cube chassis, geodesic hex truss, bearing transmission carrier) with exact socket alignment and 0.2mm FDM tolerances.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        recipe: {
          type: "string",
          enum: [
            "interlocking_dovetail_plate",
            "robotic_articulated_arm",
            "modular_cube_chassis",
            "geodesic_hex_truss",
            "bearing_transmission_carrier",
          ],
          description: "Assembly recipe joining modular puzzle pieces to satisfy user query",
        },
        toleranceMm: { type: "number", description: "Mating joint slide-fit clearance in millimeters (default: 0.2)" },
        scale: { type: "number", description: "Uniform scaling factor applied to all assembled pieces" },
        targetPosition: { type: "array", items: { type: "number" }, description: "World placement [x, y, z]" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format" },
      },
      required: ["recipe"],
    },
    samplePayload: {
      recipe: "interlocking_dovetail_plate",
      toleranceMm: 0.2,
      scale: 1.0,
      targetPosition: [0, 0, 0],
      format: "glb",
    },
  },
  {
    name: "cad_batch_csg",
    description: "Executes a base primitive plus a sequential array of CSG boolean operations (DIFFERENCE, UNION, INTERSECT) in one single transaction round-trip.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        baseShape: { type: "string", enum: ["box", "cylinder", "sphere"], description: "Foundational solid primitive" },
        baseDimensions: { type: "array", items: { type: "number" }, description: "Base dimensions" },
        operations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["DIFFERENCE", "UNION", "INTERSECT"] },
              shape: { type: "string", enum: ["cylinder", "box", "slot", "chamfer"] },
              transform: { type: "array", items: { type: "number" } },
              scale: { type: "array", items: { type: "number" } },
            },
            required: ["op", "shape", "transform"],
          },
        },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format" },
      },
      required: ["baseShape", "baseDimensions", "operations"],
    },
    samplePayload: {
      baseShape: "cylinder",
      baseDimensions: [1.0, 2.0],
      operations: [
        { op: "DIFFERENCE", shape: "cylinder", transform: [0, 0, 0], scale: [0.5, 3.0] },
      ],
      format: "glb",
    },
  },
  {
    name: "cad_synthesize_composite",
    description: "Synthesizes a complete multi-part 3D CAD composite assembly from natural language with specified aesthetic style and target export format.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Natural language specification describing the assembly" },
        style: { type: "string", enum: ["low_poly", "mechanical_cad", "smooth_organic"], description: "Geometric aesthetic style" },
        targetFormat: { type: "string", enum: ["glb", "stl", "obj"], description: "Output format" },
      },
      required: ["prompt"],
    },
    samplePayload: {
      prompt: "Planetary gearbox mechanism with sun gear, planet carriers, and ring casing",
      style: "mechanical_cad",
      targetFormat: "glb",
    },
  },
  {
    name: "cad_compose_compound_scene",
    description: "Composes a rich compound 3D scene (e.g. subject situated in cosmic environments with planetary rings and glowing crystals).",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Main subject: cat, dog, elephant, astronaut, car, robot" },
        environment: { type: "string", description: "Environment theme: space, moon, asteroid, orbit" },
        targetFormat: { type: "string", enum: ["glb", "stl", "obj"], description: "Output format" },
      },
      required: ["subject", "environment"],
    },
    samplePayload: {
      subject: "astronaut",
      environment: "moon",
      targetFormat: "glb",
    },
  },
  {
    name: "scene_assembler",
    description: "Assembles complex multi-asset 3D environments, modular architecture, and ambient staging.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Scene composition specification" },
        format: { type: "string", enum: ["glb", "stl", "obj"] },
      },
    },
    samplePayload: {
      prompt: "Sci-fi command bridge with holographic consoles and elevated observation deck",
      format: "glb",
    },
  },

  // 3. Photorealistic Rendering & Studio Lighting
  {
    name: "cad_render_frame",
    description: "Executes an actual physically-based raytraced render using Blender EEVEE or Cycles with studio lighting and camera framing.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        assetName: { type: "string", description: "Optional existing asset file name to render" },
        resolutionX: { type: "integer", description: "Render width in pixels" },
        resolutionY: { type: "integer", description: "Render height in pixels" },
        engine: { type: "string", enum: ["eevee", "cycles"], description: "Blender render engine" },
        transparentBg: { type: "boolean", description: "Render with transparent alpha background" },
      },
    },
    samplePayload: {
      assetName: "Hydraulic_Piston_Base.glb",
      resolutionX: 1920,
      resolutionY: 1080,
      engine: "eevee",
      transparentBg: true,
    },
  },
  {
    name: "blender_render_frame",
    description: "High-resolution raytraced render capture of active 3D models with transparent background, studio lighting rigs, and lens framing.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        assetName: { type: "string", description: "Asset file name to capture" },
        resolutionX: { type: "integer", description: "Width in pixels" },
        resolutionY: { type: "integer", description: "Height in pixels" },
      },
    },
    samplePayload: {
      assetName: "kosh_sample.glb",
      resolutionX: 1920,
      resolutionY: 1080,
    },
  },
  {
    name: "cad_studio_lighting_preset",
    description: "Configures turnkey professional photographic studio lighting rigs (3-Point Classic, Cyberpunk Neon, Product Softbox, Dramatic Rim, Daylight Studio) and cyclorama backdrop.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        lightingRig: { type: "string", enum: ["three_point", "cyberpunk_neon", "product_softbox", "dramatic_rim", "daylight_studio"], description: "Lighting rig archetype" },
        intensity: { type: "number", description: "Global light power multiplier (default 1.0)" },
        backdrop: { type: "boolean", description: "Include seamless cyclorama infinity backdrop" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format" },
      },
      required: ["lightingRig"],
    },
    samplePayload: {
      lightingRig: "three_point",
      intensity: 1.0,
      backdrop: true,
      format: "glb",
    },
  },
  {
    name: "cad_apply_pbr_preset",
    description: "Assigns pre-calibrated engineering and aesthetic PBR shader materials (Matte Titanium, Carbon Fiber, Glass, Gold, Chrome, Obsidian, Copper, Ceramic) with physically accurate optical parameters.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        preset: { type: "string", enum: ["titanium", "carbon_fiber", "glass", "gold", "chrome", "obsidian", "copper", "ceramic", "car_paint", "matte_stealth"], description: "PBR material preset" },
        targetMeshName: { type: "string", description: "Optional name of target mesh to shade" },
        roughnessMultiplier: { type: "number", description: "Roughness adjustment multiplier" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format" },
      },
      required: ["preset"],
    },
    samplePayload: {
      preset: "titanium",
      targetMeshName: "Hydraulic_Piston_Base",
      roughnessMultiplier: 1.0,
      format: "glb",
    },
  },
  {
    name: "cad_batch_multiview_render",
    description: "Renders 4-view orthographic and isometric engineering blueprint frames (Top, Front, Right, Isometric) in a single pass.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        assetName: { type: "string", description: "Optional existing asset file name to render" },
        resolution: { type: "integer", description: "Square resolution per view tile (default: 1024)" },
      },
    },
    samplePayload: {
      assetName: "Hydraulic_Piston_Base.glb",
      resolution: 1024,
    },
  },
  {
    name: "lighting_studio",
    description: "Generates professional 3-point photographic studio lighting rigs, cyclorama infinity backdrops, and cinematic staging.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Studio lighting specifications" },
        format: { type: "string", enum: ["glb", "stl", "obj"] },
      },
    },
    samplePayload: {
      prompt: "Warm dramatic rim lighting with 800W key light and dark reflective ground plane",
      format: "glb",
    },
  },
  {
    name: "material_shader",
    description: "Generates advanced procedural PBR shader node graphs using Principled BSDF, Voronoi/Noise textures, and metallic sheen.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "PBR shader description" },
        format: { type: "string", enum: ["glb", "stl", "obj"] },
      },
    },
    samplePayload: {
      prompt: "Anodized purple titanium with subtle procedural surface roughness wear",
      format: "glb",
    },
  },
  {
    name: "camera_compositor",
    description: "Deploys cinematic camera director rigs: 360-degree turntable orbits, dolly-in tracking shots, and macro lenses.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Camera movement and lens parameters" },
        format: { type: "string", enum: ["glb", "stl", "obj"] },
      },
    },
    samplePayload: {
      prompt: "360-degree turntable orbital sweep at 45 degree elevation with 50mm lens",
      format: "glb",
    },
  },

  // 4. Digital Sculpting & BMesh DCC Operations
  {
    name: "blender_sculpt_op",
    description: "Digital Sculpting & Dynamic Topology Engine: Execute digital sculpting brushes or procedural BMesh organic displacement.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        brush_type: { type: "string", enum: ["clay", "crease", "inflate", "grab", "smooth", "flatten", "pinch"] },
        strength: { type: "number", description: "Brush deformation strength (0.0 to 2.0)" },
        radius: { type: "number", description: "Brush radius in meters" },
        voxel_remesh_size: { type: "number", description: "Target voxel size for remeshing" },
      },
    },
    samplePayload: {
      brush_type: "clay",
      strength: 0.8,
      radius: 0.25,
      voxel_remesh_size: 0.04,
    },
  },
  {
    name: "blender_mesh_ops",
    description: "Advanced BMesh Operations: Execute exact manifold CSG Booleans, chamfer bevels, wall solidification, remeshing, and decimation.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["boolean", "bevel", "solidify", "remesh", "convex_hull", "weld", "decimate"] },
        parameters_json: { type: "string", description: "JSON-encoded parameters for operation" },
      },
    },
    samplePayload: {
      operation: "remesh",
      parameters_json: '{"voxel_size": 0.02}',
    },
  },
  {
    name: "blender_uv_paint",
    description: "Texture Baking & Vertex Colors: Automates Smart UV Project unwrapping, baking normal maps, and generating Vertex Color layers.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        unwrap_method: { type: "string", enum: ["smart_project", "lightmap", "cube"] },
        vertex_color_palette: { type: "string", description: "Color theme or palette name" },
        bake_type: { type: "string", enum: ["normals", "roughness", "ambient_occlusion"] },
      },
    },
    samplePayload: {
      unwrap_method: "smart_project",
      vertex_color_palette: "industrial_warning",
    },
  },
  {
    name: "blender_sculpt",
    description: "Generates organic sculpted meshes, dynamic topology surfaces, procedural noise micro-displacements, and natural terrain.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Organic sculpt prompt" },
        format: { type: "string", enum: ["glb", "stl", "obj"] },
      },
    },
    samplePayload: {
      prompt: "Stylized organic crystalline dragon skull with micro-faceting",
      format: "glb",
    },
  },
  {
    name: "mesh_modifier",
    description: "Executes advanced parametric mesh transformations using Blender modifier stack: Booleans, Subdivision, Solidify, Arrays, Mirror.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Modifier stack instruction" },
        format: { type: "string", enum: ["glb", "stl", "obj"] },
      },
    },
    samplePayload: {
      prompt: "Radial circular array of 8 cooling fins with 2mm thickness and 1mm bevel",
      format: "glb",
    },
  },
  {
    name: "blender_mesh",
    description: "Generate procedural 3D meshes, multi-part objects, and scenes in Blender using Google Gemini and headless bpy code.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Procedural mesh specification" },
        format: { type: "string", enum: ["glb", "stl", "obj"] },
      },
    },
    samplePayload: {
      prompt: "Retro sci-fi laser turret with articulated dual barrels",
      format: "glb",
    },
  },
  {
    name: "cad_model",
    description: "Generate precision parametric mechanical CAD components with exact CSG boolean operations, metric dimensions, and bevels.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Precision mechanical component prompt" },
        format: { type: "string", enum: ["glb", "stl", "obj"] },
      },
    },
    samplePayload: {
      prompt: "Precision NEMA 17 stepper motor mounting bracket with slotted tension holes",
      format: "glb",
    },
  },

  // 5. Procedural Animation & Physics
  {
    name: "blender_animate_pipeline",
    description: "Procedural Animation & Physics Simulation Pipeline: Generate baked keyframed rigid body gravity drops, cloth drapery, and turntable sweeps.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        animation_type: { type: "string", enum: ["turntable", "explode", "rigidbody_fall", "cloth_drop", "wave_deform"] },
        frame_count: { type: "integer", description: "Total animation duration in frames (default 120)" },
        loop: { type: "boolean", description: "Whether the motion should form a seamless loop" },
      },
    },
    samplePayload: {
      animation_type: "turntable",
      frame_count: 120,
      loop: true,
    },
  },
  {
    name: "blender_animation",
    description: "Generate keyframed procedural 3D animations, skeletal armatures, gear trains, and kinetic motion tracks.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Animation track instructions" },
        format: { type: "string", enum: ["glb", "stl", "obj"] },
      },
    },
    samplePayload: {
      prompt: "Intermeshing spur gear pair rotating at 1:2 ratio across 180 frames",
      format: "glb",
    },
  },
  {
    name: "physics_simulation",
    description: "Simulate rigid body dynamics, falling polyhedra, passive colliders, and gravitational physics.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Physics simulation setup" },
        format: { type: "string", enum: ["glb", "stl", "obj"] },
      },
    },
    samplePayload: {
      prompt: "Cluster of 12 low-poly gemstone dice falling onto a marble floor collider",
      format: "glb",
    },
  },
  {
    name: "rigging_armature",
    description: "Construct skeletal bone armatures, kinematic chains, and automatic vertex skinning.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Armature rigging specification" },
        format: { type: "string", enum: ["glb", "stl", "obj"] },
      },
    },
    samplePayload: {
      prompt: "Two-segment robotic arm with base swivel and elbow hinge",
      format: "glb",
    },
  },
  {
    name: "geometry_nodes",
    description: "Generate procedural Geometry Node networks, point scattering, and algorithmic distribution.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Geometry Nodes procedural algorithm" },
        format: { type: "string", enum: ["glb", "stl", "obj"] },
      },
    },
    samplePayload: {
      prompt: "Procedural crystalline geodes scattered along a curved surface path",
      format: "glb",
    },
  },

  // 6. Multi-Domain Creative Tools
  {
    name: "kosh_svg_to_3d",
    description: "Extrudes 2D SVG paths, bezier contours, or typography into watertight 3D models with customizable bevel depth.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        svg_data: { type: "string", description: "Raw SVG XML path markup" },
        extrude_depth: { type: "number", description: "Extrusion depth in meters (default 0.15m)" },
        bevel_radius: { type: "number", description: "Edge bevel radius (default 0.02m)" },
      },
    },
    samplePayload: {
      extrude_depth: 0.15,
      bevel_radius: 0.02,
    },
  },
  {
    name: "kosh_audio_reactive",
    description: "Procedural Audio-Reactive Visualizer: Synthesizes kinetic 3D waveform rings or frequency spectrum bars.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        waveform_type: { type: "string", enum: ["circular_spectrum", "frequency_bars", "pulsing_ring"] },
        ring_count: { type: "integer", description: "Number of concentric spectrum rings (default 12)" },
        amplitude: { type: "number", description: "Peak amplitude scale (default 1.5)" },
      },
    },
    samplePayload: {
      waveform_type: "circular_spectrum",
      ring_count: 12,
      amplitude: 1.5,
    },
  },
  {
    name: "kosh_ascii_to_voxel",
    description: "Transforms text-based ASCII matrix art or 2D pixel grids into multi-colored 3D voxel monuments.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        ascii_grid: { type: "string", description: "Multi-line ASCII character grid" },
        palette_map: { type: "string", description: "Color map for ASCII symbols" },
      },
    },
    samplePayload: {
      ascii_grid: "  ***  \n ***** \n*******\n ***** \n  ***  ",
      palette_map: '{"*": "#ea580c"}',
    },
  },
  {
    name: "kosh_cad_export_step",
    description: "Universal Mechanical CAD Generator: Designs watertight engineering parts with metric bores and bolt circles.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        part_type: { type: "string", enum: ["spur_gear", "flange_bearing", "stepper_mount", "heatsink_extrusion"] },
        dimensions: { type: "string", description: "JSON-encoded dimensional constraints in millimeters" },
      },
    },
    samplePayload: {
      part_type: "flange_bearing",
      dimensions: '{"bore": 20, "outer_diameter": 47, "flange_thickness": 6}',
    },
  },
  {
    name: "create_parametric_primitive",
    description: "Creates parametric CAD primitives with dimensional constraints, bevel radius, and segment counts.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        primitive_type: { type: "string", enum: ["cube", "cylinder", "cone", "sphere", "torus"] },
        radius: { type: "number", description: "Radius in meters" },
        depth: { type: "number", description: "Depth in meters" },
      },
    },
    samplePayload: {
      primitive_type: "cylinder",
      radius: 0.5,
      depth: 2.0,
    },
  },
  {
    name: "apply_boolean_op",
    description: "Applies CSG operations: difference, union, or intersect with exact manifold solver.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["difference", "union", "intersect"] },
        target_mesh: { type: "string", description: "Base object" },
        tool_mesh: { type: "string", description: "Cutter or joiner" },
      },
    },
    samplePayload: {
      operation: "difference",
      target_mesh: "Base_Block",
      tool_mesh: "Hole_Cutter",
    },
  },
  {
    name: "extrude_profile_2d",
    description: "Extrudes 2D coordinate polyline profiles along an axis vector with customizable bevel depth.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        profile_name: { type: "string", description: "Profile geometry name" },
        extrude_height: { type: "number", description: "Extrusion height in meters" },
      },
    },
    samplePayload: {
      profile_name: "T_Slot_Profile",
      extrude_height: 1.0,
    },
  },
  {
    name: "inspect_geometry",
    description: "Analyzes 3D mesh manifold topology: calculates volume, bounding box, vertex count, and watertight status.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        target_mesh: { type: "string", description: "Name of mesh to inspect" },
      },
    },
    samplePayload: {
      target_mesh: "Base_Block",
    },
  },
  {
    name: "apply_pbr_material",
    description: "Configures and assigns PBR Principled BSDF shader attributes (color, roughness, metalness, emission).",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        target_mesh: { type: "string", description: "Target object name" },
        color: { type: "string", description: "Hex color string" },
        roughness: { type: "number", description: "Surface roughness (0.0 to 1.0)" },
        metalness: { type: "number", description: "Metallic reflection (0.0 to 1.0)" },
      },
    },
    samplePayload: {
      target_mesh: "Base_Block",
      color: "#ea580c",
      roughness: 0.35,
      metalness: 0.85,
    },
  },
  {
    name: "export_cad_artifact",
    description: "Exports active CAD model or selected mesh to watertight .GLB, .OBJ, or .STL with clean normals.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        export_format: { type: "string", enum: ["glb", "stl", "obj"] },
      },
    },
    samplePayload: {
      export_format: "glb",
    },
  },

  // 7. Mesh Repair & Precision CAD Operations
  {
    name: "cad_align_snap_objects",
    description: "Surgically aligns or snaps target object to a reference object along X, Y, Z, ground plane, or top-stack.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of mesh to move/align" },
        alignmentAxis: { type: "string", enum: ["x", "y", "z", "all"], description: "Axis to align along (default all)" },
        alignmentMode: { type: "string", enum: ["MIN", "MAX", "CENTER", "STACK_TOP", "STACK_BOTTOM"], description: "Alignment mode (default CENTER)" },
        offsetMm: { type: "number", description: "Clearance gap offset in millimeters (default 0.0)" },
        referenceMeshName: { type: "string", description: "Reference anchor mesh (defaults to first other scene mesh)" },
      },
    },
    samplePayload: {
      targetMeshName: "Hydraulic_Piston_Base",
      alignmentAxis: "z",
      alignmentMode: "STACK_TOP",
      offsetMm: 0.5,
      referenceMeshName: "Mounting_Bracket",
    },
  },
  {
    name: "cad_bisect_slice",
    description: "Surgically slices a mesh along an arbitrary cutting plane with optional cap fill to maintain watertight manifold 3D printing topology.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of mesh to slice" },
        clearInner: { type: "boolean", description: "Remove geometry behind cutting plane (default false)" },
        clearOuter: { type: "boolean", description: "Remove geometry in front of cutting plane (default true)" },
        fillCap: { type: "boolean", description: "Cap cut boundary with planar manifold n-gon (default true)" },
        planeNormal: { type: "array", items: { type: "number" }, description: "Normal vector of plane [nx, ny, nz] (default [0, 0, 1])" },
        planePoint: { type: "array", items: { type: "number" }, description: "Point on cutting plane [x, y, z] in meters (default [0, 0, 0])" },
      },
    },
    samplePayload: {
      targetMeshName: "Hydraulic_Piston_Base",
      clearInner: false,
      clearOuter: true,
      fillCap: true,
      planeNormal: [0, 0, 1],
      planePoint: [0, 0, 0.4],
    },
  },
  {
    name: "cad_decimate_mesh",
    description: "Surgically reduces polygon count of high-density meshes while preserving sharp feature boundaries, UV seams, and manifold volume.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of mesh to decimate" },
        mode: { type: "string", enum: ["collapse", "unsubdivide", "planar"], description: "Decimation algorithm (default collapse)" },
        ratio: { type: "number", description: "Polygon reduction ratio between 0.05 and 0.95 (default 0.5)" },
      },
    },
    samplePayload: {
      targetMeshName: "High_Poly_Scan",
      mode: "collapse",
      ratio: 0.35,
    },
  },
  {
    name: "cad_deform_taper_twist",
    description: "Surgically applies nonlinear parametric spatial deformation (taper, twist, bend, stretch) along a chosen axis.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of mesh to deform" },
        axis: { type: "string", enum: ["x", "y", "z"], description: "Deformation axis (default z)" },
        deformType: { type: "string", enum: ["TAPER", "TWIST", "BEND", "STRETCH"], description: "Spatial deformation method (default TAPER)" },
        factor: { type: "number", description: "Deformation intensity factor or angle in radians (default 0.5)" },
      },
    },
    samplePayload: {
      targetMeshName: "Hydraulic_Piston_Base",
      axis: "z",
      deformType: "TWIST",
      factor: 0.75,
    },
  },
  {
    name: "cad_delete_submesh",
    description: "Surgically excises an unwanted mesh component, stand, or loose debris by name or by minimum volume threshold.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of specific object to excise (if omitted, cleans debris)" },
        deleteLoose: { type: "boolean", description: "Delete small loose disconnected islands (default false)" },
        minVolumeM3: { type: "number", description: "Minimum volume threshold in cubic meters for loose debris cleanup (default 0.001)" },
      },
    },
    samplePayload: {
      targetMeshName: "Assembly_Composite",
      deleteLoose: true,
      minVolumeM3: 0.001,
    },
  },
  {
    name: "cad_download_online_model",
    description: "Downloads and caches a 3D model (GLB) from the online catalog or direct URL, with optional procedural modifications (e.g. bevels, gold material, hollow shell).",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        modelId: { type: "string", description: "Model identifier from catalog (e.g. 'base_duck', 'base_buggy', 'base_guitar') or direct http/https GLB URL" },
      },
      required: ["modelId"],
    },
    samplePayload: {
      format: "glb",
      modelId: "base_duck",
      prompt: "Add gold finish with bevels",
    },
  },
  {
    name: "cad_explode_assembly_view",
    description: "Generates an exploded technical assembly view radiating all scene components outward from assembly center of mass.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        axis: { type: "string", enum: ["RADIAL", "X", "Y", "Z"], description: "Explosion displacement trajectory (default RADIAL)" },
        explosionFactor: { type: "number", description: "Radial expansion multiplier (1.0 = nominal, 1.8 = standard exploded, default 1.5)" },
      },
    },
    samplePayload: {
      axis: "RADIAL",
      explosionFactor: 1.8,
    },
  },
  {
    name: "cad_extrude_face_region",
    description: "Surgically extrudes planar surface faces along their normal or world axis to create mounting bosses, standoffs, or push-pull recesses.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of mesh to extrude" },
        axis: { type: "string", enum: ["normal", "x", "y", "z"], description: "Extrusion direction axis (default normal)" },
        distanceMm: { type: "number", description: "Extrusion distance in millimeters (positive = protrusion, negative = recess, default 5.0)" },
      },
    },
    samplePayload: {
      targetMeshName: "Hydraulic_Piston_Base",
      axis: "normal",
      distanceMm: 6.0,
    },
  },
  {
    name: "cad_fill_holes",
    description: "Surgically caps and patches open perimeter boundary hole loops on non-manifold geometry for 3D print watertightness.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of mesh to cap holes" },
        maxSides: { type: "number", description: "Maximum perimeter edges per hole to fill (default 100)" },
      },
    },
    samplePayload: {
      targetMeshName: "Non_Manifold_Bracket",
      maxSides: 100,
    },
  },
  {
    name: "cad_flip_recalculate_normals",
    description: "Surgically repairs topological polygon face orientations by recalculating consistent outward normals or inverting normals.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of mesh to repair normals" },
        mode: { type: "string", enum: ["OUTSIDE", "INSIDE", "FLIP"], description: "Normal orientation mode (default OUTSIDE)" },
      },
    },
    samplePayload: {
      targetMeshName: "Non_Manifold_Bracket",
      mode: "OUTSIDE",
    },
  },
  {
    name: "cad_generate_helical_spring",
    description: "Generates a precision mechanical compression/extension coil spring with specified wire gauge, pitch, and coil count.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        activeCoils: { type: "number", description: "Number of active helical revolutions (default 6.0)" },
        groundEnds: { type: "boolean", description: "Ground/squared flat end coils (default true)" },
        outerDiameterMm: { type: "number", description: "Outer coil diameter in millimeters (default 20.0)" },
        pitchMm: { type: "number", description: "Helical coil pitch in millimeters (default 6.0)" },
        wireDiameterMm: { type: "number", description: "Wire gauge diameter in millimeters (default 2.5)" },
      },
    },
    samplePayload: {
      activeCoils: 8.0,
      groundEnds: true,
      outerDiameterMm: 24.0,
      pitchMm: 6.0,
      wireDiameterMm: 3.0,
    },
  },
  {
    name: "cad_generate_o_ring_groove",
    description: "Surgically carves a precision fluid/pressure sealing O-ring gland channel into a shaft or cylinder bore.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of shaft/bore cylinder mesh" },
        axialPositionM: { type: "number", description: "Z-height axial position of groove center in meters (default 0.0)" },
        grooveDepthMm: { type: "number", description: "Radial groove cut depth in millimeters (default 2.0)" },
        grooveWidthMm: { type: "number", description: "Channel axial width in millimeters (default 3.0)" },
        isInternalBore: { type: "boolean", description: "True for internal bore gland, false for external piston/shaft gland (default false)" },
      },
    },
    samplePayload: {
      targetMeshName: "Hydraulic_Piston_Base",
      axialPositionM: 0.05,
      grooveDepthMm: 2.2,
      grooveWidthMm: 3.4,
      isInternalBore: false,
    },
  },
  {
    name: "cad_loft_curves",
    description: "Generates a parametric ruled surface loft or transitional skin between bottom and top cross-section profiles.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        bottomRadiusM: { type: "number", description: "Bottom base radius in meters (default 1.0)" },
        heightM: { type: "number", description: "Total loft height in meters (default 2.0)" },
        profileType: { type: "string", enum: ["CIRCLE", "RECTANGLE", "ELLIPSE", "AIRFOIL"], description: "Cross-section shape profile (default CIRCLE)" },
        topRadiusM: { type: "number", description: "Top opening radius in meters (default 0.5)" },
        twistAngleDeg: { type: "number", description: "Twist angle rotation in degrees (default 0.0)" },
      },
    },
    samplePayload: {
      bottomRadiusM: 1.0,
      heightM: 2.0,
      profileType: "CIRCLE",
      topRadiusM: 0.4,
      twistAngleDeg: 45.0,
    },
  },
  {
    name: "cad_mirror_symmetry",
    description: "Surgically mirrors geometry across coordinate planes (X, Y, Z) with auto-bisection and vertex seam welding.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of mesh to mirror" },
        axis: { type: "string", enum: ["x", "y", "z"], description: "Symmetry plane axis (default x)" },
        bisect: { type: "boolean", description: "Bisect half geometry before mirroring (default true)" },
        weldThreshold: { type: "number", description: "Seam merge threshold in meters (default 0.002)" },
      },
    },
    samplePayload: {
      targetMeshName: "Hydraulic_Piston_Base",
      axis: "x",
      bisect: true,
      weldThreshold: 0.002,
    },
  },
  {
    name: "cad_quick_fillet_chamfer",
    description: "Alias of cad_apply_fillet_chamfer: quickly rounds or chamfers selected edges of a mesh with exact radius control.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of the mesh to fillet/chamfer" },
        mode: { type: "string", enum: ["fillet", "chamfer"], description: "Rounded fillet or flat chamfer (default fillet)" },
        radiusMm: { type: "number", description: "Fillet/chamfer radius in millimeters (default 1.0)" },
        segments: { type: "number", description: "Curve segment count (default 3)" },
      },
    },
    samplePayload: {
      targetMeshName: "Hydraulic_Piston_Base",
      mode: "fillet",
      radiusMm: 2.0,
      segments: 4,
    },
  },
  {
    name: "cad_recolor_part",
    description: "Surgically overrides PBR surface material properties on a target component (hex color, roughness, metalness, and emission).",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of mesh to recolor" },
        emissionColor: { type: "string", description: "Optional glow color hex code" },
        emissionStrength: { type: "number", description: "Emission intensity multiplier (default 0.0)" },
        hexColor: { type: "string", description: "HEX color string, e.g. '#ef4444' (red), '#f59e0b' (gold), '#18181b' (black), '#06b6d4' (cyan)" },
        metalness: { type: "number", description: "Metallic sheen 0.0 (dielectric) to 1.0 (metal), default 0.8" },
        roughness: { type: "number", description: "Surface roughness 0.0 (mirror) to 1.0 (matte), default 0.3" },
      },
    },
    samplePayload: {
      targetMeshName: "Hydraulic_Piston_Base",
      emissionStrength: 0.0,
      hexColor: "#f59e0b",
      metalness: 0.9,
      roughness: 0.25,
    },
  },
  {
    name: "cad_scale_to_bounding_box",
    description: "Surgically scales a model or component to exact real-world dimensions in millimeters or uniform max bounding box.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of mesh to scale" },
        targetDimensionsMm: { type: "array", items: { type: "number" }, description: "Target bounding dimensions [x, y, z] in millimeters" },
        uniformMaxMm: { type: "number", description: "Uniform maximum dimension in millimeters (overrides targetDimensionsMm if set)" },
      },
    },
    samplePayload: {
      targetMeshName: "Imported_STEP_Part",
      targetDimensionsMm: [120.0, 80.0, 45.0],
    },
  },
  {
    name: "cad_search_online_models",
    description: "Searches the curated open catalog of 3D models (Khronos Sample Models, NASA, robotics, vehicles, props, creatures) for ready-made downloadable base geometry matching user queries.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional category filter: Vehicles, Animals, Characters, SciFi, Mechanical, Props, Furniture, Architecture, Electronics, Medical, Organic" },
        limit: { type: "number", description: "Maximum results to return (default: 10, max: 50)" },
        query: { type: "string", description: "Search query keywords (e.g. 'car', 'astronaut', 'duck', 'guitar', 'helmet', 'robot', 'tree', 'table')" },
      },
      required: ["query"],
    },
    samplePayload: {
      category: "Vehicles",
      limit: 10,
      query: "sports car",
    },
  },
  {
    name: "cad_split_into_components",
    description: "Surgically separates disconnected loose polygon islands into independent named child objects with centered origins.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of composite mesh to separate" },
        recenterOrigins: { type: "boolean", description: "Re-center geometry origin for every separated component (default true)" },
      },
    },
    samplePayload: {
      targetMeshName: "Assembly_Composite",
      recenterOrigins: true,
    },
  },
  {
    name: "cad_subdivide_smooth",
    description: "Surgically refines and smooths faceted low-poly surfaces using Catmull-Clark curvature subdivision with auto-smooth normal preservation.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of mesh to smooth" },
        levels: { type: "number", description: "Subdivision refinement levels (1 to 3, default 1)" },
        smoothShading: { type: "boolean", description: "Enable smooth shading normals (default true)" },
      },
    },
    samplePayload: {
      targetMeshName: "Low_Poly_Base",
      levels: 2,
      smoothShading: true,
    },
  },
  {
    name: "cad_transform_part",
    description: "Surgically translates, rotates, and scales a named mesh or component in world space without altering topological connectivity.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of mesh to transform (defaults to active object)" },
        applyTransform: { type: "boolean", description: "Bake transform into mesh vertices (default true)" },
        rotationDeg: { type: "array", items: { type: "number" }, description: "Euler rotation angles [rx, ry, rz] in degrees (default [0, 0, 0])" },
        scale: { type: "array", items: { type: "number" }, description: "Scale factors [sx, sy, sz] (default [1, 1, 1])" },
        translation: { type: "array", items: { type: "number" }, description: "World translation offset [x, y, z] in meters (default [0, 0, 0])" },
      },
    },
    samplePayload: {
      targetMeshName: "Hydraulic_Piston_Base",
      applyTransform: true,
      rotationDeg: [0, 0, 45],
      scale: [1, 1, 1],
      translation: [0, 0, 0.05],
    },
  },
  {
    name: "cad_voxel_remesh",
    description: "Surgically fuses multiple intersecting mesh bodies into a single seamless, watertight manifold solid via OpenVDB voxel remeshing.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of target mesh, or null to remesh and fuse all active scene meshes" },
        adaptivity: { type: "number", description: "Planar polygon adaptivity reduction (default 0.0)" },
        joinAll: { type: "boolean", description: "Whether to join all scene meshes into single entity before voxel remesh (default true)" },
        voxelSize: { type: "number", description: "Voxel grid size in meters (0.005 to 0.1, default 0.03)" },
      },
    },
    samplePayload: {
      targetMeshName: "Non_Manifold_Bracket",
      adaptivity: 0.1,
      joinAll: true,
      voxelSize: 0.03,
    },
  },
  {
    name: "cad_weld_vertices",
    description: "Surgically merges coincident and adjacent vertices within distance threshold to close seams and ensure watertight manifolds.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of mesh to weld" },
        distanceMm: { type: "number", description: "Seam merge distance threshold in millimeters (default 1.0)" },
      },
    },
    samplePayload: {
      targetMeshName: "Non_Manifold_Bracket",
      distanceMm: 1.0,
    },
  },

  // 8. Verification & System Diagnostics
  {
    name: "mcp_check_tool",
    description: "Vets any Model Context Protocol (MCP) server across 120,000+ indexed servers via M8ven Trust Index. Returns trust score (0-100), security verdict, CVE status, and tool quality audit.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        identifier: { type: "string", description: "GitHub repository slug (e.g. 'SachinyadavAug20/kosh') or npm package name" },
      },
      required: ["identifier"],
    },
    samplePayload: {
      identifier: "SachinyadavAug20/kosh",
    },
  },
  {
    name: "kosh_system_health",
    description: "Returns live operational diagnostics: headless Blender 5.2 LTS availability, active TCP socket daemon status, asset storage, and registered MCP tool catalog.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {},
    },
    samplePayload: {},
  },
  {
    name: "cad_convex_hull",
    description: "Computes the minimal convex bounding hull enclosing target geometry for physics colliders, robotics envelopes, and shrinkwrap packaging.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMesh: { type: "string", description: "Target mesh name to compute convex hull for" },
        name: { type: "string", description: "Name of generated convex hull mesh" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format (default: glb)" },
      },
    },
    samplePayload: {
      targetMesh: "Robot_Arm_Link",
      name: "Robot_Arm_Link_Hull",
      format: "glb",
    },
  },
  {
    name: "cad_separate_loose_parts",
    description: "Splits a compound multi-body mesh into distinct child objects based on disconnected vertex islands, centering their origins.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMesh: { type: "string", description: "Compound mesh name to separate into loose parts" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format (default: glb)" },
      },
    },
    samplePayload: {
      targetMesh: "Imported_MultiPart_Assembly",
      format: "glb",
    },
  },
  {
    name: "cad_project_curve_cut",
    description: "Projects a 2D profile or stencil curve onto a 3D curved surface to emboss, deboss, or perform through-hole knife projection stamping.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMesh: { type: "string", description: "Base mesh to project cut into" },
        cutDepthMm: { type: "number", description: "Cutting depth in millimeters (default: 3.0)" },
        throughCut: { type: "boolean", description: "Whether to cut through the entire solid" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format (default: glb)" },
      },
    },
    samplePayload: {
      targetMesh: "Curved_Enclosure_Face",
      cutDepthMm: 2.5,
      throughCut: false,
      format: "glb",
    },
  },
  {
    name: "cad_generate_gear",
    description: "Synthesizes parametric involute spur, helical, or bevel gears with explicit tooth count, module, pressure angle, bore diameter, and face width.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        teeth: { type: "integer", description: "Number of gear teeth (e.g. 15, 24, 48)" },
        module: { type: "number", description: "Gear tooth pitch module in mm (default: 1.5)" },
        pressureAngle: { type: "number", description: "Pressure angle in degrees (default: 20.0)" },
        faceWidthMm: { type: "number", description: "Gear face width thickness in mm (default: 10.0)" },
        boreDiameterMm: { type: "number", description: "Central shaft bore hole diameter in mm (default: 5.0)" },
        name: { type: "string", description: "Entity identifier name" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format (default: glb)" },
      },
      required: ["teeth"],
    },
    samplePayload: {
      teeth: 24,
      module: 1.5,
      pressureAngle: 20.0,
      faceWidthMm: 12.0,
      boreDiameterMm: 8.0,
      name: "Drive_Pinion_24T",
      format: "glb",
    },
  },
  {
    name: "cad_uv_unwrap_auto",
    description: "Executes automatic non-overlapping smart UV unwrapping with customizable angle limits and packing margins for photoreal PBR texturing.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMesh: { type: "string", description: "Mesh object to UV unwrap" },
        angleLimitDeg: { type: "number", description: "Angle threshold for UV seams in degrees (default: 66.0)" },
        islandMargin: { type: "number", description: "Margin padding between UV islands (default: 0.02)" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format (default: glb)" },
      },
    },
    samplePayload: {
      targetMesh: "Ergonomic_Handle_Solid",
      angleLimitDeg: 66.0,
      islandMargin: 0.02,
      format: "glb",
    },
  },
  {
    name: "cad_wireframe_cage",
    description: "Transforms solid polygonal geometry into a structural wireframe cage or tubular truss lattice with customizable strut thickness.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMesh: { type: "string", description: "Target mesh to convert to wireframe cage" },
        strutThicknessMm: { type: "number", description: "Wireframe strut wall thickness in mm (default: 1.5)" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format (default: glb)" },
      },
    },
    samplePayload: {
      targetMesh: "Spaceframe_Dome",
      strutThicknessMm: 2.0,
      format: "glb",
    },
  },
  {
    name: "cad_point_cloud_surface",
    description: "Synthesizes or reconstructs a smooth parametric 3D surface mesh from coordinate point clouds or heightmap elevation grids.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        resolution: { type: "integer", description: "Point cloud grid resolution (default: 16)" },
        surfaceProfile: { type: "string", enum: ["sinusoidal", "parabolic", "ripple", "planar"], description: "Heightmap elevation pattern" },
        name: { type: "string", description: "Entity identifier name" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format (default: glb)" },
      },
    },
    samplePayload: {
      resolution: 24,
      surfaceProfile: "ripple",
      name: "Topographic_Terrain_Plate",
      format: "glb",
    },
  },
  {
    name: "cad_export_engineering_drawing",
    description: "Generates an SVG 2D technical orthographic blueprint drawing with front, top, side projections, hidden dashed lines, and title block.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMesh: { type: "string", description: "Mesh to generate technical 2D drawing for" },
        drawingStandard: { type: "string", enum: ["ISO", "ASME"], description: "Drafting standard (ISO first-angle, ASME third-angle)" },
        units: { type: "string", enum: ["mm", "inch"], description: "Measurement units" },
        sheetSize: { type: "string", enum: ["A4", "A3", "Letter"], description: "Drawing sheet format" },
      },
    },
    samplePayload: {
      targetMesh: "Pinion_Driver",
      drawingStandard: "ISO",
      units: "mm",
      sheetSize: "A4",
    },
  },
  {
    name: "cad_linear_array",
    description: "Duplicates a mesh in a linear grid pattern with count, per-axis offset, and optional axis alignment. Fast pattern duplication for brackets, vents, and rack parts.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of the source mesh to duplicate" },
        count: { type: "integer", description: "Number of copies per axis (>=1, default 3)" },
        offset: { type: "array", items: { type: "number" }, description: "Per-copy translation offset [x, y, z] in meters" },
        axis: { type: "string", enum: ["x", "y", "z"], description: "Dominant array axis (default x)" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format (default: glb)" },
      },
    },
    samplePayload: {
      targetMeshName: "Vent_Louver",
      count: 6,
      offset: [0, 0.05, 0],
      axis: "y",
      format: "glb",
    },
  },
  {
    name: "cad_radial_array",
    description: "Duplicates a mesh around a circular path with count, radius, and start angle. For bolts on flanges, spokes, fan blades, and rotary mounts.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of the source mesh to duplicate" },
        count: { type: "integer", description: "Number of copies around the circle (>=1, default 6)" },
        radius: { type: "number", description: "Array circle radius in meters" },
        startAngleDeg: { type: "number", description: "Starting angle in degrees (default 0)" },
        axis: { type: "string", enum: ["x", "y", "z"], description: "Rotation axis of the circle (default z)" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format (default: glb)" },
      },
    },
    samplePayload: {
      targetMeshName: "Flange_Bolt",
      count: 8,
      radius: 0.04,
      startAngleDeg: 0,
      axis: "z",
      format: "glb",
    },
  },
  {
    name: "cad_text_emboss",
    description: "Creates 3D text geometry embossed (raised) or debossed (engraved) onto a target mesh surface via boolean operation.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text string to emboss (ASCII only)" },
        targetMeshName: { type: "string", description: "Target mesh to carve into; creates a new plate if missing" },
        depthMm: { type: "number", description: "Engraving/embossing depth in millimeters (default 0.8)" },
        sizeMm: { type: "number", description: "Text height in millimeters (default 6)" },
        mode: { type: "string", enum: ["engrave", "emboss"], description: "engrave subtracts text, emboss raises it" },
        format: { type: "string", enum: ["glb", "stl", "obj"], description: "Export format (default: glb)" },
      },
    },
    samplePayload: {
      text: "KOSH",
      targetMeshName: "Nameplate",
      depthMm: 0.8,
      sizeMm: 8,
      mode: "engrave",
      format: "glb",
    },
  },
  {
    name: "cad_check_manifold",
    description: "Validates mesh topology for 3D printing: watertight/manifold check, boundary and non-manifold edge counts, volume, and bounding box. Read-only diagnosis.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetMeshName: { type: "string", description: "Name of the mesh to validate (defaults to active object)" },
      },
    },
    samplePayload: {
      targetMeshName: "Bracket_Arm",
    },
  },
  {
    name: "cad_image_to_model",
    description: "Converts an uploaded photo or hand-drawn sketch (base64 data URL) into a watertight 3D solid via multimodal vision AI reconstruction, online base-model matching, or deterministic contour extrusion with automatic fallbacks.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        image: { type: "string", description: "Required image payload: data URL (data:image/png;base64,...) or raw base64 of a PNG/JPEG sketch or photo" },
        prompt: { type: "string", description: "Natural-language hints: color, size, features to emphasize" },
        mode: { type: "string", enum: ["vision_ai", "base_match", "contour_extrusion"], description: "Reconstruction pipeline (default vision_ai; falls back automatically on failure)" },
        format: { type: "string", enum: ["glb", "stl"], description: "Export format (default glb)" },
      },
      required: ["image"],
    },
    samplePayload: {
      image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      prompt: "orange gear",
      mode: "vision_ai",
      format: "glb",
    },
  },
  {
    name: "cad_analyze_image",
    description: "Multimodal vision analysis of a photo or sketch: object identification, primitive decomposition, proportion estimates, feature list, and recommended reconstruction mode. Read-only, returns text.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        image: { type: "string", description: "Required image payload: data URL (data:image/png;base64,...) or raw base64 of a PNG/JPEG" },
        prompt: { type: "string", description: "Optional context or constraints to consider during analysis" },
      },
      required: ["image"],
    },
    samplePayload: {
      image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      prompt: "mechanical bracket, 60mm wide",
    },
  },
  {
    name: "cad_extract_contours",
    description: "Deterministic computer-vision contour tracing: extracts the traced 2D perimeter polygon from a sketch image as centered meter-space points. Zero API key, fully offline.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        image: { type: "string", description: "Required image payload: data URL (data:image/png;base64,...) or raw base64 of a PNG/JPEG sketch" },
      },
      required: ["image"],
    },
    samplePayload: {
      image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    },
  },
];

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export const DIRECTOR_MCP_RESOURCES: McpResourceDefinition[] = [
  {
    uri: "kosh://scene/hierarchy",
    name: "Active Scene Hierarchy Graph",
    description: "Complete scene graph tree of objects, parent-child links, world transforms, and material IDs",
    mimeType: "application/json",
  },
  {
    uri: "kosh://engine/capabilities",
    name: "Kosh 3D Engine Capabilities",
    description: "Blender version, installed Python packages, supported formats (.glb, .stl, .obj), and max polygon quotas",
    mimeType: "application/json",
  },
  {
    uri: "kosh://materials/catalog",
    name: "PBR Material Catalog",
    description: "Ready-to-use studio PBR materials: MatteTitanium, ClearGlass, CastIron, NeonBlueEmissive, BrushedBrass, CarbonFiber, StudioClay",
    mimeType: "application/json",
  },
  {
    uri: "kosh://materials/library",
    name: "Studio PBR & MatCap Material Library",
    description: "Built-in CAD material presets (Titanium, Frosted Acrylic, Clay, Redwax, Chrome, Brass, Neon Emissive)",
    mimeType: "application/json",
  },
  {
    uri: "kosh://scene/bounding-boxes",
    name: "Scene World Space Bounding Boxes",
    description: "Axis-Aligned Bounding Box (AABB) extents and metric dimensions for active scene meshes",
    mimeType: "application/json",
  },
  {
    uri: "kosh://viewport/active-selection",
    name: "Active Viewport Selection & Modifier Stack",
    description: "Currently selected entity metadata: vertex list, face count, active modifier stack, and transform matrices",
    mimeType: "application/json",
  },
  {
    uri: "kosh://library/modular-models",
    name: "Modular Low-Poly 3D Model Catalog",
    description: "Instant procedural low-poly entities and compound scene composer presets (Cat, Dog, Elephant, Astronaut, Car, Spaceship)",
    mimeType: "application/json",
  },
  {
    uri: "kosh://specs/hardware/metric-fasteners",
    name: "Metric Fastener Hardware Library",
    description: "Exact CAD clearance holes, tap drill diameters, and socket-cap head dimensions for M2-M12 bolts in millimeters",
    mimeType: "application/json",
  },
  {
    uri: "kosh://materials/pbr-presets",
    name: "Curated PBR Material Presets",
    description: "Calibrated Disney/PBR Principled BSDF shader tokens: dark titanium, machined aluminum, safety orange, carbon fiber",
    mimeType: "application/json",
  },
  {
    uri: "kosh://guidelines/fdm-tolerances",
    name: "3D Print FDM Design Rules",
    description: "Minimum wall thickness, minimum hole diameters, maximum overhang angle, and moving-joint clearances for FDM printing",
    mimeType: "application/json",
  },
  {
    uri: "kosh://specs/engineering/stepper-motors",
    name: "NEMA Stepper Motor Specifications",
    description: "Standard CAD dimensions, faceplate widths, mounting hole PCDs, pilot bosses, and shaft diameters for NEMA 14, 17, 23, and 34 motors",
    mimeType: "application/json",
  },
  {
    uri: "kosh://specs/standards/iso-bearings",
    name: "ISO Deep Groove Ball Bearings",
    description: "Standard bearing dimensions (bore d, outer D, width B) and dynamic load ratings for 608, 623, 624, 625, 688, and 6900 series",
    mimeType: "application/json",
  },
  {
    uri: "kosh://guidelines/sla-resin-tolerances",
    name: "SLA and DLP Photopolymer Resin Design Rules",
    description: "Minimum wall thickness, escape hole diameters, suction-cup prevention, and support overhang thresholds for resin 3D printing",
    mimeType: "application/json",
  },
  {
    uri: "kosh://materials/physical-constants",
    name: "Engineering Material Physical Constants",
    description: "Mass density, Young's modulus, Poisson's ratio, tensile yield strength, and thermal expansion for aerospace metals and engineering polymers",
    mimeType: "application/json",
  },
  {
    uri: "kosh://standards/gdt-symbols",
    name: "Geometric Dimensioning and Tolerancing Reference",
    description: "ASME Y14.5 and ISO 1101 GD&T symbol definitions, tolerance zones, and datum feature control frame guidelines",
    mimeType: "application/json",
  },
  {
    uri: "kosh://specs/optics/studio-hdri-lighting",
    name: "Studio Photography and Lighting Rig Standards",
    description: "Key/fill/rim lighting ratios, Kelvin color temperatures, lux intensity targets, and cyclorama backdrop geometry parameters",
    mimeType: "application/json",
  },
  {
    uri: "kosh://presets/game-engine-lod",
    name: "Real-Time Game Engine LOD Polygon Budgets",
    description: "Target triangle counts, draw call limits, and texture map resolutions across LOD0 Hero to LOD3 Billboard stages for UE5 and Unity",
    mimeType: "application/json",
  },
  {
    uri: "kosh://specs/aerospace/unmanned-airframe",
    name: "UAV Multirotor Airframe Design Rules",
    description: "Propeller tip clearance percentages, motor mount PCD patterns, center-of-gravity alignment rules, and carbon fiber arm sizing",
    mimeType: "application/json",
  },
  {
    uri: "kosh://library/puzzle-pieces",
    name: "Modular CAD Puzzle Pieces and Sockets Library",
    description: "Interlocking parametric CAD puzzle pieces with mate sockets, dovetails, NEMA brackets, and pre-solved compound assembly recipes",
    mimeType: "application/json",
  },
  {
    uri: "kosh://library/saved-models",
    name: "Pre-Engineered Complete Assembly Models Library",
    description: "Turnkey multi-part engineering and cinematic assemblies: quadcopter drone, planetary gearbox, compound microscope, electronics chassis, astronaut scene",
    mimeType: "application/json",
  },
  {
    uri: "kosh://specs/hardware/heat-set-inserts",
    name: "Heat-Set Threaded Insert Specifications",
    description: "Brass heat-set insert sizing for FDM plastics: hole diameter, boss wall thickness, engagement length, and installation temperature by thread size",
    mimeType: "application/json",
  },
  {
    uri: "kosh://materials/filaments",
    name: "3D Printing Filament Material Library",
    description: "FDM filament properties: nozzle/bed temperatures, shrinkage, strength, layer adhesion, and typical use cases for common engineering filaments",
    mimeType: "application/json",
  },
  {
    uri: "kosh://specs/printers/build-volumes",
    name: "3D Printer Build Volume Database",
    description: "Popular printer build volumes and nozzle limits for fit checking: Prusa, Bambu Lab, Creality, Printrbot, and Voron class machines",
    mimeType: "application/json",
  },
  {
    uri: "kosh://standards/iso-2768-tolerances",
    name: "ISO 2768 General Tolerances Standard",
    description: "Linear and angular tolerance classes (f, m, c, v) for machined and printed parts, plus derived geographic fits for holes and shafts",
    mimeType: "application/json",
  },
  {
    uri: "kosh://guides/image-to-3d",
    name: "Image to 3D Reconstruction Guide",
    description: "Photo and hand-drawn sketch ingestion: reconstruction modes (vision_ai, base_match, contour_extrusion), MCP/REST wiring, pipeline stages, and reliability tips",
    mimeType: "application/json",
  },
  {
    uri: "kosh://guides/sketch-conventions",
    name: "Hand-Drawn Sketch Conventions",
    description: "Drawing rules for reliable sketch-to-3D reconstruction: stroke contrast, closed contours, view selection, labeling, and per-mode expectations",
    mimeType: "application/json",
  },
];

export interface McpPromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface McpPromptDefinition {
  name: string;
  description: string;
  arguments: McpPromptArgument[];
}

export const DIRECTOR_MCP_PROMPTS: McpPromptDefinition[] = [
  {
    name: "scaffold_parametric_enclosure",
    description: "Prepares the LLM to design an electronic enclosure/chassis with snap fits, mounting standoffs, wall thickness, and a split lid.",
    arguments: [
      { name: "lengthMm", description: "Internal enclosure length in millimeters", required: true },
      { name: "widthMm", description: "Internal enclosure width in millimeters", required: true },
      { name: "heightMm", description: "Internal enclosure height in millimeters", required: true },
      { name: "wallThicknessMm", description: "Wall thickness in millimeters (FDM minimum: 1.2)", required: true },
    ],
  },
  {
    name: "optimize_manifold_topology",
    description: "Evaluates a broken or non-manifold mesh, identifies degenerate faces, and applies self-healing routines to reach watertight status.",
    arguments: [
      { name: "meshName", description: "Name of the mesh to inspect and repair", required: true },
    ],
  },
  {
    name: "lowpoly_stylized_environment",
    description: "Guides the model to create an indie game-ready low-poly composition without high triangle overhead.",
    arguments: [
      { name: "theme", description: "Art direction theme (e.g. 'scifi hangar', 'forest village')", required: true },
      { name: "budgetTris", description: "Maximum triangle budget for the whole scene", required: true },
    ],
  },
  {
    name: "harden_mechanical_part",
    description: "Standardized mechanical hardening blueprint: inspects non-manifold edges, applies chamfers/bevels, and verifies metric dimensions.",
    arguments: [
      { name: "mesh_name", description: "Name of the target mesh component to harden", required: true },
      { name: "tolerance_mm", description: "Machining tolerance or chamfer offset in millimeters", required: false },
    ],
  },
  {
    name: "decompose_narrative_object",
    description: "Sequential CSG CAD decomposition blueprint: guides the LLM to structure models into Primary Solids -> Subtractive Cuts -> Additive Detail -> PBR Finishes.",
    arguments: [
      { name: "concept_description", description: "Natural language concept or product description to decompose into CAD operations", required: true },
    ],
  },
  {
    name: "design_spur_gear_train",
    description: "Prepares the LLM to design an interlocking 2-gear transmission mechanism with calculated gear ratio, module, center distance, and bore clearance.",
    arguments: [
      { name: "gearRatio", description: "Transmission reduction ratio (e.g. 2.0)", required: false },
      { name: "module", description: "Gear module pitch in millimeters (e.g. 1.5)", required: false },
      { name: "driverTeeth", description: "Number of teeth on driving pinion gear (e.g. 15)", required: false },
      { name: "faceWidthMm", description: "Gear face width in millimeters (e.g. 10.0)", required: false },
    ],
  },
  {
    name: "photorealistic_product_hero_shot",
    description: "Guides the LLM through professional studio lighting, 85mm camera optics, PBR shader assignment, and 4-view blueprint rendering.",
    arguments: [
      { name: "meshName", description: "Name of the target product mesh", required: true },
      { name: "materialPreset", description: "PBR material preset (Titanium, Carbon Fiber, Glass, Gold, Chrome, Obsidian, Copper, Ceramic, Car Paint)", required: false },
      { name: "lightingMood", description: "Studio lighting rig (3-Point Classic, Cyberpunk Neon, Product Softbox, Dramatic Rim, Daylight Studio)", required: false },
    ],
  },
  {
    name: "generative_drone_frame",
    description: "Prepares the LLM to architect a lightweight UAV quadcopter airframe with motor mounting PCDs, electronics bay, and weight reduction pockets.",
    arguments: [
      { name: "propellerDiameterInch", description: "Propeller diameter in inches (e.g. 5.0)", required: false },
      { name: "motorPcdType", description: "Motor mount PCD standard (e.g. 16x19_M3 or 19x25_M3_M4)", required: false },
      { name: "armThicknessMm", description: "Carbon fiber arm plate thickness in millimeters (e.g. 5.0)", required: false },
    ],
  },
  {
    name: "procedural_architectural_pavilion",
    description: "Guides the LLM to generate a parametric architectural canopy with structural ribs, Voronoi skin perforation, and daylight staging.",
    arguments: [
      { name: "spanMeters", description: "Total pavilion ground span in meters (e.g. 12.0)", required: false },
      { name: "ribCount", description: "Number of structural arch ribs (e.g. 8)", required: false },
      { name: "canopyStyle", description: "Canopy geometry style (ribbed_arch, voronoi_shell, tensile_membrane)", required: false },
    ],
  },
  {
    name: "reverse_engineering_blueprint_to_3d",
    description: "Instructions to reconstruct 100% watertight CSG solid geometry from orthographic blueprint dimensions and verify with digital calipers.",
    arguments: [
      { name: "blueprintDescription", description: "Description and nominal dimensions of the mechanical drawing", required: true },
      { name: "nominalToleranceMm", description: "Machining tolerance in millimeters (e.g. 0.1)", required: false },
    ],
  },
  {
    name: "sculpt_creature_bust",
    description: "Multi-pass digital sculpting blueprint: anatomical blocking, voxel remeshing, dynamic brush deformation, symmetry mirroring, and clay shader.",
    arguments: [
      { name: "creatureType", description: "Target creature or fantasy creature description", required: true },
      { name: "voxelResolutionMm", description: "Remeshing voxel size in millimeters (e.g. 2.0)", required: false },
    ],
  },
  {
    name: "generate_3d_printable_snapfit",
    description: "Standardized cantilever snap-fit joint engineering blueprint with calculated beam deflection, 30-degree lead-in angle, and strain relief fillet.",
    arguments: [
      { name: "beamLengthMm", description: "Cantilever beam length in millimeters (e.g. 15.0)", required: false },
      { name: "wallThicknessMm", description: "Nominal wall thickness in millimeters (e.g. 2.0)", required: false },
      { name: "catchDepthMm", description: "Snap catch undercut retention depth in millimeters (e.g. 1.2)", required: false },
      { name: "entryAngleDeg", description: "Lead-in push entry angle in degrees (e.g. 30.0)", required: false },
    ],
  },
  {
    name: "assemble_modular_puzzle_recipe",
    description: "Guides the AI agent or LLM client to query the 'kosh://library/puzzle-pieces' catalog, select interlocking puzzle piece components, and stitch them together via 'cad_assemble_puzzle_pieces' to answer complex modular CAD queries.",
    arguments: [
      { name: "recipeName", description: "Target composite puzzle recipe name (interlocking_dovetail_plate, robotic_articulated_arm, modular_cube_chassis, geodesic_hex_truss, bearing_transmission_carrier)", required: true },
      { name: "clearanceMm", description: "Mating slide-fit joint clearance in millimeters (default: 0.2 for FDM printing)", required: false },
      { name: "scaleMultiplier", description: "Uniform scaling factor applied across all assembled components (default: 1.0)", required: false },
    ],
  },
  {
    name: "optimize_model_for_3d_printing",
    description: "Print-readiness optimization blueprint: validates manifold topology, orients the part for minimal support, sizes walls/nozzles for the target filament, and verifies clearances.",
    arguments: [
      { name: "meshName", description: "Name of the model to prepare for slicing", required: true },
      { name: "filament", description: "Target filament (PLA, PETG, ABS, ASA, TPU, Nylon, PC)", required: false },
      { name: "nozzleDiameterMm", description: "Printer nozzle diameter in millimeters (default: 0.4)", required: false },
      { name: "supportless", description: "If true, re-orient to avoid supports entirely (default: false)", required: false },
    ],
  },
  {
    name: "design_heat_set_insert_mount",
    description: "Designs printed bosses for brass heat-set threaded inserts using the kosh://specs/hardware/heat-set-inserts resource for hole sizing, wall thickness, and engagement.",
    arguments: [
      { name: "threadSize", description: "Insert thread size (M2, M3, M4, M5, M6)", required: true },
      { name: "insertLengthMm", description: "Insert engagement length in millimeters (e.g. 5.0)", required: false },
      { name: "mountCount", description: "Number of insert bosses to place (e.g. 4)", required: false },
      { name: "patternPcdMm", description: "Bolt circle diameter for radial patterns in millimeters (optional)", required: false },
    ],
  },
  {
    name: "plan_linear_motion_stage",
    description: "Plans a linear motion sub-assembly: rail length, bearing blocks, stepper mount, belt/pulley or leadscrew drive, and end-stop clearances from build volume constraints.",
    arguments: [
      { name: "travelMm", description: "Required travel in millimeters (e.g. 200)", required: true },
      { name: "payloadKg", description: "Moving payload mass in kilograms (e.g. 2.0)", required: false },
      { name: "driveType", description: "Drive mechanism (belt, leadscrew, rack_pinion)", required: false },
      { name: "buildVolumeMm", description: "Printer build volume as 'X,Y,Z' in millimeters for part sizing (e.g. '256,256,256')", required: false },
    ],
  },
  {
    name: "image_to_3d_model",
    description: "Full image-to-3D workflow: pick a reconstruction mode, convert a photo or hand-drawn sketch into a watertight solid, and verify the result.",
    arguments: [
      { name: "imageBase64", description: "Photo or sketch as data URL / raw base64 (required)", required: true },
      { name: "prompt", description: "Natural-language hints: color, size, features to emphasize", required: false },
      { name: "mode", description: "vision_ai | base_match | contour_extrusion (auto-fallback when omitted)", required: false },
      { name: "format", description: "glb (default) or stl", required: false },
    ],
  },
  {
    name: "hand_sketch_to_printable_part",
    description: "Turns a hand-drawn sketch into a verified 3D-printable STL: analyze, reconstruct, check manifold, then export for the target printer.",
    arguments: [
      { name: "sketchBase64", description: "Hand-drawn sketch as data URL / raw base64 (required)", required: true },
      { name: "targetSizeMm", description: "Desired largest dimension in millimeters (e.g. 60)", required: false },
      { name: "material", description: "Target filament: PLA | PETG | ABS | TPU (default PLA)", required: false },
    ],
  },
  {
    name: "analyze_and_reconstruct_reference_image",
    description: "Two-stage reference ingestion: vision-analyze the image first to choose the best mode, then reconstruct and validate the mesh.",
    arguments: [
      { name: "imageBase64", description: "Reference photo or sketch as data URL / raw base64 (required)", required: true },
      { name: "notes", description: "User constraints: scale, orientation, which features matter", required: false },
    ],
  },
];

export interface McpDispatchResult {
  jsonrpc: "2.0";
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export function dispatchMcpTool(
  toolName: string,
  params: Record<string, any>,
  requestId: string | number = 1
): McpDispatchResult {
  const tool = DIRECTOR_MCP_TOOLS.find((t) => t.name === toolName);

  if (!tool) {
    return {
      jsonrpc: "2.0",
      id: requestId,
      error: {
        code: -32601,
        message: "Method '" + toolName + "' not found in Kosh MCP Tool Registry",
      },
    };
  }

  // Validate required params
  const required = tool.inputSchema.required || [];
  for (const field of required) {
    if (params[field] === undefined) {
      return {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          code: -32602,
          message: "Invalid params: missing required property '" + field + "' for tool '" + toolName + "'",
        },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id: requestId,
    result: {
      status: "SUCCESS",
      tool: toolName,
      timestamp: new Date().toISOString(),
      dispatchedParams: params,
    },
  };
}
