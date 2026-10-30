"use client";

import React, { useState } from "react";
import { Code, Copy, Check, Download, Play, RefreshCw } from "lucide-react";

interface CodeInspectorProps {
  script: string | null;
  onExecuteScript?: (script: string) => void;
  isLoading?: boolean;
}

export function CodeInspector({ script, onExecuteScript, isLoading }: CodeInspectorProps) {
  const [copied, setCopied] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const [editableScript, setEditableScript] = useState("");

  React.useEffect(() => {
    if (script) {
      setEditableScript(script);
    }
  }, [script]);

  const handleCopy = () => {
    const textToCopy = isEditable ? editableScript : script || "";
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = isEditable ? editableScript : script || "";
    if (!text) return;
    const blob = new Blob([text], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kosh_blender_script.py";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRunModified = () => {
    if (onExecuteScript && editableScript.trim()) {
      onExecuteScript(editableScript.trim());
    }
  };

  const activeContent = isEditable ? editableScript : script;
  const lines = activeContent ? activeContent.split("\n") : [];

  return (
    <div className="flex flex-col h-full bg-[var(--background)] text-xs text-[var(--foreground)] font-mono">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-header)]">
        <div className="flex items-center space-x-2">
          <Code className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="font-semibold text-[var(--foreground)]">BLENDER BPY SCRIPT</span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {lines.length > 0 ? `${lines.length} lines` : "EMPTY"}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          {onExecuteScript && (
            <button
              onClick={() => setIsEditable(!isEditable)}
              className={`px-2 py-0.5 text-[11px] border transition-colors ${
                isEditable
                  ? "bg-[var(--bg-subpanel)] border-[var(--accent)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {isEditable ? "LOCKED VIEW" : "EDIT CODE"}
            </button>
          )}

          {isEditable && onExecuteScript && (
            <button
              onClick={handleRunModified}
              disabled={isLoading || !editableScript.trim()}
              className="flex items-center space-x-1 px-2.5 py-0.5 bg-[var(--accent)] text-[var(--background)] font-bold text-[11px] hover:opacity-90 disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>RUN MODIFIED</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            disabled={!activeContent}
            title="Copy script"
            className="flex items-center space-x-1 px-2 py-0.5 border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-light)] disabled:opacity-40"
          >
            {copied ? <Check className="w-3 h-3 text-[var(--accent)]" /> : <Copy className="w-3 h-3" />}
            <span className="text-[11px]">{copied ? "COPIED" : "COPY"}</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={!activeContent}
            title="Download .py script"
            className="p-1 border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-light)] disabled:opacity-40"
          >
            <Download className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Editor / Viewer Body */}
      <div className="flex-1 overflow-auto bg-[var(--background)] font-mono text-[11px] leading-relaxed">
        {activeContent ? (
          isEditable ? (
            <textarea
              value={editableScript}
              onChange={(e) => setEditableScript(e.target.value)}
              className="w-full h-full bg-[var(--background)] text-[var(--accent)] p-3 font-mono text-[11px] leading-relaxed border-none focus:outline-none resize-none"
              spellCheck={false}
            />
          ) : (
            <div className="table w-full">
              {lines.map((line, idx) => (
                <div key={idx} className="table-row hover:bg-[var(--bg-subpanel)]">
                  <span className="table-cell select-none pr-3 pl-2 py-0.5 text-right text-[var(--text-muted)] border-r border-[var(--border)] w-8 opacity-60">
                    {idx + 1}
                  </span>
                  <span className="table-cell pl-3 py-0.5 text-[var(--foreground)] whitespace-pre">
                    {line}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="p-4 text-[var(--text-muted)] italic">
            // No script generated yet. Execute an MCP tool to inspect the underlying Blender bpy code.
          </div>
        )}
      </div>
    </div>
  );
}
