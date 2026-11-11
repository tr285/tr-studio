import React from "react";
import { SceneStudioFrame } from "@/components/studio/scene-studio-common";
import { ExportStudio } from "@/components/studio/render/export-studio";

export default async function StudioRenderPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <SceneStudioFrame
      projectId={projectId}
      active="export"
      title="Video Render Queue"
      description="Monitor active video rendering pipelines and encoding jobs."
    >
      <ExportStudio projectId={projectId} />
    </SceneStudioFrame>
  );
}
