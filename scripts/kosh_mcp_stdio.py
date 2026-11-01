#!/usr/bin/env python3
"""
Kosh MCP stdio Bridge
Enables external desktop agents (Claude Desktop, Cursor, Zed, Cline)
to communicate with the Kosh Model Context Protocol server over stdio.

Usage in Claude Desktop (claude_desktop_config.json):
{
  "mcpServers": {
    "kosh": {
      "command": "python3",
      "args": ["/path/to/Kosh/scripts/kosh_mcp_stdio.py"]
    }
  }
}
"""
import sys
import os
import json
import urllib.request
import urllib.error

DEFAULT_URL = os.environ.get("KOSH_MCP_URL", "http://localhost:8080/mcp")
API_KEY = os.environ.get("GEMINI_API_KEY", os.environ.get("KOSH_API_KEY", ""))

def main():
    target_url = DEFAULT_URL
    if len(sys.argv) > 1 and sys.argv[1].startswith("http"):
        target_url = sys.argv[1]

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    if API_KEY:
        headers["X-Google-Key"] = API_KEY

    # Line-delimited JSON-RPC loop
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            req_data = json.loads(line)
        except json.JSONDecodeError as err:
            err_resp = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": f"Parse error: {str(err)}"
                }
            }
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()
            continue

        try:
            req_bytes = json.dumps(req_data).encode("utf-8")
            req = urllib.request.Request(target_url, data=req_bytes, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_bytes = resp.read()
                resp_text = resp_bytes.decode("utf-8")
                sys.stdout.write(resp_text + "\n")
                sys.stdout.flush()
        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8") if he.fp else str(he)
            try:
                err_json = json.loads(err_body)
                sys.stdout.write(json.dumps(err_json) + "\n")
            except Exception:
                err_resp = {
                    "jsonrpc": "2.0",
                    "id": req_data.get("id"),
                    "error": {
                        "code": -32603,
                        "message": f"HTTP Error {he.code}: {he.reason}",
                        "data": err_body
                    }
                }
                sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()
        except Exception as e:
            err_resp = {
                "jsonrpc": "2.0",
                "id": req_data.get("id"),
                "error": {
                    "code": -32603,
                    "message": f"Connection error: {str(e)}"
                }
            }
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    main()
