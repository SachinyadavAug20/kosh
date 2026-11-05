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
