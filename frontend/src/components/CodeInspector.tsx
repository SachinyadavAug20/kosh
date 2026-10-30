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
    <div className="flex flex-col h-full bg-[#09090b] text-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#27272a] bg-[#121215]">
        <div className="flex items-center space-x-2">
          <Code className="w-3.5 h-3.5 text-[#22c55e]" />
          <span className="font-semibold text-[#f4f4f5]">BLENDER BPY SCRIPT</span>
          <span className="text-[10px] text-[#71717a]">
            {lines.length > 0 ? `${lines.length} lines` : "EMPTY"}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          {onExecuteScript && (
            <button
              onClick={() => setIsEditable(!isEditable)}
              className={`px-2 py-0.5 text-[11px] border transition-colors ${
                isEditable
                  ? "bg-[#27272a] border-[#22c55e] text-[#22c55e]"
                  : "border-[#27272a] text-[#71717a] hover:text-[#f4f4f5]"
              }`}
            >
              {isEditable ? "LOCKED VIEW" : "EDIT CODE"}
            </button>
          )}

          {isEditable && onExecuteScript && (
            <button
              onClick={handleRunModified}
              disabled={isLoading || !editableScript.trim()}
              className="flex items-center space-x-1 px-2 py-0.5 bg-[#22c55e] text-[#09090b] font-bold text-[11px] hover:bg-[#4ade80] disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>RUN MODIFIED</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            disabled={!activeContent}
            title="Copy script"
            className="flex items-center space-x-1 px-2 py-0.5 border border-[#27272a] text-[#71717a] hover:text-[#f4f4f5] hover:border-[#3f3f46] disabled:opacity-40"
          >
            {copied ? <Check className="w-3 h-3 text-[#22c55e]" /> : <Copy className="w-3 h-3" />}
            <span className="text-[11px]">{copied ? "COPIED" : "COPY"}</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={!activeContent}
            title="Download .py script"
            className="p-1 border border-[#27272a] text-[#71717a] hover:text-[#f4f4f5] hover:border-[#3f3f46] disabled:opacity-40"
          >
            <Download className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Editor / Viewer Body */}
      <div className="flex-1 overflow-auto bg-[#09090b] font-mono text-[11px] leading-relaxed">
        {activeContent ? (
          isEditable ? (
            <textarea
              value={editableScript}
              onChange={(e) => setEditableScript(e.target.value)}
              className="w-full h-full bg-[#09090b] text-[#22c55e] p-3 font-mono text-[11px] leading-relaxed border-none focus:outline-none resize-none"
              spellCheck={false}
            />
          ) : (
            <div className="table w-full">
              {lines.map((line, idx) => (
                <div key={idx} className="table-row hover:bg-[#121215]">
                  <span className="table-cell select-none pr-3 pl-2 py-0.5 text-right text-[#3f3f46] border-r border-[#18181b] w-8">
                    {idx + 1}
                  </span>
                  <span className="table-cell pl-3 py-0.5 text-[#f4f4f5] whitespace-pre">
                    {line}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="p-4 text-[#3f3f46] italic">
            // No script generated yet. Execute an MCP tool to inspect the underlying Blender bpy code.
          </div>
        )}
      </div>
    </div>
  );
}
