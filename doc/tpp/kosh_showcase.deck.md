---
format: 0.1
title: Kosh Creative MCP Hub Showcase
author: Sachin Yadav
theme: tokyo-night
align: left
---

::id title
::align center

# KOSH (कौश)
### Developer-First Creative Model Context Protocol Workstation
#### Real-Time Parametric 3D CAD | Digital Sculpting | Headless Blender 5.2 LTS

::hr

```text no-eval
+-------------------------------------------------------------------------+
|  Author: Sachin Yadav                       Repository: SachinyadavAug20/kosh|
|  License: Apache 2.0                        M8ven Trust Score: 89/100 (B)    |
|  Architecture: Java 21 / Next.js 15 / BPY   Protocol: MCP 2024-11-05 SSE/RPC |
+-------------------------------------------------------------------------+
```

::align left

> [!NOTE]
> Kosh bridges generative AI assistants with production-grade 3D Computer-Aided
> Design (CAD) and digital content creation pipelines via standard Model Context
> Protocol (MCP) endpoints.

---

::id motivation
::align left

# 1. Motivation and Problem Statement

### The Gap in AI Spatial Reasoning
* Modern Large Language Models excel at code and text generation but lack
  grounded spatial validation and real-time physical feedback loops.
* Existing CAD and 3D DCC tools (Blender, FreeCAD, Rhino) require extensive
  manual interaction and lack open standard protocols for autonomous agents.
* Subprocess execution for 3D modeling tools introduces high latency (2-5s per
  cold boot), degrading interactive AI agent workflows.

### The Kosh Solution
* **Zero-Setup MCP Integration**: Standard SSE and JSON-RPC 2.0 endpoints for
  Claude Desktop, Cursor, Zed, Cline, and custom agents.
* **Warm Blender Daemon**: Persistent socket worker delivering
  sub-400ms turnaround.
* **Deterministic Assembly**: Instant parametric kitbashing without
  LLM roundtrips.
* **Enterprise Security**: AST code sanitization, loopback networking,
  and zero CVEs.

---

::id hld-architecture
::align left

# 2. High-Level Design (HLD)

The system is decoupled into client interfaces, protocol gateways, execution
engines, and asset storage tiers.

```text no-eval
+-----------------------------------------------------------------------+
|                             CLIENT TIER                               |
|  Claude Desktop / Zed / Cursor / Cline       Next.js 15 Web DCC       |
+-----------------------------------------------------------------------+
                     |                                   |
           (SSE / JSON-RPC 2.0)                 (REST / WebSockets)
                     v                                   v
+-----------------------------------------------------------------------+
|                        BACKEND GATEWAY (PORT 8080)                     |
|                                                                       |
|  +------------------------+  +-------------------------------------+  |
|  |     McpController      |  |           AssetController           |  |
|  |   (/mcp/sse, /mcp)     |  |          (/api/assets/**)           |  |
|  +------------------------+  +-------------------------------------+  |
|               |                                  |                    |
|               v                                  |                    |
|  +--------------------------------------------+  |                    |
|  |        McpToolRegistry (55 CAD Tools)      |  |                    |
|  +--------------------------------------------+  |                    |
|         |                     |                  |                    |
|         v                     v                  |                    |
|  [ScriptSanitizer]   [GoogleGeminiClient]        |                    |
|         |                                        |                    |
|         v                                        |                    |
|  +--------------------------------------------+  |                    |
|  |           BlenderExecutionService          |  |                    |
|  +--------------------------------------------+  |                    |
+--------------------------------------------------|--------------------+
           | (TCP Socket 127.0.0.1:9091)           |
           v                                       v
+-----------------------------------+    +------------------------------+
|     WARM BLENDER DAEMON TIER      |    |        STORAGE TIER          |
|  Blender 5.2 LTS (Headless BPY)   |--->|  storage/kosh_*.glb / .stl   |
|  Persistent Python TCP Server     |    |  LRU StorageCleanupService   |
+-----------------------------------+    +------------------------------+
```

---

::id lld-subsystems
::align left

# 3. Low-Level Design (LLD) - Backend Subsystems

### Core Architectural Components

1. **McpController (`com.kosh.controller.McpController`)**
   - Implements standard MCP Server-Sent Events (`/mcp/sse`, `/mcp/message`).
   - Manages asynchronous SSE emitters with 30-minute keep-alive sessions.
   - Dispatches progress notifications (`notifications/progress`) during runs.

2. **McpToolRegistry (`com.kosh.service.McpToolRegistry`)**
   - Declares 23+ parametric tools with JSON Schema definitions.
   - Enforces behavioral annotations (`readOnlyHint`, `idempotentHint`,
     `destructiveHint`, `openWorldHint`).
   - Routes tool arguments to programmatic Python script generators.

3. **BlenderExecutionService (`com.kosh.service.BlenderExecutionService`)**
   - Tier 1: Connects via persistent TCP socket to warm daemon on port 9091.
   - Tier 2: Spawns isolated headless subprocess on daemon timeout or failure.
   - Applies syntax updates (`Material.use_nodes` Blender 5.2/6.0 migration).

4. **ScriptSanitizer (`com.kosh.util.ScriptSanitizer`)**
   - Tokenizes and analyzes incoming Python scripts before execution.
   - Rejects banned packages (`os.system`, `subprocess`, `shutil`, `socket`).

---

::id uml-class-diagram
::align left

# 4. UML Component & Class Structure

```text no-eval
+--------------------------------------------------------------------------+
|                              McpController                               |
+--------------------------------------------------------------------------+
| - mcpToolRegistry: McpToolRegistry                                       |
| - mcpResourceRegistry: McpResourceRegistry                               |
| - mcpPromptRegistry: McpPromptRegistry                                   |
| - activeSseSessions: Map<String, SseEmitter>                             |
| - asyncWorkerPool: ExecutorService                                       |
+--------------------------------------------------------------------------+
| + handleSseConnection(request: HttpServletRequest): SseEmitter           |
| + handleSseMessage(sessionId: String, request: McpRpcRequest): Response  |
| + handleRpcRequest(request: McpRpcRequest): ResponseEntity               |
+--------------------------------------------------------------------------+
                                     |
                                     | delegates to
                                     v
+--------------------------------------------------------------------------+
|                             McpToolRegistry                              |
+--------------------------------------------------------------------------+
| - blenderExecutionService: BlenderExecutionService                       |
| - scriptSanitizer: ScriptSanitizer                                       |
| - googleGeminiClient: GoogleGeminiClient                                 |
| - mcpSceneStateService: McpSceneStateService                             |
+--------------------------------------------------------------------------+
| + listTools(): List<Map<String, Object>>                                 |
| + executeTool(name: String, args: Map, token: String): Result            |
| + executeTool(name, args, token, progToken, listener): Result            |
+--------------------------------------------------------------------------+
                                     |
                                     | dispatches to
                                     v
+--------------------------------------------------------------------------+
|                         BlenderExecutionService                          |
+--------------------------------------------------------------------------+
| - blenderExecutable: String                                              |
| - storagePath: Path                                                      |
| - daemonPort: int = 9091                                                 |
| - daemonHost: String = "127.0.0.1"                                       |
+--------------------------------------------------------------------------+
| + isBlenderAvailable(): boolean                                          |
| + executeScript(script: String, format: String): BlenderRunResult        |
| - executeViaDaemon(script, format, id, name, out): BlenderRunResult       |
| - executeViaDirectProcess(script, format, id, name, out): BlenderRunResult|
+--------------------------------------------------------------------------+
```

---

::id sequence-execution
::align left

# 5. Sequence Diagram: MCP Tool Execution Flow

```text no-eval
Client / Agent       McpController     McpToolRegistry   BlenderDaemon   Storage
     |                     |                   |                |             |
     | 1. POST /mcp/message|                   |                |             |
     |    (cad_create_prim)|                   |                |             |
     |-------------------->|                   |                |             |
     | 2. HTTP 202 Accepted|                   |                |             |
     |<--------------------|                   |                |             |
     |                     | 3. Submit async   |                |             |
     |                     |------------------>|                |             |
     |                     |                   | 4. Validate    |             |
     |                     |                   |    arguments   |             |
     |                     |                   | 5. Sanitize    |             |
     |                     |                   |    bpy script  |             |
     |                     |                   |                |             |
     |                     |                   | 6. TCP Socket  |             |
     |                     |                   |    Req (Len+JSON)            |
     |                     |                   |--------------->|             |
     |                     |                   |                | 7. Execute  |
     |                     |                   |                |    bpy code |
     |                     |                   |                | 8. Export   |
     |                     |                   |                |    kosh.glb |
     |                     |                   |                |------------>|
     |                     |                   | 9. Socket Resp |             |
     |                     |                   |<---------------|             |
     | 10. SSE Notification|                   |                |             |
     |     (progress 100%) |                   |                |             |
     |<--------------------|                   |                |             |
     | 11. SSE Result      |                   |                |             |
     |     (asset URL)     |<------------------|                |             |
     |<--------------------|                                                  |
```

---

::id mcp-ecosystem
::align left

# 6. Model Context Protocol (MCP) Workstation Ecosystem

Kosh exposes 55 native tools, 20 resources, and 13 prompts over JSON-RPC:

### 1. Composable 3D CAD, Digital Calipers & Kinematics
* `cad_create_primitive`: Parametric solids (cube, cylinder, cone, sphere).
* `cad_boolean_operation`: Manifold CSG booleans (DIFF, UNION, INTERSECT).
* `cad_measure_dimensions`: Digital caliper (volume, bounding box, area).
* `cad_generate_gear`: Parametric spur, helical, bevel gears with module.
* `cad_generate_threads`: Standardized ISO metric threads, bolts, and nuts.
* `cad_assemble_puzzle_pieces`: Joins modular pieces to satisfy recipes.
* `cad_convex_hull`: Minimal convex bounding hull for physics colliders.
* `cad_separate_loose_parts`: Splits multi-body meshes into distinct parts.
* `cad_export_engineering_drawing`: Generates SVG 2D blueprint drawings.

### 2. Enterprise In-Memory Resources (20 Direct Schemas)
* Modular: `kosh://library/puzzle-pieces` & `kosh://library/saved-models`.
* Standards: `kosh://specs/standards/iso-bearings` (608, 624, 625, 6900).
* Hardware: `kosh://specs/hardware/metric-fasteners` (M2-M12 clearances).
* Motors: `kosh://specs/engineering/stepper-motors` (NEMA 14, 17, 23, 34).
* Physics: `kosh://materials/physical-constants` (Density, Young's Modulus).

### 3. Precision Engineering Prompts (13 Standardized Blueprints)
* `assemble_modular_puzzle_recipe`: Puzzle piece assembly protocol.
* `design_spur_gear_train`: 2-gear interlocking transmission protocol.
* `photorealistic_product_hero_shot`: 85mm studio lighting & framing pipeline.
* `generative_drone_frame`: UAV multirotor airframe and motor PCD synthesis.
* `generate_3d_printable_snapfit`: Cantilever beam snap-fit joint engineering.

---

::id puzzle-pieces-saved-models
::align left

# 7. Modular Puzzle Pieces and Saved Models Subsystem

Interlocking CAD components joinable like puzzle pieces to satisfy queries:

### 1. Interlocking Puzzle Pieces (`kosh://library/puzzle-pieces`)
* **12 Standardized Pieces**: Dovetail plates, 90-degree corner gussets,
  2020 T-slot rails, 608 bearing blocks, NEMA 17 mounts, cantilever struts,
  ball-socket joints, 6-way hex hubs, snap-fit enclosure bases and lids.
* **Calibrated Sockets**: Exact mate normals, gender, and 0.2mm FDM tolerance.

### 2. Compound Assembly Recipes (`cad_assemble_puzzle_pieces`)
* `interlocking_dovetail_plate`: 4-tile planar floor lattice with dovetails.
* `robotic_articulated_arm`: NEMA 17 motor base, 608 bearing, twin linkages.
* `modular_cube_chassis`: 12 2020 extrusion rails and 8 corner gussets.
* `geodesic_hex_truss`: 6-way hub radiating 60-degree struts into tension rim.
* `bearing_transmission_carrier`: NEMA 17 mount + twin 608 blocks + 8mm shaft.

### 3. Pre-Engineered Saved Complete Models (`kosh://library/saved-models`)
* `drone_quadcopter_pro`: 350mm carbon fiber X-frame airframe assembly.
* `planetary_gearbox_stage`: 4:1 epicyclic reduction gear transmission.
* `biomedical_microscope_body`: Quad objective turret and mechanical stage.
* `modular_electronics_housing`: IP54 DIN-rail enclosure with snap-fit lid.
* `cosmic_astronaut_scene`: Apollo astronaut diorama on cratered asteroid.

---

::id blender-daemon
::align left

# 8. Headless Blender 5.2 LTS & Warm Daemon Architecture

### Dual-Tier Execution Engine

```text no-eval
+--------------------------------------------------------------------------+
|                      BlenderExecutionService                             |
+--------------------------------------------------------------------------+
                               |
         +---------------------+---------------------+
         | (Primary: ~400ms)                         | (Fallback: ~2500ms)
         v                                           v
+----------------------------------+       +-------------------------------+
|  Tier 1: Warm Python TCP Daemon  |       |  Tier 2: Direct Subprocess    |
|  - Host: 127.0.0.1, Port: 9091   |       |  - Command: blender -b -P ... |
|  - Length-prefixed binary wire   |       |  - Strict 4s watchdog timeout |
|  - Persistent bpy runtime state  |       |  - Isolated memory space      |
|  - Automatic memory cleanup      |       |  - Zero leftover child procs  |
+----------------------------------+       +-------------------------------+
```

### Protocol Wire Format:
* **Request**: `[4-Byte Big-Endian Payload Length] + [UTF-8 JSON Payload]`
* **Payload Fields**: `assetId`, `script`, `format`, `outputPath`
* **Response**: `[4-Byte Big-Endian Length] + [UTF-8 JSON Result]`
* **Result Fields**: `success`, `executionTimeMs`, `format`,
  `outputPath`, `stdout`

---

::id web-dcc
::align left

# 9. Web DCC Studio & Three.js Viewport

The Next.js 15 front-end provides an interactive Digital Content Creation suite:

### Frontend Subsystems
* **Viewport3D (`Viewport3D.tsx`)**: High-performance Three.js rendering engine
  with PBR materials, orbit controls, wireframe mode, and normal inspection.
* **PhotoStudioPanel (`PhotoStudioPanel.tsx`)**: Configures 3-point lighting
  rigs (Key, Fill, Rim), studio backdrops, and turntable speeds.
* **CommandConsole (`CommandConsole.tsx`)**: Direct interactive CLI for invoking
  MCP tools, inspecting JSON-RPC traces, and viewing Blender stdout logs.
* **CodeInspector (`CodeInspector.tsx`)**: Real-time syntax-highlighted display
  of the executed Python bpy script generating the active viewport mesh.

```text no-eval
+------------------------------------------------------------------------+
|  TopBar: Scene Info | Engine Status | M8ven Badge | API Key Config     |
+------------------------------------------------------------------------+
| Left Toolbar |              Three.js Viewport 3D            | N-Panel  |
| - Primitives |                                              | - Transform
| - Booleans   |   [Real-Time 3D Mesh with PBR Shader]        | - Material
| - Modifiers  |                                              | - Lighting
| - Sculpting  |                                              | - Studio 
+------------------------------------------------------------------------+
| Bottom: Timeline / Animation Tracks / Command Console / BPY Inspector  |
+------------------------------------------------------------------------+
```

---

::id security-verification
::align left

# 10. Security, Trust, and Verification Architecture

Kosh achieves high trust ratings by enforcing defense-in-depth principles:

### M8ven Trust Index: Grade B (89/100)
* **Verified Publisher**: Cryptographic proof of ownership over code and domain.
* **Live Monitored**: GitHub App automatically audits and re-checks on push.
* **Zero Known Vulnerabilities**: Regular CVE scans and clean supply chain.

### Defense Mechanisms
1. **AST Python Script Sanitizer**:
   - Analyzes script AST before passing to Blender execution worker.
   - Denies `import os`, `import subprocess`, `import sys`, `eval()`, `exec()`.
2. **Loopback Daemon Isolation**:
   - The warm TCP daemon strictly binds to `127.0.0.1`.
   - External network requests to daemon port 9091 are dropped at OS boundary.
3. **Local Storage Sandboxing**:
   - Assets are confined to the designated storage directory with
     strict path normalization.
   - Periodic `StorageCleanupService` removes orphaned assets older than TTL.

---

::id summary-roadmap
::align left

# 11. Summary and Future Roadmap

### Project Milestones Achieved
* Full Model Context Protocol (MCP) compliance over SSE and JSON-RPC 2.0.
* Headless Blender 5.2 LTS warm daemon delivering sub-400ms turnaround.
* 55 native parametric tools with behavioral annotations and zero CVEs.
* Responsive web-based 3D CAD DCC studio built on Next.js 15 and Three.js.

### Upcoming Milestones
* **Native STEP / IGES Export**: Direct boundary representation
  (B-Rep) conversion.
* **WebGPU Real-Time Compute**: Client-side geometry shader acceleration.
* **Multi-Agent Collaborative Canvas**: Concurrent multi-LLM 3D scene editing.

```text no-eval
+-----------------------------------------------------------------------+
|                       GETTING STARTED WITH KOSH                       |
|                                                                       |
|  1. Clone Repository:    git clone https://github.com/SachinyadavAug20/kosh|
|  2. Start Backend:       cd backend && ./gradlew bootRun              |
|  3. Start Frontend:      cd frontend && npm install && npm run dev    |
|  4. MCP Desktop Config:  Connect agent to /mcp/sse                    |
+-----------------------------------------------------------------------+
```

::align center

### Thank You!
#### Questions & Discussion
