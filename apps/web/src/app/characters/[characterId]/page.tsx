"use client";

import React, { Suspense, use } from "react";
import { StudioShell } from "@/components/layout/studio-shell";
import { CharacterStudioWorkspace } from "@/components/characters/character-studio-workspace";

export default function CharacterDetailPage({
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  const { characterId } = use(params);
  return (
    <StudioShell>
      <Suspense
        fallback={
          <div className="py-12 text-center text-sm text-zinc-400">
            Loading character workspace...
          </div>
        }
      >
        <CharacterStudioWorkspace
          characterId={characterId}
          defaultTab="overview"
        />
      </Suspense>
    </StudioShell>
  );
}
