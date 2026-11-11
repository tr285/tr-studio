"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Clapperboard,
  Film,
  Image as ImageIcon,
  ImageOff,
  LayoutGrid,
  Loader2,
  Mic,
  Play,
  Trash2,
  Video,
  Volume2,
} from "lucide-react";

import { StudioShell } from "@/components/layout/studio-shell";
import { Button } from "@/components/ui/button";
import { api, ApiClientError, resolveMediaUrl } from "@/lib/api";
import type { Project } from "@tr-studio/shared-types";

export const fieldClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50";
export const labelClass = "mb-1 block text-xs font-medium text-zinc-400";

export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export type SceneStudioSection = "scenes" | "storyboard" | "shot-list" | "animation" | "audio" | "export";

export function SceneStudioNav({
  projectId,
  active,
}: {
  projectId: string;
  active: SceneStudioSection;
}) {
  const items: { id: SceneStudioSection; label: string; href: string; icon: React.ReactNode }[] = [
    { id: "scenes", label: "Scenes", href: `/studio/${projectId}/scenes`, icon: <Clapperboard className="h-3.5 w-3.5" /> },
    { id: "storyboard", label: "Storyboard", href: `/studio/${projectId}/storyboard`, icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { id: "shot-list", label: "Shot List", href: `/studio/${projectId}/shot-list`, icon: <Film className="h-3.5 w-3.5" /> },
    { id: "animation", label: "Animation", href: `/studio/${projectId}/animation`, icon: <Play className="h-3.5 w-3.5" /> },
    { id: "audio", label: "Audio & Voice", href: `/studio/${projectId}/audio`, icon: <Volume2 className="h-3.5 w-3.5" /> },
    { id: "export", label: "Export & Render", href: `/studio/${projectId}/export`, icon: <Video className="h-3.5 w-3.5" /> },
  ];
  return (
    <nav
      aria-label="Story Studio sections"
      className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1"
    >
      <Link
        href={`/studio/${projectId}`}
        className="rounded px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
      >
        Story
      </Link>
      <Link
        href={`/studio/${projectId}/screenplay`}
        className="rounded px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
      >
        Screenplay
      </Link>
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={active === item.id ? "page" : undefined}
          className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs ${
            active === item.id
              ? "bg-violet-600 text-white"
              : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
          }`}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Loads the project (ownership enforced by the API) and renders the studio chrome. */
export function SceneStudioFrame({
  projectId,
  active,
  title,
  description,
  actions,
  children,
}: {
  projectId: string;
  active: SceneStudioSection;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProject(await api.projects.get(projectId));
    } catch (err) {
      setError(errorMessage(err, "Failed to load project."));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <StudioShell>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400" role="status">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-violet-400" />
          <p className="text-sm">Loading project…</p>
        </div>
      ) : error ? (
        <div role="alert" className="mx-auto my-8 max-w-2xl rounded-xl border border-red-500/30 bg-red-950/30 p-6 text-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-white">Unable to open project</h2>
              <p className="text-sm">{error}</p>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/projects">
                    <ArrowLeft className="h-4 w-4" /> Back to Projects
                  </Link>
                </Button>
                <Button size="sm" onClick={() => void load()}>
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-violet-400">
                {project?.title}
              </p>
              <h1 className="text-xl font-semibold text-white">{title}</h1>
              <p className="mt-0.5 max-w-2xl text-sm text-zinc-400">{description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {actions}
              <SceneStudioNav projectId={projectId} active={active} />
            </div>
          </header>
          {children}
        </div>
      )}
    </StudioShell>
  );
}

/** Real image when available; otherwise an honest placeholder (never a fabricated image). */
export function AssetImage({
  url,
  alt,
  placeholder = "No visual asset",
  className = "",
}: {
  url?: string | null;
  alt: string;
  placeholder?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 bg-zinc-900 text-zinc-500 ${className}`}
        role="img"
        aria-label={`${alt}: ${failed ? "image unavailable" : placeholder}`}
      >
        {failed ? <ImageOff className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
        <span className="px-2 text-center text-[10px]">
          {failed ? "Image unavailable" : placeholder}
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolveMediaUrl(url)}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

/** Two-step inline confirmation for destructive actions (no modal required). */
export function ConfirmDeleteButton({
  onConfirm,
  label = "Delete",
  disabled,
  iconOnly,
}: {
  onConfirm: () => void;
  label?: string;
  disabled?: boolean;
  iconOnly?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  if (armed) {
    return (
      <span className="inline-flex items-center gap-1" role="group" aria-label={`Confirm ${label}`}>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() => {
            setArmed(false);
            onConfirm();
          }}
        >
          Confirm {label}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setArmed(false)}>
          Cancel
        </Button>
      </span>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={() => setArmed(true)}
      aria-label={label}
      title={label}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {!iconOnly && label}
    </Button>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string | null; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" className="underline" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
