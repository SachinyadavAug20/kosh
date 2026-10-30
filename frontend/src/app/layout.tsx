import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KOSH // Minimalist Creative MCP Hub",
  description: "Terminal-first developer studio and Model Context Protocol hub for headless Blender 3D generation.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark bg-[#09090b] text-[#f4f4f5]">
      <body className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-mono antialiased selection:bg-[#22c55e] selection:text-[#09090b]">
        {children}
      </body>
    </html>
  );
}
