"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

interface PWAContextType {
  isOnline: boolean;
  isInstallable: boolean;
}

const PWAContext = createContext<PWAContextType>({
  isOnline: true,
  isInstallable: false,
});

export function usePWA(): PWAContextType {
  return useContext(PWAContext);
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    // 1. Initial connectivity check
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);

      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // 2. Register Service Worker in production / supported environments
      if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            // Service worker registered
            registration.update().catch(() => {});
          })
          .catch(() => {
            // SW registration failed (e.g. unsupported origin)
          });
      }

      // 3. Beforeinstallprompt event listener
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setIsInstallable(true);
      };
      window.addEventListener("beforeinstallprompt", handleBeforeInstall);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }
  }, []);

  return (
    <PWAContext.Provider value={{ isOnline, isInstallable }}>
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500/95 px-4 py-2 text-xs font-semibold text-zinc-950 shadow-md backdrop-blur-md"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            You are currently offline. Cached views remain accessible, but AI screenplay generation, speech synthesis, and video rendering require cloud connectivity.
          </span>
        </div>
      )}
      {children}
    </PWAContext.Provider>
  );
}
