import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kosh.studio";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#141416" },
    { media: "(prefers-color-scheme: light)", color: "#141416" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "KOSH // Minimalist Creative MCP 3D Studio & Blender Hub",
    template: "%s | KOSH",
  },
  description:
    "Terminal-first 3D digital creation workstation and Model Context Protocol (MCP) hub powered by headless Blender 5.2. Real-time parametric CAD, digital sculpting, procedural animation, shader nodes, and community model sharing.",
  applicationName: "KOSH Studio",
  authors: [{ name: "Kosh Kinetic Lab", url: siteUrl }],
  creator: "Kosh Studio",
  publisher: "Kosh Studio",
  keywords: [
    "Kosh",
    "Model Context Protocol",
    "MCP Server",
    "Blender 5.2",
    "3D Modeling",
    "Headless Blender",
    "Three.js",
    "Parametric CAD",
    "Generative 3D",
    "Procedural Animation",
    "Digital Sculpting",
    "Dope Sheet",
    "JSON-RPC",
    "Next.js",
    "Spring Boot",
  ],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "KOSH // Creative MCP 3D Studio",
    title: "KOSH // Minimalist Creative MCP 3D Studio & Blender Hub",
    description:
      "Terminal-first 3D digital creation workstation and Model Context Protocol (MCP) hub powered by headless Blender 5.2.",
    images: [
      {
        url: "/logo.svg",
        width: 680,
        height: 160,
        alt: "Kosh Creative MCP 3D Studio Banner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KOSH // Minimalist Creative MCP 3D Studio & Blender Hub",
    description:
      "Terminal-first 3D digital creation workstation and Model Context Protocol (MCP) hub powered by headless Blender 5.2.",
    images: ["/logo.svg"],
    creator: "@kosh_studio",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className="min-h-screen bg-[#18181b] text-[#f4f4f5] font-sans antialiased selection:bg-[#ea580c] selection:text-white">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
