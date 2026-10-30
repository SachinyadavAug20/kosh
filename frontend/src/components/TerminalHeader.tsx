"use client";

import React, { useState } from "react";
import { BackendHealth } from "@/types/mcp";
import { useTheme, THEMES, ThemeId } from "@/context/ThemeContext";
import {
  Key,
  RefreshCw,
  Eye,
  EyeOff,
  Box,
  Shield,
  ExternalLink,
  Zap,
  Sliders,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Palette,
  Keyboard,
  HelpCircle,
  Share2,
  Sparkles,
  Terminal,
} from "lucide-react";

interface TerminalHeaderProps {
  health: BackendHealth | null;
  isHealthChecking: boolean;
  onRefreshHealth: () => void;
  token: string;
  onSaveToken: (token: string) => void;
  onClearToken: () => void;
  isLeftOpen?: boolean;
  onToggleLeft?: () => void;
  isRightOpen?: boolean;
  onToggleRight?: () => void;
  onOpenShortcuts?: () => void;
  onOpenPasteBpy?: () => void;
  onOpenShare?: () => void;
  onOpenShowcase?: () => void;
}

export function TerminalHeader({
  health,
  isHealthChecking,
  onRefreshHealth,
  token,
  onSaveToken,
  onClearToken,
  isLeftOpen = true,
  onToggleLeft,
  isRightOpen = false,
  onToggleRight,
  onOpenShortcuts,
  onOpenPasteBpy,
  onOpenShare,
  onOpenShowcase,
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

  return (
    <header className="border-b border-[#3f3f46] bg-[#1f1f23] select-none sticky top-0 z-40 text-xs font-sans">
      <div className="flex items-center justify-between px-3 py-1.5">
        {/* Brand & Left Dock Toggle */}
        <div className="flex items-center space-x-2">
          {onToggleLeft && (
            <button
              onClick={onToggleLeft}
              title={isLeftOpen ? "Collapse Left Tool Dock" : "Expand Left Tool Dock"}
              className="tool-btn p-1"
            >
              {isLeftOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
            </button>
          )}

          <div className="flex items-center space-x-1.5 font-bold tracking-tight text-[#f4f4f5]">
            <Box className="w-4 h-4 text-[#ea580c]" />
            <span className="font-mono">KOSH</span>
            <span className="text-[#52525b]">/</span>
            <span className="text-[#a1a1aa] font-medium text-[11px]">CAD_STUDIO</span>
          </div>

          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono bg-[#18181b] border border-[#3f3f46] text-[#a1a1aa] rounded-sm">
            v3.0-DCC
          </span>
        </div>

        {/* Center / Right Status & Actions */}
        <div className="flex items-center space-x-2">
          {/* Theme Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsThemeOpen(!isThemeOpen)}
              title="Theme Settings"
              className="tool-btn space-x-1"
            >
              <Palette className="w-3 h-3 text-[#a1a1aa]" />
              <span className="text-[11px] hidden md:inline">{THEMES[theme]?.name || "Theme"}</span>
            </button>

            {isThemeOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-[#1f1f23] border border-[#3f3f46] shadow-xl py-1 z-50 rounded-sm">
                <div className="px-2.5 py-1 text-[10px] text-[#71717a] font-mono border-b border-[#3f3f46]">
                  WORKSTATION THEMES
                </div>
                {(Object.keys(THEMES) as ThemeId[]).map((tId) => (
                  <button
                    key={tId}
                    onClick={() => {
                      setTheme(tId);
                      setIsThemeOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1 text-left text-[11px] hover:bg-[#27272a] transition-colors ${
                      theme === tId ? "font-semibold text-[#f4f4f5]" : "text-[#a1a1aa]"
                    }`}
                  >
                    <span>{THEMES[tId].name}</span>
                    <span className="text-[9px] font-mono px-1 bg-[#18181b] border border-[#3f3f46] rounded-sm">
                      {THEMES[tId].badge}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* MCP Health */}
          <button
            onClick={onRefreshHealth}
            title="Re-check MCP Connection"
            className="tool-btn space-x-1.5"
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${isBackendUp ? "bg-[#a1a1aa]" : "bg-[#ef4444]"}`}
            />
            <span className="font-mono text-[10px] text-[#a1a1aa]">MCP:</span>
            <span className={`font-mono text-[10px] ${isBackendUp ? "text-[#f4f4f5]" : "text-[#ef4444]"}`}>
              {isBackendUp ? "8080 OK" : "OFFLINE"}
            </span>
            <RefreshCw className={`w-2.5 h-2.5 text-[#71717a] ${isHealthChecking ? "animate-spin" : ""}`} />
          </button>

          {/* Blender Engine */}
          <div className="hidden lg:flex items-center space-x-1 px-2 py-0.5 bg-[#18181b] border border-[#3f3f46] rounded-sm text-[10px] font-mono text-[#a1a1aa]">
            <span className="text-[#71717a]">ENGINE:</span>
            <span className={isBlenderReady ? "text-[#f4f4f5]" : "text-[#eab308]"}>
              {isBlenderReady ? "Blender 5.2" : "Offline"}
            </span>
          </div>

          {/* Paste bpy Script Button */}
          {onOpenPasteBpy && (
            <button
              onClick={onOpenPasteBpy}
              title="Paste raw Blender Python (bpy) script"
              className="tool-btn space-x-1"
            >
              <Terminal className="w-3 h-3 text-[#ea580c]" />
              <span className="font-mono text-[10px] hidden sm:inline">PASTE BPY</span>
            </button>
          )}

          {/* Community Showcase Trigger */}
          {onOpenShowcase && (
            <button
              onClick={onOpenShowcase}
              title="Explore Community & Featured 3D Models"
              className="tool-btn space-x-1"
            >
              <Sparkles className="w-3 h-3 text-[#ea580c]" />
              <span className="font-mono text-[10px] hidden sm:inline">SHOWCASE</span>
            </button>
          )}

          {/* Share Model Button */}
          {onOpenShare && (
            <button
              onClick={onOpenShare}
              title="Share current 3D scene via permanent interactive link"
              className="tool-btn space-x-1 border-[#ea580c]/60 bg-[#ea580c]/10 hover:bg-[#ea580c]/20 text-[#f4f4f5]"
            >
              <Share2 className="w-3 h-3 text-[#ea580c]" />
              <span className="font-mono text-[10px] font-semibold text-[#ea580c]">↗ SHARE</span>
            </button>
          )}

          {/* Key Drawer Toggle */}
          <button
            onClick={() => setIsKeyDrawerOpen(!isKeyDrawerOpen)}
            className={`tool-btn space-x-1 ${token ? "" : "border-[#eab308] text-[#eab308]"}`}
          >
            <Key className="w-3 h-3 text-[#a1a1aa]" />
            <span className="font-mono text-[10px]">{token ? "KEY SET" : "NO KEY"}</span>
          </button>

          {/* Blender Shortcuts Modal Trigger */}
          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              title="Blender Shortcuts Cheat Sheet (F1 or ?)"
              className="tool-btn space-x-1 border-[#3f3f46] hover:border-[#ea580c] hover:text-[#f4f4f5] transition-colors"
            >
              <Keyboard className="w-3 h-3 text-[#ea580c]" />
              <span className="font-mono text-[10px] hidden sm:inline font-semibold">? SHORTCUTS</span>
            </button>
          )}

          {/* Right Inspector Toggle */}
          {onToggleRight && (
            <button
              onClick={onToggleRight}
              title={isRightOpen ? "Hide Inspector Panel" : "Show Inspector & Code"}
              className={`tool-btn p-1 ${isRightOpen ? "active" : ""}`}
            >
              {isRightOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Key Drawer Modal */}
      {isKeyDrawerOpen && (
        <div className="border-t border-[#3f3f46] bg-[#18181b] px-4 py-3 text-xs">
          <form onSubmit={handleSave} className="max-w-2xl mx-auto space-y-2">
            <div className="flex items-center justify-between text-[#a1a1aa]">
              <div className="flex items-center space-x-2">
                <Shield className="w-3.5 h-3.5 text-[#a1a1aa]" />
                <span className="font-semibold text-[#f4f4f5]">Google Gemini API Key</span>
                <span className="text-[#71717a] text-[11px]">— Free tier (gemini-2.5-flash)</span>
              </div>
              <div className="flex items-center space-x-3 text-[10px]">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#a1a1aa] hover:text-[#f4f4f5] underline flex items-center space-x-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Get Free Key</span>
                </a>
                <button
                  type="button"
                  onClick={handleSetDemoKey}
                  className="text-[#f4f4f5] hover:underline"
                >
                  Use Demo Mode
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="Paste your Google Gemini API Key (e.g. AIzaSy...)"
                  className="w-full bg-[#1f1f23] border border-[#3f3f46] focus:border-[#52525b] focus:outline-none px-2.5 py-1 text-xs text-[#f4f4f5] font-mono pr-8 rounded-sm"
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
                className="px-3 py-1 bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] border border-[#52525b] font-medium text-xs rounded-sm transition-colors"
              >
                SAVE
              </button>

              {token && (
                <button
                  type="button"
                  onClick={() => {
                    onClearToken();
                    setInputVal("");
                  }}
                  className="px-2.5 py-1 bg-[#18181b] border border-[#3f3f46] text-[#ef4444] hover:bg-[#27272a] rounded-sm text-xs"
                >
                  CLEAR
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsKeyDrawerOpen(false)}
                className="px-2.5 py-1 bg-[#18181b] border border-[#3f3f46] text-[#71717a] hover:text-[#f4f4f5] rounded-sm text-xs"
              >
                CLOSE
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
