"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, Sparkles } from "lucide-react";

import { StudioShell } from "@/components/layout/studio-shell";
import { StoryCreationForm } from "@/components/studio/story-creation-form";
import {
  StoryWorkspace,
  type StudioViewSection,
} from "@/components/studio/story-workspace";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import type { Project, StoryResponse } from "@tr-studio/shared-types";

interface ProjectStoryLoaderProps {
  projectId: string;
  defaultSection?: StudioViewSection;
}

export function ProjectStoryLoader({
  projectId,
  defaultSection = "story",
}: ProjectStoryLoaderProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [story, setStory] = useState<StoryResponse | null>(null);
  const [noStoryYet, setNoStoryYet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoStoryYet(false);
    try {
      const proj = await api.projects.get(projectId);
      setProject(proj);

      try {
        const storyRecord = await api.stories.getByProject(projectId);
        setStory(storyRecord);
      } catch (storyErr) {
        if (storyErr instanceof ApiClientError && storyErr.status === 404) {
          setNoStoryYet(true);
        } else {
          throw storyErr;
        }
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to load project story workspace.");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <StudioShell>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400 mb-3" />
          <p className="text-sm">Loading project story workspace...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-6 text-red-200 max-w-2xl mx-auto my-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-white">
                Unable to Open Story Workspace
              </h2>
              <p className="text-sm text-red-200/90">{error}</p>
              <div className="flex items-center gap-3 pt-1">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/projects">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Projects
                  </Link>
                </Button>
                <Button size="sm" onClick={() => void loadData()}>
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : noStoryYet ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-violet-500/25 bg-violet-950/15 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Initialize Story for &ldquo;{project?.title}&rdquo;
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  This project does not have a structured story yet. Generate one with AI or initialize a manual screenplay below.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-3.5 w-3.5" />
                All Projects
              </Link>
            </Button>
          </div>
          <StoryCreationForm
            projectId={projectId}
            onStoryCreated={() => {
              void loadData();
            }}
          />
        </div>
      ) : story ? (
        <StoryWorkspace
          projectId={projectId}
          initialStory={story}
          defaultSection={defaultSection}
        />
      ) : null}
    </StudioShell>
  );
}
