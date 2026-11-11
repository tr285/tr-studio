import React from "react";
import { SceneComposerPage } from "@/components/studio/scene-composer";

export default async function StudioSceneDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; sceneId: string }>;
}) {
  const { projectId, sceneId } = await params;
  return <SceneComposerPage projectId={projectId} sceneId={sceneId} />;
}
