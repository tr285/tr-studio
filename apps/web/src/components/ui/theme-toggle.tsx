"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={className}
      aria-label={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
    >
      {resolvedTheme === "light" ? (
        <Moon className="h-4 w-4 text-zinc-600 hover:text-zinc-900 transition-colors" />
      ) : (
        <Sun className="h-4 w-4 text-zinc-300 hover:text-white transition-colors" />
      )}
    </Button>
  );
}
