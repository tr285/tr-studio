import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PWAProvider } from "@/components/pwa/pwa-provider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#6366f1",
};

export const metadata: Metadata = {
  title: {
    default: "TR STUDIO — Imagine Anything. Create Everything.",
    template: "%s | TR STUDIO",
  },
  description:
    "Professional AI-powered animated story and 2D animation studio. Create stories, design characters, build worlds, animate scenes, synthesize voice, and render cinematic films.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TR STUDIO",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <PWAProvider>
            <AuthProvider>{children}</AuthProvider>
          </PWAProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
