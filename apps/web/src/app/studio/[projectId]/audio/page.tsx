import React from "react";
import { AudioStudio } from "@/components/studio/audio/audio-studio";

export default async function StudioAudioPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <AudioStudio projectId={projectId} initialTab="dialogue" />;
}
