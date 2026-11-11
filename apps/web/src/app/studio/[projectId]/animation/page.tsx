import React from "react";
import { AnimationStudio } from "@/components/studio/animation-studio";

export default async function StudioAnimationPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ sceneId?: string }>;
}) {
  const { projectId } = await params;
  const sp = searchParams ? await searchParams : {};
  return (
    <AnimationStudio
      projectId={projectId}
      initialSceneId={sp.sceneId}
    />
  );
}
