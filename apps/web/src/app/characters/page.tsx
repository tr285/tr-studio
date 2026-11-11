"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Copy,
  Layers,
  Loader2,
  Palette,
  Plus,
  Search,
  Shirt,
  Smile,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  CHARACTER_ROLES,
  CHARACTER_VISUAL_STYLES,
} from "@tr-studio/scene-schema";
import type {
  CharacterSummaryRecord,
  ImageProviderStatusResponse,
  Project,
} from "@tr-studio/shared-types";
import { api, ApiClientError, resolveMediaUrl } from "@/lib/api";
import { StudioShell } from "@/components/layout/studio-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function CharactersLibraryPage() {
  const [characters, setCharacters] = useState<CharacterSummaryRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [aiStatus, setAiStatus] = useState<ImageProviderStatusResponse | null>(
    null
  );

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [styleFilter, setStyleFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [charsRes, projsRes, statusRes] = await Promise.all([
        api.characters.list({
          project_id: projectFilter || undefined,
          role: roleFilter !== "all" ? roleFilter : undefined,
          style: styleFilter !== "all" ? styleFilter : undefined,
          search: search.trim() || undefined,
        }),
        api.projects.list().catch(() => []),
        api.characters.aiStatus().catch(() => null),
      ]);
      setCharacters(charsRes);
      setProjects(projsRes);
      if (statusRes) setAiStatus(statusRes);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to load character library."
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectFilter, roleFilter, styleFilter, search]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const handleDuplicateVariation = async (char: CharacterSummaryRecord) => {
    try {
      await api.characters.createVariation(char.id, {
        name: `${char.name} (Variation)`,
        style: char.style,
      });
      await loadLibrary();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Could not create variation."
      );
    }
  };

  const handleDeleteCharacter = async (charId: string) => {
    try {
      await api.characters.delete(charId);
      setCharacters((prev) => prev.filter((c) => c.id !== charId));
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Could not delete character."
      );
    }
  };

  return (
    <StudioShell>
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Hero Header */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-600 dark:text-violet-300">
              <Users className="h-3.5 w-3.5" />
              TR STUDIO · Character Creation Studio
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Character Library & Visual Bible
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Create, customize, generate, and manage original animated
              characters with persistent visual styles, turnaround sheets,
              expressions, poses, and outfits across your stories.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="gap-2">
              <Link href="/characters/new">
                <Plus className="h-4 w-4" />
                Create Character
              </Link>
            </Button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xs sm:grid-cols-12">
          <div className="relative sm:col-span-4">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search characters by name or appearance"
              placeholder="Search characters by name, role, or traits..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              aria-label="Filter by character role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Character Roles</option>
              {CHARACTER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              aria-label="Filter by visual style"
              value={styleFilter}
              onChange={(e) => setStyleFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Visual Styles</option>
              {CHARACTER_VISUAL_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              aria-label="Filter by project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {aiStatus && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground">AI Image Engine Status:</strong>{" "}
              {aiStatus.message}
            </span>
            <Badge variant={aiStatus.configured ? "default" : "secondary"}>
              {aiStatus.configured
                ? `${aiStatus.provider} · ${aiStatus.model}`
                : "Manual & Upload Ready"}
            </Badge>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-950/20 p-4 text-sm text-red-600 dark:text-red-200"
          >
            {error}
          </div>
        )}

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-muted-foreground"
          >
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Loading characters...</p>
          </div>
        ) : characters.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">
                No Characters in Library Yet
              </h2>
              <p className="mx-auto max-w-md text-xs text-muted-foreground">
                Create your first character manually, generate one with AI,
                upload your own reference artwork, or import characters from a
                story in the Story Studio.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button asChild className="gap-2">
                <Link href="/characters/new">
                  <Plus className="h-4 w-4" />
                  Create First Character
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((char) => {
              const imgUrl = resolveMediaUrl(char.canonical_reference_url);
              return (
                <article
                  key={char.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-xs"
                >
                  <div>
                    <Link
                      href={`/characters/${char.id}`}
                      className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/60"
                    >
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={char.name}
                          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-lg font-bold text-primary">
                            {char.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-[11px]">
                            Click to design or upload reference
                          </span>
                        </div>
                      )}
                      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                        <Badge variant="default" className="text-[10px]">
                          {char.role}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {char.style}
                        </Badge>
                      </div>
                    </Link>

                    <div className="p-4 space-y-2.5">
                      <div>
                        <Link
                          href={`/characters/${char.id}`}
                          className="text-base font-bold text-foreground hover:text-primary transition-colors"
                        >
                          {char.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {char.species}
                          {char.age_description
                            ? ` · ${char.age_description}`
                            : ""}
                        </p>
                      </div>

                      {char.appearance_description && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {char.appearance_description}
                        </p>
                      )}

                      <div className="grid grid-cols-4 gap-1.5 pt-1 text-center text-[10px] text-muted-foreground">
                        <Link
                          href={`/characters/${char.id}/design`}
                          className="rounded-lg border border-border bg-muted/40 py-1.5 hover:border-primary/40 hover:text-foreground transition-colors"
                        >
                          <Palette className="mx-auto mb-0.5 h-3 w-3 text-primary" />
                          {char.asset_count} Assets
                        </Link>
                        <Link
                          href={`/characters/${char.id}/expressions`}
                          className="rounded-lg border border-border bg-muted/40 py-1.5 hover:border-primary/40 hover:text-foreground transition-colors"
                        >
                          <Smile className="mx-auto mb-0.5 h-3 w-3 text-amber-500 dark:text-amber-400" />
                          {char.expression_count} Expr
                        </Link>
                        <Link
                          href={`/characters/${char.id}/poses`}
                          className="rounded-lg border border-border bg-muted/40 py-1.5 hover:border-primary/40 hover:text-foreground transition-colors"
                        >
                          <Layers className="mx-auto mb-0.5 h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                          {char.pose_count} Poses
                        </Link>
                        <Link
                          href={`/characters/${char.id}/outfits`}
                          className="rounded-lg border border-border bg-muted/40 py-1.5 hover:border-primary/40 hover:text-foreground transition-colors"
                        >
                          <Shirt className="mx-auto mb-0.5 h-3 w-3 text-sky-500 dark:text-sky-400" />
                          {char.outfit_count} Outfits
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                      <Link href={`/characters/${char.id}`}>
                        Open Character Studio
                      </Link>
                    </Button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Create Character Variation"
                        onClick={() => handleDuplicateVariation(char)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${char.name}`}
                        onClick={() => handleDeleteCharacter(char.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </StudioShell>
  );
}
