# Privacy Policy for Kosh

Last Updated: November 2026

## Overview

Kosh is an open-source, developer-first creative Model Context Protocol (MCP) server and 3D digital content creation workstation. This policy outlines our commitment to user privacy, local execution, and zero telemetry.

## Data Collection and Telemetry

- **Zero Analytics**: Kosh does not track, collect, or store any personal information, telemetry, usage statistics, or user behavior analytics.
- **No Third-Party Trackers**: The application contains no tracking scripts, cookies, advertising trackers, or external telemetry libraries.

## Network Traffic and Local Execution

- **Local-First Architecture**: Kosh runs entirely on your local machine (`127.0.0.1` / `localhost`).
- **Internal Communication**: JSON-RPC 2.0 communication occurs strictly between your local MCP client (Claude Desktop, Antigravity, Cursor, or custom clients) and the local Spring Boot / Next.js processes.
- **External Network Calls**: Network calls are only initiated when:
  1. Communicating with your chosen AI provider (e.g., Google Gemini API) using your own API key (Bring Your Own Key).
  2. Downloading explicitly requested open-access 3D assets or rendering packages.

## Secrets and Credentials

- **API Keys**: All API credentials (e.g., `GEMINI_API_KEY`, `NEXT_PUBLIC_DEFAULT_GEMINI_KEY`) are stored locally in your environment or `.env` files.
- **No Secret Exfiltration**: Keys and tokens are never logged, cached remotely, forwarded, or shared with third parties.

## Local File Storage

- **CAD Models and Renders**: All generated 3D models (`.glb`, `.blend`, `.stl`, `.obj`), scene states, and rendered frames are stored strictly within your local machine filesystem in designated project storage directories.

## Changes

Any future updates to this policy will be documented directly in this repository.

## Contact

For security inquiries or questions, contact the repository maintainer via GitHub issues at `https://github.com/SachinyadavAug20/kosh`.
