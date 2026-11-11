import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { PWAProvider } from "@/components/pwa/pwa-provider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#7c3aed",
};

export const metadata: Metadata = {
  title: {
    default: "TR STUDIO — Imagine Anything. Create Everything.",
    template: "%s | TR STUDIO",
  },
  description:
    "Professional AI-powered animated story creation platform. From idea and screenplay to characters, scenes, 2D animation, and final video.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TR STUDIO",
  },
  other: {
    "color-scheme": "dark",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="color-scheme" content="dark" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={inter.className}>
        <PWAProvider>
          <AuthProvider>{children}</AuthProvider>
        </PWAProvider>
      </body>
    </html>
  );
}
