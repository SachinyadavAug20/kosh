"use client";

import React, { useState } from "react";
import { BackendHealth } from "@/types/mcp";
import { useTheme, THEMES, ThemeId } from "@/context/ThemeContext";
import {
  Key,
  RefreshCw,
  Eye,
  EyeOff,
  Terminal,
  Shield,
  ExternalLink,
  Zap,
  Palette,
  Share2,
  Download,
  Upload,
} from "lucide-react";

interface TerminalHeaderProps {
  health: BackendHealth | null;
  isHealthChecking: boolean;
  onRefreshHealth: () => void;
  token: string;
  onSaveToken: (token: string) => void;
  onClearToken: () => void;
  onExportSession?: () => void;
  onImportSession?: (file: File) => void;
}

export function TerminalHeader({
  health,
  isHealthChecking,
  onRefreshHealth,
  token,
  onSaveToken,
  onClearToken,
  onExportSession,
  onImportSession,
}: TerminalHeaderProps) {
  const { theme, setTheme } = useTheme();
  const [isKeyDrawerOpen, setIsKeyDrawerOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
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
  const isDemo = token.toLowerCase() === "demo";

  const getKeyBadgeText = () => {
    if (!token) return "KEY: REQUIRED";
    if (isDemo) return "KEY: DEMO (OFFLINE)";
    return "KEY: GEMINI ACTIVE";
  };

  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg-header)] select-none sticky top-0 z-50 text-xs">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-bold tracking-wider text-[var(--foreground)]">
            <Terminal className="w-4 h-4 text-[var(--accent)]" />
            <span>KOSH</span>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-[var(--text-muted)] font-normal">BLENDER_MCP_STUDIO</span>
          </div>

          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-[var(--bg-subpanel)] border border-[var(--border)] text-[var(--text-muted)]">
            v2.5-PROD
          </span>
        </div>

        {/* System Status Indicators, Themes & Key Drawer */}
        <div className="flex items-center space-x-2 md:space-x-3">
          {/* Theme Switcher Button */}
          <div className="relative">
            <button
              onClick={() => setIsThemeOpen(!isThemeOpen)}
              title="Change Studio Theme"
              className="flex items-center space-x-1.5 px-2.5 py-1 bg-[var(--bg-subpanel)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
            >
              <Palette className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="font-semibold capitalize hidden sm:inline">{THEMES[theme]?.name || theme}</span>
            </button>

            {/* Theme Dropdown */}
            {isThemeOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-[var(--bg-panel)] border border-[var(--border)] shadow-2xl py-1 z-50">
                <div className="px-3 py-1 text-[10px] text-[var(--text-muted)] border-b border-[var(--border)]">
                  SELECT STUDIO THEME
                </div>
                {(Object.keys(THEMES) as ThemeId[]).map((tId) => (
                  <button
                    key={tId}
                    onClick={() => {
                      setTheme(tId);
                      setIsThemeOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-[11px] hover:bg-[var(--accent)] hover:text-[var(--background)] transition-colors ${
                      theme === tId ? "font-bold text-[var(--accent)]" : "text-[var(--foreground)]"
                    }`}
                  >
                    <span>{THEMES[tId].name}</span>
                    <span className="text-[9px] px-1 bg-[var(--bg-subpanel)] border border-[var(--border)]">
                      {THEMES[tId].badge}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* MCP Server Status */}
          <button
            onClick={onRefreshHealth}
            title="Click to re-ping backend"
            className="flex items-center space-x-1.5 px-2 py-1 bg-[var(--bg-subpanel)] border border-[var(--border)] hover:border-[var(--border-light)] transition-colors"
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isBackendUp ? "bg-[#22c55e] shadow-[0_0_6px_#22c55e]" : "bg-[#ef4444]"
              }`}
            />
            <span className="text-[var(--text-muted)]">MCP:</span>
            <span className={isBackendUp ? "text-[#22c55e]" : "text-[#ef4444]"}>
              {isBackendUp ? "8080 ONLINE" : "OFFLINE"}
            </span>
            <RefreshCw
              className={`w-3 h-3 text-[var(--text-muted)] ${isHealthChecking ? "animate-spin" : ""}`}
            />
          </button>

          {/* Blender Engine Status */}
          <div className="hidden md:flex items-center space-x-1.5 px-2 py-1 bg-[var(--bg-subpanel)] border border-[var(--border)]">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isBlenderReady ? "bg-[#22c55e]" : "bg-[#f59e0b]"
              }`}
            />
            <span className="text-[var(--text-muted)]">BLENDER:</span>
            <span className={isBlenderReady ? "text-[var(--foreground)]" : "text-[#f59e0b]"}>
              {isBlenderReady ? "5.2 READY" : "NOT FOUND"}
            </span>
          </div>

          {/* Google Gemini Key Drawer Toggle */}
          <button
            onClick={() => setIsKeyDrawerOpen(!isKeyDrawerOpen)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 border transition-colors ${
              token
                ? "bg-[var(--bg-subpanel)] border-[var(--accent)]/50 text-[var(--accent)] hover:border-[var(--accent)]"
                : "bg-[var(--bg-subpanel)] border-[#ef4444]/50 text-[#ef4444] hover:border-[#ef4444]"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span className="font-semibold tracking-wide">{getKeyBadgeText()}</span>
          </button>
        </div>
      </div>

      {/* Google API Key Drawer */}
      {isKeyDrawerOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 text-xs">
          <form onSubmit={handleSave} className="max-w-4xl mx-auto space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1 text-[var(--text-muted)]">
              <div className="flex items-center space-x-2">
                <Shield className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span className="font-bold text-[var(--foreground)]">GOOGLE GEMINI API KEY (FREE)</span>
                <span className="text-[var(--text-muted)]">— Free tier (gemini-2.5-flash), zero cost</span>
              </div>
              <div className="flex items-center space-x-3 text-[10px]">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-[#06b6d4] hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Get Free Key (Google AI Studio)</span>
                </a>
                <button
                  type="button"
                  onClick={handleSetDemoKey}
                  className="text-[var(--accent)] hover:underline flex items-center space-x-1"
                >
                  <Zap className="w-3 h-3" />
                  <span>Use Offline Demo Mode</span>
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="Paste your Google Gemini API Key (e.g., AIzaSy...)"
                  className="w-full bg-[var(--bg-subpanel)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none px-3 py-1.5 text-xs text-[var(--foreground)] font-mono pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--foreground)]"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="submit"
                className="px-3 py-1.5 bg-[var(--accent)] text-[var(--background)] font-bold hover:opacity-90 transition-opacity"
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
                  className="px-2.5 py-1.5 bg-[var(--bg-subpanel)] border border-[var(--border)] text-[#ef4444] hover:border-[#ef4444]"
                >
                  CLEAR
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsKeyDrawerOpen(false)}
                className="px-2.5 py-1.5 bg-[var(--bg-subpanel)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
              >
                CLOSE
              </button>
            </div>

            <div className="text-[10px] text-[var(--text-muted)] flex items-center justify-between">
              <span>Key is stored only in your browser localStorage; never saved on the server.</span>
              <span className="text-[var(--accent)]">Multi-Model Cascade: gemini-2.5-flash • flash-latest • flash-lite</span>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
