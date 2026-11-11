"use client";

import React, { Suspense, use } from "react";
import { Loader2 } from "lucide-react";
import { StudioShell } from "@/components/layout/studio-shell";
import { EnvironmentStudioWorkspace } from "@/components/environments/environment-studio-workspace";

export default function EnvironmentVariationsPage({
  params,
}: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = use(params);
  return (
    <StudioShell>
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          </div>
        }
      >
        <EnvironmentStudioWorkspace
          environmentId={environmentId}
          defaultTab="variations"
        />
      </Suspense>
    </StudioShell>
  );
}
