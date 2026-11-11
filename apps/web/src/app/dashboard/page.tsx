"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  Clock,
  Film,
  FolderKanban,
  Globe,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  Users,
  Edit3,
  Wand2,
} from "lucide-react";
import type { Project } from "@tr-studio/shared-types";
import { useAuth } from "@/components/providers/auth-provider";
import { StudioShell } from "@/components/layout/studio-shell";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { api } from "@/lib/api";
import { formatRelativeDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
      "Three-act action pilot set in a floatingsky fortress with dynamic camera cuts.",
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
      // Handled silently or refresh
    }
  };

  return (
    <StudioShell onCreateNewClick={() => openNewProjectModal()}>
      <div className="mx-auto max-w-6xl space-y-10">
        {/* Welcome Banner */}
        <section className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/50 via-zinc-900/90 to-[#09090d] p-6 sm:p-8 shadow-xl">
          <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="space-y-2">
              <Badge variant="default" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                TR STUDIO Director Workspace
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {user
                  ? `Welcome back, ${user.username}`
                  : "Welcome to TR STUDIO"}
              </h1>
              <p className="max-w-2xl text-sm text-zinc-300">
                {user
                  ? "Create a new animated story project or continue organizing your production slate."
                  : "Sign in to your director account to create and persist animated story projects in PostgreSQL."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {user ? (
                <>
                  <Button asChild size="lg">
                    <Link href="/studio/new">
                      <Sparkles className="h-4 w-4" />
                      Open AI Story Studio
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/characters">
                      <Users className="h-4 w-4" />
                      Character Studio
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/environments">
                      <Globe className="h-4 w-4" />
                      World & Environments
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => openNewProjectModal()}
                  >
                    <Plus className="h-4 w-4" />
                    Quick Project
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/projects">
                      <FolderKanban className="h-4 w-4" />
                      All Projects ({projects.length})
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href="/login">Sign In to Create Stories</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/register">Register Account</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Quick-Start Cards */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Quick-Start Story Blueprints
              </h2>
              <p className="text-xs text-zinc-400">
                Initialize a structured project record with a single click
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {QUICK_START_TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              return (
                <Card
                  key={tpl.title}
                  className="group border-zinc-800/90 bg-zinc-900/40 hover:border-violet-500/50 hover:bg-zinc-900/80"
                >
                  <CardHeader className="pb-3">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 transition-transform group-hover:scale-105">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{tpl.title}</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      {tpl.subtitle}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-between"
                      disabled={!user}
                      onClick={() =>
                        openNewProjectModal(tpl.defaultTitle, tpl.defaultDesc)
                      }
                    >
                      <span>{user ? "Use Blueprint" : "Sign in required"}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Recent Projects Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Recent Story Projects
              </h2>
              <p className="text-xs text-zinc-400">
                Projects owned by your authenticated studio account
              </p>
            </div>
            {projects.length > 0 && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/projects">
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          {authLoading || loadingProjects ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-44 animate-pulse rounded-xl border border-zinc-800/80 bg-zinc-900/40"
                />
              ))}
            </div>
          ) : !user ? (
            <Card className="border-dashed border-zinc-800 bg-zinc-900/30">
              <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400">
                  <Clapperboard className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">
                  Sign in to view your Story Vault
                </h3>
                <p className="mt-1 max-w-md text-xs text-zinc-400">
                  Every project in TR STUDIO is securely scoped to its owner in
                  PostgreSQL. Sign in or register to create your first story.
                </p>
                <div className="mt-6 flex gap-3">
                  <Button asChild>
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/register">Create Account</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : projects.length === 0 ? (
            /* Empty-state illustration placeholder */
            <Card className="border-dashed border-zinc-800 bg-zinc-900/30">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-500/20 to-purple-500/5 text-violet-300 shadow-inner">
                  <Wand2 className="h-9 w-9" />
                </div>
                <h3 className="mt-5 text-base font-semibold text-white">
                  No animated stories in your vault yet
                </h3>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-zinc-400">
                  Start with a blank project or choose one of the Quick-Start
                  Blueprints above to initialize your first story in TR STUDIO.
                </p>
                <Button
                  type="button"
                  className="mt-6"
                  onClick={() => openNewProjectModal()}
                >
                  <Plus className="h-4 w-4" />
                  Create Your First Story
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.slice(0, 6).map((project) => (
                <Card
                  key={project.id}
                  className="flex flex-col justify-between border-zinc-800/90 bg-zinc-900/50 hover:border-violet-500/40"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={getStatusBadgeVariant(project.status)}>
                        {project.status.replace("_", " ")}
                      </Badge>
                      <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                        <Clock className="h-3 w-3" />
                        {formatRelativeDate(project.updated_at)}
                      </span>
                    </div>
                    <CardTitle className="mt-3 line-clamp-1 text-base">
                      {project.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 min-h-[2.5rem] text-xs">
                      {project.description || "No synopsis added yet."}
                    </CardDescription>
                  </CardHeader>

                  <CardFooter className="flex items-center justify-between border-t border-zinc-800/70 pt-4">
                    <div className="flex items-center gap-1.5">
                      <Button asChild size="sm">
                        <Link href={`/studio/${project.id}`}>
                          <Sparkles className="h-3.5 w-3.5" />
                          Story Studio
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingProject(project);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProject(project.id)}
                      className="text-zinc-400 hover:text-red-400"
                      aria-label={`Delete project ${project.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardFooter>
                </Card>
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
