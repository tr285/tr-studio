"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  Clock,
  Compass,
  Edit3,
  Film,
  FolderKanban,
  Globe,
  Headphones,
  LayoutGrid,
  Layers,
  List,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  Video,
  Wand2,
} from "lucide-react";
import type { Project } from "@tr-studio/shared-types";
import { useAuth } from "@/components/providers/auth-provider";
import { StudioShell } from "@/components/layout/studio-shell";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { api } from "@/lib/api";
import { formatRelativeDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const QUICK_START_TEMPLATES = [
  {
    title: "Shonen Action Episode",
    subtitle: "High-energy 3-act battle & rival confrontation template",
    defaultTitle: "Crimson Blade — Episode 01",
    defaultDesc:
      "Three-act action pilot set in a floating sky fortress with dynamic camera cuts.",
    icon: Sparkles,
  },
  {
    title: "Sci-Fi Cyberpunk Short",
    subtitle: "Atmospheric neon mystery & character dialogue focus",
    defaultTitle: "Neo-Kyoto Rain — Short Film",
    defaultDesc:
      "A lone android detective investigates a memory anomaly in Sector 9.",
    icon: Film,
  },
  {
    title: "Fantasy World Lore Intro",
    subtitle: "Narrated prologue with sweeping environment pans",
    defaultTitle: "Echoes of the Astral Spire",
    defaultDesc:
      "Narrated opening sequence introducing the five elemental kingdoms.",
    icon: Layers,
  },
];

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "completed":
      return "success";
    case "in_progress":
      return "default";
    case "archived":
      return "secondary";
    default:
      return "warning";
  }
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [prefillTitle, setPrefillTitle] = useState("");
  const [prefillDesc, setPrefillDesc] = useState("");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoadingProjects(false);
      return;
    }
    setLoadingProjects(true);
    try {
      const list = await api.projects.list();
      setProjects(list);
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      void fetchProjects();
    }
  }, [authLoading, fetchProjects]);

  const openNewProjectModal = (title = "", desc = "") => {
    setEditingProject(null);
    setPrefillTitle(title);
    setPrefillDesc(desc);
    setDialogOpen(true);
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await api.projects.delete(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // Handled silently
    }
  };

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || p.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  return (
    <StudioShell onCreateNewClick={() => openNewProjectModal()}>
      <div className="space-y-10">
        {/* 1. Welcome Header (Linearity Style Banner) */}
        <section className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-6 sm:p-8 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/60">
          <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Creative Studio Director</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                {user ? `Welcome back, ${user.username}` : "Welcome to TR STUDIO"}
              </h1>
              <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                {user
                  ? "Manage your animated productions, design characters, and build cinematic universes."
                  : "Sign in to create, edit and render your animated stories securely in PostgreSQL."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {user ? (
                <>
                  <Button size="default" asChild className="gap-2 shadow-xs">
                    <Link href="/studio/new">
                      <Sparkles className="h-4 w-4" />
                      <span>New AI Story</span>
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={() => openNewProjectModal()}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4 text-zinc-500" />
                    <span>Quick Project</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="default">
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button asChild variant="outline" size="default">
                    <Link href="/register">Register</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* 2. Quick Access Studio Hub */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/characters"
            className="linearity-card group flex items-start gap-4 transition-all hover:scale-[1.01]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200/60 text-indigo-600 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-sm text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                <span>Character Studio</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                Turnarounds, facial expressions, outfits and relational bonds.
              </p>
            </div>
          </Link>

          <Link
            href="/environments"
            className="linearity-card group flex items-start gap-4 transition-all hover:scale-[1.01]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 border border-purple-200/60 text-purple-600 dark:bg-purple-950/60 dark:border-purple-800 dark:text-purple-300">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-sm text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                <span>World & Environments</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                Multi-layer parallax worlds, lighting states and atmospheric sets.
              </p>
            </div>
          </Link>

          <Link
            href="/projects"
            className="linearity-card group flex items-start gap-4 transition-all hover:scale-[1.01]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-600 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-sm text-zinc-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                <span>Storyboards & Projects</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                Scene compositions, shot lists, camera staging and MP4 exports.
              </p>
            </div>
          </Link>
        </section>

        {/* 3. Quick-Start Story Blueprints */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                Quick-Start Story Blueprints
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Initialize structured story parameters with a single click
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {QUICK_START_TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              return (
                <div key={tpl.title} className="linearity-card flex flex-col justify-between">
                  <div>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200/60 text-indigo-600 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      {tpl.title}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {tpl.subtitle}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-between text-xs"
                      disabled={!user}
                      onClick={() =>
                        openNewProjectModal(tpl.defaultTitle, tpl.defaultDesc)
                      }
                    >
                      <span>{user ? "Use Blueprint" : "Sign in required"}</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. Recent Story Projects Section (With Search & Filter & View Toggle) */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                Recent Story Projects
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {projects.length} {projects.length === 1 ? "project" : "projects"} in your authenticated production vault
              </p>
            </div>

            {/* Controls: Search, Filter, ViewMode */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-44 sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {/* Status filter */}
              <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                {["all", "in_progress", "completed"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                      statusFilter === st
                        ? "bg-indigo-600 text-white font-semibold shadow-2xs"
                        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    {st === "all" ? "All" : st.replace("_", " ")}
                  </button>
                ))}
              </div>

              {/* View mode toggle */}
              <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  className={`rounded-md p-1 ${
                    viewMode === "grid"
                      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-400"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  className={`rounded-md p-1 ${
                    viewMode === "list"
                      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-400"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {authLoading || loadingProjects ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-44 animate-pulse rounded-xl border border-zinc-200/80 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/40"
                />
              ))}
            </div>
          ) : !user ? (
            <Card className="border-dashed border-zinc-300 dark:border-zinc-800">
              <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <Clapperboard className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-zinc-900 dark:text-white">
                  Sign in to view your Story Vault
                </h3>
                <p className="mt-1 max-w-md text-xs text-zinc-500 dark:text-zinc-400">
                  Projects in TR STUDIO are securely scoped to your director account. Sign in to view and persist your productions.
                </p>
                <div className="mt-5 flex gap-2.5">
                  <Button asChild size="sm">
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/register">Create Account</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : filteredProjects.length === 0 ? (
            /* Empty state */
            <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center bg-white dark:bg-zinc-900/30">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-200/60 text-indigo-600 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300">
                <Wand2 className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-white">
                {searchQuery ? "No matching projects found" : "No animated stories in your vault yet"}
              </h3>
              <p className="mt-1.5 max-w-md mx-auto text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {searchQuery
                  ? `No project titles or descriptions match "${searchQuery}". Try adjusting your filters.`
                  : "Start with a new AI story, or initialize a quick blueprint project to begin creating."}
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button size="sm" asChild>
                  <Link href="/studio/new" className="gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Create with AI</span>
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openNewProjectModal()}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5 text-zinc-500" />
                  <span>Manual Project</span>
                </Button>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid View */
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="linearity-card flex flex-col justify-between group"
                >
                  <div>
                    {/* Visual Card Header Thumbnail Placeholder */}
                    <div className="h-24 w-full rounded-lg bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-center mb-3 relative overflow-hidden">
                      <Clapperboard className="h-8 w-8 text-indigo-400/50" />
                      <div className="absolute top-2 right-2">
                        <Badge variant={getStatusBadgeVariant(project.status)}>
                          {project.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 mb-1 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeDate(project.updated_at)}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {project.title}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 min-h-[2rem]">
                      {project.description || "No synopsis recorded."}
                    </p>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                    <Button asChild size="sm" className="h-8 text-xs gap-1.5">
                      <Link href={`/studio/${project.id}`}>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Open Studio</span>
                      </Link>
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        onClick={() => {
                          setEditingProject(project);
                          setDialogOpen(true);
                        }}
                        aria-label="Edit project metadata"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProject(project.id)}
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400"
                        aria-label={`Delete project ${project.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List View */
            <div className="rounded-xl border border-zinc-200/80 bg-white overflow-hidden divide-y divide-zinc-100 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/60 dark:divide-zinc-800">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                        {project.title}
                      </span>
                      <Badge variant={getStatusBadgeVariant(project.status)}>
                        {project.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {project.description || "No synopsis recorded."}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-[11px] text-zinc-400 font-mono hidden md:inline">
                      {formatRelativeDate(project.updated_at)}
                    </span>
                    <Button asChild size="sm" className="h-8 text-xs gap-1.5">
                      <Link href={`/studio/${project.id}`}>
                        <Sparkles className="h-3 w-3" />
                        <span>Studio</span>
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                      onClick={() => {
                        setEditingProject(project);
                        setDialogOpen(true);
                      }}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProject(project.id)}
                      className="h-8 w-8 p-0 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editingProject={editingProject}
        initialTitle={prefillTitle}
        initialDescription={prefillDesc}
        onSuccess={() => {
          void fetchProjects();
        }}
      />
    </StudioShell>
  );
}
