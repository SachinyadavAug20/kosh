"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeId =
  | "blender-dark"
  | "kosh-terminal"
  | "cyberpunk"
  | "nord"
  | "tokyo-night"
  | "dracula"
  | "blender-light";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  badge: string;
  viewportBg: number;
  gridMajor: number;
  gridMinor: number;
  accentHex: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  "blender-dark": {
    id: "blender-dark",
    name: "Blender Dark",
    badge: "BLENDER 5.x",
    viewportBg: 0x242424,
    gridMajor: 0x3d3d42,
    gridMinor: 0x2e2e33,
    accentHex: "#e68523",
  },
  "kosh-terminal": {
    id: "kosh-terminal",
    name: "Terminal Green",
    badge: "MONO",
    viewportBg: 0x09090b,
    gridMajor: 0x27272a,
    gridMinor: 0x18181b,
    accentHex: "#22c55e",
  },
  "cyberpunk": {
    id: "cyberpunk",
    name: "Cyberpunk Neon",
    badge: "NEON",
    viewportBg: 0x0c0d14,
    gridMajor: 0x2a1b42,
    gridMinor: 0x16182e,
    accentHex: "#f43f5e",
  },
  "nord": {
    id: "nord",
    name: "Nord Arctic",
    badge: "NORD",
    viewportBg: 0x242933,
    gridMajor: 0x434c5e,
    gridMinor: 0x2e3440,
    accentHex: "#88c0d0",
  },
  "tokyo-night": {
    id: "tokyo-night",
    name: "Tokyo Night",
    badge: "TOKYO",
    viewportBg: 0x16161e,
    gridMajor: 0x2f3549,
    gridMinor: 0x1f2335,
    accentHex: "#7aa2f7",
  },
  "dracula": {
    id: "dracula",
    name: "Dracula Studio",
    badge: "DRACULA",
    viewportBg: 0x21222c,
    gridMajor: 0x44475a,
    gridMinor: 0x282a36,
    accentHex: "#bd93f9",
  },
  "blender-light": {
    id: "blender-light",
    name: "Blender Daylight",
    badge: "LIGHT",
    viewportBg: 0xd8d8d8,
    gridMajor: 0xb5b5b5,
    gridMinor: 0xcccccc,
    accentHex: "#e68523",
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

  useEffect(() => {
    const saved = localStorage.getItem("kosh_theme") as ThemeId;
    if (saved && THEMES[saved]) {
      setThemeState(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      document.documentElement.setAttribute("data-theme", "blender-dark");
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
