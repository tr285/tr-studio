import React from "react";
import { ProjectStoryLoader } from "@/components/studio/project-story-loader";

interface StudioStoryDetailsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function StudioStoryDetailsPage({
  params,
}: StudioStoryDetailsPageProps) {
  const { projectId } = await params;
  return <ProjectStoryLoader projectId={projectId} defaultSection="story" />;
}
