import React from "react";
import { SceneListWorkspace } from "@/components/studio/scene-list-workspace";

export default async function StudioScenesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <SceneListWorkspace projectId={projectId} />;
}
