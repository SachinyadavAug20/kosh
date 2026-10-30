"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeId =
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
  textPrimary: string;
  textMuted: string;
  viewportBg: number;
  gridMajor: number;
  gridMinor: number;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  "titanium-slate": {
    id: "titanium-slate",
    name: "Titanium Slate",
    badge: "DEFAULT",
    bgCanvas: "#141416",
    bgPanel: "#202024",
    borderColor: "#333338",
    accentAction: "#ea580c",
    textPrimary: "#f4f4f5",
    textMuted: "#71717a",
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
    textPrimary: "#f4f4f5",
    textMuted: "#9ca3af",
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
    textPrimary: "#f8fafc",
    textMuted: "#94a3b8",
    viewportBg: 0x1e222b,
    gridMajor: 0x4a5568,
    gridMinor: 0x2d3748,
  },
  "industrial-blueprint": {
    id: "industrial-blueprint",
    name: "Industrial Blueprint / Monolith",
    badge: "MONOLITH",
    bgCanvas: "#111113",
    bgPanel: "#1c1c1f",
    borderColor: "#2e2e33",
    accentAction: "#d97706",
    textPrimary: "#f4f4f5",
    textMuted: "#71717a",
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
  theme: "titanium-slate",
  config: THEMES["titanium-slate"],
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("titanium-slate");

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
    root.style.setProperty("--text-primary", cfg.textPrimary);
    root.style.setProperty("--foreground", cfg.textPrimary);
    root.style.setProperty("--text-muted", cfg.textMuted);
    root.setAttribute("data-theme", cfg.id);
  };

  useEffect(() => {
    const saved = localStorage.getItem("kosh_theme") as ThemeId;
    if (saved && THEMES[saved]) {
      setThemeState(saved);
      applyThemeVariables(THEMES[saved]);
    } else {
      setThemeState("titanium-slate");
      applyThemeVariables(THEMES["titanium-slate"]);
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
        config: THEMES[theme] || THEMES["titanium-slate"],
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
