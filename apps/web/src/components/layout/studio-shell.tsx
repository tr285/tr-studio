"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clapperboard,
  Film,
  FolderKanban,
  Globe,
  Headphones,
  LayoutDashboard,
  LogOut,
  Menu,
  PlaySquare,
  Settings,
  Sparkles,
  User as UserIcon,
  Users,
  Video,
  X,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "AI Story Studio",
    href: "/studio/new",
    icon: Sparkles,
  },
  {
    label: "Character Studio",
    href: "/characters",
    icon: Users,
  },
  {
    label: "World & Environments",
    href: "/environments",
    icon: Globe,
  },
  {
    label: "Story Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    label: "Studio Settings",
    href: "/settings",
    icon: Settings,
  },
];

const PIPELINE_MODULES = [
  { label: "AI Screenplay", href: "/studio/new", icon: Sparkles },
  { label: "Character Studio", href: "/characters", icon: Users },
  { label: "Environments & Worlds", href: "/environments", icon: Globe },
  { label: "Scene Builder & Board", href: "/projects", icon: Film },
  { label: "2D Animation Engine", href: "/projects", icon: PlaySquare },
  { label: "Voice & Audio Studio", href: "/projects", icon: Headphones },
  { label: "Video Render & Export", href: "/projects", icon: Video },
];

export function StudioShell({
  children,
  onCreateNewClick,
}: {
  children: React.ReactNode;
  onCreateNewClick?: () => void;
}) {
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-zinc-50/70 text-zinc-900 transition-colors dark:bg-[#0c0c0e] dark:text-zinc-100">
      {/* Sidebar Desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200/80 bg-white dark:border-zinc-800/80 dark:bg-[#111114] lg:flex">
        <div className="flex h-16 items-center justify-between border-b border-zinc-200/80 px-5 dark:border-zinc-800/80">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs transition-transform group-hover:scale-105">
              <Clapperboard className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-bold tracking-tight text-zinc-900 dark:text-white">
                TR STUDIO
              </span>
              <span className="block text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                STUDIO SUITE v1.0
              </span>
            </div>
          </Link>
        </div>

        <div className="p-4 pb-2">
          {onCreateNewClick ? (
            <Button
              type="button"
              onClick={onCreateNewClick}
              className="w-full justify-center gap-2 min-h-[40px] shadow-xs"
            >
              <Sparkles className="h-4 w-4" />
              <span>Create New Story</span>
            </Button>
          ) : (
            <Button asChild className="w-full justify-center gap-2 min-h-[40px] shadow-xs">
              <Link href="/studio/new">
                <Sparkles className="h-4 w-4" />
                <span>Create New Story</span>
              </Link>
            </Button>
          )}
        </div>

        <nav aria-label="Studio Primary" className="flex-1 space-y-6 px-3 py-4 overflow-y-auto">
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Workspace
            </p>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href === "/studio/new" && pathname.startsWith("/studio")) ||
                (item.href !== "/studio/new" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                    active
                      ? "bg-indigo-50 text-indigo-700 shadow-2xs font-semibold dark:bg-indigo-950/50 dark:text-indigo-300"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      active ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500"
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between px-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Production Pipeline
              </p>
              <Badge variant="success" className="text-[10px] px-1.5 py-0">
                Active
              </Badge>
            </div>
            <div className="space-y-1">
              {PIPELINE_MODULES.map((mod) => {
                const ModIcon = mod.icon;
                return (
                  <Link
                    key={mod.label}
                    href={mod.href}
                    className="flex items-center justify-between rounded-xl px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100 transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <ModIcon className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                      <span>{mod.label}</span>
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      Live
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* User Profile Area */}
        <div className="border-t border-zinc-200/80 p-4 dark:border-zinc-800/80">
          {isLoading ? (
            <div className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ) : user ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {user.username}
                  </p>
                  <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                    {user.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                aria-label="Sign out"
                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-rose-600 dark:hover:bg-zinc-800 dark:hover:text-rose-400"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <UserIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Guest Preview Mode</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild size="sm" variant="outline" className="w-full text-xs">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild size="sm" className="w-full text-xs">
                  <Link href="/register">Register</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-200/80 bg-white/80 px-4 backdrop-blur-md sm:px-8 dark:border-zinc-800/80 dark:bg-[#0c0c0e]/80">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="rounded-lg border border-zinc-200 p-2 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 lg:hidden"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                TR STUDIO <span className="mx-1 text-zinc-300 dark:text-zinc-700">/</span>{" "}
                <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
                  Creative Workspace
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle className="h-9 w-9" />
            <Badge variant="outline" className="hidden sm:inline-flex">
              Studio Suite Production
            </Badge>
            {user ? (
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-2xs transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{user.username}</span>
              </Link>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href="/login">Sign In</Link>
              </Button>
            )}
          </div>
        </header>

        {/* Mobile navigation drawer */}
        {mobileMenuOpen && (
          <div className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-[#111114] lg:hidden">
            <nav aria-label="Mobile Studio" className="space-y-1">
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
                Workspace
              </p>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
                      active
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-semibold"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 mt-2">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
                  Creative Pipeline
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PIPELINE_MODULES.map((mod) => {
                    const ModIcon = mod.icon;
                    return (
                      <Link
                        key={mod.label}
                        href={mod.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-2 text-xs text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800"
                      >
                        <ModIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span className="truncate">{mod.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </nav>
          </div>
        )}

        <main className="flex-1 px-4 py-8 sm:px-8 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
