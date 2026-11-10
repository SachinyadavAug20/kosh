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

  // 7. Narrative Direction & Cinematics
  {
    name: "create_actor",
    description: "Spawns a new rigged 3D character actor in the low-poly narrative scene.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Unique actor identifier" },
        name: { type: "string", description: "Display name of the actor" },
        characterType: { type: "string", enum: ["humanoid", "robot", "creature"], description: "Rig archetype" },
        position: { type: "array", items: { type: "number" }, description: "[x, y, z] initial coordinates" },
        motion: { type: "string", enum: ["walk", "run", "idle", "wave", "look_around"], description: "Initial action state" },
      },
      required: ["id", "name"],
    },
    samplePayload: {
      id: "actor_courier",
      name: "Cyberpunk Courier",
      characterType: "humanoid",
      position: [0, 0, 5],
      motion: "walk",
    },
  },
  {
    name: "set_actor_path",
    description: "Configures Catmull-Rom spline navigation waypoints and gait kinematics for an actor.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        actorId: { type: "string", description: "ID of the actor to direct" },
        waypoints: { type: "array", items: { type: "array", items: { type: "number" } }, description: "List of [x, y, z] coordinates" },
        motion: { type: "string", enum: ["walk", "run", "idle", "wave", "look_around"] },
        speed: { type: "number", description: "Velocity scalar" },
      },
      required: ["actorId", "waypoints"],
    },
    samplePayload: {
      actorId: "actor_courier",
      waypoints: [[0, 0, 6], [-2, 0, 2], [1, 0, -3], [3, 0, -6]],
      motion: "run",
      speed: 1.4,
    },
  },
  {
    name: "set_camera_cinematic",
    description: "Directs camera kinematics, focal length, tracking target, and shot style.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        style: { type: "string", enum: ["orbit", "dolly", "shoulder_track", "static", "flyby"] },
        targetActorId: { type: "string", description: "Optional actor ID to track" },
        distance: { type: "number", description: "Distance in meters" },
        fov: { type: "number", description: "Lens Field-of-View in degrees" },
      },
      required: ["style"],
    },
    samplePayload: {
      style: "dolly",
      targetActorId: "actor_courier",
      distance: 8.5,
      fov: 35,
    },
  },
  {
    name: "trigger_deterministic_render",
    description: "Executes an offline, frame-accurate video render using WebCodecs and muxers.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["mp4", "webm"] },
        resolution: { type: "string", enum: ["720p", "1080p"] },
        fps: { type: "number", enum: [24, 30, 60] },
      },
      required: ["format"],
    },
    samplePayload: {
      format: "mp4",
      resolution: "1080p",
      fps: 30,
    },
  },
  {
    name: "evaluate_fcurve",
    description: "Samples a Bézier animation curve channel value at an arbitrary frame timestamp.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Target F-Curve channel ID" },
        frame: { type: "number", description: "Frame timestamp to evaluate" },
      },
      required: ["channelId", "frame"],
    },
    samplePayload: {
      channelId: "chan_cam_dolly",
      frame: 45,
    },
  },
  {
    name: "sync_audio_narration",
    description: "Bakes speech audio formant frequencies into jaw drop and mouth wide viseme keyframes.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        audioUrl: { type: "string", description: "URL to audio file" },
        fps: { type: "number", description: "Animation framerate" },
      },
      required: ["audioUrl"],
    },
    samplePayload: {
      audioUrl: "/audio/narration_demo.wav",
      fps: 30,
    },
  },
  {
    name: "modify_environment",
    description: "Configures scene skybox background, ground fog density, sun azimuth, and ambient occlusion parameters.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        skyColor: { type: "string", description: "Hex sky gradient color" },
        fogDensity: { type: "number", description: "Atmospheric fog coefficient (0.0 to 1.0)" },
        groundColor: { type: "string", description: "Ground terrain color" },
      },
    },
    samplePayload: {
      skyColor: "#0f172a",
      fogDensity: 0.05,
      groundColor: "#1e293b",
    },
  },
  {
    name: "bake_procedural_motion",
    description: "Bakes procedural secondary kinetic motion (antenna bounce, cloth wave, spring dynamics) into keyframes.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        targetActorId: { type: "string", description: "Actor identifier to apply secondary motion" },
        motionProfile: { type: "string", enum: ["spring_bounce", "pendulum_swing", "wind_jitter"] },
        damping: { type: "number", description: "Oscillation damping ratio" },
      },
      required: ["targetActorId", "motionProfile"],
    },
    samplePayload: {
      targetActorId: "actor_courier",
      motionProfile: "spring_bounce",
      damping: 0.85,
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
