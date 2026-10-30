"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeId =
  | "phosphor-hacker"
  | "blueprint-cyan"
  | "amber-monolith"
  | "blender-dark";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  badge: string;
  role: string;
  viewportBg: number;
  gridMajor: number;
  gridMinor: number;
  accentHex: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  "phosphor-hacker": {
    id: "phosphor-hacker",
    name: "Phosphor Hacker",
    badge: "CRT GREEN",
    role: "Classic CRT Terminal",
    viewportBg: 0x050507,
    gridMajor: 0x27272a,
    gridMinor: 0x18181b,
    accentHex: "#22c55e",
  },
  "blueprint-cyan": {
    id: "blueprint-cyan",
    name: "Monochromatic Blueprint",
    badge: "CAD BLUE",
    role: "Clean Engineering Tool",
    viewportBg: 0x060709,
    gridMajor: 0x1e242c,
    gridMinor: 0x12161c,
    accentHex: "#06b6d4",
  },
  "amber-monolith": {
    id: "amber-monolith",
    name: "Amber Monolith",
    badge: "AMBER CRT",
    role: "Industrial CRT",
    viewportBg: 0x070605,
    gridMajor: 0x292524,
    gridMinor: 0x1c1917,
    accentHex: "#f59e0b",
  },
  "blender-dark": {
    id: "blender-dark",
    name: "Blender Studio Dark",
    badge: "BLENDER 5.x",
    role: "Studio DCC Interface",
    viewportBg: 0x202020,
    gridMajor: 0x3d3d42,
    gridMinor: 0x2e2e33,
    accentHex: "#e68523",
  },
};

interface ThemeContextType {
  theme: ThemeId;
  config: ThemeConfig;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "phosphor-hacker",
  config: THEMES["phosphor-hacker"],
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("phosphor-hacker");

  useEffect(() => {
    const saved = localStorage.getItem("kosh_theme") as ThemeId;
    if (saved && THEMES[saved]) {
      setThemeState(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      document.documentElement.setAttribute("data-theme", "phosphor-hacker");
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
