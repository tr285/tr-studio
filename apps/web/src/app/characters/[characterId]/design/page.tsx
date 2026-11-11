"use client";

import React, { Suspense, use } from "react";
import { StudioShell } from "@/components/layout/studio-shell";
import { CharacterStudioWorkspace } from "@/components/characters/character-studio-workspace";

export default function CharacterDesignPage({
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
            Loading visual character designer...
          </div>
        }
      >
        <CharacterStudioWorkspace
          characterId={characterId}
          defaultTab="design"
        />
      </Suspense>
    </StudioShell>
  );
}
