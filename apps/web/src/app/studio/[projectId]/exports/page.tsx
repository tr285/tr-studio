import React from "react";
import { SceneStudioFrame } from "@/components/studio/scene-studio-common";
import { ExportStudio } from "@/components/studio/render/export-studio";

export default async function StudioExportsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <SceneStudioFrame
      projectId={projectId}
      active="export"
      title="Video Exports Gallery"
      description="View and download completed video renders."
    >
      <ExportStudio projectId={projectId} />
    </SceneStudioFrame>
  );
}
