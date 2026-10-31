"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeId =
  | "blender-dark"
  | "deep-titanium"
  | "minimal-charcoal"
  | "titanium-slate"
  | "blender-classic"
  | "nordic-cad"
  | "industrial-blueprint";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  badge: string;
  bgCanvas: string;
  bgPanel: string;
  borderColor: string;
  accentAction: string;
  selectionGlow: string;
  textPrimary: string;
  textMuted: string;
  textDisabled: string;
  viewportBg: number;
  gridMajor: number;
  gridMinor: number;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  "blender-dark": {
    id: "blender-dark",
    name: "Blender Dark",
    badge: "DEFAULT",
    bgCanvas: "#141416",
    bgPanel: "#18181b",
    borderColor: "#27272a",
    accentAction: "#ea580c",
    selectionGlow: "rgba(234, 88, 12, 0.45)",
    textPrimary: "#f4f4f5",
    textMuted: "#a1a1aa",
    textDisabled: "#52525b",
    viewportBg: 0x141416,
    gridMajor: 0x3f3f46,
    gridMinor: 0x27272a,
  },
  "deep-titanium": {
    id: "deep-titanium",
    name: "Deep Titanium / Obsidian",
    badge: "OBSIDIAN",
    bgCanvas: "#0f0f11",
    bgPanel: "#1c1d22",
    borderColor: "#272930",
    accentAction: "#0284c7",
    selectionGlow: "rgba(2, 132, 199, 0.45)",
    textPrimary: "#f8fafc",
    textMuted: "#94a3b8",
    textDisabled: "#475569",
    viewportBg: 0x0f0f11,
    gridMajor: 0x334155,
    gridMinor: 0x1e293b,
  },
  "minimal-charcoal": {
    id: "minimal-charcoal",
    name: "Minimal Charcoal",
    badge: "MONOCHROME",
    bgCanvas: "#121212",
    bgPanel: "#1a1a1a",
    borderColor: "#2a2a2a",
    accentAction: "#ffffff",
    selectionGlow: "rgba(255, 255, 255, 0.45)",
    textPrimary: "#ffffff",
    textMuted: "#a3a3a3",
    textDisabled: "#525252",
    viewportBg: 0x121212,
    gridMajor: 0x404040,
    gridMinor: 0x262626,
  },
  // Backwards-compatible aliases
  "titanium-slate": {
    id: "titanium-slate",
    name: "Titanium Slate",
    badge: "SLATE",
    bgCanvas: "#141416",
    bgPanel: "#202024",
    borderColor: "#333338",
    accentAction: "#ea580c",
    selectionGlow: "rgba(234, 88, 12, 0.45)",
    textPrimary: "#f4f4f5",
    textMuted: "#71717a",
    textDisabled: "#3f3f46",
    viewportBg: 0x141416,
    gridMajor: 0x3f3f46,
    gridMinor: 0x27272a,
  },
  "blender-classic": {
    id: "blender-classic",
    name: "Blender Classic Dark",
    badge: "BLENDER DCC",
    bgCanvas: "#282828",
    bgPanel: "#303030",
    borderColor: "#3d3d3d",
    accentAction: "#4772b3",
    selectionGlow: "rgba(71, 114, 179, 0.45)",
    textPrimary: "#f4f4f5",
    textMuted: "#9ca3af",
    textDisabled: "#4b5563",
    viewportBg: 0x282828,
    gridMajor: 0x444444,
    gridMinor: 0x333333,
  },
  "nordic-cad": {
    id: "nordic-cad",
    name: "Nordic CAD (Graphite Frost)",
    badge: "GRAPHITE",
    bgCanvas: "#1e222b",
    bgPanel: "#252a34",
    borderColor: "#384050",
    accentAction: "#e2e8f0",
    selectionGlow: "rgba(226, 232, 240, 0.45)",
    textPrimary: "#f8fafc",
    textMuted: "#94a3b8",
    textDisabled: "#475569",
    viewportBg: 0x1e222b,
    gridMajor: 0x4a5568,
    gridMinor: 0x2d3748,
  },
  "industrial-blueprint": {
    id: "industrial-blueprint",
    name: "Industrial Blueprint",
    badge: "MONOLITH",
    bgCanvas: "#111113",
    bgPanel: "#1c1c1f",
    borderColor: "#2e2e33",
    accentAction: "#d97706",
    selectionGlow: "rgba(217, 119, 6, 0.45)",
    textPrimary: "#f4f4f5",
    textMuted: "#71717a",
    textDisabled: "#3f3f46",
    viewportBg: 0x111113,
    gridMajor: 0x383838,
    gridMinor: 0x222222,
  },
};

interface ThemeContextType {
  theme: ThemeId;
  config: ThemeConfig;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "blender-dark",
  config: THEMES["blender-dark"],
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("blender-dark");

  const applyThemeVariables = (cfg: ThemeConfig) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--bg-canvas", cfg.bgCanvas);
    root.style.setProperty("--background", cfg.bgCanvas);
    root.style.setProperty("--bg-panel", cfg.bgPanel);
    root.style.setProperty("--border-color", cfg.borderColor);
    root.style.setProperty("--border", cfg.borderColor);
    root.style.setProperty("--accent-action", cfg.accentAction);
    root.style.setProperty("--accent", cfg.accentAction);
    root.style.setProperty("--selection-glow", cfg.selectionGlow);
    root.style.setProperty("--text-primary", cfg.textPrimary);
    root.style.setProperty("--foreground", cfg.textPrimary);
    root.style.setProperty("--text-muted", cfg.textMuted);
    root.style.setProperty("--text-disabled", cfg.textDisabled);
    root.setAttribute("data-theme", cfg.id);
  };

  useEffect(() => {
    const saved = localStorage.getItem("kosh_theme") as ThemeId;
    if (saved && THEMES[saved]) {
      setThemeState(saved);
      applyThemeVariables(THEMES[saved]);
    } else {
      setThemeState("blender-dark");
      applyThemeVariables(THEMES["blender-dark"]);
    }
  }, []);

  const setTheme = (newTheme: ThemeId) => {
    if (!THEMES[newTheme]) return;
    setThemeState(newTheme);
    localStorage.setItem("kosh_theme", newTheme);
    applyThemeVariables(THEMES[newTheme]);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        config: THEMES[theme] || THEMES["blender-dark"],
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
