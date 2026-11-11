import React from "react";
import { SceneStudioFrame } from "@/components/studio/scene-studio-common";
import { ExportStudio } from "@/components/studio/render/export-studio";

export default async function StudioExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <SceneStudioFrame
      projectId={projectId}
      active="export"
      title="Video Rendering & Export"
      description="Encode animated scenes, character assets, master audio, and anime subtitles into production video."
    >
      <ExportStudio projectId={projectId} />
    </SceneStudioFrame>
  );
}
