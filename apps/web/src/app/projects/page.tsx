"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Edit3,
  FolderKanban,
  Plus,
  Search,
  Sparkles,
  Trash2,
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

const FILTER_TABS = [
  { value: "all", label: "All Stories" },
  { value: "draft", label: "Drafts" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
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

export default function ProjectsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const loadProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.projects.list({
        status: statusFilter,
        search: searchQuery,
      });
      setProjects(data);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter, searchQuery]);

  useEffect(() => {
    if (!authLoading) {
      void loadProjects();
    }
  }, [authLoading, loadProjects]);

  const handleDelete = async (project: Project) => {
    try {
      await api.projects.delete(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch {
      // Ignore or refresh
    }
  };

  return (
    <StudioShell
      onCreateNewClick={() => {
        setEditingProject(null);
        setDialogOpen(true);
      }}
    >
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Story Projects</h1>
            <p className="text-sm text-zinc-400">
              Manage, filter, and organize your animated story productions
            </p>
          </div>

          {user && (
            <div className="flex items-center gap-2.5">
              <Button asChild>
                <Link href="/studio/new">
                  <Sparkles className="h-4 w-4" />
                  Open AI Story Studio
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingProject(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Quick Project
              </Button>
            </div>
          )}
        </div>

        {/* Search and Filter Bar */}
        {user && (
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter projects by status">
              {FILTER_TABS.map((tab) => {
                const active = statusFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStatusFilter(tab.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-violet-600 text-white shadow-sm"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <search className="w-full sm:w-72">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void loadProjects();
                }}
                className="relative"
              >
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  type="search"
                  name="search"
                  aria-label="Search story projects by title"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  placeholder="Search stories by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 min-h-9 pl-9 text-sm"
                />
              </form>
            </search>
          </div>
        )}

        {/* Project List */}
        {authLoading || loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
              />
            ))}
          </div>
        ) : !user ? (
          <Card className="border-dashed border-zinc-800 bg-zinc-900/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FolderKanban className="h-10 w-10 text-violet-400" />
              <h2 className="mt-4 text-base font-semibold text-white">
                Authentication Required
              </h2>
              <p className="mt-1 max-w-md text-xs text-zinc-400">
                Sign in to view and manage your private TR STUDIO projects.
              </p>
              <div className="mt-6 flex gap-3">
                <Button asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/register">Register</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : projects.length === 0 ? (
          <Card className="border-dashed border-zinc-800 bg-zinc-900/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FolderKanban className="h-10 w-10 text-violet-400" />
              <h2 className="mt-4 text-base font-semibold text-white">
                No matching story projects found
              </h2>
              <p className="mt-1 max-w-md text-xs text-zinc-400">
                {searchQuery || statusFilter !== "all"
                  ? "Try clearing your search or status filter."
                  : "Create your first animated story project to get started."}
              </p>
              <Button
                type="button"
                className="mt-6"
                onClick={() => {
                  setEditingProject(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Create Story Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
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
                  <CardDescription className="line-clamp-3 min-h-[3.5rem] text-xs leading-relaxed">
                    {project.description || "No synopsis provided."}
                  </CardDescription>
                </CardHeader>

                <CardFooter className="flex items-center justify-between border-t border-zinc-800/80 pt-4">
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm">
                      <Link href={`/studio/${project.id}`}>
                        <Sparkles className="h-3.5 w-3.5" />
                        Story Studio
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingProject(project);
                        setDialogOpen(true);
                      }}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Metadata
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(project)}
                    className="text-zinc-400 hover:text-red-400"
                    aria-label={`Delete ${project.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editingProject={editingProject}
        onSuccess={() => {
          void loadProjects();
        }}
      />
    </StudioShell>
  );
}
