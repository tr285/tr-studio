import React from "react";
import { ProjectStoryLoader } from "@/components/studio/project-story-loader";

interface StudioProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function StudioProjectPage({
  params,
}: StudioProjectPageProps) {
  const { projectId } = await params;
  return <ProjectStoryLoader projectId={projectId} defaultSection="story" />;
}
