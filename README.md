# KOSH (कौश)
> Minimalist Developer-First Creative Model Context Protocol (MCP) Hub

```text
 ┌─ [ BharatCode / OpenAI-Compatible LLM ]
 │
 ├──▶ [ Next.js Terminal Studio ] (localhost:3000)
 │          │ (BYOK Session Headers: X-BharatCode-Token)
 │          ▼
 └──▶ [ Spring Boot MCP Server ] (localhost:8080)
            │ (JSON-RPC 2.0 /mcp)
            ▼
      [ Headless Blender Engine ] (bpy runner)
            │ (export GLB / STL)
            ▼
      [ Three.js Monospace Viewport ]
```

Kosh is an ultra-minimalist, stark terminal-aesthetic studio and Model Context Protocol (MCP) server hub that transforms natural language and parametric prompts into real 3D models (`.glb` / `.stl`) via headless Blender (`bpy`).

---

## Philosophy & Constraints

- **Terminal-First UX:** Stark monospace typography, high-contrast zinc palette (`#09090b`), zero bloat, brutalist developer aesthetic.
- **BYOK (Bring Your Own Key):** Zero hardcoded credentials. Pass your free **Google Gemini API Key** (from Google AI Studio) or BharatCode/OpenAI-compatible token dynamically via session headers or the UI key drawer.
- **Protocol Native:** Standard MCP JSON-RPC 2.0 interface (`POST /mcp`) supporting `tools/list` and `tools/call` for tools such as `blender_mesh` and `cad_model`.
- **Deterministic Sandboxed Execution:** Headless Blender execution wrapped with timeouts, sanity checks, script sanitization, and binary validation.

---

## Repository Structure

```text
.
├── BharatCode.txt             # Verification file (Build League 2026)
├── Makefile                   # Developer orchestration commands
├── run.sh                     # Automated runner script with prerequisite checks
├── backend/                   # Spring Boot 3.3+ (Java 21) MCP Hub
│   ├── pom.xml
│   └── src/main/java/com/kosh/
│       ├── KoshApplication.java
│       ├── config/            # CORS, WebClient, Storage configuration
│       ├── controller/        # McpController (/mcp), AssetController, HealthController
│       ├── dto/               # JSON-RPC 2.0 & Tool execution DTOs
│       ├── service/           # BharatCodeClient, BlenderExecutionService, McpToolRegistry
│       └── util/              # ScriptSanitizer for LLM bpy code extraction
└── frontend/                  # Next.js 15 (App Router, Tailwind CSS, Three.js)
    ├── package.json
    ├── tailwind.config.ts
    └── src/
        ├── app/               # Root layout, globals.css, main terminal studio
        ├── components/        # TerminalHeader, CommandConsole, Viewport3D, CodeInspector
        ├── hooks/             # useLocalStorageToken, useMcpClient
        └── types/             # MCP and 3D preview definitions
```

---

## Prerequisites

Ensure the following tools are installed and present in your system `$PATH`:

| Requirement | Minimum Version | Verification |
|-------------|-----------------|--------------|
| **Java** | OpenJDK 21+ | `java -version` |
| **Maven** | 3.9+ | `mvn -version` |
| **Node.js** | 20+ (20.x, 22.x, or newer) | `node -v` |
| **npm** | 10+ | `npm -v` |
| **Blender** | 4.x / 5.x LTS | `blender --version` |

---

## Quickstart

### Automated Run
Execute the root runner script, which checks prerequisites and boots both backend and frontend:
```bash
chmod +x run.sh
./run.sh
```

Or use the `Makefile`:
```bash
make check-deps
make dev
```

### Manual Run

#### 1. Start the Backend (Port 8080)
```bash
cd backend
mvn clean spring-boot:run
```
Backend health check:
```bash
curl http://localhost:8080/api/health
```

#### 2. Start the Frontend (Port 3000)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## MCP Protocol Details

The backend exposes standard MCP JSON-RPC 2.0 at `POST /mcp`:

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

### 2. Call `blender_mesh` Tool
```bash
# Using free Google Gemini API Key:
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "X-Google-Key: AIzaSyYourGoogleApiKeyHere" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "blender_mesh",
      "arguments": {
        "prompt": "Procedural low-poly sci-fi crate with beveled edges and metallic finish"
      }
    }
  }' | jq
```

---

## Author & Verification
- **Project:** Kosh (Creative MCP Server Hub)
- **Author:** Sachin SureshChandra Yadav ([@SachinyadavAug20](https://github.com/SachinyadavAug20))
- **Event:** BharatCode Build League 2026
