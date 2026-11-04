# Security Policy

## Overview
Kosh is designed with security and privacy as first-class principles. The workstation operates locally by default on loopback network interfaces (127.0.0.1), executes headless Blender scripts through an AST-level syntax and namespace sanitizer, and maintains zero automated telemetry or remote logging.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | Yes                |
| < 1.0   | No                 |

## Vulnerability Reporting

If you discover a security vulnerability or security-relevant defect within Kosh, please disclose it responsibly. Do not open public GitHub issues for security vulnerabilities.

### Reporting Channel
- Primary Email: `sachinyadavaug20@gmail.com`
- Security Contact: Sachin Yadav (Repository Maintainer)
- Subject Prefix: `[SECURITY] Kosh Vulnerability Report`

### Information to Include
- Detailed description of the vulnerability and attack vector.
- Step-by-step reproduction steps or proof-of-concept (PoC) script.
- Affected components (backend Spring Boot service, Blender execution daemon, frontend workstation, or MCP tools).
- Potential impact assessment.
- Any suggested remediation or mitigation.

### Response SLA
- Initial Acknowledgment: Within 48 hours of receipt.
- Assessment & Triage: Within 5 business days.
- Patch Release & Advisory: Within 14 business days, coordinated with the reporter.

## Safe Harbor Policy
Activities conducted in accordance with this policy are considered authorized. We will not pursue legal action against researchers who:
- Make a good faith effort to avoid privacy violations, data destruction, and interruption of services.
- Give us reasonable time to correct the issue before publishing details.
- Refrain from exploiting the vulnerability beyond what is strictly necessary to establish proof of concept.

## Architectural Security Measures

### 1. Local Execution Boundary
- Backend HTTP, WebSocket, and SSE endpoints bind exclusively to local or specified host interfaces.
- Blender daemon runs on loopback port 9091 with isolated inter-process communication.

### 2. Python Script Sanitization
- All dynamically constructed or imported Python execution strings undergo validation through `com.kosh.util.ScriptSanitizer`.
- Dangerous modules (`os.system`, `subprocess`, raw socket operations, unauthorized file I/O) are intercepted before dispatching to the Blender runtime.

### 3. Model Context Protocol Annotations
- All 23 native MCP tools declare explicit behavioral hints (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) per the MCP security standard.
- Clients can enforce human-in-the-loop confirmation on any tool designated with `destructiveHint: true`.

### 4. Zero Remote Telemetry
- Kosh does not transmit user geometry, prompts, rendered buffers, or API keys to external analytics servers.
- External API keys (such as Google Gemini) are stored strictly in client-side browser session memory or user-specified local environment variables.
