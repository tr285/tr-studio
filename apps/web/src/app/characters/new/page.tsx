"use client";

import React, { Suspense } from "react";
import { StudioShell } from "@/components/layout/studio-shell";
import { CharacterCreationForm } from "@/components/characters/character-creation-form";

export default function NewCharacterPage() {
  return (
    <StudioShell>
      <Suspense
        fallback={
          <div className="py-12 text-center text-sm text-zinc-400">
            Loading Character Creation Studio...
          </div>
        }
      >
        <CharacterCreationForm />
      </Suspense>
    </StudioShell>
  );
}
