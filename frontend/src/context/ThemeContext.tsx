"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeId = "cad-dark" | "blender-studio" | "titanium-slate" | "cad-light";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  badge: string;
  viewportBg: number;
  gridMajor: number;
  gridMinor: number;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  "cad-dark": {
    id: "cad-dark",
    name: "CAD Dark (Zinc)",
    badge: "WORKSTATION",
    viewportBg: 0x141416,
    gridMajor: 0x3f3f46,
    gridMinor: 0x27272a,
  },
  "blender-studio": {
    id: "blender-studio",
    name: "Blender Studio",
    badge: "BLENDER 5.x",
    viewportBg: 0x1e1e20,
    gridMajor: 0x383838,
    gridMinor: 0x282828,
  },
  "titanium-slate": {
    id: "titanium-slate",
    name: "Titanium Slate",
    badge: "ENGINEERING",
    viewportBg: 0x0f1117,
    gridMajor: 0x2d3748,
    gridMinor: 0x1a202c,
  },
  "cad-light": {
    id: "cad-light",
    name: "Precision Light",
    badge: "DAYLIGHT",
    viewportBg: 0xe5e7eb,
    gridMajor: 0x9ca3af,
    gridMinor: 0xd1d5db,
  },
};

interface ThemeContextType {
  theme: ThemeId;
  config: ThemeConfig;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "cad-dark",
  config: THEMES["cad-dark"],
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("cad-dark");

  useEffect(() => {
    const saved = localStorage.getItem("kosh_theme") as ThemeId;
    if (saved && THEMES[saved]) {
      setThemeState(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      document.documentElement.setAttribute("data-theme", "cad-dark");
    }
  }, []);

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
    localStorage.setItem("kosh_theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        config: THEMES[theme],
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
