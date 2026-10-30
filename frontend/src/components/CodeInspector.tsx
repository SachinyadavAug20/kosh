"use client";

import React, { useState } from "react";
import {
  Code,
  Copy,
  Check,
  Download,
  Play,
  Layers,
  Terminal,
  FileCode,
  Eye,
  Info,
} from "lucide-react";

interface CodeInspectorProps {
  script: string | null;
  onExecuteScript?: (script: string) => void;
  isLoading?: boolean;
  stdout?: string | null;
  stderr?: string | null;
  meshList?: Array<{ id: string; name: string; triangles: number; vertices: number }>;
}

export function CodeInspector({
  script,
  onExecuteScript,
  isLoading,
  stdout,
  stderr,
  meshList = [],
}: CodeInspectorProps) {
  const [activeTab, setActiveTab] = useState<"script" | "outliner" | "logs">("script");
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
    a.download = "kosh_scene_script.py";
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
    <div className="flex flex-col h-full bg-[#18181b] text-xs font-sans border-l border-[#3f3f46]">
      {/* Inspector Top Tabs Strip */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#3f3f46] bg-[#1f1f23]">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab("script")}
            className={`tool-btn ${activeTab === "script" ? "active" : ""}`}
          >
            <Code className="w-3 h-3 mr-1" />
            <span>Script</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("outliner")}
            className={`tool-btn ${activeTab === "outliner" ? "active" : ""}`}
          >
            <Layers className="w-3 h-3 mr-1" />
            <span>Outliner</span>
            {meshList.length > 0 && (
              <span className="ml-1 px-1 bg-[#18181b] rounded-sm text-[9px] font-mono">{meshList.length}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`tool-btn ${activeTab === "logs" ? "active" : ""}`}
          >
            <Terminal className="w-3 h-3 mr-1" />
            <span>Build Logs</span>
            {stderr && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
            )}
          </button>
        </div>

        {/* Script Actions */}
        {activeTab === "script" && (
          <div className="flex items-center space-x-1">
            {onExecuteScript && (
              <button
                onClick={() => setIsEditable(!isEditable)}
                className={`tool-btn ${isEditable ? "active" : ""}`}
              >
                {isEditable ? "Lock" : "Edit"}
              </button>
            )}

            {isEditable && onExecuteScript && (
              <button
                onClick={handleRunModified}
                disabled={isLoading || !editableScript.trim()}
                className="tool-btn bg-[#ea580c] hover:bg-[#f97316] text-[#ffffff] font-semibold border-[#c2410c]"
              >
                <Play className="w-3 h-3 fill-current mr-1" />
                <span>Run</span>
              </button>
            )}

            <button onClick={handleCopy} disabled={!activeContent} className="tool-btn p-1" title="Copy script">
              {copied ? <Check className="w-3 h-3 text-[#f4f4f5]" /> : <Copy className="w-3 h-3" />}
            </button>

            <button onClick={handleDownload} disabled={!activeContent} className="tool-btn p-1" title="Download script">
              <Download className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-auto bg-[#18181b]">
        {activeTab === "script" ? (
          activeContent ? (
            isEditable ? (
              <textarea
                value={editableScript}
                onChange={(e) => setEditableScript(e.target.value)}
                className="w-full h-full bg-[#141416] text-[#f4f4f5] p-3 font-mono text-[11px] leading-relaxed border-none focus:outline-none resize-none"
                spellCheck={false}
              />
            ) : (
              <div className="table w-full font-mono text-[11px] leading-relaxed">
                {lines.map((line, idx) => (
                  <div key={idx} className="table-row hover:bg-[#1f1f23]">
                    <span className="table-cell select-none pr-3 pl-2 py-0.5 text-right text-[#52525b] border-r border-[#27272a] w-8">
                      {idx + 1}
                    </span>
                    <span className="table-cell pl-3 py-0.5 text-[#f4f4f5] whitespace-pre select-text">
                      {line}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="p-4 text-[#71717a] font-mono text-xs italic">
              // No Blender bpy script generated yet. Compile a prompt to view Python execution code.
            </div>
          )
        ) : activeTab === "outliner" ? (
          <div className="p-2 space-y-1">
            <div className="text-[10px] text-[#71717a] font-mono uppercase px-1 pb-1 border-b border-[#27272a]">
              Scene Hierarchy ({meshList.length} objects)
            </div>
            {meshList.length === 0 ? (
              <div className="text-[#71717a] py-4 text-center font-mono text-xs">No objects in scene</div>
            ) : (
              meshList.map((m, i) => (
                <div
                  key={m.id || i}
                  className="flex items-center justify-between p-1.5 bg-[#1f1f23] border border-[#3f3f46] hover:bg-[#27272a] rounded-sm text-xs transition-colors"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <Layers className="w-3.5 h-3.5 text-[#a1a1aa] shrink-0" />
                    <span className="font-mono text-[#f4f4f5] truncate">{m.name}</span>
                  </div>
                  <div className="text-[10px] font-mono text-[#a1a1aa] shrink-0">
                    {m.triangles.toLocaleString()} tris
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="p-3 font-mono text-[11px] leading-relaxed space-y-2 select-text">
            {stdout && (
              <div>
                <div className="text-[10px] text-[#71717a] uppercase mb-1">STDOUT</div>
                <pre className="text-[#a1a1aa] whitespace-pre-wrap">{stdout}</pre>
              </div>
            )}
            {stderr && (
              <div className="pt-2 border-t border-[#3f3f46]">
                <div className="text-[10px] text-[#ef4444] uppercase mb-1">STDERR / TRACE</div>
                <pre className="text-[#f87171] whitespace-pre-wrap">{stderr}</pre>
              </div>
            )}
            {!stdout && !stderr && (
              <div className="text-[#71717a] italic">// No process logs recorded.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
