"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Globe, Loader2 } from "lucide-react";
import { StudioShell } from "@/components/layout/studio-shell";
import { EnvironmentCreationForm } from "@/components/environments/environment-creation-form";
import { Button } from "@/components/ui/button";

export default function NewEnvironmentPage() {
  return (
    <StudioShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-violet-400">
              <Globe className="h-3.5 w-3.5" />
              WORLD &amp; ENVIRONMENT CREATION STUDIO
            </div>
            <h1 className="text-2xl font-bold text-white">
              Create New Story Environment
            </h1>
            <p className="text-xs text-zinc-400">
              Design any natural, human, fantasy, sci-fi, or custom environment with full control over lighting, weather, time of day, and camera perspective.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/environments">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Environment Library
            </Link>
          </Button>
        </div>

        <Suspense
          fallback={
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
            </div>
          }
        >
          <EnvironmentCreationForm />
        </Suspense>
      </div>
    </StudioShell>
  );
}
