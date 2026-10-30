import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        foreground: "#f4f4f5",
        terminal: {
          bg: "#09090b",
          panel: "#121215",
          border: "#27272a",
          hover: "#18181b",
          active: "#202024",
          text: "#f4f4f5",
          muted: "#71717a",
          faint: "#3f3f46",
          green: "#22c55e",
          greenGlow: "#4ade80",
          amber: "#f59e0b",
          red: "#ef4444",
          cyan: "#06b6d4",
        },
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
