"use client";

import React, { useState, useEffect } from "react";
import { Key, X, ExternalLink, Check, ShieldCheck, Zap, Server, Activity } from "lucide-react";

export interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onSaveToken: (token: string) => void;
  onClearToken: () => void;
}

export function ApiKeyModal({
  isOpen,
  onClose,
  token,
  onSaveToken,
  onClearToken,
}: ApiKeyModalProps) {
  const [inputVal, setInputVal] = useState(token);
  const [serverEndpoint, setServerEndpoint] = useState("http://localhost:8080/mcp");
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setInputVal(token);
    try {
      const savedEndpoint = localStorage.getItem("kosh_mcp_endpoint");
      if (savedEndpoint) setServerEndpoint(savedEndpoint);
    } catch {
      // ignore
    }
  }, [token, isOpen]);

  if (!isOpen) return null;

  const handlePingServer = async () => {
    setIsPinging(true);
    setPingStatus("Pinging MCP server...");
    try {
      const baseUrl = serverEndpoint.replace(/\/mcp\/?$/, "");
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setPingStatus(`Connected: ${data.status} (${data.toolsCount || 26} tools, ${data.blender?.version || "Blender"})`);
      } else {
        setPingStatus(`Server error: HTTP ${res.status}`);
      }
    } catch (err: any) {
      setPingStatus(`Connection failed: ${err.message || "Unreachable"}`);
    } finally {
      setIsPinging(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveToken(inputVal.trim());
    try {
      localStorage.setItem("kosh_mcp_endpoint", serverEndpoint.trim());
    } catch {
      // ignore
    }
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const handleSetDemo = () => {
    setInputVal("demo");
    onSaveToken("demo");
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const handleClear = () => {
    setInputVal("");
    onClearToken();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
      <div className="w-full max-w-md bg-[#18181b] border border-[#27272a] shadow-2xl rounded font-mono text-xs text-[#f4f4f5] overflow-hidden">
        {/* Header */}
        <div className="h-10 px-4 bg-[#141416] border-b border-[#27272a] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[#ea580c] font-bold">
            <Key className="w-4 h-4" />
            <span className="text-white uppercase tracking-wider text-[11px]">
              API Key & Server Connection
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#71717a] hover:text-[#f4f4f5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-4 space-y-4">
          <div className="text-[11px] text-[#a1a1aa] leading-relaxed">
            Zero configuration 3D studio. Bring your Google Gemini API key or use Demo mode.
            Your key stays local to your browser.
          </div>

          {/* Input 1: API Key */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider flex justify-between">
              <span>Google Gemini API Key</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[#ea580c] hover:underline flex items-center space-x-1"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </label>

            <input
              type="password"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Paste AIzaSy... API key"
              className="w-full bg-[#141416] border border-[#27272a] focus:border-[#ea580c] rounded px-3 py-2 text-xs text-[#f4f4f5] placeholder-[#52525b] outline-none font-mono"
            />
          </div>

          {/* Input 2: MCP Server Endpoint */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider flex items-center space-x-1">
                <Server className="w-3 h-3 text-[#ea580c]" />
                <span>MCP Server Endpoint</span>
              </label>
              <button
                type="button"
                onClick={handlePingServer}
                disabled={isPinging}
                className="text-[10px] text-[#ea580c] hover:underline flex items-center space-x-1"
              >
                <Activity className={`w-2.5 h-2.5 ${isPinging ? "animate-spin" : ""}`} />
                <span>Ping Server</span>
              </button>
            </div>
            <input
              type="text"
              value={serverEndpoint}
              onChange={(e) => setServerEndpoint(e.target.value)}
              placeholder="http://localhost:8080/mcp"
              className="w-full bg-[#141416] border border-[#27272a] focus:border-[#ea580c] rounded px-3 py-2 text-xs text-[#f4f4f5] placeholder-[#52525b] outline-none font-mono"
            />
            {pingStatus && (
              <div className="text-[10px] text-[#a1a1aa] bg-[#141416] px-2 py-1 rounded border border-[#27272a]">
                {pingStatus}
              </div>
            )}
          </div>

          {/* Key Status Pill */}
          <div className="flex items-center justify-between p-2.5 bg-[#141416] border border-[#27272a] rounded text-[11px]">
            <span className="text-[#71717a]">Status:</span>
            {token ? (
              token === "demo" ? (
                <span className="text-amber-400 font-bold flex items-center space-x-1">
                  <Zap className="w-3 h-3" />
                  <span>Demo Mode Active</span>
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Connected (BYOK)</span>
                </span>
              )
            ) : (
              <span className="text-[#71717a]">No key configured (Click Demo Mode)</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-[#27272a]">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSetDemo}
                className="px-2.5 py-1.5 rounded bg-[#202024] hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] text-[11px] transition-colors"
                title="Use Demo mode with built-in procedural generators"
              >
                Demo Mode
              </button>
              {token && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2.5 py-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 text-[11px] transition-colors"
                >
                  Clear Key
                </button>
              )}
            </div>

            <button
              type="submit"
              className="px-4 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold rounded text-[11px] flex items-center space-x-1 transition-colors"
            >
              {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{isSaved ? "Saved!" : "Save & Connect"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
