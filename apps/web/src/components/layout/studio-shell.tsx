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
    <div className="flex min-h-screen bg-[#07070a] text-zinc-100">
      {/* Sidebar Desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800/80 bg-[#0b0b10] lg:flex">
        <div className="flex h-16 items-center justify-between border-b border-zinc-800/80 px-5">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-md shadow-violet-950/60">
              <Clapperboard className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-bold tracking-wider text-white">
                TR STUDIO
              </span>
              <span className="block text-[10px] font-medium text-violet-400">
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
              className="w-full justify-center gap-2 min-h-[44px]"
            >
              <Sparkles className="h-4 w-4" />
              Create New Story
            </Button>
          ) : (
            <Button asChild className="w-full justify-center gap-2 min-h-[44px]">
              <Link href="/studio/new">
                <Sparkles className="h-4 w-4" />
                Create New Story
              </Link>
            </Button>
          )}
        </div>

        <nav aria-label="Studio Primary" className="flex-1 space-y-6 px-3 py-4 overflow-y-auto">
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
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
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 min-h-[44px] text-sm font-medium transition-all",
                    active
                      ? "bg-gradient-to-r from-violet-600/20 to-purple-600/10 text-white border border-violet-500/30 shadow-sm"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      active ? "text-violet-400" : "text-zinc-400"
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between px-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Production Pipeline
              </p>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                All Active
              </Badge>
            </div>
            <div className="space-y-1">
              {PIPELINE_MODULES.map((mod) => {
                const ModIcon = mod.icon;
                return (
                  <Link
                    key={mod.label}
                    href={mod.href}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-xs text-zinc-300 hover:bg-violet-500/10 transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <ModIcon className="h-3.5 w-3.5 text-violet-400" />
                      {mod.label}
                    </span>
                    <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-300 border border-violet-500/30">
                      Active
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* User Profile Area */}
        <div className="border-t border-zinc-800/80 p-4">
          {isLoading ? (
            <div className="h-12 animate-pulse rounded-xl bg-zinc-900" />
          ) : user ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-sm font-bold text-violet-300 border border-violet-500/30">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">
                    {user.username}
                  </p>
                  <p className="truncate text-[11px] text-zinc-400">
                    {user.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                aria-label="Sign out"
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <UserIcon className="h-3.5 w-3.5 text-violet-400" />
                <span>Guest Preview Mode</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild size="sm" className="w-full">
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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-800/80 bg-[#07070a]/90 px-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="rounded-lg border border-zinc-800 p-2 text-zinc-300 lg:hidden"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-zinc-400">
                TR STUDIO <span className="mx-1.5 text-zinc-600">/</span>{" "}
                <span className="text-zinc-200">
                  Imagine Anything. Create Everything.
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:inline-flex border-violet-500/40 text-violet-300 bg-violet-600/20">
              Studio Suite v1.0 Production
            </Badge>
            {user ? (
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-violet-500/40 min-h-[44px]"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {user.username}
              </Link>
            ) : (
              <Button asChild size="sm" variant="outline" className="min-h-[44px]">
                <Link href="/login">Sign In</Link>
              </Button>
            )}
          </div>
        </header>

        {/* Mobile navigation drawer */}
        {mobileMenuOpen && (
          <div className="border-b border-zinc-800 bg-[#0b0b10] px-4 py-4 lg:hidden">
            <nav aria-label="Mobile Studio" className="space-y-1">
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
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
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 min-h-[44px] text-sm font-medium",
                      active
                        ? "bg-violet-600/20 text-white border border-violet-500/30"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4 text-violet-400" />
                    {item.label}
                  </Link>
                );
              })}

              <div className="pt-2 border-t border-zinc-800/60 mt-2">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
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
                        className="flex items-center gap-2 rounded-lg bg-zinc-900/60 px-2.5 py-2 min-h-[44px] text-xs text-zinc-300 hover:bg-violet-600/10 hover:text-white border border-zinc-800/80"
                      >
                        <ModIcon className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                        <span className="truncate">{mod.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </nav>
          </div>
        )}

        <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
