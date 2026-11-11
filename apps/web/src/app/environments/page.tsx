"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CloudRain,
  Copy,
  FolderTree,
  Globe,
  Layers,
  Loader2,
  Palette,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  ANIMATION_STYLES,
  ENVIRONMENT_CATEGORIES,
} from "@tr-studio/scene-schema";
import type {
  EnvironmentSummaryRecord,
  ImageProviderStatusResponse,
  Project,
  WorldLocationRecord,
  WorldRecord,
} from "@tr-studio/shared-types";
import { useAuth } from "@/components/providers/auth-provider";
import { StudioShell } from "@/components/layout/studio-shell";
import { api, resolveMediaUrl } from "@/lib/api";
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

export default function EnvironmentLibraryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [environments, setEnvironments] = useState<EnvironmentSummaryRecord[]>(
    []
  );
  const [worlds, setWorlds] = useState<WorldRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [providerStatus, setProviderStatus] =
    useState<ImageProviderStatusResponse | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("updated_desc");

  const [newWorldName, setNewWorldName] = useState("");
  const [newWorldDescription, setNewWorldDescription] = useState("");
  const [isCreatingWorld, setIsCreatingWorld] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLibrary = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [envList, worldList, projList, statusRes] = await Promise.all([
        api.environments.list({
          project_id: selectedProjectId || undefined,
          category: selectedCategory || undefined,
          art_style: selectedStyle || undefined,
          search: searchQuery.trim() || undefined,
          sort_by: sortBy,
        }),
        api.worlds.list(selectedProjectId || undefined).catch(() => []),
        api.projects.list().catch(() => []),
        api.environments.getProviderStatus().catch(() => null),
      ]);
      setEnvironments(envList);
      setWorlds(worldList);
      setProjects(projList);
      if (statusRes) setProviderStatus(statusRes);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load Environment Library."
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    user,
    selectedProjectId,
    selectedCategory,
    selectedStyle,
    searchQuery,
    sortBy,
  ]);

  useEffect(() => {
    if (!authLoading) {
      fetchLibrary();
    }
  }, [authLoading, fetchLibrary]);

  const handleDuplicate = async (envId: string, name: string) => {
    try {
      const copy = await api.environments.duplicate(envId, {
        name: `${name} (Variation Copy)`,
      });
      router.push(`/environments/${copy.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not duplicate environment."
      );
    }
  };

  const handleDelete = async (envId: string) => {
    try {
      await api.environments.delete(envId);
      setEnvironments((prev) => prev.filter((item) => item.id !== envId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete environment."
      );
    }
  };

  const handleCreateWorld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorldName.trim()) return;
    setIsCreatingWorld(true);
    try {
      await api.worlds.create({
        project_id: selectedProjectId || undefined,
        name: newWorldName.trim(),
        description: newWorldDescription.trim() || undefined,
        seed_sample_hierarchy: true,
      });
      setNewWorldName("");
      setNewWorldDescription("");
      await fetchLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create World.");
    } finally {
      setIsCreatingWorld(false);
    }
  };

  const renderWorldHierarchyNodes = (
    locations: WorldLocationRecord[],
    parentId: string | null = null
  ): React.ReactNode => {
    const children = locations.filter(
      (loc) => (loc.parent_id || null) === parentId
    );
    if (children.length === 0) return null;
    return (
      <ul className="mt-1.5 space-y-1.5 border-l border-zinc-800 pl-3.5">
        {children.map((loc) => (
          <li key={loc.id} className="text-xs">
            <details open className="rounded-lg bg-zinc-950/60 p-2">
              <summary className="flex cursor-pointer items-center justify-between gap-2 font-medium text-zinc-200">
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {loc.location_type.replace(/_/g, " ")}
                  </Badge>
                  <span>{loc.name}</span>
                  {loc.environment_id && (
                    <Link
                      href={`/environments/${loc.environment_id}`}
                      className="text-[11px] text-violet-400 underline hover:text-violet-300"
                    >
                      View Environment ({loc.environment_name || "Linked"})
                    </Link>
                  )}
                </span>
              </summary>
              {renderWorldHierarchyNodes(locations, loc.id)}
            </details>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <StudioShell>
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Hero Header */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-600 dark:text-violet-300">
                <Globe className="h-3.5 w-3.5" />
                STEP 4 • WORLD & ENVIRONMENT CREATION STUDIO
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                World &amp; Environment Library
              </h1>
              <p className="text-sm text-muted-foreground">
                Design, generate, and organize natural landscapes, cities, fantasy kingdoms, and sci-fi worlds with non-destructive time, weather, and camera variations.
              </p>
              {providerStatus && (
                <p className="text-xs text-muted-foreground">
                  AI Image Provider:{" "}
                  <span className="font-medium text-foreground">
                    {providerStatus.provider} ({providerStatus.model})
                  </span>{" "}
                  — {providerStatus.configured ? "Ready" : "API Key Missing"}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link href="/environments/new">
                  <Plus className="h-4 w-4" />
                  Create New Environment
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Search & Filter Toolbar */}
        <Card className="border-border bg-card shadow-2xs">
          <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search environments by name, location, or description..."
                className="pl-9"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter by environment category"
              className="h-10 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Categories</option>
              {ENVIRONMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              aria-label="Filter by art style"
              className="h-10 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Art Styles</option>
              {ANIMATION_STYLES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                aria-label="Filter by project"
                className="h-10 rounded-xl border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort environments"
                className="h-10 rounded-xl border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="updated_desc">Recently Updated</option>
                <option value="created_desc">Newest First</option>
                <option value="name_asc">Name (A–Z)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-200"
          >
            {error}
          </div>
        )}

        {/* Environment Cards Grid */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : !user ? (
          <Card className="border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Please sign in to access your World &amp; Environment Library.
            </p>
            <Button asChild className="mt-4">
              <Link href="/login">Sign In</Link>
            </Button>
          </Card>
        ) : environments.length === 0 ? (
          <Card className="border-border bg-card/60 p-12 text-center">
            <Globe className="mx-auto mb-3 h-12 w-12 text-primary/70" />
            <h2 className="text-lg font-semibold text-foreground">
              No Environments Created Yet
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Create your first natural landscape, city street, fantasy kingdom, or sci-fi environment to stage your animated scenes.
            </p>
            <Button asChild className="mt-5 gap-2">
              <Link href="/environments/new">
                <Plus className="h-4 w-4" />
                Create First Environment
              </Link>
            </Button>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {environments.map((env) => (
              <Card
                key={env.id}
                className="group flex flex-col justify-between overflow-hidden border-border bg-card transition-all hover:border-primary/50 hover:shadow-xs"
              >
                <div>
                  <div className="relative h-44 w-full overflow-hidden bg-muted/60">
                    {env.default_image_url ? (
                      <img
                        src={resolveMediaUrl(env.default_image_url)}
                        alt={env.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
                        <Globe className="mb-1.5 h-8 w-8" />
                        <span className="text-[11px]">No preview plate yet</span>
                      </div>
                    )}
                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                      <Badge className="bg-background/90 text-foreground border-border text-[10px]">
                        {env.category}
                      </Badge>
                      <Badge className="bg-primary text-primary-foreground text-[10px]">
                        {env.art_style}
                      </Badge>
                    </div>
                  </div>

                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold text-foreground">
                      {env.name}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground line-clamp-2">
                      {env.description || `${env.location_type} environment`}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 border border-border text-foreground">
                        <Sun className="h-3 w-3 text-amber-500" />
                        {env.time_of_day}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 border border-border text-foreground">
                        <CloudRain className="h-3 w-3 text-sky-500" />
                        {env.weather}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 border border-border text-foreground">
                        <Layers className="h-3 w-3 text-primary" />
                        {env.variation_count} variations
                      </span>
                    </div>

                    {env.color_palette.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                        {env.color_palette.slice(0, 6).map((hex) => (
                          <span
                            key={hex}
                            className="h-4 w-4 rounded-full border border-border"
                            style={{ backgroundColor: hex }}
                            title={hex}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </div>

                <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <div className="flex items-center gap-1.5">
                    <Button asChild size="sm" className="h-8 text-xs">
                      <Link href={`/environments/${env.id}`}>Open</Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                    >
                      <Link href={`/environments/${env.id}/design`}>
                        <Wand2 className="h-3 w-3" />
                        Designer
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                    >
                      <Link href={`/environments/${env.id}/variations`}>
                        Variations
                      </Link>
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicate(env.id, env.name)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Duplicate Environment"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(env.id)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-rose-400"
                      title="Delete Environment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* World Library & Hierarchy Section */}
        {user && (
          <Card className="border-zinc-800/90 bg-zinc-900/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-violet-400" />
                World Library &amp; Location Hierarchy
              </CardTitle>
              <CardDescription className="text-xs">
                Organize locations into structured World hierarchies: World → Country / Kingdom → City / Village → Building / Place → Room / Scene Location.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form
                onSubmit={handleCreateWorld}
                className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 md:grid-cols-3"
              >
                <Input
                  value={newWorldName}
                  onChange={(e) => setNewWorldName(e.target.value)}
                  placeholder="World Name (e.g., Kingdom of Lumina)"
                />
                <Input
                  value={newWorldDescription}
                  onChange={(e) => setNewWorldDescription(e.target.value)}
                  placeholder="World description & lore..."
                />
                <Button
                  type="submit"
                  disabled={isCreatingWorld}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Create World Hierarchy
                </Button>
              </form>

              {worlds.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  {worlds.map((w) => (
                    <div
                      key={w.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">
                          {w.name}
                        </h3>
                        <Badge variant="secondary" className="text-[10px]">
                          {w.locations.length} hierarchy nodes
                        </Badge>
                      </div>
                      {w.description && (
                        <p className="text-xs text-zinc-400">{w.description}</p>
                      )}
                      {renderWorldHierarchyNodes(w.locations, null)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </StudioShell>
  );
}
