import React from "react";
import { StoryboardStudio } from "@/components/studio/storyboard-studio";

export default async function StudioStoryboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <StoryboardStudio projectId={projectId} />;
}
