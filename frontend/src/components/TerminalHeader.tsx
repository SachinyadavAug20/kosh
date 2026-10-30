"use client";

import React, { useState } from "react";
import { BackendHealth } from "@/types/mcp";
import { Key, RefreshCw, Eye, EyeOff, Terminal, Shield, ExternalLink, Zap } from "lucide-react";

interface TerminalHeaderProps {
  health: BackendHealth | null;
  isHealthChecking: boolean;
  onRefreshHealth: () => void;
  token: string;
  onSaveToken: (token: string) => void;
  onClearToken: () => void;
}

export function TerminalHeader({
  health,
  isHealthChecking,
  onRefreshHealth,
  token,
  onSaveToken,
  onClearToken,
}: TerminalHeaderProps) {
  const [isKeyDrawerOpen, setIsKeyDrawerOpen] = useState(false);
  const [inputVal, setInputVal] = useState(token);
  const [showKey, setShowKey] = useState(false);

  React.useEffect(() => {
    setInputVal(token);
  }, [token]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveToken(inputVal);
    setIsKeyDrawerOpen(false);
  };

  const handleSetDemoKey = () => {
    setInputVal("demo");
    onSaveToken("demo");
    setIsKeyDrawerOpen(false);
  };

  const isBackendUp = !!health && health.status === "UP";
  const isBlenderReady = health?.blender?.available ?? false;

  const isGoogleKey = token.startsWith("AIzaSy") || token.startsWith("AIza");
  const isDemo = token.toLowerCase() === "demo";

  const getKeyBadgeText = () => {
    if (!token) return "BYOK: REQUIRED";
    if (isDemo) return "KEY: DEMO (OFFLINE)";
    if (isGoogleKey) return "KEY: GOOGLE GEMINI";
    return "KEY: CONFIGURED";
  };

  return (
    <header className="border-b border-[#27272a] bg-[#09090b] select-none sticky top-0 z-50">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 text-xs">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-bold tracking-wider text-[#f4f4f5]">
            <Terminal className="w-4 h-4 text-[#22c55e]" />
            <span>KOSH</span>
            <span className="text-[#3f3f46]">/</span>
            <span className="text-[#71717a] font-normal">CREATIVE_MCP_HUB</span>
          </div>

          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-[#18181b] border border-[#27272a] text-[#71717a]">
            v1.0.0-PROD
          </span>
        </div>

        {/* System Status Indicators */}
        <div className="flex items-center space-x-2 md:space-x-4">
          {/* MCP Server Status */}
          <button
            onClick={onRefreshHealth}
            title="Click to re-ping backend"
            className="flex items-center space-x-1.5 px-2 py-1 bg-[#121215] border border-[#27272a] hover:border-[#3f3f46] transition-colors"
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isBackendUp ? "bg-[#22c55e] shadow-[0_0_6px_#22c55e]" : "bg-[#ef4444]"
              }`}
            />
            <span className="text-[#a1a1aa]">MCP:</span>
            <span className={isBackendUp ? "text-[#22c55e]" : "text-[#ef4444]"}>
              {isBackendUp ? "8080 ONLINE" : "OFFLINE"}
            </span>
            <RefreshCw
              className={`w-3 h-3 text-[#71717a] ${isHealthChecking ? "animate-spin" : ""}`}
            />
          </button>

          {/* Blender Engine Status */}
          <div className="hidden md:flex items-center space-x-1.5 px-2 py-1 bg-[#121215] border border-[#27272a]">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isBlenderReady ? "bg-[#22c55e]" : "bg-[#f59e0b]"
              }`}
            />
            <span className="text-[#a1a1aa]">BLENDER:</span>
            <span className={isBlenderReady ? "text-[#f4f4f5]" : "text-[#f59e0b]"}>
              {isBlenderReady ? "READY" : "NOT FOUND"}
            </span>
          </div>

          {/* BYOK Key Drawer Toggle */}
          <button
            onClick={() => setIsKeyDrawerOpen(!isKeyDrawerOpen)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 border transition-colors ${
              token
                ? "bg-[#121215] border-[#22c55e]/40 text-[#22c55e] hover:border-[#22c55e]"
                : "bg-[#18181b] border-[#ef4444]/40 text-[#f4f4f5] hover:border-[#ef4444]"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span className="font-semibold tracking-wide">{getKeyBadgeText()}</span>
          </button>
        </div>
      </div>

      {/* BYOK Token Drawer */}
      {isKeyDrawerOpen && (
        <div className="border-t border-[#27272a] bg-[#121215] px-4 py-3 text-xs">
          <form onSubmit={handleSave} className="max-w-4xl mx-auto space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1 text-[#a1a1aa]">
              <div className="flex items-center space-x-2">
                <Shield className="w-3.5 h-3.5 text-[#22c55e]" />
                <span className="font-bold text-[#f4f4f5]">SESSION API CREDENTIALS (BYOK)</span>
                <span className="text-[#71717a]">— Never stored on server; passed in session headers</span>
              </div>
              <div className="flex items-center space-x-3 text-[10px]">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-[#06b6d4] hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Get Free Google Gemini Key</span>
                </a>
                <button
                  type="button"
                  onClick={handleSetDemoKey}
                  className="text-[#22c55e] hover:underline flex items-center space-x-1"
                >
                  <Zap className="w-3 h-3" />
                  <span>Offline Demo Mode</span>
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="Paste Google API Key (AIzaSy...) or BharatCode / OpenAI key"
                  className="w-full bg-[#09090b] border border-[#27272a] focus:border-[#22c55e] focus:outline-none px-3 py-1.5 text-xs text-[#f4f4f5] font-mono pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#f4f4f5]"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="submit"
                className="px-3 py-1.5 bg-[#22c55e] text-[#09090b] font-bold hover:bg-[#4ade80] transition-colors"
              >
                SAVE KEY
              </button>

              {token && (
                <button
                  type="button"
                  onClick={() => {
                    onClearToken();
                    setInputVal("");
                  }}
                  className="px-2.5 py-1.5 bg-[#18181b] border border-[#27272a] text-[#ef4444] hover:border-[#ef4444]"
                >
                  CLEAR
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsKeyDrawerOpen(false)}
                className="px-2.5 py-1.5 bg-[#18181b] border border-[#27272a] text-[#71717a] hover:text-[#f4f4f5]"
              >
                CLOSE
              </button>
            </div>

            {inputVal.startsWith("AIzaSy") && (
              <div className="text-[10px] text-[#22c55e] flex items-center space-x-1">
                <span>✓ Detected Google Gemini API Key. Free tier enabled with gemini-2.5-flash.</span>
              </div>
            )}
          </form>
        </div>
      )}
    </header>
  );
}
