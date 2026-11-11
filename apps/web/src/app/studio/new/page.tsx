"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { StudioShell } from "@/components/layout/studio-shell";
import { StoryCreationForm } from "@/components/studio/story-creation-form";

function NewStoryContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;

  return <StoryCreationForm projectId={projectId} />;
}

export default function NewStoryStudioPage() {
  return (
    <StudioShell>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400 mr-2" />
            Loading Story Creation Studio...
          </div>
        }
      >
        <NewStoryContent />
      </Suspense>
    </StudioShell>
  );
}
